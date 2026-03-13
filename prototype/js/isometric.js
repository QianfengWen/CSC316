/* ============================================================
   Isometric Restaurant Scene — Creative Finale
   Philadelphia Hidden Gems Scrollytelling Project
   Three.js isometric diorama with interactive raycasting
   ============================================================ */

(function () {
  "use strict";

  // ── Style Constants ─────────────────────────────────────────
  var CUISINE_THEME_COLORS = {
    "Ethiopian": "#2ecc71",
    "Korean": "#4a8a6e",
    "Vietnamese": "#6aa84f",
    "Indonesian": "#16a085",
    "Polish": "#c0392b",
    "Taiwanese": "#2980b9",
    "French": "#9b59b6",
    "Ramen": "#e74c3c",
    "Salvadoran": "#e67e22",
    "Malaysian": "#16a085",
    "Peruvian": "#c0392b",
    "Tapas/Small Plates": "#9b59b6"
  };

  var WALL_COLOR = 0xf5e6d3;
  var FLOOR_LIGHT = 0xd4a574;
  var FLOOR_DARK = 0xc4956a;
  var SCENE_BG = 0x1a1410;
  var GOLD_COLOR = 0xffd700;
  var WOOD_COLOR = 0x8b6914;
  var WOOD_DARK = 0x6b4f12;
  var CHAIR_BASE = 0x7a5c3a;
  var COUNTER_COLOR = 0x5c4033;
  var REGISTER_COLOR = 0x3a3a3a;
  var FRAME_COLOR = 0x4a3728;

  // Clothing palette for customer figures
  var CLOTHING_COLORS = [
    0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad,
    0xe67e22, 0x16a085, 0xd4503a, 0x2c3e50,
    0xf39c12, 0x1abc9c, 0x9b59b6, 0x34495e
  ];

  var SKIN_TONES = [0xf0c8a0, 0xd4a574, 0xc68642, 0x8d5524, 0xffdbac];

  // ── Helpers ─────────────────────────────────────────────────
  function hexToThreeColor(hex) {
    return new THREE.Color(hex);
  }

  function getCuisineThreeColor(cuisine) {
    var hex = CUISINE_THEME_COLORS[cuisine] || "#e8a838";
    return new THREE.Color(hex);
  }

  function getCuisineHex(cuisine) {
    return CUISINE_THEME_COLORS[cuisine] || "#e8a838";
  }

  function seededRandom(seed) {
    var x = Math.sin(seed * 9301 + 49297) * 49297;
    return x - Math.floor(x);
  }

  function lerpColor(c1, c2, t) {
    var color = new THREE.Color();
    color.r = c1.r + (c2.r - c1.r) * t;
    color.g = c1.g + (c2.g - c1.g) * t;
    color.b = c1.b + (c2.b - c1.b) * t;
    return color;
  }

  // ── Cuisine Theme Definitions ─────────────────────────────
  var CUISINE_THEMES = {
    japanese: {
      name: "Japanese",
      cuisines: ["Ramen", "Taiwanese", "Sushi"],
      floor: { color1: 0xd4b896, color2: 0xc4a880, border: 0x8b7355, tileRatio: 2 },
      walls: { color: 0xf0ebe3, accent: 0xd4cfc5, grid: true },
      table: { color: 0xd4c4a0, legColor: 0xb8a880, height: 0.5, shape: "round" },
      seat: { type: "cushion", color: 0xc0392b, height: 0.08 },
      decoColor: 0xff6600, decoType: "lantern",
      food: { bowl: 0xe8d4b0, accent: 0xd4503a, shape: "deep_bowl" }
    },
    chinese: {
      name: "Chinese",
      cuisines: ["Chinese", "Dim Sum", "Malaysian"],
      floor: { color1: 0x8b2020, color2: 0x7a1a1a, border: 0xd4a020, tileRatio: 1 },
      walls: { color: 0xb22222, accent: 0xd4a020, grid: false },
      table: { color: 0x4a1a0a, legColor: 0x3a0f05, height: 1.1, shape: "round" },
      seat: { type: "chair", color: 0x5a1a0a, height: 0.7 },
      decoColor: 0xff0000, decoType: "hanging_lantern",
      food: { bowl: 0xd4a060, accent: 0xf5f0e0, shape: "steamer" }
    },
    ethiopian: {
      name: "Ethiopian",
      cuisines: ["Ethiopian", "Indonesian"],
      floor: { color1: 0xb8860b, color2: 0xa07020, border: 0x6b4f2a, tileRatio: 1 },
      walls: { color: 0xc4956a, accent: 0x8fbc8f, grid: false },
      table: { color: 0xb8860b, legColor: 0x8b6914, height: 0.7, shape: "basket" },
      seat: { type: "cushion", color: 0x228b22, height: 0.1 },
      decoColor: 0xdaa520, decoType: "textile",
      food: { bowl: 0xd4a574, accent: 0x8fbc8f, shape: "injera" }
    },
    korean: {
      name: "Korean",
      cuisines: ["Korean", "Vietnamese"],
      floor: { color1: 0xa0522d, color2: 0x8b4513, border: 0x6b3a1f, tileRatio: 3 },
      walls: { color: 0x4a4a4a, accent: 0x2f4f4f, grid: true },
      table: { color: 0x5c4033, legColor: 0x3a2a1a, height: 1.1, shape: "grill" },
      seat: { type: "bench", color: 0x2f6b6b, height: 0.5 },
      decoColor: 0xff69b4, decoType: "neon",
      food: { bowl: 0x808080, accent: 0xd4503a, shape: "grill_plate" }
    },
    european: {
      name: "European",
      cuisines: ["Italian", "French", "Polish", "Tapas/Small Plates"],
      floor: { color1: 0xcc7744, color2: 0xbb6633, border: 0x8b4513, tileRatio: 1 },
      walls: { color: 0xfaf0dc, accent: 0x722f37, grid: false },
      table: { color: 0x5c4033, legColor: 0x3a2a1a, height: 1.1, shape: "cloth" },
      seat: { type: "chair", color: 0x5c4033, height: 0.7 },
      decoColor: 0x722f37, decoType: "chandelier",
      food: { bowl: 0xf5f0e0, accent: 0x722f37, shape: "plate" }
    },
    mexican: {
      name: "Latin American",
      cuisines: ["Mexican", "Salvadoran", "Peruvian", "Cuban"],
      floor: { color1: 0xcc7744, color2: 0xbb5522, border: 0x1e90ff, tileRatio: 1 },
      walls: { color: 0xffa500, accent: 0x40e0d0, grid: false },
      table: { color: 0xa0522d, legColor: 0x8b4513, height: 1.1, shape: "rustic" },
      seat: { type: "chair", color: 0x40e0d0, height: 0.7 },
      decoColor: 0xff1493, decoType: "banner",
      food: { bowl: 0x8b4513, accent: 0x228b22, shape: "taco" }
    }
  };

  // Default theme (generic restaurant)
  var DEFAULT_THEME = {
    name: "Default",
    floor: { color1: FLOOR_LIGHT, color2: FLOOR_DARK, border: 0x8b7355, tileRatio: 1 },
    walls: { color: WALL_COLOR, accent: FRAME_COLOR, grid: false },
    table: { color: WOOD_COLOR, legColor: WOOD_DARK, height: 1.1, shape: "rect" },
    seat: { type: "chair", color: CHAIR_BASE, height: 0.7 },
    decoColor: 0xe8a838, decoType: "frame",
    food: { bowl: 0xf5f0e0, accent: 0xe8a838, shape: "plate" }
  };

  function mapCuisineToTheme(cuisineName) {
    if (!cuisineName) return DEFAULT_THEME;
    var keys = Object.keys(CUISINE_THEMES);
    for (var i = 0; i < keys.length; i++) {
      var theme = CUISINE_THEMES[keys[i]];
      if (theme.cuisines.indexOf(cuisineName) >= 0) return theme;
    }
    return DEFAULT_THEME;
  }

  // ── Toon Material Factory ──────────────────────────────────
  function makeToon(color, opts) {
    opts = opts || {};
    var params = {
      color: color,
      side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide
    };
    if (opts.transparent) {
      params.transparent = true;
      params.opacity = opts.opacity !== undefined ? opts.opacity : 0.8;
    }
    if (opts.emissive) {
      params.emissive = opts.emissive;
      params.emissiveIntensity = opts.emissiveIntensity || 0.3;
    }
    return new THREE.MeshToonMaterial(params);
  }

  // ── Scene Data Binding ─────────────────────────────────────
  // Attach metadata to meshes for raycasting
  function tagObject(obj, type, data) {
    obj.userData.interactiveType = type;
    obj.userData.interactiveData = data;
    // Also tag children
    obj.traverse(function (child) {
      if (child.isMesh) {
        child.userData.interactiveType = type;
        child.userData.interactiveData = data;
      }
    });
  }

  // ── Geometry Builders ──────────────────────────────────────

  /**
   * Build themed floor plane
   */
  function buildFloor(scene, theme) {
    theme = theme || DEFAULT_THEME;
    var floorGroup = new THREE.Group();
    var gridCount = 14;
    var fc = theme.floor;
    var ratio = fc.tileRatio || 1;
    var tileW = 1.2 * ratio;
    var tileD = 1.2;
    var totalW = gridCount * 1.2;

    var colCount = Math.ceil(totalW / tileW);
    var rowCount = Math.ceil(totalW / tileD);

    for (var ix = 0; ix < colCount; ix++) {
      for (var iz = 0; iz < rowCount; iz++) {
        var isLight = (ix + iz) % 2 === 0;
        var color = isLight ? fc.color1 : fc.color2;
        var geo = new THREE.BoxGeometry(tileW - 0.02, 0.08, tileD - 0.02);
        var mat = makeToon(color);
        var tile = new THREE.Mesh(geo, mat);
        tile.position.set(
          ix * tileW - totalW / 2 + tileW / 2,
          -0.04,
          iz * tileD - totalW / 2 + tileD / 2
        );
        tile.receiveShadow = true;
        floorGroup.add(tile);
      }
    }

    // Accent border tiles (if theme has distinct border color)
    if (fc.border && fc.border !== fc.color1) {
      var borderMat = makeToon(fc.border);
      for (var b = 0; b < 4; b++) {
        var borderStrip = new THREE.Mesh(
          new THREE.BoxGeometry(b < 2 ? totalW : 0.15, 0.09, b < 2 ? 0.15 : totalW),
          borderMat
        );
        var halfLen = totalW / 2;
        if (b === 0) borderStrip.position.set(0, -0.035, -halfLen);
        if (b === 1) borderStrip.position.set(0, -0.035, halfLen);
        if (b === 2) borderStrip.position.set(-halfLen, -0.035, 0);
        if (b === 3) borderStrip.position.set(halfLen, -0.035, 0);
        floorGroup.add(borderStrip);
      }
    }

    scene.add(floorGroup);
    return floorGroup;
  }

  /**
   * Build two walls (back wall along Z-axis, right wall along X-axis)
   * with window cutouts using CSG-like approach (multiple boxes)
   */
  function buildWalls(scene, theme) {
    theme = theme || DEFAULT_THEME;
    var wallGroup = new THREE.Group();
    var wallMat = makeToon(theme.walls.color);
    var wallHeight = 6;
    var wallLength = 16.8;
    var wallThick = 0.3;
    var halfLen = wallLength / 2;

    // -- Back wall (along X-axis, at far Z) --
    // Main wall body - left section
    var bwLeft = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, wallHeight, wallThick),
      wallMat
    );
    bwLeft.position.set(-halfLen / 2 - 1.7, wallHeight / 2, -halfLen);
    bwLeft.castShadow = true;
    wallGroup.add(bwLeft);

    // Main wall body - right section
    var bwRight = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, wallHeight, wallThick),
      wallMat
    );
    bwRight.position.set(halfLen / 2 + 1.7, wallHeight / 2, -halfLen);
    bwRight.castShadow = true;
    wallGroup.add(bwRight);

    // Window area - top beam above window
    var bwTopBeam = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 1.5, wallThick),
      wallMat
    );
    bwTopBeam.position.set(0, wallHeight - 0.75, -halfLen);
    wallGroup.add(bwTopBeam);

    // Window area - bottom sill
    var bwSill = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 1.5, wallThick),
      wallMat
    );
    bwSill.position.set(0, 0.75, -halfLen);
    wallGroup.add(bwSill);

    // Window frame pieces (vertical dividers)
    var frameMat = makeToon(FRAME_COLOR);
    for (var wf = -1; wf <= 1; wf++) {
      var divider = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 3.0, wallThick + 0.05),
        frameMat
      );
      divider.position.set(wf * 2.0, wallHeight / 2, -halfLen);
      wallGroup.add(divider);
    }

    // Window glass
    var glassMat = makeToon(0x87ceeb, { transparent: true, opacity: 0.25 });
    var windowGlass = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 2.8, 0.05),
      glassMat
    );
    windowGlass.position.set(0, wallHeight / 2, -halfLen + 0.1);
    wallGroup.add(windowGlass);

    // -- Right wall (along Z-axis, at far X) --
    var rwBack = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, wallHeight, 5.5),
      wallMat
    );
    rwBack.position.set(halfLen, wallHeight / 2, -halfLen / 2 - 1.7);
    rwBack.castShadow = true;
    wallGroup.add(rwBack);

    var rwFront = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, wallHeight, 5.5),
      wallMat
    );
    rwFront.position.set(halfLen, wallHeight / 2, halfLen / 2 + 1.7);
    rwFront.castShadow = true;
    wallGroup.add(rwFront);

    // Right wall window
    var rwTopBeam = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, 1.5, 6.0),
      wallMat
    );
    rwTopBeam.position.set(halfLen, wallHeight - 0.75, 0);
    wallGroup.add(rwTopBeam);

    var rwSill = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, 1.5, 6.0),
      wallMat
    );
    rwSill.position.set(halfLen, 0.75, 0);
    wallGroup.add(rwSill);

    for (var wf2 = -1; wf2 <= 1; wf2++) {
      var divider2 = new THREE.Mesh(
        new THREE.BoxGeometry(wallThick + 0.05, 3.0, 0.12),
        frameMat
      );
      divider2.position.set(halfLen, wallHeight / 2, wf2 * 2.0);
      wallGroup.add(divider2);
    }

    var windowGlass2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 2.8, 5.8),
      glassMat
    );
    windowGlass2.position.set(halfLen - 0.1, wallHeight / 2, 0);
    wallGroup.add(windowGlass2);

    // Themed accent band on walls
    if (theme.walls.accent) {
      var accentMat = makeToon(theme.walls.accent);
      // Back wall accent strip
      var backAccent = new THREE.Mesh(
        new THREE.BoxGeometry(wallLength, 0.2, wallThick + 0.02),
        accentMat
      );
      backAccent.position.set(0, wallHeight * 0.7, -halfLen + 0.01);
      wallGroup.add(backAccent);
      // Right wall accent strip
      var rightAccent = new THREE.Mesh(
        new THREE.BoxGeometry(wallThick + 0.02, 0.2, wallLength),
        accentMat
      );
      rightAccent.position.set(halfLen - 0.01, wallHeight * 0.7, 0);
      wallGroup.add(rightAccent);
    }

    // Grid overlay for shoji/industrial themes
    if (theme.walls.grid) {
      var gridMat = makeToon(theme.walls.accent || 0x333333, { transparent: true, opacity: 0.3 });
      for (var gi = 0; gi < 6; gi++) {
        // Horizontal grid lines on back wall
        var hLine = new THREE.Mesh(new THREE.BoxGeometry(wallLength, 0.04, 0.02), gridMat);
        hLine.position.set(0, 1.0 + gi * 0.8, -halfLen + 0.16);
        wallGroup.add(hLine);
      }
      for (var gv = 0; gv < 8; gv++) {
        // Vertical grid lines on back wall
        var vLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, wallHeight, 0.02), gridMat);
        vLine.position.set(-halfLen + 2 + gv * 1.8, wallHeight / 2, -halfLen + 0.16);
        wallGroup.add(vLine);
      }
    }

    scene.add(wallGroup);
    return wallGroup;
  }

  /**
   * Build a single themed table
   */
  function buildTable(x, z, seats, cuisineColor, theme) {
    theme = theme || DEFAULT_THEME;
    var tc = theme.table;
    var group = new THREE.Group();
    var legH = tc.height;
    var legR = 0.06;
    var tableH = 0.08;

    var topMat = makeToon(tc.color);
    var legMat = makeToon(tc.legColor);

    if (tc.shape === "round") {
      // Round table (Chinese, Japanese)
      var radius = seats > 2 ? 0.9 : 0.65;
      var surface = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, tableH, 16),
        topMat
      );
      surface.position.y = legH + tableH / 2;
      surface.castShadow = true;
      surface.receiveShadow = true;
      group.add(surface);

      // Center pedestal leg
      var centerLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, legH, 8),
        legMat
      );
      centerLeg.position.y = legH / 2;
      centerLeg.castShadow = true;
      group.add(centerLeg);

      // Chinese lazy susan disc
      if (theme.name === "Chinese" && seats > 2) {
        var susan = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.03, 16),
          makeToon(0xf5f0e0)
        );
        susan.position.y = legH + tableH + 0.02;
        group.add(susan);
      }
    } else if (tc.shape === "basket") {
      // Mesob basket table (Ethiopian) — inverted cone
      var topR = seats > 2 ? 0.8 : 0.6;
      var surface = new THREE.Mesh(
        new THREE.CylinderGeometry(topR, topR * 0.4, legH, 12),
        topMat
      );
      surface.position.y = legH / 2;
      surface.castShadow = true;
      group.add(surface);
      // Woven ring accents
      for (var ri = 0; ri < 3; ri++) {
        var ringR = topR * 0.4 + (topR - topR * 0.4) * (ri / 3);
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(ringR, 0.025, 6, 16),
          makeToon(ri % 2 === 0 ? 0xdaa520 : 0x228b22)
        );
        ring.position.y = legH * 0.3 + ri * legH * 0.2;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      }
    } else if (tc.shape === "grill") {
      // Korean grill table
      var tableW = seats > 2 ? 2.0 : 1.4;
      var tableD = 1.2;
      var surface = new THREE.Mesh(
        new THREE.BoxGeometry(tableW, tableH, tableD),
        topMat
      );
      surface.position.y = legH + tableH / 2;
      surface.castShadow = true;
      group.add(surface);
      // Grill inset (glowing red circle)
      var grill = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16),
        makeToon(0x333333, { emissive: 0xff3300, emissiveIntensity: 0.4 })
      );
      grill.position.y = legH + tableH + 0.01;
      group.add(grill);
      // Grill grate lines
      for (var gl = -2; gl <= 2; gl++) {
        var grate = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.01, 0.02),
          makeToon(0x666666)
        );
        grate.position.set(0, legH + tableH + 0.02, gl * 0.08);
        group.add(grate);
      }
      // Four legs
      var offG = [[-tableW / 2 + 0.12, -tableD / 2 + 0.12], [tableW / 2 - 0.12, -tableD / 2 + 0.12],
      [-tableW / 2 + 0.12, tableD / 2 - 0.12], [tableW / 2 - 0.12, tableD / 2 - 0.12]];
      offG.forEach(function (off) {
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 6), legMat));
        group.children[group.children.length - 1].position.set(off[0], legH / 2, off[1]);
      });
    } else if (tc.shape === "cloth") {
      // European tablecloth table
      var tableW = seats > 2 ? 2.0 : 1.4;
      var tableD = 1.2;
      // Dark wood base
      var base = new THREE.Mesh(new THREE.BoxGeometry(tableW, tableH, tableD), topMat);
      base.position.y = legH + tableH / 2;
      base.castShadow = true;
      group.add(base);
      // White cloth overlay (slightly larger, draped)
      var cloth = new THREE.Mesh(
        new THREE.BoxGeometry(tableW + 0.3, 0.02, tableD + 0.3),
        makeToon(0xffffff, { transparent: true, opacity: 0.85 })
      );
      cloth.position.y = legH + tableH + 0.01;
      group.add(cloth);
      // Four legs
      var offC = [[-tableW / 2 + 0.12, -tableD / 2 + 0.12], [tableW / 2 - 0.12, -tableD / 2 + 0.12],
      [-tableW / 2 + 0.12, tableD / 2 - 0.12], [tableW / 2 - 0.12, tableD / 2 - 0.12]];
      offC.forEach(function (off) {
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 6), legMat));
        group.children[group.children.length - 1].position.set(off[0], legH / 2, off[1]);
      });
    } else {
      // Default rectangular or rustic table
      var tableW = seats > 2 ? 2.0 : 1.4;
      var tableD = 1.2;
      var surface = new THREE.Mesh(new THREE.BoxGeometry(tableW, tableH, tableD), topMat);
      surface.position.y = legH + tableH / 2;
      surface.castShadow = true;
      surface.receiveShadow = true;
      group.add(surface);
      // Four legs
      var offD = [[-tableW / 2 + 0.12, -tableD / 2 + 0.12], [tableW / 2 - 0.12, -tableD / 2 + 0.12],
      [-tableW / 2 + 0.12, tableD / 2 - 0.12], [tableW / 2 - 0.12, tableD / 2 - 0.12]];
      offD.forEach(function (off) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 6), legMat);
        leg.position.set(off[0], legH / 2, off[1]);
        leg.castShadow = true;
        group.add(leg);
      });
    }

    // Decorative plate on table (cuisine-colored)
    var plateMat = makeToon(cuisineColor);
    var plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.04, 16),
      plateMat
    );
    plate.position.set(0, legH + tableH + 0.02, 0);
    group.add(plate);

    group.position.set(x, 0, z);
    return group;
  }

  /**
   * Build themed seating (chair, cushion, or bench)
   */
  function buildChair(x, z, rotY, theme) {
    theme = theme || DEFAULT_THEME;
    var sc = theme.seat;
    var group = new THREE.Group();

    if (sc.type === "cushion") {
      // Floor cushion (Japanese/Ethiopian)
      var cushionMat = makeToon(sc.color);
      var cushion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.3, sc.height, 12),
        cushionMat
      );
      cushion.position.y = sc.height / 2;
      cushion.castShadow = true;
      group.add(cushion);
    } else if (sc.type === "bench") {
      // Modern bench (Korean)
      var benchMat = makeToon(sc.color);
      var bench = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.08, 0.4),
        benchMat
      );
      bench.position.y = sc.height;
      bench.castShadow = true;
      group.add(bench);
      // Two bench legs
      [-0.35, 0.35].forEach(function (lx) {
        var leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, sc.height, 0.35),
          makeToon(0x444444)
        );
        leg.position.set(lx, sc.height / 2, 0);
        group.add(leg);
      });
    } else {
      // Standard chair
      var seatW = 0.5, seatD = 0.5, seatH = 0.06;
      var legH = sc.height;
      var legR = 0.04;
      var backH = 0.6, backThick = 0.06;

      var mat = makeToon(sc.color);

      var seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH, seatD), mat);
      seat.position.y = legH + seatH / 2;
      seat.castShadow = true;
      group.add(seat);

      var legPositions = [
        [-seatW / 2 + 0.06, -seatD / 2 + 0.06], [seatW / 2 - 0.06, -seatD / 2 + 0.06],
        [-seatW / 2 + 0.06, seatD / 2 - 0.06], [seatW / 2 - 0.06, seatD / 2 - 0.06]
      ];
      legPositions.forEach(function (lp) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 6), mat);
        leg.position.set(lp[0], legH / 2, lp[1]);
        group.add(leg);
      });

      var back = new THREE.Mesh(new THREE.BoxGeometry(seatW, backH, backThick), mat);
      back.position.set(0, legH + seatH + backH / 2, -seatD / 2 + backThick / 2);
      back.castShadow = true;
      group.add(back);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY || 0;
    return group;
  }

  /**
   * Build themed food items on a table
   */
  function buildFoodItems(tableX, tableZ, tableTopY, dishes, cuisineColor, theme) {
    theme = theme || DEFAULT_THEME;
    var fc = theme.food;
    var foodGroup = new THREE.Group();
    var dishCount = Math.min(dishes.length, 3);

    for (var i = 0; i < dishCount; i++) {
      var itemGroup = new THREE.Group();
      var angle = (i / dishCount) * Math.PI * 2 + 0.3;
      var radius = 0.35;
      var px = Math.cos(angle) * radius;
      var pz = Math.sin(angle) * radius;

      var colorVariation = lerpColor(
        new THREE.Color(fc.bowl),
        cuisineColor,
        0.5 + seededRandom(i * 17 + tableX) * 0.5
      );

      // Plate base
      var plateMat = makeToon(0xf5f5f0);
      var plateMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 12), plateMat);
      itemGroup.add(plateMesh);

      if (fc.shape === "deep_bowl") {
        // Japanese ramen bowl
        var bowl = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          makeToon(colorVariation)
        );
        bowl.rotation.x = Math.PI;
        bowl.position.y = 0.16;
        itemGroup.add(bowl);
        // Chopsticks
        if (i === 0) {
          [0.04, -0.04].forEach(function (dx) {
            var stick = new THREE.Mesh(
              new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4),
              makeToon(0x8b6914)
            );
            stick.position.set(dx, 0.18, 0);
            stick.rotation.z = 0.3;
            stick.rotation.x = -0.2;
            itemGroup.add(stick);
          });
        }
      } else if (fc.shape === "steamer") {
        // Chinese dim sum steamer
        var steamer = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12),
          makeToon(0xd4b896)
        );
        steamer.position.y = 0.08;
        itemGroup.add(steamer);
        // Steamer lid
        var lid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.17, 0.03, 12),
          makeToon(0xc4a880)
        );
        lid.position.y = 0.14;
        itemGroup.add(lid);
      } else if (fc.shape === "injera") {
        // Ethiopian injera (flat disc with colored mounds)
        var injera = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16),
          makeToon(0xd4a574)
        );
        injera.position.y = 0.03;
        itemGroup.add(injera);
        // Small colored food mounds
        for (var m = 0; m < 3; m++) {
          var mAngle = (m / 3) * Math.PI * 2;
          var mound = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 6),
            makeToon(m === 0 ? 0x8b4513 : m === 1 ? 0x228b22 : 0xdaa520)
          );
          mound.position.set(Math.cos(mAngle) * 0.1, 0.07, Math.sin(mAngle) * 0.1);
          itemGroup.add(mound);
        }
      } else if (fc.shape === "grill_plate") {
        // Korean grill plate with meat pieces
        var plate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12),
          makeToon(0x808080)
        );
        plate.position.y = 0.03;
        itemGroup.add(plate);
        for (var mp = 0; mp < 3; mp++) {
          var meat = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.03, 0.06),
            makeToon(0x8b4513)
          );
          meat.position.set((mp - 1) * 0.08, 0.06, 0);
          meat.rotation.y = mp * 0.5;
          itemGroup.add(meat);
        }
      } else if (fc.shape === "taco") {
        // Latin American — varied shapes
        if (i % 2 === 0) {
          // Taco shape (half cylinder)
          var taco = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8, 1, false, 0, Math.PI),
            makeToon(0xe8c870)
          );
          taco.position.y = 0.08;
          taco.rotation.z = Math.PI / 2;
          itemGroup.add(taco);
          // Filling
          var fill = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 6, 4),
            makeToon(0x228b22)
          );
          fill.position.y = 0.12;
          itemGroup.add(fill);
        } else {
          // Bowl (guacamole)
          var bowlL = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            makeToon(0x8b4513)
          );
          bowlL.rotation.x = Math.PI;
          bowlL.position.y = 0.12;
          itemGroup.add(bowlL);
          var guac = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8),
            makeToon(0x228b22)
          );
          guac.position.y = 0.08;
          itemGroup.add(guac);
        }
      } else {
        // Default plate food
        var foodType = i % 3;
        if (foodType === 0) {
          var bowl = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            makeToon(colorVariation)
          );
          bowl.rotation.x = Math.PI;
          bowl.position.y = 0.14;
          itemGroup.add(bowl);
        } else if (foodType === 1) {
          var food = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10), makeToon(colorVariation));
          food.position.y = 0.05;
          itemGroup.add(food);
        } else {
          var stack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), makeToon(colorVariation));
          stack.position.y = 0.07;
          itemGroup.add(stack);
        }
      }

      itemGroup.position.set(tableX + px, tableTopY + 0.02, tableZ + pz);
      tagObject(itemGroup, "food", { dish: dishes[i], dishIndex: i, tableX: tableX, tableZ: tableZ });
      foodGroup.add(itemGroup);
    }

    return foodGroup;
  }

  /**
   * Build a simple humanoid customer figure
   */
  function buildCustomerFigure(x, z, seed, seated) {
    var group = new THREE.Group();
    var clothingIdx = Math.floor(seededRandom(seed) * CLOTHING_COLORS.length);
    var skinIdx = Math.floor(seededRandom(seed + 7) * SKIN_TONES.length);

    var bodyColor = CLOTHING_COLORS[clothingIdx];
    var skinColor = SKIN_TONES[skinIdx];

    var bodyMat = makeToon(bodyColor);
    var skinMat = makeToon(skinColor);

    // Body (cylinder)
    var bodyH = seated ? 0.6 : 0.9;
    var bodyGeo = new THREE.CylinderGeometry(0.16, 0.2, bodyH, 8);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    var baseY = seated ? 0.95 : 0.5;
    body.position.y = baseY;
    body.castShadow = true;
    group.add(body);

    // Head (sphere)
    var headGeo = new THREE.SphereGeometry(0.14, 10, 8);
    var head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = baseY + bodyH / 2 + 0.16;
    head.castShadow = true;
    group.add(head);

    // Hair (slightly larger top hemisphere)
    var hairColor = seededRandom(seed + 22) > 0.5 ? 0x2c1810 : 0x4a3520;
    var hairMat = makeToon(hairColor);
    var hairGeo = new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    var hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = baseY + bodyH / 2 + 0.18;
    group.add(hair);

    // Arms (small cylinders)
    [-1, 1].forEach(function (side) {
      var arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6),
        bodyMat
      );
      arm.position.set(side * 0.22, baseY - 0.05, 0);
      arm.rotation.z = side * 0.3;
      group.add(arm);
    });

    if (!seated) {
      // Legs for standing figures
      [-1, 1].forEach(function (side) {
        var leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6),
          makeToon(0x2c3e50)
        );
        leg.position.set(side * 0.1, 0.25, 0);
        group.add(leg);
      });
    }

    group.position.set(x, 0, z);
    return group;
  }

  /**
   * Build the counter/bar area
   */
  function buildCounter(scene) {
    var counterGroup = new THREE.Group();
    var counterLen = 6;
    var counterH = 1.3;
    var counterD = 0.8;
    var halfLen = 16.8 / 2;

    // Counter top
    var counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(counterLen, 0.1, counterD),
      makeToon(COUNTER_COLOR)
    );
    counterTop.position.set(-halfLen + counterLen / 2 + 0.5, counterH, -halfLen + 1.5);
    counterTop.castShadow = true;
    counterTop.receiveShadow = true;
    counterGroup.add(counterTop);

    // Counter body (front panel)
    var counterBody = new THREE.Mesh(
      new THREE.BoxGeometry(counterLen, counterH, 0.12),
      makeToon(0x6b4f33)
    );
    counterBody.position.set(-halfLen + counterLen / 2 + 0.5, counterH / 2, -halfLen + 1.5 + counterD / 2);
    counterBody.castShadow = true;
    counterGroup.add(counterBody);

    // Counter body (back panel)
    var counterBack = new THREE.Mesh(
      new THREE.BoxGeometry(counterLen, counterH - 0.3, 0.08),
      makeToon(WALL_COLOR)
    );
    counterBack.position.set(-halfLen + counterLen / 2 + 0.5, (counterH - 0.3) / 2, -halfLen + 1.5 - counterD / 2);
    counterGroup.add(counterBack);

    // Register
    var registerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.25, 0.4),
      makeToon(REGISTER_COLOR)
    );
    registerBase.position.set(-halfLen + 2.0, counterH + 0.125, -halfLen + 1.5);
    counterGroup.add(registerBase);

    // Register screen
    var screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.3, 0.04),
      makeToon(0x1a1a2e)
    );
    screen.position.set(-halfLen + 2.0, counterH + 0.35, -halfLen + 1.5 + 0.12);
    screen.rotation.x = -0.15;
    counterGroup.add(screen);

    // Screen glow
    var screenGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.25, 0.01),
      makeToon(0x4488cc, { emissive: 0x4488cc, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })
    );
    screenGlow.position.set(-halfLen + 2.0, counterH + 0.35, -halfLen + 1.5 + 0.15);
    screenGlow.rotation.x = -0.15;
    counterGroup.add(screenGlow);

    // Bar stools along counter
    for (var s = 0; s < 3; s++) {
      var stool = new THREE.Group();
      var stoolX = -halfLen + 1.5 + s * 1.8;
      var stoolZ = -halfLen + 2.6;

      // Stool seat (cylinder)
      var stoolSeat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.18, 0.06, 10),
        makeToon(0x8b4513)
      );
      stoolSeat.position.set(stoolX, 0.9, stoolZ);
      counterGroup.add(stoolSeat);

      // Stool leg (single center pole)
      var stoolLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.9, 6),
        makeToon(0x555555)
      );
      stoolLeg.position.set(stoolX, 0.45, stoolZ);
      counterGroup.add(stoolLeg);

      // Stool base ring
      var baseRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.02, 6, 12),
        makeToon(0x555555)
      );
      baseRing.position.set(stoolX, 0.03, stoolZ);
      baseRing.rotation.x = Math.PI / 2;
      counterGroup.add(baseRing);
    }

    scene.add(counterGroup);
    return counterGroup;
  }

  /**
   * Build floating gold rating stars above entrance
   */
  function buildRatingStars(scene, avgRating) {
    var starsGroup = new THREE.Group();
    var starCount = Math.round(avgRating || 4.5);
    var halfLen = 16.8 / 2;

    for (var i = 0; i < starCount; i++) {
      var starGroup = new THREE.Group();

      // Star shape via extruded shape
      var starShape = new THREE.Shape();
      var outerR = 0.2;
      var innerR = 0.08;
      var points = 5;

      for (var p = 0; p < points * 2; p++) {
        var angle = (p * Math.PI) / points - Math.PI / 2;
        var r = p % 2 === 0 ? outerR : innerR;
        var sx = Math.cos(angle) * r;
        var sy = Math.sin(angle) * r;
        if (p === 0) {
          starShape.moveTo(sx, sy);
        } else {
          starShape.lineTo(sx, sy);
        }
      }
      starShape.closePath();

      var extrudeSettings = {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2
      };

      var starGeo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
      var starMat = makeToon(GOLD_COLOR, {
        emissive: 0xdaa520,
        emissiveIntensity: 0.4
      });
      var starMesh = new THREE.Mesh(starGeo, starMat);

      starMesh.castShadow = true;
      starGroup.add(starMesh);

      // Position above the entrance/front area
      starGroup.position.set(
          -halfLen + 2.0 + i * 0.7,
          5.2 + seededRandom(i * 31) * 0.3,
          halfLen - 1.5
      );

      starGroup.userData.baseY = starGroup.position.y;
      starGroup.userData.animPhase = i * 0.8;

      starsGroup.add(starGroup);
    }

    scene.add(starsGroup);
    return starsGroup;
  }

  /**
   * Build wall decorations (frames on walls)
   */
  function buildWallDecorations(scene, sceneData) {
    var decoGroup = new THREE.Group();
    var halfLen = 16.8 / 2;
    var wallZ = -halfLen + 0.2;
    var wallX = halfLen - 0.2;

    // Keep the existing visual structure:
    // 4 frames on back wall + 4 frames on right wall
    var framePositions = [
      { x: -5.0, y: 3.8, wall: "back" },
      { x: -2.5, y: 4.0, wall: "back" },
      { x: 4.5, y: 3.6, wall: "back" },
      { x: 6.0, y: 4.2, wall: "back" }
    ];

    var rightFramePositions = [
      { z: -4.0, y: 3.5, wall: "right" },
      { z: -1.5, y: 4.1, wall: "right" },
      { z: 2.0, y: 3.8, wall: "right" },
      { z: 5.0, y: 3.6, wall: "right" }
    ];

    var restaurant = (sceneData && sceneData.length > 0) ? sceneData[0] : null;
    if (!restaurant) {
      scene.add(decoGroup);
      return decoGroup;
    }

    var wallDishEntries = getRestaurantWallDishEntries(restaurant);
    var textureLoader = new THREE.TextureLoader();

    function createFrame(px, py, pz, rotY, index) {
      var frameGroup = new THREE.Group();
      var fw = 0.95 + seededRandom(index * 13) * 0.35;
      var fh = 0.72 + seededRandom(index * 17) * 0.22;

      var dishEntry = wallDishEntries[index % wallDishEntries.length];

      // Outer frame
      var border = new THREE.Mesh(
        new THREE.BoxGeometry(fw + 0.10, fh + 0.10, 0.05),
        makeToon(FRAME_COLOR)
      );
      frameGroup.add(border);

      // Inner image plane
      var artMaterial;
      if (dishEntry && dishEntry.image) {
        var texture = textureLoader.load(dishEntry.image);
        if (THREE.SRGBColorSpace) {
          texture.colorSpace = THREE.SRGBColorSpace;
        } else if (texture.encoding !== undefined) {
          texture.encoding = THREE.sRGBEncoding;
        }
        artMaterial = new THREE.MeshBasicMaterial({ map: texture });
      } else {
        artMaterial = makeToon(0xd9d2c3);
      }

      var canvas = new THREE.Mesh(
        new THREE.PlaneGeometry(fw - 0.04, fh - 0.04),
        artMaterial
      );
      canvas.position.z = 0.031;
      frameGroup.add(canvas);

      frameGroup.position.set(px, py, pz);
      frameGroup.rotation.y = rotY;

      tagObject(frameGroup, "wall_decoration", {
        restaurant: restaurant,
        cuisine: restaurant.cuisine,
        dish: dishEntry ? dishEntry.dish : "signature dish",
        image: dishEntry ? dishEntry.image : null,
        frameIndex: index
      });

      return frameGroup;
    }

    framePositions.forEach(function (fp, i) {
      decoGroup.add(createFrame(fp.x, fp.y, wallZ, 0, i));
    });

    rightFramePositions.forEach(function (fp, i) {
      decoGroup.add(createFrame(wallX, fp.y, fp.z, -Math.PI / 2, i + framePositions.length));
    });

    scene.add(decoGroup);
    return decoGroup;
  }

  // ── Themed Decorations ─────────────────────────────────────

  /**
   * Build per-theme unique decoration objects (lanterns, banners, etc.)
   */
  function buildThemedDecorations(scene, theme) {
    theme = theme || DEFAULT_THEME;
    var decoGroup = new THREE.Group();
    var halfLen = 16.8 / 2;
    var dt = theme.decoType;

    if (dt === "lantern") {
      // Japanese paper lanterns hanging from ceiling
      var positions = [
        { x: -3, z: -2 }, { x: 1, z: -3 }, { x: 4, z: 0 },
        { x: -2, z: 3 }, { x: 3, z: 4 }
      ];
      positions.forEach(function (p, i) {
        var lantern = new THREE.Group();
        // Wire
        var wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 1.5, 4),
          makeToon(0x333333)
        );
        wire.position.y = 5.25;
        lantern.add(wire);
        // Lantern body (sphere)
        var body = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 8),
          makeToon(i % 2 === 0 ? 0xff6600 : 0xcc3300, { emissive: 0xff6600, emissiveIntensity: 0.3 })
        );
        body.position.y = 4.4;
        lantern.add(body);
        // Lantern base ring
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.02, 6, 12),
          makeToon(0x333333)
        );
        ring.position.y = 4.2;
        ring.rotation.x = Math.PI / 2;
        lantern.add(ring);
        lantern.position.set(p.x, 0, p.z);
        decoGroup.add(lantern);
      });
      // Bamboo divider
      for (var b = 0; b < 5; b++) {
        var bamboo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6),
          makeToon(0x6b8e23)
        );
        bamboo.position.set(-halfLen + 7.5 + b * 0.25, 1.75, halfLen - 0.5);
        decoGroup.add(bamboo);
      }
    } else if (dt === "hanging_lantern") {
      // Chinese red hanging lanterns with gold trim
      var positions = [
        { x: -4, z: -1 }, { x: -1, z: -4 }, { x: 2, z: -1 },
        { x: 5, z: -3 }, { x: 0, z: 3 }, { x: 4, z: 3 }
      ];
      positions.forEach(function (p) {
        var lantern = new THREE.Group();
        var wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4),
          makeToon(0xd4a020)
        );
        wire.position.y = 5.4;
        lantern.add(wire);
        var body = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 10, 8),
          makeToon(0xcc0000, { emissive: 0xff0000, emissiveIntensity: 0.25 })
        );
        body.position.y = 4.7;
        lantern.add(body);
        // Gold trim rings
        [-0.12, 0, 0.12].forEach(function (dy) {
          var trim = new THREE.Mesh(
            new THREE.TorusGeometry(0.26, 0.015, 6, 12),
            makeToon(0xd4a020)
          );
          trim.position.y = 4.7 + dy;
          trim.rotation.x = Math.PI / 2;
          lantern.add(trim);
        });
        lantern.position.set(p.x, 0, p.z);
        decoGroup.add(lantern);
      });
    } else if (dt === "textile") {
      // Ethiopian textile wall panels
      var panelColors = [0xdaa520, 0x228b22, 0xc0392b, 0x2980b9];
      for (var tp = 0; tp < 3; tp++) {
        var panel = new THREE.Group();
        var w = 1.2, h = 1.8;
        // Backing
        var back = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 0.04),
          makeToon(0x8b6914)
        );
        panel.add(back);
        // Colored stripes
        for (var s = 0; s < 6; s++) {
          var stripe = new THREE.Mesh(
            new THREE.BoxGeometry(w - 0.1, 0.2, 0.05),
            makeToon(panelColors[s % panelColors.length])
          );
          stripe.position.set(0, -h / 2 + 0.2 + s * 0.28, 0.01);
          panel.add(stripe);
        }
        panel.position.set(-halfLen + 2.5 + tp * 3.5, 3.5, -halfLen + 0.2);
        decoGroup.add(panel);
      }
      // Jebena coffee pot on counter
      var jebena = new THREE.Group();
      var potBody = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 6),
        makeToon(0x5c3317)
      );
      potBody.position.y = 1.55;
      jebena.add(potBody);
      var spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.04, 0.2, 6),
        makeToon(0x5c3317)
      );
      spout.position.set(0.12, 1.6, 0);
      spout.rotation.z = -0.5;
      jebena.add(spout);
      jebena.position.set(-halfLen + 4, 0, -halfLen + 1.5);
      decoGroup.add(jebena);
    } else if (dt === "neon") {
      // Korean neon sign + Edison bulbs
      // Neon sign box on right wall
      var neon = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.6, 2.0),
        makeToon(0xff69b4, { emissive: 0xff69b4, emissiveIntensity: 0.6 })
      );
      neon.position.set(halfLen - 0.2, 4.0, 0);
      decoGroup.add(neon);
      // Edison bulbs hanging from ceiling
      var bulbPositions = [
        { x: -3, z: -2 }, { x: 0, z: -3 }, { x: 3, z: -1 },
        { x: -2, z: 2 }, { x: 2, z: 3 }, { x: 5, z: 1 }
      ];
      bulbPositions.forEach(function (p) {
        var bulb = new THREE.Group();
        var wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, 1.8, 4),
          makeToon(0x333333)
        );
        wire.position.y = 5.1;
        bulb.add(wire);
        var light = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 6),
          makeToon(0xffcc00, { emissive: 0xffaa00, emissiveIntensity: 0.5 })
        );
        light.position.y = 4.1;
        bulb.add(light);
        bulb.position.set(p.x, 0, p.z);
        decoGroup.add(bulb);
      });
      // Soju bottles on shelf
      for (var sj = 0; sj < 4; sj++) {
        var bottle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6),
          makeToon(0x228b22)
        );
        bottle.position.set(halfLen - 0.3, 2.5, -3 + sj * 0.3);
        decoGroup.add(bottle);
      }
    } else if (dt === "chandelier") {
      // European wrought-iron chandelier
      var chandelier = new THREE.Group();
      var centerHub = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        makeToon(0x333333)
      );
      centerHub.position.y = 5.0;
      chandelier.add(centerHub);
      // Arms with light bulbs
      for (var a = 0; a < 6; a++) {
        var angle = (a / 6) * Math.PI * 2;
        var arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4),
          makeToon(0x333333)
        );
        arm.position.set(Math.cos(angle) * 0.4, 4.95, Math.sin(angle) * 0.4);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = angle;
        chandelier.add(arm);
        var bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 6),
          makeToon(0xfffde0, { emissive: 0xffcc00, emissiveIntensity: 0.4 })
        );
        bulb.position.set(Math.cos(angle) * 0.7, 4.85, Math.sin(angle) * 0.7);
        chandelier.add(bulb);
      }
      // Chain to ceiling
      var chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4),
        makeToon(0x333333)
      );
      chain.position.y = 5.5;
      chandelier.add(chain);
      chandelier.position.set(0, 0, 0);
      decoGroup.add(chandelier);
      // Wine rack on back wall
      for (var wr = 0; wr < 3; wr++) {
        for (var wc = 0; wc < 4; wc++) {
          var bottle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6),
            makeToon(0x4a0a2a)
          );
          bottle.position.set(-halfLen + 6 + wc * 0.25, 3.2 + wr * 0.3, -halfLen + 0.22);
          bottle.rotation.z = Math.PI / 2;
          decoGroup.add(bottle);
        }
      }
    } else if (dt === "banner") {
      // Latin American papel picado banners
      var bannerColors = [0xff1493, 0x00bfff, 0xffd700, 0x32cd32, 0xff6347, 0x9370db];
      for (var row = 0; row < 2; row++) {
        var wireY = 4.8 - row * 1.2;
        // Wire
        var bannerWire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, 14, 4),
          makeToon(0x333333)
        );
        bannerWire.position.set(0, wireY, -3 + row * 6);
        bannerWire.rotation.z = Math.PI / 2;
        decoGroup.add(bannerWire);
        // Banner pieces
        for (var bp = 0; bp < 8; bp++) {
          var flag = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.01),
            makeToon(bannerColors[bp % bannerColors.length], { transparent: true, opacity: 0.85 })
          );
          flag.position.set(-5.5 + bp * 1.6, wireY - 0.25, -3 + row * 6);
          decoGroup.add(flag);
        }
      }
      // Cactus pots
      var cacti = [{ x: -halfLen + 1, z: halfLen - 1 }, { x: halfLen - 1.5, z: halfLen - 1 }];
      cacti.forEach(function (cp) {
        var pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8),
          makeToon(0xcc7744)
        );
        pot.position.set(cp.x, 0.15, cp.z);
        decoGroup.add(pot);
        var cactus = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6),
          makeToon(0x228b22)
        );
        cactus.position.set(cp.x, 0.55, cp.z);
        decoGroup.add(cactus);
        // Arms
        [-1, 1].forEach(function (side) {
          var arm = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 6, 4),
            makeToon(0x228b22)
          );
          arm.position.set(cp.x + side * 0.1, 0.6, cp.z);
          decoGroup.add(arm);
        });
      });
    }

    scene.add(decoGroup);
    return decoGroup;
  }

  // ── Main Scene Assembly ────────────────────────────────────

  /**
   * Table layout definitions with positions
   * More reviews -> a few more tables, but capped so the room doesn't get crowded.
   */
  function getTableCountFromReviews(reviewCount) {
    if (reviewCount <= 150) return 4;
    if (reviewCount <= 450) return 5;
    if (reviewCount <= 900) return 6;
    if (reviewCount <= 1300) return 7;
    return 8;
  }

  /**
   * Fallback layout templates by table count.
   * These are deterministic and slightly more spread out.
   */
  function getLayoutTemplateByCount(tableCount) {
    var templates = {
      4: [
        { x: -3.75, z: -2.75, seats: 4 },
        { x:  1.45, z: -3.00, seats: 2 },
        { x: -2.25, z:  0.35, seats: 2 },
        { x:  2.85, z:  1.40, seats: 4 }
      ],
      5: [
        { x: -3.95, z: -2.95, seats: 4 },
        { x: -0.25, z: -2.35, seats: 2 },
        { x:  3.00, z: -3.05, seats: 4 },
        { x: -2.35, z:  0.35, seats: 2 },
        { x:  1.85, z:  1.45, seats: 4 }
      ],
      6: [
        { x: -4.05, z: -3.05, seats: 2 },
        { x: -1.05, z: -2.35, seats: 4 },
        { x:  2.45, z: -3.10, seats: 2 },
        { x: -3.10, z:  0.15, seats: 4 },
        { x:  0.55, z:  1.10, seats: 2 },
        { x:  3.20, z:  1.35, seats: 4 }
      ],
      7: [
        { x: -4.10, z: -3.15, seats: 2 },
        { x: -1.35, z: -2.35, seats: 4 },
        { x:  1.55, z: -3.05, seats: 2 },
        { x:  4.00, z: -2.00, seats: 2 },
        { x: -3.10, z:  0.20, seats: 4 },
        { x:  0.15, z:  1.20, seats: 2 },
        { x:  2.95, z:  0.85, seats: 4 }
      ],
      8: [
        { x: -4.15, z: -3.15, seats: 2 },
        { x: -1.95, z: -2.30, seats: 4 },
        { x:  0.95, z: -3.20, seats: 2 },
        { x:  3.85, z: -2.45, seats: 4 },
        { x: -3.90, z:  0.00, seats: 2 },
        { x: -0.95, z:  0.95, seats: 4 },
        { x:  2.00, z:  1.40, seats: 2 },
        { x:  4.05, z:  0.45, seats: 2 }
      ]
    };

    return templates[tableCount] || templates[6];
  }

  /**
   * Fixed layout for each restaurant.
   * Table count depends on review_count, but positions are hand-tuned and deterministic.
   */
  function getTableLayoutsForRestaurant(restaurant) {
    var name = restaurant && restaurant.name ? restaurant.name : "";
    var reviewCount = restaurant && restaurant.review_count ? restaurant.review_count : 0;
    var tableCount = getTableCountFromReviews(reviewCount);

    var layoutsByRestaurant = {
      "El Bocado": [
        { x: -3.85, z: -2.75, seats: 4 },
        { x:  1.55, z: -2.95, seats: 2 },
        { x: -2.35, z:  0.35, seats: 2 },
        { x:  2.95, z:  1.45, seats: 4 }
      ],

      "Mom Mom's Kitchen and Polish Food Cart": [
        { x: -3.55, z: -2.95, seats: 2 },
        { x:  1.35, z: -2.35, seats: 4 },
        { x: -2.15, z:  0.65, seats: 2 },
        { x:  2.65, z:  1.55, seats: 2 }
      ],

      "Hardena/Waroeng Surabaya Restaurant": [
        { x: -3.95, z: -2.75, seats: 4 },
        { x:  0.15, z: -3.15, seats: 2 },
        { x:  3.05, z: -1.95, seats: 4 },
        { x: -2.45, z:  0.35, seats: 2 },
        { x:  1.85, z:  1.55, seats: 4 }
      ],

      "Chifa": [
        { x: -4.05, z: -3.05, seats: 2 },
        { x: -0.95, z: -3.35, seats: 4 },
        { x:  2.45, z: -2.35, seats: 2 },
        { x: -3.15, z:  0.35, seats: 4 },
        { x:  0.95, z:  1.35, seats: 2 }
      ],

      "Dan Dan": [
        { x: -4.10, z: -3.15, seats: 2 },
        { x: -1.15, z: -2.45, seats: 4 },
        { x:  2.15, z: -3.10, seats: 2 },
        { x:  4.10, z: -1.95, seats: 2 },
        { x: -3.05, z:  0.35, seats: 4 },
        { x:  0.85, z:  1.45, seats: 2 }
      ],

      "Bleu Sushi": [
        { x: -4.05, z: -2.65, seats: 2 },
        { x: -1.45, z: -3.20, seats: 2 },
        { x:  1.95, z: -2.35, seats: 4 },
        { x:  3.95, z: -3.05, seats: 2 },
        { x: -3.05, z:  0.25, seats: 4 },
        { x:  0.75, z:  1.55, seats: 2 }
      ],

      "Penang": [
        { x: -4.15, z: -3.05, seats: 4 },
        { x: -1.55, z: -2.35, seats: 2 },
        { x:  1.75, z: -3.15, seats: 4 },
        { x:  3.95, z: -2.05, seats: 2 },
        { x: -3.15, z:  0.15, seats: 2 },
        { x:  0.35, z:  1.35, seats: 4 },
        { x:  3.05, z:  0.65, seats: 2 }
      ],

      "Terakawa Ramen": [
        { x: -4.15, z: -3.10, seats: 2 },
        { x: -1.85, z: -2.25, seats: 2 },
        { x:  1.15, z: -3.25, seats: 4 },
        { x:  3.75, z: -2.35, seats: 2 },
        { x: -3.85, z:  0.05, seats: 2 },
        { x: -0.95, z:  0.95, seats: 4 },
        { x:  2.05, z:  1.45, seats: 2 },
        { x:  4.05, z:  0.45, seats: 2 }
      ]
    };

    if (layoutsByRestaurant[name]) {
      return layoutsByRestaurant[name];
    }

    return getLayoutTemplateByCount(tableCount);
  }

  /**
   * Shared overview layout for multi-restaurant mode.
   * Keep this fixed so the gallery/overview view stays consistent.
   */
  function getOverviewTableLayouts() {
    return [
      { x: -4.5, z: -3.0, seats: 4 },
      { x: -1.5, z: -4.5, seats: 2 },
      { x:  2.0, z: -3.0, seats: 4 },
      { x:  5.0, z: -4.0, seats: 2 },
      { x: -3.5, z:  1.5, seats: 4 },
      { x:  0.5, z:  2.0, seats: 2 },
      { x:  3.5, z:  1.0, seats: 4 },
      { x: -1.0, z:  5.0, seats: 2 }
    ];
  }

  /**
   * Arrange chairs around a table
   */
  function arrangeChairs(tableX, tableZ, seats, theme) {
    var chairs = [];
    var offsets2 = [
      { dx: 0, dz: -0.9, rot: 0 },
      { dx: 0, dz: 0.9, rot: Math.PI }
    ];
    var offsets4 = [
      { dx: 0, dz: -0.9, rot: 0 },
      { dx: 0, dz: 0.9, rot: Math.PI },
      { dx: -1.2, dz: 0, rot: Math.PI / 2 },
      { dx: 1.2, dz: 0, rot: -Math.PI / 2 }
    ];

    var layout = seats > 2 ? offsets4 : offsets2;

    layout.forEach(function (off) {
      chairs.push(buildChair(tableX + off.dx, tableZ + off.dz, off.rot, theme));
    });

    return chairs;
  }

  /**
   * Arrange customer figures around a table
   */
  function arrangeCustomers(tableX, tableZ, seats, seed) {
    var customers = [];
    var count = Math.min(seats, 1 + Math.floor(seededRandom(seed) * seats));
    if (count < 1) count = 1;

    var offsets2 = [
      { dx: 0, dz: -0.7 },
      { dx: 0, dz: 0.7 }
    ];
    var offsets4 = [
      { dx: 0, dz: -0.7 },
      { dx: 0, dz: 0.7 },
      { dx: -0.9, dz: 0 },
      { dx: 0.9, dz: 0 }
    ];

    var layout = seats > 2 ? offsets4 : offsets2;

    for (var i = 0; i < count && i < layout.length; i++) {
      var off = layout[i];
      var figure = buildCustomerFigure(
        tableX + off.dx,
        tableZ + off.dz,
        seed + i * 41,
        true
      );
      customers.push(figure);
    }

    return customers;
  }

  /**
   * Build the complete scene from data
   */
  function buildScene(scene, sceneData, theme) {
    theme = theme || DEFAULT_THEME;
    var sceneObjects = {
      tables: [],
      chairs: [],
      customers: [],
      food: [],
      stars: null,
      decorations: null,
      themedDecorations: null,
      animatedItems: []
    };

    // Floor
    buildFloor(scene, theme);

    // Walls
    buildWalls(scene, theme);

    // Counter/bar
    buildCounter(scene);

    // Table layouts
    var layouts = [];
    var expandedData = sceneData;

    // Single-restaurant mode:
    // use that restaurant's own fixed layout, with deterministic table count
    // derived from review_count.
    if (sceneData.length === 1) {
      layouts = getTableLayoutsForRestaurant(sceneData[0]);
      expandedData = layouts.map(function () {
        return sceneData[0];
      });
    } else {
      // Multi-restaurant overview mode:
      // keep one shared overview layout so the gallery scene still works.
      layouts = getOverviewTableLayouts();
    }

    var restaurantCount = Math.min(expandedData.length, layouts.length);

    // Compute average rating for stars
    var totalRating = 0;
    for (var ri = 0; ri < sceneData.length; ri++) {
      totalRating += sceneData[ri].stars;
    }
    var avgRating = sceneData.length > 0 ? totalRating / sceneData.length : 4.0;

    // Table top Y depends on theme table height
    var tableTopY = theme.table.height + 0.08;

    for (var t = 0; t < restaurantCount; t++) {
      var layout = layouts[t];
      var restaurant = expandedData[t];
      var cuisineCol = getCuisineThreeColor(restaurant.cuisine);

      // Build table
      var table = buildTable(layout.x, layout.z, layout.seats, cuisineCol, theme);
      tagObject(table, "table", {
        restaurant: restaurant,
        tableIndex: t
      });
      scene.add(table);
      sceneObjects.tables.push(table);

      // Chairs
      var chairs = arrangeChairs(layout.x, layout.z, layout.seats, theme);
      chairs.forEach(function (chair) {
        scene.add(chair);
        sceneObjects.chairs.push(chair);
      });

      // Customers
      var customers = arrangeCustomers(layout.x, layout.z, layout.seats, t * 100 + 7);
      customers.forEach(function (customer, ci) {
        var reviewIdx = ci % (restaurant.review_excerpts ? restaurant.review_excerpts.length : 1);
        tagObject(customer, "customer", {
          restaurant: restaurant,
          customerIndex: ci,
          review: restaurant.review_excerpts ? restaurant.review_excerpts[reviewIdx] : "Great food!",
          rating: restaurant.stars
        });
        scene.add(customer);
        sceneObjects.customers.push(customer);
      });

      // Food items
      var dishes = restaurant.top_dishes || ["specialty"];
      var foodGroup = buildFoodItems(layout.x, layout.z, tableTopY, dishes, cuisineCol, theme);
      // Update food data with restaurant reference
      foodGroup.children.forEach(function (child) {
        if (child.userData.interactiveData) {
          child.userData.interactiveData.restaurant = restaurant;
        }
      });
      scene.add(foodGroup);
      sceneObjects.food.push(foodGroup);
      sceneObjects.animatedItems.push(foodGroup);
    }

    // Wall decorations (frames)
    sceneObjects.decorations = buildWallDecorations(scene, expandedData);

    // Themed decorations (lanterns, banners, etc.)
    sceneObjects.themedDecorations = buildThemedDecorations(scene, theme);

    // Rating stars
    sceneObjects.stars = buildRatingStars(scene, avgRating);

    return sceneObjects;
  }

  // ── Raycasting & Interaction ───────────────────────────────

  function setupRaycasting(camera, scene, canvas, infoPanel, sceneData) {
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var hoveredObject = null;

    function getInteractiveParent(obj) {
      var current = obj;
      while (current) {
        if (current.userData && current.userData.interactiveType) {
          return current;
        }
        current = current.parent;
      }
      return null;
    }

    function onCanvasClick(event) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      var intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        // Find the first interactive object
        for (var i = 0; i < intersects.length; i++) {
          var hit = intersects[i].object;
          var interactive = getInteractiveParent(hit);
          if (interactive) {
            handleInteraction(interactive.userData.interactiveType, interactive.userData.interactiveData, infoPanel);
            return;
          }
        }
      }

      // Click on nothing - clear panel
      clearInfoPanel(infoPanel);
    }

    function onCanvasMove(event) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      var intersects = raycaster.intersectObjects(scene.children, true);

      var newHovered = null;
      if (intersects.length > 0) {
        for (var i = 0; i < intersects.length; i++) {
          var interactive = getInteractiveParent(intersects[i].object);
          if (interactive) {
            newHovered = interactive;
            break;
          }
        }
      }

      if (newHovered !== hoveredObject) {
        canvas.style.cursor = newHovered ? "pointer" : "default";
        hoveredObject = newHovered;
      }
    }

    canvas.addEventListener("click", onCanvasClick, false);
    canvas.addEventListener("mousemove", onCanvasMove, false);

    return function dispose() {
      canvas.removeEventListener("click", onCanvasClick, false);
      canvas.removeEventListener("mousemove", onCanvasMove, false);
    };
  }

  // Helper: get cuisine image path from global mapping
  function getCuisineImagePath(cuisineName) {
    if (window.__CUISINE_IMAGES && window.__CUISINE_IMAGES[cuisineName]) {
      return window.__CUISINE_IMAGES[cuisineName];
    }
    return null;
  }

  var RESTAURANT_DISH_IMAGES = {
    "El Bocado": [
      "data/dishesImage/ElBocado1.jpg",
      "data/dishesImage/ElBocado2.jpg"
    ],
    "Bleu Sushi": [
      "data/dishesImage/BleuSushi1.jpg",
      "data/dishesImage/BleuSushi2.jpg"
    ],
    "Penang": [
      "data/dishesImage/Penang1.jpg",
      "data/dishesImage/Penang2.jpg"
    ],
    "Chifa": [
      "data/dishesImage/Chifa1.jpg",
      "data/dishesImage/Chifa2.jpg"
    ],
    "Dan Dan": [
      "data/dishesImage/DanDan1.jpg",
      "data/dishesImage/DanDan2.jpg"
    ],
    "Hardena/Waroeng Surabaya Restaurant": [
      "data/dishesImage/Hardena1.jpg",
      "data/dishesImage/Hardena2.jpg"
    ],
    "Terakawa Ramen": [
      "data/dishesImage/Terakawa1.jpg",
      "data/dishesImage/Terakawa2.jpg"
    ],
    "Mom Mom's Kitchen and Polish Food Cart": []
  };

  var DISH_CARD_INFO = {
    "data/dishesImage/BleuSushi1.jpg": {
      title: "Signature Sushi Platter",
      description: "A colorful assortment of specialty sushi rolls layered with fresh seafood, creamy avocado, and vibrant toppings. Each bite combines delicate rice, umami-rich fish, and bright sauces for a balanced and elegant flavor.",
      ingredients: ["sushi rice", "nori", "salmon", "tuna", "avocado", "tobiko", "spicy mayo", "soy sauce"]
    },

    "data/dishesImage/BleuSushi2.jpg": {
      title: "Avocado Roll",
      description: "A smooth avocado-topped sushi roll with a creamy texture and subtle sweetness. Finished with sesame and fresh herbs, it delivers a light and refreshing bite.",
      ingredients: ["sushi rice", "avocado", "nori", "sesame seeds", "cucumber", "spicy tuna filling", "soy sauce"]
    },

    "data/dishesImage/Chifa1.jpg": {
      title: "Crispy Fried Wontons",
      description: "Golden fried wontons with crisp, bubbly wrappers and a savory filling inside. Served with a sweet soy dipping sauce that adds a perfect balance of sweetness and saltiness.",
      ingredients: ["wonton wrappers", "ground pork", "green onion", "garlic", "soy sauce", "sesame oil", "sweet chili sauce"]
    },

    "data/dishesImage/Chifa2.jpg": {
      title: "Orange Chicken Combo",
      description: "Crispy battered chicken tossed in a glossy sweet-and-spicy sauce. Served alongside fried rice and crunchy wontons for a comforting Chinese-American classic.",
      ingredients: ["chicken", "cornstarch batter", "orange sauce", "garlic", "soy sauce", "fried rice", "egg", "green onion"]
    },

    "data/dishesImage/DanDan1.jpg": {
      title: "Taiwanese Popcorn Chicken",
      description: "Taiwanese popcorn chicken fried until crispy and tossed with garlic and dried chilies. The dish delivers a bold combination of crunch, spice, and savory umami.",
      ingredients: ["chicken thigh", "garlic", "dried chili peppers", "soy sauce", "five spice", "scallions", "sesame seeds"]
    },

    "data/dishesImage/DanDan2.jpg": {
      title: "Savory Wheat Noodles",
      description: "Springy wheat noodles tossed in a light savory sauce. A simple yet satisfying dish highlighting the chewy texture of freshly cooked noodles.",
      ingredients: ["wheat noodles", "soy sauce", "garlic", "sesame oil", "green onion", "vegetable oil"]
    },

    "data/dishesImage/ElBocado1.jpg": {
      title: "Peruvian Fried Fish Plate",
      description: "Crispy fried fish served with seasoned rice and creamy beans. A hearty Peruvian comfort dish finished with fresh lime for brightness.",
      ingredients: ["whole fish", "rice", "beans", "lime", "garlic", "vegetable oil", "Peruvian spices"]
    },

    "data/dishesImage/ElBocado2.jpg": {
      title: "Loaded Nachos",
      description: "Crunchy tortilla chips layered with beans, cheese, and savory toppings. Served with vibrant sauces that add tangy and spicy flavors to each bite.",
      ingredients: ["tortilla chips", "black beans", "cheese", "salsa", "green chili sauce", "jalapeno", "tomato"]
    },

    "data/dishesImage/Hardena1.jpg": {
      title: "Nasi Campur Plate",
      description: "A vibrant Indonesian rice plate featuring multiple flavorful side dishes. Rich curries, vegetables, and fried items combine to create a deeply aromatic meal.",
      ingredients: ["rice", "beef curry", "tofu", "eggplant", "greens", "chili sambal", "spices"]
    },

    "data/dishesImage/Hardena2.jpg": {
      title: "Spiced Indonesian Curry Plate",
      description: "Slow-cooked Indonesian meats coated in a rich, spiced coconut curry sauce. The bold flavors of chili, garlic, and lemongrass create a deeply satisfying dish.",
      ingredients: ["beef", "chicken", "coconut milk", "lemongrass", "garlic", "chili", "turmeric", "rice"]
    },

    "data/dishesImage/Penang1.jpg": {
      title: "Roti with Curry",
      description: "Flaky Malaysian flatbread served with a warm, fragrant curry dipping sauce. The crispy layers soak up the rich spices for a comforting bite.",
      ingredients: ["roti prata", "flour", "butter", "curry sauce", "coconut milk", "garlic", "spices"]
    },

    "data/dishesImage/Penang2.jpg": {
      title: "Crispy Roti with Curry",
      description: "A towering crispy flatbread served with a rich, savory curry dipping sauce. The dish combines flaky texture with warm aromatic spices, making it a comforting and interactive Malaysian-style appetizer.",
      ingredients: ["roti flatbread", "flour", "butter", "curry sauce", "coconut milk", "garlic", "spices"]
    },

    "data/dishesImage/Terakawa1.jpg": {
      title: "Braised Pork Bao",
      description: "Soft steamed bao buns filled with tender braised pork and fresh vegetables. The fluffy bread and savory filling create a perfect balance of texture and flavor.",
      ingredients: ["bao bun", "braised pork", "cucumber", "cilantro", "soy sauce", "hoisin sauce"]
    },

    "data/dishesImage/Terakawa2.jpg": {
      title: "Tonkotsu Ramen",
      description: "A rich tonkotsu ramen with slow-simmered pork bone broth and springy noodles. Topped with chashu pork, soft egg, and scallions for deep savory flavor.",
      ingredients: ["ramen noodles", "pork broth", "chashu pork", "soft egg", "scallions", "bamboo shoots", "soy sauce"]
    }
  };

  function getDishCardInfoByImage(imagePath, fallbackDishName) {
    var info = DISH_CARD_INFO[imagePath];
    if (info) return info;

    return {
      title: capitalizeDishName(fallbackDishName || "Signature Dish"),
      description: "A popular dish highlighted from this restaurant's menu. It reflects the flavor and style that make this hidden gem memorable.",
      ingredients: ["chef special", "house sauce", "seasoning"]
    };
  }

  function capitalizeDishName(name) {
    if (!name) return "Signature Dish";
    return name
      .split(" ")
      .map(function (part) {
        if (!part) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function getRestaurantWallDishEntries(restaurant) {
    if (!restaurant) return [];

    var imageList = RESTAURANT_DISH_IMAGES[restaurant.name] || [];
    var topDishes = restaurant.top_dishes || [];
    var fallbackCuisineImage = getCuisineImagePath(restaurant.cuisine);

    var entries = [];
    var totalSlots = 3;

    for (var i = 0; i < totalSlots; i++) {
      var dishName = topDishes[i] || ("dish " + (i + 1));
      var imagePath = imageList[i] || imageList[imageList.length - 1] || fallbackCuisineImage;

      entries.push({
        restaurant: restaurant,
        dish: dishName,
        image: imagePath,
        slotIndex: i
      });
    }

    return entries;
  }

  // Helper: build a rating gauge SVG
  function buildRatingGaugeSvg(rating, maxRating) {
    maxRating = maxRating || 5;
    var pct = (rating / maxRating) * 100;
    var gaugeColor = rating >= 4.5 ? '#3a8c5c' : rating >= 4 ? '#2a8a8a' : rating >= 3 ? '#e8a838' : '#d4503a';
    return '<div class="iso-info-figure">' +
      '<svg viewBox="0 0 200 100" style="max-width:200px;">' +
      '<defs><linearGradient id="gGauge" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#d4503a"/>' +
      '<stop offset="40%" stop-color="#e8a838"/>' +
      '<stop offset="70%" stop-color="#2a8a8a"/>' +
      '<stop offset="100%" stop-color="#3a8c5c"/>' +
      '</linearGradient></defs>' +
      '<path d="M20 80 A70 70 0 0 1 180 80" fill="none" stroke="#e8e2d8" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M20 80 A70 70 0 0 1 180 80" fill="none" stroke="url(#gGauge)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (pct * 2.51) + ' 251" />' +
      '<text x="100" y="72" text-anchor="middle" font-size="28" font-weight="800" fill="' + gaugeColor + '">' + rating + '</text>' +
      '<text x="100" y="90" text-anchor="middle" font-size="10" fill="#7a6e5f">out of ' + maxRating + '</text>' +
      '</svg>' +
      '<div class="iso-info-figure-caption">Rating Gauge</div>' +
      '</div>';
  }

  // Helper: build plate illustration SVG for food
  function buildDishSvg(dishName, cuisineColor) {
    var c = cuisineColor || '#e8a838';
    return '<div class="iso-info-figure">' +
      '<svg viewBox="0 0 120 80" style="max-width:120px;">' +
      '<ellipse cx="60" cy="55" rx="50" ry="15" fill="#f5f0e0" stroke="#d4cfc5" stroke-width="1.5"/>' +
      '<ellipse cx="60" cy="50" rx="40" ry="12" fill="#faf6f0"/>' +
      '<circle cx="50" cy="42" r="8" fill="' + c + '" opacity="0.7"/>' +
      '<circle cx="68" cy="40" r="6" fill="' + c + '" opacity="0.5"/>' +
      '<circle cx="58" cy="48" r="5" fill="' + c + '" opacity="0.6"/>' +
      '<text x="60" y="20" text-anchor="middle" font-size="9" font-weight="700" fill="#2c2418">' + (dishName.length > 12 ? dishName.substring(0, 12) + '...' : dishName) + '</text>' +
      '</svg>' +
      '<div class="iso-info-figure-caption">Signature dish</div>' +
      '</div>';
  }

  // Helper: culture pattern SVG for decorations
  function buildCulturePatternSvg(cuisineName, themeColor) {
    var c = themeColor || '#e8a838';
    var patternPaths = '';
    // Generate a simple unique geometric pattern based on cuisine name
    var seed = 0;
    for (var ci = 0; ci < cuisineName.length; ci++) seed += cuisineName.charCodeAt(ci);
    for (var pi = 0; pi < 5; pi++) {
      var x = 20 + (pi * 40) % 160;
      var y = 20 + ((seed + pi * 37) % 60);
      var r = 8 + (seed + pi * 13) % 12;
      patternPaths += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '" opacity="' + (0.15 + (pi * 0.12)) + '"/>';
      patternPaths += '<circle cx="' + x + '" cy="' + y + '" r="' + (r - 3) + '" fill="none" stroke="' + c + '" stroke-width="1" opacity="0.4"/>';
    }
    return '<div class="iso-info-figure">' +
      '<svg viewBox="0 0 200 100" style="max-width:200px;">' +
      '<rect width="200" height="100" fill="#faf6f0" rx="8"/>' +
      patternPaths +
      '<text x="100" y="95" text-anchor="middle" font-size="8" fill="#7a6e5f">' + cuisineName + ' cultural motif</text>' +
      '</svg>' +
      '<div class="iso-info-figure-caption">Cultural pattern</div>' +
      '</div>';
  }

  function handleInteraction(type, data, infoPanel) {
    if (!infoPanel) return;

    var html = "";

    switch (type) {
      case "table":
        var r = data.restaurant;
        var starsHtml = "";
        for (var s = 0; s < Math.floor(r.stars); s++) starsHtml += '<span class="star-icon">\u2605</span>';
        if (r.stars % 1 >= 0.5) starsHtml += '<span class="star-icon half">\u00BD</span>';

        var excerpt = r.review_excerpts && r.review_excerpts.length > 0 ? r.review_excerpts[0] : "A beloved local gem.";
        var tagColor = CUISINE_THEME_COLORS[r.cuisine] || "#3a8c5c";
        var tableImgPath = getCuisineImagePath(r.cuisine);

        html = '<div class="iso-info-card">';
        // Cuisine image header
        if (tableImgPath) {
          html += '<div class="iso-info-image"><img src="' + tableImgPath + '" alt="' + r.cuisine + ' cuisine"/></div>';
        }
        html += '<div class="iso-info-tag" style="background:' + tagColor + ';">' + r.cuisine + '</div>' +
          '<h3 class="iso-info-name">' + r.name + '</h3>' +
          '<div class="iso-info-stars">' + starsHtml + ' <span class="iso-rating-num">' + r.stars + '</span></div>' +
          '<div class="iso-info-stats-grid">' +
          '<div class="iso-info-stat-box">' +
          '<div class="iso-info-stat-value">' + r.review_count + '</div>' +
          '<div class="iso-info-stat-label">Reviews</div>' +
          '</div>' +
          '<div class="iso-info-stat-box">' +
          '<div class="iso-info-stat-value" style="color:#e8a838;">#' + r.gem_rank + '</div>' +
          '<div class="iso-info-stat-label">Gem Rank</div>' +
          '</div>' +
          '</div>';
        // Rating gauge figure
        html += buildRatingGaugeSvg(r.stars);
        html += '<div class="iso-info-rank">' +
          '<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px; margin-right:4px;"><polygon points="8,1 10,6 16,6.5 11.5,10.5 12.9,16 8,13 3.1,16 4.5,10.5 0,6.5 6,6" fill="#e8a838"/></svg>' +
          'Score: <strong>' + r.gem_score.toFixed(2) + '</strong>' +
          '</div>' +
          '<div class="iso-info-divider"></div>' +
          '<div class="iso-info-quote">' + excerpt + '</div>';
        if (r.top_dishes && r.top_dishes.length > 0) {
          html += '<div class="iso-info-divider"></div>' +
            '<div class="iso-info-dishes">' +
            '<strong>Top dishes:</strong> ' + r.top_dishes.join(", ") +
            '</div>';
        }
        html += '</div>';
        break;

      case "food":
        var dish = data.dish || "specialty";
        var rest = data.restaurant;
        var foodImgPath = rest ? getCuisineImagePath(rest.cuisine) : null;
        var foodThemeColor = rest ? (CUISINE_THEME_COLORS[rest.cuisine] || "#e8a838") : "#e8a838";

        html = '<div class="iso-info-card">';
        // Cuisine image header for dish context
        if (foodImgPath) {
          html += '<div class="iso-info-image"><img src="' + foodImgPath + '" alt="' + (rest ? rest.cuisine : '') + ' cuisine"/></div>';
        }
        html += '<div class="iso-info-tag" style="background:#e67e22;">Popular Dish</div>' +
          '<h3 class="iso-info-name">' + dish.charAt(0).toUpperCase() + dish.slice(1) + '</h3>' +
          '<div class="iso-info-meta">' +
          'Served at <strong>' + (rest ? rest.name : "this restaurant") + '</strong>' +
          (rest ? ' &middot; <span style="color:#e8a838;">\u2605 ' + rest.stars + '</span>' : '') +
          '</div>';
        // Dish plate illustration SVG
        html += buildDishSvg(dish, foodThemeColor);
        if (rest && rest.top_dishes) {
          html += '<div class="iso-info-divider"></div>' +
            '<div class="iso-info-dishes">' +
            '<strong>Full menu highlights:</strong><br/>' +
            rest.top_dishes.map(function (d, i) {
              return '<span style="display:inline-block; padding:3px 10px; margin:3px 3px 0 0; background:' +
                (d === dish ? 'rgba(232,168,56,0.15)' : '#f0ebe3') +
                '; border-radius:12px; font-size:0.78rem;' +
                (d === dish ? ' font-weight:700; border:1px solid #e8a838;' : '') +
                '">' + d + '</span>';
            }).join('') +
            '</div>';
        }
        html += '</div>';
        break;

      case "customer":
        var review = data.review || "Wonderful dining experience!";
        var rating = data.rating || 4;
        var restName = data.restaurant ? data.restaurant.name : "this restaurant";
        var custImgPath = data.restaurant ? getCuisineImagePath(data.restaurant.cuisine) : null;

        var reviewStars = "";
        for (var rs = 0; rs < Math.floor(rating); rs++) reviewStars += '<span class="star-icon">\u2605</span>';
        if (rating % 1 >= 0.5) reviewStars += '<span class="star-icon half">\u00BD</span>';

        var sentimentColor = rating >= 4.5 ? "#3a8c5c" : rating >= 4 ? "#2a8a8a" : rating >= 3 ? "#e8a838" : "#d4503a";
        var sentimentLabel = rating >= 4.5 ? "Excellent" : rating >= 4 ? "Great" : rating >= 3 ? "Mixed" : "Poor";

        html = '<div class="iso-info-card">';
        if (custImgPath) {
          html += '<div class="iso-info-image"><img src="' + custImgPath + '" alt="Restaurant cuisine"/></div>';
        }
        html += '<div class="iso-info-tag" style="background:' + sentimentColor + ';">Customer Review</div>' +
          '<h3 class="iso-info-name">Dining at ' + restName + '</h3>' +
          '<div class="iso-info-stars">' + reviewStars + ' <span class="iso-rating-num">' + rating + '</span></div>' +
          '<div style="display:inline-block; padding:2px 10px; border-radius:10px; font-size:0.7rem; font-weight:700; background:' + sentimentColor + '20; color:' + sentimentColor + '; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">' + sentimentLabel + '</div>';
        // Rating gauge for review
        html += buildRatingGaugeSvg(rating);
        html += '<div class="iso-info-quote">' + review + '</div>' +
          '</div>';
        break;

      case "wall_decoration":
        var wallRestaurant = data.restaurant;
        var wallDish = data.dish || "signature dish";
        var wallDishImage = data.image || null;
        var cardInfo = getDishCardInfoByImage(wallDishImage, wallDish);

        html = '<div class="iso-info-card">';

        if (wallDishImage) {
          html += '<div class="iso-info-image"><img src="' + wallDishImage + '" alt="' + cardInfo.title + '"/></div>';
        }

        html += '<div class="iso-info-tag" style="background:#e67e22;">Popular Dish</div>' +
            '<h3 class="iso-info-name">' + cardInfo.title + '</h3>' +
            '<div class="iso-info-meta">' +
            'Served at <strong>' + (wallRestaurant ? wallRestaurant.name : 'this restaurant') + '</strong>' +
            (wallRestaurant ? ' &middot; <span style="color:#e8a838;">\u2605 ' + wallRestaurant.stars + '</span>' : '') +
            '</div>';

        // Intro of Dishes
        html += '<div class="iso-info-divider"></div>' +
            '<div class="iso-info-meta" style="font-size:0.9rem; line-height:1.7;">' +
            cardInfo.description +
            '</div>';

        // ingredients bubbles
        if (cardInfo.ingredients && cardInfo.ingredients.length > 0) {
          html += '<div class="iso-info-divider"></div>' +
              '<div class="iso-info-dishes">' +
              '<strong>Ingredients:</strong><br/>' +
              cardInfo.ingredients.map(function (item) {
                return '<span style="display:inline-block; padding:3px 10px; margin:3px 3px 0 0; background:#f0ebe3; border-radius:12px; font-size:0.78rem;">' +
                    item +
                    '</span>';
              }).join('') +
              '</div>';
        }

        // Keep menu highlights
        // if (wallRestaurant && wallRestaurant.top_dishes && wallRestaurant.top_dishes.length > 0) {
        //   html += '<div class="iso-info-divider"></div>' +
        //       '<div class="iso-info-dishes">' +
        //       '<strong>Full menu highlights:</strong><br/>' +
        //       wallRestaurant.top_dishes.map(function (d) {
        //         var isMain = d === wallDish;
        //         return '<span style="display:inline-block; padding:3px 10px; margin:3px 3px 0 0; background:' +
        //             (isMain ? 'rgba(232,168,56,0.15)' : '#f0ebe3') +
        //             '; border-radius:12px; font-size:0.78rem;' +
        //             (isMain ? ' font-weight:700; border:1px solid #e8a838;' : '') +
        //             '">' + d + '</span>';
        //       }).join('') +
        //       '</div>';
        // }

        html += '</div>';
        break;

      default:
        break;
    }

    if (html) {
      infoPanel.innerHTML = html;
      infoPanel.classList.add("active");
    }
  }

  function clearInfoPanel(infoPanel) {
    if (!infoPanel) return;
    // Build a restaurant gallery from scene data
    var sceneData = window.__isoSceneData || [];
    var images = window.__CUISINE_IMAGES || {};
    var colors = window.__CUISINE_BADGE_COLORS || {};

    var galleryHtml = '';
    sceneData.forEach(function (d) {
      var img = images[d.cuisine] || '';
      var color = colors[d.cuisine] || '#3a8c5c';
      var starsStr = '';
      for (var s = 0; s < Math.floor(d.stars); s++) starsStr += '\u2605';
      if (d.stars % 1 >= 0.5) starsStr += '\u00BD';

      galleryHtml += '<div class="iso-gallery-card" data-cuisine="' + d.cuisine + '">' +
        '<div class="iso-gallery-img">' +
        (img ? '<img src="' + img + '" alt="' + d.cuisine + '" />' : '') +
        '</div>' +
        '<div class="iso-gallery-details">' +
        '<div class="iso-gallery-name">' + d.name + '</div>' +
        '<div class="iso-gallery-cuisine" style="color:' + color + ';">' + d.cuisine + '</div>' +
        '<div class="iso-gallery-stars">' + starsStr + ' ' + d.stars + '</div>' +
        '</div>' +
        '</div>';
    });

    infoPanel.innerHTML =
      '<div class="iso-gallery-wrapper">' +
      '<div class="iso-gallery-header">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="vertical-align:-4px;">' +
      '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#e8a838" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M9 22V12h6v10" stroke="#e8a838" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg> ' +
      '<span>Hidden Gems</span>' +
      '</div>' +
      '<p class="iso-gallery-intro">Pick a restaurant to step into its unique 3D interior.</p>' +
      '<div class="iso-gallery-grid">' + galleryHtml + '</div>' +
      '</div>';

    // Make gallery cards clickable
    var cards = infoPanel.querySelectorAll('.iso-gallery-card');
    var selectEl = document.getElementById('isometric-cuisine-select');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var cuisine = this.dataset.cuisine;
        if (selectEl) {
          for (var i = 0; i < selectEl.options.length; i++) {
            if (selectEl.options[i].value === cuisine) {
              selectEl.selectedIndex = i;
              selectEl.dispatchEvent(new Event('change'));
              break;
            }
          }
        }
      });
    });

    infoPanel.classList.remove("active");
  }

  // ── Cuisine Selector ───────────────────────────────────────

  /**
   * Dispose all scene geometry (except lights and camera)
   */
  function disposeSceneGeometry(scene) {
    var toRemove = [];
    scene.children.forEach(function (child) {
      // Keep lights and camera
      if (child.isLight || child.isCamera) return;
      toRemove.push(child);
    });
    toRemove.forEach(function (obj) {
      obj.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(function (m) { m.dispose(); });
          } else {
            child.material.dispose();
          }
        }
      });
      scene.remove(obj);
    });
  }

  function setupCuisineSelector(selectEl, sceneState, infoPanel) {
    if (!selectEl) return;

    selectEl.addEventListener("change", function () {
      var selectedCuisine = selectEl.value;
      var theme = selectedCuisine ? mapCuisineToTheme(selectedCuisine) : DEFAULT_THEME;

      // Filter data to only the selected cuisine's restaurant(s)
      var filteredData;
      if (selectedCuisine) {
        filteredData = sceneState.sceneData.filter(function (d) {
          return d.cuisine === selectedCuisine;
        });
        // If no exact match, show all (fallback)
        if (filteredData.length === 0) filteredData = sceneState.sceneData;
      } else {
        filteredData = sceneState.sceneData;
      }

      // Rebuild entire scene with ONLY the selected category's data
      disposeSceneGeometry(sceneState.scene);
      sceneState.sceneObjects = buildScene(sceneState.scene, filteredData, theme);

      // Highlight the selected cuisine's food with emissive glow
      if (selectedCuisine) {
        sceneState.sceneObjects.food.forEach(function (foodGroup) {
          foodGroup.traverse(function (child) {
            if (child.isMesh && child.material) {
              child.material.emissive = getCuisineThreeColor(selectedCuisine);
              child.material.emissiveIntensity = 0.3;
            }
          });
        });
      }

      // Update info panel header
      if (selectedCuisine && infoPanel) {
        var themeHex = getCuisineHex(selectedCuisine);
        var rd = filteredData[0];
        var previewHtml = '';
        if (window.__CUISINE_IMAGES && window.__CUISINE_IMAGES[selectedCuisine]) {
          previewHtml = '<div class="iso-info-image"><img src="' + window.__CUISINE_IMAGES[selectedCuisine] + '" alt="' + selectedCuisine + '"/></div>';
        }
        infoPanel.innerHTML = '<div class="iso-info-card">' +
          previewHtml +
          '<div class="iso-info-tag" style="background:' + themeHex + ';">' + selectedCuisine + ' Cuisine</div>' +
          '<h3 class="iso-info-name">' + (rd ? rd.name : 'Exploring ' + selectedCuisine) + '</h3>' +
          (rd ? '<div class="iso-info-stats-grid">' +
            '<div class="iso-info-stat-box">' +
            '<div class="iso-info-stat-value" style="color:#e8a838;">\u2605 ' + rd.stars + '</div>' +
            '<div class="iso-info-stat-label">Rating</div>' +
            '</div>' +
            '<div class="iso-info-stat-box">' +
            '<div class="iso-info-stat-value">' + rd.review_count + '</div>' +
            '<div class="iso-info-stat-label">Reviews</div>' +
            '</div>' +
            '</div>' : '') +
          '<div class="iso-info-meta">' +
          'Scene shows <strong>only ' + selectedCuisine + '</strong> — ' + theme.name + ' interior style.' +
          '</div>' +
          '<div class="iso-info-divider"></div>' +
          '<div class="iso-info-dishes" style="font-size:0.78rem; line-height:1.6;">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px; margin-right:3px;"><circle cx="7" cy="7" r="6" fill="none" stroke="' + themeHex + '" stroke-width="1.5"/><path d="M5 7l2 2 3-4" stroke="' + themeHex + '" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>' +
          'Click tables, food, or customers to explore this restaurant.' +
          '</div>' +
          '</div>';
        infoPanel.classList.add("active");
      } else {
        clearInfoPanel(infoPanel);
      }
    });
  }

  // ── Animation Loop ─────────────────────────────────────────

  function createAnimationLoop(renderer, scene, camera, controls, sceneState) {
    var clock = new THREE.Clock();
    var running = true;

    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);

      var elapsed = clock.getElapsedTime();

      // Read current sceneObjects from sceneState (updated on cuisine rebuild)
      var so = sceneState.sceneObjects || sceneState;

      // Floating stars animation
      if (so.stars) {
        so.stars.children.forEach(function (starGroup) {
          var baseY = starGroup.userData.baseY || 5.2;
          var phase = starGroup.userData.animPhase || 0;
          starGroup.position.y = baseY + Math.sin(elapsed * 1.2 + phase) * 0.15;
          starGroup.rotation.y = elapsed * 0.4 + phase;
          starGroup.rotation.z = Math.sin(elapsed * 0.8 + phase) * 0.1;
        });
      }

      // Subtle food item rotation
      if (so.animatedItems) {
        so.animatedItems.forEach(function (foodGroup) {
          foodGroup.children.forEach(function (item, i) {
            if (item.isGroup || item.children.length > 0) {
              item.rotation.y = Math.sin(elapsed * 0.5 + i * 1.3) * 0.15;
            }
          });
        });
      }

      // Update OrbitControls
      if (controls) {
        controls.update();
      }

      renderer.render(scene, camera);
    }

    animate();

    return function stop() {
      running = false;
    };
  }

  // ── Main Entry Point ───────────────────────────────────────

  function initIsometricScene(canvas, sceneData) {
    if (!canvas) {
      console.warn("IsometricModule: No canvas element provided.");
      return null;
    }

    if (!window.THREE) {
      console.error("IsometricModule: Three.js (THREE) not found on window.");
      return null;
    }

    sceneData = sceneData || [];

    // ── Renderer ──
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

    // ── Scene ──
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG);
    scene.fog = new THREE.FogExp2(SCENE_BG, 0.018);

    // ── Orthographic Camera (Isometric) ──
    var aspect = canvas.clientWidth / canvas.clientHeight;
    var frustumSize = 13;
    var camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );

    // Isometric angles — slightly shifted for a dramatic view
    var isoDist = 28;
    var isoAngle = Math.PI / 4.5;
    var isoElevation = Math.atan(Math.sqrt(2) / 2);
    camera.position.set(
      isoDist * Math.cos(isoElevation) * Math.sin(isoAngle),
      isoDist * Math.sin(isoElevation),
      isoDist * Math.cos(isoElevation) * Math.cos(isoAngle)
    );
    camera.lookAt(0, 0.8, 0);
    camera.updateProjectionMatrix();

    // ── Lighting — warm, atmospheric restaurant ambiance ──
    var ambientLight = new THREE.AmbientLight(0xffd4a0, 0.6);
    scene.add(ambientLight);

    // Key light — warm overhead spotlight
    var directionalLight = new THREE.DirectionalLight(0xffe4b5, 1.2);
    directionalLight.position.set(8, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.002;
    directionalLight.shadow.normalBias = 0.02;
    scene.add(directionalLight);

    // Fill light — cool blue from side for contrast
    var fillLight = new THREE.DirectionalLight(0xb8c8e0, 0.3);
    fillLight.position.set(-8, 10, -6);
    scene.add(fillLight);

    // Warm point light — simulates warm restaurant interior glow
    var warmGlow = new THREE.PointLight(0xffa040, 0.8, 20);
    warmGlow.position.set(0, 5, 0);
    scene.add(warmGlow);

    // Hemisphere light — sky/ground for natural look
    var bounceLight = new THREE.HemisphereLight(0xffd4a0, 0x4a3728, 0.35);
    scene.add(bounceLight);

    // ── Build Scene Geometry ──
    // Determine initial theme from first cuisine in sceneData
    var initialCuisine = sceneData.length > 0 ? sceneData[0].cuisine : null;
    var initialTheme = initialCuisine ? mapCuisineToTheme(initialCuisine) : DEFAULT_THEME;
    var sceneObjects = buildScene(scene, sceneData, initialTheme);

    // Shared state object so cuisine selector can rebuild scene
    var sceneState = {
      scene: scene,
      sceneData: sceneData,
      sceneObjects: sceneObjects
    };

    // ── OrbitControls ──
    var controls = null;
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.panSpeed = 0.5;

      // Limit zoom to keep scene visible
      controls.minZoom = 0.5;
      controls.maxZoom = 2.5;

      // Limit rotation so the scene stays readable
      controls.minPolarAngle = 0.3;
      controls.maxPolarAngle = Math.PI / 2.2;

      controls.enableRotate = true;
      controls.rotateSpeed = 0.4;
      controls.target.set(0, 1.0, 0);
      controls.update();
    }

    // ── Info Panel ──
    var infoPanel = document.getElementById("isometric-info-panel");
    clearInfoPanel(infoPanel);

    // ── Raycasting ──
    var disposeRaycast = setupRaycasting(camera, scene, canvas, infoPanel, sceneData);

    // ── Cuisine Selector ──
    var cuisineSelect = document.getElementById("isometric-cuisine-select");
    setupCuisineSelector(cuisineSelect, sceneState, infoPanel);

    // ── Animation ──
    // Use sceneState so animation loop always references current sceneObjects after rebuild
    var stopAnimation = createAnimationLoop(renderer, scene, camera, controls, sceneState);

    // ── Resize Handler ──
    function onResize() {
      var width = canvas.clientWidth;
      var height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      var newAspect = width / height;
      camera.left = -frustumSize * newAspect / 2;
      camera.right = frustumSize * newAspect / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    }

    window.addEventListener("resize", onResize, false);

    // ── Dispose / Cleanup ──
    function dispose() {
      stopAnimation();
      disposeRaycast();
      window.removeEventListener("resize", onResize, false);

      if (controls) controls.dispose();

      // Traverse scene and dispose geometries/materials
      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(function (m) { m.dispose(); });
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
    }

    return {
      dispose: dispose,
      resize: onResize
    };
  }

  // ── Export ──────────────────────────────────────────────────
  window.IsometricModule = {
    init: initIsometricScene
  };

})();
