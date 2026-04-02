/* ============================================================
   Leaflet Map — Philadelphia Restaurant Explorer
   Optimized for deferred startup and lighter interaction cost.
   ============================================================ */

(function () {
  "use strict";

  var PHILLY_CENTER = [39.9526, -75.1652];
  var TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  var CUISINE_COLORS = {
    "Pizza": "#e85c4a",
    "Burgers": "#c94430",
    "Italian": "#d4763a",
    "Chinese": "#c44d6e",
    "Mexican": "#e8a838",
    "Japanese": "#5a9fd4",
    "Thai": "#7b5ea7",
    "Indian": "#d48a3a",
    "Korean": "#4a8a6e",
    "Vietnamese": "#6aa84f",
    "Ethiopian": "#2ecc71",
    "Mediterranean": "#1abc9c",
    "Seafood": "#3498db",
    "American (New)": "#95a5a6",
    "American (Traditional)": "#7f8c8d",
    "Cheesesteaks": "#e67e22",
    "Vegan": "#27ae60",
    "Vegetarian": "#2ecc71",
    "Soul Food": "#8e44ad",
    "Asian Fusion": "#5b8cbe",
    "Sushi Bars": "#4aa3df",
    "Indonesian": "#16a085",
    "Polish": "#c0392b",
    "Taiwanese": "#2980b9",
    "Salvadoran": "#f39c12",
    "French": "#9b59b6",
    "Ramen": "#e74c3c",
    "Dim Sum": "#d35400",
    "Halal": "#27ae60",
    "Caribbean": "#f1c40f",
    "Turkish": "#e74c3c",
    "Cuban": "#e67e22",
    "Filipino": "#3498db",
    "Moroccan": "#e74c3c",
  };

  var GEM_CUISINES = [
    "Ethiopian", "Indonesian", "Polish", "Taiwanese", "Salvadoran",
    "Vegan", "Ramen", "French", "Korean", "Vietnamese",
    "Moroccan", "Afghan", "Colombian", "Cuban", "Filipino", "Portuguese",
  ];

  var TOP_FILTER_CUISINES = [
    "Pizza", "Burgers", "Italian", "Chinese", "Mexican",
    "Japanese", "Ethiopian", "Korean", "Vietnamese", "Seafood", "Thai", "Indian",
  ];

  var perfUtils = window.PerfUtils || {};
  var createRestaurantIndex = perfUtils.createRestaurantIndex || function (restaurants, isGemFn) {
    return (restaurants || []).filter(function (restaurant) {
      return restaurant && restaurant.lat !== null && restaurant.lng !== null &&
        restaurant.lat !== "" && restaurant.lng !== "" &&
        isFinite(Number(restaurant.lat)) && isFinite(Number(restaurant.lng));
    }).map(function (restaurant, index) {
      var cuisines = Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(" ") : "";
      return {
        id: index,
        data: restaurant,
        isGem: !!isGemFn(restaurant),
        searchText: String([
          restaurant.name,
          cuisines,
          restaurant.categories,
        ].join(" ")).toLowerCase(),
      };
    });
  };
  var filterRestaurantIndex = perfUtils.filterRestaurantIndex || function (indexedRestaurants, activeFilter, searchTerm) {
    var query = String(searchTerm || "").toLowerCase().trim();
    return (indexedRestaurants || []).filter(function (entry) {
      var cuisines = Array.isArray(entry.data.cuisines) ? entry.data.cuisines : [];
      var passesFilter = activeFilter === "All" || !activeFilter;
      if (activeFilter === "Hidden Gems") {
        passesFilter = entry.isGem;
      } else if (activeFilter && activeFilter !== "All") {
        passesFilter = cuisines.indexOf(activeFilter) !== -1;
      }
      return passesFilter && (!query || entry.searchText.indexOf(query) !== -1);
    });
  };
  var observeOnceWhenVisible = perfUtils.observeOnceWhenVisible || function (element, callback) {
    if (!element || typeof callback !== "function") return;
    if (typeof window.IntersectionObserver !== "function") {
      callback();
      return;
    }
    var fired = false;
    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!fired && entry.isIntersecting) {
          fired = true;
          observer.disconnect();
          callback();
        }
      });
    });
    observer.observe(element);
  };

  function getGemCuisines() {
    if (window.__gemDefinition && window.__gemDefinition.gem_cuisines) {
      return window.__gemDefinition.gem_cuisines;
    }
    return GEM_CUISINES;
  }

  function getCuisineColor(cuisines) {
    for (var i = 0; i < cuisines.length; i++) {
      if (CUISINE_COLORS[cuisines[i]]) return CUISINE_COLORS[cuisines[i]];
    }
    return "#95a5a6";
  }

  function isGemRestaurant(restaurant) {
    var gems = getGemCuisines();
    return (restaurant.cuisines || []).some(function (cuisine) {
      return gems.indexOf(cuisine) !== -1;
    });
  }

  function animateNumber(el, target, decimals, duration) {
    decimals = decimals || 0;
    duration = duration || 600;
    if (!el) return;

    var current = parseFloat(el.textContent.replace(/,/g, "")) || 0;
    if (Math.abs(current - target) < 0.001) {
      el.textContent = decimals === 0 ? Math.round(target).toLocaleString() : target.toFixed(decimals);
      return;
    }

    var start = performance.now();
    function step(ts) {
      var progress = Math.min((ts - start) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      var value = current + (target - current) * ease;
      el.textContent = decimals === 0 ? Math.round(value).toLocaleString() : value.toFixed(decimals);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function injectPulseCSS() {
    if (document.getElementById("map-pulse-css")) return;
    var style = document.createElement("style");
    style.id = "map-pulse-css";
    style.textContent = [
      ".map-filter-count {",
      "  display: inline-block;",
      "  background: #fff;",
      "  color: #d4503a;",
      "  font-size: 0.65rem;",
      "  font-weight: 800;",
      "  padding: 1px 6px;",
      "  border-radius: 10px;",
      "  margin-left: 4px;",
      "  line-height: 1.3;",
      "}",
      ".filter-btn.gem-filter.active {",
      "  background: #3a8c5c;",
      "  border-color: #3a8c5c;",
      "}",
      ".map-no-results {",
      "  position: absolute;",
      "  top: 50%; left: 50%;",
      "  transform: translate(-50%, -50%);",
      "  background: rgba(26,20,16,0.85);",
      "  color: #faf6f0;",
      "  padding: 16px 28px;",
      "  border-radius: 12px;",
      "  font-size: 0.9rem;",
      "  font-weight: 600;",
      "  z-index: 800;",
      "  pointer-events: none;",
      "  transition: opacity 0.3s;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildPopupHtml(restaurant, isGem) {
    var stars = "";
    for (var i = 0; i < 5; i++) {
      if (i < Math.floor(restaurant.stars)) {
        stars += "<span style='color:#e8a838;'>&#9733;</span>";
      } else if (i < restaurant.stars) {
        stars += "<span style='color:#e8a838;'>&#9734;</span>";
      } else {
        stars += "<span style='color:#d4cfc5;'>&#9734;</span>";
      }
    }

    var cuisineList = restaurant.cuisines && restaurant.cuisines.length > 0
      ? restaurant.cuisines.slice(0, 4).join(", ")
      : String(restaurant.categories || "").split(",").slice(0, 3).join(", ");

    return "<div style='font-family:Inter,sans-serif; min-width:180px; line-height:1.5;'>" +
      "<strong style='font-size:14px;'>" + restaurant.name + "</strong><br/>" +
      "<span style='font-size:13px;'>" + stars + "</span>" +
      " <span style='font-weight:700; color:#e8a838;'>" + restaurant.stars + "</span>" +
      " &middot; " + restaurant.review_count.toLocaleString() + " reviews<br/>" +
      "<span style='color:#7a6e5f; font-size:12px;'>" + cuisineList + "</span>" +
      (isGem
        ? "<br/><span style='display:inline-block; margin-top:4px; background:#f0c040; color:#1a1410; font-size:10px; font-weight:800; padding:2px 10px; border-radius:8px;'>HIDDEN GEM</span>"
        : "") +
      "</div>";
  }

  Promise.all([
    d3.json("data/philly_restaurants.json"),
    d3.json("data/philly_cuisines.json"),
  ]).then(function (results) {
    var restaurants = results[0];
    injectPulseCSS();

    var indexedRestaurants = createRestaurantIndex(restaurants, isGemRestaurant);
    var mapSection = document.getElementById("section-map");
    var activeView = "dots";
    var activeFilter = "All";
    var searchTerm = "";
    var map = null;
    var dotRenderer = null;
    var dotLayer = null;
    var heatLayer = null;
    var clusterGroup = null;
    var noResultsEl = null;
    var tourPlayed = false;
    var mapInitialized = false;
    var dotRenderToken = 0;

    buildFilterButtons();
    setupViewToggles();
    setupSearch();

    observeOnceWhenVisible(mapSection, ensureMapInitialized, {
      rootMargin: "320px 0px",
      threshold: 0.05,
    });

    function ensureMapInitialized() {
      if (mapInitialized) return;
      mapInitialized = true;

      map = L.map("philly-map", {
        preferCanvas: true,
        scrollWheelZoom: false,
        zoomControl: true,
        zoomSnap: 0.5,
      }).setView(PHILLY_CENTER, 12);

      dotRenderer = L.canvas({ padding: 0.5 });
      dotLayer = L.layerGroup();

      L.tileLayer(TILE_URL, {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 18,
      }).addTo(map);

      renderView(false);
      setupMapTour();

      requestAnimationFrame(function () { map.invalidateSize(); });
      setTimeout(function () { map.invalidateSize(); }, 250);
      setTimeout(function () { map.invalidateSize(); }, 1000);
    }

    function refreshGemFlags() {
      indexedRestaurants.forEach(function (entry) {
        var nextValue = isGemRestaurant(entry.data);
        if (entry.isGem === nextValue) return;
        entry.isGem = nextValue;
        if (entry.dotMarker) {
          applyDotMarkerStyle(entry.dotMarker, entry);
          entry.dotMarker.setPopupContent(buildPopupHtml(entry.data, entry.isGem));
        }
      });
    }

    function applyDotMarkerStyle(marker, entry) {
      var color = getCuisineColor(entry.data.cuisines || []);
      marker.setStyle({
        radius: entry.isGem ? 4.5 : 3,
        fillColor: color,
        color: entry.isGem ? "#f0c040" : "#fff",
        weight: entry.isGem ? 1.25 : 0.5,
        opacity: 0.9,
        fillOpacity: entry.isGem ? 0.8 : 0.45,
      });
    }

    function getDotMarker(entry) {
      if (entry.dotMarker) {
        applyDotMarkerStyle(entry.dotMarker, entry);
        return entry.dotMarker;
      }

      var marker = L.circleMarker([entry.data.lat, entry.data.lng], {
        renderer: dotRenderer,
        bubblingMouseEvents: false,
      });
      applyDotMarkerStyle(marker, entry);
      marker.bindPopup(buildPopupHtml(entry.data, entry.isGem), { maxWidth: 260 });
      entry.dotMarker = marker;
      return marker;
    }

    function getFilteredEntries() {
      refreshGemFlags();
      return filterRestaurantIndex(indexedRestaurants, activeFilter, searchTerm);
    }

    function clearAllLayers() {
      dotRenderToken += 1;

      if (dotLayer) {
        dotLayer.clearLayers();
      }
      if (heatLayer && map && map.hasLayer(heatLayer)) {
        map.removeLayer(heatLayer);
      }
      if (clusterGroup && map && map.hasLayer(clusterGroup)) {
        map.removeLayer(clusterGroup);
      }

      heatLayer = null;
      clusterGroup = null;
      hideNoResults();
    }

    function renderView(animate) {
      if (!mapInitialized) return;

      clearAllLayers();

      var filteredEntries = getFilteredEntries();
      var filteredData = filteredEntries.map(function (entry) { return entry.data; });

      if (filteredData.length === 0) {
        showNoResults();
        updateStats([]);
        updateMiniBarChart([]);
        updateFilterBadges([]);
        return;
      }

      if (activeView === "dots") {
        renderDots(filteredEntries, animate);
      } else if (activeView === "heat") {
        renderHeat(filteredData);
      } else if (activeView === "clusters") {
        renderClusters(filteredEntries);
      }

      updateStats(filteredData);
      updateMiniBarChart(filteredData);
      updateFilterBadges(filteredData);
    }

    function renderDots(entries) {
      if (!map.hasLayer(dotLayer)) {
        dotLayer.addTo(map);
      }

      var renderToken = ++dotRenderToken;
      var batchSize = entries.length > 1500 ? 450 : 300;
      var cursor = 0;

      function addBatch() {
        if (renderToken !== dotRenderToken || activeView !== "dots") return;

        var limit = Math.min(cursor + batchSize, entries.length);
        for (; cursor < limit; cursor++) {
          dotLayer.addLayer(getDotMarker(entries[cursor]));
        }

        if (cursor < entries.length) {
          requestAnimationFrame(addBatch);
        }
      }

      requestAnimationFrame(addBatch);
    }

    function buildHeatLayer(data) {
      return L.heatLayer(data.map(function (restaurant) {
        return [restaurant.lat, restaurant.lng, 0.6];
      }), {
        radius: 18,
        blur: 22,
        maxZoom: 15,
        gradient: {
          0.2: "#3a8c5c",
          0.4: "#e8a838",
          0.6: "#d4503a",
          0.8: "#c94430",
          1.0: "#8b0000",
        },
      });
    }

    function renderHeat(data) {
      heatLayer = buildHeatLayer(data);
      heatLayer.addTo(map);
    }

    function buildClusterGroup(entries) {
      var group = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: function (cluster) {
          var count = cluster.getChildCount();
          var size = count < 20 ? "small" : count < 100 ? "medium" : "large";
          var px = size === "small" ? 36 : size === "medium" ? 44 : 54;
          return L.divIcon({
            html: "<div style='" +
              "display:flex; align-items:center; justify-content:center; " +
              "width:" + px + "px; height:" + px + "px; " +
              "border-radius:50%; " +
              "background:rgba(212,80,58,0.8); " +
              "color:#fff; font-weight:700; font-size:" + (size === "large" ? "14" : "12") + "px; " +
              "box-shadow: 0 2px 8px rgba(0,0,0,0.3); " +
              "border: 2px solid rgba(255,255,255,0.6);" +
              "'>" + count + "</div>",
            className: "",
            iconSize: L.point(px, px),
          });
        },
      });

      entries.forEach(function (entry) {
        var marker = L.marker([entry.data.lat, entry.data.lng]);
        marker.bindPopup(buildPopupHtml(entry.data, entry.isGem), { maxWidth: 260 });
        group.addLayer(marker);
      });

      return group;
    }

    function renderClusters(entries) {
      clusterGroup = buildClusterGroup(entries);
      map.addLayer(clusterGroup);
    }

    function showNoResults() {
      if (!noResultsEl) {
        noResultsEl = document.createElement("div");
        noResultsEl.className = "map-no-results";
        document.getElementById("philly-map").appendChild(noResultsEl);
      }
      noResultsEl.textContent = "No restaurants match your search.";
      noResultsEl.style.opacity = "1";
      noResultsEl.style.display = "block";
    }

    function hideNoResults() {
      if (!noResultsEl) return;
      noResultsEl.style.opacity = "0";
      setTimeout(function () {
        if (noResultsEl) noResultsEl.style.display = "none";
      }, 300);
    }

    function updateStats(data) {
      var totalEl = document.querySelector("#stat-total .stat-number");
      var cuisinesEl = document.querySelector("#stat-cuisines .stat-number");
      var avgEl = document.querySelector("#stat-avg-rating .stat-number");
      var gemsEl = document.querySelector("#stat-gems .stat-number");
      var cuisineSet = {};
      var total = data.length;
      var sumStars = 0;
      var gemCount = 0;

      data.forEach(function (restaurant) {
        sumStars += restaurant.stars;
        (restaurant.cuisines || []).forEach(function (cuisine) {
          cuisineSet[cuisine] = true;
        });
        if (isGemRestaurant(restaurant)) {
          gemCount += 1;
        }
      });

      animateNumber(totalEl, total, 0);
      animateNumber(cuisinesEl, Object.keys(cuisineSet).length, 0);
      animateNumber(avgEl, total > 0 ? sumStars / total : 0, 1);
      animateNumber(gemsEl, gemCount, 0);
    }

    function updateMiniBarChart(data) {
      var container = d3.select("#mini-bar-chart");
      container.selectAll("*").remove();
      if (data.length === 0) return;

      var counts = {};
      data.forEach(function (restaurant) {
        (restaurant.cuisines || []).forEach(function (cuisine) {
          counts[cuisine] = (counts[cuisine] || 0) + 1;
        });
      });

      var sorted = Object.keys(counts).map(function (cuisine) {
        return { cuisine: cuisine, count: counts[cuisine] };
      }).sort(function (a, b) {
        return b.count - a.count;
      }).slice(0, 5);

      if (sorted.length === 0) return;

      var barHeight = 18;
      var gap = 4;
      var labelWidth = 75;
      var totalWidth = 210;
      var barAreaWidth = totalWidth - labelWidth - 30;
      var svgHeight = sorted.length * (barHeight + gap);
      var maxValue = sorted[0].count;

      var svg = container.append("svg")
        .attr("width", totalWidth)
        .attr("height", svgHeight)
        .style("display", "block");

      sorted.forEach(function (item, index) {
        var y = index * (barHeight + gap);
        var barWidth = (item.count / maxValue) * barAreaWidth;
        var color = CUISINE_COLORS[item.cuisine] || "#95a5a6";

        svg.append("text")
          .attr("x", labelWidth - 4)
          .attr("y", y + barHeight / 2 + 4)
          .attr("text-anchor", "end")
          .style("font-size", "10px")
          .style("font-weight", "600")
          .attr("fill", "#2c2418")
          .text(item.cuisine.length > 12 ? item.cuisine.substring(0, 11) + "..." : item.cuisine);

        svg.append("rect")
          .attr("x", labelWidth)
          .attr("y", y)
          .attr("width", barAreaWidth)
          .attr("height", barHeight)
          .attr("rx", 3)
          .attr("fill", "#f0ebe3");

        svg.append("rect")
          .attr("x", labelWidth)
          .attr("y", y)
          .attr("width", 0)
          .attr("height", barHeight)
          .attr("rx", 3)
          .attr("fill", color)
          .attr("opacity", 0.75)
          .transition()
          .duration(350)
          .delay(index * 30)
          .attr("width", barWidth);

        svg.append("text")
          .attr("x", labelWidth + barAreaWidth + 4)
          .attr("y", y + barHeight / 2 + 4)
          .style("font-size", "10px")
          .style("font-weight", "700")
          .attr("fill", "#2c2418")
          .text(item.count);
      });
    }

    function buildFilterButtons() {
      var filtersDiv = document.getElementById("map-filters");
      if (!filtersDiv) return;

      filtersDiv.innerHTML = "";
      ["All", "Hidden Gems"].concat(TOP_FILTER_CUISINES).forEach(function (label) {
        var btn = document.createElement("button");
        btn.className = "filter-btn" + (label === "All" ? " active" : "");
        if (label === "Hidden Gems") btn.className += " gem-filter";
        btn.setAttribute("data-filter", label);

        var textSpan = document.createElement("span");
        textSpan.textContent = label;
        btn.appendChild(textSpan);

        var badge = document.createElement("span");
        badge.className = "map-filter-count";
        badge.style.display = "none";
        btn.appendChild(badge);

        btn.addEventListener("click", function () {
          filtersDiv.querySelectorAll(".filter-btn").forEach(function (button) {
            button.classList.remove("active");
          });
          btn.classList.add("active");
          activeFilter = label;
          if (mapInitialized) renderView(false);
        });

        filtersDiv.appendChild(btn);
      });
    }

    function updateFilterBadges(filteredData) {
      var total = filteredData.length;
      document.querySelectorAll("#map-filters .filter-btn").forEach(function (btn) {
        var badge = btn.querySelector(".map-filter-count");
        if (!badge) return;
        if (btn.getAttribute("data-filter") === activeFilter && total > 0) {
          badge.textContent = total.toLocaleString();
          badge.style.display = "inline-block";
        } else {
          badge.style.display = "none";
        }
      });
    }

    function setupViewToggles() {
      document.querySelectorAll(".map-toggle-btn[data-view]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          document.querySelectorAll(".map-toggle-btn[data-view]").forEach(function (button) {
            button.classList.remove("active");
          });
          btn.classList.add("active");
          activeView = btn.getAttribute("data-view");
          if (mapInitialized) renderView(false);
        });
      });
    }

    function setupSearch() {
      var input = document.getElementById("map-search");
      if (!input) return;

      var debounceTimer = null;
      input.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          searchTerm = input.value.trim();
          if (mapInitialized) renderView(false);
        }, 180);
      });
    }

    function setupMapTour() {
      if (!mapSection) return;
      observeOnceWhenVisible(mapSection, function () {
        if (!tourPlayed) {
          tourPlayed = true;
          playTour();
        }
      }, { threshold: 0.3 });
    }

    function playTour() {
      map.setView(PHILLY_CENTER, 14, { animate: true, duration: 1.2 });
      setTimeout(function () {
        map.setView(PHILLY_CENTER, 12, { animate: true, duration: 1.5 });
      }, 1800);
      setTimeout(function () {
        pulseGems();
      }, 3800);
    }

    function pulseGems() {
      var gemEntries = indexedRestaurants.filter(function (entry) {
        return entry.isGem;
      });

      gemEntries.forEach(function (entry) {
        if (!entry.dotMarker || !map.hasLayer(entry.dotMarker)) return;
        entry.dotMarker.setStyle({ radius: 7, fillOpacity: 1, weight: 2.5 });
      });

      setTimeout(function () {
        gemEntries.forEach(function (entry) {
          if (!entry.dotMarker || !map.hasLayer(entry.dotMarker)) return;
          applyDotMarkerStyle(entry.dotMarker, entry);
        });
      }, 1200);
    }
  }).catch(function (err) {
    console.error("Map data load error:", err);
  });
})();
