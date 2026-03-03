#!/usr/bin/env python3
"""
Prototype V2 Data Pipeline
Reads raw Yelp JSONL files and produces 4 new JSON files in prototype/data/:
  - review_analysis.json
  - stats_deep_dive.json
  - hidden_gem_definition.json
  - isometric_scene_data.json
"""

from __future__ import annotations

import json
import math
import re
import string
from collections import Counter, defaultdict
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────
BASE = Path(__file__).resolve().parent.parent
BUSINESS_PATH = BASE / "data" / "yelp_extracted" / "yelp_json" / "yelp_academic_dataset_business.json"
REVIEW_PATH = BASE / "data" / "yelp_extracted" / "yelp_json" / "yelp_academic_dataset_review.json"
CUISINE_JSON = BASE / "prototype" / "data" / "philly_cuisines.json"
RESTAURANT_JSON = BASE / "prototype" / "data" / "philly_restaurants.json"
OUT_DIR = BASE / "prototype" / "data"

CITY = "Philadelphia"
MIN_BUSINESSES = 40

# Categories to exclude (too broad)
EXCLUDE_CATEGORIES = {
    "Restaurants", "Food", "Nightlife", "Bars",
    "Event Planning & Services", "Sandwiches", "Fast Food",
    "American (Traditional)", "American (New)",
    "Breakfast & Brunch", "Coffee & Tea", "Cafes", "Desserts",
}

# ── Stopwords for word cloud ──────────────────────────────────
STOPWORDS = set("""
a about above after again against all am an and any are aren't as at be
because been before being below between both but by can't cannot could
couldn't did didn't do does doesn't doing don't down during each few for
from further get got had hadn't has hasn't have haven't having he he'd
he'll he's her here here's hers herself him himself his how how's i i'd
i'll i'm i've if in into is isn't it it's its itself let's me more most
mustn't my myself no nor not of off on once only or other ought our ours
ourselves out over own same shan't she she'd she'll she's should
shouldn't so some such than that that's the their theirs them themselves
then there there's these they they'd they'll they're they've this those
through to too under until up very was wasn't we we'd we'll we're we've
were weren't what what's when when's where where's which while who who's
whom why why's will with won't would wouldn't you you'd you'll you're
you've your yours yourself yourselves
also just really like got get one two would could go going went good
great place food restaurant order came back time got even much well
still make made way come right thing take took try also us keep thing
""".split())

# ── Simple keyword-based sentiment ────────────────────────────
POSITIVE_WORDS = set("""
amazing awesome best delicious excellent fantastic fresh friendly good
great heavenly incredible love loved lovely magnificent outstanding
perfect phenomenal superb tasty terrific wonderful yummy
""".split())

NEGATIVE_WORDS = set("""
awful bad bland boring cold disappointed disgusting dreadful dry gross
horrible mediocre nasty overcooked overpriced poor rude slow stale
tasteless terrible undercooked unpleasant worst
""".split())


def sentiment_score(text: str) -> float:
    """Return sentiment from -1.0 (negative) to 1.0 (positive)."""
    words = set(re.findall(r'[a-z]+', text.lower()))
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return (pos - neg) / total


def sentiment_category(score: float) -> str:
    if score > 0.1:
        return "positive"
    if score < -0.1:
        return "negative"
    return "neutral"


def iter_jsonl(path: Path):
    """Iterate dicts from a JSONL file."""
    with path.open("rb") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def split_categories(cats) -> list[str]:
    if cats is None:
        return []
    if isinstance(cats, list):
        return [str(c).strip() for c in cats if str(c).strip()]
    return [c.strip() for c in str(cats).split(",") if c.strip()]


def extract_words(text: str) -> list[str]:
    """Extract cleaned words for word cloud."""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    words = text.split()
    return [w for w in words if len(w) > 2 and w not in STOPWORDS and w.isalpha()]


def truncate(text: str, max_len: int = 200) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3].rsplit(" ", 1)[0] + "..."


# ── Step 1: Identify Philadelphia restaurant business IDs ─────
def load_philly_businesses() -> tuple[dict[str, list[str]], dict[str, dict]]:
    """Returns (business_id -> cuisine_list, business_id -> business_info)."""
    print("Loading Philadelphia businesses...")
    biz_cuisines: dict[str, list[str]] = {}
    biz_info: dict[str, dict] = {}
    count = 0

    for biz in iter_jsonl(BUSINESS_PATH):
        city = (biz.get("city") or "").strip()
        if city.lower() != CITY.lower():
            continue
        cats = split_categories(biz.get("categories"))
        if "Restaurants" not in cats:
            continue

        bid = biz.get("business_id", "").strip()
        if not bid:
            continue

        cuisines = sorted({c for c in cats if c and c not in EXCLUDE_CATEGORIES})
        if not cuisines:
            continue

        biz_cuisines[bid] = cuisines
        biz_info[bid] = {
            "name": biz.get("name", ""),
            "stars": biz.get("stars", 0),
            "review_count": biz.get("review_count", 0),
            "lat": biz.get("latitude"),
            "lng": biz.get("longitude"),
            "cuisines": cuisines,
        }
        count += 1

    print(f"  Found {count:,} Philadelphia restaurants")
    return biz_cuisines, biz_info


