/* ============================================================
   Leaflet Map — Philadelphia Restaurant Explorer
   Three views (Dots/Heatmap/Clusters), smart filters, search,
   animated stats panel, pulsing hidden gems, narrated map tour.
   ============================================================ */

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────

  var PHILLY_CENTER = [39.9526, -75.1652];
  var TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  var CUISINE_COLORS = {
    "Pizza":        "#e85c4a",
    "Burgers":      "#c94430",
    "Italian":      "#d4763a",
    "Chinese":      "#c44d6e",
    "Mexican":      "#e8a838",
    "Japanese":     "#5a9fd4",
    "Thai":         "#7b5ea7",
    "Indian":       "#d48a3a",
    "Korean":       "#4a8a6e",
    "Vietnamese":   "#6aa84f",
    "Ethiopian":    "#2ecc71",
    "Mediterranean":"#1abc9c",
    "Seafood":      "#3498db",
    "American (New)":"#95a5a6",
    "American (Traditional)":"#7f8c8d",
    "Cheesesteaks": "#e67e22",
    "Vegan":        "#27ae60",
    "Vegetarian":   "#2ecc71",
    "Soul Food":    "#8e44ad",
    "Asian Fusion": "#5b8cbe",
    "Sushi Bars":   "#4aa3df",
    "Indonesian":   "#16a085",
    "Polish":       "#c0392b",
    "Taiwanese":    "#2980b9",
    "Salvadoran":   "#f39c12",
    "French":       "#9b59b6",
    "Ramen":        "#e74c3c",
    "Dim Sum":      "#d35400",
    "Halal":        "#27ae60",
    "Caribbean":    "#f1c40f",
    "Turkish":      "#e74c3c",
    "Cuban":        "#e67e22",
    "Filipino":     "#3498db",
    "Moroccan":     "#e74c3c",
  };

  var GEM_CUISINES = [
    "Ethiopian","Indonesian","Polish","Taiwanese","Salvadoran",
    "Vegan","Ramen","French","Korean","Vietnamese",
    "Moroccan","Afghan","Colombian","Cuban","Filipino","Portuguese",
  ];

  // Top cuisines shown as filter buttons (after "All" and "Hidden Gems")
  var TOP_FILTER_CUISINES = [
    "Pizza","Burgers","Italian","Chinese","Mexican",
    "Japanese","Ethiopian","Korean","Vietnamese","Seafood","Thai","Indian",
  ];

  // ── Helpers ────────────────────────────────────────────────

  function getCuisineColor(cuisines) {
    for (var i = 0; i < cuisines.length; i++) {
      if (CUISINE_COLORS[cuisines[i]]) return CUISINE_COLORS[cuisines[i]];
    }
    return "#95a5a6";
  }

  function isGem(restaurant) {
    return restaurant.cuisines.some(function (c) {
      return GEM_CUISINES.indexOf(c) !== -1;
    });
  }

  /** Animate a number element from current to target value */
  function animateNumber(el, target, decimals, duration) {
    decimals = decimals || 0;
    duration = duration || 600;
    var current = parseFloat(el.textContent.replace(/,/g, "")) || 0;
    var start = performance.now();
    function step(ts) {
      var progress = Math.min((ts - start) / duration, 1);
      // ease-out cubic
      var ease = 1 - Math.pow(1 - progress, 3);
      var val = current + (target - current) * ease;
      if (decimals === 0) {
        el.textContent = Math.round(val).toLocaleString();
      } else {
        el.textContent = val.toFixed(decimals);
      }
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /** Inject CSS keyframes for the pulsing hidden-gem animation */
  function injectPulseCSS() {
    if (document.getElementById("map-pulse-css")) return;
    var style = document.createElement("style");
    style.id = "map-pulse-css";
    style.textContent = [
      "@keyframes gem-pulse {",
      "  0%   { box-shadow: 0 0 4px 2px rgba(240,192,64,0.5); }",
      "  50%  { box-shadow: 0 0 14px 6px rgba(240,192,64,0.85); }",
      "  100% { box-shadow: 0 0 4px 2px rgba(240,192,64,0.5); }",
      "}",
      ".leaflet-gem-pulse {",
      "  animation: gem-pulse 2s ease-in-out infinite;",
      "  border-radius: 50%;",
      "}",
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

  // ── Main init ──────────────────────────────────────────────

  Promise.all([
    d3.json("data/philly_restaurants.json"),
    d3.json("data/philly_cuisines.json"),
  ]).then(function (results) {
    var restaurants = results[0];
    var cuisineSummary = results[1];

    injectPulseCSS();

    // Filter out restaurants without coordinates
    restaurants = restaurants.filter(function (d) {
      return d.lat && d.lng;
    });

    // ── Leaflet map setup ──────────────────────────────────

    var map = L.map("philly-map", {
      scrollWheelZoom: false,
      zoomControl: true,
      zoomSnap: 0.5,
    }).setView(PHILLY_CENTER, 12);

    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    // ── State ──────────────────────────────────────────────

    var activeView = "dots";       // "dots" | "heat" | "clusters"
    var activeFilter = "All";
    var searchTerm = "";
    var allDotMarkers = [];        // L.circleMarker instances
    var heatLayer = null;
    var clusterGroup = null;
    var noResultsEl = null;
    var tourPlayed = false;

    // ── Build all dot markers (initially hidden) ───────────

    restaurants.forEach(function (d) {
      var color = getCuisineColor(d.cuisines);
      var gem = isGem(d);
      var marker = L.circleMarker([d.lat, d.lng], {
        radius: gem ? 5 : 3,
        fillColor: color,
        color: gem ? "#f0c040" : "#fff",
        weight: gem ? 1.5 : 0.5,
        opacity: 0.9,
        fillOpacity: gem ? 0.85 : 0.5,
        className: gem ? "leaflet-gem-pulse" : "",
      });

      // Rich popup
      var stars = "";
      for (var s = 0; s < 5; s++) {
        stars += s < Math.floor(d.stars) ? "<span style='color:#e8a838;'>&#9733;</span>"
               : s < d.stars ? "<span style='color:#e8a838;'>&#9734;</span>"
               : "<span style='color:#d4cfc5;'>&#9734;</span>";
      }

      var cuisineList = d.cuisines.length > 0
        ? d.cuisines.slice(0, 4).join(", ")
        : d.categories.split(",").slice(0, 3).join(", ");

      marker.bindPopup(
        "<div style='font-family:Inter,sans-serif; min-width:180px; line-height:1.5;'>" +
          "<strong style='font-size:14px;'>" + d.name + "</strong><br/>" +
          "<span style='font-size:13px;'>" + stars + "</span>" +
          " <span style='font-weight:700; color:#e8a838;'>" + d.stars + "</span>" +
          " &middot; " + d.review_count.toLocaleString() + " reviews<br/>" +
          "<span style='color:#7a6e5f; font-size:12px;'>" + cuisineList + "</span>" +
          (gem
            ? "<br/><span style='display:inline-block; margin-top:4px; background:#f0c040; color:#1a1410; font-size:10px; font-weight:800; padding:2px 10px; border-radius:8px;'>HIDDEN GEM</span>"
            : "") +
        "</div>",
        { maxWidth: 260 }
      );

      marker._data = d;
      marker._isGem = gem;
      allDotMarkers.push(marker);
    });

    // ── Build heatmap layer ────────────────────────────────

    function buildHeatLayer(filteredData) {
      var pts = filteredData.map(function (d) {
        return [d.lat, d.lng, 0.6];
      });
      return L.heatLayer(pts, {
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

    // ── Build cluster layer ────────────────────────────────

    function buildClusterGroup(filteredMarkers) {
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

      filteredMarkers.forEach(function (m) {
        var d = m._data;
        var marker = L.marker([d.lat, d.lng]);
        marker.bindPopup(m.getPopup().getContent(), { maxWidth: 260 });
        group.addLayer(marker);
      });

      return group;
    }

    // ── Get currently filtered dataset ─────────────────────

    function getFilteredMarkers() {
      return allDotMarkers.filter(function (m) {
        var d = m._data;
        var passFilter = true;
        var passSearch = true;

        // Apply cuisine/gem filter
        if (activeFilter === "All") {
          passFilter = true;
        } else if (activeFilter === "Hidden Gems") {
          passFilter = m._isGem;
        } else {
          passFilter = d.cuisines.indexOf(activeFilter) !== -1;
        }

        // Apply search
        if (searchTerm) {
          var q = searchTerm.toLowerCase();
          passSearch = d.name.toLowerCase().indexOf(q) !== -1 ||
            d.cuisines.some(function (c) { return c.toLowerCase().indexOf(q) !== -1; }) ||
            d.categories.toLowerCase().indexOf(q) !== -1;
        }

        return passFilter && passSearch;
      });
    }

    function getFilteredData() {
      return getFilteredMarkers().map(function (m) { return m._data; });
    }

    // ── Clear all layers from map ──────────────────────────

    function clearAllLayers() {
      // Remove dots
      allDotMarkers.forEach(function (m) {
        if (map.hasLayer(m)) map.removeLayer(m);
      });
      // Remove heat
      if (heatLayer && map.hasLayer(heatLayer)) {
        map.removeLayer(heatLayer);
      }
      // Remove clusters
      if (clusterGroup && map.hasLayer(clusterGroup)) {
        map.removeLayer(clusterGroup);
      }
    }

    // ── Render the active view ─────────────────────────────

    function renderView(animate) {
      clearAllLayers();
      hideNoResults();

      var filtered = getFilteredMarkers();
      var filteredData = filtered.map(function (m) { return m._data; });

      if (filteredData.length === 0) {
        showNoResults();
        updateStats([]);
        updateMiniBarChart([]);
        return;
      }

      if (activeView === "dots") {
        renderDots(filtered, animate);
      } else if (activeView === "heat") {
        renderHeat(filteredData);
      } else if (activeView === "clusters") {
        renderClusters(filtered);
      }

      updateStats(filteredData);
      updateMiniBarChart(filteredData);
      updateFilterBadges(filteredData);
    }

    // ── Dots view (staggered entrance) ─────────────────────

    function renderDots(markers, animate) {
      if (animate) {
        // Sort by distance from center for stagger effect
        var sorted = markers.slice().sort(function (a, b) {
          var da = Math.abs(a._data.lat - PHILLY_CENTER[0]) + Math.abs(a._data.lng - PHILLY_CENTER[1]);
          var db = Math.abs(b._data.lat - PHILLY_CENTER[0]) + Math.abs(b._data.lng - PHILLY_CENTER[1]);
          return da - db;
        });

        // Batch add for performance — add in groups of 200
        var batchSize = 200;
        var totalBatches = Math.ceil(sorted.length / batchSize);
        for (var batch = 0; batch < totalBatches; batch++) {
          (function (batchIndex) {
            setTimeout(function () {
              var start = batchIndex * batchSize;
              var end = Math.min(start + batchSize, sorted.length);
              for (var i = start; i < end; i++) {
                var m = sorted[i];
                m.setStyle({ fillOpacity: 0 });
                m.addTo(map);
                // Fade in
                (function (marker, gem) {
                  setTimeout(function () {
                    marker.setStyle({ fillOpacity: gem ? 0.85 : 0.5 });
                  }, 50);
                })(m, m._isGem);
              }
            }, batchIndex * 60);
          })(batch);
        }
      } else {
        markers.forEach(function (m) {
          m.setStyle({
            fillOpacity: m._isGem ? 0.85 : 0.5,
            radius: m._isGem ? 5 : 3,
          });
          m.addTo(map);
        });
      }
    }

    // ── Heatmap view ───────────────────────────────────────

    function renderHeat(data) {
      heatLayer = buildHeatLayer(data);
      heatLayer.addTo(map);
    }

    // ── Clusters view ──────────────────────────────────────

    function renderClusters(markers) {
      clusterGroup = buildClusterGroup(markers);
      map.addLayer(clusterGroup);
    }

    // ── No-results overlay ─────────────────────────────────

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
      if (noResultsEl) {
        noResultsEl.style.opacity = "0";
        setTimeout(function () {
          if (noResultsEl) noResultsEl.style.display = "none";
        }, 300);
      }
    }

    // ── Stats panel ────────────────────────────────────────

    function updateStats(data) {
      var totalEl = document.querySelector("#stat-total .stat-number");
      var cuisinesEl = document.querySelector("#stat-cuisines .stat-number");
      var avgEl = document.querySelector("#stat-avg-rating .stat-number");
      var gemsEl = document.querySelector("#stat-gems .stat-number");

      var total = data.length;
      var cuisineSet = {};
      var sumStars = 0;
      var gemCount = 0;

      data.forEach(function (d) {
        sumStars += d.stars;
        d.cuisines.forEach(function (c) { cuisineSet[c] = true; });
        if (d.cuisines.some(function (c) { return GEM_CUISINES.indexOf(c) !== -1; })) {
          gemCount++;
        }
      });

      var uniqueCuisines = Object.keys(cuisineSet).length;
      var avg = total > 0 ? sumStars / total : 0;

      animateNumber(totalEl, total, 0);
      animateNumber(cuisinesEl, uniqueCuisines, 0);
      animateNumber(avgEl, avg, 1);
      animateNumber(gemsEl, gemCount, 0);
    }

    // ── Mini bar chart (D3) ────────────────────────────────

    function updateMiniBarChart(data) {
      var container = d3.select("#mini-bar-chart");
      container.selectAll("*").remove();

      if (data.length === 0) return;

      // Count cuisines
      var counts = {};
      data.forEach(function (d) {
        d.cuisines.forEach(function (c) {
          counts[c] = (counts[c] || 0) + 1;
        });
      });

      // Top 5
      var sorted = Object.keys(counts)
        .map(function (k) { return { cuisine: k, count: counts[k] }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 5);

      if (sorted.length === 0) return;

      var barHeight = 18;
      var gap = 4;
      var labelW = 75;
      var totalW = 210;
      var barAreaW = totalW - labelW - 30;
      var svgH = sorted.length * (barHeight + gap);

      var maxVal = sorted[0].count;

      var svg = container.append("svg")
        .attr("width", totalW)
        .attr("height", svgH)
        .style("display", "block");

      sorted.forEach(function (d, i) {
        var y = i * (barHeight + gap);
        var barW = (d.count / maxVal) * barAreaW;
        var color = CUISINE_COLORS[d.cuisine] || "#95a5a6";

        // Label
        svg.append("text")
          .attr("x", labelW - 4)
          .attr("y", y + barHeight / 2 + 4)
          .attr("text-anchor", "end")
          .style("font-size", "10px")
          .style("font-weight", "600")
          .attr("fill", "#2c2418")
          .text(d.cuisine.length > 12 ? d.cuisine.substring(0, 11) + "..." : d.cuisine);

        // Bar background
        svg.append("rect")
          .attr("x", labelW)
          .attr("y", y)
          .attr("width", barAreaW)
          .attr("height", barHeight)
          .attr("rx", 3)
          .attr("fill", "#f0ebe3");

        // Bar fill (animated)
        svg.append("rect")
          .attr("x", labelW)
          .attr("y", y)
          .attr("width", 0)
          .attr("height", barHeight)
          .attr("rx", 3)
          .attr("fill", color)
          .attr("opacity", 0.75)
          .transition()
          .duration(500)
          .delay(i * 60)
          .attr("width", barW);

        // Count
        svg.append("text")
          .attr("x", labelW + barAreaW + 4)
          .attr("y", y + barHeight / 2 + 4)
          .style("font-size", "10px")
          .style("font-weight", "700")
          .attr("fill", "#2c2418")
          .text(d.count);
      });
    }

    // ── Filter buttons ─────────────────────────────────────

    function buildFilterButtons() {
      var filtersDiv = document.getElementById("map-filters");
      filtersDiv.innerHTML = "";

      var filters = ["All", "Hidden Gems"].concat(TOP_FILTER_CUISINES);

      filters.forEach(function (label) {
        var btn = document.createElement("button");
        btn.className = "filter-btn" + (label === "All" ? " active" : "");
        if (label === "Hidden Gems") btn.className += " gem-filter";
        btn.setAttribute("data-filter", label);

        var textSpan = document.createElement("span");
        textSpan.textContent = label;
        btn.appendChild(textSpan);

        // Count badge (will be updated later)
        var badge = document.createElement("span");
        badge.className = "map-filter-count";
        badge.style.display = "none";
        btn.appendChild(badge);

        btn.addEventListener("click", function () {
          filtersDiv.querySelectorAll(".filter-btn").forEach(function (b) {
            b.classList.remove("active");
          });
          btn.classList.add("active");
          activeFilter = label;
          renderView(false);
        });

        filtersDiv.appendChild(btn);
      });
    }

    function updateFilterBadges(filteredData) {
      var total = filteredData.length;
      var btns = document.querySelectorAll("#map-filters .filter-btn");
      btns.forEach(function (btn) {
        var badge = btn.querySelector(".map-filter-count");
        var filterLabel = btn.getAttribute("data-filter");
        if (!badge) return;

        if (filterLabel === activeFilter && total > 0) {
          badge.textContent = total.toLocaleString();
          badge.style.display = "inline-block";
        } else {
          badge.style.display = "none";
        }
      });
    }

    // ── View toggle buttons ────────────────────────────────

    function setupViewToggles() {
      var btns = document.querySelectorAll(".map-toggle-btn[data-view]");
      btns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          btns.forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          activeView = btn.getAttribute("data-view");
          if (activeView === "dots") {
            renderView(true);
          } else {
            renderView(false);
          }
        });
      });
    }

    // ── Search ─────────────────────────────────────────────

    function setupSearch() {
      var input = document.getElementById("map-search");
      if (!input) return;

      var debounceTimer;
      input.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          searchTerm = input.value.trim();
          renderView(false);
        }, 250);
      });
    }

    // ── Map narration tour ─────────────────────────────────
    // When the map section scrolls into view for the first time:
    // 1) Zoom to city center tight
    // 2) Zoom back out to show all dots
    // 3) Pulse hidden gems

    function setupMapTour() {
      var section = document.getElementById("section-map");
      if (!section) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !tourPlayed) {
            tourPlayed = true;
            observer.disconnect();
            playTour();
          }
        });
      }, { threshold: 0.3 });

      observer.observe(section);
    }

    function playTour() {
      // Step 1: Tight zoom on city center
      map.setView(PHILLY_CENTER, 14, { animate: true, duration: 1.2 });

      // Step 2: After a beat, zoom out to show all
      setTimeout(function () {
        map.setView(PHILLY_CENTER, 12, { animate: true, duration: 1.5 });
      }, 1800);

      // Step 3: After zoom-out, briefly highlight gems with a pulse
      setTimeout(function () {
        pulseGems();
      }, 3800);
    }

    function pulseGems() {
      // Temporarily enlarge and brighten gem markers
      var gemMarkers = allDotMarkers.filter(function (m) { return m._isGem; });

      gemMarkers.forEach(function (m) {
        if (!map.hasLayer(m)) return;
        m.setStyle({ radius: 8, fillOpacity: 1, weight: 2.5 });
      });

      // Restore after 1.5s
      setTimeout(function () {
        gemMarkers.forEach(function (m) {
          if (!map.hasLayer(m)) return;
          m.setStyle({ radius: 5, fillOpacity: 0.85, weight: 1.5 });
        });
      }, 1500);
    }

    // ── Initialize everything ──────────────────────────────

    buildFilterButtons();
    setupViewToggles();
    setupSearch();

    // Render initial dots view with stagger animation
    renderView(true);

    // Setup the scroll-triggered tour
    setupMapTour();

    // Fix Leaflet tile rendering when map container becomes visible
    // (the map may be below the fold on load)
    setTimeout(function () { map.invalidateSize(); }, 200);
    setTimeout(function () { map.invalidateSize(); }, 1000);

    // Also invalidate when the section scrolls into view
    var mapSection = document.getElementById("section-map");
    if (mapSection) {
      var sizeObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            map.invalidateSize();
          }
        });
      }, { threshold: 0.1 });
      sizeObserver.observe(mapSection);
    }

  }).catch(function (err) {
    console.error("Map data load error:", err);
  });

})();
