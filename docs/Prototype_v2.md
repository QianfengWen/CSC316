# Prototype V2 Interaction Design

## Scope
- Dataset: Yelp academic JSON (real business + review files).
- Target city: Philadelphia (`city == "Philadelphia"` after trim + case normalization).
- Primary goal: help users explore restaurant competition, local density patterns, and in-restaurant dining signals through an interactive 3D spatial experience.
- V2 focus:
  - add a 3D density map for restaurant distribution across Philadelphia
  - enrich the restaurant interior scene with dish storytelling and stronger visual cues for popularity and activity

## Global Controls (Prototype V2)
- `Target city selector`
  - Current V2 behavior: fixed to Philadelphia.
  - Final intent: support additional cities once density aggregates are prepared.
- `Cuisine / category selector`
  - Users can switch between restaurant categories such as Chinese, Japanese, Thai, Middle Eastern, and others.
  - Updates the 3D density map to reflect only the selected cuisine/category.
- `Reset camera`
  - Restores the default 3D viewing angle for the map.
  - Helps users recover orientation after rotating or zooming the scene.

## Implemented Interaction: 3D Restaurant Density Map
- Purpose:
  - show how many restaurants of a selected cuisine/category exist in different areas of Philadelphia
  - help users compare spatial competition patterns across neighborhoods
- Visual encoding:
  - each area is represented as a small 3D mountain or peak
  - `Height` represents restaurant density in that area
  - taller peaks indicate a higher concentration of restaurants
  - shorter peaks indicate lower density
- Category switching:
  - changing the cuisine/category redraws the map using only businesses from that category
  - allows direct comparison of spatial clustering across cuisines
- Camera interaction:
  - users can rotate, pan, and inspect the 3D landscape
  - reset camera returns the scene to a readable default view
- Interpretation goal:
  - users can quickly identify hotspots, underserved areas, and saturated zones for each cuisine type

## Legend / Reading Guide for the 3D Map
- `Height`: average rating or density emphasis depending on the current visualization mode
- `Color`: number of businesses in the area
- `Peaks`: local cuisine hotspots
- Design intent:
  - combine a geographic overview with an intuitive terrain metaphor
  - make density differences immediately visible without reading raw counts

## Implemented Interaction: Restaurant Interior / Kitchen Display
- Purpose:
  - give users a more immersive way to inspect a selected restaurant
  - connect restaurant atmosphere, menu identity, and customer activity in one scene
- Restaurant selector:
  - users choose a restaurant from a dropdown list
  - selection updates the interior scene and the side information panel
- Dish explanation interaction:
  - when users click on a table or on dish pictures placed on the wall, a description panel appears on the side
  - the side panel explains featured dishes from that restaurant
  - this helps users understand what the restaurant is known for beyond raw ratings
- Dynamic table count:
  - the number of tables shown in the restaurant changes based on how many people are coming to the restaurant
  - more customer activity results in more occupied or visible tables
  - this provides a visual cue for restaurant traffic and popularity
- Rating stars:
  - stars hang above each restaurant interior as an immediate quality cue
  - the number of hanging stars matches the restaurant rating level
  - example: a three-star restaurant displays three stars in the top-left area of the scene
- Side information panel:
  - displays the selected restaurant name, cuisine, rating, review count, rank, and menu highlights
  - updates dynamically when the restaurant or dish selection changes

## Restaurant Detail Card / Side Panel
- Trigger:
  - restaurant selection from the dropdown
  - dish-related clicks on tables or wall images
- Current V2 output:
  - restaurant name
  - cuisine/category
  - rating and review count
  - gem rank / score
  - dish title and short explanation
  - ingredient tags
  - menu highlight tags
- Design goal:
  - make the restaurant feel explorable rather than just listed
  - combine summary metrics with storytelling around signature dishes

## Key Improvements from V1 to V2
- V1 emphasized analytical comparison through chart-based views.
- V2 expands the experience into spatial and environmental storytelling.
- Main additions in V2:
  - 3D density map of restaurant distribution across Philadelphia
  - cuisine-based terrain comparison using mountain height
  - interactive dish explanations tied to tables and wall images
  - dynamic table counts based on visitor volume
  - hanging star visuals to represent restaurant ratings directly in the scene

## Experience Flow (V2)
- `Step 1: Explore city competition`
  - choose a cuisine/category
  - inspect the 3D density map to understand where that cuisine is concentrated
- `Step 2: Identify hotspots`
  - compare peaks across areas to find dense clusters and lower-competition zones
- `Step 3: Inspect a restaurant`
  - choose a specific restaurant from the detailed view
  - enter the restaurant interior scene
- `Step 4: Learn through interaction`
  - click tables or dish pictures to reveal explanations of featured dishes
  - observe stars, activity level, and menu cues to understand restaurant appeal
- `Step 5: Compare opportunity and experience`
  - combine geographic competition signals with restaurant-level storytelling

## Design Intent
- Make restaurant analytics more visual, intuitive, and engaging.
- Replace purely abstract comparison with a mixed experience:
  - city-scale spatial analysis
  - restaurant-scale interactive storytelling
- Help users answer two questions in one flow:
  - Where are restaurants of this type concentrated in Philadelphia?
  - What makes a selected restaurant appealing once users look inside?

## Future Extensions
- Add neighborhood labels directly onto the 3D map.
- Add hover tooltips for exact density counts by area.
- Let users filter by rating threshold, price range, or review count.
- Connect the 3D map to the restaurant interior view through direct click selection.
- Add dish popularity and sentiment summaries from review text.
- Animate customer flow over time to show peak restaurant activity periods.
