# Week 3 — Figure Question List (Yelp Open Dataset)

This list maps each output figure filename from `scripts/yelp_fancy_figures.py` to the question it answers.

## Businesses (`yelp_academic_dataset_business.json`, filtered by `--state/--city/--category`)

1. `01_business_star_distribution.png` — What is the distribution of business star ratings?
2. `02_business_reviewcount_distribution.png` — What is the distribution of business review counts? (symlog scale)
3. `03_open_vs_closed.png` — What share of businesses are marked open vs closed?
4. `04_reviewcount_vs_stars_hexbin.png` — How do star ratings vary with review count? (hexbin; log x)
5. `05_categories_per_business.png` — How many categories are listed per business?
6. `06_top_categories_by_count.png` — Which categories appear most often? (Top N by business count)
7. `07_top_categories_by_avg_stars.png` — Which categories have the highest average star rating? (≥50 businesses; top N)
8. `08_top_cities.png` — Which cities have the most businesses? (Top N city+state pairs)
9. `09_top_states.png` — Which states/provinces have the most businesses? (Top N by business count)
10. `10_country_distribution.png` — How are businesses split across Canada, the U.S., and other? (from state code)
11. `11_location_density_hexbin.png` — Where are businesses located geographically? (latitude/longitude density)
12. `12_business_missingness.png` — Which key business fields are most often missing?
13. `13_days_open_per_week.png` — How many days per week do businesses report hours? (0–7 days listed)
14. `14_price_range_distribution.png` — What price ranges do restaurants report? (RestaurantsPriceRange2, 1–4)
15. `15_stars_by_price_range_violin.png` — How do star ratings vary by restaurant price range?
16. `16_stars_by_open_status.png` — Do open vs closed businesses differ in star ratings?

## Check-ins (`yelp_academic_dataset_checkin.json`, filtered by selected businesses; skipped with `--no-checkins`)

17. `17_checkins_heatmap.png` — When do check-ins happen? (day-of-week × hour heatmap)
18. `18_checkins_by_day.png` — Which days of the week have the most check-ins?
19. `19_checkins_by_hour.png` — At what hours of the day do check-ins peak?

## Reviews (`yelp_academic_dataset_review.json`, filtered by selected businesses; controlled by `--max-reviews`)

20. `20_reviews_over_time.png` — How has review volume changed over time? (reviews per month)
21. `21_review_star_distribution.png` — What is the distribution of review star ratings?
22. `22_review_length_distribution.png` — How long are reviews? (characters; 99th percentile clipped)
23. `23_review_length_by_stars.png` — How does review length vary by star rating?
24. `24_review_votes_boxplot.png` — How do 'useful', 'funny', and 'cool' votes compare per review?

## Users (`yelp_academic_dataset_user.json`, not business-filterable; controlled by `--max-users`)

25. `25_user_join_years.png` — When did users join Yelp? (join year from yelping_since)
26. `26_user_reviewcount_distribution.png` — What is the distribution of user review counts? (symlog scale)
27. `27_user_fans_distribution.png` — What is the distribution of user fan counts? (symlog scale)
28. `28_user_average_stars_distribution.png` — What is the distribution of users' average star ratings?

## Tips (`yelp_academic_dataset_tip.json`, filtered by selected businesses; controlled by `--max-tips`)

29. `29_tips_over_time.png` — How has tip volume changed over time? (tips per month)
30. `30_tip_compliments_distribution.png` — What is the distribution of tip compliment counts? (symlog scale)

## Photos (optional; controlled by `--max-photos`)

31. `31_photo_label_distribution.png` — What photo labels are present in the dataset? (photo.json)

