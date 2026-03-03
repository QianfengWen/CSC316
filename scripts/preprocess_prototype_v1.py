#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable


def normalize_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def split_categories(categories_field: object) -> list[str]:
    if categories_field is None:
        return []
    if isinstance(categories_field, list):
        return [str(c).strip() for c in categories_field if str(c).strip()]
    text = normalize_str(categories_field)
    if not text:
        return []
    return [c.strip() for c in text.split(",") if c.strip()]


def parse_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        text = normalize_str(value)
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            return None


def parse_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    as_float = parse_float(value)
    if as_float is None:
        return None
    return int(as_float)


def iter_jsonl_dicts(path: Path) -> Iterable[dict]:
    with path.open("rb") as f:
        for raw in f:
            if not raw.strip():
                continue
            obj = json.loads(raw)
            if isinstance(obj, dict):
                yield obj


def trimmed_mean(values: list[float], trim_ratio: float = 0.1) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    trim_n = int(len(ordered) * trim_ratio)
    if trim_n * 2 >= len(ordered):
        return sum(ordered) / len(ordered)
    core = ordered[trim_n : len(ordered) - trim_n]
    return sum(core) / len(core)


def weighted_quantiles_from_histogram(hist: dict[int, int]) -> tuple[float, float, float]:
    total = int(sum(hist.get(star, 0) for star in (1, 2, 3, 4, 5)))
    if total <= 0:
        return (float("nan"), float("nan"), float("nan"))

    def quantile_star(q: float) -> float:
        threshold = math.ceil(q * total)
        running = 0
        for star in (1, 2, 3, 4, 5):
            running += int(hist.get(star, 0))
            if running >= threshold:
                return float(star)
        return 5.0

    return (quantile_star(0.25), quantile_star(0.5), quantile_star(0.75))


def review_distribution_metrics(hist: dict[int, int]) -> dict[str, float]:
    total = int(sum(hist.get(star, 0) for star in (1, 2, 3, 4, 5)))
    if total <= 0:
        return {
            "total_reviews": 0.0,
            "share_low_reviews": 0.0,
            "share_high_reviews": 0.0,
            "polarization_index": 0.0,
            "volatility": 0.0,
        }

    low = int(hist.get(1, 0)) + int(hist.get(2, 0))
    high = int(hist.get(4, 0)) + int(hist.get(5, 0))
    mean_star = sum(star * int(hist.get(star, 0)) for star in (1, 2, 3, 4, 5)) / total
    variance = (
        sum(((star - mean_star) ** 2) * int(hist.get(star, 0)) for star in (1, 2, 3, 4, 5))
        / total
    )
    return {
        "total_reviews": float(total),
        "share_low_reviews": low / total,
        "share_high_reviews": high / total,
        "polarization_index": (low + high) / total,
        "volatility": math.sqrt(variance),
    }


def city_counts_from_businesses(business_path: Path) -> Counter[str]:
    counts: Counter[str] = Counter()
    for business in iter_jsonl_dicts(business_path):
        city = normalize_str(business.get("city"))
        if city:
            counts[city] += 1
    return counts