# ── Step 2: Process reviews ───────────────────────────────────
def process_reviews(biz_cuisines: dict[str, list[str]]) -> dict:
    """Process all reviews for Philadelphia restaurants."""
    print("Processing reviews (this may take a few minutes)...")

    # Per-cuisine accumulators
    cuisine_reviews: dict[str, list[dict]] = defaultdict(list)  # store (text, stars, sentiment)
    cuisine_words: dict[str, Counter] = defaultdict(Counter)
    cuisine_sentiment_scores: dict[str, list[float]] = defaultdict(list)
    cuisine_star_counts: dict[str, Counter] = defaultdict(Counter)  # star -> count

    scanned = 0
    matched = 0

    for review in iter_jsonl(REVIEW_PATH):
        scanned += 1
        bid = review.get("business_id", "").strip()
        cuisines = biz_cuisines.get(bid)
        if not cuisines:
            continue

        matched += 1
        text = review.get("text", "")
        stars = review.get("stars", 3)
        star_int = max(1, min(5, int(round(float(stars)))))
        sent = sentiment_score(text)
        words = extract_words(text)

        for cuisine in cuisines:
            # Store review data (limit stored reviews for memory)
            if len(cuisine_reviews[cuisine]) < 500:
                cuisine_reviews[cuisine].append({
                    "text": text,
                    "stars": star_int,
                    "sentiment": sent,
                })
            cuisine_words[cuisine].update(words)
            cuisine_sentiment_scores[cuisine].append(sent)
            cuisine_star_counts[cuisine][star_int] += 1

        if scanned % 500_000 == 0:
            print(f"  Scanned {scanned:,} reviews, matched {matched:,}")

    print(f"  Total: scanned {scanned:,}, matched {matched:,}")

    return {
        "cuisine_reviews": cuisine_reviews,
        "cuisine_words": cuisine_words,
        "cuisine_sentiment_scores": cuisine_sentiment_scores,
        "cuisine_star_counts": cuisine_star_counts,
    }


# ── Step 3: Build review_analysis.json ────────────────────────
def build_review_analysis(review_data: dict, valid_cuisines: set[str]) -> dict:
    """Build per-cuisine review analysis."""
    print("Building review_analysis.json...")
    result = {}

    for cuisine in sorted(valid_cuisines):
        reviews = review_data["cuisine_reviews"].get(cuisine, [])
        words = review_data["cuisine_words"].get(cuisine, Counter())
        scores = review_data["cuisine_sentiment_scores"].get(cuisine, [])

        if not reviews:
            continue

        # Top 30 words for word cloud
        top_words = [{"word": w, "count": c} for w, c in words.most_common(30)]

        # Top 3 positive and negative review excerpts
        sorted_by_sent = sorted(reviews, key=lambda r: r["sentiment"])
        negative_excerpts = [
            {"text": truncate(r["text"]), "stars": r["stars"], "sentiment": round(r["sentiment"], 2)}
            for r in sorted_by_sent[:3]
        ]
        positive_excerpts = [
            {"text": truncate(r["text"]), "stars": r["stars"], "sentiment": round(r["sentiment"], 2)}
            for r in sorted_by_sent[-3:]
        ][::-1]  # reverse so most positive first

        # Average sentiment
        avg_sent = sum(scores) / len(scores) if scores else 0.0

        # Sentiment distribution
        pos_count = sum(1 for s in scores if s > 0.1)
        neg_count = sum(1 for s in scores if s < -0.1)
        neu_count = len(scores) - pos_count - neg_count
        total = len(scores) if len(scores) > 0 else 1

        result[cuisine] = {
            "top_words": top_words,
            "positive_excerpts": positive_excerpts,
            "negative_excerpts": negative_excerpts,
            "avg_sentiment": round(avg_sent, 3),
            "sentiment_distribution": {
                "positive": round(pos_count / total * 100, 1),
                "neutral": round(neu_count / total * 100, 1),
                "negative": round(neg_count / total * 100, 1),
            },
            "total_reviews_analyzed": len(scores),
        }

    return result


