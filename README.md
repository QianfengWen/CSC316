# CSC316 Final Project (Yelp Dataset)

## Data
- Yelp Open Dataset archive: `data/Yelp-JSON.zip`
- (Optional) Photos archive: `data/Yelp-Photos.zip`

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
