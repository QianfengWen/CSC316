#!/usr/bin/env python3
"""
CSC316 Week 3 — Yelp Open Dataset: "fancy-enough" exploratory figures

What this script does
- Reads the Yelp Open Dataset *directly* from Yelp-JSON.zip (streaming; no full extraction needed).
- Generates a folder of PNG figures with question-style titles (process-book-ready).
- Writes a manifest.md listing every figure + notes (sample sizes, filters, etc.).

Design goals
- Make charts *look nicer* than default Matplotlib: consistent theme, readable labels, value annotations,
  sane formatting for large numbers, and a couple of "wow" charts (density/hexbin, heatmaps).
- Keep everything aggregated. This script does NOT export any raw review text.

Typical usage
  python3 -u scripts/yelp_fancy_figures.py --zip data/Yelp-JSON.zip --out outputs/week3_figures

Optional filters
  python3 -u scripts/yelp_fancy_figures.py --state ON --city Toronto
  python3 -u scripts/yelp_fancy_figures.py --category Restaurants

Optional performance knobs (recommended for laptops)
  # By default this script processes the full dataset; use caps to speed it up.
  python3 -u scripts/yelp_fancy_figures.py --max-reviews 200000 --max-users 200000 --max-tips 200000
  python3 -u scripts/yelp_fancy_figures.py --no-checkins

Outputs
- PNGs: 01_*.png, 02_*.png, ...
- manifest.md

Notes
- The Yelp JSON files are JSONL: one JSON object per line.
- Some business fields (like `hours` or `attributes`) can be missing; charts that depend on them
  will be skipped automatically.

"""

from __future__ import annotations

import os

# Avoid OpenMP shared-memory issues in some container environments.
os.environ.setdefault("KMP_USE_SHM", "0")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_THREADING_LAYER", "SEQ")

import argparse
import json
import math
import tarfile
import zipfile
from array import array
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import matplotlib

# Force a non-interactive backend so this script runs in headless environments
# (e.g., WSL/containers/CI) without requiring Qt/X11.
matplotlib.use("Agg")

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd
import seaborn as sns


# ----------------------------
# Small utilities
# ----------------------------

@dataclass(frozen=True)
class ChartSpec:
    filename: str
    title: str
    notes: str = ""


def _normalize_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return float("nan")