def build_rows(
    *,
    business_path: Path,
    review_path: Path,
    city: str,
    min_businesses: int,
    trim_ratio: float,
    category_exclude: set[str],
) -> list[dict[str, object]]:
    city_lower = city.strip().lower()
    business_categories: dict[str, list[str]] = {}
    category_business_ids: dict[str, set[str]] = defaultdict(set)
    category_business_stars: dict[str, list[float]] = defaultdict(list)
    category_open_count: Counter[str] = Counter()

    businesses_seen = 0
    selected_businesses = 0

    for business in iter_jsonl_dicts(business_path):
        businesses_seen += 1
        business_city = normalize_str(business.get("city")).lower()
        if business_city != city_lower:
            continue

        categories = split_categories(business.get("categories"))
        if "Restaurants" not in categories:
            continue

        business_id = normalize_str(business.get("business_id"))
        if not business_id:
            continue

        categories = sorted({c for c in categories if c and c not in category_exclude})
        if not categories:
            continue

        selected_businesses += 1
        business_categories[business_id] = categories
        is_open = parse_int(business.get("is_open")) or 0
        stars = parse_float(business.get("stars"))

        for category in categories:
            category_business_ids[category].add(business_id)
            if is_open == 1:
                category_open_count[category] += 1
            if stars is not None:
                category_business_stars[category].append(stars)

    print(
        f"Businesses scanned: {businesses_seen:,} | selected city+restaurants businesses: {selected_businesses:,}"
    )

    category_review_hist: dict[str, Counter[int]] = defaultdict(Counter)
    reviews_scanned = 0
    reviews_selected = 0
    for review in iter_jsonl_dicts(review_path):
        reviews_scanned += 1
        business_id = normalize_str(review.get("business_id"))
        categories = business_categories.get(business_id)
        if not categories:
            continue

        stars = parse_float(review.get("stars"))
        if stars is None:
            continue

        star_bin = int(round(stars))
        if star_bin < 1:
            star_bin = 1
        if star_bin > 5:
            star_bin = 5

        reviews_selected += 1
        for category in categories:
            category_review_hist[category][star_bin] += 1

        if reviews_scanned % 1_000_000 == 0:
            print(f"Reviews scanned: {reviews_scanned:,} | selected: {reviews_selected:,}")

    print(f"Reviews scanned: {reviews_scanned:,} | selected: {reviews_selected:,}")

    rows: list[dict[str, object]] = []
    for category, ids in category_business_ids.items():
        business_count = len(ids)
        if business_count < min_businesses:
            continue

        stars_list = category_business_stars.get(category, [])
        if stars_list:
            mean_stars_business = sum(stars_list) / len(stars_list)
            trimmed_mean_stars_business = trimmed_mean(stars_list, trim_ratio=trim_ratio)
        else:
            mean_stars_business = float("nan")
            trimmed_mean_stars_business = float("nan")

        hist = {
            1: int(category_review_hist[category].get(1, 0)),
            2: int(category_review_hist[category].get(2, 0)),
            3: int(category_review_hist[category].get(3, 0)),
            4: int(category_review_hist[category].get(4, 0)),
            5: int(category_review_hist[category].get(5, 0)),
        }
        q25, median, q75 = weighted_quantiles_from_histogram(hist)
        dist = review_distribution_metrics(hist)

        rows.append(
            {
                "city": city,
                "category": category,
                "business_count": business_count,
                "open_count": int(category_open_count.get(category, 0)),
                "total_reviews": int(dist["total_reviews"]),
                "mean_stars_business": mean_stars_business,
                "trimmed_mean_stars_business": trimmed_mean_stars_business,
                "median_review_stars": median,
                "q25_review_stars": q25,
                "q75_review_stars": q75,
                "share_low_reviews": dist["share_low_reviews"],
                "share_high_reviews": dist["share_high_reviews"],
                "polarization_index": dist["polarization_index"],
                "volatility": dist["volatility"],
            }
        )

    rows.sort(
        key=lambda r: (
            -int(r["business_count"]),
            -float(r["trimmed_mean_stars_business"]),
            str(r["category"]).lower(),
        )
    )
    return rows


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "city",
        "category",
        "business_count",
        "open_count",
        "total_reviews",
        "mean_stars_business",
        "trimmed_mean_stars_business",
        "median_review_stars",
        "q25_review_stars",
        "q75_review_stars",
        "share_low_reviews",
        "share_high_reviews",
        "polarization_index",
        "volatility",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preprocess Yelp data into category-level aggregates for the prototype D3 charts.",
    )
    parser.add_argument(
        "--business",
        type=Path,
        default=Path("data/yelp_extracted/yelp_json/yelp_academic_dataset_business.json"),
        help="Path to yelp business JSONL.",
    )
    parser.add_argument(
        "--review",
        type=Path,
        default=Path("data/yelp_extracted/yelp_json/yelp_academic_dataset_review.json"),
        help="Path to yelp review JSONL.",
    )
    parser.add_argument("--city", default="Philadelphia", help="Target city (exact, case-insensitive).")
    parser.add_argument("--min-businesses", type=int, default=40, help="Minimum businesses per category.")
    parser.add_argument("--trim-ratio", type=float, default=0.1, help="Trim ratio for business stars mean.")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/clean/philly_category_agg.csv"),
        help="Output full aggregate CSV path.",
    )
    parser.add_argument(
        "--top-out",
        type=Path,
        default=Path("data/clean/philly_category_agg_top30.csv"),
        help="Output top-N aggregate CSV path.",
    )
    parser.add_argument("--top-n", type=int, default=30, help="Rows to keep for top output.")
    parser.add_argument(
        "--category-exclude",
        action="append",
        default=[
            "Restaurants",
            "Food",
            "Nightlife",
            "Bars",
            "Event Planning & Services",
            "Sandwiches",
            "Fast Food",
            "American (Traditional)",
            "American (New)",
            "Breakfast & Brunch",
            "Coffee & Tea",
            "Cafes",
            "Desserts",
        ],
        help="Exclude broad categories from output (repeatable).",
    )
    parser.add_argument(
        "--check-city-only",
        action="store_true",
        help="Only print city counts + existence check for --city and exit.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.business.exists():
        raise FileNotFoundError(f"Missing business file: {args.business}")
    if not args.check_city_only and not args.review.exists():
        raise FileNotFoundError(f"Missing review file: {args.review}")

    if args.check_city_only:
        counts = city_counts_from_businesses(args.business)
        print("Top cities:", counts.most_common(30))
        print(f"Has {args.city}? {args.city in counts}")
        return 0

    rows = build_rows(
        business_path=args.business,
        review_path=args.review,
        city=args.city,
        min_businesses=args.min_businesses,
        trim_ratio=args.trim_ratio,
        category_exclude={c.strip() for c in args.category_exclude if c.strip()},
    )

    write_csv(args.out, rows)
    print(f"Wrote {len(rows):,} rows to {args.out}")

    top_rows = rows[: max(args.top_n, 0)]
    write_csv(args.top_out, top_rows)
    print(f"Wrote {len(top_rows):,} rows to {args.top_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
