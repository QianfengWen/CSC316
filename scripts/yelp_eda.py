#!/usr/bin/env python3

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
import tarfile
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd
import seaborn as sns


@dataclass(frozen=True)
class ChartSpec:
    filename: str
    title: str
    notes: str = ""


def _normalize_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _parse_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    text = _normalize_str(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _iter_jsonl_dicts(fileobj) -> dict:
    for raw_line in fileobj:
        if not raw_line:
            return
        line = raw_line.decode("utf-8", errors="strict").strip()
        if not line:
            continue
        yield json.loads(line)


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
            raise FileNotFoundError(
                f"Could not find yelp_dataset.tar inside {zip_path}"
            )
        tar_member_name = candidates[0]
        tar_gz_stream = zip_file.open(tar_member_name)
    except Exception:
        zip_file.close()
        raise

    # NOTE: Yelp-JSON.zip contains a gzip stream named *.tar (it is effectively a .tar.gz).
    # Use streaming mode so we don't need random access.
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


def _business_passes_filters(
    business: dict,
    *,
    states: set[str],
    cities: set[str],
    category_substrings: list[str],
) -> bool:
    state = _normalize_str(business.get("state")).upper()
    city = _normalize_str(business.get("city")).lower()
    categories = _normalize_str(business.get("categories")).lower()

    if states and state not in states:
        return False
    if cities and city not in cities:
        return False
    if category_substrings and not any(s in categories for s in category_substrings):
        return False
    return True


_CANADA_PROVINCES_TERRITORIES = {
    "AB",
    "BC",
    "MB",
    "NB",
    "NL",
    "NS",
    "NT",
    "NU",
    "ON",
    "PE",
    "QC",
    "SK",
    "YT",
}

_US_STATES_AND_DC = {
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "DC",
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


def _plot_and_save(fig: plt.Figure, out_dir: Path, spec: ChartSpec) -> ChartSpec:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / spec.filename
    sns.despine(fig=fig)
    fig.tight_layout()
    fig.savefig(out_path, dpi=250, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return spec


def _write_manifest(out_dir: Path, specs: list[ChartSpec], context_lines: list[str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.md"
    lines: list[str] = ["# Yelp EDA charts", ""]
    if context_lines:
        lines.append("## Context")
        lines.extend([f"- {line}" for line in context_lines])
        lines.append("")
    lines.append("## Charts")
    for spec in specs:
        extra = f" ({spec.notes})" if spec.notes else ""
        lines.append(f"- `{spec.filename}` — {spec.title}{extra}")
    lines.append("")

    csv_files = sorted(out_dir.glob("*.csv"))
    if csv_files:
        lines.append("## Tables")
        for csv_path in csv_files:
            lines.append(f"- `{csv_path.name}`")
        lines.append("")

    manifest_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate quick exploratory charts for the Yelp Open Dataset.",
    )
    parser.add_argument("--zip", type=Path, default=Path("data/Yelp-JSON.zip"))
    parser.add_argument("--out", type=Path, default=Path("eda_output"))

    parser.add_argument(
        "--state",
        action="append",
        default=[],
        help="Filter businesses to a state/province code (repeatable). Example: --state ON",
    )
    parser.add_argument(
        "--city",
        action="append",
        default=[],
        help="Filter businesses to a city name (repeatable, case-insensitive). Example: --city Toronto",
    )
    parser.add_argument(
        "--category",
        action="append",
        default=[],
        help="Filter businesses whose categories contain this substring (repeatable). Example: --category Restaurants",
    )

    parser.add_argument(
        "--no-checkins",
        action="store_true",
        help="Skip check-in heatmap (faster).",
    )
    parser.add_argument(
        "--max-reviews",
        type=int,
        default=0,
        help="If >0, also sample this many reviews to chart review volume over time.",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=20,
        help="Top N categories/cities to show.",
    )

    args = parser.parse_args()
    sns.set_theme(
        style="whitegrid",
        context="notebook",
        rc={
            "axes.titlepad": 12,
            "axes.titlesize": 16,
            "axes.labelsize": 13,
            "xtick.labelsize": 11,
            "ytick.labelsize": 11,
        },
    )

    states = {s.strip().upper() for s in args.state if s.strip()}
    cities = {c.strip().lower() for c in args.city if c.strip()}
    category_substrings = [c.strip().lower() for c in args.category if c.strip()]

    print(f"Reading Yelp archive: {args.zip}")
    if not args.zip.exists():
        raise FileNotFoundError(f"Missing zip file: {args.zip}")

    business_rows: list[dict] = []
    category_counts: Counter[str] = Counter()
    city_state_counts: Counter[tuple[str, str]] = Counter()
    city_counts: Counter[str] = Counter()
    state_counts: Counter[str] = Counter()

    checkin_matrix: np.ndarray | None = None
    checkins_total = 0

    review_month_counts: Counter[str] = Counter()
    reviews_counted = 0

    tf = _iter_tar_members_from_zip(args.zip)
    try:
        for member in tf:
            if not member.isfile():
                continue
            name = Path(member.name).name

            if name == "yelp_academic_dataset_business.json":
                print("Parsing businesses…")
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

                    attrs = b.get("attributes") or {}
                    if not isinstance(attrs, dict):
                        attrs = {}

                    categories_str = _normalize_str(b.get("categories"))
                    if categories_str:
                        for cat in categories_str.split(","):
                            cat = cat.strip()
                            if cat:
                                category_counts[cat] += 1

                    state_code = _normalize_str(b.get("state")).upper()
                    if state_code:
                        state_counts[state_code] += 1

                    city = _normalize_str(b.get("city"))
                    if city:
                        city_counts[city] += 1
                        city_state_counts[(city, state_code)] += 1

                    business_rows.append(
                        {
                            "business_id": _normalize_str(b.get("business_id")),
                            "stars": float(b.get("stars", np.nan)),
                            "review_count": int(b.get("review_count", 0)),
                            "city": city,
                            "state": state_code,
                            "latitude": float(b.get("latitude", np.nan)),
                            "longitude": float(b.get("longitude", np.nan)),
                            "is_open": int(b.get("is_open", 0)),
                            "price_range": _parse_int(attrs.get("RestaurantsPriceRange2")),
                        }
                    )
                fileobj.close()

                if not business_rows:
                    raise RuntimeError(
                        "No businesses matched your filters; try removing filters."
                    )

                df_business = pd.DataFrame.from_records(business_rows)
                business_id_set = set(df_business["business_id"].tolist())
                print(f"Selected businesses: {len(df_business):,}")

                specs: list[ChartSpec] = []

                # 01: Stars distribution
                fig, ax = plt.subplots(figsize=(7, 4))
                ax.hist(
                    df_business["stars"].dropna(),
                    bins=np.arange(0.75, 5.26, 0.25),
                    color="#4C78A8",
                    edgecolor="white",
                )
                ax.set_title("How are Yelp business star ratings distributed?")
                ax.set_xlabel("Stars")
                ax.set_ylabel("Number of businesses")
                ax.yaxis.set_major_formatter(mticker.StrMethodFormatter("{x:,.0f}"))
                specs.append(
                    _plot_and_save(
                        fig,
                        args.out,
                        ChartSpec(
                            filename="01_business_star_distribution.png",
                            title="How are Yelp business star ratings distributed?",
                        ),
                    )
                )

                # 02: Reviews vs stars (hexbin)
                fig, ax = plt.subplots(figsize=(7, 4))
                x = df_business["review_count"].clip(lower=1)
                y = df_business["stars"]
                hb = ax.hexbin(
                    x,
                    y,
                    gridsize=40,
                    xscale="log",
                    cmap="viridis",
                    mincnt=1,
                    bins="log",
                )
                fig.colorbar(hb, ax=ax, label="Businesses (log scale)")
                ax.set_title("Do businesses with more reviews tend to have higher ratings?")
                ax.set_xlabel("Review count (log scale)")
                ax.set_ylabel("Stars")
                specs.append(
                    _plot_and_save(
                        fig,
                        args.out,
                        ChartSpec(
                            filename="02_reviewcount_vs_stars_hexbin.png",
                            title="Do businesses with more reviews tend to have higher ratings?",
                        ),
                    )
                )

                # 03: Top categories
                top_categories = category_counts.most_common(args.top_n)
                if top_categories:
                    cats, counts = zip(*top_categories)
                    fig_height = max(5.5, 0.35 * len(cats) + 1.5)
                    fig, ax = plt.subplots(figsize=(9, fig_height))
                    ax.barh(range(len(cats)), counts, color="#F58518")
                    ax.set_yticks(range(len(cats)), labels=cats)
                    ax.invert_yaxis()
                    ax.set_title(f"Which categories have the most businesses? (Top {len(cats)})")
                    ax.set_xlabel("Number of businesses")
                    ax.xaxis.set_major_formatter(mticker.StrMethodFormatter("{x:,.0f}"))
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="03_top_categories.png",
                                title=f"Which categories have the most businesses? (Top {len(cats)})",
                            ),
                        )
                    )

                # 04: Top cities
                top_cities = city_state_counts.most_common(args.top_n)
                if top_cities:
                    city_labels = [
                        f"{city}, {state}" if state else city
                        for (city, state), _ in top_cities
                    ]
                    counts = [count for _, count in top_cities]
                    fig_height = max(5.5, 0.35 * len(city_labels) + 1.5)
                    fig, ax = plt.subplots(figsize=(9, fig_height))
                    ax.barh(range(len(city_labels)), counts, color="#54A24B")
                    ax.set_yticks(range(len(city_labels)), labels=city_labels)
                    ax.invert_yaxis()
                    ax.set_title(f"Which cities have the most businesses? (Top {len(city_labels)})")
                    ax.set_xlabel("Number of businesses")
                    ax.xaxis.set_major_formatter(mticker.StrMethodFormatter("{x:,.0f}"))
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="04_top_cities.png",
                                title=f"Which cities have the most businesses? (Top {len(city_labels)})",
                            ),
                        )
                    )

                # City distribution table (all cities, with + without state)
                if city_state_counts:
                    df_city_state = pd.DataFrame(
                        [
                            {
                                "city": city,
                                "state": state,
                                "businesses": count,
                            }
                            for (city, state), count in city_state_counts.most_common()
                        ]
                    )
                    df_city_state["share"] = df_city_state["businesses"] / df_city_state["businesses"].sum()
                    df_city_state.to_csv(args.out / "city_state_distribution.csv", index=False)

                if city_counts:
                    df_city = pd.DataFrame(
                        city_counts.most_common(), columns=["city", "businesses"]
                    )
                    df_city["share"] = df_city["businesses"] / df_city["businesses"].sum()
                    df_city.to_csv(args.out / "city_distribution.csv", index=False)

                # 05: Stars by price range (if available)
                df_price = df_business.dropna(subset=["price_range"]).copy()
                df_price = df_price[df_price["price_range"].between(1, 4)]
                if not df_price.empty:
                    fig, ax = plt.subplots(figsize=(7, 4))
                    sns.boxplot(
                        data=df_price,
                        x="price_range",
                        y="stars",
                        ax=ax,
                        color="#E45756",
                    )
                    ax.set_title("How do ratings vary by restaurant price range?")
                    ax.set_xlabel("Price range (1=cheap, 4=expensive)")
                    ax.set_ylabel("Stars")
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="05_stars_by_price_range.png",
                                title="How do ratings vary by restaurant price range?",
                            ),
                        )
                    )

                # 08: Top states/provinces + country split (tables + chart)
                if state_counts:
                    df_states = pd.DataFrame(
                        state_counts.most_common(), columns=["state", "businesses"]
                    )
                    df_states["share"] = df_states["businesses"] / df_states["businesses"].sum()
                    df_states.to_csv(args.out / "state_distribution.csv", index=False)

                    top_states = state_counts.most_common(args.top_n)
                    states_labels, counts = zip(*top_states)
                    fig_height = max(5.5, 0.35 * len(states_labels) + 1.5)
                    fig, ax = plt.subplots(figsize=(8, fig_height))
                    ax.barh(range(len(states_labels)), counts, color="#72B7B2")
                    ax.set_yticks(range(len(states_labels)), labels=states_labels)
                    ax.invert_yaxis()
                    ax.set_title(
                        f"Which states/provinces have the most businesses? (Top {len(states_labels)})"
                    )
                    ax.set_xlabel("Number of businesses")
                    ax.xaxis.set_major_formatter(mticker.StrMethodFormatter("{x:,.0f}"))
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="08_top_states.png",
                                title=f"Which states/provinces have the most businesses? (Top {len(states_labels)})",
                            ),
                        )
                    )

                    country_counts = Counter()
                    for state_code, count in state_counts.items():
                        country_counts[_country_for_state_code(state_code)] += count
                    df_countries = pd.DataFrame(
                        country_counts.most_common(),
                        columns=["country", "businesses"],
                    )
                    df_countries["share"] = df_countries["businesses"] / df_countries["businesses"].sum()
                    df_countries.to_csv(args.out / "country_distribution.csv", index=False)

                    fig, ax = plt.subplots(figsize=(6, 4))
                    ax.bar(
                        df_countries["country"],
                        df_countries["businesses"],
                        color=["#4C78A8", "#F58518", "#9D9DA0"][: len(df_countries)],
                    )
                    ax.set_title("How are businesses distributed by country?")
                    ax.set_xlabel("Country")
                    ax.set_ylabel("Number of businesses")
                    ax.yaxis.set_major_formatter(mticker.StrMethodFormatter("{x:,.0f}"))
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="09_country_distribution.png",
                                title="How are businesses distributed by country?",
                            ),
                        )
                    )

                context_lines = [
                    f"Businesses selected: {len(df_business):,}",
                    f"Filters: states={sorted(states) if states else '∅'}, cities={sorted(cities) if cities else '∅'}, category substrings={category_substrings if category_substrings else '∅'}",
                ]

                # If we only want business charts, we can stop early (avoids decompressing big files).
                if args.no_checkins and args.max_reviews <= 0:
                    _write_manifest(args.out, specs, context_lines)
                    print(f"Wrote charts to: {args.out}")
                    return 0

            elif name == "yelp_academic_dataset_checkin.json" and not args.no_checkins:
                print("Parsing check-ins…")
                if "business_id_set" not in locals():
                    raise RuntimeError("Expected business file before checkins.")
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
                    for ts in date_field.split(", "):
                        try:
                            dt = datetime.fromisoformat(ts)
                        except ValueError:
                            continue
                        checkin_matrix[dt.weekday(), dt.hour] += 1
                        checkins_total += 1
                fileobj.close()

                if checkin_matrix.sum() > 0:
                    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                    fig, ax = plt.subplots(figsize=(10, 4))
                    sns.heatmap(
                        checkin_matrix,
                        ax=ax,
                        cmap="mako",
                        cbar_kws={"label": "Check-ins"},
                        xticklabels=list(range(24)),
                        yticklabels=days,
                    )
                    ax.set_title("When do check-ins happen during the week?")
                    ax.set_xlabel("Hour of day")
                    ax.set_ylabel("Day of week")
                    ax.tick_params(axis="x", rotation=0)
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="06_checkins_heatmap.png",
                                title="When do check-ins happen during the week?",
                                notes=f"{checkins_total:,} check-ins (filtered)",
                            ),
                        )
                    )

                if args.max_reviews <= 0:
                    context_lines.append(f"Check-ins counted: {checkins_total:,}")
                    _write_manifest(args.out, specs, context_lines)
                    print(f"Wrote charts to: {args.out}")
                    return 0

            elif name == "yelp_academic_dataset_review.json" and args.max_reviews > 0:
                print(f"Sampling up to {args.max_reviews:,} reviews…")
                if "business_id_set" not in locals():
                    raise RuntimeError("Expected business file before reviews.")
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
                    reviews_counted += 1
                    if reviews_counted >= args.max_reviews:
                        break
                fileobj.close()

                if review_month_counts:
                    series = (
                        pd.Series(review_month_counts)
                        .rename_axis("month")
                        .reset_index(name="reviews")
                        .sort_values("month")
                    )
                    series["month_dt"] = pd.to_datetime(series["month"], format="%Y-%m")
                    fig, ax = plt.subplots(figsize=(10, 4))
                    ax.plot(series["month_dt"], series["reviews"], color="#B279A2", linewidth=2)
                    ax.set_title("How has review volume changed over time?")
                    ax.set_xlabel("Month")
                    ax.set_ylabel("Number of reviews (sampled)")
                    locator = mdates.AutoDateLocator(minticks=4, maxticks=8)
                    ax.xaxis.set_major_locator(locator)
                    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))
                    ax.yaxis.set_major_formatter(mticker.StrMethodFormatter("{x:,.0f}"))
                    specs.append(
                        _plot_and_save(
                            fig,
                            args.out,
                            ChartSpec(
                                filename="07_reviews_over_time.png",
                                title="How has review volume changed over time?",
                                notes=f"{reviews_counted:,} reviews (filtered sample)",
                            ),
                        )
                    )

                context_lines.append(f"Check-ins counted: {checkins_total:,}")
                context_lines.append(f"Reviews counted: {reviews_counted:,}")
                _write_manifest(args.out, specs, context_lines)
                print(f"Wrote charts to: {args.out}")
                return 0

        raise RuntimeError(
            "Did not find expected Yelp dataset files inside the archive."
        )
    finally:
        _close_tar_chain(tf)


if __name__ == "__main__":
    raise SystemExit(main())
