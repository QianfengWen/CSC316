#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import os
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


os.environ.setdefault("MKL_THREADING_LAYER", "SEQ")


@dataclass
class FieldProfile:
    present: int = 0
    types: Counter[str] = field(default_factory=Counter)
    example: str = ""
    num_min: float | None = None
    num_max: float | None = None
    str_len_min: int | None = None
    str_len_max: int | None = None

    def observe(self, value: Any) -> None:
        self.present += 1
        t = _type_name(value)
        self.types[t] += 1

        if not self.example and value is not None:
            self.example = _truncate(repr(value), 120)

        if isinstance(value, (int, float)) and not isinstance(value, bool):
            val = float(value)
            if self.num_min is None or val < self.num_min:
                self.num_min = val
            if self.num_max is None or val > self.num_max:
                self.num_max = val

        if isinstance(value, str):
            ln = len(value)
            if self.str_len_min is None or ln < self.str_len_min:
                self.str_len_min = ln
            if self.str_len_max is None or ln > self.str_len_max:
                self.str_len_max = ln


@dataclass
class FileProfile:
    dataset: str
    path: Path
    size_bytes: int
    rows_total: int | None
    rows_profiled: int
    fields: dict[str, FieldProfile]
    notes: list[str] = field(default_factory=list)
    extra_counters: dict[str, Counter[str]] = field(default_factory=dict)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _human_bytes(num: int) -> str:
    step = 1024.0
    units = ["B", "KiB", "MiB", "GiB", "TiB"]
    size = float(num)
    for unit in units:
        if size < step or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= step
    return f"{size:.1f} TiB"


def _type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    return type(value).__name__


def _count_lines_fast(path: Path) -> int:
    count = 0
    with path.open("rb") as f:
        while True:
            chunk = f.read(8 * 1024 * 1024)
            if not chunk:
                break
            count += chunk.count(b"\n")
    return count


def _profile_file(
    dataset: str,
    path: Path,
    *,
    sample_rows: int,
    count_total_rows: bool,
) -> FileProfile:
    size_bytes = path.stat().st_size
    rows_total = _count_lines_fast(path) if count_total_rows else None

    fields: dict[str, FieldProfile] = {}
    extra_counters: dict[str, Counter[str]] = {}

    profiled_rows = 0
    with path.open("rb") as f:
        for raw in f:
            if sample_rows > 0 and profiled_rows >= sample_rows:
                break
            if not raw.strip():
                continue
            obj = json.loads(raw)
            if not isinstance(obj, dict):
                continue
            profiled_rows += 1

            for key, value in obj.items():
                fp = fields.get(key)
                if fp is None:
                    fp = FieldProfile()
                    fields[key] = fp
                fp.observe(value)

                if dataset == "business" and key in ("attributes", "hours") and isinstance(value, dict):
                    counter_key = f"{dataset}.{key}_keys"
                    counter = extra_counters.get(counter_key)
                    if counter is None:
                        counter = Counter()
                        extra_counters[counter_key] = counter
                    counter.update(value.keys())

    notes: list[str] = []
    if dataset == "business":
        notes.append("`categories` is a comma-separated string of category names.")
        notes.append("`attributes` is a dict of string→string flags/values (varies by business).")
        notes.append("`hours` is a dict day→opening-hours string (may be missing).")
    if dataset == "checkin":
        notes.append("`date` is a comma-separated list of ISO timestamps (local time).")
    if dataset == "review":
        notes.append("`text` can be long; consider sampling for heavy analysis.")
    if dataset == "user":
        notes.append("`friends` is a comma-separated list of user IDs.")
        notes.append("`elite` is a comma-separated list of years.")

    return FileProfile(
        dataset=dataset,
        path=path,
        size_bytes=size_bytes,
        rows_total=rows_total,
        rows_profiled=profiled_rows,
        fields=fields,
        notes=notes,
        extra_counters=extra_counters,
    )


def _write_schema_csv(out_dir: Path, profile: FileProfile) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"schema_{profile.dataset}.csv"

    rows_profiled = max(1, profile.rows_profiled)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "field",
                "present_in_sample",
                "present_pct",
                "type_counts",
                "example",
                "num_min",
                "num_max",
                "str_len_min",
                "str_len_max",
            ]
        )
        for field_name in sorted(profile.fields.keys()):
            fp = profile.fields[field_name]
            type_counts = " | ".join(
                f"{t}:{c}" for t, c in fp.types.most_common()
            )
            w.writerow(
                [
                    field_name,
                    fp.present,
                    fp.present / rows_profiled,
                    type_counts,
                    fp.example,
                    fp.num_min,
                    fp.num_max,
                    fp.str_len_min,
                    fp.str_len_max,
                ]
            )
    return out_path


