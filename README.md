# CSC316 Final Project (Yelp Dataset)

## Data
- Yelp Open Dataset archive: `data/Yelp-JSON.zip`
- (Optional) Photos archive: `data/Yelp-Photos.zip`

## Prototype (Interactive Scrollytelling)

Philadelphia Restaurant Market Analysis — a scrollytelling webpage with D3 charts and a Leaflet map exploring 7,083 restaurants across 170+ cuisine types.

**Features:**
- Interactive Leaflet map with 3 view modes (dots, heatmap, clusters), search, and filters
- D3 competition bar chart with sorting
- D3 scatter plot with color-by, highlights, and brush selection
- D3 opportunity matrix with filters and click-to-detail
- D3 volatility chart with sorting and min-reviews slider
- Interactive quiz, animated counters, journey recap

**Run locally:**

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000/prototype/`

**Data files** (`prototype/data/`):
- `philly_restaurants.json` — 7,083 individual restaurant records
- `philly_cuisines.json` — 51 cuisine category aggregates

## Quick EDA charts (Week 3)
Generate exploratory charts as PNGs (plus a `manifest.md` you can copy into the process book):

```bash
python3 -u scripts/yelp_eda.py
```

Common filters:

```bash
# Ontario + Toronto + restaurants-only subset
python3 -u scripts/yelp_eda.py --state ON --city Toronto --category Restaurants

# Add a simple review-volume-over-time chart (sampled)
python3 -u scripts/yelp_eda.py --max-reviews 200000
```

Outputs:
- Images: `outputs/eda/`
- Chart list + titles: `outputs/eda/manifest.md`

## Fancy figures (Week 3, full dataset by default)
Generate “process-book-ready” figures (plus a `manifest.md`) from the Yelp Open Dataset:

```bash
python3 -u scripts/yelp_fancy_figures.py --zip data/Yelp-JSON.zip --out outputs/week3_figures
```

Notes:
- Full dataset is the default; use `--max-reviews/--max-users/--max-tips` to cap for speed.
- Question list for the figures: `docs/week3_figure_questions.md`

## Extract the dataset (browse files)
Extract the JSON dataset (business/checkin/review/tip/user JSONL files) into `data/yelp_extracted/`:

```bash
python3 -u scripts/yelp_extract.py --what json
```

Photos are very large; to extract just the first 500 photo files for inspection:

```bash
python3 -u scripts/yelp_extract.py --what photos --max-files 500
```

## Dataset overview (fields + sizes)
Generate a markdown report + per-file schema CSVs (good for the process book):

```bash
python3 -u scripts/yelp_profile.py --count-total-rows --sample-rows 20000
```

Outputs:
- Report: `outputs/eda/data_overview.md`
- Schemas: `outputs/eda/schema_*.csv`