def _parse_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    text = _normalize_str(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _parse_bool(value: object) -> bool | None:
    """
    Yelp `attributes` values often come in as:
      - True/False
      - "True"/"False"
      - "0"/"1"
      - None
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = _normalize_str(value).lower()
    if text in ("true", "1", "yes", "y", "t"):
        return True
    if text in ("false", "0", "no", "n", "f"):
        return False
    return None


def _split_categories(categories_field: object) -> list[str]:
    """
    In the Yelp academic JSON, `categories` is commonly a comma-separated string.
    (Sometimes docs show an array — this helper handles either.)
    """
    if categories_field is None:
        return []
    if isinstance(categories_field, list):
        return [str(c).strip() for c in categories_field if str(c).strip()]
    text = _normalize_str(categories_field)
    if not text:
        return []
    return [c.strip() for c in text.split(",") if c.strip()]


def _iter_jsonl_dicts(fileobj) -> Iterable[dict]:
    for raw_line in fileobj:
        if not raw_line:
            return
        line = raw_line.decode("utf-8", errors="strict").strip()
        if not line:
            continue
        obj = json.loads(line)
        if isinstance(obj, dict):
            yield obj


# ----------------------------
# Reading Yelp-JSON.zip (tar.gz inside zip)
# ----------------------------

def _iter_tar_members_from_zip(zip_path: Path) -> tarfile.TarFile:
    zip_file = zipfile.ZipFile(zip_path)
    try:
        candidates = [
            info.filename
            for info in zip_file.infolist()
            if info.filename.lower().endswith("yelp_dataset.tar")
            and not info.filename.startswith("__MACOSX/")
        ]
        if not candidates:
            raise FileNotFoundError(f"Could not find yelp_dataset.tar inside {zip_path}")
        tar_member_name = candidates[0]
        tar_gz_stream = zip_file.open(tar_member_name)
    except Exception:
        zip_file.close()
        raise

    # Yelp-JSON.zip contains a gzip stream named *.tar (effectively a .tar.gz).
    tf = tarfile.open(fileobj=tar_gz_stream, mode="r|gz")

    # Attach closers so callers can close a single handle.
    tf._codex_zip_file = zip_file  # type: ignore[attr-defined]
    tf._codex_tar_gz_stream = tar_gz_stream  # type: ignore[attr-defined]
    return tf


def _close_tar_chain(tf: tarfile.TarFile) -> None:
    tar_stream = getattr(tf, "_codex_tar_gz_stream", None)
    zip_file = getattr(tf, "_codex_zip_file", None)
    try:
        tf.close()
    finally:
        if tar_stream is not None:
            tar_stream.close()
        if zip_file is not None:
            zip_file.close()


# ----------------------------
# Filters / geography helpers
# ----------------------------

_CANADA_PROVINCES_TERRITORIES = {
    "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
}
_US_STATES_AND_DC = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
    "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
}


def _country_for_state_code(state_code: str) -> str:
    state = _normalize_str(state_code).upper()
    if not state:
        return "Other/Unknown"
    if state in _CANADA_PROVINCES_TERRITORIES:
        return "Canada"
    if state in _US_STATES_AND_DC:
        return "United States"
    return "Other/Unknown"


def _business_passes_filters(
    business: dict,
    *,
    states: set[str],
    cities: set[str],
    category_substrings: list[str],
) -> bool:
    state = _normalize_str(business.get("state")).upper()
    city = _normalize_str(business.get("city")).lower()

    categories_str = _normalize_str(business.get("categories")).lower()
    if states and state not in states:
        return False
    if cities and city not in cities:
        return False
    if category_substrings and not any(s in categories_str for s in category_substrings):
        return False
    return True


# ----------------------------
# Plotting helpers (prettier defaults)
# ----------------------------

def _apply_theme() -> None:
    palette = [
        "#2563EB",  # blue
        "#14B8A6",  # teal
        "#F59E0B",  # amber
        "#EC4899",  # pink
        "#8B5CF6",  # purple
        "#22C55E",  # green
        "#64748B",  # slate
        "#EF4444",  # red
    ]
    sns.set_theme(
        style="whitegrid",
        context="talk",
        font_scale=0.9,
        rc={
            "axes.titlepad": 12,
            "axes.titlesize": 16,
            "axes.labelsize": 12,
            "xtick.labelsize": 10.5,
            "ytick.labelsize": 10.5,
            "legend.fontsize": 10.5,
            "axes.facecolor": "#FCFCFF",
            "grid.color": "#E5E7EB",
            "grid.linewidth": 0.8,
            "axes.edgecolor": "#111827",
            "axes.labelcolor": "#111827",
            "text.color": "#111827",
            "xtick.color": "#111827",
            "ytick.color": "#111827",
            "lines.linewidth": 2.25,
        },
    )
    sns.set_palette(palette)
    plt.rcParams.update(
        {
            "axes.spines.top": False,
            "axes.spines.right": False,
            "legend.frameon": False,
            "figure.facecolor": "white",
            "savefig.facecolor": "white",
        }
    )


def _plot_and_save(fig: plt.Figure, out_dir: Path, spec: ChartSpec) -> ChartSpec:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / spec.filename
    sns.despine(fig=fig)
    fig.tight_layout()
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return spec


def _write_manifest(out_dir: Path, specs: list[ChartSpec], context_lines: list[str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.md"
    lines: list[str] = ["# Week 3 — Yelp exploratory figures", ""]
    if context_lines:
        lines.append("## Context")
        for line in context_lines:
            lines.append(f"- {line}")
        lines.append("")
    lines.append("## Figures")
    for spec in specs:
        extra = f" ({spec.notes})" if spec.notes else ""
        lines.append(f"- `{spec.filename}` — {spec.title}{extra}")
    lines.append("")
    manifest_path.write_text("\n".join(lines), encoding="utf-8")


def _barh_with_value_labels(ax: plt.Axes, labels: list[str], values: list[float], *, colors: list[tuple[float, float, float]] | None = None) -> None:
    y = np.arange(len(labels))
    bars = ax.barh(y, values, color=colors)
    ax.set_yticks(y, labels=labels)
    ax.invert_yaxis()
    # Value labels at end of bars
    max_val = max(values) if values else 0
    pad = max_val * 0.01
    for rect, val in zip(bars, values):
        ax.text(
            rect.get_width() + pad,
            rect.get_y() + rect.get_height() / 2,
            f"{val:,.0f}",
            va="center",
            ha="left",
            fontsize=10,
        )


def _format_large_number_axis(ax: plt.Axes, axis: str = "x") -> None:
    fmt = mticker.StrMethodFormatter("{x:,.0f}")
    if axis == "x":
        ax.xaxis.set_major_formatter(fmt)
    else:
        ax.yaxis.set_major_formatter(fmt)


def _box_stats(data: np.ndarray, *, label: str, whis_q: tuple[float, float] = (0.05, 0.95)) -> dict[str, Any]:
    """
    Compute Matplotlib bxp() stats using percentile whiskers.
    This avoids materializing a huge long-form DataFrame for seaborn boxplots.
    """
    if data.size == 0:
        return {"label": label, "med": 0.0, "q1": 0.0, "q3": 0.0, "whislo": 0.0, "whishi": 0.0, "fliers": []}
    qs = np.quantile(data, [whis_q[0], 0.25, 0.5, 0.75, whis_q[1]])
    return {
        "label": label,
        "whislo": float(qs[0]),
        "q1": float(qs[1]),
        "med": float(qs[2]),
        "q3": float(qs[3]),
        "whishi": float(qs[4]),
        "fliers": [],
    }


def _np_view(arr: array, dtype: np.dtype) -> np.ndarray:
    """Return a NumPy view of a Python array when possible; otherwise, a safe copy."""
    if len(arr) == 0:
        return np.array([], dtype=dtype)
    view = np.frombuffer(arr, dtype=dtype)
    if view.size != len(arr):
        return np.asarray(arr, dtype=dtype)
    return view


# ----------------------------
# Main
# ----------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate 18+ exploratory charts from Yelp Open Dataset (Yelp-JSON.zip).",
    )
    parser.add_argument("--zip", type=Path, default=Path("data/Yelp-JSON.zip"))
    parser.add_argument("--out", type=Path, default=Path("outputs/week3_figures"))

    parser.add_argument("--state", action="append", default=[], help="Filter businesses to state/province code (repeatable). Example: --state ON")
    parser.add_argument("--city", action="append", default=[], help="Filter businesses to a city name (repeatable, case-insensitive). Example: --city Toronto")
    parser.add_argument("--category", action="append", default=[], help="Filter businesses whose categories contain this substring (repeatable). Example: --category Restaurants")

    parser.add_argument("--top-n", type=int, default=20, help="Top N to show in ranking charts.")
    parser.add_argument("--no-checkins", action="store_true", help="Skip check-in charts (faster).")

    parser.add_argument("--max-reviews", type=int, default=-1, help="Max reviews to process (0 = skip, -1 = all).")
    parser.add_argument("--max-users", type=int, default=-1, help="Max users to process (0 = skip, -1 = all).")
    parser.add_argument("--max-tips", type=int, default=-1, help="Max tips to process (0 = skip, -1 = all).")
    parser.add_argument("--max-photos", type=int, default=0, help="Max photo rows to process (0 = skip).")

    args = parser.parse_args()
    _apply_theme()

    states = {s.strip().upper() for s in args.state if s.strip()}
    cities = {c.strip().lower() for c in args.city if c.strip()}
    category_substrings = [c.strip().lower() for c in args.category if c.strip()]

    if not args.zip.exists():
        raise FileNotFoundError(f"Missing zip file: {args.zip}")

    # ---- Accumulators (business) ----
    business_rows: list[dict] = []
    category_counts: Counter[str] = Counter()
    category_star_sum: defaultdict[str, float] = defaultdict(float)
    category_review_sum: defaultdict[str, float] = defaultdict(float)
    category_business_ct: Counter[str] = Counter()

    city_state_counts: Counter[tuple[str, str]] = Counter()
    city_counts: Counter[str] = Counter()
    state_counts: Counter[str] = Counter()

    # `hours` coverage (0–7 days)
    days_open_counts: Counter[int] = Counter()

    # ---- Accumulators (checkins) ----
    checkin_matrix: np.ndarray | None = None
    checkin_day_counts: np.ndarray | None = None
    checkin_hour_counts: np.ndarray | None = None
    checkins_total = 0

    # ---- Accumulators (reviews) ----
    review_month_counts: Counter[str] = Counter()
    review_star_counts: Counter[int] = Counter()
    review_lengths: array = array("I")
    review_lengths_by_star: dict[int, array] = {s: array("I") for s in range(1, 6)}
    vote_useful: array = array("I")
    vote_funny: array = array("I")
    vote_cool: array = array("I")
    reviews_counted = 0

    # ---- Accumulators (users) ----
    user_join_year_counts: Counter[int] = Counter()
    user_review_counts: array = array("I")
    user_fans_counts: array = array("I")
    user_avg_stars: array = array("f")
    users_counted = 0

    # ---- Accumulators (tips) ----
    tip_month_counts: Counter[str] = Counter()
    tip_compliments: array = array("I")
    tips_counted = 0

    # ---- Accumulators (photos) ----
    photo_label_counts: Counter[str] = Counter()
    photos_counted = 0

    specs: list[ChartSpec] = []

    print(f"Reading archive: {args.zip}")

    tf = _iter_tar_members_from_zip(args.zip)
    try:
        business_id_set: set[str] | None = None
        df_business: pd.DataFrame | None = None

        for member in tf:
            if not member.isfile():
                continue
            name = Path(member.name).name

            # ------------- BUSINESS -------------
            if name == "yelp_academic_dataset_business.json":
                print("Parsing businesses…", flush=True)
                fileobj = tf.extractfile(member)
                if fileobj is None:
                    raise RuntimeError("Failed to read business file from archive.")

                for b in _iter_jsonl_dicts(fileobj):
                    if not _business_passes_filters(
                        b,
                        states=states,
                        cities=cities,
                        category_substrings=category_substrings,
                    ):
                        continue

                    business_id = _normalize_str(b.get("business_id"))
                    stars = _safe_float(b.get("stars"))
                    review_count = int(b.get("review_count", 0) or 0)

                    categories_list = _split_categories(b.get("categories"))
                    for cat in categories_list:
                        category_counts[cat] += 1
                        if not math.isnan(stars):
                            category_star_sum[cat] += stars
                        category_review_sum[cat] += float(review_count)
                        category_business_ct[cat] += 1

                    state_code = _normalize_str(b.get("state")).upper()
                    city = _normalize_str(b.get("city"))
                    if state_code:
                        state_counts[state_code] += 1
                    if city:
                        city_counts[city] += 1
                        city_state_counts[(city, state_code)] += 1

                    hours = b.get("hours")
                    if isinstance(hours, dict):
                        days_open_counts[len(hours)] += 1
                        days_open = len(hours)
                    else:
                        days_open_counts[0] += 1
                        days_open = 0

                    attrs = b.get("attributes") or {}
                    if not isinstance(attrs, dict):
                        attrs = {}

                    price_range = _parse_int(attrs.get("RestaurantsPriceRange2"))

                    business_rows.append(
                        {
                            "business_id": business_id,
                            "stars": stars,
                            "review_count": review_count,
                            "city": city,
                            "state": state_code,
                            "latitude": _safe_float(b.get("latitude")),
                            "longitude": _safe_float(b.get("longitude")),
                            "is_open": int(b.get("is_open", 0) or 0),
                            "n_categories": len(categories_list),
                            "days_open": days_open,
                            "price_range": price_range,
                        }
                    )

                fileobj.close()

                if not business_rows:
                    raise RuntimeError("No businesses matched your filters; try removing filters.")

                df_business = pd.DataFrame.from_records(business_rows)
                business_id_set = set(df_business["business_id"].tolist())
                print(f"Selected businesses: {len(df_business):,}")

                # -------------------- FIGURES (BUSINESS) --------------------

                # 01 Stars distribution
                fig, ax = plt.subplots(figsize=(8, 4.5))
                sns.histplot(df_business["stars"].dropna(), bins=np.arange(0.75, 5.26, 0.25), ax=ax, edgecolor="white", linewidth=0.25)
                mean_val = df_business["stars"].mean()
                med_val = df_business["stars"].median()
                ax.axvline(mean_val, linestyle="--", linewidth=2, label=f"Mean {mean_val:.2f}")
                ax.axvline(med_val, linestyle=":", linewidth=2, label=f"Median {med_val:.2f}")
                ax.set_title("What is the distribution of business star ratings?")
                ax.set_xlabel("Stars")
                ax.set_ylabel("Number of businesses")
                _format_large_number_axis(ax, "y")
                ax.legend(loc="upper left")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("01_business_star_distribution.png", ax.get_title())))

                # 02 Review count distribution (log x)
                fig, ax = plt.subplots(figsize=(8, 4.5))
                rc = df_business["review_count"].clip(lower=0)
                # Use log-spaced bins for a nicer shape
                bins = np.unique(np.logspace(0, math.log10(max(1, rc.max())), 40).astype(int))
                bins = np.r_[0, bins]  # include 0
                ax.hist(rc, bins=bins)
                ax.set_xscale("symlog", linthresh=10)
                ax.set_title("What is the distribution of business review counts? (symlog scale)")
                ax.set_xlabel("Review count (symlog scale)")
                ax.set_ylabel("Number of businesses")
                _format_large_number_axis(ax, "y")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("02_business_reviewcount_distribution.png", ax.get_title())))

                # 03 Open vs closed
                fig, ax = plt.subplots(figsize=(7, 4.5))
                open_counts = df_business["is_open"].value_counts().sort_index()
                labels = ["Closed (0)", "Open (1)"]
                values = [int(open_counts.get(0, 0)), int(open_counts.get(1, 0))]
                bars = ax.bar(labels, values, color=["#EF4444", "#22C55E"])
                total = sum(values) or 1
                for bar, val in zip(bars, values):
                    ax.text(bar.get_x() + bar.get_width() / 2, val, f"{val:,.0f}\n({val/total:.1%})", ha="center", va="bottom", fontsize=10)
                ax.set_title("What share of businesses are marked open vs closed?")
                ax.set_xlabel("")
                ax.set_ylabel("Number of businesses")
                _format_large_number_axis(ax, "y")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("03_open_vs_closed.png", ax.get_title())))

                # 04 Review count vs stars (hexbin, log x)
                fig, ax = plt.subplots(figsize=(8, 4.8))
                x = df_business["review_count"].clip(lower=1)
                y = df_business["stars"]
                hb = ax.hexbin(x, y, gridsize=45, xscale="log", mincnt=1, bins="log", cmap="mako")
                fig.colorbar(hb, ax=ax, label="Businesses (log scale)")
                ax.set_title("How do star ratings vary with review count? (hexbin; log x)")
                ax.set_xlabel("Review count (log scale)")
                ax.set_ylabel("Stars")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("04_reviewcount_vs_stars_hexbin.png", ax.get_title())))

                # 05 Categories per business distribution
                fig, ax = plt.subplots(figsize=(8, 4.5))
                sns.histplot(df_business["n_categories"], bins=range(0, int(df_business["n_categories"].max()) + 2), ax=ax, edgecolor="white", linewidth=0.25)
                ax.set_title("How many categories are listed per business?")
                ax.set_xlabel("Number of categories listed")
                ax.set_ylabel("Number of businesses")
                _format_large_number_axis(ax, "y")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("05_categories_per_business.png", ax.get_title())))

                # 06 Top categories by business count
                top_categories = category_counts.most_common(args.top_n)
                if top_categories:
                    cats, counts = zip(*top_categories)
                    fig_height = max(6.0, 0.35 * len(cats) + 1.6)
                    fig, ax = plt.subplots(figsize=(10, fig_height))
                    colors = sns.color_palette("mako", n_colors=len(cats))
                    _barh_with_value_labels(ax, list(cats), list(counts), colors=colors)
                    ax.set_title(f"Which categories appear most often? (Top {len(cats)} by business count)")
                    ax.set_xlabel("Number of businesses")
                    _format_large_number_axis(ax, "x")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("06_top_categories_by_count.png", ax.get_title())))

                # 07 Top categories by average stars
                if category_business_ct:
                    rows = []
                    for cat, ct in category_business_ct.items():
                        if ct < 50:  # helps reduce noise; tweak if you filter to small subsets
                            continue
                        avg = category_star_sum[cat] / ct if ct else float("nan")
                        rows.append((cat, ct, avg))
                    rows.sort(key=lambda t: t[2], reverse=True)
                    top = rows[: args.top_n]
                    if top:
                        labels = [t[0] for t in top]
                        avgs = [t[2] for t in top]
                        fig_height = max(6.0, 0.35 * len(labels) + 1.6)
                        fig, ax = plt.subplots(figsize=(10, fig_height))
                        y = np.arange(len(labels))
                        bars = ax.barh(y, avgs)
                        ax.set_yticks(y, labels=labels)
                        ax.invert_yaxis()
                        ax.set_xlim(0, 5)
                        for rect, val in zip(bars, avgs):
                            ax.text(rect.get_width() + 0.03, rect.get_y() + rect.get_height()/2, f"{val:.2f}", va="center", fontsize=10)
                        ax.set_title(f"Which categories have the highest average star rating? (≥50 businesses; top {len(labels)})")
                        ax.set_xlabel("Average stars")
                        ax.set_ylabel("")
                        specs.append(_plot_and_save(fig, args.out, ChartSpec("07_top_categories_by_avg_stars.png", ax.get_title(), notes="filtered to categories with ≥50 businesses")))

                        # Save table for Datawrapper/Tableau if desired
                        df_cat_avg = pd.DataFrame(top, columns=["category", "businesses", "avg_stars"])
                        df_cat_avg.to_csv(args.out / "table_top_categories_by_avg_stars.csv", index=False)

                # 08 Top cities by business count
                top_cities = city_state_counts.most_common(args.top_n)
                if top_cities:
                    city_labels = [f"{city}, {state}" if state else city for (city, state), _ in top_cities]
                    counts = [count for _, count in top_cities]
                    fig_height = max(6.0, 0.35 * len(city_labels) + 1.6)
                    fig, ax = plt.subplots(figsize=(10, fig_height))
                    colors = sns.color_palette("viridis", n_colors=len(city_labels))
                    _barh_with_value_labels(ax, city_labels, counts, colors=colors)
                    ax.set_title(f"Which cities have the most businesses? (Top {len(city_labels)} city+state pairs)")
                    ax.set_xlabel("Number of businesses")
                    _format_large_number_axis(ax, "x")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("08_top_cities.png", ax.get_title())))

                # 09 Top states/provinces
                if state_counts:
                    top_states = state_counts.most_common(args.top_n)
                    labels = [s for s, _ in top_states]
                    counts = [c for _, c in top_states]
                    fig_height = max(6.0, 0.35 * len(labels) + 1.6)
                    fig, ax = plt.subplots(figsize=(9, fig_height))
                    colors = sns.color_palette("crest", n_colors=len(labels))
                    _barh_with_value_labels(ax, labels, counts, colors=colors)
                    ax.set_title(f"Which states/provinces have the most businesses? (Top {len(labels)} by business count)")
                    ax.set_xlabel("Number of businesses")
                    _format_large_number_axis(ax, "x")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("09_top_states.png", ax.get_title())))

                # 10 Country distribution
                if state_counts:
                    country_counts = Counter()
                    for st, ct in state_counts.items():
                        country_counts[_country_for_state_code(st)] += ct
                    df_countries = pd.DataFrame(country_counts.most_common(), columns=["country", "businesses"])
                    fig, ax = plt.subplots(figsize=(7, 4.5))
                    ax.bar(df_countries["country"], df_countries["businesses"])
                    ax.set_title("How are businesses split across Canada, the U.S., and other? (from state code)")
                    ax.set_xlabel("Country")
                    ax.set_ylabel("Number of businesses")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("10_country_distribution.png", ax.get_title())))

                # 11 Location density (hexbin lat/long)
                df_geo = df_business.dropna(subset=["latitude", "longitude"])
                if len(df_geo) > 0:
                    fig, ax = plt.subplots(figsize=(8, 6))
                    hb = ax.hexbin(
                        df_geo["longitude"],
                        df_geo["latitude"],
                        gridsize=70,
                        bins="log",
                        mincnt=1,
                        cmap="mako",
                    )
                    fig.colorbar(hb, ax=ax, label="Businesses (log scale)")
                    ax.set_title("Where are businesses located geographically? (latitude/longitude density)")
                    ax.set_xlabel("Longitude")
                    ax.set_ylabel("Latitude")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("11_location_density_hexbin.png", ax.get_title(), notes="hexbin over lat/long")))

                # 12 Missingness (selected business fields)
                fig, ax = plt.subplots(figsize=(8, 4.8))
                key_fields = ["stars", "review_count", "city", "state", "latitude", "longitude", "n_categories"]
                missing_rates = {}
                for col in key_fields:
                    if col not in df_business.columns:
                        continue
                    if df_business[col].dtype == object:
                        missing = df_business[col].astype(str).str.strip().eq("").mean()
                    else:
                        missing = df_business[col].isna().mean()
                    missing_rates[col] = missing
                df_miss = pd.DataFrame({"field": list(missing_rates.keys()), "missing_rate": list(missing_rates.values())})
                df_miss = df_miss.sort_values("missing_rate", ascending=False)
                ax.bar(df_miss["field"], df_miss["missing_rate"])
                ax.set_title("Which key business fields are most often missing?")
                ax.set_xlabel("")
                ax.set_ylabel("Missing rate")
                ax.yaxis.set_major_formatter(mticker.PercentFormatter(1.0))
                ax.tick_params(axis="x", rotation=30)
                plt.setp(ax.get_xticklabels(), ha="right")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("12_business_missingness.png", ax.get_title())))

                # 13 Days open per week (from `hours`)
                if df_business["days_open"].notna().any():
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    order = list(range(0, 8))
                    counts = [int(days_open_counts.get(i, 0)) for i in order]
                    bars = ax.bar([str(i) for i in order], counts)
                    total = sum(counts) or 1
                    for bar, val in zip(bars, counts):
                        if val == 0:
                            continue
                        ax.text(bar.get_x() + bar.get_width()/2, val, f"{val/total:.1%}", ha="center", va="bottom", fontsize=10)
                    ax.set_title("How many days per week do businesses report hours? (0–7 days listed)")
                    ax.set_xlabel("Days with hours listed (0–7)")
                    ax.set_ylabel("Number of businesses")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("13_days_open_per_week.png", ax.get_title(), notes="0 = missing `hours`")))

                # 14 Price range availability + distribution
                df_price = df_business.dropna(subset=["price_range"]).copy()
                df_price = df_price[df_price["price_range"].between(1, 4)]
                if not df_price.empty:
                    fig, ax = plt.subplots(figsize=(7, 4.5))
                    pr_counts = df_price["price_range"].value_counts().sort_index()
                    bars = ax.bar([str(i) for i in pr_counts.index], pr_counts.values)
                    total = pr_counts.sum() or 1
                    for bar, val in zip(bars, pr_counts.values):
                        ax.text(bar.get_x() + bar.get_width()/2, val, f"{val/total:.1%}", ha="center", va="bottom", fontsize=10)
                    ax.set_title("What price ranges do restaurants report? (RestaurantsPriceRange2, 1–4)")
                    ax.set_xlabel("Price range (1=cheap, 4=expensive)")
                    ax.set_ylabel("Number of businesses")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("14_price_range_distribution.png", ax.get_title(), notes=f"{len(df_price):,} businesses with price range")))

                    # 15 Stars by price range (violin)
                    fig, ax = plt.subplots(figsize=(7.5, 4.8))
                    sns.violinplot(data=df_price, x="price_range", y="stars", ax=ax, inner="quartile", cut=0)
                    ax.set_title("How do star ratings vary by restaurant price range?")
                    ax.set_xlabel("Price range (1=cheap, 4=expensive)")
                    ax.set_ylabel("Stars")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("15_stars_by_price_range_violin.png", ax.get_title())))

                # 16 Stars by open/closed (box)
                fig, ax = plt.subplots(figsize=(7.5, 4.8))
                df_tmp = df_business.copy()
                df_tmp["open_status"] = df_tmp["is_open"].map({0: "Closed", 1: "Open"})
                sns.boxplot(data=df_tmp, x="open_status", y="stars", ax=ax)
                ax.set_title("Do open vs closed businesses differ in star ratings?")
                ax.set_xlabel("")
                ax.set_ylabel("Stars")
                specs.append(_plot_and_save(fig, args.out, ChartSpec("16_stars_by_open_status.png", ax.get_title())))

                # Save a couple of handy tables for non-Python tools
                df_business[["business_id","stars","review_count","city","state","latitude","longitude","is_open","n_categories","days_open","price_range"]].to_csv(
                    args.out / "table_business_sample_fields.csv", index=False
                )

            # ------------- CHECKINS -------------
            elif name == "yelp_academic_dataset_checkin.json" and not args.no_checkins:
                if business_id_set is None:
                    raise RuntimeError("Expected to parse business file before checkins (needed for filtering).")

                print("Parsing check-ins…", flush=True)
                checkin_matrix = np.zeros((7, 24), dtype=np.int64)
                fileobj = tf.extractfile(member)
                if fileobj is None:
                    raise RuntimeError("Failed to read checkin file from archive.")
                for c in _iter_jsonl_dicts(fileobj):
                    business_id = _normalize_str(c.get("business_id"))
                    if business_id not in business_id_set:
                        continue
                    date_field = _normalize_str(c.get("date"))
                    if not date_field:
                        continue
                    # Each entry is "YYYY-MM-DD HH:MM:SS" separated by comma+space
                    for ts in date_field.split(", "):
                        try:
                            dt = datetime.fromisoformat(ts)
                        except ValueError:
                            continue
                        checkin_matrix[dt.weekday(), dt.hour] += 1
                        checkins_total += 1
                fileobj.close()

                if checkin_matrix.sum() > 0:
                    checkin_day_counts = checkin_matrix.sum(axis=1)
                    checkin_hour_counts = checkin_matrix.sum(axis=0)

                    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

                    # 17 Heatmap
                    fig, ax = plt.subplots(figsize=(12, 4.5))
                    sns.heatmap(
                        checkin_matrix,
                        ax=ax,
                        cmap="mako",
                        cbar_kws={"label": "Check-ins"},
                        xticklabels=list(range(24)),
                        yticklabels=days,
                    )
                    ax.set_title("When do check-ins happen? (day-of-week × hour heatmap)")
                    ax.set_xlabel("Hour of day")
                    ax.set_ylabel("Day of week")
                    ax.tick_params(axis="x", rotation=0)
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("17_checkins_heatmap.png", ax.get_title(), notes=f"{checkins_total:,} check-ins (filtered)")))

                    # 18 Check-ins by day of week
                    fig, ax = plt.subplots(figsize=(8.5, 4.5))
                    bars = ax.bar(days, checkin_day_counts)
                    total = int(checkin_day_counts.sum()) or 1
                    for bar, val in zip(bars, checkin_day_counts):
                        ax.text(bar.get_x() + bar.get_width()/2, val, f"{val/total:.1%}", ha="center", va="bottom", fontsize=10)
                    ax.set_title("Which days of the week have the most check-ins?")
                    ax.set_xlabel("")
                    ax.set_ylabel("Check-ins")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("18_checkins_by_day.png", ax.get_title())))

                    # 19 Check-ins by hour
                    fig, ax = plt.subplots(figsize=(10, 4.5))
                    ax.plot(range(24), checkin_hour_counts, marker="o")
                    ax.set_title("At what hours of the day do check-ins peak?")
                    ax.set_xlabel("Hour of day")
                    ax.set_ylabel("Check-ins")
                    ax.set_xticks(range(0, 24, 2))
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("19_checkins_by_hour.png", ax.get_title())))

            # ------------- REVIEWS -------------
            elif name == "yelp_academic_dataset_review.json" and args.max_reviews != 0:
                if business_id_set is None:
                    raise RuntimeError("Expected to parse business file before reviews (needed for filtering).")

                if args.max_reviews > 0:
                    print(f"Parsing reviews (up to {args.max_reviews:,})…", flush=True)
                else:
                    print("Parsing reviews (all)…", flush=True)
                fileobj = tf.extractfile(member)
                if fileobj is None:
                    raise RuntimeError("Failed to read review file from archive.")

                for r in _iter_jsonl_dicts(fileobj):
                    business_id = _normalize_str(r.get("business_id"))
                    if business_id not in business_id_set:
                        continue

                    date_field = _normalize_str(r.get("date"))
                    if not date_field:
                        continue
                    try:
                        dt = datetime.fromisoformat(date_field)
                    except ValueError:
                        continue
                    month_key = dt.strftime("%Y-%m")
                    review_month_counts[month_key] += 1

                    stars = int(r.get("stars", 0) or 0)
                    if 1 <= stars <= 5:
                        review_star_counts[stars] += 1

                    text = _normalize_str(r.get("text"))
                    ln = len(text)
                    review_lengths.append(ln)
                    if 1 <= stars <= 5:
                        review_lengths_by_star[stars].append(ln)

                    vote_useful.append(max(0, int(r.get("useful", 0) or 0)))
                    vote_funny.append(max(0, int(r.get("funny", 0) or 0)))
                    vote_cool.append(max(0, int(r.get("cool", 0) or 0)))

                    reviews_counted += 1
                    if args.max_reviews > 0 and reviews_counted >= args.max_reviews:
                        break

                fileobj.close()

                if reviews_counted > 0:
                    # 20 Review volume over time (month)
                    series = (
                        pd.Series(review_month_counts)
                        .rename_axis("month")
                        .reset_index(name="reviews")
                        .sort_values("month")
                    )
                    series["month_dt"] = pd.to_datetime(series["month"], format="%Y-%m")

                    fig, ax = plt.subplots(figsize=(12, 4.5))
                    ax.plot(series["month_dt"], series["reviews"], linewidth=2)
                    ax.set_title("How has review volume changed over time? (reviews per month)")
                    ax.set_xlabel("Month")
                    ax.set_ylabel("Number of reviews")
                    locator = mdates.AutoDateLocator(minticks=5, maxticks=10)
                    ax.xaxis.set_major_locator(locator)
                    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))
                    _format_large_number_axis(ax, "y")
                    cap_note = "all" if args.max_reviews < 0 else f"cap={args.max_reviews:,}"
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("20_reviews_over_time.png", ax.get_title(), notes=f"{reviews_counted:,} reviews (filtered; {cap_note})")))

                    # 21 Review stars distribution
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    keys = [1,2,3,4,5]
                    vals = [review_star_counts.get(k, 0) for k in keys]
                    colors = sns.color_palette("RdYlGn", n_colors=5)
                    bars = ax.bar([str(k) for k in keys], vals, color=colors)
                    total = sum(vals) or 1
                    for bar, val in zip(bars, vals):
                        ax.text(bar.get_x() + bar.get_width()/2, val, f"{val/total:.1%}", ha="center", va="bottom", fontsize=10)
                    ax.set_title("What is the distribution of review star ratings?")
                    ax.set_xlabel("Review stars")
                    ax.set_ylabel("Number of reviews")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("21_review_star_distribution.png", ax.get_title())))

                    # 22 Review length distribution
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    lengths = _np_view(review_lengths, np.uint32)
                    clip_val = int(np.quantile(lengths, 0.99)) if lengths.size > 50 else int(lengths.max())
                    clipped = np.minimum(lengths, clip_val)
                    sns.histplot(clipped, bins=50, ax=ax, edgecolor="white", linewidth=0.25)
                    ax.set_title("How long are reviews? (characters; 99th percentile clipped)")
                    ax.set_xlabel("Review length (characters)")
                    ax.set_ylabel("Number of reviews")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("22_review_length_distribution.png", ax.get_title(), notes=f"clipped at p99={clip_val:,} chars")))

                    # 23 Review length vs stars (box)
                    stats = []
                    for s in [1, 2, 3, 4, 5]:
                        arr = _np_view(review_lengths_by_star[s], np.uint32)
                        if arr.size == 0:
                            continue
                        stats.append(_box_stats(np.minimum(arr, clip_val), label=str(s)))
                    if stats:
                        fig, ax = plt.subplots(figsize=(9, 4.8))
                        bxp = ax.bxp(stats, showfliers=False, patch_artist=True)
                        colors = sns.color_palette("rocket_r", n_colors=len(stats))
                        for patch, color in zip(bxp["boxes"], colors):
                            patch.set_facecolor(color)
                            patch.set_alpha(0.9)
                            patch.set_edgecolor("#111827")
                        for median in bxp["medians"]:
                            median.set_color("#111827")
                            median.set_linewidth(2)
                        ax.set_title("How does review length vary by star rating?")
                        ax.set_xlabel("Review stars")
                        ax.set_ylabel("Review length (characters, p99 clipped)")
                        _format_large_number_axis(ax, "y")
                        specs.append(_plot_and_save(fig, args.out, ChartSpec("23_review_length_by_stars.png", ax.get_title())))

                    # 24 Votes distribution (useful/funny/cool) — log-ish view
                    useful = _np_view(vote_useful, np.uint32)
                    funny = _np_view(vote_funny, np.uint32)
                    cool = _np_view(vote_cool, np.uint32)
                    clip_votes = int(
                        max(
                            np.quantile(useful, 0.995) if useful.size > 50 else useful.max(),
                            np.quantile(funny, 0.995) if funny.size > 50 else funny.max(),
                            np.quantile(cool, 0.995) if cool.size > 50 else cool.max(),
                        )
                    )
                    stats = [
                        _box_stats(np.minimum(useful, clip_votes), label="useful"),
                        _box_stats(np.minimum(funny, clip_votes), label="funny"),
                        _box_stats(np.minimum(cool, clip_votes), label="cool"),
                    ]
                    fig, ax = plt.subplots(figsize=(9, 4.8))
                    bxp = ax.bxp(stats, showfliers=False, patch_artist=True)
                    colors = sns.color_palette("crest", n_colors=3)
                    for patch, color in zip(bxp["boxes"], colors):
                        patch.set_facecolor(color)
                        patch.set_alpha(0.9)
                        patch.set_edgecolor("#111827")
                    for median in bxp["medians"]:
                        median.set_color("#111827")
                        median.set_linewidth(2)
                    ax.set_title("How do 'useful', 'funny', and 'cool' votes compare per review?")
                    ax.set_xlabel("")
                    ax.set_ylabel("Votes per review (p99.5 clipped)")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("24_review_votes_boxplot.png", ax.get_title(), notes=f"clipped at p99.5={clip_votes:,} votes")))

            # ------------- USERS -------------
            elif name == "yelp_academic_dataset_user.json" and args.max_users != 0:
                if args.max_users > 0:
                    print(f"Parsing users (up to {args.max_users:,})…", flush=True)
                else:
                    print("Parsing users (all)…", flush=True)
                fileobj = tf.extractfile(member)
                if fileobj is None:
                    raise RuntimeError("Failed to read user file from archive.")

                for u in _iter_jsonl_dicts(fileobj):
                    ys = _normalize_str(u.get("yelping_since"))
                    if ys:
                        try:
                            join_year = datetime.fromisoformat(ys).year
                            user_join_year_counts[join_year] += 1
                        except ValueError:
                            pass

                    user_review_counts.append(max(0, int(u.get("review_count", 0) or 0)))
                    user_fans_counts.append(max(0, int(u.get("fans", 0) or 0)))
                    user_avg_stars.append(float(_safe_float(u.get("average_stars"))))

                    users_counted += 1
                    if args.max_users > 0 and users_counted >= args.max_users:
                        break

                fileobj.close()

                if users_counted > 0:
                    # 25 Join year distribution
                    if user_join_year_counts:
                        years = sorted(user_join_year_counts.keys())
                        counts = [user_join_year_counts[y] for y in years]
                        fig, ax = plt.subplots(figsize=(12, 4.5))
                        ax.plot(years, counts, marker="o")
                        ax.set_title("When did users join Yelp? (join year from yelping_since)")
                        ax.set_xlabel("Join year")
                        ax.set_ylabel("Users")
                        _format_large_number_axis(ax, "y")
                        cap_note = "all" if args.max_users < 0 else f"cap={args.max_users:,}"
                        specs.append(_plot_and_save(fig, args.out, ChartSpec("25_user_join_years.png", ax.get_title(), notes=f"{users_counted:,} users ({cap_note})")))

                    # 26 User review_count distribution (symlog)
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    rc = _np_view(user_review_counts, np.uint32)
                    bins = np.unique(np.logspace(0, math.log10(max(1, rc.max())), 40).astype(int))
                    bins = np.r_[0, bins]
                    ax.hist(rc, bins=bins)
                    ax.set_xscale("symlog", linthresh=10)
                    ax.set_title("What is the distribution of user review counts? (symlog scale)")
                    ax.set_xlabel("User review_count (symlog scale)")
                    ax.set_ylabel("Users")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("26_user_reviewcount_distribution.png", ax.get_title())))

                    # 27 Fans distribution (symlog)
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    fans = _np_view(user_fans_counts, np.uint32)
                    bins = np.unique(np.logspace(0, math.log10(max(1, fans.max())), 40).astype(int))
                    bins = np.r_[0, bins]
                    ax.hist(fans, bins=bins)
                    ax.set_xscale("symlog", linthresh=5)
                    ax.set_title("What is the distribution of user fan counts? (symlog scale)")
                    ax.set_xlabel("Fans (symlog scale)")
                    ax.set_ylabel("Users")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("27_user_fans_distribution.png", ax.get_title())))

                    # 28 Average stars distribution
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    avg = _np_view(user_avg_stars, np.float32)
                    avg = avg[np.isfinite(avg)]
                    sns.histplot(avg, bins=30, ax=ax, edgecolor="white", linewidth=0.25)
                    ax.set_title("What is the distribution of users' average star ratings?")
                    ax.set_xlabel("User average_stars")
                    ax.set_ylabel("Users")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("28_user_average_stars_distribution.png", ax.get_title())))

            # ------------- TIPS -------------
            elif name == "yelp_academic_dataset_tip.json" and args.max_tips != 0:
                if business_id_set is None:
                    raise RuntimeError("Expected to parse business file before tips (needed for filtering).")
                if args.max_tips > 0:
                    print(f"Parsing tips (up to {args.max_tips:,})…", flush=True)
                else:
                    print("Parsing tips (all)…", flush=True)
                fileobj = tf.extractfile(member)
                if fileobj is None:
                    raise RuntimeError("Failed to read tip file from archive.")

                for t in _iter_jsonl_dicts(fileobj):
                    business_id = _normalize_str(t.get("business_id"))
                    if not business_id or business_id not in business_id_set:
                        continue
                    date_field = _normalize_str(t.get("date"))
                    if date_field:
                        try:
                            dt = datetime.fromisoformat(date_field)
                            tip_month_counts[dt.strftime("%Y-%m")] += 1
                        except ValueError:
                            pass
                    tip_compliments.append(max(0, int(t.get("compliment_count", 0) or 0)))
                    tips_counted += 1
                    if args.max_tips > 0 and tips_counted >= args.max_tips:
                        break

                fileobj.close()

                if tips_counted > 0:
                    # 29 Tip volume over time
                    if tip_month_counts:
                        series = (
                            pd.Series(tip_month_counts)
                            .rename_axis("month")
                            .reset_index(name="tips")
                            .sort_values("month")
                        )
                        series["month_dt"] = pd.to_datetime(series["month"], format="%Y-%m")
                        fig, ax = plt.subplots(figsize=(12, 4.5))
                        ax.plot(series["month_dt"], series["tips"], linewidth=2)
                        ax.set_title("How has tip volume changed over time? (tips per month)")
                        ax.set_xlabel("Month")
                        ax.set_ylabel("Tips")
                        locator = mdates.AutoDateLocator(minticks=5, maxticks=10)
                        ax.xaxis.set_major_locator(locator)
                        ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))
                        _format_large_number_axis(ax, "y")
                        cap_note = "all" if args.max_tips < 0 else f"cap={args.max_tips:,}"
                        specs.append(_plot_and_save(fig, args.out, ChartSpec("29_tips_over_time.png", ax.get_title(), notes=f"{tips_counted:,} tips ({cap_note})")))

                    # 30 Tip compliments distribution
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    cc = _np_view(tip_compliments, np.uint32)
                    bins = np.unique(np.logspace(0, math.log10(max(1, cc.max())), 35).astype(int))
                    bins = np.r_[0, bins]
                    ax.hist(cc, bins=bins)
                    ax.set_xscale("symlog", linthresh=2)
                    ax.set_title("What is the distribution of tip compliment counts? (symlog scale)")
                    ax.set_xlabel("compliment_count (symlog scale)")
                    ax.set_ylabel("Tips")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("30_tip_compliments_distribution.png", ax.get_title())))

            # ------------- PHOTOS (optional; may not be in Yelp-JSON.tar) -------------
            elif name == "yelp_academic_dataset_photo.json" and args.max_photos > 0:
                if business_id_set is None:
                    raise RuntimeError("Expected to parse business file before photos (needed for filtering).")
                print(f"Sampling up to {args.max_photos:,} photos…", flush=True)
                fileobj = tf.extractfile(member)
                if fileobj is None:
                    raise RuntimeError("Failed to read photo file from archive.")
                for p in _iter_jsonl_dicts(fileobj):
                    business_id = _normalize_str(p.get("business_id"))
                    if not business_id or business_id not in business_id_set:
                        continue
                    label = _normalize_str(p.get("label")) or "Unknown"
                    photo_label_counts[label] += 1
                    photos_counted += 1
                    if photos_counted >= args.max_photos:
                        break
                fileobj.close()

                if photos_counted > 0:
                    labels, counts = zip(*photo_label_counts.most_common())
                    fig, ax = plt.subplots(figsize=(8, 4.5))
                    ax.bar(labels, counts)
                    ax.set_title("What photo labels are present in the dataset? (photo.json)")
                    ax.set_xlabel("Photo label")
                    ax.set_ylabel("Photos (sampled)")
                    _format_large_number_axis(ax, "y")
                    specs.append(_plot_and_save(fig, args.out, ChartSpec("31_photo_label_distribution.png", ax.get_title())))

        # End loop over tar members

        if not specs:
            raise RuntimeError("Did not generate any charts — did the dataset files exist in the zip?")

        context_lines = [
            f"Businesses selected: {len(business_rows):,}",
            f"Filters: states={sorted(states) if states else '∅'}, cities={sorted(cities) if cities else '∅'}, category substrings={category_substrings if category_substrings else '∅'}",
            f"Check-ins counted: {checkins_total:,}" if not args.no_checkins else "Check-ins: skipped",
            "Reviews: skipped"
            if args.max_reviews == 0
            else (f"Reviews counted: {reviews_counted:,} (all)" if args.max_reviews < 0 else f"Reviews counted: {reviews_counted:,} (max_reviews={args.max_reviews:,})"),
            "Users: skipped"
            if args.max_users == 0
            else (f"Users counted: {users_counted:,} (all)" if args.max_users < 0 else f"Users counted: {users_counted:,} (max_users={args.max_users:,})"),
            "Tips: skipped"
            if args.max_tips == 0
            else (f"Tips counted: {tips_counted:,} (all)" if args.max_tips < 0 else f"Tips counted: {tips_counted:,} (max_tips={args.max_tips:,})"),
        ]
        if args.max_photos > 0:
            context_lines.append(f"Photos counted: {photos_counted:,} (max_photos={args.max_photos:,})")

        _write_manifest(args.out, specs, context_lines)
        print(f"Wrote {len(specs)} figures to: {args.out}")
        print(f"Manifest: {args.out / 'manifest.md'}")
        return 0

    finally:
        _close_tar_chain(tf)


if __name__ == "__main__":
    raise SystemExit(main())
