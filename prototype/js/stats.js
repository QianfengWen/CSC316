/* ============================================================
   Stats Deep Dive — D3-based statistical visualizations
   Forest plot, distribution comparison, significance table,
   gem score breakdown for the Philadelphia restaurant analysis.
   ============================================================ */

(function () {
  "use strict";

  // ── Style Constants ───────────────────────────────────────
  var COLORS = {
    red: "#d4503a",
    gold: "#e8a838",
    green: "#3a8c5c",
    teal: "#2a8a8a",
    dark: "#1a1410",
    muted: "#7a6e5f",
    bg: "#faf6f0",
    light: "#f0ebe3"
  };

  var COMPONENT_COLORS = {
    low_competition: "#5b8cbe",
    quality: "#3a8c5c",
    stability: "#2a8a8a",
    demand: "#e8a838"
  };

  var COMPONENT_LABELS = {
    low_competition: "Low Competition",
    quality: "Quality",
    stability: "Stability",
    demand: "Demand"
  };

  // ── Utility Helpers ───────────────────────────────────────

  function fmt(n) {
    return n.toLocaleString();
  }

  function pFmt(p) {
    if (p < 0.001) return "< 0.001";
    if (p < 0.01) return p.toFixed(3);
    return p.toFixed(3);
  }

  /** Extract cuisine entries from statsData (skip keys starting with _) */
  function getCuisineEntries(statsData) {
    var entries = [];
    Object.keys(statsData).forEach(function (key) {
      if (key.charAt(0) !== "_") {
        entries.push({ cuisine: key, data: statsData[key] });
      }
    });
    return entries;
  }

  // ── 1. FOREST PLOT ────────────────────────────────────────

  function renderForestPlot(container, statsData) {
    var containerEl = d3.select(container);
    containerEl.html("");

    var cityMean = statsData._city_mean;
    var entries = getCuisineEntries(statsData);

    // Sort by mean rating, highest first
    entries.sort(function (a, b) {
      return b.data.mean_rating - a.data.mean_rating;
    });

    // Dimensions
    var containerNode = containerEl.node();
    var fullWidth = Math.min(720, containerNode.clientWidth || 720);
    var rowHeight = 22;
    var margin = { top: 30, right: 30, bottom: 40, left: 140 };
    var width = fullWidth - margin.left - margin.right;
    var height = entries.length * rowHeight + margin.top + margin.bottom;

    var svg = containerEl.append("svg")
      .attr("viewBox", "0 0 " + fullWidth + " " + height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("font-family", "Inter, sans-serif");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Determine x-axis domain from all CI bounds
    var allLower = d3.min(entries, function (e) { return e.data.ci_lower; });
    var allUpper = d3.max(entries, function (e) { return e.data.ci_upper; });
    var padding = (allUpper - allLower) * 0.15;
    var xMin = Math.min(allLower - padding, cityMean - padding);
    var xMax = Math.max(allUpper + padding, cityMean + padding);

    var x = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, width]);

    // x-axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + (entries.length * rowHeight) + ")")
      .call(d3.axisBottom(x).ticks(6).tickFormat(function (d) { return d.toFixed(1); }))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 32)
      .attr("fill", COLORS.muted)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text("Mean Rating");

    // Vertical dashed line at city mean
    g.append("line")
      .attr("x1", x(cityMean))
      .attr("y1", -10)
      .attr("x2", x(cityMean))
      .attr("y2", entries.length * rowHeight)
      .attr("stroke", COLORS.dark)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,4")
      .attr("opacity", 0.6);

    // City mean label
    g.append("text")
      .attr("x", x(cityMean))
      .attr("y", -14)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.dark)
      .style("font-size", "10px")
      .style("font-weight", "700")
      .text("City Mean: " + cityMean.toFixed(2));

    // Render each cuisine row
    entries.forEach(function (entry, i) {
      var d = entry.data;
      var yPos = i * rowHeight + rowHeight / 2;

      // Determine color based on significance and direction
      var color;
      if (!d.significant) {
        color = COLORS.muted;
      } else if (d.mean_rating > cityMean) {
        color = COLORS.green;
      } else {
        color = COLORS.red;
      }

      // Cuisine label
      g.append("text")
        .attr("x", -8)
        .attr("y", yPos + 4)
        .attr("text-anchor", "end")
        .attr("fill", COLORS.dark)
        .style("font-size", "10px")
        .style("font-weight", d.significant ? "700" : "400")
        .text(entry.cuisine);

      // Whisker line (animated from center)
      var whisker = g.append("line")
        .attr("x1", x(d.mean_rating))
        .attr("y1", yPos)
        .attr("x2", x(d.mean_rating))
        .attr("y2", yPos)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("opacity", 0.8);

      whisker.transition()
        .duration(600)
        .delay(80 + i * 30)
        .attr("x1", x(d.ci_lower))
        .attr("x2", x(d.ci_upper));

      // CI endpoints (caps)
      var capHeight = 8;
      var capLeft = g.append("line")
        .attr("x1", x(d.mean_rating))
        .attr("y1", yPos - capHeight / 2)
        .attr("x2", x(d.mean_rating))
        .attr("y2", yPos + capHeight / 2)
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("opacity", 0);

      capLeft.transition()
        .duration(600)
        .delay(80 + i * 30)
        .attr("x1", x(d.ci_lower))
        .attr("x2", x(d.ci_lower))
        .attr("opacity", 0.8);

      var capRight = g.append("line")
        .attr("x1", x(d.mean_rating))
        .attr("y1", yPos - capHeight / 2)
        .attr("x2", x(d.mean_rating))
        .attr("y2", yPos + capHeight / 2)
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("opacity", 0);

      capRight.transition()
        .duration(600)
        .delay(80 + i * 30)
        .attr("x1", x(d.ci_upper))
        .attr("x2", x(d.ci_upper))
        .attr("opacity", 0.8);

      // Mean dot (animated entrance)
      g.append("circle")
        .attr("cx", x(d.mean_rating))
        .attr("cy", yPos)
        .attr("r", 0)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .transition()
        .duration(400)
        .delay(200 + i * 30)
        .attr("r", 4);

      // Alternating row background for readability
      if (i % 2 === 0) {
        g.insert("rect", ":first-child")
          .attr("x", -margin.left)
          .attr("y", yPos - rowHeight / 2)
          .attr("width", fullWidth)
          .attr("height", rowHeight)
          .attr("fill", COLORS.light)
          .attr("opacity", 0.4);
      }
    });
  }


  // ── 2. DISTRIBUTION COMPARISON ────────────────────────────

  function renderDistributionComparison(container, statsData, cuisine1, cuisine2) {
    var containerEl = d3.select(container);
    containerEl.html("");

    var d1 = statsData[cuisine1];
    var d2 = statsData[cuisine2];
    if (!d1 || !d2) {
      containerEl.append("p")
        .style("color", COLORS.muted)
        .style("text-align", "center")
        .text("Select two cuisines to compare.");
      return;
    }

    var stars = ["1", "2", "3", "4", "5"];

    // Normalize histograms to percentages
    var total1 = d3.sum(stars, function (s) { return d1.histogram[s] || 0; });
    var total2 = d3.sum(stars, function (s) { return d2.histogram[s] || 0; });

    var pct1 = stars.map(function (s) { return total1 > 0 ? ((d1.histogram[s] || 0) / total1) * 100 : 0; });
    var pct2 = stars.map(function (s) { return total2 > 0 ? ((d2.histogram[s] || 0) / total2) * 100 : 0; });

    var maxPct = Math.max(d3.max(pct1), d3.max(pct2)) * 1.15;

    // Dimensions
    var containerNode = containerEl.node();
    var fullWidth = Math.min(600, containerNode.clientWidth || 600);
    var margin = { top: 50, right: 20, bottom: 50, left: 20 };
    var width = fullWidth - margin.left - margin.right;
    var height = 300 - margin.top - margin.bottom;
    var midX = width / 2;

    var svg = containerEl.append("svg")
      .attr("viewBox", "0 0 " + fullWidth + " 300")
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("font-family", "Inter, sans-serif");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Scales
    var yBand = d3.scaleBand()
      .domain(stars)
      .range([0, height])
      .padding(0.25);

    var xLeft = d3.scaleLinear()
      .domain([0, maxPct])
      .range([0, midX - 20]);

    var xRight = d3.scaleLinear()
      .domain([0, maxPct])
      .range([0, midX - 20]);

    // Center star labels
    stars.forEach(function (s, i) {
      g.append("text")
        .attr("x", midX)
        .attr("y", yBand(s) + yBand.bandwidth() / 2 + 4)
        .attr("text-anchor", "middle")
        .attr("fill", COLORS.dark)
        .style("font-size", "12px")
        .style("font-weight", "700")
        .text(s + "\u2605");
    });

    // Cuisine 1 bars (left, blue) - grow from center
    stars.forEach(function (s, i) {
      var barW = xLeft(pct1[i]);
      g.append("rect")
        .attr("x", midX - 18)
        .attr("y", yBand(s))
        .attr("width", 0)
        .attr("height", yBand.bandwidth())
        .attr("fill", "#5b8cbe")
        .attr("opacity", 0.8)
        .attr("rx", 3)
        .transition()
        .duration(600)
        .delay(i * 60)
        .attr("x", midX - 18 - barW)
        .attr("width", barW);

      // Percentage label
      g.append("text")
        .attr("x", midX - 18 - barW - 4)
        .attr("y", yBand(s) + yBand.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .attr("fill", "#5b8cbe")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .attr("opacity", 0)
        .transition()
        .duration(400)
        .delay(300 + i * 60)
        .attr("opacity", 1)
        .text(pct1[i].toFixed(1) + "%");
    });

    // Cuisine 2 bars (right, gold) - grow from center
    stars.forEach(function (s, i) {
      var barW = xRight(pct2[i]);
      g.append("rect")
        .attr("x", midX + 18)
        .attr("y", yBand(s))
        .attr("width", 0)
        .attr("height", yBand.bandwidth())
        .attr("fill", COLORS.gold)
        .attr("opacity", 0.8)
        .attr("rx", 3)
        .transition()
        .duration(600)
        .delay(i * 60)
        .attr("width", barW);

      // Percentage label
      g.append("text")
        .attr("x", midX + 18 + barW + 4)
        .attr("y", yBand(s) + yBand.bandwidth() / 2 + 4)
        .attr("text-anchor", "start")
        .attr("fill", COLORS.gold)
        .style("font-size", "10px")
        .style("font-weight", "600")
        .attr("opacity", 0)
        .transition()
        .duration(400)
        .delay(300 + i * 60)
        .attr("opacity", 1)
        .text(pct2[i].toFixed(1) + "%");
    });

    // Cuisine headers with summary stats
    g.append("text")
      .attr("x", midX / 2 - 10)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .attr("fill", "#5b8cbe")
      .style("font-size", "13px")
      .style("font-weight", "700")
      .text(cuisine1);

    g.append("text")
      .attr("x", midX / 2 - 10)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .style("font-size", "10px")
      .text("\u2605 " + d1.mean_rating.toFixed(2) + "  |  n=" + fmt(d1.n_reviews));

    g.append("text")
      .attr("x", midX + midX / 2 + 10)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.gold)
      .style("font-size", "13px")
      .style("font-weight", "700")
      .text(cuisine2);

    g.append("text")
      .attr("x", midX + midX / 2 + 10)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted)
      .style("font-size", "10px")
      .text("\u2605 " + d2.mean_rating.toFixed(2) + "  |  n=" + fmt(d2.n_reviews));
  }


  // ── 3. SIGNIFICANCE TABLE ─────────────────────────────────

  function renderSignificanceTable(container, statsData) {
    var containerEl = d3.select(container);
    containerEl.html("");

    var cityMean = statsData._city_mean;
    var entries = getCuisineEntries(statsData);

    // Default sort by p-value ascending
    var currentSortKey = "p_value";
    var currentSortAsc = true;

    function sortEntries(key) {
      if (currentSortKey === key) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortKey = key;
        currentSortAsc = true;
      }
      entries.sort(function (a, b) {
        var va, vb;
        if (key === "cuisine") {
          va = a.cuisine.toLowerCase();
          vb = b.cuisine.toLowerCase();
          return currentSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        va = a.data[key] !== undefined ? a.data[key] : 0;
        vb = b.data[key] !== undefined ? b.data[key] : 0;
        return currentSortAsc ? va - vb : vb - va;
      });
    }

    function buildTable() {
      containerEl.html("");

      var wrapper = containerEl.append("div")
        .style("max-height", "480px")
        .style("overflow-y", "auto")
        .style("border-radius", "8px")
        .style("border", "1px solid " + COLORS.light);

      var table = wrapper.append("table")
        .style("width", "100%")
        .style("border-collapse", "collapse")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "0.82rem");

      // Header
      var thead = table.append("thead");
      var headerRow = thead.append("tr")
        .style("background", COLORS.dark)
        .style("color", COLORS.bg)
        .style("position", "sticky")
        .style("top", "0")
        .style("z-index", "2");

      var columns = [
        { key: "cuisine", label: "Cuisine" },
        { key: "mean_rating", label: "Mean" },
        { key: "ci", label: "CI (95%)" },
        { key: "z_score", label: "Z-score" },
        { key: "p_value", label: "P-value" },
        { key: "significant", label: "Significant?" }
      ];

      columns.forEach(function (col) {
        var th = headerRow.append("th")
          .style("padding", "10px 12px")
          .style("text-align", col.key === "cuisine" ? "left" : "center")
          .style("cursor", col.key === "ci" ? "default" : "pointer")
          .style("white-space", "nowrap")
          .style("user-select", "none")
          .text(col.label);

        if (col.key !== "ci") {
          var sortKey = col.key;
          th.on("click", function () {
            sortEntries(sortKey);
            buildTable();
          });

          // Sort indicator
          if (currentSortKey === col.key) {
            th.append("span")
              .style("margin-left", "4px")
              .text(currentSortAsc ? " \u25B2" : " \u25BC");
          }
        }
      });

      // Body
      var tbody = table.append("tbody");
      var displayed = entries.slice(0, 30);

      displayed.forEach(function (entry, i) {
        var d = entry.data;
        var isAbove = d.mean_rating > cityMean;

        var rowColor;
        if (d.significant && isAbove) {
          rowColor = "rgba(58, 140, 92, 0.08)";
        } else if (d.significant && !isAbove) {
          rowColor = "rgba(212, 80, 58, 0.08)";
        } else {
          rowColor = i % 2 === 0 ? COLORS.bg : "#fff";
        }

        var tr = tbody.append("tr")
          .style("background", rowColor)
          .style("transition", "background 0.15s");

        tr.on("mouseenter", function () {
          d3.select(this).style("background", COLORS.light);
        }).on("mouseleave", function () {
          d3.select(this).style("background", rowColor);
        });

        var cellStyle = "padding:8px 12px; border-bottom:1px solid " + COLORS.light + ";";

        // Cuisine
        tr.append("td")
          .attr("style", cellStyle + " font-weight:600; text-align:left;")
          .text(entry.cuisine);

        // Mean rating
        tr.append("td")
          .attr("style", cellStyle + " text-align:center; font-weight:600;")
          .style("color", isAbove ? COLORS.green : d.significant ? COLORS.red : COLORS.dark)
          .text(d.mean_rating.toFixed(2));

        // CI
        tr.append("td")
          .attr("style", cellStyle + " text-align:center; color:" + COLORS.muted + ";")
          .text("[" + d.ci_lower.toFixed(3) + ", " + d.ci_upper.toFixed(3) + "]");

        // Z-score
        tr.append("td")
          .attr("style", cellStyle + " text-align:center; font-family:monospace;")
          .text(d.z_score.toFixed(2));

        // P-value
        tr.append("td")
          .attr("style", cellStyle + " text-align:center; font-family:monospace;")
          .style("color", d.p_value < 0.05 ? COLORS.red : COLORS.muted)
          .style("font-weight", d.p_value < 0.05 ? "700" : "400")
          .text(pFmt(d.p_value));

        // Significant?
        var sigCell = tr.append("td")
          .attr("style", cellStyle + " text-align:center;");

        if (d.significant) {
          sigCell.append("span")
            .style("color", COLORS.green)
            .style("font-size", "1.1rem")
            .style("font-weight", "700")
            .text("\u2713");
        } else {
          sigCell.append("span")
            .style("color", COLORS.muted)
            .style("font-size", "1.1rem")
            .text("\u2717");
        }
      });
    }

    // Initial sort and render
    sortEntries(currentSortKey);
    buildTable();
  }


  // ── 4. GEM SCORE BREAKDOWN ────────────────────────────────

  function renderGemScoreBreakdown(container, gemData) {
    var containerEl = d3.select(container);
    containerEl.html("");

    if (!gemData || !gemData.rankings) {
      containerEl.append("p")
        .style("color", COLORS.muted)
        .text("Gem score data not available.");
      return;
    }

    // Top 15 cuisines by gem_score
    var rankings = gemData.rankings.slice()
      .sort(function (a, b) { return b.gem_score - a.gem_score; })
      .slice(0, 15);

    var threshold = gemData.threshold || 0.55;
    var componentKeys = ["low_competition", "quality", "stability", "demand"];
    var weights = gemData.weights || { low_competition: 0.3, quality: 0.3, stability: 0.2, demand: 0.2 };

    // Dimensions
    var containerNode = containerEl.node();
    var fullWidth = Math.min(700, containerNode.clientWidth || 700);
    var barHeight = 28;
    var barGap = 6;
    var margin = { top: 50, right: 80, bottom: 40, left: 130 };
    var width = fullWidth - margin.left - margin.right;
    var height = rankings.length * (barHeight + barGap) + margin.top + margin.bottom;

    var svg = containerEl.append("svg")
      .attr("viewBox", "0 0 " + fullWidth + " " + height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("font-family", "Inter, sans-serif");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // X scale (0 to 1 for normalized gem_score)
    var x = d3.scaleLinear()
      .domain([0, 1])
      .range([0, width]);

    // X axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + (rankings.length * (barHeight + barGap)) + ")")
      .call(d3.axisBottom(x).ticks(5).tickFormat(function (d) { return d.toFixed(1); }))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 32)
      .attr("fill", COLORS.muted)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text("Gem Score");

    // Threshold line
    g.append("line")
      .attr("x1", x(threshold))
      .attr("y1", -10)
      .attr("x2", x(threshold))
      .attr("y2", rankings.length * (barHeight + barGap))
      .attr("stroke", COLORS.red)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,3")
      .attr("opacity", 0.7);

    g.append("text")
      .attr("x", x(threshold) + 4)
      .attr("y", -14)
      .attr("fill", COLORS.red)
      .style("font-size", "10px")
      .style("font-weight", "700")
      .text("Threshold: " + threshold);

    // Render each cuisine bar (stacked)
    rankings.forEach(function (r, i) {
      var yPos = i * (barHeight + barGap);
      var isGem = r.is_gem;

      // Cuisine label
      g.append("text")
        .attr("x", -8)
        .attr("y", yPos + barHeight / 2 + 4)
        .attr("text-anchor", "end")
        .attr("fill", COLORS.dark)
        .style("font-size", "11px")
        .style("font-weight", isGem ? "700" : "400")
        .text(r.cuisine);

      // Gem indicator
      if (isGem) {
        g.append("text")
          .attr("x", -margin.left + 8)
          .attr("y", yPos + barHeight / 2 + 4)
          .attr("fill", COLORS.gold)
          .style("font-size", "11px")
          .text("\u2666");
      }

      // Background track
      g.append("rect")
        .attr("x", 0)
        .attr("y", yPos)
        .attr("width", width)
        .attr("height", barHeight)
        .attr("fill", COLORS.light)
        .attr("rx", 4)
        .attr("opacity", 0.5);

      // Stacked segments
      var cumulativeX = 0;
      componentKeys.forEach(function (key) {
        var componentValue = r.components[key] || 0;
        var weight = weights[key] || 0.25;
        var segmentWidth = componentValue * weight;

        var segRect = g.append("rect")
          .attr("x", x(cumulativeX))
          .attr("y", yPos)
          .attr("width", 0)
          .attr("height", barHeight)
          .attr("fill", COMPONENT_COLORS[key])
          .attr("opacity", 0.85)
          .attr("rx", cumulativeX === 0 ? 4 : 0);

        segRect.transition()
          .duration(600)
          .delay(100 + i * 40)
          .attr("width", Math.max(0, x(segmentWidth) - x(0)));

        cumulativeX += segmentWidth;
      });

      // Score label
      g.append("text")
        .attr("x", x(r.gem_score) + 6)
        .attr("y", yPos + barHeight / 2 + 4)
        .attr("fill", COLORS.dark)
        .style("font-size", "10px")
        .style("font-weight", "700")
        .attr("opacity", 0)
        .transition()
        .duration(400)
        .delay(400 + i * 40)
        .attr("opacity", 1)
        .text(r.gem_score.toFixed(2));
    });

    // Legend
    var legendG = svg.append("g")
      .attr("transform", "translate(" + margin.left + ", 8)");

    var legendX = 0;
    componentKeys.forEach(function (key) {
      var labelText = COMPONENT_LABELS[key] + " (" + (weights[key] * 100).toFixed(0) + "%)";

      legendG.append("rect")
        .attr("x", legendX)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", COMPONENT_COLORS[key])
        .attr("rx", 2);

      legendG.append("text")
        .attr("x", legendX + 16)
        .attr("y", 10)
        .attr("fill", COLORS.dark)
        .style("font-size", "10px")
        .text(labelText);

      legendX += labelText.length * 6.5 + 28;
    });
  }


  // ── 5. SETUP FUNCTION ─────────────────────────────────────

  function setupStatsSection(statsData, gemData) {
    // Render forest plot
    var forestContainer = document.getElementById("forest-plot");
    if (forestContainer) {
      renderForestPlot(forestContainer, statsData);
    }

    // Render significance table
    var tableContainer = document.getElementById("significance-table");
    if (tableContainer) {
      renderSignificanceTable(tableContainer, statsData);
    }

    // Render gem score breakdown
    var gemContainer = document.getElementById("gem-score-breakdown");
    if (gemContainer) {
      renderGemScoreBreakdown(gemContainer, gemData);
    }

    // Wire up cuisine dropdowns for distribution comparison
    var select1 = document.getElementById("stats-cuisine-select-1");
    var select2 = document.getElementById("stats-cuisine-select-2");
    var distContainer = document.getElementById("distribution-comparison");

    if (select1 && select2 && distContainer) {
      var cuisineNames = getCuisineEntries(statsData).map(function (e) {
        return e.cuisine;
      }).sort();

      // Populate dropdowns
      [select1, select2].forEach(function (sel, idx) {
        sel.innerHTML = "";
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select cuisine...";
        placeholder.disabled = true;
        sel.appendChild(placeholder);

        cuisineNames.forEach(function (name, i) {
          var opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          sel.appendChild(opt);
        });

        // Set sensible defaults if available
        if (idx === 0 && cuisineNames.length > 0) {
          sel.value = cuisineNames.indexOf("Pizza") >= 0 ? "Pizza" : cuisineNames[0];
        }
        if (idx === 1 && cuisineNames.length > 1) {
          sel.value = cuisineNames.indexOf("Ethiopian") >= 0 ? "Ethiopian" : cuisineNames[1];
        }
      });

      function updateComparison() {
        var c1 = select1.value;
        var c2 = select2.value;
        if (c1 && c2) {
          renderDistributionComparison(distContainer, statsData, c1, c2);
        }
      }

      select1.addEventListener("change", updateComparison);
      select2.addEventListener("change", updateComparison);

      // Initial render with defaults
      updateComparison();
    }
  }


  // ── Export ─────────────────────────────────────────────────

  window.StatsModule = {
    setup: setupStatsSection
  };

})();
