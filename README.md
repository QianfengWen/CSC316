# CSC316 Final Project: The Entrepreneur's Data-Driven Restaurant Journey

## Overview
The project explores the Philadelphia restaurant scene using the Yelp dataset, providing an interactive interface that bridges geographical mapping with an immersive 3D environment to discover culinary "hidden gems."

## Links
* **Project Website:** https://qianfengwen.github.io/CSC316/
* **Screencast Video:** https://drive.google.com/file/d/16N07wAhkIIGkySYlxvTmRq2CC2sapzUC/view?usp=sharing
* **Presentation Slides:** `presentation.html`

## Code Structure
### Code
* `prototype/index.html` & `prototype/css/style.css`: The main application architecture, UI layout, and custom styling.
* `prototype/js/`: All core interaction, logic, and rendering mechanics.
    * `main.js`: The application entry point and state manager.
    * `map.js`: Logic and event handlers for the 2D geographical map view.
    * `isometric.js` & `terrain.js`: Core 3D logic for generating and rendering the isometric restaurant landscape based on dataset metrics.
    * `reviews.js` & `stats.js`: Modules for parsing specific restaurant data, rendering statistical charts, and displaying user reviews.
    * `three-charts.js`: Custom implementation for rendering data visualizations within the 3D space.
    * `perf-utils.js`: Custom performance monitoring utilities to ensure stable frame rates.
* `scripts/`: A suite of Python data pipelines (`yelp_extract.py`, `yelp_eda.py`, `preprocess_prototype_*.py`) that I wrote to clean, aggregate, and transform the massive raw Yelp dataset into the lightweight JSON formats consumed by the front-end.
* `tests/`: Custom unit tests (`test_perf_utils.js`, `test_preprocess_prototype_v1.py`) for validating data integrity and script performance.

### External Libraries & Assets
* **Three.js**: Used extensively in the `prototype/js` directory to handle WebGL 3D rendering for the isometric views and terrains.
* **Leaflet**: Utilized in `map.js` for rendering the geographical base map tiles.
* **D3.js**: Used for rendering 2D statistical graphs
* **Python Data Science Stack**: `pandas`, `matplotlib`, and `seaborn` were used offline in the `/scripts` directory for Exploratory Data Analysis (EDA) and data wrangling.
* **Dataset**: Yelp Open Dataset

## Interface & Non-Obvious Features

1. **View Toggling (2D to 3D):** Users can seamlessly transition between a traditional 2D map view and the 3D isometric terrain view.
2. **Philadelphia Restaurant Opportunity Terrain:** In this 3D view, the elevation, size, and clustering of the terrain blocks are not random; they are meticulously mapped to underlying dataset attributes. For example, the spatial coordinates strictly correspond to real-world latitude and longitude.
3. **"What Are People Actually Saying?" (Detective Game):** An interactive mini-game where users act as detectives. By reading real reviews from the dataset, users must guess the corresponding star rating, which helps in detecting true customer sentiment.
4. **"Where the Hidden Gems Live" (Investment Game):** A strategic investment simulation where users are given three coins. Users must analyze the data charts provided above and decide how to invest their coins into three different promising cuisines.
5. **"Step Inside a Hidden Gem" (Interactive 3D Interior):** Features a fully draggable and zoomable 3D restaurant interior. Users can directly interact with the environment: clicking on customers reveals real Yelp reviews, clicking on food items displays menu introductions, and switching between different restaurants dynamically changes the interior decor to match the actual real-world style of that establishment.
6. **Performance Metrics:** For grading and debugging purposes, a subtle performance monitor (`perf-utils.js`) runs to track rendering efficiency, especially during complex 3D transitions.


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
