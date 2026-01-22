#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import shutil
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ExtractResult:
    extracted_files: int
    skipped_files: int
    extracted_bytes: int


def _safe_join(root: Path, member_name: str) -> Path:
    normalized = member_name.replace("\\", "/")
    parts = [p for p in normalized.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        raise ValueError(f"Unsafe member path: {member_name}")
    return root.joinpath(*parts)


def _extract_zip_pdfs(zip_path: Path, docs_dir: Path, prefix: str) -> int:
    extracted = 0
    docs_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            if info.filename.startswith("__MACOSX/"):
                continue
            if not info.filename.lower().endswith(".pdf"):
                continue
            out_path = docs_dir / f"{prefix}_{Path(info.filename).name}"
            if out_path.exists() and out_path.stat().st_size == info.file_size:
                continue
            with z.open(info) as src, out_path.open("wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
            extracted += 1
    return extracted


def _open_gzipped_tar_inside_zip(zip_path: Path, tar_suffix: str) -> tarfile.TarFile:
    zip_file = zipfile.ZipFile(zip_path)
    try:
        tar_members = [
            info
            for info in zip_file.infolist()
            if info.filename.lower().endswith(tar_suffix.lower())
            and not info.filename.startswith("__MACOSX/")
        ]
        if not tar_members:
            raise FileNotFoundError(
                f"Could not find {tar_suffix} inside {zip_path}."
            )
        tar_stream = zip_file.open(tar_members[0])
    except Exception:
        zip_file.close()
        raise

    tf = tarfile.open(fileobj=tar_stream, mode="r|gz")
    tf._codex_zip_file = zip_file  # type: ignore[attr-defined]
    tf._codex_tar_stream = tar_stream  # type: ignore[attr-defined]
    return tf


def _close_tar_chain(tf: tarfile.TarFile) -> None:
    tar_stream = getattr(tf, "_codex_tar_stream", None)
    zip_file = getattr(tf, "_codex_zip_file", None)
    try:
        tf.close()
    finally:
        if tar_stream is not None:
            tar_stream.close()
        if zip_file is not None:
            zip_file.close()


def _extract_tar_stream(tf: tarfile.TarFile, out_root: Path, *, max_files: int) -> ExtractResult:
    extracted_files = 0
    skipped_files = 0
    extracted_bytes = 0

    out_root.mkdir(parents=True, exist_ok=True)

    for member in tf:
        if max_files > 0 and extracted_files >= max_files:
            break

        if member.isdir():
            _safe_join(out_root, member.name).mkdir(parents=True, exist_ok=True)
            continue

        if not member.isfile():
            continue

        out_path = _safe_join(out_root, member.name)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if out_path.exists() and out_path.stat().st_size == member.size:
            skipped_files += 1
            continue

        src = tf.extractfile(member)
        if src is None:
            continue
        with src, out_path.open("wb") as dst:
            shutil.copyfileobj(src, dst, length=1024 * 1024)
        extracted_files += 1
        extracted_bytes += int(member.size or 0)

        if extracted_files % 25 == 0:
            print(f"… extracted {extracted_files:,} files", flush=True)

    return ExtractResult(
        extracted_files=extracted_files,
        skipped_files=skipped_files,
        extracted_bytes=extracted_bytes,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract the Yelp Open Dataset archives into folders you can browse.",
    )
    parser.add_argument("--out", type=Path, default=Path("data/yelp_extracted"))
    parser.add_argument("--json-zip", type=Path, default=Path("data/Yelp-JSON.zip"))
    parser.add_argument("--photos-zip", type=Path, default=Path("data/Yelp-Photos.zip"))
    parser.add_argument(
        "--what",
        choices=("json", "photos", "both"),
        default="json",
        help="Which archive(s) to extract.",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=0,
        help="If >0, stop after extracting this many files (useful for photos).",
    )

    args = parser.parse_args()

    out_dir = args.out
    docs_dir = out_dir / "docs"
    json_out = out_dir / "yelp_json"
    photos_out = out_dir / "yelp_photos"

    out_dir.mkdir(parents=True, exist_ok=True)

    if args.what in ("json", "both"):
        if not args.json_zip.exists():
            raise FileNotFoundError(f"Missing: {args.json_zip}")

        print(f"Extracting docs from: {args.json_zip}")
        _extract_zip_pdfs(args.json_zip, docs_dir, prefix="yelp_json")

        print(f"Extracting dataset tar from: {args.json_zip}")
        tf = _open_gzipped_tar_inside_zip(args.json_zip, tar_suffix="yelp_dataset.tar")
        try:
            result = _extract_tar_stream(tf, json_out, max_files=args.max_files)
        finally:
            _close_tar_chain(tf)

        print(
            f"JSON extracted: {result.extracted_files:,} files "
            f"({result.extracted_bytes / (1024**3):.2f} GiB), "
            f"skipped: {result.skipped_files:,}"
        )
        print(f"→ {json_out}")

    if args.what in ("photos", "both"):
        if not args.photos_zip.exists():
            raise FileNotFoundError(f"Missing: {args.photos_zip}")

        print(f"Extracting docs from: {args.photos_zip}")
        _extract_zip_pdfs(args.photos_zip, docs_dir, prefix="yelp_photos")

        print(f"Extracting photos tar from: {args.photos_zip}")
        tf = _open_gzipped_tar_inside_zip(args.photos_zip, tar_suffix="yelp_photos.tar")
        try:
            result = _extract_tar_stream(tf, photos_out, max_files=args.max_files)
        finally:
            _close_tar_chain(tf)

        print(
            f"Photos extracted: {result.extracted_files:,} files "
            f"({result.extracted_bytes / (1024**3):.2f} GiB), "
            f"skipped: {result.skipped_files:,}"
        )
        print(f"→ {photos_out}")

    print(f"Docs → {docs_dir}")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("MKL_THREADING_LAYER", "SEQ")
    raise SystemExit(main())

