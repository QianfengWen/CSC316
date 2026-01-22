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
- Images: `eda_output/`
- Chart list + titles: `eda_output/manifest.md`

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
- Report: `eda_output/data_overview.md`
- Schemas: `eda_output/schema_*.csv`
