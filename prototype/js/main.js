/* ============================================================
   Hidden Gems — Philadelphia Restaurant Market Analysis
   Main D3 visualization code — Complete interactive version V2
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
    d3.json("data/philly_restaurants.json"),
    d3.json("data/hidden_gem_definition.json").catch(function () { return null; }),
    d3.json("data/review_analysis.json").catch(function () { return null; }),
    d3.json("data/stats_deep_dive.json").catch(function () { return null; }),
    d3.json("data/isometric_scene_data.json").catch(function () { return null; }),
  ]).then(function (datasets) {
    var cuisines = datasets[0];
    var restaurants = datasets[1];
    var gemDefinition = datasets[2];
    var reviewAnalysis = datasets[3];
    var statsDeepDive = datasets[4];
    var isometricData = datasets[5];

    // Set up all interactive features
    setupHeroCounter();
    setupQuiz(cuisines);

    // V2: Gem definition section
    if (gemDefinition) {
      setupGemDefinition(gemDefinition, cuisines);
    }

    // V2→V3: Cuisine DNA radar grid (replaces competition, stats, volatility)
    renderCuisineDNA(cuisines, statsDeepDive, gemDefinition);

    // V2: Review section
    if (reviewAnalysis && window.ReviewModule) {
      window.ReviewModule.setup(reviewAnalysis);
    }

    // V2→V3: Opportunity Landscape (replaces scatter + aha matrix)
    renderOpportunityLandscape(cuisines, restaurants);

    // V2: Isometric scene — always build card grid; 3D scene waits for Three.js
    if (isometricData) {
      setupIsometricScene(isometricData, gemDefinition);
    }

    // V2: 3D toggle logic
    setup3DToggles(cuisines, restaurants);

    // Novel Visualization: Cuisine opportunity terrain
    setupCuisineTerrain(cuisines, restaurants);

    setupScrollAnimations();
    setupNavDots();
    setupJourneyRecap();

    // Expose gem data globally for map.js
    if (gemDefinition) {
      window.__gemDefinition = gemDefinition;
    }
  }).catch(function (err) {
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
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(start + (end - start) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function bindVisibilityLifecycle(section, getInstance, options) {
    if (!section || !getInstance || !window.PerfUtils || !window.PerfUtils.observeVisibilityToggle) {
      return null;
    }

    return window.PerfUtils.observeVisibilityToggle(section, function (isVisible) {
      var instance = getInstance();
      if (!instance) return;

      if (isVisible) {
        if (instance.resume) {
          instance.resume();
        } else if (instance.resize) {
          instance.resize();
        }
      } else if (instance.pause) {
        instance.pause();
      }
    }, options || { threshold: 0.05 });
  }


  // ── QUIZ ──────────────────────────────────────────────────
  function setupQuiz(cuisines) {
    var buttons = document.querySelectorAll("#quiz-options .quiz-btn");
    var resultEl = document.getElementById("quiz-result");
    var answered = false;

    var pizzaData = cuisines.find(function (c) { return c.cuisine === "Pizza"; });
    var correctAnswer = "Pizza";

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (answered) return;
        answered = true;

        var chosen = btn.getAttribute("data-answer");
        var isCorrect = chosen === correctAnswer;

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


  // ── V2: GEM DEFINITION SECTION — Crystal Heights ──
  function setupGemDefinition(gemData, cuisines) {
    var chartEl = document.getElementById("gem-ranking-chart");
    if (!chartEl) return;

    var rankings  = gemData.rankings;
    var threshold = gemData.threshold;

    // Publish live scores so downstream sections stay in sync
    window.__liveGemScores = {};
    rankings.forEach(function (d) {
      window.__liveGemScores[d.cuisine] = {
        gem_score: d.gem_score,
        is_gem:    d.gem_score >= threshold
      };
    });
    if (typeof window.__updateBubbleColors === "function") {
      window.__updateBubbleColors();
    }

    // Sort descending and draw
    var sorted = rankings.slice().sort(function (a, b) { return b.gem_score - a.gem_score; });
    drawCrystalChart(chartEl, sorted, threshold);
  }

  function drawCrystalChart(chartEl, sorted, threshold) {
    var n         = sorted.length;
    var crystalW  = 10;
    var gap       = 3;
    var pitch     = crystalW + gap;
    var chartAreaW = n * pitch;

    var maxScore  = d3.max(sorted, function (d) { return d.gem_score; });
    var maxH      = 150;
    var hScale    = d3.scaleLinear().domain([0, maxScore * 1.05]).range([0, maxH]);
    var thresholdH = hScale(threshold);
    var thresholdY = maxH - thresholdH;

    var lMargin = 16, rMargin = 82, tMargin = 38, bMargin = 52;
    var svgW = lMargin + chartAreaW + rMargin;
    var svgH = tMargin + maxH + bMargin;

    // Tooltip
    var tooltip = document.createElement("div");
    tooltip.className = "crystal-tooltip";
    chartEl.style.position = "relative";
    chartEl.appendChild(tooltip);

    var svg = d3.select(chartEl).append("svg")
      .attr("viewBox", "0 0 " + svgW + " " + svgH)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("overflow", "visible");

    // Glow filter
    var defs   = svg.append("defs");
    var filter = defs.append("filter")
      .attr("id", "crystal-glow")
      .attr("x", "-60%").attr("y", "-60%")
      .attr("width", "220%").attr("height", "220%");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "blur");
    var merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    var g = svg.append("g").attr("transform", "translate(" + lMargin + "," + tMargin + ")");

    // Threshold line
    g.append("line")
      .attr("x1", 0).attr("y1", thresholdY)
      .attr("x2", chartAreaW).attr("y2", thresholdY)
      .attr("stroke", COLORS.gold).attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5 3").attr("opacity", 0.85);
    g.append("text")
      .attr("x", chartAreaW + 6).attr("y", thresholdY - 5)
      .attr("fill", COLORS.gold).style("font-size", "8.5px").style("font-weight", "700")
      .text("GEM");
    g.append("text")
      .attr("x", chartAreaW + 6).attr("y", thresholdY + 6)
      .attr("fill", COLORS.gold).style("font-size", "8.5px").style("font-weight", "700")
      .text("THRESHOLD");
    g.append("text")
      .attr("x", chartAreaW / 2).attr("y", thresholdY - 7)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.gold).style("font-size", "8px").style("font-weight", "700")
      .attr("opacity", 0.6).text("\u2726  GEM ZONE  \u2726");

    // Component config (bottom → top draw order)
    var segOrder   = ["demand", "stability", "quality", "low_competition"];
    var segWeights = { low_competition: 0.3, quality: 0.3, stability: 0.2, demand: 0.2 };
    var segColors  = { low_competition: "#5b8cbe", quality: "#3a8c5c", stability: "#2a8a8a", demand: "#e8a838" };
    var segLabels  = { low_competition: "Low Competition", quality: "Quality Rating", stability: "Rating Stability", demand: "Customer Demand" };

    // Draw crystals
    sorted.forEach(function (d, i) {
      var x      = i * pitch;
      var totalH = hScale(d.gem_score);
      var tipH   = Math.max(5, totalH * 0.18);
      var bodyH  = totalH - tipH;
      var isGem  = d.gem_score >= threshold;
      var baseY  = maxH;

      var grp = g.append("g").attr("class", "crystal-col");
      if (isGem) { grp.style("filter", "url(#crystal-glow)"); }

      // Stacked body segments
      var curY = baseY;
      segOrder.forEach(function (k) {
        var contrib = d.gem_score > 0
          ? (d.components[k] * segWeights[k]) / d.gem_score * bodyH
          : bodyH / 4;
        var col = isGem ? segColors[k] : "#9a9090";
        var opa = isGem ? 0.88 : 0.28;
        // Left facet (darker)
        grp.append("rect")
          .attr("x", x).attr("y", curY - contrib)
          .attr("width", crystalW * 0.42).attr("height", Math.max(0.5, contrib))
          .attr("fill", col).attr("opacity", opa * 0.6);
        // Right facet (brighter)
        grp.append("rect")
          .attr("x", x + crystalW * 0.42).attr("y", curY - contrib)
          .attr("width", crystalW * 0.58).attr("height", Math.max(0.5, contrib))
          .attr("fill", col).attr("opacity", opa);
        curY -= contrib;
      });

      // Crystal tip (pointed triangle)
      var tipTopY  = baseY - totalH;
      var tipBaseY = tipTopY + tipH;
      grp.append("polygon")
        .attr("points",
          (x + crystalW / 2) + "," + tipTopY + " " +
          x + "," + tipBaseY + " " +
          (x + crystalW) + "," + tipBaseY)
        .attr("fill", isGem ? "#f0dfa0" : "#c8c0b8")
        .attr("opacity", isGem ? 0.95 : 0.28);

      // Gold sparkle above gem tip
      if (isGem) {
        grp.append("text")
          .attr("x", x + crystalW / 2).attr("y", tipTopY - 3)
          .attr("text-anchor", "middle")
          .style("font-size", "7px")
          .attr("fill", COLORS.gold).attr("opacity", 0.9)
          .text("\u2726");
      }

      // Invisible hover hit area
      grp.append("rect")
        .attr("x", x - 1).attr("y", baseY - totalH - 12)
        .attr("width", crystalW + 2).attr("height", totalH + 12)
        .attr("fill", "transparent").style("cursor", "pointer")
        .on("mouseover", function (event) {
          var breakdown = segOrder.slice().reverse().map(function (k) {
            return '<div class="ct-row">' +
              '<span style="color:' + segColors[k] + '">\u25cf ' + segLabels[k] + '</span>' +
              '<span class="ct-val">' + ((d.components[k] || 0) * segWeights[k]).toFixed(3) + '</span>' +
              '</div>';
          }).join("");
          tooltip.innerHTML =
            '<div class="ct-name" style="color:' + (isGem ? COLORS.gold : "#ccc") + '">' +
            (isGem ? "\u2726 " : "") + d.cuisine + (isGem ? " \u2726" : "") + '</div>' +
            '<div class="ct-score">Gem Score: <strong>' + d.gem_score.toFixed(3) + '</strong>' +
            (isGem ? ' <span class="ct-badge">Hidden Gem</span>' : "") + '</div>' +
            '<div class="ct-divider"></div>' +
            '<div class="ct-breakdown">' + breakdown + '</div>';
          tooltip.style.display = "block";

          var svgNode = svg.node();
          var svgRect = svgNode.getBoundingClientRect();
          var elRect  = chartEl.getBoundingClientRect();
          var scaleX  = svgRect.width  / svgW;
          var scaleY  = svgRect.height / svgH;
          var pixX    = (svgRect.left - elRect.left) + (lMargin + x + crystalW / 2) * scaleX;
          var pixY    = (svgRect.top  - elRect.top)  + (tMargin + baseY - totalH - 14) * scaleY;
          var ttW     = tooltip.offsetWidth  || 180;
          var ttH     = tooltip.offsetHeight || 120;
          var ttLeft  = Math.max(0, pixX - ttW / 2);
          var ttTop   = pixY - ttH - 6;
          if (ttTop < 0) { ttTop = pixY + 18; }
          tooltip.style.left = ttLeft + "px";
          tooltip.style.top  = ttTop  + "px";
        })
        .on("mouseout", function () { tooltip.style.display = "none"; });
    });

    // Color legend
    var legendItems = [
      { label: "Low Competition", color: segColors.low_competition },
      { label: "Quality Rating",  color: segColors.quality },
      { label: "Rating Stability",color: segColors.stability },
      { label: "Customer Demand", color: segColors.demand }
    ];
    var legendG = g.append("g").attr("transform", "translate(0," + (maxH + 16) + ")");
    var colW    = chartAreaW / legendItems.length;
    legendItems.forEach(function (item, i) {
      legendG.append("rect")
        .attr("x", i * colW).attr("y", 0)
        .attr("width", 9).attr("height", 9)
        .attr("fill", item.color).attr("rx", 2);
      legendG.append("text")
        .attr("x", i * colW + 13).attr("y", 8)
        .style("font-size", "9px").attr("fill", COLORS.muted)
        .text(item.label);
    });

    // Gem count annotation
    var gemCount = sorted.filter(function (d) { return d.gem_score >= threshold; }).length;
    g.append("text")
      .attr("x", chartAreaW / 2).attr("y", maxH + 38)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.gold).style("font-size", "9.5px").style("font-weight", "600")
      .text(gemCount + " cuisines qualify as Hidden Gems \u00b7 hover any crystal to explore");

  }


  // ── V2: ISOMETRIC SCENE SETUP ─────────────────────────────
  function setupIsometricScene(sceneData, gemData) {
    var canvas = document.getElementById("isometric-canvas");
    if (!canvas) return;
    var isoInstance = null;
    var isoVisibilityObserver = null;
    var section = document.getElementById("section-restaurant");

    // Cuisine image mapping
    var CUISINE_IMAGES = {
      "Salvadoran": "data/images/salvadoran.png",
      "Tapas/Small Plates": "data/images/tapas.png",
      "Malaysian": "data/images/malaysian.png",
      "Peruvian": "data/images/peruvian.png",
      "Taiwanese": "data/images/taiwanese.png",
      "Indonesian": "data/images/indonesian.png",
      "Polish": "data/images/polish.png",
      "Ramen": "data/images/ramen.png"
    };

    var CUISINE_BADGE_COLORS = {
      "Salvadoran": "#e67e22",
      "Tapas/Small Plates": "#9b59b6",
      "Malaysian": "#16a085",
      "Peruvian": "#c0392b",
      "Taiwanese": "#2980b9",
      "Indonesian": "#27ae60",
      "Polish": "#e74c3c",
      "Ramen": "#d35400"
    };

    // Populate cuisine selector dropdown
    var select = document.getElementById("isometric-cuisine-select");
    if (select && sceneData.length > 0) {
      var defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "— Select a Hidden Gem —";
      select.appendChild(defaultOpt);
      sceneData.forEach(function (d) {
        var opt = document.createElement("option");
        opt.value = d.cuisine;
        opt.textContent = d.name + " · " + d.cuisine + " (\u2605 " + d.stars + ")";
        select.appendChild(opt);
      });
    }

    // Cuisine preview strip — shows image + info when a restaurant is selected
    var previewEl = document.getElementById("iso-cuisine-preview");
    if (select && previewEl) {
      select.addEventListener("change", function () {
        var cuisine = select.value;
        if (!cuisine) {
          previewEl.innerHTML = "";
          previewEl.style.display = "none";
          return;
        }
        var d = sceneData.find(function (r) { return r.cuisine === cuisine; });
        if (!d) return;
        var imgSrc = CUISINE_IMAGES[cuisine] || "";
        var badgeColor = CUISINE_BADGE_COLORS[cuisine] || "#3a8c5c";
        var starsHtml = "";
        for (var s = 0; s < Math.floor(d.stars); s++) starsHtml += "\u2605";
        if (d.stars % 1 >= 0.5) starsHtml += "\u00BD";

        var dishChips = "";
        if (d.top_dishes && d.top_dishes.length > 0) {
          d.top_dishes.slice(0, 3).forEach(function (dish) {
            dishChips += '<span class="iso-preview-dish">' + dish + '</span>';
          });
        }

        var html = '<div class="iso-preview-card">';
        if (imgSrc) {
          html += '<div class="iso-preview-img"><img src="' + imgSrc + '" alt="' + cuisine + '" /></div>';
        }
        html += '<div class="iso-preview-info">' +
          '<div class="iso-preview-name">' + d.name + '</div>' +
          '<div class="iso-preview-meta">' +
          '<span class="iso-preview-badge" style="background:' + badgeColor + ';">' + cuisine + '</span>' +
          '<span class="iso-preview-stars">' + starsHtml + ' ' + d.stars + '</span>' +
          '<span class="iso-preview-reviews">' + d.review_count + ' reviews</span>' +
          '</div>' +
          '<div class="iso-preview-score">' +
          'Gem Rank <strong>#' + d.gem_rank + '</strong> · Score <strong>' + d.gem_score.toFixed(2) + '</strong>' +
          '</div>' +
          '<div class="iso-preview-dishes">' + dishChips + '</div>' +
          '</div></div>';
        previewEl.innerHTML = html;
        previewEl.style.display = "block";
      });
    }

    // Mobile fallback
    var fallbackContent = document.getElementById("isometric-fallback-content");
    if (fallbackContent && sceneData.length > 0) {
      var html = "";
      sceneData.forEach(function (d) {
        html += '<div style="padding:12px; margin-bottom:8px; background:#fff; border-radius:8px; border-left:4px solid ' + COLORS.green + ';">';
        html += '<strong>' + d.name + '</strong> (' + d.cuisine + ')<br/>';
        html += '\u2605 ' + d.stars + ' | ' + d.review_count + ' reviews | Gem Rank #' + d.gem_rank;
        if (d.review_excerpts && d.review_excerpts[0]) {
          html += '<br/><em style="color:' + COLORS.muted + '; font-size:0.85rem;">"' + d.review_excerpts[0].substring(0, 120) + '..."</em>';
        }
        html += '</div>';
      });
      fallbackContent.innerHTML = html;
    }

    // Store globally for info panel
    window.__CUISINE_IMAGES = CUISINE_IMAGES;
    window.__CUISINE_BADGE_COLORS = CUISINE_BADGE_COLORS;
    window.__isoSceneData = sceneData;

    // Tips + hint behavior
    var hintEl = document.getElementById("isometric-hint");
    var onboardingEl = document.getElementById("iso-onboarding");
    var startExploringBtn = document.getElementById("iso-start-exploring");
    var showTipsBtn = document.getElementById("iso-show-tips");

    function hideIsoTips() {
      if (onboardingEl) onboardingEl.classList.add("hidden");
      if (hintEl) hintEl.classList.remove("faded");
      window.__isoTipsDismissed = true;
      setTimeout(function () {
        if (hintEl) hintEl.classList.add("faded");
      }, 5000);
    }

    function showIsoTips() {
      if (onboardingEl) onboardingEl.classList.remove("hidden");
      if (hintEl) hintEl.classList.remove("faded");
      window.__isoTipsDismissed = false;
    }

    if (startExploringBtn) {
      startExploringBtn.addEventListener("click", hideIsoTips);
    }
    if (showTipsBtn) {
      showTipsBtn.addEventListener("click", showIsoTips);
    }

    document.addEventListener("iso:interaction", function () {
      if (!window.__isoTipsDismissed) {
        hideIsoTips();
      }
    });

    // Wait for Three.js to load, then initialize
    var checkThree = setInterval(function () {
      if (window.IsometricModule && typeof THREE !== "undefined") {
        clearInterval(checkThree);
        if (section) {
          var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                observer.disconnect();
                try {
                  isoInstance = window.IsometricModule.init(canvas, sceneData);
                  if (!isoVisibilityObserver) {
                    isoVisibilityObserver = bindVisibilityLifecycle(section, function () {
                      return isoInstance;
                    }, { threshold: 0.05 });
                  }

                  // Keep the original working scene behavior: load the top gem first
                  if (select && sceneData.length > 0) {
                    var topGem = sceneData[0];
                    for (var i = 0; i < select.options.length; i++) {
                      if (select.options[i].value === topGem.cuisine) {
                        select.selectedIndex = i;
                        select.dispatchEvent(new Event("change"));
                        break;
                      }
                    }
                  }

                  // Show onboarding on first view while the restaurant is already visible underneath
                  if (onboardingEl) {
                    onboardingEl.classList.remove("hidden");
                    window.__isoTipsDismissed = false;
                  }
                } catch (e) {
                  console.warn("Isometric scene init error:", e);
                }
              }
            });
          }, { threshold: 0.1 });
          observer.observe(section);
        }
      }
    }, 500);

    setTimeout(function () { clearInterval(checkThree); }, 15000);
  }


  // ── V2: 3D TOGGLE LOGIC ───────────────────────────────────
  function setup3DToggles(cuisines, restaurants) {
    var toggleBtns = document.querySelectorAll(".toggle-3d-btn");
    var threeChartInstances = {};
    var threeChartVisibility = {};

    function isElementInViewport(el) {
      if (!el) return false;
      var rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    }

    toggleBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var chartName = btn.getAttribute("data-chart");
        var wrapper2D, wrapper3D, canvas, section;

        if (chartName === "opportunity") {
          wrapper2D = document.getElementById("opportunity-matrix");
          wrapper3D = document.getElementById("opportunity-3d-wrapper");
          canvas = document.getElementById("opportunity-3d-canvas");
          section = document.getElementById("section-opportunity");
        }

        if (!wrapper2D || !wrapper3D || !canvas) return;

        var is3D = btn.classList.contains("active-3d");

        if (is3D) {
          btn.classList.remove("active-3d");
          btn.textContent = "View in 3D";
          wrapper2D.style.display = "";
          wrapper3D.style.display = "none";
          if (threeChartInstances[chartName] && threeChartInstances[chartName].dispose) {
            threeChartInstances[chartName].dispose();
            threeChartInstances[chartName] = null;
          }
        } else {
          if (typeof THREE === "undefined" || !window.ThreeCharts) {
            btn.textContent = "Loading 3D...";
            setTimeout(function () {
              if (typeof THREE !== "undefined" && window.ThreeCharts) {
                activate3D();
              } else {
                btn.textContent = "3D not available";
              }
            }, 2000);
            return;
          }
          activate3D();
        }

        function activate3D() {
          btn.classList.add("active-3d");
          btn.textContent = "Back to 2D";
          wrapper2D.style.display = "none";
          wrapper3D.style.display = "block";

          // Also hide zoom level 2 if visible
          var zoomEl = document.getElementById("opportunity-zoom");
          if (zoomEl) zoomEl.style.display = "none";

          if (!threeChartInstances[chartName]) {
            requestAnimationFrame(function () {
              var cw = canvas.parentElement.clientWidth || 800;
              var ch = canvas.parentElement.clientHeight || 450;
              canvas.width = cw;
              canvas.height = ch;
              try {
                threeChartInstances[chartName] = window.ThreeCharts.initOpportunity(canvas, cuisines);
                if (!threeChartVisibility[chartName]) {
                  threeChartVisibility[chartName] = {
                    lastVisible: null,
                    sync: function () {
                      var instance = threeChartInstances[chartName];
                      if (!instance) return;

                      var isVisible = wrapper3D.style.display !== "none" && isElementInViewport(wrapper3D);
                      if (threeChartVisibility[chartName].lastVisible === isVisible) return;
                      threeChartVisibility[chartName].lastVisible = isVisible;

                      if (isVisible) {
                        if (instance.resume) {
                          instance.resume();
                        } else if (instance.resize) {
                          instance.resize();
                        }
                      } else if (instance.pause) {
                        instance.pause();
                      }
                    }
                  };
                  window.addEventListener("scroll", threeChartVisibility[chartName].sync, { passive: true });
                  window.addEventListener("resize", threeChartVisibility[chartName].sync);
                }
                threeChartVisibility[chartName].sync();
              } catch (e) {
                console.warn("3D chart init error:", e);
                btn.classList.remove("active-3d");
                btn.textContent = "3D error";
                wrapper2D.style.display = "";
                wrapper3D.style.display = "none";
              }
            });
          }
        }
      });
    });
  }


  // ── Novel Visualization: 3D Cuisine Terrain ───────────────
  function setupCuisineTerrain(cuisines, restaurants) {
    var section = document.getElementById("section-terrain");
    if (!section || !window.CuisineTerrain) return;

    var initialized = false;
    var attempts = 0;
    var maxAttempts = 30;
    var retryTimer = null;
    var terrainInstance = null;
    var terrainVisibilityObserver = null;

    function tryInit() {
      if (initialized) return true;
      if (typeof THREE === "undefined" || !window.CuisineTerrain || !window.CuisineTerrain.init) return false;
      try {
        terrainInstance = window.CuisineTerrain.init({
          canvasId: "terrain-3d-canvas",
          selectId: "terrain-cuisine-select",
          resetBtnId: "terrain-reset-view",
          tooltipId: "terrain-tooltip",
          cuisines: cuisines,
          restaurants: restaurants
        });
        initialized = !!terrainInstance;
        if (initialized && !terrainVisibilityObserver) {
          terrainVisibilityObserver = bindVisibilityLifecycle(section, function () {
            return terrainInstance;
          }, { threshold: 0.05 });
        }
        return true;
      } catch (e) {
        console.warn("Cuisine terrain init error:", e);
        return false;
      }
    }

    function startRetryLoop() {
      if (retryTimer) return;
      retryTimer = setInterval(function () {
        attempts++;
        if (tryInit() || attempts >= maxAttempts) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 400);
    }

    function initWhenVisible() {
      if (tryInit()) return;
      startRetryLoop();
    }

    if (window.PerfUtils && window.PerfUtils.observeOnceWhenVisible) {
      window.PerfUtils.observeOnceWhenVisible(section, initWhenVisible, {
        rootMargin: "320px 0px",
        threshold: 0.05
      });
    } else {
      initWhenVisible();
    }
  }


  // ── 1. CUISINE DNA RADAR GRID (replaces competition + stats + volatility) ──
  function renderCuisineDNA(cuisineData, statsData, gemData) {
    var gridEl = document.getElementById("cuisine-dna-grid");
    if (!gridEl) return;
    gridEl.innerHTML = "";

    var data = cuisineData.slice()
      .filter(function (d) { return d.count >= 5; })
      .slice(0, 20);

    // Compute normalization ranges
    var maxCount = d3.max(data, function (d) { return d.count; }) || 1;
    var maxRating = 5;
    var maxStd = d3.max(data, function (d) { return d.std_rating; }) || 1;
    var maxMedian = d3.max(data, function (d) { return d.median_reviews; }) || 1;
    var maxGem = gemData ? d3.max(gemData.rankings, function (d) { return d.gem_score; }) : 1;
    var gemThreshold = gemData ? gemData.threshold : 0.55;

    // Gem lookup
    var gemLookup = {};
    if (gemData && gemData.rankings) {
      gemData.rankings.forEach(function (r) { gemLookup[r.cuisine] = r; });
    }

    var axes = ["Competition", "Rating", "Stability", "Demand", "Gem Score"];
    var currentSort = "gem";

    function normalize(d) {
      var gemEntry = gemLookup[d.cuisine];
      return [
        1 - Math.min(d.count / maxCount, 1), // Low competition is good
        d.avg_rating / maxRating,
        1 - Math.min(d.std_rating / maxStd, 1), // Low std = stable = good
        Math.min(d.median_reviews / maxMedian, 1),
        gemEntry ? gemEntry.gem_score / maxGem : 0.3
      ];
    }

    function gemColor(d) {
      var gemEntry = gemLookup[d.cuisine];
      if (gemEntry && gemEntry.is_gem) return COLORS.green;
      var gemScore = gemEntry ? gemEntry.gem_score : 0;
      if (gemScore > gemThreshold * 0.8) return COLORS.gold;
      return COLORS.muted;
    }

    function sortData(key) {
      if (key === "gem") {
        data.sort(function (a, b) {
          var ga = gemLookup[a.cuisine] ? gemLookup[a.cuisine].gem_score : 0;
          var gb = gemLookup[b.cuisine] ? gemLookup[b.cuisine].gem_score : 0;
          return gb - ga;
        });
      } else if (key === "competition") {
        data.sort(function (a, b) { return a.count - b.count; });
      } else if (key === "rating") {
        data.sort(function (a, b) { return b.avg_rating - a.avg_rating; });
      }
    }

    function drawRadar(container, d, size) {
      var center = size / 2;
      var radius = size / 2 - 20;
      var values = normalize(d);
      var color = gemColor(d);

      var svg = d3.select(container).append("svg")
        .attr("viewBox", "0 0 " + size + " " + size)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%");

      var g = svg.append("g")
        .attr("transform", "translate(" + center + "," + center + ")");

      // Grid circles
      [0.25, 0.5, 0.75, 1.0].forEach(function (level) {
        var pts = [];
        for (var i = 0; i < 5; i++) {
          var angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          pts.push(Math.cos(angle) * radius * level + "," + Math.sin(angle) * radius * level);
        }
        g.append("polygon")
          .attr("points", pts.join(" "))
          .attr("fill", "none")
          .attr("stroke", "#e0dcd5")
          .attr("stroke-width", 0.5);
      });

      // Axis lines
      for (var i = 0; i < 5; i++) {
        var angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.append("line")
          .attr("x1", 0).attr("y1", 0)
          .attr("x2", Math.cos(angle) * radius)
          .attr("y2", Math.sin(angle) * radius)
          .attr("stroke", "#d4cfc5")
          .attr("stroke-width", 0.5);
      }

      // Gem threshold ring
      if (gemThreshold > 0) {
        var threshPts = [];
        var threshLevel = gemThreshold / maxGem;
        for (var ti = 0; ti < 5; ti++) {
          var ta = (ti / 5) * Math.PI * 2 - Math.PI / 2;
          threshPts.push(Math.cos(ta) * radius * threshLevel + "," + Math.sin(ta) * radius * threshLevel);
        }
        g.append("polygon")
          .attr("points", threshPts.join(" "))
          .attr("fill", "none")
          .attr("stroke", COLORS.gold)
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,2")
          .attr("opacity", 0.6);
      }

      // Data polygon
      var dataPts = [];
      for (var vi = 0; vi < 5; vi++) {
        var va = (vi / 5) * Math.PI * 2 - Math.PI / 2;
        dataPts.push(Math.cos(va) * radius * values[vi] + "," + Math.sin(va) * radius * values[vi]);
      }
      g.append("polygon")
        .attr("points", dataPts.join(" "))
        .attr("fill", color)
        .attr("fill-opacity", 0.25)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("opacity", 0)
        .transition().duration(600)
        .attr("opacity", 1);

      // Data dots
      for (var di = 0; di < 5; di++) {
        var da = (di / 5) * Math.PI * 2 - Math.PI / 2;
        g.append("circle")
          .attr("cx", Math.cos(da) * radius * values[di])
          .attr("cy", Math.sin(da) * radius * values[di])
          .attr("r", 3)
          .attr("fill", color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);
      }

      // Axis labels (tiny, at edges)
      var shortLabels = ["Comp", "Rate", "Stable", "Demand", "Gem"];
      for (var li = 0; li < 5; li++) {
        var la = (li / 5) * Math.PI * 2 - Math.PI / 2;
        var lx = Math.cos(la) * (radius + 12);
        var ly = Math.sin(la) * (radius + 12);
        g.append("text")
          .attr("x", lx).attr("y", ly + 3)
          .attr("text-anchor", "middle")
          .attr("fill", COLORS.muted)
          .style("font-size", "7px")
          .text(shortLabels[li]);
      }

      // Cuisine name below
      svg.append("text")
        .attr("x", center).attr("y", size - 3)
        .attr("text-anchor", "middle")
        .attr("fill", COLORS.dark)
        .style("font-size", "10px")
        .style("font-weight", "700")
        .text(d.cuisine);
    }

    function renderGrid() {
      gridEl.innerHTML = "";
      sortData(currentSort);

      data.forEach(function (d, i) {
        var cell = document.createElement("div");
        cell.className = "radar-cell";
        cell.style.cursor = "pointer";
        cell.addEventListener("click", function () {
          showExpandedRadar(d);
        });
        gridEl.appendChild(cell);
        drawRadar(cell, d, 160);

        // Creative enhancements below the radar SVG

        // 1. Gem badge for gem cuisines
        var gemEntry = gemLookup[d.cuisine];
        if (gemEntry && gemEntry.is_gem) {
          var badge = document.createElement("div");
          badge.className = "radar-gem-badge";
          badge.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,0 10,5 16,6 11.5,10.5 12.5,16 8,13 3.5,16 4.5,10.5 0,6 6,5" fill="#e8a838"/></svg> Hidden Gem';
          cell.appendChild(badge);
        }

        // 2. Competition heat strip (green→yellow→red gradient bar)
        var compRatio = Math.min(d.count / maxCount, 1);
        var stripWrap = document.createElement("div");
        stripWrap.className = "radar-heat-strip";
        var strip = document.createElement("div");
        strip.className = "radar-heat-fill";
        strip.style.width = (compRatio * 100) + "%";
        strip.style.background = compRatio < 0.3 ? COLORS.green : compRatio < 0.6 ? COLORS.gold : COLORS.red;
        stripWrap.appendChild(strip);
        cell.appendChild(stripWrap);

        // 3. Storefront icons row (proportional to restaurant count, max 10 houses)
        var houseCount = Math.max(1, Math.min(10, Math.round(d.count / (maxCount / 10))));
        var housesDiv = document.createElement("div");
        housesDiv.className = "radar-houses";
        var houseColor = gemEntry && gemEntry.is_gem ? COLORS.green : COLORS.muted;
        for (var hi = 0; hi < houseCount; hi++) {
          housesDiv.innerHTML += storefrontIcon(houseColor);
        }
        cell.appendChild(housesDiv);
      });
    }

    function showExpandedRadar(d) {
      var expandedEl = document.getElementById("radar-expanded");
      var contentEl = document.getElementById("radar-expanded-content");
      if (!expandedEl || !contentEl) return;
      contentEl.innerHTML = "";
      expandedEl.style.display = "block";

      var values = normalize(d);
      var gemEntry = gemLookup[d.cuisine];
      var color = gemColor(d);

      // Large radar
      var radarDiv = document.createElement("div");
      radarDiv.style.maxWidth = "400px";
      radarDiv.style.margin = "0 auto";
      contentEl.appendChild(radarDiv);
      drawRadar(radarDiv, d, 360);

      // Stats detail
      var statsHtml = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; font-size:0.85rem;">';
      statsHtml += '<div><strong>Restaurants:</strong> ' + fmt(d.count) + '</div>';
      statsHtml += '<div><strong>Avg Rating:</strong> \u2605 ' + d.avg_rating.toFixed(2) + '</div>';
      statsHtml += '<div><strong>Stability (\u03C3):</strong> ' + d.std_rating.toFixed(3) + '</div>';
      statsHtml += '<div><strong>Median Reviews:</strong> ' + fmt(d.median_reviews) + '</div>';
      if (gemEntry) {
        statsHtml += '<div><strong>Gem Score:</strong> ' + gemEntry.gem_score.toFixed(3) + '</div>';
        statsHtml += '<div><strong>Is Gem:</strong> ' + (gemEntry.is_gem ? '<span style="color:' + COLORS.green + '; font-weight:700;">\u2713 Yes</span>' : 'No') + '</div>';
      }
      statsHtml += '</div>';

      // Competition intensity meter (pepper icons)
      var compLevel = volatilityLevel(d.std_rating);
      var compRatio = Math.min(d.count / maxCount, 1);
      var pepperCount = Math.max(1, Math.min(5, Math.ceil(compRatio * 5)));
      statsHtml += '<div style="margin-top:16px; display:flex; align-items:center; gap:12px;">';
      statsHtml += '<div style="font-size:0.82rem; font-weight:700; color:' + COLORS.dark + ';">Competition Intensity:</div>';
      statsHtml += '<div style="display:flex; gap:2px;">';
      for (var pi = 0; pi < 5; pi++) {
        var pepperActive = pi < pepperCount;
        statsHtml += '<svg width="20" height="24" viewBox="0 0 20 24">' +
          '<path d="M10 2 Q8 0 10 0 Q12 0 10 2" fill="' + (pepperActive ? '#27ae60' : '#ddd') + '" stroke="none"/>' +
          '<path d="M6 6 Q3 10 4 16 Q5 22 10 23 Q15 22 16 16 Q17 10 14 6 Q12 3 10 3 Q8 3 6 6Z" ' +
          'fill="' + (pepperActive ? (pi < 3 ? '#e67e22' : '#d4503a') : '#e0dcd5') + '"/>' +
          '<ellipse cx="8" cy="12" rx="2" ry="4" fill="' + (pepperActive ? '#f39c12' : '#eee') + '" opacity="0.5"/>' +
          '</svg>';
      }
      statsHtml += '</div>';
      statsHtml += '<span style="font-size:0.78rem; color:' + COLORS.muted + ';">' + d.count + ' restaurants</span>';
      statsHtml += '</div>';

      // Visual opportunity score meter
      var gemScore = gemEntry ? gemEntry.gem_score : 0;
      var meterPct = Math.min((gemScore / maxGem) * 100, 100);
      var meterColor = gemEntry && gemEntry.is_gem ? COLORS.green : (gemScore > gemThreshold * 0.8 ? COLORS.gold : COLORS.muted);
      statsHtml += '<div style="margin-top:12px;">';
      statsHtml += '<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; margin-bottom:4px;">';
      statsHtml += '<span style="font-weight:700; color:' + COLORS.dark + ';">Opportunity Score</span>';
      statsHtml += '<span style="font-weight:700; color:' + meterColor + ';">' + (gemScore > 0 ? gemScore.toFixed(3) : 'N/A') + '</span>';
      statsHtml += '</div>';
      statsHtml += '<div style="height:12px; background:' + COLORS.light + '; border-radius:6px; overflow:hidden; position:relative;">';
      statsHtml += '<div style="height:100%; width:' + meterPct + '%; background: linear-gradient(90deg, ' + COLORS.teal + ', ' + meterColor + '); border-radius:6px; transition:width 0.8s ease;"></div>';
      if (gemThreshold > 0) {
        var threshPct = Math.min((gemThreshold / maxGem) * 100, 100);
        statsHtml += '<div style="position:absolute; left:' + threshPct + '%; top:0; bottom:0; width:2px; background:' + COLORS.gold + ';"></div>';
      }
      statsHtml += '</div>';
      statsHtml += '<div style="font-size:0.7rem; color:' + COLORS.muted + '; margin-top:2px;">Gold line = gem threshold</div>';
      statsHtml += '</div>';

      // CI whiskers if stats available
      if (statsData && statsData[d.cuisine]) {
        var sd = statsData[d.cuisine];
        statsHtml += '<div style="margin-top:16px; padding:12px; background:' + COLORS.light + '; border-radius:8px; font-size:0.82rem;">';
        statsHtml += '<strong>95% Confidence Interval:</strong> [' + sd.ci_lower.toFixed(3) + ', ' + sd.ci_upper.toFixed(3) + ']';
        if (sd.p_value !== undefined) {
          statsHtml += ' | <strong>p-value:</strong> ' + (sd.p_value < 0.001 ? "< 0.001" : sd.p_value.toFixed(3));
          statsHtml += ' | ' + (sd.significant ? '<span style="color:' + COLORS.green + '">Statistically significant</span>' : '<span style="color:' + COLORS.muted + '">Not significant</span>');
        }
        statsHtml += '</div>';
      }

      var statsDiv = document.createElement("div");
      statsDiv.innerHTML = statsHtml;
      contentEl.appendChild(statsDiv);
    }

    var closeRadarBtn = document.getElementById("close-radar");
    if (closeRadarBtn) {
      closeRadarBtn.addEventListener("click", function () {
        document.getElementById("radar-expanded").style.display = "none";
      });
    }

    // Sort controls
    var sortBtns = document.querySelectorAll("#radar-controls .control-btn");
    sortBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        sortBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentSort = btn.getAttribute("data-sort");
        renderGrid();
      });
    });

    // Compare widget
    setupRadarCompare(cuisineData, statsData, gemData);

    renderGrid();
  }

  function setupRadarCompare(cuisineData, statsData, gemData) {
    var sel1 = document.getElementById("radar-compare-1");
    var sel2 = document.getElementById("radar-compare-2");
    var compContainer = document.getElementById("radar-comparison");
    if (!sel1 || !sel2 || !compContainer) return;

    var names = cuisineData.map(function (d) { return d.cuisine; }).sort();
    [sel1, sel2].forEach(function (sel, idx) {
      sel.innerHTML = "";
      names.forEach(function (name, i) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
      if (idx === 0) sel.value = names.indexOf("Pizza") >= 0 ? "Pizza" : names[0];
      if (idx === 1) sel.value = names.indexOf("Ethiopian") >= 0 ? "Ethiopian" : (names[1] || names[0]);
    });

    function updateCompare() {
      compContainer.innerHTML = "";
      var c1 = cuisineData.find(function (d) { return d.cuisine === sel1.value; });
      var c2 = cuisineData.find(function (d) { return d.cuisine === sel2.value; });
      if (!c1 || !c2) return;

      // Draw overlaid comparison radar + distribution histograms
      var wrapper = document.createElement("div");
      wrapper.style.display = "grid";
      wrapper.style.gridTemplateColumns = "1fr 1fr";
      wrapper.style.gap = "24px";
      wrapper.style.alignItems = "start";
      compContainer.appendChild(wrapper);

      // Overlaid radar
      var radarDiv = document.createElement("div");
      wrapper.appendChild(radarDiv);

      var maxCount = d3.max(cuisineData, function (d) { return d.count; }) || 1;
      var maxStd = d3.max(cuisineData, function (d) { return d.std_rating; }) || 1;
      var maxMedian = d3.max(cuisineData, function (d) { return d.median_reviews; }) || 1;
      var maxGem = gemData ? d3.max(gemData.rankings, function (d) { return d.gem_score; }) : 1;
      var gemLookup = {};
      if (gemData && gemData.rankings) {
        gemData.rankings.forEach(function (r) { gemLookup[r.cuisine] = r; });
      }

      function normVals(d) {
        var ge = gemLookup[d.cuisine];
        return [
          1 - Math.min(d.count / maxCount, 1),
          d.avg_rating / 5,
          1 - Math.min(d.std_rating / maxStd, 1),
          Math.min(d.median_reviews / maxMedian, 1),
          ge ? ge.gem_score / maxGem : 0.3
        ];
      }

      var size = 300, center = size / 2, radius = size / 2 - 30;
      var svg = d3.select(radarDiv).append("svg")
        .attr("viewBox", "0 0 " + size + " " + size)
        .style("width", "100%");
      var g = svg.append("g").attr("transform", "translate(" + center + "," + center + ")");

      // Grid
      [0.25, 0.5, 0.75, 1.0].forEach(function (level) {
        var pts = [];
        for (var i = 0; i < 5; i++) {
          var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          pts.push(Math.cos(a) * radius * level + "," + Math.sin(a) * radius * level);
        }
        g.append("polygon").attr("points", pts.join(" ")).attr("fill", "none").attr("stroke", "#e0dcd5").attr("stroke-width", 0.5);
      });

      var shortLabels = ["Low Comp", "Rating", "Stability", "Demand", "Gem"];
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", Math.cos(a) * radius).attr("y2", Math.sin(a) * radius).attr("stroke", "#d4cfc5").attr("stroke-width", 0.5);
        g.append("text").attr("x", Math.cos(a) * (radius + 14)).attr("y", Math.sin(a) * (radius + 14) + 3).attr("text-anchor", "middle").attr("fill", COLORS.muted).style("font-size", "8px").text(shortLabels[i]);
      }

      // Draw both polygons
      var colors = ["#5b8cbe", COLORS.gold];
      [c1, c2].forEach(function (c, idx) {
        var vals = normVals(c);
        var pts = [];
        for (var vi = 0; vi < 5; vi++) {
          var va = (vi / 5) * Math.PI * 2 - Math.PI / 2;
          pts.push(Math.cos(va) * radius * vals[vi] + "," + Math.sin(va) * radius * vals[vi]);
        }
        g.append("polygon").attr("points", pts.join(" ")).attr("fill", colors[idx]).attr("fill-opacity", 0.15).attr("stroke", colors[idx]).attr("stroke-width", 2);
      });

      // Legend
      svg.append("text").attr("x", 10).attr("y", size - 5).attr("fill", "#5b8cbe").style("font-size", "10px").style("font-weight", "700").text("\u25CF " + c1.cuisine);
      svg.append("text").attr("x", size / 2 + 10).attr("y", size - 5).attr("fill", COLORS.gold).style("font-size", "10px").style("font-weight", "700").text("\u25CF " + c2.cuisine);

      // Distribution histograms (if stats data available)
      var histDiv = document.createElement("div");
      wrapper.appendChild(histDiv);
      if (statsData && statsData[c1.cuisine] && statsData[c2.cuisine]) {
        renderCompareHistograms(histDiv, statsData, c1.cuisine, c2.cuisine);
      } else {
        histDiv.innerHTML = '<p style="color:' + COLORS.muted + '; font-size:0.85rem; padding:20px;">Distribution data not available for these cuisines.</p>';
      }
    }

    function renderCompareHistograms(container, statsData, name1, name2) {
      var d1 = statsData[name1];
      var d2 = statsData[name2];
      if (!d1 || !d2 || !d1.histogram || !d2.histogram) return;

      var stars = ["1", "2", "3", "4", "5"];
      var total1 = d3.sum(stars, function (s) { return d1.histogram[s] || 0; });
      var total2 = d3.sum(stars, function (s) { return d2.histogram[s] || 0; });
      var pct1 = stars.map(function (s) { return total1 > 0 ? ((d1.histogram[s] || 0) / total1) * 100 : 0; });
      var pct2 = stars.map(function (s) { return total2 > 0 ? ((d2.histogram[s] || 0) / total2) * 100 : 0; });
      var maxPct = Math.max(d3.max(pct1), d3.max(pct2)) * 1.15;

      var margin = { top: 30, right: 10, bottom: 30, left: 35 };
      var w = 260, h = 200;
      var svg = d3.select(container).append("svg")
        .attr("viewBox", "0 0 " + w + " " + h)
        .style("width", "100%")
        .append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var chartW = w - margin.left - margin.right;
      var chartH = h - margin.top - margin.bottom;

      var x = d3.scaleBand().domain(stars).range([0, chartW]).padding(0.15);
      var y = d3.scaleLinear().domain([0, maxPct]).range([chartH, 0]);

      svg.append("g").attr("class", "axis").attr("transform", "translate(0," + chartH + ")")
        .call(d3.axisBottom(x).tickFormat(function (d) { return d + "\u2605"; }))
        .selectAll("text").style("font-size", "9px");
      svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4).tickFormat(function (d) { return d.toFixed(0) + "%"; }))
        .selectAll("text").style("font-size", "8px");

      var barW = x.bandwidth() / 2 - 1;
      stars.forEach(function (s, i) {
        svg.append("rect").attr("x", x(s)).attr("y", y(pct1[i])).attr("width", barW).attr("height", chartH - y(pct1[i])).attr("fill", "#5b8cbe").attr("opacity", 0.7).attr("rx", 2);
        svg.append("rect").attr("x", x(s) + barW + 2).attr("y", y(pct2[i])).attr("width", barW).attr("height", chartH - y(pct2[i])).attr("fill", COLORS.gold).attr("opacity", 0.7).attr("rx", 2);
      });

      svg.append("text").attr("x", chartW / 2).attr("y", -10).attr("text-anchor", "middle").attr("fill", COLORS.muted).style("font-size", "9px").text("Rating Distribution (%)");
    }

    sel1.addEventListener("change", updateCompare);
    sel2.addEventListener("change", updateCompare);
    updateCompare();
  }


  // ── 2. OPPORTUNITY LANDSCAPE (Zoomable Bubble→Scatter) ───
  // Replaces: old renderScatterPlot + renderOpportunityMatrix + renderVolatilityChart
  function renderOpportunityLandscape(cuisineData, restaurants) {
    var container = document.getElementById("opportunity-matrix");
    var zoomContainer = document.getElementById("opportunity-zoom");
    var zoomTitle = document.getElementById("zoom-cuisine-title");
    var zoomScatter = document.getElementById("zoom-scatter");
    var backBtn = document.getElementById("zoom-back-btn");
    if (!container) return;
    container.style.position = "relative";
    container.innerHTML = "";

    var allData = cuisineData.filter(function (d) { return d.count >= 5; });

    var margin = { top: 40, right: 40, bottom: 60, left: 65 };
    var fullWidth = Math.min(800, container.clientWidth || 800);
    var width = fullWidth - margin.left - margin.right;
    var height = 550 - margin.top - margin.bottom;

    var svg = d3.select("#opportunity-matrix")
      .append("svg")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleLog()
      .domain([4, d3.max(allData, function (d) { return d.count; }) * 1.2])
      .range([0, width]);

    var y = d3.scaleLinear()
      .domain([2.8, 4.8])
      .range([height, 0]);

    var r = d3.scaleSqrt()
      .domain([0, d3.max(allData, function (d) { return d.median_reviews; })])
      .range([6, 32]);

    var xMid = x(80);
    var yMid = y(3.7);

    // Quadrant backgrounds
    g.append("rect").attr("x", 0).attr("y", 0).attr("width", xMid).attr("height", yMid)
      .attr("fill", "rgba(58, 140, 92, 0.06)").attr("rx", 8);
    g.append("rect").attr("x", xMid).attr("y", yMid).attr("width", width - xMid).attr("height", height - yMid)
      .attr("fill", "rgba(212, 80, 58, 0.04)").attr("rx", 8);

    // Quadrant labels
    g.append("text").attr("x", xMid / 2).attr("y", 18).attr("text-anchor", "middle")
      .attr("fill", COLORS.green).attr("opacity", 0.7)
      .style("font-size", "13px").style("font-weight", "800").style("letter-spacing", "1px")
      .text("\u2666 HIDDEN GEMS");
    g.append("text").attr("x", xMid + (width - xMid) / 2).attr("y", 18).attr("text-anchor", "middle")
      .attr("fill", COLORS.teal).attr("opacity", 0.5)
      .style("font-size", "11px").style("font-weight", "700").text("ESTABLISHED WINNERS");
    g.append("text").attr("x", xMid + (width - xMid) / 2).attr("y", height - 6).attr("text-anchor", "middle")
      .attr("fill", COLORS.red).attr("opacity", 0.5)
      .style("font-size", "11px").style("font-weight", "700").text("RED OCEAN");
    g.append("text").attr("x", xMid / 2).attr("y", height - 6).attr("text-anchor", "middle")
      .attr("fill", COLORS.muted).attr("opacity", 0.5)
      .style("font-size", "11px").style("font-weight", "700").text("RISKY BETS");

    // Quadrant divider lines
    g.append("line").attr("class", "quadrant-line").attr("x1", xMid).attr("y1", 0).attr("x2", xMid).attr("y2", height);
    g.append("line").attr("class", "quadrant-line").attr("x1", 0).attr("y1", yMid).attr("x2", width).attr("y2", yMid);

    // Axes
    g.append("g").attr("class", "axis").attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(6, "~s"))
      .append("text").attr("x", width / 2).attr("y", 45).attr("fill", COLORS.muted)
      .attr("text-anchor", "middle").style("font-size", "12px")
      .text("\u2190 Less Competition          More Competition \u2192");
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6))
      .append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -45)
      .attr("fill", COLORS.muted).attr("text-anchor", "middle").style("font-size", "12px")
      .text("\u2605 Average Rating (higher = better)");

    var tooltip = d3.select("#opportunity-matrix").append("div").attr("class", "bubble-tooltip");

    var sorted = allData.slice().sort(function (a, b) { return b.median_reviews - a.median_reviews; });
    var currentFilter = "all";

    // Gem classification
    var gemCuisineSet = {};
    if (window.__gemDefinition && window.__gemDefinition.gem_cuisines) {
      window.__gemDefinition.gem_cuisines.forEach(function (c) { gemCuisineSet[c] = true; });
    }

    function isGemCuisine(d) {
      // Prefer the live formula-adjusted scores when available
      if (window.__liveGemScores && window.__liveGemScores[d.cuisine] !== undefined) {
        return window.__liveGemScores[d.cuisine].is_gem;
      }
      if (Object.keys(gemCuisineSet).length > 0) return !!gemCuisineSet[d.cuisine];
      return d.count < 80 && d.avg_rating > 3.7;
    }

    function filterPredicate(d) {
      if (currentFilter === "gems") return isGemCuisine(d);
      if (currentFilter === "top-rated") return d.avg_rating >= 3.8;
      if (currentFilter === "high-comp") return d.count >= 100;
      return true;
    }

    // Bubble groups
    var bubbles = g.selectAll(".matrix-bubble").data(sorted).enter()
      .append("g").attr("class", "matrix-bubble")
      .attr("transform", function (d) { return "translate(" + x(d.count) + "," + y(d.avg_rating) + ")"; })
      .style("cursor", "pointer");

    var circles = bubbles.append("circle").attr("r", 0)
      .attr("fill", function (d) { return stabilityColor(d.std_rating); })
      .attr("opacity", 0.7)
      .attr("stroke", function (d) { return isGemCuisine(d) ? COLORS.gold : "#fff"; })
      .attr("stroke-width", function (d) { return isGemCuisine(d) ? 2.5 : 1; });

    circles.transition().duration(800).delay(function (d, i) { return i * 30; })
      .attr("r", function (d) { return r(d.median_reviews); });

    // Animated pulse rings for gem cuisines (appear behind the bubble)
    bubbles.filter(function (d) { return isGemCuisine(d); })
      .insert("circle", ":first-child").attr("r", function (d) { return r(d.median_reviews) + 4; })
      .attr("fill", "none").attr("stroke", COLORS.gold).attr("stroke-width", 2)
      .attr("opacity", 0.6).attr("class", "gem-pulse-ring");

    // Storefront icon inside gem bubbles (SVG foreignObject)
    bubbles.filter(function (d) { return isGemCuisine(d) && r(d.median_reviews) >= 14; })
      .append("g").attr("class", "bubble-storefront")
      .attr("transform", function (d) {
        var s = Math.max(0.6, Math.min(1.2, r(d.median_reviews) / 20));
        return "translate(-7,-10) scale(" + s + ")";
      })
      .each(function () {
        var gg = d3.select(this);
        gg.append("rect").attr("x", 1).attr("y", 4).attr("width", 12).attr("height", 11).attr("rx", 1.5).attr("fill", "#faf6f0").attr("opacity", 0.85);
        gg.append("polygon").attr("points", "0,5 7,0 14,5").attr("fill", "#faf6f0");
        gg.append("rect").attr("x", 3).attr("y", 6).attr("width", 3).attr("height", 3).attr("rx", 0.5).attr("fill", COLORS.green).attr("opacity", 0.5);
        gg.append("rect").attr("x", 8).attr("y", 6).attr("width", 3).attr("height", 3).attr("rx", 0.5).attr("fill", COLORS.green).attr("opacity", 0.5);
        gg.append("rect").attr("x", 5).attr("y", 10).attr("width", 4).attr("height", 5).attr("rx", 0.5).attr("fill", "#faf6f0").attr("opacity", 0.3);
      }).style("pointer-events", "none");

    // Abbreviation labels for non-gem/smaller bubbles; star rating for gems
    bubbles.append("text").attr("text-anchor", "middle").attr("dy", function (d) {
      return isGemCuisine(d) && r(d.median_reviews) >= 14 ? "1.2em" : "0.35em";
    })
      .style("font-size", function (d) { return Math.max(9, r(d.median_reviews) * 0.5) + "px"; })
      .style("font-weight", "700").style("fill", "#fff").style("pointer-events", "none")
      .text(function (d) {
        if (isGemCuisine(d)) return "\u2605 " + d.avg_rating.toFixed(1);
        return d.cuisine.substring(0, 2).toUpperCase();
      })
      .attr("opacity", 0).transition().duration(600).delay(function (d, i) { return 400 + i * 30; }).attr("opacity", 0.9);

    // Gem labels below gems
    bubbles.filter(function (d) { return isGemCuisine(d); })
      .append("text").attr("class", "gem-label").attr("text-anchor", "middle")
      .attr("dy", function (d) { return r(d.median_reviews) + 14; })
      .style("font-size", "9px").style("font-weight", "700").attr("fill", COLORS.green)
      .text(function (d) { return d.cuisine; });

    // Hover interactions
    bubbles.on("mouseenter", function (event, d) {
      bubbles.select("circle").transition().duration(150).attr("opacity", 0.15);
      d3.select(this).select("circle").transition().duration(150).attr("opacity", 1).attr("stroke-width", 3);

      var isGem = isGemCuisine(d);
      tooltip.html(
        '<div class="tt-cuisine">' + d.cuisine + '</div>' +
        '<div class="tt-row"><span class="tt-label">Restaurants</span><span class="tt-value">' + d.count + '</span></div>' +
        '<div class="tt-row"><span class="tt-label">Avg Rating</span><span class="tt-value">\u2605 ' + d.avg_rating + '</span></div>' +
        '<div class="tt-row"><span class="tt-label">Stability</span><span class="tt-value">' + (d.std_rating < 0.5 ? "Very Stable" : d.std_rating < 0.7 ? "Moderate" : "Volatile") + ' (\u03C3 ' + d.std_rating + ')</span></div>' +
        '<div class="tt-row"><span class="tt-label">Median Reviews</span><span class="tt-value">' + d.median_reviews + '</span></div>' +
        (isGem ? '<div class="gem-badge">\u2666 Hidden Gem</div>' : '') +
        '<div style="margin-top:6px; font-size:0.7rem; color:#b8a890;">Click to zoom into restaurants</div>'
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
        applyFilter();
        d3.select(this).select("circle").transition().duration(150)
          .attr("stroke-width", function (d) { return isGemCuisine(d) ? 2.5 : 1; });
        tooltip.classed("visible", false);
      });

    // ── INVEST MODE state ─────────────────────────────────────
    var investState = { chips: [], activeChipIndex: null, revealed: false };

    // Click → if a chip is active, invest it; otherwise zoom into cuisine
    bubbles.on("click", function (event, d) {
      event.stopPropagation();
      if (investState.activeChipIndex !== null && !investState.revealed) {
        placeInvestChip(d, d3.select(this));
      } else if (!investState.revealed) {
        zoomToCuisine(d);
      }
    });

    function zoomToCuisine(d) {
      if (!zoomContainer || !zoomScatter || !zoomTitle) return;

      // Hide bubble chart, show zoom view
      container.style.display = "none";
      zoomContainer.style.display = "block";
      zoomTitle.textContent = d.cuisine + " — Individual Restaurants";
      zoomScatter.innerHTML = "";

      var cuisineRestaurants = restaurants
        .filter(function (r) { return r.cuisines && r.cuisines.indexOf(d.cuisine) >= 0 && r.review_count >= 3; })
        .sort(function (a, b) { return b.stars - a.stars || b.review_count - a.review_count; });

      if (cuisineRestaurants.length === 0) {
        zoomScatter.innerHTML = '<p style="color:' + COLORS.muted + '; text-align:center; padding:40px;">No restaurants found for this cuisine.</p>';
        return;
      }

      var zm = { top: 20, right: 30, bottom: 50, left: 55 };
      var zw = Math.min(700, (zoomScatter.clientWidth || 700)) - zm.left - zm.right;
      var zh = 400 - zm.top - zm.bottom;

      var zsvg = d3.select(zoomScatter).append("svg")
        .attr("viewBox", "0 0 " + (zw + zm.left + zm.right) + " " + (zh + zm.top + zm.bottom))
        .attr("preserveAspectRatio", "xMidYMid meet").style("width", "100%");
      var zg = zsvg.append("g").attr("transform", "translate(" + zm.left + "," + zm.top + ")");

      var maxRevs = d3.max(cuisineRestaurants, function (r) { return r.review_count; }) || 100;
      var zx = d3.scaleLog().domain([3, maxRevs * 1.2]).range([0, zw]);
      var zy = d3.scaleLinear().domain([1, 5]).range([zh, 0]);

      zg.append("g").attr("class", "axis").attr("transform", "translate(0," + zh + ")")
        .call(d3.axisBottom(zx).ticks(5, "~s"))
        .append("text").attr("x", zw / 2).attr("y", 40).attr("fill", COLORS.muted)
        .attr("text-anchor", "middle").style("font-size", "11px").text("Number of Reviews (log) \u2192");
      zg.append("g").attr("class", "axis").call(d3.axisLeft(zy).ticks(5))
        .append("text").attr("transform", "rotate(-90)").attr("x", -zh / 2).attr("y", -40)
        .attr("fill", COLORS.muted).attr("text-anchor", "middle").style("font-size", "11px").text("\u2605 Star Rating");

      // Gem zone highlight
      var isGem = isGemCuisine(d);
      if (isGem) {
        zg.append("rect").attr("x", 0).attr("y", zy(5)).attr("width", zw).attr("height", zy(3.5) - zy(5))
          .attr("fill", "rgba(58, 140, 92, 0.04)").attr("rx", 6);
      }

      var color = stabilityColor(d.std_rating);

      var zTooltip = d3.select(zoomScatter).append("div")
        .style("position", "absolute").style("background", COLORS.dark).style("color", "#faf6f0")
        .style("padding", "10px 14px").style("border-radius", "8px").style("font-size", "0.78rem")
        .style("pointer-events", "none").style("opacity", 0).style("z-index", "20")
        .style("max-width", "260px").style("box-shadow", "0 4px 20px rgba(0,0,0,0.3)");

      zoomScatter.style.position = "relative";

      var zDots = zg.selectAll(".zoom-dot").data(cuisineRestaurants).enter()
        .append("circle").attr("class", "zoom-dot")
        .attr("cx", function (r) { return zx(Math.max(3, r.review_count)); })
        .attr("cy", function (r, i) {
          var jitter = ((i * 2654435761 >>> 0) % 1000) / 1000;
          return zy(r.stars) + (jitter - 0.5) * 12;
        })
        .attr("r", function (r) { return Math.max(4, Math.min(10, Math.sqrt(r.review_count) / 3)); })
        .attr("fill", color).attr("opacity", 0.6).attr("stroke", "#fff").attr("stroke-width", 1)
        .style("cursor", "pointer");

      zDots.on("mouseenter", function (event, r) {
        d3.select(this).attr("r", 12).attr("opacity", 1).attr("stroke-width", 2);
        zTooltip.html(
          "<strong>" + r.name + "</strong><br/>" +
          "\u2605 " + r.stars + " &middot; " + fmt(r.review_count) + " reviews<br/>" +
          '<span style="color:#b8a890">' + (r.cuisines ? r.cuisines.slice(0, 3).join(", ") : d.cuisine) + "</span>"
        ).style("opacity", 1);
        var zRect = zoomScatter.getBoundingClientRect();
        var tx = event.clientX - zRect.left + 15;
        var ty = event.clientY - zRect.top - 10;
        if (tx + 200 > zoomScatter.clientWidth) tx = tx - 230;
        zTooltip.style("left", tx + "px").style("top", ty + "px");
      })
        .on("mouseleave", function (event, r) {
          d3.select(this).attr("r", Math.max(4, Math.min(10, Math.sqrt(r.review_count) / 3)))
            .attr("opacity", 0.6).attr("stroke-width", 1);
          zTooltip.style("opacity", 0);
        });

      // Summary stats below scatter
      var avgStars = d3.mean(cuisineRestaurants, function (r) { return r.stars; });
      var avgRevs = d3.mean(cuisineRestaurants, function (r) { return r.review_count; });
      var summaryDiv = document.createElement("div");
      summaryDiv.style.cssText = "margin-top:16px; padding:12px; background:" + COLORS.light + "; border-radius:8px; font-size:0.82rem;";
      summaryDiv.innerHTML = '<strong>' + d.cuisine + '</strong>: ' + cuisineRestaurants.length + ' restaurants | Avg \u2605 ' + avgStars.toFixed(2) +
        ' | Avg Reviews: ' + Math.round(avgRevs) +
        (isGem ? ' | <span style="color:' + COLORS.green + '; font-weight:700;">\u2666 Hidden Gem</span>' : '');
      zoomScatter.appendChild(summaryDiv);
    }

    // Back button: return to Level 1
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (zoomContainer) zoomContainer.style.display = "none";
        container.style.display = "";
      });
    }

    function applyFilter() {
      bubbles.select("circle").transition().duration(400)
        .attr("opacity", function (d) { return filterPredicate(d) ? 0.7 : 0.1; });
      bubbles.selectAll("text").transition().duration(400)
        .attr("opacity", function (d) { return filterPredicate(d) ? 0.9 : 0.1; });
    }

    // Expose callback so formula slider changes propagate to bubble gold-ring highlights
    window.__updateBubbleColors = function () {
      bubbles.select("circle")
        .attr("stroke", function (d) { return isGemCuisine(d) ? COLORS.gold : "#fff"; })
        .attr("stroke-width", function (d) { return isGemCuisine(d) ? 2.5 : 1; });
      bubbles.each(function (d) {
        d3.select(this).select("circle").classed("gem-pulse-ring", isGemCuisine(d));
      });
    };

    var filterBtns = document.querySelectorAll("#matrix-controls .control-btn");
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filterBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentFilter = btn.getAttribute("data-filter");
        applyFilter();
      });
    });

    // ── INVEST MODE UI ────────────────────────────────────────
    var investDiv = document.createElement("div");
    investDiv.className = "invest-mode-wrapper";
    container.appendChild(investDiv);

    investDiv.innerHTML =
      '<div class="invest-header">' +
        '<div class="invest-title">\uD83D\uDCB0 INVEST MODE \u2014 Which cuisines are Hidden Gems?</div>' +
        '<div class="invest-subtitle">You have 3 chips. Bet on the cuisines you think the data rates highest \u2014 then reveal your portfolio.</div>' +
      '</div>' +
      '<div class="invest-steps">' +
        '<div class="invest-step invest-step-active" id="invest-step-1">' +
          '<span class="step-num">1</span>' +
          '<span class="step-text">Click a chip \u2193</span>' +
        '</div>' +
        '<div class="invest-step-arrow">\u2192</div>' +
        '<div class="invest-step" id="invest-step-2">' +
          '<span class="step-num">2</span>' +
          '<span class="step-text">Click a bubble above</span>' +
        '</div>' +
        '<div class="invest-step-arrow">\u2192</div>' +
        '<div class="invest-step" id="invest-step-3">' +
          '<span class="step-num">3</span>' +
          '<span class="step-text">Hit Reveal Portfolio</span>' +
        '</div>' +
      '</div>';

    var chipTray = document.createElement("div");
    chipTray.className = "chip-tray";
    investDiv.appendChild(chipTray);

    var chipEls = [];
    for (var ci = 0; ci < 3; ci++) {
      (function (idx) {
        var chip = document.createElement("div");
        chip.className = "invest-chip";
        chip.innerHTML =
          '<div class="chip-inner">' +
            '<div class="chip-dollar">$</div>' +
            '<div class="chip-num">' + (idx + 1) + '</div>' +
          '</div>';
        chip.addEventListener("click", function () {
          if (investState.revealed) return;
          if (investState.chips[idx] && investState.chips[idx].cuisine) return;
          var wasActive = investState.activeChipIndex === idx;
          chipEls.forEach(function (c) { c.classList.remove("chip-active"); });
          investState.activeChipIndex = wasActive ? null : idx;
          if (!wasActive) {
            chip.classList.add("chip-active");
            // Step 1 → Step 2: chip selected, now click a bubble
            var s1 = document.getElementById("invest-step-1");
            var s2 = document.getElementById("invest-step-2");
            if (s1) s1.classList.remove("invest-step-active");
            if (s2) s2.classList.add("invest-step-active");
          } else {
            // Chip deselected, back to step 1
            var s1 = document.getElementById("invest-step-1");
            var s2 = document.getElementById("invest-step-2");
            if (s1) s1.classList.add("invest-step-active");
            if (s2) s2.classList.remove("invest-step-active");
          }
        });
        chipTray.appendChild(chip);
        chipEls.push(chip);
      })(ci);
    }

    var investActions = document.createElement("div");
    investActions.className = "invest-actions";
    investDiv.appendChild(investActions);

    var revealBtn = document.createElement("button");
    revealBtn.className = "reveal-portfolio-btn";
    revealBtn.textContent = "REVEAL PORTFOLIO \u2192";
    revealBtn.style.display = "none";
    investActions.appendChild(revealBtn);

    var resetInvestBtn = document.createElement("button");
    resetInvestBtn.className = "invest-reset-btn";
    resetInvestBtn.textContent = "\u21BA Reset Bets";
    resetInvestBtn.style.display = "none";
    investActions.appendChild(resetInvestBtn);

    var resultCards = document.createElement("div");
    resultCards.className = "invest-result-cards";
    resultCards.style.display = "none";
    investDiv.appendChild(resultCards);

    var portfolioGrade = document.createElement("div");
    portfolioGrade.className = "portfolio-grade-wrapper";
    portfolioGrade.style.display = "none";
    investDiv.appendChild(portfolioGrade);

    function placeInvestChip(d, bubbleGroup) {
      var idx = investState.activeChipIndex;
      var alreadyInvested = investState.chips.some(function (c) { return c && c.cuisine === d.cuisine; });
      if (alreadyInvested) { return; }

      investState.chips[idx] = { cuisine: d.cuisine, data: d };
      chipEls[idx].classList.remove("chip-active");
      chipEls[idx].classList.add("chip-placed");
      chipEls[idx].innerHTML =
        '<div class="chip-inner chip-placed-inner">' +
          '<div class="chip-check">\u2713</div>' +
          '<div class="chip-placed-name">' + d.cuisine.substring(0, 9) + '</div>' +
        '</div>';
      investState.activeChipIndex = null;

      // Step feedback: back to step 1 (pick next chip) unless all placed
      var _s1 = document.getElementById("invest-step-1");
      var _s2 = document.getElementById("invest-step-2");
      if (_s1) _s1.classList.add("invest-step-active");
      if (_s2) _s2.classList.remove("invest-step-active");

      // Gold dashed ring around invested bubble
      var bubbleR = r(d.median_reviews);
      bubbleGroup.insert("circle", ":first-child")
        .attr("class", "invest-ring")
        .attr("r", bubbleR + 9)
        .attr("fill", "none")
        .attr("stroke", COLORS.gold)
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "8 4")
        .attr("opacity", 0)
        .transition().duration(400).attr("opacity", 1);

      bubbleGroup.append("text")
        .attr("class", "invest-chip-emoji")
        .attr("text-anchor", "middle")
        .attr("dy", -(bubbleR + 16))
        .style("font-size", "15px")
        .style("pointer-events", "none")
        .text("\uD83D\uDCB0");

      var placedCount = investState.chips.filter(Boolean).length;
      if (placedCount >= 3) {
        revealBtn.style.display = "inline-block";
        resetInvestBtn.style.display = "inline-block";
        setTimeout(function () { revealBtn.classList.add("reveal-pulse"); }, 100);
        // All chips placed → Step 3
        var _sa = document.getElementById("invest-step-1");
        var _sb = document.getElementById("invest-step-2");
        var _sc = document.getElementById("invest-step-3");
        if (_sa) _sa.classList.remove("invest-step-active");
        if (_sb) _sb.classList.remove("invest-step-active");
        if (_sc) _sc.classList.add("invest-step-active");
      }
    }

    function resetInvest() {
      investState.chips = [];
      investState.activeChipIndex = null;
      investState.revealed = false;
      chipEls.forEach(function (c, i) {
        c.classList.remove("chip-active", "chip-placed");
        c.innerHTML =
          '<div class="chip-inner">' +
            '<div class="chip-dollar">$</div>' +
            '<div class="chip-num">' + (i + 1) + '</div>' +
          '</div>';
      });
      g.selectAll(".invest-ring").remove();
      g.selectAll(".invest-chip-emoji").remove();
      g.selectAll(".sunburst-ray").remove();
      revealBtn.style.display = "none";
      revealBtn.classList.remove("reveal-pulse");
      resetInvestBtn.style.display = "none";
      resultCards.style.display = "none";
      resultCards.innerHTML = "";
      portfolioGrade.style.display = "none";
      portfolioGrade.innerHTML = "";
      // Reset step indicator
      var rs1 = document.getElementById("invest-step-1");
      var rs2 = document.getElementById("invest-step-2");
      var rs3 = document.getElementById("invest-step-3");
      if (rs1) rs1.classList.add("invest-step-active");
      if (rs2) rs2.classList.remove("invest-step-active");
      if (rs3) rs3.classList.remove("invest-step-active");

      applyFilter();
    }

    resetInvestBtn.addEventListener("click", resetInvest);

    revealBtn.addEventListener("click", function () {
      if (investState.revealed) return;
      investState.revealed = true;
      revealBtn.classList.remove("reveal-pulse");
      revealBtn.style.display = "none";
      resultCards.style.display = "flex";

      var placed = investState.chips.filter(Boolean);

      // Fade all non-invested bubbles
      bubbles.each(function (d) {
        var inv = placed.some(function (p) { return p.cuisine === d.cuisine; });
        d3.select(this).select("circle").transition().duration(500).attr("opacity", inv ? 1 : 0.07);
        d3.select(this).selectAll("text").transition().duration(500).attr("opacity", inv ? 1 : 0.04);
      });

      function revealOne(idx) {
        if (idx >= placed.length) { showPortfolioGrade(placed); return; }
        var item   = placed[idx];
        var liveEntry = window.__liveGemScores && window.__liveGemScores[item.cuisine];
        var isGem  = liveEntry ? liveEntry.is_gem : isGemCuisine(item.data);

        // Bubble pop
        var thisBubble = bubbles.filter(function (d) { return d.cuisine === item.cuisine; });
        thisBubble.select("circle")
          .transition().duration(500)
          .attr("r", r(item.data.median_reviews) * 1.9)
          .attr("stroke", isGem ? COLORS.gold : COLORS.red)
          .attr("stroke-width", 4)
          .transition().duration(300)
          .attr("r", r(item.data.median_reviews) * 1.4);

        // Sunburst rays for gem cuisines
        if (isGem) {
          var txStr = thisBubble.attr("transform");
          var tx = parseFloat(txStr.replace("translate(", "").split(",")[0]);
          var ty = parseFloat(txStr.split(",")[1]);
          for (var ri = 0; ri < 12; ri++) {
            var ang = (ri / 12) * Math.PI * 2;
            var br  = r(item.data.median_reviews) + 9;
            g.append("line").attr("class", "sunburst-ray")
              .attr("x1", tx + Math.cos(ang) * br)
              .attr("y1", ty + Math.sin(ang) * br)
              .attr("x2", tx + Math.cos(ang) * br)
              .attr("y2", ty + Math.sin(ang) * br)
              .attr("stroke", COLORS.gold).attr("stroke-width", 2.5).attr("opacity", 0.9)
              .transition().duration(700)
              .attr("x2", tx + Math.cos(ang) * (br + 38))
              .attr("y2", ty + Math.sin(ang) * (br + 38))
              .attr("opacity", 0);
          }
        }

        // Build result card
        setTimeout(function () {
          var card = document.createElement("div");
          card.className = "invest-result-card" + (isGem ? " result-gem" : " result-trap");

          var liveScore = window.__liveGemScores && window.__liveGemScores[item.cuisine];
          var scoreVal = liveScore ? liveScore.gem_score : 0;
          var scorePct = Math.round(scoreVal * 100);

          card.innerHTML =
            '<div class="result-verdict-icon">' + (isGem ? "\u2713" : "\u2717") + '</div>' +
            '<div class="result-verdict-text">' + (isGem ? "GEM CONFIRMED" : "HIGH COMPETITION") + '</div>' +
            '<div class="result-cuisine-name">' + item.cuisine + '</div>' +
            '<div class="result-stats-row">' +
              '<span>' + item.data.count + ' rivals</span>' +
              '<span>\u2605 ' + item.data.avg_rating.toFixed(1) + '</span>' +
            '</div>' +
            '<div class="result-bar-track">' +
              '<div class="result-bar-fill' + (isGem ? ' gem-fill' : '') + '" style="width:' + scorePct + '%"></div>' +
            '</div>' +
            '<div class="result-score">Gem Score: ' + scoreVal.toFixed(2) + '</div>' +
            '<div class="result-advice">' +
              (isGem
                ? '\u2192 Blue ocean \u2014 low rivalry, strong reputation'
                : '\u2192 You\'d be rival #' + (item.data.count + 1)) +
            '</div>';

          resultCards.appendChild(card);
          requestAnimationFrame(function () { card.classList.add("result-card-visible"); });
          setTimeout(function () { revealOne(idx + 1); }, 1700);
        }, 600);
      }

      revealOne(0);
    });

    function showPortfolioGrade(placed) {
      var gemCount  = placed.filter(function (p) {
        var live = window.__liveGemScores && window.__liveGemScores[p.cuisine];
        return live ? live.is_gem : isGemCuisine(p.data);
      }).length;
      var gradeMap  = [
        { grade: "F",  color: COLORS.red,   msg: "Better luck next time \u2014 trust the data!" },
        { grade: "C",  color: COLORS.gold,  msg: "One gem found. Good start!" },
        { grade: "B+", color: COLORS.teal,  msg: "Two gems! Strong instincts." },
        { grade: "A",  color: COLORS.green, msg: "All gems! You think like a data scientist." }
      ];
      var gr = gradeMap[Math.min(gemCount, 3)];

      var bestPick = placed.slice().sort(function (a, b) {
        function gs(p) {
          var live = window.__liveGemScores && window.__liveGemScores[p.cuisine];
          if (live) return live.gem_score;
          if (!window.__gemDefinition) return 0;
          var e = window.__gemDefinition.rankings.find(function (r) { return r.cuisine === p.cuisine; });
          return e ? e.gem_score : 0;
        }
        return gs(b) - gs(a);
      })[0];

      portfolioGrade.style.display = "block";
      portfolioGrade.innerHTML =
        '<div class="grade-letter" style="color:' + gr.color + '">' + gr.grade + '</div>' +
        '<div class="grade-count">' + gemCount + ' / 3 Hidden Gems found</div>' +
        '<div class="grade-msg">' + gr.msg + '</div>' +
        '<div class="grade-actions">' +
          '<button class="grade-explore-btn">Explore ' + bestPick.cuisine + ' \u2192</button>' +
          '<button class="grade-retry-btn">Try Again</button>' +
        '</div>';

      portfolioGrade.querySelector(".grade-explore-btn").addEventListener("click", function () {
        resetInvest();
        setTimeout(function () { zoomToCuisine(bestPick.data); }, 120);
      });
      portfolioGrade.querySelector(".grade-retry-btn").addEventListener("click", resetInvest);
    }

    // ── Rating Decider Strip (existing) ──────────────────────
    var deciderDiv = document.createElement("div");
    deciderDiv.className = "rating-decider-strip";
    container.appendChild(deciderDiv);

    var topGems = allData.filter(function (d) { return isGemCuisine(d); })
      .sort(function (a, b) { return b.avg_rating - a.avg_rating; })
      .slice(0, 5);

    if (topGems.length > 0) {
      var stripTitle = document.createElement("div");
      stripTitle.className = "decider-title";
      stripTitle.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" style="vertical-align:middle;">' +
        '<circle cx="11" cy="11" r="10" fill="none" stroke="' + COLORS.green + '" stroke-width="2"/>' +
        '<path d="M6 11 L10 15 L16 7" stroke="' + COLORS.green + '" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg> Data-Driven Recommendations';
      deciderDiv.appendChild(stripTitle);

      var cardsRow = document.createElement("div");
      cardsRow.className = "decider-cards";
      deciderDiv.appendChild(cardsRow);

      topGems.forEach(function (gem, idx) {
        var card = document.createElement("div");
        card.className = "decider-card";
        card.style.borderLeftColor = stabilityColor(gem.std_rating);
        card.style.animationDelay = (idx * 120) + "ms";

        var stars = "";
        for (var si = 0; si < Math.floor(gem.avg_rating); si++) stars += "\u2605";
        if (gem.avg_rating % 1 >= 0.5) stars += "\u00BD";

        card.innerHTML = '<div class="decider-rank">#' + (idx + 1) + '</div>' +
          '<div class="decider-content">' +
          '<div class="decider-name">' + storefrontIcon(COLORS.green) + ' ' + gem.cuisine + '</div>' +
          '<div class="decider-stars" style="color:' + COLORS.gold + ';">' + stars + ' ' + gem.avg_rating.toFixed(1) + '</div>' +
          '<div class="decider-meta">' + gem.count + ' competitors | ' + gem.median_reviews + ' median reviews</div>' +
          '</div>';
        cardsRow.appendChild(card);
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
    var mobileSelect = document.getElementById("mobile-nav-select");
    var sections = [];

    dots.forEach(function (dot) {
      var target = document.getElementById(dot.dataset.target);
      if (target) sections.push({ dot: dot, target: target });
      dot.addEventListener("click", function () {
        if (target) target.scrollIntoView({ behavior: "smooth" });
      });
    });

    // Mobile nav select handler
    if (mobileSelect) {
      mobileSelect.addEventListener("change", function () {
        var target = document.getElementById(mobileSelect.value);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            dots.forEach(function (d) { d.classList.remove("active"); });
            var match = sections.find(function (s) { return s.target === entry.target; });
            if (match) {
              match.dot.classList.add("active");
              // Sync mobile nav select
              if (mobileSelect) mobileSelect.value = match.dot.dataset.target;
            }
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
