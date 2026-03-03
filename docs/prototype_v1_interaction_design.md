# Prototype V1 Interaction Design

## Scope
- Dataset: Yelp academic JSON (real business + review files).
- Target city: Philadelphia (`city == "Philadelphia"` after trim + case normalization).
- Primary goal: help an entrepreneur compare cuisine category tradeoffs in a single narrative flow.

## Global Controls (Prototype V1)
- `Target city selector`
  - Current V1 behavior: fixed to Philadelphia.
  - Final intent: city switch when adding additional city aggregates.
- `Min total reviews slider`
  - Filters out categories with weak review evidence.
  - Active in V1 and triggers chart redraw.
- `Top N categories slider`
  - Performance and readability control.
  - Active in V1 and triggers chart redraw.

## Implemented Interaction: Market Landscape Scatter
- `Hover`: tooltip with category name, business count, trimmed mean stars, total reviews, and polarization index.
- `Click`: persistent selection of one category.
- `Selection effect`: clicked category is highlighted and updates the Category Tradeoff Card.
- `Designed for final`: rectangular brush over scatter to subset the Risk Rope categories (not implemented yet in V1).

## Implemented Interaction: Novel Risk Rope
- `Hover`: tooltip with q25/median/q75 review stars, low/high review shares, volatility.
- `Click`: same selection state as scatter (bidirectional linking).
- `Selection effect`: selected rope is highlighted and synchronized with scatter highlight + category card.

## Category Tradeoff Card
- Trigger: click selection in either implemented visualization.
- Current V1 output:
  - one-sentence opportunity summary
  - key metrics list (competition, demand, robust rating, quantiles, low/high shares)
- Final target:
  - include representative praise/complaint topic summaries from review text modeling.

## Rough Draft Interactions (Planned)
- `Draft A: Mean vs Trimmed Mean Slopegraph`
  - Hover a category line to show rank delta.
  - Click to pin category across all views.
- `Draft B: Cuisine Supply Leaderboard`
  - Click on bar to broadcast selected category.
  - Sort toggle by `business_count`, `trimmed_mean_stars`, `polarization_index`.
- `Draft C: Opportunity Mixer` (novel candidate)
  - Sliders for: avoid competition, prefer high robust ratings, avoid risk, prefer demand.
  - Weighted score updates ranked shortlist instantly.

## Sketch Notes (text-only placeholders)
- Layout is sectioned scrollytelling:
  - Hook -> Landscape -> Robustness -> Risk -> Action.
- Left-side panel remains sticky to preserve control context.
- Two implemented charts are central; draft views are placeholder cards with intended interaction notes.
