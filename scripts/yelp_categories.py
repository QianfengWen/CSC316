#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class CategoryStats:
    category: str
    businesses: int
    food_businesses: int
    food_share: float
    is_food_related: bool


def _normalize_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


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


def _iter_jsonl_dicts(path: Path) -> Iterable[dict]:
    with path.open("rb") as f:
        for raw in f:
            if not raw.strip():
                continue
            obj = json.loads(raw)
            if isinstance(obj, dict):
                yield obj


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


def _default_business_path() -> Path:
    extracted = Path("data/yelp_extracted/yelp_json/yelp_academic_dataset_business.json")
    if extracted.exists():
        return extracted
    return Path("data/yelp_academic_dataset_business.json")


def _write_category_csv(out_path: Path, rows: list[CategoryStats]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "category",
                "businesses",
                "food_businesses",
                "food_share",
                "is_food_related",
            ]
        )
        for row in rows:
            w.writerow(
                [
                    row.category,
                    row.businesses,
                    row.food_businesses,
                    f"{row.food_share:.6f}",
                    int(row.is_food_related),
                ]
            )


def _write_category_markdown(out_path: Path, rows: list[CategoryStats], *, context: str) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        f.write("# Yelp — Category List (All Categories)\n\n")
        f.write("Food-related categories are **bolded**.\n\n")
        f.write(f"{context}\n\n")
        f.write("| Category | Businesses | Food share |\n")
        f.write("|---|---:|---:|\n")
        for row in rows:
            name = f"**{row.category}**" if row.is_food_related else row.category
            f.write(f"| {name} | {row.businesses:,} | {row.food_share:.2f} |\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate a list of all Yelp business categories (with food-related highlighting)."
    )
    parser.add_argument(
        "--business",
        type=Path,
        default=_default_business_path(),
        help="Path to yelp_academic_dataset_business.json (JSONL).",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("outputs/eda"),
        help="Output directory for generated files.",
    )
    parser.add_argument("--state", action="append", default=[], help="Filter by state/province code.")
    parser.add_argument("--city", action="append", default=[], help="Filter by city name.")
    parser.add_argument(
        "--category",
        action="append",
        default=[],
        help="Filter businesses whose categories contain this substring (repeatable).",
    )
    parser.add_argument(
        "--food-anchor",
        action="append",
        default=["Restaurants", "Food"],
        help="Categories that mark a business as food-related (repeatable).",
    )
    parser.add_argument(
        "--food-share-threshold",
        type=float,
        default=0.80,
        help="Mark a category as food-related when >= this share of businesses with the category are food-anchored.",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=10,
        help="Minimum business count for a category to be eligible for food-related marking (excluding anchors).",
    )
    parser.add_argument(
        "--exclude-food-category",
        action="append",
        default=["Pharmacy", "Drugstores", "Service Stations", "Water Stores"],
        help="Never mark these categories as food-related (repeatable).",
    )

    args = parser.parse_args()

    if not args.business.exists():
        raise FileNotFoundError(f"Missing business file: {args.business}")

    states = {s.strip().upper() for s in args.state if s.strip()}
    cities = {c.strip().lower() for c in args.city if c.strip()}
    category_substrings = [c.strip().lower() for c in args.category if c.strip()]

    food_anchor = {c.strip() for c in args.food_anchor if c.strip()}
    exclude_food_category = {c.strip() for c in args.exclude_food_category if c.strip()}

    category_counts: Counter[str] = Counter()
    category_food_counts: Counter[str] = Counter()
    businesses_seen = 0

    for business in _iter_jsonl_dicts(args.business):
        if not _business_passes_filters(
            business,
            states=states,
            cities=cities,
            category_substrings=category_substrings,
        ):
            continue

        categories = _split_categories(business.get("categories"))
        if not categories:
            continue

        businesses_seen += 1
        unique_categories = set(categories)
        is_food_business = any(c in food_anchor for c in unique_categories)

        category_counts.update(unique_categories)
        if is_food_business:
            category_food_counts.update(unique_categories)

    rows: list[CategoryStats] = []
    for category, total in category_counts.items():
        food = category_food_counts.get(category, 0)
        food_share = food / total if total else 0.0
        is_food_related = (
            category in food_anchor
            or (total >= args.min_count and food_share >= args.food_share_threshold)
        ) and (category not in exclude_food_category)
        rows.append(
            CategoryStats(
                category=category,
                businesses=total,
                food_businesses=food,
                food_share=food_share,
                is_food_related=is_food_related,
            )
        )

    out_dir: Path = args.out_dir
    out_csv = out_dir / "categories_all.csv"
    out_md = out_dir / "categories_all.md"

    csv_rows = sorted(rows, key=lambda r: (-r.businesses, r.category.lower()))
    md_rows = sorted(rows, key=lambda r: r.category.lower())

    _write_category_csv(out_csv, csv_rows)

    context = "\n".join(
        [
            "- Source: `yelp_academic_dataset_business.json`",
            f"- Businesses included: {businesses_seen:,}",
            f"- Unique categories: {len(rows):,}",
            f"- Food anchors: {', '.join(sorted(food_anchor)) or '(none)'}",
            f"- Food-related rule: category ∈ anchors OR (businesses ≥ {args.min_count} AND food_share ≥ {args.food_share_threshold:.2f}), excluding {', '.join(sorted(exclude_food_category)) or '(none)'}",
            f"- Filters: states={sorted(states) or '∅'}, cities={sorted(cities) or '∅'}, category_substrings={category_substrings or '∅'}",
        ]
    )
    _write_category_markdown(out_md, md_rows, context=context)

    print(f"Wrote: {out_csv}")
    print(f"Wrote: {out_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

