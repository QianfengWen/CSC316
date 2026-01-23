# Week 3 — Yelp exploratory figures

## Context
- Businesses selected: 150,346
- Filters: states=∅, cities=∅, category substrings=∅
- Check-ins counted: 13,356,875
- Reviews counted: 6,990,280 (all)
- Users counted: 1,987,897 (all)
- Tips counted: 908,915 (all)

## Figures
- `01_business_star_distribution.png` — What is the distribution of business star ratings?
- `02_business_reviewcount_distribution.png` — What is the distribution of business review counts? (symlog scale)
- `03_open_vs_closed.png` — What share of businesses are marked open vs closed?
- `04_reviewcount_vs_stars_hexbin.png` — How do star ratings vary with review count? (hexbin; log x)
- `05_categories_per_business.png` — How many categories are listed per business?
- `06_top_categories_by_count.png` — Which categories appear most often? (Top 20 by business count)
- `07_top_categories_by_avg_stars.png` — Which categories have the highest average star rating? (≥50 businesses; top 20) (filtered to categories with ≥50 businesses)
- `08_top_cities.png` — Which cities have the most businesses? (Top 20 city+state pairs)
- `09_top_states.png` — Which states/provinces have the most businesses? (Top 20 by business count)
- `10_country_distribution.png` — How are businesses split across Canada, the U.S., and other? (from state code)
- `11_location_density_hexbin.png` — Where are businesses located geographically? (latitude/longitude density) (hexbin over lat/long)
- `12_business_missingness.png` — Which key business fields are most often missing?
- `13_days_open_per_week.png` — How many days per week do businesses report hours? (0–7 days listed) (0 = missing `hours`)
- `14_price_range_distribution.png` — What price ranges do restaurants report? (RestaurantsPriceRange2, 1–4) (85,280 businesses with price range)
- `15_stars_by_price_range_violin.png` — How do star ratings vary by restaurant price range?
- `16_stars_by_open_status.png` — Do open vs closed businesses differ in star ratings?
- `17_checkins_heatmap.png` — When do check-ins happen? (day-of-week × hour heatmap) (13,356,875 check-ins (filtered))
- `18_checkins_by_day.png` — Which days of the week have the most check-ins?
- `19_checkins_by_hour.png` — At what hours of the day do check-ins peak?
- `20_reviews_over_time.png` — How has review volume changed over time? (reviews per month) (6,990,280 reviews (filtered; all))
- `21_review_star_distribution.png` — What is the distribution of review star ratings?
- `22_review_length_distribution.png` — How long are reviews? (characters; 99th percentile clipped) (clipped at p99=2,643 chars)
- `23_review_length_by_stars.png` — How does review length vary by star rating?
- `24_review_votes_boxplot.png` — How do 'useful', 'funny', and 'cool' votes compare per review? (clipped at p99.5=16 votes)
- `29_tips_over_time.png` — How has tip volume changed over time? (tips per month) (908,915 tips (all))
- `30_tip_compliments_distribution.png` — What is the distribution of tip compliment counts? (symlog scale)
- `25_user_join_years.png` — When did users join Yelp? (join year from yelping_since) (1,987,897 users (all))
- `26_user_reviewcount_distribution.png` — What is the distribution of user review counts? (symlog scale)
- `27_user_fans_distribution.png` — What is the distribution of user fan counts? (symlog scale)
- `28_user_average_stars_distribution.png` — What is the distribution of users' average star ratings?
