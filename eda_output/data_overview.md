# Yelp Open Dataset — Data Overview

- Generated: 2026-01-22 00:32
- Data dir: `data/yelp_extracted/yelp_json`
- Profiling sample rows per file: 20,000

## Files
| dataset | rows_total | size | path |
|---|---:|---:|---|
| `business` | 150,346 | 113.4 MiB | `data/yelp_extracted/yelp_json/yelp_academic_dataset_business.json` |
| `checkin` | 131,930 | 273.7 MiB | `data/yelp_extracted/yelp_json/yelp_academic_dataset_checkin.json` |
| `review` | 6,990,280 | 5.0 GiB | `data/yelp_extracted/yelp_json/yelp_academic_dataset_review.json` |
| `tip` | 908,915 | 172.2 MiB | `data/yelp_extracted/yelp_json/yelp_academic_dataset_tip.json` |
| `user` | 1,987,897 | 3.1 GiB | `data/yelp_extracted/yelp_json/yelp_academic_dataset_user.json` |

## Schemas
Schema CSVs (useful for process book / documentation):
- `eda_output/schema_business.csv`
- `eda_output/schema_checkin.csv`
- `eda_output/schema_review.csv`
- `eda_output/schema_tip.csv`
- `eda_output/schema_user.csv`

## Nested Key Tables
- `eda_output/business.attributes_keys.csv`
- `eda_output/business.hours_keys.csv`

## `business`

- File: `data/yelp_extracted/yelp_json/yelp_academic_dataset_business.json`
- Size: 113.4 MiB
- Rows (total): 150,346
- Rows (profiled): 20,000
- Note: `categories` is a comma-separated string of category names.
- Note: `attributes` is a dict of string→string flags/values (varies by business).
- Note: `hours` is a dict day→opening-hours string (may be missing).

### Nested keys (sample)
- `business.attributes_keys.csv` (top 20 shown below)
  - `BusinessAcceptsCreditCards`: 15,954
  - `BusinessParking`: 12,150
  - `RestaurantsPriceRange2`: 11,411
  - `BikeParking`: 9,753
  - `RestaurantsTakeOut`: 8,007
  - `WiFi`: 7,623
  - `RestaurantsDelivery`: 7,528
  - `GoodForKids`: 7,205
  - `OutdoorSeating`: 6,488
  - `RestaurantsReservations`: 6,065
  - `HasTV`: 6,026
  - `Ambience`: 5,943
  - `RestaurantsGoodForGroups`: 5,929
  - `Alcohol`: 5,761
  - `ByAppointmentOnly`: 5,662
  - `Caters`: 5,411
  - `RestaurantsAttire`: 5,266
  - `NoiseLevel`: 5,097
  - `GoodForMeal`: 3,918
  - `WheelchairAccessible`: 3,860
- `business.hours_keys.csv` (top 20 shown below)
  - `Thursday`: 16,663
  - `Friday`: 16,628
  - `Wednesday`: 16,466
  - `Tuesday`: 16,057
  - `Monday`: 15,292
  - `Saturday`: 14,768
  - `Sunday`: 10,837

