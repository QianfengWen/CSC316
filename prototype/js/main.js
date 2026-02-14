/* ============================================================
   Hidden Gems — Philadelphia Restaurant Market Analysis
   Main D3 visualization code — Complete interactive version
   ============================================================ */

(function () {
  "use strict";

  // ── Shared color helpers ──────────────────────────────────
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

  // Cuisine color palette for scatter plot (deterministic hashing)
  var CUISINE_PALETTE = [
    "#d4503a", "#e8a838", "#3a8c5c", "#2a8a8a", "#5b8cbe",
    "#9b59b6", "#e67e22", "#1abc9c", "#c0392b", "#2980b9",
    "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#d35400"
  ];

  function cuisineColor(cuisine) {
    var hash = 0;
    for (var i = 0; i < cuisine.length; i++) {
      hash = cuisine.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CUISINE_PALETTE[Math.abs(hash) % CUISINE_PALETTE.length];
  }

  // Stability -> color (low std = green, high std = red)
  function stabilityColor(std) {
    if (std <= 0.45) return COLORS.green;
    if (std <= 0.6) return COLORS.teal;
    if (std <= 0.75) return COLORS.gold;
    return COLORS.red;
  }

  // Small storefront SVG icon (inline, for the bar chart)
  function storefrontIcon(color) {
    return '<svg width="14" height="16" viewBox="0 0 14 16" style="vertical-align:middle;">' +
      '<rect x="1" y="4" width="12" height="11" rx="1.5" fill="' + color + '" opacity="0.85"/>' +
      '<polygon points="0,5 7,0 14,5" fill="' + color + '"/>' +
      '<rect x="3" y="6" width="3" height="3" rx="0.5" fill="#faf6f0" opacity="0.5"/>' +
      '<rect x="8" y="6" width="3" height="3" rx="0.5" fill="#faf6f0" opacity="0.5"/>' +
      '<rect x="5" y="10" width="4" height="5" rx="0.5" fill="#faf6f0" opacity="0.3"/>' +
      '</svg>';
  }

  // Volatility level helper
  function volatilityLevel(std) {
    if (std < 0.45) return 1;
    if (std < 0.6) return 2;
    if (std < 0.75) return 3;
    return 4;
  }

  // Format number with commas
  function fmt(n) {
    return n.toLocaleString();
  }

  // ── Load data & render ────────────────────────────────────
  Promise.all([
    d3.json("data/philly_cuisines.json"),
    d3.json("data/philly_restaurants.json")
  ]).then(function (datasets) {
    var cuisines = datasets[0];
    var restaurants = datasets[1];

    // Set up all interactive features
    setupHeroCounter();
    setupQuiz(cuisines);
    renderCompetitionChart(cuisines, restaurants);
    renderScatterPlot(restaurants, cuisines);
    renderOpportunityMatrix(cuisines, restaurants);
    renderVolatilityChart(cuisines, restaurants);
    setupScrollAnimations();
    setupNavDots();
    setupJourneyRecap();
  }).catch(function(err) {
    console.error("Failed to load data:", err);
  });


  // ── HERO COUNTER ──────────────────────────────────────────
  function setupHeroCounter() {
    var counterEl = document.getElementById("hero-counter");
    if (!counterEl) return;
    var target = 7083;
    var animated = false;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !animated) {
          animated = true;
          animateCounter(counterEl, 0, target, 2000);
        }
      });
    }, { threshold: 0.3 });

    observer.observe(document.getElementById("hero"));
  }

  function animateCounter(el, start, end, duration) {
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(start + (end - start) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }


  // ── QUIZ ──────────────────────────────────────────────────
  function setupQuiz(cuisines) {
    var buttons = document.querySelectorAll("#quiz-options .quiz-btn");
    var resultEl = document.getElementById("quiz-result");
    var answered = false;

    // Find the correct answer data
    var pizzaData = cuisines.find(function (c) { return c.cuisine === "Pizza"; });
    var correctAnswer = "Pizza";

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (answered) return;
        answered = true;

        var chosen = btn.getAttribute("data-answer");
        var isCorrect = chosen === correctAnswer;

        // Highlight correct answer green, wrong red
        buttons.forEach(function (b) {
          var ans = b.getAttribute("data-answer");
          if (ans === correctAnswer) {
            b.classList.add("correct");
          } else if (ans === chosen && !isCorrect) {
            b.classList.add("wrong");
          } else {
            b.classList.add("dimmed");
          }
        });

        // Show result message
        resultEl.style.display = "block";
        if (isCorrect) {
          resultEl.className = "quiz-result success";
          resultEl.innerHTML = '<strong>You got it!</strong> Pizza dominates Philadelphia with <strong>' +
            (pizzaData ? fmt(pizzaData.count) : "800") +
            ' restaurants</strong>. But here is the real question: does being the most popular also mean the best opportunity for a new business?';
        } else {
          resultEl.className = "quiz-result surprise";
          var chosenData = cuisines.find(function (c) { return c.cuisine === chosen; });
          var chosenCount = chosenData ? fmt(chosenData.count) : "fewer";
          resultEl.innerHTML = '<strong>Surprising, right?</strong> ' + chosen + ' has ' + chosenCount +
            ' restaurants, but <strong>Pizza leads with ' + (pizzaData ? fmt(pizzaData.count) : "800") +
            ' restaurants</strong>. The obvious choices are not always what they seem.';
        }
      });
    });
  }


  // ── 1. COMPETITION BAR CHART (Storefront Strip) ──────────
  function renderCompetitionChart(cuisineData, restaurants) {
    var container = d3.select("#competition-chart");
    container.html(""); // clear
    container.style("position", "relative");

    var data = cuisineData.slice(); // copy
    var currentSort = "count";
    var expandedCuisine = null;

    // Sort functions
    function sortData(key) {
      if (key === "count") return data.sort(function (a, b) { return b.count - a.count; });
      if (key === "rating") return data.sort(function (a, b) { return b.avg_rating - a.avg_rating; });
      if (key === "opportunity") return data.sort(function (a, b) { return b.opportunity - a.opportunity; });
      return data;
    }

    function barColor(d) {
      if (currentSort === "opportunity") {
        return d.opportunity > 1.8 ? COLORS.green : d.opportunity > 1.6 ? COLORS.gold : COLORS.red;
      }
      if (currentSort === "rating") {
        return d.avg_rating >= 3.8 ? COLORS.green : d.avg_rating >= 3.5 ? COLORS.gold : COLORS.red;
      }
      return d.count > 400 ? COLORS.red : d.count > 150 ? COLORS.gold : COLORS.green;
    }

    function barValue(d) {
      if (currentSort === "rating") return d.avg_rating;
      if (currentSort === "opportunity") return d.opportunity;
      return d.count;
    }

    function renderBars() {
      sortData(currentSort);
      var top25 = data.slice(0, 25);
      container.selectAll("*").remove();

      var maxVal = d3.max(top25, barValue);

      top25.forEach(function (d, i) {
        var row = container.append("div")
          .attr("class", "storefront-row")
          .attr("data-cuisine", d.cuisine)
          .style("opacity", 0)
          .style("transform", "translateX(-20px)");

        // Cuisine label
        row.append("div")
          .attr("class", "cuisine-label")
          .text(d.cuisine);

        var wrapper = row.append("div").attr("class", "storefront-bar-wrapper");

        var color = barColor(d);
        var bar = wrapper.append("div")
          .attr("class", "storefront-bar")
          .style("background", color + "22")
          .style("border", "1.5px solid " + color)
          .style("width", "0px");

        // Add tiny storefront icons inside the bar
        var iconCount = Math.max(1, Math.round(d.count / 20));
        var iconsHtml = "";
        for (var k = 0; k < Math.min(iconCount, 40); k++) {
          iconsHtml += storefrontIcon(color);
        }
        bar.append("span")
          .attr("class", "bar-icons")
          .html(iconsHtml);

        // Count label outside bar
        var val = barValue(d);
        var label = currentSort === "count" ? fmt(d.count) :
          currentSort === "rating" ? ("\u2605 " + d.avg_rating.toFixed(2)) :
          ("Opp: " + d.opportunity.toFixed(2));

        wrapper.append("span")
          .attr("class", "bar-count")
          .style("font-size", "0.75rem")
          .style("font-weight", "700")
          .style("color", COLORS.dark)
          .style("margin-left", "6px")
          .style("white-space", "nowrap")
          .text(label);

        // Animate entrance: staggered slide-in from left
        setTimeout(function () {
          row.style("opacity", 1).style("transform", "translateX(0)");
          row.style("transition", "opacity 0.4s ease, transform 0.4s ease");
          bar.style("width", (barValue(d) / maxVal * 100) + "%");
        }, 60 + i * 40);

        // Hover: show extra detail
        row.on("mouseenter", function () {
          d3.select(this).select(".bar-count")
            .text(fmt(d.count) + " restaurants | \u2605 " + d.avg_rating.toFixed(1) + " | Opp: " + d.opportunity.toFixed(2));
        }).on("mouseleave", function () {
          d3.select(this).select(".bar-count").text(label);
        });

        // Click: expand to show top 5 restaurants
        row.on("click", function () {
          // Toggle
          if (expandedCuisine === d.cuisine) {
            container.selectAll(".expanded-detail").remove();
            expandedCuisine = null;
            return;
          }
          container.selectAll(".expanded-detail").remove();
          expandedCuisine = d.cuisine;

          // Find top 5 restaurants for this cuisine
          var cuisineRestaurants = restaurants
            .filter(function (r) { return r.cuisines.indexOf(d.cuisine) >= 0; })
            .sort(function (a, b) {
              // Sort by weighted: stars * log(review_count)
              return (b.stars * Math.log(b.review_count + 1)) - (a.stars * Math.log(a.review_count + 1));
            })
            .slice(0, 5);

          var detail = container.append("div")
            .attr("class", "expanded-detail")
            .style("margin", "4px 0 12px 160px")
            .style("padding", "12px 16px")
            .style("background", COLORS.light)
            .style("border-radius", "10px")
            .style("border-left", "3px solid " + color)
            .style("font-size", "0.82rem")
            .style("opacity", 0);

          detail.append("div")
            .style("font-weight", "700")
            .style("margin-bottom", "8px")
            .style("color", COLORS.dark)
            .text("Top 5 " + d.cuisine + " Restaurants:");

          cuisineRestaurants.forEach(function (r) {
            var stars = "";
            for (var s = 0; s < Math.floor(r.stars); s++) stars += "\u2605";
            if (r.stars % 1 >= 0.5) stars += "\u00BD";
            detail.append("div")
              .style("margin-bottom", "3px")
              .style("color", COLORS.dark)
              .html("<strong>" + r.name + "</strong> &mdash; " + stars + " " + r.stars + " (" + fmt(r.review_count) + " reviews)");
          });

          if (cuisineRestaurants.length === 0) {
            detail.append("div").style("color", COLORS.muted).text("No individual restaurant data found for this cuisine.");
          }

          // Re-insert detail after the clicked row
          var rowNode = row.node();
          rowNode.parentNode.insertBefore(detail.node(), rowNode.nextSibling);

          setTimeout(function () {
            detail.style("opacity", 1).style("transition", "opacity 0.3s");
          }, 30);
        });
      });
    }

    // Initial render
    renderBars();

    // Sort controls
    var controls = document.querySelectorAll("#competition-controls .control-btn");
    controls.forEach(function (btn) {
      btn.addEventListener("click", function () {
        controls.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentSort = btn.getAttribute("data-sort");
        expandedCuisine = null;
        renderBars();
      });
    });
  }


  // ── 2. SCATTER PLOT — Rating vs Reviews ───────────────────
  function renderScatterPlot(restaurants, cuisines) {
    var chartContainer = document.getElementById("scatter-chart");
    if (!chartContainer) return;
    chartContainer.style.position = "relative";
    chartContainer.innerHTML = "";

    var margin = { top: 20, right: 30, bottom: 50, left: 55 };
    var fullWidth = Math.min(650, chartContainer.clientWidth);
    var width = fullWidth - margin.left - margin.right;
    var height = 420 - margin.top - margin.bottom;

    var svg = d3.select("#scatter-chart")
      .append("svg")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Sample restaurants deterministically (every Nth) for performance
    var filtered = restaurants.filter(function (d) { return d.review_count >= 5; });
    var step = Math.max(1, Math.floor(filtered.length / 2000));
    var sampled = filtered.filter(function (_, i) { return i % step === 0; }).slice(0, 2000);

    // Identify "hidden gem" cuisines (low competition, high rating)
    var gemCuisines = {};
    cuisines.forEach(function (c) {
      if (c.count < 80 && c.avg_rating > 3.7) gemCuisines[c.cuisine] = true;
    });

    // Scales
    var x = d3.scaleLog()
      .domain([5, d3.max(sampled, function (d) { return d.review_count; })])
      .range([0, width]);

    var y = d3.scaleLinear()
      .domain([1, 5])
      .range([height, 0]);

    // Axes
    g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(6, "~s"))
      .append("text")
      .attr("x", width / 2).attr("y", 40)
      .attr("fill", COLORS.muted)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Number of Reviews (log scale) \u2192");

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -40)
      .attr("fill", COLORS.muted)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("\u2605 Star Rating");

    // Danger zone rect (initially hidden, shown on highlight)
    var dangerRect = g.append("rect")
      .attr("class", "danger-zone-rect")
      .attr("x", 0)
      .attr("y", y(5))
      .attr("width", x(20))
      .attr("height", y(3.5) - y(5))
      .style("opacity", 0);

    var dangerLabel = g.append("text")
      .attr("x", x(8))
      .attr("y", y(4.85))
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.red)
      .style("font-size", "10px")
      .style("font-weight", "700")
      .text("\u26A0 DANGER ZONE")
      .style("opacity", 0);

    var dangerSub = g.append("text")
      .attr("x", x(8))
      .attr("y", y(4.85) + 13)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.red)
      .style("font-size", "8px")
      .text("High rating, few reviews")
      .style("opacity", 0);

    // Color mode state
    var colorMode = "rating"; // "rating" or "cuisine"
    var highlightMode = "none"; // "danger", "gems", "none"

    function dotColor(d) {
      if (colorMode === "cuisine") {
        var c = d.cuisines && d.cuisines.length > 0 ? d.cuisines[0] : "Other";
        return cuisineColor(c);
      }
      // rating mode
      if (d.stars >= 4.5) return COLORS.green;
      if (d.stars >= 4) return "#5b8cbe";
      if (d.stars >= 3) return COLORS.gold;
      if (d.stars >= 2) return COLORS.red;
      return "#8e44ad";
    }

    function dotOpacity(d) {
      if (highlightMode === "danger") {
        return (d.stars >= 4 && d.review_count < 20) ? 0.85 : 0.08;
      }
      if (highlightMode === "gems") {
        var isGem = d.cuisines.some(function (c) { return gemCuisines[c]; });
        return isGem ? 0.85 : 0.08;
      }
      return 0.5;
    }

    function dotRadius(d) {
      return Math.max(2, Math.min(5, Math.sqrt(d.review_count) / 4));
    }

    // Tooltip
    var tooltip = d3.select("#scatter-chart")
      .append("div")
      .style("position", "absolute")
      .style("background", COLORS.dark)
      .style("color", "#faf6f0")
      .style("padding", "10px 14px")
      .style("border-radius", "8px")
      .style("font-size", "0.78rem")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "20")
      .style("max-width", "260px")
      .style("box-shadow", "0 4px 20px rgba(0,0,0,0.3)")
      .style("transition", "opacity 0.15s");

    // Draw dots
    var dots = g.selectAll(".scatter-dot")
      .data(sampled)
      .enter()
      .append("circle")
      .attr("class", "scatter-dot")
      .attr("cx", function (d) { return x(d.review_count); })
      .attr("cy", function (d, i) {
        // Deterministic jitter based on index to prevent banding on discrete star values
        var jitter = ((i * 2654435761 >>> 0) % 1000) / 1000; // Knuth hash for deterministic pseudo-random
        return y(d.stars) + (jitter - 0.5) * 14;
      })
      .attr("r", dotRadius)
      .attr("fill", dotColor)
      .attr("opacity", 0.5)
      .attr("stroke", "none");

    // Dot interactions
    dots.on("mouseenter", function (event, d) {
      d3.select(this).attr("r", 8).attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 2);
      tooltip.html(
        "<strong>" + d.name + "</strong><br/>" +
        "\u2605 " + d.stars + " &middot; " + fmt(d.review_count) + " reviews<br/>" +
        '<span style="color:#b8a890">' + (d.cuisines.slice(0, 3).join(", ") || "General") + "</span>"
      )
      .style("opacity", 1);

      var rect = chartContainer.getBoundingClientRect();
      var tx = event.clientX - rect.left + 15;
      var ty = event.clientY - rect.top - 10;
      // Keep tooltip inside container
      if (tx + 200 > chartContainer.clientWidth) tx = tx - 230;
      tooltip.style("left", tx + "px").style("top", ty + "px");
    })
    .on("mousemove", function (event) {
      var rect = chartContainer.getBoundingClientRect();
      var tx = event.clientX - rect.left + 15;
      var ty = event.clientY - rect.top - 10;
      if (tx + 200 > chartContainer.clientWidth) tx = tx - 230;
      tooltip.style("left", tx + "px").style("top", ty + "px");
    })
    .on("mouseleave", function (event, d) {
      d3.select(this)
        .attr("r", dotRadius(d))
        .attr("opacity", dotOpacity(d))
        .attr("stroke", "none");
      tooltip.style("opacity", 0);
    });

    // Annotation arrow for reliable restaurant
    var reliable = sampled.find(function (d) { return d.review_count > 1000 && d.stars >= 4; });
    if (reliable) {
      g.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 5).attr("refY", 5)
        .attr("markerWidth", 5).attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", COLORS.green);

      g.append("line")
        .attr("x1", x(reliable.review_count) + 10)
        .attr("y1", y(reliable.stars) + 15)
        .attr("x2", x(reliable.review_count))
        .attr("y2", y(reliable.stars) + 3)
        .attr("stroke", COLORS.green)
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");

      g.append("text")
        .attr("x", x(reliable.review_count) + 12)
        .attr("y", y(reliable.stars) + 24)
        .attr("fill", COLORS.green)
        .style("font-size", "9px")
        .style("font-weight", "700")
        .text("\u2713 Proven & reliable");
    }

    // D3 brush selection
    var brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on("end", function (event) {
        var sel = event.selection;
        var selPanel = document.getElementById("scatter-selection");
        var selContent = document.getElementById("scatter-selection-content");
        if (!sel) {
          selPanel.style.display = "none";
          dots.attr("opacity", dotOpacity);
          return;
        }
        var x0 = sel[0][0], y0 = sel[0][1], x1 = sel[1][0], y1 = sel[1][1];
        var selected = [];
        dots.each(function (d) {
          var cx = x(d.review_count), cy = y(d.stars);
          var inside = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
          d3.select(this).attr("opacity", inside ? 0.9 : 0.1);
          if (inside) selected.push(d);
        });

        if (selected.length > 0) {
          selPanel.style.display = "block";
          var avgStars = d3.mean(selected, function (d) { return d.stars; });
          var avgReviews = d3.mean(selected, function (d) { return d.review_count; });
          // Top cuisines in selection
          var cuisineCounts = {};
          selected.forEach(function (r) {
            r.cuisines.forEach(function (c) {
              cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
            });
          });
          var topCuisines = Object.entries(cuisineCounts)
            .sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 5);

          var html = "<strong>" + fmt(selected.length) + " restaurants selected</strong><br/>" +
            "Avg Rating: \u2605 " + avgStars.toFixed(2) + " | Avg Reviews: " + Math.round(avgReviews) + "<br/>" +
            "<strong>Top cuisines:</strong> " + topCuisines.map(function (c) { return c[0] + " (" + c[1] + ")"; }).join(", ");
          // Show top 5 restaurants
          var topR = selected.sort(function (a, b) { return b.stars - a.stars || b.review_count - a.review_count; }).slice(0, 5);
          html += "<br/><strong>Highlights:</strong><br/>";
          topR.forEach(function (r) {
            html += "\u2605 " + r.stars + " " + r.name + " (" + fmt(r.review_count) + " reviews)<br/>";
          });
          selContent.innerHTML = html;
        } else {
          selPanel.style.display = "none";
        }
      });

    var brushGroup = g.append("g")
      .attr("class", "brush")
      .call(brush);

    // Update function
    function updateDots() {
      dots.transition().duration(400)
        .attr("fill", dotColor)
        .attr("opacity", dotOpacity);

      // Danger zone visibility
      var showDanger = highlightMode === "danger";
      dangerRect.transition().duration(400).style("opacity", showDanger ? 1 : 0);
      dangerLabel.transition().duration(400).style("opacity", showDanger ? 1 : 0);
      dangerSub.transition().duration(400).style("opacity", showDanger ? 1 : 0);
    }

    // Color controls
    var colorBtns = document.querySelectorAll("#scatter-controls .control-btn[data-color]");
    colorBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        colorBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        colorMode = btn.getAttribute("data-color");
        updateDots();
      });
    });

    // Highlight controls
    var highlightBtns = document.querySelectorAll(".control-btn[data-highlight]");
    highlightBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        highlightBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        highlightMode = btn.getAttribute("data-highlight");
        updateDots();
      });
    });
  }


  // ── 3. OPPORTUNITY MATRIX (Bubble Chart) ──────────────────
  function renderOpportunityMatrix(cuisineData, restaurants) {
    var container = document.getElementById("opportunity-matrix");
    if (!container) return;
    container.style.position = "relative";
    container.innerHTML = "";

    var allData = cuisineData.filter(function (d) { return d.count >= 5; });

    var margin = { top: 40, right: 40, bottom: 60, left: 65 };
    var fullWidth = Math.min(800, container.clientWidth);
    var width = fullWidth - margin.left - margin.right;
    var height = 550 - margin.top - margin.bottom;

    var svg = d3.select("#opportunity-matrix")
      .append("svg")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Scales
    var x = d3.scaleLog()
      .domain([4, d3.max(allData, function (d) { return d.count; }) * 1.2])
      .range([0, width]);

    var y = d3.scaleLinear()
      .domain([2.8, 4.8])
      .range([height, 0]);

    var r = d3.scaleSqrt()
      .domain([0, d3.max(allData, function (d) { return d.median_reviews; })])
      .range([6, 32]);

    // Quadrant backgrounds
    var xMid = x(80);
    var yMid = y(3.7);

    // Top-left: HIDDEN GEMS
    g.append("rect")
      .attr("x", 0).attr("y", 0)
      .attr("width", xMid).attr("height", yMid)
      .attr("fill", "rgba(58, 140, 92, 0.06)")
      .attr("rx", 8);

    // Bottom-right: RED OCEAN
    g.append("rect")
      .attr("x", xMid).attr("y", yMid)
      .attr("width", width - xMid).attr("height", height - yMid)
      .attr("fill", "rgba(212, 80, 58, 0.04)")
      .attr("rx", 8);

    // Quadrant labels
    g.append("text").attr("x", xMid / 2).attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.green).attr("opacity", 0.7)
      .style("font-size", "13px").style("font-weight", "800")
      .style("letter-spacing", "1px")
      .text("\u2666 HIDDEN GEMS");

    g.append("text").attr("x", xMid + (width - xMid) / 2).attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.teal).attr("opacity", 0.5)
      .style("font-size", "11px").style("font-weight", "700")
      .text("ESTABLISHED WINNERS");

    g.append("text").attr("x", xMid + (width - xMid) / 2).attr("y", height - 6)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.red).attr("opacity", 0.5)
      .style("font-size", "11px").style("font-weight", "700")
      .text("RED OCEAN");

    g.append("text").attr("x", xMid / 2).attr("y", height - 6)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.muted).attr("opacity", 0.5)
      .style("font-size", "11px").style("font-weight", "700")
      .text("RISKY BETS");

    // Quadrant divider lines
    g.append("line")
      .attr("class", "quadrant-line")
      .attr("x1", xMid).attr("y1", 0).attr("x2", xMid).attr("y2", height);

    g.append("line")
      .attr("class", "quadrant-line")
      .attr("x1", 0).attr("y1", yMid).attr("x2", width).attr("y2", yMid);

    // Axes
    g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(6, "~s"))
      .append("text")
      .attr("x", width / 2).attr("y", 45)
      .attr("fill", COLORS.muted)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("\u2190 Less Competition          More Competition \u2192");

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -45)
      .attr("fill", COLORS.muted)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("\u2605 Average Rating (higher = better)");

    // Tooltip
    var tooltip = d3.select("#opportunity-matrix")
      .append("div")
      .attr("class", "bubble-tooltip");

    // Sort so smaller bubbles draw on top
    var sorted = allData.slice().sort(function (a, b) { return b.median_reviews - a.median_reviews; });

    // Current filter
    var currentFilter = "all";

    function filterPredicate(d) {
      if (currentFilter === "gems") return d.count < 80 && d.avg_rating > 3.7;
      if (currentFilter === "top-rated") return d.avg_rating >= 3.8;
      if (currentFilter === "high-comp") return d.count >= 100;
      return true;
    }

    // Draw bubbles
    var bubbles = g.selectAll(".matrix-bubble")
      .data(sorted)
      .enter()
      .append("g")
      .attr("class", "matrix-bubble")
      .attr("transform", function (d) { return "translate(" + x(d.count) + "," + y(d.avg_rating) + ")"; })
      .style("cursor", "pointer");

    // Bubble circle
    var circles = bubbles.append("circle")
      .attr("r", 0)
      .attr("fill", function (d) { return stabilityColor(d.std_rating); })
      .attr("opacity", 0.7)
      .attr("stroke", function (d) {
        if (d.count < 80 && d.avg_rating > 3.7) return COLORS.gold;
        return "#fff";
      })
      .attr("stroke-width", function (d) { return (d.count < 80 && d.avg_rating > 3.7) ? 2.5 : 1; });

    // Animate entrance
    circles.transition()
      .duration(800)
      .delay(function (d, i) { return i * 30; })
      .attr("r", function (d) { return r(d.median_reviews); });

    // Label on bubble
    bubbles.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", function (d) { return Math.max(9, r(d.median_reviews) * 0.55) + "px"; })
      .style("font-weight", "700")
      .style("fill", "#fff")
      .style("pointer-events", "none")
      .text(function (d) { return d.cuisine.substring(0, 2).toUpperCase(); })
      .attr("opacity", 0)
      .transition()
      .duration(600)
      .delay(function (d, i) { return 400 + i * 30; })
      .attr("opacity", 0.9);

    // Cuisine name label below gem bubbles
    bubbles.filter(function (d) { return d.count < 80 && d.avg_rating > 3.7; })
      .append("text")
      .attr("class", "gem-label")
      .attr("text-anchor", "middle")
      .attr("dy", function (d) { return r(d.median_reviews) + 14; })
      .style("font-size", "9px")
      .style("font-weight", "700")
      .attr("fill", COLORS.green)
      .text(function (d) { return d.cuisine; });

    // Hover: dim all other bubbles, show tooltip
    bubbles.on("mouseenter", function (event, d) {
      // Dim others
      bubbles.select("circle").transition().duration(150).attr("opacity", 0.15);
      d3.select(this).select("circle")
        .transition().duration(150)
        .attr("opacity", 1)
        .attr("stroke-width", 3);

      var isGem = d.count < 80 && d.avg_rating > 3.7;
      tooltip.html(
        '<div class="tt-cuisine">' + d.cuisine + '</div>' +
        '<div class="tt-row"><span class="tt-label">Restaurants</span><span class="tt-value">' + d.count + '</span></div>' +
        '<div class="tt-row"><span class="tt-label">Avg Rating</span><span class="tt-value">\u2605 ' + d.avg_rating + '</span></div>' +
        '<div class="tt-row"><span class="tt-label">Rating Stability</span><span class="tt-value">' + (d.std_rating < 0.5 ? "Very Stable" : d.std_rating < 0.7 ? "Moderate" : "Volatile") + ' (\u03C3 ' + d.std_rating + ')</span></div>' +
        '<div class="tt-row"><span class="tt-label">Median Reviews</span><span class="tt-value">' + d.median_reviews + '</span></div>' +
        '<div class="tt-row"><span class="tt-label">Opportunity Score</span><span class="tt-value">' + d.opportunity + '</span></div>' +
        (isGem ? '<div class="gem-badge">\u2666 Hidden Gem</div>' : "")
      ).classed("visible", true);

      var rect = container.getBoundingClientRect();
      var tx = event.clientX - rect.left + 20;
      var ty = event.clientY - rect.top - 20;
      if (tx + 220 > container.clientWidth) tx = tx - 260;
      if (ty < 10) ty = 10;
      tooltip.style("left", tx + "px").style("top", ty + "px");
    })
    .on("mousemove", function (event) {
      var rect = container.getBoundingClientRect();
      var tx = event.clientX - rect.left + 20;
      var ty = event.clientY - rect.top - 20;
      if (tx + 220 > container.clientWidth) tx = tx - 260;
      if (ty < 10) ty = 10;
      tooltip.style("left", tx + "px").style("top", ty + "px");
    })
    .on("mouseleave", function () {
      applyFilter(); // restore opacity based on current filter
      d3.select(this).select("circle")
        .transition().duration(150)
        .attr("stroke-width", function (d) { return (d.count < 80 && d.avg_rating > 3.7) ? 2.5 : 1; });
      tooltip.classed("visible", false);
    });

    // Click: show detail card
    bubbles.on("click", function (event, d) {
      event.stopPropagation();
      showCuisineDetail(d, restaurants);
    });

    // Detail card
    function showCuisineDetail(d, restaurants) {
      var detailEl = document.getElementById("cuisine-detail");
      var nameEl = document.getElementById("detail-cuisine-name");
      var contentEl = document.getElementById("detail-content");
      if (!detailEl || !nameEl || !contentEl) return;

      nameEl.textContent = d.cuisine;

      // Find top restaurants for this cuisine
      var cuisineRestaurants = restaurants
        .filter(function (r) { return r.cuisines.indexOf(d.cuisine) >= 0; })
        .sort(function (a, b) { return b.stars - a.stars || b.review_count - a.review_count; })
        .slice(0, 5);

      var isGem = d.count < 80 && d.avg_rating > 3.7;
      var html = "";

      if (isGem) {
        html += '<div style="margin-bottom:10px;"><span class="gem-badge">\u2666 Hidden Gem</span></div>';
      }

      html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:0.82rem;">';
      html += '<div><strong>Restaurants:</strong> ' + d.count + '</div>';
      html += '<div><strong>Avg Rating:</strong> \u2605 ' + d.avg_rating + '</div>';
      html += '<div><strong>Stability:</strong> \u03C3 ' + d.std_rating + '</div>';
      html += '<div><strong>Opportunity:</strong> ' + d.opportunity + '</div>';
      html += '<div><strong>Median Reviews:</strong> ' + d.median_reviews + '</div>';
      html += '<div><strong>Avg Reviews:</strong> ' + Math.round(d.avg_reviews) + '</div>';
      html += '</div>';

      html += '<div style="font-weight:700; margin-bottom:6px; font-size:0.85rem;">Top Restaurants:</div>';
      cuisineRestaurants.forEach(function (r) {
        html += '<div style="margin-bottom:4px; font-size:0.8rem;">\u2605 ' + r.stars + ' <strong>' + r.name + '</strong> (' + fmt(r.review_count) + ' reviews)</div>';
      });

      if (cuisineRestaurants.length === 0) {
        html += '<div style="color:' + COLORS.muted + '; font-size:0.82rem;">No matching restaurants found.</div>';
      }

      // Opportunity score bar
      var oppPct = Math.min(100, ((d.opportunity - 1.2) / (2.1 - 1.2)) * 100);
      html += '<div style="margin-top:12px;">';
      html += '<div style="font-size:0.75rem; font-weight:600; color:' + COLORS.muted + '; margin-bottom:4px;">OPPORTUNITY SCORE</div>';
      html += '<div style="background:' + COLORS.light + '; border-radius:6px; height:10px; overflow:hidden;">';
      html += '<div style="background:' + COLORS.green + '; height:100%; width:' + oppPct + '%; border-radius:6px; transition:width 0.6s;"></div>';
      html += '</div>';
      html += '</div>';

      contentEl.innerHTML = html;
      detailEl.style.display = "block";
    }

    // Close detail
    var closeBtn = document.getElementById("close-cuisine-detail");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        document.getElementById("cuisine-detail").style.display = "none";
      });
    }

    // Filter controls
    function applyFilter() {
      bubbles.select("circle").transition().duration(400)
        .attr("opacity", function (d) { return filterPredicate(d) ? 0.7 : 0.1; });
      bubbles.selectAll("text").transition().duration(400)
        .attr("opacity", function (d) { return filterPredicate(d) ? 0.9 : 0.1; });
    }

    var filterBtns = document.querySelectorAll("#matrix-controls .control-btn");
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filterBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentFilter = btn.getAttribute("data-filter");
        applyFilter();
      });
    });
  }


  // ── 4. VOLATILITY CHART (Spice Meter) ─────────────────────
  function renderVolatilityChart(cuisineData, restaurants) {
    var chartEl = document.getElementById("volatility-chart");
    if (!chartEl) return;

    var data = cuisineData.slice();
    var currentSort = "volatility";
    var minReviews = 10;

    function sortData(d, key) {
      if (key === "volatility") return d.sort(function (a, b) { return a.std_rating - b.std_rating; });
      if (key === "alpha") return d.sort(function (a, b) { return a.cuisine.localeCompare(b.cuisine); });
      if (key === "count") return d.sort(function (a, b) { return b.count - a.count; });
      return d;
    }

    function renderChart() {
      d3.select("#volatility-chart").html("");

      var filtered = data.filter(function (d) { return d.count >= minReviews; });
      sortData(filtered, currentSort);
      var top30 = filtered.slice(0, 30);

      var container = d3.select("#volatility-chart");
      var margin = { top: 10, right: 80, bottom: 40, left: 140 };
      var barHeight = 24;
      var gap = 6;
      var svgHeight = top30.length * (barHeight + gap) + margin.top + margin.bottom;
      var svgWidth = Math.min(600, chartEl.clientWidth);
      var w = svgWidth - margin.left - margin.right;

      var svg = container.append("svg")
        .attr("viewBox", "0 0 " + svgWidth + " " + svgHeight)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var maxStd = d3.max(top30, function (d) { return d.std_rating; }) || 1;
      var xScale = d3.scaleLinear()
        .domain([0, maxStd * 1.1])
        .range([0, w]);

      // Axis
      svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + (svgHeight - margin.bottom) + ")")
        .call(d3.axisBottom(xScale).ticks(4).tickFormat(function (d) { return d.toFixed(2); }))
        .append("text")
        .attr("x", w / 2).attr("y", 32)
        .attr("fill", COLORS.muted)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text("Rating Volatility (\u03C3) \u2192 higher = more risky");

      top30.forEach(function (d, i) {
        var yPos = i * (barHeight + gap);
        var color = stabilityColor(d.std_rating);

        // Cuisine label
        svg.append("text")
          .attr("x", -8)
          .attr("y", yPos + barHeight / 2 + 4)
          .attr("text-anchor", "end")
          .attr("fill", COLORS.dark)
          .style("font-size", "11px")
          .style("font-weight", "600")
          .text(d.cuisine);

        // Background track
        svg.append("rect")
          .attr("x", 0).attr("y", yPos)
          .attr("width", w).attr("height", barHeight)
          .attr("fill", "#f0ebe3").attr("rx", barHeight / 2);

        // Filled bar (animated)
        var barRect = svg.append("rect")
          .attr("x", 0).attr("y", yPos)
          .attr("width", 0).attr("height", barHeight)
          .attr("fill", color).attr("opacity", 0.7).attr("rx", barHeight / 2)
          .style("cursor", "pointer");

        barRect.transition().duration(800).delay(i * 30)
          .attr("width", xScale(d.std_rating));

        // Chili pepper SVG icons
        var pepperCount = volatilityLevel(d.std_rating);
        var pepperGroup = svg.append("g")
          .attr("transform", "translate(" + (w + 6) + "," + yPos + ")");

        for (var p = 0; p < pepperCount; p++) {
          // Chili body
          pepperGroup.append("ellipse")
            .attr("cx", p * 16 + 7)
            .attr("cy", barHeight / 2 + 1)
            .attr("rx", 5)
            .attr("ry", 7)
            .attr("fill", color)
            .attr("opacity", 0.8)
            .attr("transform", "rotate(-10 " + (p * 16 + 7) + " " + (barHeight / 2 + 1) + ")");
          // Small stem
          pepperGroup.append("line")
            .attr("x1", p * 16 + 7).attr("y1", barHeight / 2 - 6)
            .attr("x2", p * 16 + 7).attr("y2", barHeight / 2 - 9)
            .attr("stroke", COLORS.green).attr("stroke-width", 1.5)
            .attr("stroke-linecap", "round");
          // Stem leaf
          pepperGroup.append("path")
            .attr("d", "M" + (p * 16 + 7) + "," + (barHeight / 2 - 7) + " Q" + (p * 16 + 11) + "," + (barHeight / 2 - 10) + " " + (p * 16 + 9) + "," + (barHeight / 2 - 5))
            .attr("fill", COLORS.green).attr("opacity", 0.7);
        }

        // Clickable bar: show distribution
        barRect.on("click", function () {
          showDistribution(d, restaurants);
        });

        // Also make the label clickable
        svg.append("rect")
          .attr("x", -margin.left).attr("y", yPos)
          .attr("width", margin.left).attr("height", barHeight)
          .attr("fill", "transparent")
          .style("cursor", "pointer")
          .on("click", function () { showDistribution(d, restaurants); });
      });
    }

    // Distribution popup
    function showDistribution(cuisineInfo, restaurants) {
      var popup = document.getElementById("distribution-popup");
      var nameEl = document.getElementById("dist-cuisine-name");
      var chartDiv = document.getElementById("dist-chart");
      if (!popup || !nameEl || !chartDiv) return;

      nameEl.textContent = cuisineInfo.cuisine + " Rating Distribution";
      chartDiv.innerHTML = "";
      popup.style.display = "block";

      // Get all restaurants for this cuisine
      var cuisineRestaurants = restaurants.filter(function (r) {
        return r.cuisines.indexOf(cuisineInfo.cuisine) >= 0;
      });

      // Build histogram bins
      var bins = [
        { range: "1-1.5", min: 1, max: 1.5, count: 0 },
        { range: "2-2.5", min: 2, max: 2.5, count: 0 },
        { range: "3-3.5", min: 3, max: 3.5, count: 0 },
        { range: "4-4.5", min: 4, max: 4.5, count: 0 },
        { range: "5", min: 5, max: 5, count: 0 }
      ];

      cuisineRestaurants.forEach(function (r) {
        for (var b = 0; b < bins.length; b++) {
          if (r.stars >= bins[b].min && r.stars <= bins[b].max) {
            bins[b].count++;
            break;
          }
        }
      });

      var maxCount = d3.max(bins, function (b) { return b.count; }) || 1;

      // Draw mini histogram
      var hMargin = { top: 10, right: 10, bottom: 30, left: 40 };
      var hW = 300 - hMargin.left - hMargin.right;
      var hH = 150 - hMargin.top - hMargin.bottom;

      var hSvg = d3.select("#dist-chart").append("svg")
        .attr("viewBox", "0 0 300 150")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .append("g")
        .attr("transform", "translate(" + hMargin.left + "," + hMargin.top + ")");

      var hx = d3.scaleBand()
        .domain(bins.map(function (b) { return b.range; }))
        .range([0, hW])
        .padding(0.2);

      var hy = d3.scaleLinear()
        .domain([0, maxCount * 1.1])
        .range([hH, 0]);

      hSvg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + hH + ")")
        .call(d3.axisBottom(hx))
        .selectAll("text").style("font-size", "9px");

      hSvg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(hy).ticks(4))
        .selectAll("text").style("font-size", "9px");

      hSvg.selectAll(".hist-bar")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", function (b) { return hx(b.range); })
        .attr("y", function (b) { return hy(b.count); })
        .attr("width", hx.bandwidth())
        .attr("height", function (b) { return hH - hy(b.count); })
        .attr("fill", stabilityColor(cuisineInfo.std_rating))
        .attr("opacity", 0.8)
        .attr("rx", 3);

      // Count labels
      hSvg.selectAll(".hist-label")
        .data(bins)
        .enter()
        .append("text")
        .attr("x", function (b) { return hx(b.range) + hx.bandwidth() / 2; })
        .attr("y", function (b) { return hy(b.count) - 4; })
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .style("font-weight", "700")
        .attr("fill", COLORS.dark)
        .text(function (b) { return b.count > 0 ? b.count : ""; });

      // Summary stats below chart
      var summary = d3.select("#dist-chart").append("div")
        .style("margin-top", "8px")
        .style("font-size", "0.8rem")
        .style("color", COLORS.muted);

      summary.html(
        "<strong>" + cuisineInfo.cuisine + "</strong>: " + cuisineInfo.count + " restaurants | " +
        "Avg \u2605 " + cuisineInfo.avg_rating + " | \u03C3 " + cuisineInfo.std_rating +
        " | Median " + cuisineInfo.median_reviews + " reviews"
      );
    }

    // Close distribution
    var closeDistBtn = document.getElementById("close-distribution");
    if (closeDistBtn) {
      closeDistBtn.addEventListener("click", function () {
        document.getElementById("distribution-popup").style.display = "none";
      });
    }

    // Initial render
    renderChart();

    // Sort controls
    var sortBtns = document.querySelectorAll("#volatility-controls .control-btn");
    sortBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        sortBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentSort = btn.getAttribute("data-sort");
        renderChart();
      });
    });

    // Min reviews slider
    var slider = document.getElementById("min-reviews-slider");
    var sliderVal = document.getElementById("min-reviews-value");
    if (slider) {
      slider.addEventListener("input", function () {
        minReviews = parseInt(slider.value, 10);
        if (sliderVal) sliderVal.textContent = minReviews;
        renderChart();
      });
    }
  }


  // ── Scroll Animations ─────────────────────────────────────
  function setupScrollAnimations() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll(".fade-in").forEach(function (el) {
      observer.observe(el);
    });
  }


  // ── Navigation Dots ───────────────────────────────────────
  function setupNavDots() {
    var dots = document.querySelectorAll(".nav-dot");
    var sections = [];

    dots.forEach(function (dot) {
      var target = document.getElementById(dot.dataset.target);
      if (target) sections.push({ dot: dot, target: target });
      dot.addEventListener("click", function () {
        if (target) target.scrollIntoView({ behavior: "smooth" });
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            dots.forEach(function (d) { d.classList.remove("active"); });
            var match = sections.find(function (s) { return s.target === entry.target; });
            if (match) match.dot.classList.add("active");
          }
        });
      },
      { threshold: 0.4 }
    );

    sections.forEach(function (s) { observer.observe(s.target); });
  }


  // ── Journey Recap ─────────────────────────────────────────
  function setupJourneyRecap() {
    var steps = document.querySelectorAll("#journey-recap .recap-step");
    steps.forEach(function (step) {
      step.addEventListener("click", function () {
        var sectionId = step.getAttribute("data-section");
        var section = document.getElementById(sectionId);
        if (section) {
          section.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  }

})();