# ── Step 4: Build stats_deep_dive.json ────────────────────────
def build_stats_deep_dive(review_data: dict, cuisine_data: list[dict]) -> dict:
    """Build per-cuisine statistical analysis."""
    print("Building stats_deep_dive.json...")
    result = {}

    # Compute city-wide mean and std for z-score calculations
    all_ratings = []
    for c_data in cuisine_data:
        star_counts = review_data["cuisine_star_counts"].get(c_data["cuisine"], Counter())
        for star, count in star_counts.items():
            all_ratings.extend([star] * count)

    city_mean = sum(all_ratings) / len(all_ratings) if all_ratings else 3.5
    city_var = sum((r - city_mean) ** 2 for r in all_ratings) / len(all_ratings) if all_ratings else 1.0
    city_std = math.sqrt(city_var)

    for c_data in cuisine_data:
        cuisine = c_data["cuisine"]
        star_counts = review_data["cuisine_star_counts"].get(cuisine, Counter())

        if not star_counts:
            continue

        # Build rating list from histogram
        ratings = []
        for star, count in star_counts.items():
            ratings.extend([star] * count)

        if not ratings:
            continue

        n = len(ratings)
        mean = sum(ratings) / n
        variance = sum((r - mean) ** 2 for r in ratings) / n if n > 1 else 0
        std = math.sqrt(variance)

        # 95% confidence interval for mean rating
        se = std / math.sqrt(n) if n > 0 else 0
        ci_lower = mean - 1.96 * se
        ci_upper = mean + 1.96 * se

        # Rating histogram (1-5 stars)
        histogram = {str(s): star_counts.get(s, 0) for s in range(1, 6)}

        # Review count quartiles (from cuisine_data)
        review_count = c_data.get("count", 0)

        # Z-score and p-value vs city mean
        z_score = (mean - city_mean) / (std / math.sqrt(n)) if std > 0 and n > 0 else 0.0

        # Approximate p-value from z-score (two-tailed)
        abs_z = abs(z_score)
        if abs_z > 3.5:
            p_value = 0.0005
        elif abs_z > 3.0:
            p_value = 0.003
        elif abs_z > 2.58:
            p_value = 0.01
        elif abs_z > 2.33:
            p_value = 0.02
        elif abs_z > 1.96:
            p_value = 0.05
        elif abs_z > 1.645:
            p_value = 0.10
        else:
            p_value = round(2 * (1 - 0.5 * (1 + math.erf(abs_z / math.sqrt(2)))), 4)

        result[cuisine] = {
            "n_reviews": n,
            "mean_rating": round(mean, 3),
            "std_rating": round(std, 3),
            "ci_lower": round(ci_lower, 3),
            "ci_upper": round(ci_upper, 3),
            "histogram": histogram,
            "z_score": round(z_score, 3),
            "p_value": round(p_value, 4),
            "significant": p_value < 0.05,
            "restaurant_count": review_count,
        }

    result["_city_mean"] = round(city_mean, 3)
    result["_city_std"] = round(city_std, 3)

    return result


# ── Step 5: Build hidden_gem_definition.json ──────────────────
def build_hidden_gem_definition(cuisine_data: list[dict], stats_data: dict) -> dict:
    """Build gem score rankings for all cuisines."""
    print("Building hidden_gem_definition.json...")

    # Normalize metrics across all cuisines
    counts = [c["count"] for c in cuisine_data]
    ratings = [c["avg_rating"] for c in cuisine_data]
    stds = [c["std_rating"] for c in cuisine_data]
    reviews = [c["median_reviews"] for c in cuisine_data]

    max_count = max(counts) if counts else 1
    min_rating = min(ratings) if ratings else 1
    max_rating = max(ratings) if ratings else 5
    max_std = max(stds) if stds else 1
    max_reviews = max(reviews) if reviews else 1

    rankings = []
    for c in cuisine_data:
        # competition_pct: how saturated the market is (0=no competition, 1=max)
        competition_pct = c["count"] / max_count

        # quality: normalized rating (0-1)
        quality = (c["avg_rating"] - min_rating) / (max_rating - min_rating) if max_rating > min_rating else 0.5

        # stability: inverse of normalized volatility (0=volatile, 1=stable)
        stability = 1.0 - (c["std_rating"] / max_std) if max_std > 0 else 0.5

        # demand: normalized median reviews (proxy for customer demand)
        demand = c["median_reviews"] / max_reviews if max_reviews > 0 else 0.0

        # Gem score formula
        gem_score = (
            0.3 * (1 - competition_pct) +
            0.3 * quality +
            0.2 * stability +
            0.2 * demand
        )

        rankings.append({
            "cuisine": c["cuisine"],
            "gem_score": round(gem_score, 4),
            "components": {
                "low_competition": round(1 - competition_pct, 4),
                "quality": round(quality, 4),
                "stability": round(stability, 4),
                "demand": round(demand, 4),
            },
            "raw": {
                "count": c["count"],
                "avg_rating": c["avg_rating"],
                "std_rating": c["std_rating"],
                "median_reviews": c["median_reviews"],
            },
        })

    # Sort by gem_score descending
    rankings.sort(key=lambda r: -r["gem_score"])

    # Determine threshold (top 30% are gems)
    threshold_idx = max(1, int(len(rankings) * 0.3))
    threshold = rankings[threshold_idx - 1]["gem_score"] if rankings else 0.5

    # Mark gems
    gem_cuisines = []
    for r in rankings:
        r["is_gem"] = r["gem_score"] >= threshold
        if r["is_gem"]:
            gem_cuisines.append(r["cuisine"])

    return {
        "formula": "gem_score = 0.3*(1-competition_pct) + 0.3*quality + 0.2*stability + 0.2*demand",
        "weights": {
            "low_competition": 0.3,
            "quality": 0.3,
            "stability": 0.2,
            "demand": 0.2,
        },
        "threshold": round(threshold, 4),
        "gem_cuisines": gem_cuisines,
        "rankings": rankings,
    }