| field | present% (sample) | types (sample) | example |
|---|---:|---|---|
| `address` | 100.0% | str:20000 | '1616 Chapala St, Ste 2' |
| `attributes` | 100.0% | dict:18198, null:1802 | {'ByAppointmentOnly': 'True'} |
| `business_id` | 100.0% | str:20000 | 'Pns2l4eNsfO8kk83dixA6A' |
| `categories` | 100.0% | str:19985, null:15 | 'Doctors, Traditional Chinese Medicine, Naturopathic/Holistic, Acupuncture, Health & Medical, Nutritionists' |
| `city` | 100.0% | str:20000 | 'Santa Barbara' |
| `hours` | 100.0% | dict:16927, null:3073 | {'Monday': '0:0-0:0', 'Tuesday': '8:0-18:30', 'Wednesday': '8:0-18:30', 'Thursday': '8:0-18:30', 'Friday': '8:0-18:30',… |
| `is_open` | 100.0% | int:20000 | 0 |
| `latitude` | 100.0% | float:20000 | 34.4266787 |
| `longitude` | 100.0% | float:20000 | -119.7111968 |
| `name` | 100.0% | str:20000 | 'Abby Rappoport, LAC, CMQ' |
| `postal_code` | 100.0% | str:20000 | '93101' |
| `review_count` | 100.0% | int:20000 | 7 |
| `stars` | 100.0% | float:20000 | 5.0 |
| `state` | 100.0% | str:20000 | 'CA' |

## `checkin`

- File: `data/yelp_extracted/yelp_json/yelp_academic_dataset_checkin.json`
- Size: 273.7 MiB
- Rows (total): 131,930
- Rows (profiled): 20,000
- Note: `date` is a comma-separated list of ISO timestamps (local time).

| field | present% (sample) | types (sample) | example |
|---|---:|---|---|
| `business_id` | 100.0% | str:20000 | '---kPU91CF4Lq2-WlRu9Lw' |
| `date` | 100.0% | str:20000 | '2020-03-13 21:10:56, 2020-06-02 22:18:06, 2020-07-24 22:42:27, 2020-10-24 21:36:13, 2020-12-09 21:23:33, 2021-01-20 17… |

## `review`

- File: `data/yelp_extracted/yelp_json/yelp_academic_dataset_review.json`
- Size: 5.0 GiB
- Rows (total): 6,990,280
- Rows (profiled): 20,000
- Note: `text` can be long; consider sampling for heavy analysis.

| field | present% (sample) | types (sample) | example |
|---|---:|---|---|
| `business_id` | 100.0% | str:20000 | 'XQfwVwDr-v0ZS3_CbbE5Xw' |
| `cool` | 100.0% | int:20000 | 0 |
| `date` | 100.0% | str:20000 | '2018-07-07 22:09:11' |
| `funny` | 100.0% | int:20000 | 0 |
| `review_id` | 100.0% | str:20000 | 'KU_O5udG6zpxOg-VcAEodg' |
| `stars` | 100.0% | float:20000 | 3.0 |
| `text` | 100.0% | str:20000 | "If you decide to eat here, just be aware it is going to take about 2 hours from beginning to end. We have tried it mul… |
| `useful` | 100.0% | int:20000 | 0 |
| `user_id` | 100.0% | str:20000 | 'mh_-eMZ6K5RLWhZyISBhwA' |

## `tip`

- File: `data/yelp_extracted/yelp_json/yelp_academic_dataset_tip.json`
- Size: 172.2 MiB
- Rows (total): 908,915
- Rows (profiled): 20,000

| field | present% (sample) | types (sample) | example |
|---|---:|---|---|
| `business_id` | 100.0% | str:20000 | '3uLgwr0qeCNMjKenHJwPGQ' |
| `compliment_count` | 100.0% | int:20000 | 0 |
| `date` | 100.0% | str:20000 | '2012-05-18 02:17:21' |
| `text` | 100.0% | str:20000 | 'Avengers time with the ladies.' |
| `user_id` | 100.0% | str:20000 | 'AGNUgVwnZUey3gcPCJ76iw' |

## `user`

- File: `data/yelp_extracted/yelp_json/yelp_academic_dataset_user.json`
- Size: 3.1 GiB
- Rows (total): 1,987,897
- Rows (profiled): 20,000
- Note: `friends` is a comma-separated list of user IDs.
- Note: `elite` is a comma-separated list of years.

| field | present% (sample) | types (sample) | example |
|---|---:|---|---|
| `average_stars` | 100.0% | float:20000 | 3.91 |
| `compliment_cool` | 100.0% | int:20000 | 467 |
| `compliment_cute` | 100.0% | int:20000 | 56 |
| `compliment_funny` | 100.0% | int:20000 | 467 |
| `compliment_hot` | 100.0% | int:20000 | 250 |
| `compliment_list` | 100.0% | int:20000 | 18 |
| `compliment_more` | 100.0% | int:20000 | 65 |
| `compliment_note` | 100.0% | int:20000 | 232 |
| `compliment_photos` | 100.0% | int:20000 | 180 |
| `compliment_plain` | 100.0% | int:20000 | 844 |
| `compliment_profile` | 100.0% | int:20000 | 55 |
| `compliment_writer` | 100.0% | int:20000 | 239 |
| `cool` | 100.0% | int:20000 | 5994 |
| `elite` | 100.0% | str:20000 | '2007' |
| `fans` | 100.0% | int:20000 | 267 |
| `friends` | 100.0% | str:20000 | 'NSCy54eWehBJyZdG2iE84w, pe42u7DcCH2QmI81NX-8qA, EjlCGf14tYMPJ0rsrL703w, 7OagHIAKx2Rm9z3CQ0OmvA, uZoFvKs0dahfffIqHQf1eA… |
| `funny` | 100.0% | int:20000 | 1259 |
| `name` | 100.0% | str:20000 | 'Walker' |
| `review_count` | 100.0% | int:20000 | 585 |
| `useful` | 100.0% | int:20000 | 7217 |
| `user_id` | 100.0% | str:20000 | 'qVc8ODYU5SZjKXVBgXdI7w' |
| `yelping_since` | 100.0% | str:20000 | '2007-01-25 16:47:26' |