def _write_counter_csv(out_dir: Path, name: str, counter: Counter[str]) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{name}.csv"
    total = sum(counter.values()) or 1
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["key", "count", "share"])
        for k, v in counter.most_common():
            w.writerow([k, v, v / total])
    return out_path


def _markdown_section_for_profile(profile: FileProfile) -> str:
    lines: list[str] = [f"## `{profile.dataset}`", ""]
    rows_total = f"{profile.rows_total:,}" if profile.rows_total is not None else "—"
    lines.append(f"- File: `{profile.path}`")
    lines.append(f"- Size: {_human_bytes(profile.size_bytes)}")
    lines.append(f"- Rows (total): {rows_total}")
    lines.append(f"- Rows (profiled): {profile.rows_profiled:,}")
    for note in profile.notes:
        lines.append(f"- Note: {note}")
    lines.append("")

    if profile.extra_counters:
        lines.append("### Nested keys (sample)")
        for counter_name, counter in sorted(profile.extra_counters.items()):
            if not counter:
                continue
            lines.append(f"- `{counter_name}.csv` (top 20 shown below)")
            for k, v in counter.most_common(20):
                lines.append(f"  - `{k}`: {v:,}")
        lines.append("")

    lines.append("| field | present% (sample) | types (sample) | example |")
    lines.append("|---|---:|---|---|")
    denom = max(1, profile.rows_profiled)
    for name in sorted(profile.fields.keys()):
        fp = profile.fields[name]
        present_pct = fp.present / denom
        types = ", ".join(f"{t}:{c}" for t, c in fp.types.most_common(3))
        example = fp.example or "—"
        lines.append(f"| `{name}` | {present_pct:.1%} | {types} | {example} |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a comprehensive overview of the Yelp JSON files (rows, size, fields/types).",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data/yelp_extracted/yelp_json"),
        help="Directory containing extracted Yelp JSONL files.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("outputs/eda"),
        help="Output directory for the report and schema CSVs.",
    )
    parser.add_argument(
        "--sample-rows",
        type=int,
        default=50_000,
        help="How many rows to parse per file for profiling (0 = none).",
    )
    parser.add_argument(
        "--count-total-rows",
        action="store_true",
        help="Count total rows by scanning the full file (slower but accurate).",
    )

    args = parser.parse_args()

    data_dir: Path = args.data_dir
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Missing {data_dir}. Run `python3 -u scripts/yelp_extract.py --what json` first."
        )

    files = {
        "business": data_dir / "yelp_academic_dataset_business.json",
        "checkin": data_dir / "yelp_academic_dataset_checkin.json",
        "review": data_dir / "yelp_academic_dataset_review.json",
        "tip": data_dir / "yelp_academic_dataset_tip.json",
        "user": data_dir / "yelp_academic_dataset_user.json",
    }

    profiles: list[FileProfile] = []
    schema_paths: list[Path] = []
    extra_paths: list[Path] = []

    for dataset, path in files.items():
        if not path.exists():
            continue
        sample = max(0, args.sample_rows)
        print(f"Profiling {dataset}: {path} (sample_rows={sample:,})", flush=True)
        profile = _profile_file(
            dataset,
            path,
            sample_rows=sample,
            count_total_rows=args.count_total_rows,
        )
        profiles.append(profile)
        schema_paths.append(_write_schema_csv(args.out, profile))
        for counter_name, counter in profile.extra_counters.items():
            extra_paths.append(_write_counter_csv(args.out, counter_name, counter))

    report_path = args.out / "data_overview.md"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines: list[str] = [
        "# Yelp Open Dataset — Data Overview",
        "",
        f"- Generated: {timestamp}",
        f"- Data dir: `{data_dir}`",
        f"- Profiling sample rows per file: {args.sample_rows:,}",
        "",
        "## Files",
        "| dataset | rows_total | size | path |",
        "|---|---:|---:|---|",
    ]
    for p in profiles:
        rows_total = f"{p.rows_total:,}" if p.rows_total is not None else "—"
        lines.append(
            f"| `{p.dataset}` | {rows_total} | {_human_bytes(p.size_bytes)} | `{p.path}` |"
        )
    lines.append("")
    lines.append("## Schemas")
    lines.append("Schema CSVs (useful for process book / documentation):")
    for schema_path in schema_paths:
        lines.append(f"- `{schema_path}`")
    lines.append("")

    if extra_paths:
        lines.append("## Nested Key Tables")
        for extra_path in extra_paths:
            lines.append(f"- `{extra_path}`")
        lines.append("")

    for p in profiles:
        lines.append(_markdown_section_for_profile(p))

    args.out.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
