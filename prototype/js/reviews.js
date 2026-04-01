/* ============================================================
   Hidden Gems — Philadelphia Restaurant Review Analysis
   Word cloud, review carousel, sentiment gauge & comparison
   ============================================================ */

(function () {
  "use strict";

  // ── Style constants (match site theme) ────────────────────
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

  var WORD_PALETTE = [
    "#d4503a", "#e8a838", "#3a8c5c", "#2a8a8a", "#5b8cbe",
    "#9b59b6", "#e67e22", "#c0392b", "#8e44ad", "#d35400",
    "#16a085", "#f39c12", "#27ae60", "#2980b9", "#1abc9c"
  ];

  // ── Utility helpers ───────────────────────────────────────

  /** Deterministic color from word string */
  function wordColor(word) {
    var hash = 0;
    for (var i = 0; i < word.length; i++) {
      hash = word.charCodeAt(i) + ((hash << 5) - hash);
    }
    return WORD_PALETTE[Math.abs(hash) % WORD_PALETTE.length];
  }

  /** Generate star characters for a rating */
  function starString(rating) {
    var stars = "";
    for (var i = 0; i < 5; i++) {
      if (i < Math.floor(rating)) {
        stars += "\u2605";
      } else if (i < rating) {
        stars += "\u00BD";
      } else {
        stars += "\u2606";
      }
    }
    return stars;
  }

  /** Return sentiment label from numeric value */
  function sentimentLabel(value) {
    if (value > 0.2) return "Positive";
    if (value < -0.2) return "Negative";
    return "Neutral";
  }

  /** Return sentiment color from numeric value */
  function sentimentColor(value) {
    if (value > 0.2) return COLORS.green;
    if (value < -0.2) return COLORS.red;
    return COLORS.muted;
  }

  /** Clamp a number between min and max */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ── DETECTIVE MODE ────────────────────────────────────────
  var detectiveState = {
    active: false,
    correct: 0,
    total: 0,
    reviewData: null,
    currentCuisine: null,
    reviewQueue: [],
    currentIdx: 0
  };

  function sentimentCategory(value) {
    if (value > 0.2)  return "positive";
    if (value < -0.2) return "negative";
    return "neutral";
  }

  function injectDetectiveToggle() {
    if (document.getElementById("detective-toggle-input")) return;
    // Insert a full-width challenge banner *above* the review carousel
    var carousel = document.getElementById("review-carousel");
    if (!carousel) return;

    var banner = document.createElement("div");
    banner.className = "detective-banner";
    banner.innerHTML =
      '<div class="detective-banner-left">' +
        '<span class="detective-banner-icon">\uD83D\uDD0D</span>' +
        '<div class="detective-banner-copy">' +
          '<div class="detective-banner-title">Sentiment Detective <span class="detective-difficulty-tag">5 cases</span></div>' +
          '<div class="detective-banner-desc">Can you read between the lines? Guess the sentiment before the data reveals it.</div>' +
          '<div class="detective-banner-stat">\uD83D\uDCC8 Most players score under 70% \u2014 where do you rank?</div>' +
        '</div>' +
      '</div>' +
      '<label class="detective-start-label">' +
        '<input type="checkbox" id="detective-toggle-input" style="display:none">' +
        '<span class="detective-start-btn" id="detective-start-btn-text">' +
          '<span class="dsb-main">Play \u2192</span>' +
        '</span>' +
      '</label>';

    carousel.parentNode.insertBefore(banner, carousel);

    document.getElementById("detective-toggle-input").addEventListener("change", function () {
      var btn = document.getElementById("detective-start-btn-text");
      detectiveState.active = this.checked;
      if (detectiveState.active) {
        banner.classList.add("detective-banner-active");
        if (btn) btn.innerHTML = '<span class="dsb-main">\u2715 Exit Detective</span>';
        startDetectiveRound();
      } else {
        banner.classList.remove("detective-banner-active");
        if (btn) btn.innerHTML = '<span class="dsb-main">Play \u2192</span>';
        exitDetectiveMode();
      }
    });
  }

  function startDetectiveRound() {
    if (!detectiveState.reviewData || !detectiveState.currentCuisine) return;
    var data = detectiveState.reviewData[detectiveState.currentCuisine];
    if (!data) return;

    detectiveState.correct = 0;
    detectiveState.total   = 0;

    var pool = [];
    if (data.positive_excerpts) pool = pool.concat(data.positive_excerpts.map(function (r) { return Object.assign({}, r); }));
    if (data.negative_excerpts) pool = pool.concat(data.negative_excerpts.map(function (r) { return Object.assign({}, r); }));
    // Shuffle
    for (var si = pool.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = pool[si]; pool[si] = pool[sj]; pool[sj] = tmp;
    }
    detectiveState.reviewQueue = pool.slice(0, Math.min(5, pool.length));
    detectiveState.currentIdx  = 0;
    renderDetectiveCard();
  }

  function exitDetectiveMode() {
    detectiveState.active = false;
    var tog = document.getElementById("detective-toggle-input");
    if (tog) tog.checked = false;
    var btn = document.getElementById("detective-start-btn-text");
    if (btn) btn.innerHTML = '<span class="dsb-main">Play \u2192</span>';
    var banner = document.querySelector(".detective-banner");
    if (banner) banner.classList.remove("detective-banner-active");

    var container = d3.select("#review-carousel");
    if (container.empty()) return;
    if (detectiveState.reviewData && detectiveState.currentCuisine) {
      var data = detectiveState.reviewData[detectiveState.currentCuisine];
      if (data) {
        var reviews = [];
        if (data.positive_excerpts) reviews = reviews.concat(data.positive_excerpts);
        if (data.negative_excerpts) reviews = reviews.concat(data.negative_excerpts);
        reviews.sort(function (a, b) { return b.sentiment - a.sentiment; });
        renderReviewCarousel(container, reviews);
      }
    }
  }

  function renderDetectiveCard() {
    var container = d3.select("#review-carousel");
    if (container.empty()) return;
    container.html("");

    var queue = detectiveState.reviewQueue;
    var maxRounds = Math.min(5, queue.length);

    if (detectiveState.currentIdx >= maxRounds || detectiveState.currentIdx >= queue.length) {
      renderDetectiveSummary();
      return;
    }

    var review  = queue[detectiveState.currentIdx];
    var wrapper = container.append("div").attr("class", "detective-wrapper");

    // Progress bar row
    var progRow = wrapper.append("div").attr("class", "detective-progress-row");
    progRow.append("span").attr("class", "detective-progress-text")
      .text("Case " + (detectiveState.total + 1) + " of " + maxRounds);
    var track = progRow.append("div").attr("class", "detective-progress-track");
    track.append("div").attr("class", "detective-progress-fill")
      .style("width", (detectiveState.total / maxRounds * 100) + "%");
    progRow.append("span").attr("class", "detective-score-badge")
      .text(detectiveState.correct + "/" + detectiveState.total + " correct");

    // Review card — stars and sentiment hidden behind "CLASSIFIED" overlay
    var card = wrapper.append("div").attr("class", "detective-review-card");

    var classified = card.append("div").attr("class", "detective-classified-row");
    classified.append("div").attr("class", "classified-stars-mask").text("\u2605 \u2605 \u2605 \u2605 \u2605");
    classified.append("div").attr("class", "classified-stamp").text("CLASSIFIED");

    card.append("div").attr("class", "detective-review-text")
      .text("\u201C" + review.text + "\u201D");

    card.append("div").attr("class", "detective-prompt-text")
      .text("What does this diner really feel?");

    // Verdict buttons
    var btnsRow = wrapper.append("div").attr("class", "verdict-buttons-row");
    var choices = [
      { key: "positive", emoji: "\uD83D\uDE0D", label: "Positive" },
      { key: "neutral",  emoji: "\uD83D\uDE10", label: "Neutral"  },
      { key: "negative", emoji: "\uD83D\uDE20", label: "Negative" }
    ];

    choices.forEach(function (choice) {
      btnsRow.append("button")
        .attr("class", "verdict-btn verdict-" + choice.key)
        .html('<span class="verdict-emoji">' + choice.emoji + '</span><span class="verdict-label">' + choice.label + '</span>')
        .on("click", function () {
          var actual  = sentimentCategory(review.sentiment);
          var correct = choice.key === actual;
          detectiveState.total++;
          if (correct) detectiveState.correct++;
          doReveal(card, btnsRow, review, choice.key, actual, correct, function () {
            detectiveState.currentIdx++;
            if (detectiveState.total >= maxRounds) {
              setTimeout(renderDetectiveSummary, 800);
            } else {
              setTimeout(renderDetectiveCard, 900);
            }
          });
        });
    });
  }

  function doReveal(card, btnsRow, review, chosen, actual, correct, onDone) {
    // Disable buttons
    btnsRow.selectAll(".verdict-btn").property("disabled", true);

    // Highlight correct / wrong buttons
    btnsRow.selectAll(".verdict-btn")
      .classed("verdict-btn-correct", function () { return d3.select(this).classed("verdict-" + actual); })
      .classed("verdict-btn-wrong",   function () {
        return !d3.select(this).classed("verdict-" + actual) &&
                d3.select(this).classed("verdict-" + chosen);
      });

    // Reveal stars + sentiment (replace classified row)
    var starCount = Math.round(review.stars) || 3;
    var starStr = "";
    for (var s = 0; s < 5; s++) starStr += (s < starCount ? "\u2605" : "\u2606");
    var sentColors = { positive: "#3a8c5c", neutral: "#7a6e5f", negative: "#d4503a" };
    var sentColor  = sentColors[actual] || "#7a6e5f";

    card.select(".detective-classified-row")
      .classed("classified-revealed", true)
      .html(
        '<div class="revealed-stars" style="color:#e8a838;">' + starStr + ' ' + (review.stars || "?") + '</div>' +
        '<div class="revealed-sentiment" style="color:' + sentColor + '; font-weight:700;">' +
          (actual.charAt(0).toUpperCase() + actual.slice(1)) +
          ' <span style="font-weight:400; font-size:0.82em;">(' + (review.sentiment !== undefined ? review.sentiment.toFixed(2) : "?") + ')</span>' +
        '</div>'
      );

    // Floating feedback badge
    var feedback = card.append("div")
      .attr("class", "verdict-feedback " + (correct ? "feedback-correct" : "feedback-wrong"))
      .text(correct ? "+1  Correct!" : "Nope \u2014 data says " + actual);

    setTimeout(function () {
      feedback.style("opacity", "0");
      setTimeout(onDone, 350);
    }, 1500);
  }

  function renderDetectiveSummary() {
    var container = d3.select("#review-carousel");
    if (container.empty()) return;
    container.html("");

    var pct   = detectiveState.total > 0 ? Math.round(detectiveState.correct / detectiveState.total * 100) : 0;
    var grade = pct >= 80 ? "\uD83D\uDD2C Expert Analyst" :
                pct >= 60 ? "\uD83D\uDD75 Sharp Detective" :
                pct >= 40 ? "\uD83D\uDCCB Trainee Analyst" :
                            "\uD83C\uDF93 Still Learning";

    var wrap = container.append("div").attr("class", "detective-summary");
    wrap.append("div").attr("class", "summary-title").text("CASE CLOSED");
    wrap.append("div").attr("class", "summary-grade").text(grade);
    wrap.append("div").attr("class", "summary-score-text")
      .html("You got <strong>" + detectiveState.correct + " / " + detectiveState.total + "</strong> correct (" + pct + "%)");

    var meter = wrap.append("div").attr("class", "summary-meter-row");
    meter.append("div").attr("class", "summary-meter-track")
      .append("div").attr("class", "summary-meter-fill")
      .style("width", "0%")
      .transition().duration(1000).style("width", pct + "%");

    var msgs = {
      80: "Impressive! You read emotion as well as the algorithm.",
      60: "Solid instincts. Some reviews are genuinely ambiguous.",
      40: "Sentiment is subtle \u2014 that\u2019s exactly why we need data.",
      0:  "Even algorithms struggle with sarcasm and nuance!"
    };
    var msg = pct >= 80 ? msgs[80] : pct >= 60 ? msgs[60] : pct >= 40 ? msgs[40] : msgs[0];
    wrap.append("div").attr("class", "summary-msg").text(msg);

    var btnRow = wrap.append("div").attr("class", "summary-btn-row");
    btnRow.append("button").attr("class", "summary-retry-btn")
      .text("Try Again \u2192")
      .on("click", function () { startDetectiveRound(); });
    btnRow.append("button").attr("class", "summary-exit-btn")
      .text("Exit Detective Mode")
      .on("click", function () {
        var tog = document.getElementById("detective-toggle-input");
        if (tog) { tog.checked = false; }
        detectiveState.active = false;
        exitDetectiveMode();
      });
  }


  // ── 1. WORD CLOUD ────────────────────────────────────────

  /**
   * Renders a word cloud using a simple spiral placement algorithm.
   * No d3-cloud dependency -- places words along an Archimedean spiral
   * and checks for bounding-box collisions.
   *
   * @param {d3.Selection} container  D3 selection of the target element
   * @param {Array}        words      Array of {word, count} objects (max 30)
   */
  function renderWordCloud(container, words) {
    container.html("");

    if (!words || words.length === 0) {
      container.append("p")
        .style("color", COLORS.muted)
        .style("text-align", "center")
        .style("padding", "40px 0")
        .text("No word data available.");
      return;
    }

    // Limit to 30 words
    var data = words.slice(0, 30);

    var width = Math.max(container.node().clientWidth, 400) || 500;
    var height = Math.min(400, Math.max(260, width * 0.6));

    var svg = container.append("svg")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("max-height", height + "px");

    var g = svg.append("g")
      .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

    // Scale word size by count using sqrt scale
    var countExtent = d3.extent(data, function (d) { return d.count; });
    var fontScale = d3.scaleSqrt()
      .domain([countExtent[0] || 1, countExtent[1] || 1])
      .range([12, Math.min(48, width / 10)]);

    // Placement state: track occupied bounding boxes
    var placed = []; // array of {x, y, w, h}

    /**
     * Check if a candidate bounding box overlaps any previously placed box.
     * Each box is {x, y, w, h} where (x,y) is top-left corner.
     */
    function overlaps(candidate) {
      for (var i = 0; i < placed.length; i++) {
        var b = placed[i];
        if (candidate.x < b.x + b.w &&
            candidate.x + candidate.w > b.x &&
            candidate.y < b.y + b.h &&
            candidate.y + candidate.h > b.y) {
          return true;
        }
      }
      return false;
    }

    /**
     * Check if a candidate box fits within the SVG bounds (centered at origin).
     */
    function inBounds(candidate) {
      var halfW = width / 2 - 10;
      var halfH = height / 2 - 10;
      return candidate.x >= -halfW &&
             candidate.x + candidate.w <= halfW &&
             candidate.y >= -halfH &&
             candidate.y + candidate.h <= halfH;
    }

    // Place each word along a spiral
    var positions = []; // {word, fontSize, x, y, color}

    data.forEach(function (d) {
      var fontSize = fontScale(d.count);
      // Approximate bounding box: width ~ length * fontSize * 0.6, height ~ fontSize
      var boxW = d.word.length * fontSize * 0.58;
      var boxH = fontSize * 1.2;

      var placed_ok = false;
      var angle = 0;
      var radius = 0;
      var step = 0.3;
      var maxIter = 800;

      for (var iter = 0; iter < maxIter; iter++) {
        var cx = Math.cos(angle) * radius;
        var cy = Math.sin(angle) * radius;

        var candidate = {
          x: cx - boxW / 2,
          y: cy - boxH / 2,
          w: boxW,
          h: boxH
        };

        if (inBounds(candidate) && !overlaps(candidate)) {
          placed.push(candidate);
          positions.push({
            word: d.word,
            count: d.count,
            fontSize: fontSize,
            x: cx,
            y: cy,
            color: wordColor(d.word)
          });
          placed_ok = true;
          break;
        }

        // Advance along Archimedean spiral
        angle += step;
        radius += 0.4;
      }

      // If could not place, skip this word silently
      if (!placed_ok) {
        // Try placing at edge as fallback
        var fallbackX = (Math.random() - 0.5) * width * 0.8;
        var fallbackY = (Math.random() - 0.5) * height * 0.8;
        positions.push({
          word: d.word,
          count: d.count,
          fontSize: Math.max(10, fontSize * 0.7),
          x: fallbackX,
          y: fallbackY,
          color: wordColor(d.word)
        });
      }
    });

    // Render words with entrance animation
    var texts = g.selectAll(".cloud-word")
      .data(positions)
      .enter()
      .append("text")
      .attr("class", "cloud-word")
      .attr("text-anchor", "middle")
      .attr("x", function (d) { return d.x; })
      .attr("y", function (d) { return d.y; })
      .attr("dy", "0.35em")
      .text(function (d) { return d.word; })
      .style("font-size", "0px")
      .style("font-weight", "700")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("fill", function (d) { return d.color; })
      .style("cursor", "default")
      .style("user-select", "none");

    // Animate entrance: staggered scale-in
    texts.transition()
      .duration(600)
      .delay(function (d, i) { return i * 40; })
      .style("font-size", function (d) { return d.fontSize + "px"; })
      .style("opacity", 0.9);

    // Hover effect: enlarge and brighten
    texts.on("mouseenter", function (event, d) {
      d3.select(this)
        .transition().duration(150)
        .style("font-size", (d.fontSize * 1.25) + "px")
        .style("opacity", 1);
    })
    .on("mouseleave", function (event, d) {
      d3.select(this)
        .transition().duration(150)
        .style("font-size", d.fontSize + "px")
        .style("opacity", 0.9);
    });

    // Add count tooltip on hover
    texts.append("title")
      .text(function (d) { return d.word + ": " + d.count.toLocaleString() + " mentions"; });
  }


  // ── 2. REVIEW CAROUSEL ───────────────────────────────────

  /**
   * Renders a review carousel that shows one review at a time
   * with prev/next navigation and auto-advance.
   *
   * @param {d3.Selection} container  D3 selection of the target element
   * @param {Array}        reviews    Array of {text, stars, sentiment} objects
   */
  function renderReviewCarousel(container, reviews) {
    container.html("");

    if (!reviews || reviews.length === 0) {
      container.append("div")
        .style("color", COLORS.muted)
        .style("text-align", "center")
        .style("padding", "30px 0")
        .text("No reviews available.");
      return;
    }

    var currentIndex = 0;
    var autoTimer = null;
    var isHovering = false;

    // Build carousel wrapper
    var wrapper = container.append("div")
      .style("position", "relative")
      .style("min-height", "160px");

    // Review card container
    var cardContainer = wrapper.append("div")
      .attr("class", "review-card-container")
      .style("background", COLORS.light)
      .style("border-radius", "12px")
      .style("padding", "20px 24px")
      .style("border-left", "4px solid " + COLORS.gold)
      .style("transition", "opacity 0.3s ease")
      .style("min-height", "120px");

    // Star rating row
    var starsRow = cardContainer.append("div")
      .style("margin-bottom", "8px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px");

    var starsEl = starsRow.append("span")
      .style("font-size", "1.1rem")
      .style("color", COLORS.gold)
      .style("letter-spacing", "2px");

    var sentimentBadge = starsRow.append("span")
      .style("display", "inline-block")
      .style("font-size", "0.7rem")
      .style("font-weight", "700")
      .style("padding", "2px 10px")
      .style("border-radius", "10px")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.5px");

    // Review text
    var textEl = cardContainer.append("div")
      .style("font-size", "0.88rem")
      .style("line-height", "1.6")
      .style("color", COLORS.dark)
      .style("font-style", "italic");

    // Navigation controls
    var navRow = wrapper.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "space-between")
      .style("margin-top", "12px");

    var prevBtn = navRow.append("button")
      .attr("class", "carousel-btn carousel-prev")
      .style("background", COLORS.dark)
      .style("color", COLORS.bg)
      .style("border", "none")
      .style("border-radius", "50%")
      .style("width", "34px")
      .style("height", "34px")
      .style("font-size", "1rem")
      .style("cursor", "pointer")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("transition", "opacity 0.2s")
      .html("&#9664;");

    // Dot indicators
    var dotsRow = navRow.append("div")
      .style("display", "flex")
      .style("gap", "6px")
      .style("align-items", "center");

    reviews.forEach(function (_, i) {
      dotsRow.append("span")
        .attr("class", "carousel-dot")
        .attr("data-index", i)
        .style("display", "inline-block")
        .style("width", "8px")
        .style("height", "8px")
        .style("border-radius", "50%")
        .style("background", i === 0 ? COLORS.dark : COLORS.muted)
        .style("opacity", i === 0 ? 1 : 0.4)
        .style("cursor", "pointer")
        .style("transition", "all 0.2s");
    });

    var nextBtn = navRow.append("button")
      .attr("class", "carousel-btn carousel-next")
      .style("background", COLORS.dark)
      .style("color", COLORS.bg)
      .style("border", "none")
      .style("border-radius", "50%")
      .style("width", "34px")
      .style("height", "34px")
      .style("font-size", "1rem")
      .style("cursor", "pointer")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("transition", "opacity 0.2s")
      .html("&#9654;");

    /** Update the displayed review */
    function showReview(index) {
      currentIndex = index;
      var review = reviews[currentIndex];

      // Fade out, update, fade in
      cardContainer.style("opacity", 0);

      setTimeout(function () {
        starsEl.text(starString(review.stars));

        var label = sentimentLabel(review.sentiment);
        var color = sentimentColor(review.sentiment);
        sentimentBadge
          .text(label)
          .style("background", color)
          .style("color", "#fff");

        // Update border color based on sentiment
        cardContainer.style("border-left-color", color);

        textEl.text("\u201C" + review.text + "\u201D");
        cardContainer.style("opacity", 1);
      }, 180);

      // Update dot indicators
      dotsRow.selectAll(".carousel-dot")
        .style("background", function () {
          var idx = parseInt(d3.select(this).attr("data-index"), 10);
          return idx === currentIndex ? COLORS.dark : COLORS.muted;
        })
        .style("opacity", function () {
          var idx = parseInt(d3.select(this).attr("data-index"), 10);
          return idx === currentIndex ? 1 : 0.4;
        });
    }

    /** Advance to next review */
    function goNext() {
      showReview((currentIndex + 1) % reviews.length);
    }

    /** Go to previous review */
    function goPrev() {
      showReview((currentIndex - 1 + reviews.length) % reviews.length);
    }

    /** Start auto-advance timer */
    function startAuto() {
      stopAuto();
      autoTimer = setInterval(function () {
        if (!isHovering) goNext();
      }, 6000);
    }

    /** Stop auto-advance timer */
    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    // Wire up controls
    prevBtn.on("click", function () { goPrev(); startAuto(); });
    nextBtn.on("click", function () { goNext(); startAuto(); });

    dotsRow.selectAll(".carousel-dot").on("click", function () {
      var idx = parseInt(d3.select(this).attr("data-index"), 10);
      showReview(idx);
      startAuto();
    });

    // Pause on hover
    wrapper.on("mouseenter", function () { isHovering = true; });
    wrapper.on("mouseleave", function () { isHovering = false; });

    // Initial display
    showReview(0);
    startAuto();
  }


  // ── 3. SENTIMENT GAUGE (Donut Chart) ─────────────────────

  /**
   * Renders a D3 donut/arc chart showing sentiment distribution.
   *
   * @param {d3.Selection} container      D3 selection of the target element
   * @param {Object}       sentimentData  {positive, neutral, negative} percentages
   * @param {number}       avgSentiment   Average sentiment score (-1 to 1)
   */
  function renderSentimentGauge(container, sentimentData, avgSentiment) {
    container.html("");

    if (!sentimentData) {
      container.append("p")
        .style("color", COLORS.muted)
        .style("text-align", "center")
        .text("No sentiment data available.");
      return;
    }

    var containerWidth = container.node().clientWidth || 300;
    var size = Math.min(280, containerWidth);
    var outerRadius = size / 2 - 10;
    var innerRadius = outerRadius * 0.6;

    var svg = container.append("svg")
      .attr("viewBox", "0 0 " + size + " " + size)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("max-width", size + "px")
      .style("display", "block")
      .style("margin", "0 auto");

    var g = svg.append("g")
      .attr("transform", "translate(" + (size / 2) + "," + (size / 2) + ")");

    // Pie data
    var pieData = [
      { label: "Positive", value: sentimentData.positive || 0, color: COLORS.green },
      { label: "Neutral",  value: sentimentData.neutral  || 0, color: COLORS.muted },
      { label: "Negative", value: sentimentData.negative || 0, color: COLORS.red }
    ];

    var pie = d3.pie()
      .value(function (d) { return d.value; })
      .sort(null)
      .padAngle(0.02);

    var arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(3);

    var arcHover = d3.arc()
      .innerRadius(innerRadius - 2)
      .outerRadius(outerRadius + 6)
      .cornerRadius(3);

    // Draw arcs with animated entrance
    var arcs = g.selectAll(".sentiment-arc")
      .data(pie(pieData))
      .enter()
      .append("path")
      .attr("class", "sentiment-arc")
      .attr("fill", function (d) { return d.data.color; })
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .style("transition", "opacity 0.15s");

    // Animated entrance using arc tween
    arcs.transition()
      .duration(1000)
      .delay(function (d, i) { return i * 150; })
      .attrTween("d", function (d) {
        var interpolate = d3.interpolate(
          { startAngle: d.startAngle, endAngle: d.startAngle },
          d
        );
        return function (t) {
          return arc(interpolate(t));
        };
      });

    // Hover: expand arc and show percentage
    arcs.on("mouseenter", function (event, d) {
      d3.select(this)
        .transition().duration(150)
        .attr("d", arcHover(d))
        .attr("opacity", 1);

      centerLabel.text(d.data.value.toFixed(1) + "%");
      centerSublabel.text(d.data.label);
    })
    .on("mouseleave", function (event, d) {
      d3.select(this)
        .transition().duration(150)
        .attr("d", arc(d))
        .attr("opacity", 0.85);

      // Restore center text to average sentiment
      centerLabel.text(overallLabel);
      centerSublabel.text("Avg Sentiment");
    });

    // Center text: average sentiment label
    var overallLabel = sentimentLabel(avgSentiment || 0);

    var centerLabel = g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.1em")
      .style("font-size", Math.max(14, outerRadius * 0.22) + "px")
      .style("font-weight", "800")
      .style("fill", sentimentColor(avgSentiment || 0))
      .text(overallLabel);

    var centerSublabel = g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.3em")
      .style("font-size", Math.max(10, outerRadius * 0.13) + "px")
      .style("font-weight", "600")
      .style("fill", COLORS.muted)
      .text("Avg Sentiment");

    // Legend below donut
    var legend = container.append("div")
      .style("display", "flex")
      .style("justify-content", "center")
      .style("gap", "16px")
      .style("margin-top", "12px")
      .style("flex-wrap", "wrap");

    pieData.forEach(function (d) {
      var item = legend.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "5px")
        .style("font-size", "0.78rem")
        .style("color", COLORS.dark);

      item.append("span")
        .style("display", "inline-block")
        .style("width", "10px")
        .style("height", "10px")
        .style("border-radius", "50%")
        .style("background", d.color);

      item.append("span")
        .style("font-weight", "600")
        .text(d.label + " " + d.value.toFixed(1) + "%");
    });
  }


  // ── 4. SENTIMENT COMPARISON (Stacked Bar Chart) ──────────

  /**
   * Renders a horizontal stacked bar chart comparing sentiment
   * across the top 10 cuisines sorted by positive percentage.
   *
   * @param {d3.Selection} container   D3 selection of the target element
   * @param {Object}       reviewData  Full review_analysis.json data
   * @param {Array}        cuisines    Array of cuisine name strings
   */
  function renderSentimentComparison(container, reviewData, cuisines) {
    container.html("");

    if (!cuisines || cuisines.length === 0) {
      container.append("p")
        .style("color", COLORS.muted)
        .style("text-align", "center")
        .text("No comparison data available.");
      return;
    }

    // Build comparison data for cuisines that have sentiment_distribution
    var compData = [];
    cuisines.forEach(function (cuisine) {
      var info = reviewData[cuisine];
      if (info && info.sentiment_distribution) {
        compData.push({
          cuisine: cuisine,
          positive: info.sentiment_distribution.positive || 0,
          neutral: info.sentiment_distribution.neutral || 0,
          negative: info.sentiment_distribution.negative || 0,
          total_reviews: info.total_reviews_analyzed || 0
        });
      }
    });

    // Sort by positive percentage, take top 10
    compData.sort(function (a, b) { return b.positive - a.positive; });
    compData = compData.slice(0, 10);

    if (compData.length === 0) {
      container.append("p")
        .style("color", COLORS.muted)
        .style("text-align", "center")
        .text("No sentiment comparison data available.");
      return;
    }

    var margin = { top: 20, right: 30, bottom: 40, left: 110 };
    var fullWidth = Math.min(600, container.node().clientWidth || 500);
    var barHeight = 26;
    var gap = 8;
    var chartHeight = compData.length * (barHeight + gap);
    var width = fullWidth - margin.left - margin.right;
    var height = chartHeight;

    var svg = container.append("svg")
      .attr("viewBox", "0 0 " + fullWidth + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Scale: x is 0-100 percentage
    var x = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width]);

    // X axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(5).tickFormat(function (d) { return d + "%"; }))
      .selectAll("text")
      .style("font-size", "10px");

    // Axis label
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 34)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", COLORS.muted)
      .text("Sentiment Distribution (%)");

    var categories = ["positive", "neutral", "negative"];
    var catColors = {
      positive: COLORS.green,
      neutral: COLORS.muted,
      negative: COLORS.red
    };

    // Tooltip
    var tooltip = container.append("div")
      .style("position", "absolute")
      .style("background", COLORS.dark)
      .style("color", COLORS.bg)
      .style("padding", "8px 12px")
      .style("border-radius", "8px")
      .style("font-size", "0.75rem")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "20")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,0.25)")
      .style("transition", "opacity 0.15s")
      .style("white-space", "nowrap");

    container.style("position", "relative");

    // Render each cuisine row
    compData.forEach(function (d, i) {
      var yPos = i * (barHeight + gap);

      // Cuisine label
      g.append("text")
        .attr("x", -8)
        .attr("y", yPos + barHeight / 2 + 4)
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", COLORS.dark)
        .text(d.cuisine.length > 14 ? d.cuisine.substring(0, 13) + "\u2026" : d.cuisine);

      // Background track
      g.append("rect")
        .attr("x", 0)
        .attr("y", yPos)
        .attr("width", width)
        .attr("height", barHeight)
        .attr("rx", barHeight / 2)
        .attr("fill", COLORS.light);

      // Stacked segments
      var xOffset = 0;
      categories.forEach(function (cat, ci) {
        var segWidth = x(d[cat]);
        var rx = 0;
        // Round corners on first and last visible segment
        if (ci === 0) rx = barHeight / 2;

        var rect = g.append("rect")
          .attr("x", xOffset)
          .attr("y", yPos)
          .attr("width", 0)
          .attr("height", barHeight)
          .attr("fill", catColors[cat])
          .attr("opacity", 0.8)
          .style("cursor", "pointer");

        // Rounded corners: first segment gets left radius, last gets right
        if (ci === 0) {
          rect.attr("rx", barHeight / 2);
        }
        if (ci === categories.length - 1) {
          rect.attr("rx", barHeight / 2);
        }

        // Animate width
        rect.transition()
          .duration(700)
          .delay(i * 60 + ci * 100)
          .attr("width", segWidth);

        // Hover tooltip
        rect.on("mouseenter", function (event) {
          tooltip
            .html("<strong>" + d.cuisine + "</strong><br/>" +
              "Positive: " + d.positive.toFixed(1) + "% | " +
              "Neutral: " + d.neutral.toFixed(1) + "% | " +
              "Negative: " + d.negative.toFixed(1) + "%" +
              (d.total_reviews ? "<br/>" + d.total_reviews.toLocaleString() + " reviews analyzed" : ""))
            .style("opacity", 1);
        })
        .on("mousemove", function (event) {
          var containerRect = container.node().getBoundingClientRect();
          var tx = event.clientX - containerRect.left + 12;
          var ty = event.clientY - containerRect.top - 10;
          tooltip.style("left", tx + "px").style("top", ty + "px");
        })
        .on("mouseleave", function () {
          tooltip.style("opacity", 0);
        });

        xOffset += segWidth;
      });
    });

    // Legend
    var legendRow = container.append("div")
      .style("display", "flex")
      .style("justify-content", "center")
      .style("gap", "18px")
      .style("margin-top", "10px")
      .style("flex-wrap", "wrap");

    [
      { label: "Positive", color: COLORS.green },
      { label: "Neutral",  color: COLORS.muted },
      { label: "Negative", color: COLORS.red }
    ].forEach(function (item) {
      var legendItem = legendRow.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "5px")
        .style("font-size", "0.75rem")
        .style("color", COLORS.dark);

      legendItem.append("span")
        .style("display", "inline-block")
        .style("width", "10px")
        .style("height", "10px")
        .style("border-radius", "3px")
        .style("background", item.color);

      legendItem.append("span")
        .style("font-weight", "600")
        .text(item.label);
    });
  }


  // ── 5. SETUP REVIEW SECTION ──────────────────────────────

  /**
   * Main setup function called from main.js.
   * Populates the cuisine dropdown and wires up change events
   * to update all three visualizations (word cloud, carousel, gauge).
   *
   * @param {Object} reviewData  The full review_analysis.json object
   */
  function setupReviewSection(reviewData) {
    if (!reviewData) {
      console.warn("ReviewModule: No review data provided.");
      return;
    }

    var cuisines = Object.keys(reviewData);
    if (cuisines.length === 0) {
      console.warn("ReviewModule: Review data is empty.");
      return;
    }

    cuisines.sort();

    // Store for detective mode
    detectiveState.reviewData = reviewData;

    var selectEl = document.getElementById("review-cuisine-select");
    if (selectEl) {
      selectEl.innerHTML = "";
      cuisines.forEach(function (cuisine) {
        var option = document.createElement("option");
        option.value = cuisine;
        option.textContent = cuisine;
        selectEl.appendChild(option);
      });

      selectEl.addEventListener("change", function () {
        detectiveState.currentCuisine = selectEl.value;
        updateReviewVisualizations(selectEl.value, reviewData);
      });
    }

    var compContainer = d3.select("#sentiment-comparison");
    if (!compContainer.empty()) {
      renderSentimentComparison(compContainer, reviewData, cuisines);
    }

    var initialCuisine = cuisines[0];
    if (selectEl) selectEl.value = initialCuisine;
    detectiveState.currentCuisine = initialCuisine;

    var reviewSection = document.getElementById("section-reviews");
    if (reviewSection) {
      var lazyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            lazyObserver.disconnect();
            // Inject detective toggle after section is visible
            injectDetectiveToggle();
            updateReviewVisualizations(initialCuisine, reviewData);
          }
        });
      }, { threshold: 0.1 });
      lazyObserver.observe(reviewSection);
    } else {
      injectDetectiveToggle();
      updateReviewVisualizations(initialCuisine, reviewData);
    }
  }

  /**
   * Update all per-cuisine visualizations when the dropdown changes.
   */
  function updateReviewVisualizations(cuisine, reviewData) {
    detectiveState.currentCuisine = cuisine;
    var data = reviewData[cuisine];
    if (!data) return;

    // Word cloud
    var cloudContainer = d3.select("#word-cloud-container");
    if (!cloudContainer.empty()) {
      renderWordCloud(cloudContainer, data.top_words || []);
    }

    // Carousel: if detective mode is active re-start the round; otherwise normal carousel
    if (detectiveState.active) {
      startDetectiveRound();
    } else {
      var allReviews = [];
      if (data.positive_excerpts) allReviews = allReviews.concat(data.positive_excerpts);
      if (data.negative_excerpts) allReviews = allReviews.concat(data.negative_excerpts);
      allReviews.sort(function (a, b) { return b.sentiment - a.sentiment; });
      var carouselContainer = d3.select("#review-carousel");
      if (!carouselContainer.empty()) {
        renderReviewCarousel(carouselContainer, allReviews);
      }
    }

    // Sentiment gauge
    var gaugeContainer = d3.select("#sentiment-gauge");
    if (!gaugeContainer.empty()) {
      renderSentimentGauge(
        gaugeContainer,
        data.sentiment_distribution || null,
        data.avg_sentiment || 0
      );
    }
  }


  // ── Export ────────────────────────────────────────────────

  window.ReviewModule = {
    setup: setupReviewSection
  };

})();