# ── Step 6: Build isometric_scene_data.json ───────────────────
def build_isometric_scene(
    gem_data: dict,
    biz_info: dict[str, dict],
    biz_cuisines: dict[str, list[str]],
    review_data: dict,
) -> list[dict]:
    """Build data for 5-10 featured hidden gem restaurants."""
    print("Building isometric_scene_data.json...")

    gem_cuisines_set = set(gem_data["gem_cuisines"][:8])
    featured = []

    # For each gem cuisine, find the best restaurant
    for cuisine in gem_data["gem_cuisines"][:8]:
        # Find restaurants with this cuisine
        best = None
        best_score = -1
        for bid, info in biz_info.items():
            if cuisine in info["cuisines"]:
                score = info["stars"] * math.log(info["review_count"] + 1)
                if score > best_score:
                    best_score = score
                    best = (bid, info)

        if not best:
            continue

        bid, info = best

        # Get review excerpts
        reviews = review_data["cuisine_reviews"].get(cuisine, [])
        # Pick 3 best reviews
        top_reviews = sorted(reviews, key=lambda r: r["sentiment"], reverse=True)[:3]
        excerpts = [truncate(r["text"], 150) for r in top_reviews]

        # Get top dishes (most mentioned food-related words)
        words = review_data["cuisine_words"].get(cuisine, Counter())
        food_words = [w for w, _ in words.most_common(50) if len(w) > 3][:5]

        # Find gem ranking
        ranking_entry = next((r for r in gem_data["rankings"] if r["cuisine"] == cuisine), None)

        featured.append({
            "name": info["name"],
            "cuisine": cuisine,
            "stars": info["stars"],
            "review_count": info["review_count"],
            "lat": info["lat"],
            "lng": info["lng"],
            "review_excerpts": excerpts,
            "top_dishes": food_words,
            "gem_score": ranking_entry["gem_score"] if ranking_entry else 0,
            "gem_rank": gem_data["rankings"].index(ranking_entry) + 1 if ranking_entry else 0,
        })

    return featured


# ── Main ──────────────────────────────────────────────────────
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing cuisine data
    with open(CUISINE_JSON) as f:
        cuisine_data = json.load(f)

    # Get valid cuisines (those in our dataset)
    valid_cuisines = {c["cuisine"] for c in cuisine_data}

    # Load businesses
    biz_cuisines, biz_info = load_philly_businesses()

    # Process reviews
    review_data = process_reviews(biz_cuisines)

    # Build all output files
    review_analysis = build_review_analysis(review_data, valid_cuisines)
    stats_deep_dive = build_stats_deep_dive(review_data, cuisine_data)
    gem_definition = build_hidden_gem_definition(cuisine_data, stats_deep_dive)
    isometric_scene = build_isometric_scene(gem_definition, biz_info, biz_cuisines, review_data)

    # Write outputs
    out_files = {
        "review_analysis.json": review_analysis,
        "stats_deep_dive.json": stats_deep_dive,
        "hidden_gem_definition.json": gem_definition,
        "isometric_scene_data.json": isometric_scene,
    }

    for filename, data in out_files.items():
        path = OUT_DIR / filename
        with open(path, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        size = path.stat().st_size
        print(f"  Wrote {filename} ({size:,} bytes)")

    print("\nDone! All 4 JSON files written to prototype/data/")
    print(f"  Gem cuisines: {gem_definition['gem_cuisines']}")


if __name__ == "__main__":
    main()
