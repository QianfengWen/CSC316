# Yelp Cuisine Opportunity Prototype V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first working D3 prototype with real Yelp data for Philadelphia, including two implemented visualizations (one novel), clear storytelling sections, interaction design notes, and rough drafts for additional views.

**Architecture:** Use a Python preprocessing script to generate one clean category-level CSV from raw Yelp JSONL files (`business` + `review`). Serve a static D3 page (`prototype_v1`) that loads this CSV, renders two linked charts (scatter + custom risk rope), and includes narrative sections plus placeholder blocks for upcoming views.

**Tech Stack:** Python 3, pytest, D3.js (CDN), HTML/CSS/vanilla JS.

---

### Task 1: Data Pipeline Utilities + Tests

**Files:**
- Create: `tests/test_preprocess_prototype_v1.py`
- Create: `scripts/preprocess_prototype_v1.py`

**Step 1: Write failing tests**

- Add tests for:
  - Category splitting helper.
  - Trimmed mean computation helper.
  - Quantile + volatility derivation from 1-5 star histogram.
  - Polarization and low/high share calculations.

**Step 2: Run test to verify failures**

Run: `pytest -q tests/test_preprocess_prototype_v1.py`
Expected: FAIL because `scripts/preprocess_prototype_v1.py` does not exist yet.

**Step 3: Write minimal implementation to pass tests**

- Implement tested pure helpers.
- Add CLI parser and skeleton I/O flow.

**Step 4: Run tests to verify pass**

Run: `pytest -q tests/test_preprocess_prototype_v1.py`
Expected: PASS.

### Task 2: Full Aggregation Script + Dataset Build

**Files:**
- Modify: `scripts/preprocess_prototype_v1.py`
- Create: `data/clean/philly_category_agg.csv`
- Create: `data/clean/philly_category_agg_top30.csv`

**Step 1: Implement full data pipeline**

- Read businesses from `data/yelp_extracted/yelp_json/yelp_academic_dataset_business.json`.
- Filter to city = Philadelphia (case-insensitive exact trimmed match) and businesses containing `Restaurants`.
- Explode categories and track per-category business-level metrics.
- Read reviews from `data/yelp_extracted/yelp_json/yelp_academic_dataset_review.json` and aggregate per-category review-star histogram through business IDs.
- Compute final metrics:
  - `business_count`, `open_count`, `total_reviews`
  - `mean_stars_business`, `trimmed_mean_stars_business`
  - `median_review_stars`, `q25_review_stars`, `q75_review_stars`
  - `share_low_reviews`, `share_high_reviews`
  - `polarization_index`, `volatility`

**Step 2: Run preprocessing**

Run: `python3 -u scripts/preprocess_prototype_v1.py --city Philadelphia --min-businesses 40 --out data/clean/philly_category_agg.csv --top-out data/clean/philly_category_agg_top30.csv --top-n 30`
Expected: script completes and writes both CSV files.

**Step 3: Sanity-check outputs**

Run:
- `python3 -u scripts/preprocess_prototype_v1.py --check-city-only --city Philadelphia`
- `head -n 20 data/clean/philly_category_agg_top30.csv`

Expected: confirms Philadelphia exists and CSV schema/values are non-empty.

### Task 3: Prototype Webpage + Implemented Visualizations

**Files:**
- Create: `prototype_v1/index.html`
- Create: `prototype_v1/styles.css`
- Create: `prototype_v1/main.js`
- Create: `prototype_v1/data/philly_category_agg_top30.csv` (copied from `data/clean`)

**Step 1: Build rough webpage structure/story**

- Add sectioned narrative:
  - Hook
  - Landscape
  - Robustness
  - Risk
  - Action
- Add student names section.
- Add placeholder cards for 3 additional draft visualizations.

**Step 2: Implement D3 Viz #1 (Market Landscape Scatter)**

- Load CSV with D3.
- X: `business_count` (log scale), Y: `trimmed_mean_stars_business`.
- Circle size: `total_reviews`; color: `polarization_index`.
- Add axes, labels, color legend, tooltip.
- Add click selection state and selected-category card update.

**Step 3: Implement D3 Viz #2 (Novel Risk Rope)**

- Draw vertical ropes for top categories.
- Rope span maps rating 1–5.
- Knots at q25/median/q75.
- Rope thickness from `total_reviews`.
- Bottom/top beads for `share_low_reviews` and `share_high_reviews`.
- Hover tooltip and click-to-select linked with scatter.

### Task 4: Interaction Design + Final Verification

**Files:**
- Create: `docs/prototype_v1_interaction_design.md`
- Modify: `README.md`

**Step 1: Add explicit interaction design document**

- Document:
  - Global controls (city, min reviews, top N).
  - Scatter hover/click/brush (brush marked future).
  - Risk rope hover/click and linking behavior.
  - Category insight card behavior.
  - Rough sketch notes for future visualizations.

**Step 2: Wire data path + run lightweight validation**

Run:
- `pytest -q tests/test_preprocess_prototype_v1.py`
- `python3 -u scripts/preprocess_prototype_v1.py --city Philadelphia --min-businesses 40 --out data/clean/philly_category_agg.csv --top-out data/clean/philly_category_agg_top30.csv --top-n 30`
- `cp data/clean/philly_category_agg_top30.csv prototype_v1/data/philly_category_agg_top30.csv`
- `python3 -m http.server 8000` (manual smoke check at `/prototype_v1/`)

Expected: tests pass, CSV exists, and page loads with both charts.
