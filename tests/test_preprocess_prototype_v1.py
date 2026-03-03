from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import preprocess_prototype_v1 as prep


def test_split_categories_handles_string_and_list() -> None:
    assert prep.split_categories("Pizza, Restaurants, Italian") == [
        "Pizza",
        "Restaurants",
        "Italian",
    ]
    assert prep.split_categories(["Thai", "Restaurants", ""]) == ["Thai", "Restaurants"]
    assert prep.split_categories(None) == []


def test_trimmed_mean_trims_tails() -> None:
    stars = [1.0, 2.0, 3.0, 4.0, 5.0]
    # With trim_ratio=0.2 and n=5, trim one value from each side -> [2,3,4]
    assert prep.trimmed_mean(stars, trim_ratio=0.2) == 3.0


def test_weighted_quantiles_from_histogram() -> None:
    hist = {1: 1, 2: 2, 3: 4, 4: 2, 5: 1}
    q25, q50, q75 = prep.weighted_quantiles_from_histogram(hist)
    assert (q25, q50, q75) == (2.0, 3.0, 4.0)


def test_review_distribution_metrics() -> None:
    hist = {1: 2, 2: 2, 3: 2, 4: 2, 5: 2}
    metrics = prep.review_distribution_metrics(hist)
    assert metrics["total_reviews"] == 10
    assert metrics["share_low_reviews"] == 0.4
    assert metrics["share_high_reviews"] == 0.4
    assert metrics["polarization_index"] == 0.8
    # Symmetric values around 3 should have known stddev sqrt(2)
    assert round(metrics["volatility"], 6) == round(2**0.5, 6)
