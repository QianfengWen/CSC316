(function () {
  "use strict";

  /* ── Constants ──────────────────────────────────────── */

  var GRID_RES = 26;         // 26×26 grid cells
  var GEO_SIZE = 100;        // world units for ground plane
  var MAX_HEIGHT = 32;       // tallest column
  var MIN_HEIGHT = 0.8;      // shortest visible column
  var COL_R_BOT = 1.35;      // cylinder bottom radius
  var COL_R_TOP = 1.10;      // cylinder top radius (taper)
  var COL_SEGS = 14;         // radial segments

  /* ── Neighborhoods for labels ───────────────────────── */

  var NEIGHBORHOODS = [
    { name: "Center City",       lat: 39.9526, lng: -75.1638 },
    { name: "University City",   lat: 39.9502, lng: -75.1935 },
    { name: "Old City",          lat: 39.9519, lng: -75.1425 },
    { name: "Chinatown",         lat: 39.9558, lng: -75.1568 },
    { name: "South Philly",      lat: 39.9260, lng: -75.1640 },
    { name: "Fishtown",          lat: 39.9735, lng: -75.1307 },
    { name: "N. Liberties",      lat: 39.9670, lng: -75.1415 },
    { name: "Manayunk",          lat: 40.0256, lng: -75.2241 }
  ];

  /* ── Heat ramp (green → gold → red) ────────────────── */

  var HEAT = [
    { t: 0.00, r: 0.227, g: 0.549, b: 0.361 },
    { t: 0.30, r: 0.420, g: 0.680, b: 0.380 },
    { t: 0.55, r: 0.910, g: 0.659, b: 0.220 },
    { t: 0.78, r: 0.878, g: 0.420, b: 0.260 },
    { t: 1.00, r: 0.831, g: 0.314, b: 0.227 }
  ];

  function heatColor(t) {
    t = Math.max(0, Math.min(1, t));
    for (var i = 0; i < HEAT.length - 1; i++) {
      var a = HEAT[i], b = HEAT[i + 1];
      if (t <= b.t) {
        var f = (t - a.t) / (b.t - a.t);
        return new THREE.Color(
          a.r + (b.r - a.r) * f,
          a.g + (b.g - a.g) * f,
          a.b + (b.b - a.b) * f
        );
      }
    }
    var last = HEAT[HEAT.length - 1];
    return new THREE.Color(last.r, last.g, last.b);
  }

  /* ── Helpers ────────────────────────────────────────── */

  function dataBounds(restaurants) {
    var mnLat = Infinity, mxLat = -Infinity, mnLng = Infinity, mxLng = -Infinity;
    restaurants.forEach(function (r) {
      var la = +r.lat, lo = +r.lng;
      if (!isFinite(la) || !isFinite(lo)) return;
      if (la < mnLat) mnLat = la; if (la > mxLat) mxLat = la;
      if (lo < mnLng) mnLng = lo; if (lo > mxLng) mxLng = lo;
    });
    return { minLat: mnLat, maxLat: mxLat, minLng: mnLng, maxLng: mxLng };
  }

  function clippedBounds(db) {
    return {
      minLat: Math.max(db.minLat, 39.88),
      maxLat: Math.min(db.maxLat, 40.09),
      minLng: Math.max(db.minLng, -75.28),
      maxLng: Math.min(db.maxLng, -75.06)
    };
  }

  function toWorld(lat, lng, tb) {
    var nx = (lng - tb.minLng) / (tb.maxLng - tb.minLng);
    var ny = (lat - tb.minLat) / (tb.maxLat - tb.minLat);
    return { x: (nx - 0.5) * GEO_SIZE, z: (0.5 - ny) * GEO_SIZE };
  }

  function dominantCuisine(cell) {
    var dom = "Other", mx = 0;
    for (var k in cell.cuisines) {
      if (cell.cuisines[k] > mx) { mx = cell.cuisines[k]; dom = k; }
    }
    return dom;
  }

  /* ── Topographic texture generator ─────────────────── */

  function generateTopographicTexture(grid, maxCount) {
    var SIZE = 1024;
    var cvs = document.createElement("canvas");
    cvs.width = SIZE;
    cvs.height = SIZE;
    var ctx = cvs.getContext("2d");

    var field = smoothDensityField(grid, maxCount);

    // ── 1. Aged parchment base ────────────────────────────
    ctx.fillStyle = "#e5dbc8";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Warm-tinted paper grain noise
    var imgData = ctx.getImageData(0, 0, SIZE, SIZE);
    var pxArr = imgData.data;
    for (var i = 0; i < pxArr.length; i += 4) {
      var n = (Math.random() - 0.5) * 20;
      pxArr[i]     = clampByte(pxArr[i] + n);
      pxArr[i + 1] = clampByte(pxArr[i + 1] + n * 0.9);
      pxArr[i + 2] = clampByte(pxArr[i + 2] + n * 0.7);
    }
    ctx.putImageData(imgData, 0, 0);

    // Age staining — soft warm spots across the surface
    var stains = [
      [0.2, 0.3, 180], [0.7, 0.2, 150], [0.5, 0.6, 200],
      [0.3, 0.8, 160], [0.8, 0.7, 140], [0.15, 0.55, 120],
      [0.6, 0.4, 170], [0.85, 0.5, 130]
    ];
    stains.forEach(function (s) {
      var sg = ctx.createRadialGradient(
        s[0] * SIZE, s[1] * SIZE, 0,
        s[0] * SIZE, s[1] * SIZE, s[2]
      );
      sg.addColorStop(0, "rgba(170,148,110,0.10)");
      sg.addColorStop(0.6, "rgba(180,155,120,0.04)");
      sg.addColorStop(1, "rgba(180,155,120,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, SIZE, SIZE);
    });

    // ── 2. Zone classification fills ──────────────────────
    // Six distinct terrain zones — game-map style biomes
    var ZONES = [
      { max: 0.05, r: 195, g: 212, b: 180 },  // Uncharted — pale sage
      { max: 0.12, r: 148, g: 190, b: 128 },  // Frontier — soft green
      { max: 0.25, r: 205, g: 188, b: 138 },  // Settled — warm sand
      { max: 0.42, r: 212, g: 158, b: 85  },  // Contested — amber
      { max: 0.65, r: 200, g: 105, b: 68  },  // Hotzone — terracotta
      { max: 1.01, r: 178, g: 62,  b: 48  }   // Epicenter — crimson
    ];

    // Render zones at low resolution then scale up for smooth blending
    var ZS = 256;
    var zoneCvs = document.createElement("canvas");
    zoneCvs.width = ZS;
    zoneCvs.height = ZS;
    var zCtx = zoneCvs.getContext("2d");
    var zImg = zCtx.createImageData(ZS, ZS);
    var zPx = zImg.data;

    for (var zy = 0; zy < ZS; zy++) {
      for (var zx = 0; zx < ZS; zx++) {
        var density = sampleField(field, zx / ZS, 1 - zy / ZS);
        var zone = ZONES[ZONES.length - 1];
        for (var zi = 0; zi < ZONES.length; zi++) {
          if (density <= ZONES[zi].max) { zone = ZONES[zi]; break; }
        }
        var idx = (zy * ZS + zx) * 4;
        zPx[idx]     = zone.r;
        zPx[idx + 1] = zone.g;
        zPx[idx + 2] = zone.b;
        zPx[idx + 3] = 160;
      }
    }
    zCtx.putImageData(zImg, 0, 0);
    ctx.drawImage(zoneCvs, 0, 0, SIZE, SIZE);

    // ── 3. Zone texture patterns ──────────────────────────
    var cellW = SIZE / GRID_RES;

    // Stippling dots in low-density frontier zones
    ctx.fillStyle = "rgba(80,100,60,0.12)";
    for (var stX = 0; stX < GRID_RES; stX++) {
      for (var stY = 0; stY < GRID_RES; stY++) {
        var stRatio = maxCount > 0 ? grid[stX][stY].count / maxCount : 0;
        if (stRatio < 0.03 || stRatio > 0.20) continue;
        var stX0 = stX * cellW;
        var stY0 = (GRID_RES - 1 - stY) * cellW;
        var dotN = 5 + Math.floor(stRatio * 40);
        for (var di = 0; di < dotN; di++) {
          ctx.beginPath();
          ctx.arc(
            stX0 + Math.random() * cellW,
            stY0 + Math.random() * cellW,
            1.2, 0, Math.PI * 2
          );
          ctx.fill();
        }
      }
    }

    // Diagonal hatching in medium-to-high density zones
    ctx.strokeStyle = "rgba(100,72,40,1)";
    ctx.lineWidth = 1;
    var hGap = 7;
    for (var htX = 0; htX < GRID_RES; htX++) {
      for (var htY = 0; htY < GRID_RES; htY++) {
        var htRatio = maxCount > 0 ? grid[htX][htY].count / maxCount : 0;
        if (htRatio < 0.25) continue;
        var htX0 = htX * cellW;
        var htY0 = (GRID_RES - 1 - htY) * cellW;
        ctx.globalAlpha = Math.min(0.18, (htRatio - 0.25) * 0.35);
        for (var d = -cellW; d < cellW * 2; d += hGap) {
          ctx.beginPath();
          ctx.moveTo(htX0 + d, htY0);
          ctx.lineTo(htX0 + d + cellW, htY0 + cellW);
          ctx.stroke();
        }
        // Cross-hatch for intense zones
        if (htRatio > 0.50) {
          for (var d2 = -cellW; d2 < cellW * 2; d2 += hGap) {
            ctx.beginPath();
            ctx.moveTo(htX0 + d2 + cellW, htY0);
            ctx.lineTo(htX0 + d2, htY0 + cellW);
            ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // ── 4. River features ─────────────────────────────────
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Delaware River (eastern edge, flowing south)
    ctx.beginPath();
    ctx.moveTo(0.73 * SIZE, 0.08 * SIZE);
    ctx.bezierCurveTo(0.72 * SIZE, 0.30 * SIZE, 0.70 * SIZE, 0.58 * SIZE, 0.68 * SIZE, 0.93 * SIZE);
    ctx.strokeStyle = "rgba(60,90,110,0.12)"; ctx.lineWidth = 18; ctx.stroke();
    ctx.strokeStyle = "rgba(90,130,160,0.28)"; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = "rgba(140,180,210,0.16)"; ctx.lineWidth = 4;  ctx.stroke();
    // Schuylkill River (NW to SE through center)
    ctx.beginPath();
    ctx.moveTo(0.27 * SIZE, 0.14 * SIZE);
    ctx.bezierCurveTo(0.34 * SIZE, 0.32 * SIZE, 0.42 * SIZE, 0.52 * SIZE, 0.50 * SIZE, 0.82 * SIZE);
    ctx.strokeStyle = "rgba(60,90,110,0.10)"; ctx.lineWidth = 14; ctx.stroke();
    ctx.strokeStyle = "rgba(90,130,160,0.24)"; ctx.lineWidth = 8;  ctx.stroke();
    ctx.strokeStyle = "rgba(140,180,210,0.14)"; ctx.lineWidth = 3;  ctx.stroke();
    ctx.restore();

    // ── 5. Contour lines ──────────────────────────────────
    drawContourLines(ctx, field, SIZE);

    // ── 6. Coordinate grid overlay ────────────────────────
    ctx.save();
    ctx.strokeStyle = "rgba(120,100,70,0.10)";
    ctx.lineWidth = 0.7;
    ctx.setLineDash([6, 10]);
    var gridN = 6;
    for (var gi = 1; gi < gridN; gi++) {
      var gp = (gi / gridN) * SIZE;
      ctx.beginPath(); ctx.moveTo(gp, 20); ctx.lineTo(gp, SIZE - 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, gp); ctx.lineTo(SIZE - 20, gp); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // ── 7. Decorative map border ──────────────────────────
    ctx.save();
    // Outer frame
    ctx.strokeStyle = "rgba(100,80,50,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, SIZE - 28, SIZE - 28);
    // Inner frame
    ctx.strokeStyle = "rgba(100,80,50,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(22, 22, SIZE - 44, SIZE - 44);
    // Corner ornament marks
    var cl = 28, co = 10;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(100,80,50,0.30)";
    ctx.beginPath(); ctx.moveTo(co, co + cl); ctx.lineTo(co, co); ctx.lineTo(co + cl, co); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SIZE - co - cl, co); ctx.lineTo(SIZE - co, co); ctx.lineTo(SIZE - co, co + cl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SIZE - co, SIZE - co - cl); ctx.lineTo(SIZE - co, SIZE - co); ctx.lineTo(SIZE - co - cl, SIZE - co); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(co + cl, SIZE - co); ctx.lineTo(co, SIZE - co); ctx.lineTo(co, SIZE - co - cl); ctx.stroke();
    ctx.restore();

    // ── 8. Vignette — gentle edge fade toward dark background
    var vcx = SIZE / 2, vcy = SIZE / 2;
    var innerR = SIZE * 0.44, outerR = SIZE * 0.56;
    var vig = ctx.createRadialGradient(vcx, vcy, innerR, vcx, vcy, outerR);
    vig.addColorStop(0, "rgba(42,34,24,0)");
    vig.addColorStop(0.7, "rgba(42,34,24,0.08)");
    vig.addColorStop(1, "rgba(42,34,24,0.35)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── 9. Rounded corners ────────────────────────────────
    var r = 40;
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(SIZE - r, 0);
    ctx.quadraticCurveTo(SIZE, 0, SIZE, r);
    ctx.lineTo(SIZE, SIZE - r);
    ctx.quadraticCurveTo(SIZE, SIZE, SIZE - r, SIZE);
    ctx.lineTo(r, SIZE);
    ctx.quadraticCurveTo(0, SIZE, 0, SIZE - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    var tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  function smoothDensityField(grid, maxCount) {
    var field = [];
    for (var fy = 0; fy < GRID_RES; fy++) {
      var row = [];
      for (var fx = 0; fx < GRID_RES; fx++) {
        row.push(maxCount > 0 ? grid[fx][fy].count / maxCount : 0);
      }
      field.push(row);
    }

    for (var pass = 0; pass < 2; pass++) {
      var blurred = [];
      for (var y = 0; y < GRID_RES; y++) {
        var brow = [];
        for (var x = 0; x < GRID_RES; x++) {
          var sum = 0, cnt = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              var ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < GRID_RES && nx >= 0 && nx < GRID_RES) {
                sum += field[ny][nx];
                cnt++;
              }
            }
          }
          brow.push(sum / cnt);
        }
        blurred.push(brow);
      }
      field = blurred;
    }
    return field;
  }

  function sampleField(field, px, py) {
    var fx = px * (GRID_RES - 1);
    var fy = py * (GRID_RES - 1);
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var x1 = Math.min(x0 + 1, GRID_RES - 1);
    var y1 = Math.min(y0 + 1, GRID_RES - 1);
    var tx = fx - x0, ty = fy - y0;
    var v00 = field[y0][x0], v10 = field[y0][x1];
    var v01 = field[y1][x0], v11 = field[y1][x1];
    return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) +
           v01 * (1 - tx) * ty + v11 * tx * ty;
  }

  function drawContourLines(ctx, field, size) {
    var thresholds = [0.06, 0.14, 0.24, 0.38, 0.52, 0.70];
    var lineWidths = [0.8, 1.0, 1.3, 1.7, 2.2, 2.8];
    var alphas     = [0.18, 0.24, 0.32, 0.40, 0.48, 0.55];
    var step = 4;

    var gridW = Math.floor(size / step);
    var gridH = Math.floor(size / step);

    var samples = [];
    for (var sy = 0; sy <= gridH; sy++) {
      var srow = [];
      for (var sx = 0; sx <= gridW; sx++) {
        var px = sx / gridW;
        var py = 1 - sy / gridH;
        srow.push(sampleField(field, px, py));
      }
      samples.push(srow);
    }

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    thresholds.forEach(function (threshold, ti) {
      ctx.lineWidth = lineWidths[ti];
      ctx.strokeStyle = "rgba(85,68,40," + alphas[ti] + ")";
      if (ti < 2) { ctx.setLineDash([4, 6]); } else { ctx.setLineDash([]); }

      for (var y = 0; y < gridH; y++) {
        for (var x = 0; x < gridW; x++) {
          var tl = samples[y][x] >= threshold ? 1 : 0;
          var tr = samples[y][x + 1] >= threshold ? 1 : 0;
          var br = samples[y + 1][x + 1] >= threshold ? 1 : 0;
          var bl = samples[y + 1][x] >= threshold ? 1 : 0;
          var code = tl * 8 + tr * 4 + br * 2 + bl;

          if (code === 0 || code === 15) continue;

          var lx = x * step, ty2 = y * step;
          var rx = (x + 1) * step, by = (y + 1) * step;
          var mx = (lx + rx) / 2, my = (ty2 + by) / 2;

          var topMid    = { x: mx, y: ty2 };
          var rightMid  = { x: rx, y: my };
          var bottomMid = { x: mx, y: by };
          var leftMid   = { x: lx, y: my };

          var segments = [];
          switch (code) {
            case 1: case 14: segments.push([leftMid, bottomMid]); break;
            case 2: case 13: segments.push([bottomMid, rightMid]); break;
            case 3: case 12: segments.push([leftMid, rightMid]); break;
            case 4: case 11: segments.push([topMid, rightMid]); break;
            case 5:          segments.push([leftMid, topMid]); segments.push([bottomMid, rightMid]); break;
            case 6: case 9:  segments.push([topMid, bottomMid]); break;
            case 7: case 8:  segments.push([leftMid, topMid]); break;
            case 10:         segments.push([topMid, rightMid]); segments.push([leftMid, bottomMid]); break;
          }

          segments.forEach(function (seg) {
            ctx.beginPath();
            ctx.moveTo(seg[0].x, seg[0].y);
            ctx.lineTo(seg[1].x, seg[1].y);
            ctx.stroke();
          });
        }
      }
    });
    ctx.setLineDash([]);
  }

  /* ── Scene factory ──────────────────────────────────── */

  function createState(opts) {
    var canvas = document.getElementById(opts.canvasId);
    var select = document.getElementById(opts.selectId);
    var resetBtn = document.getElementById(opts.resetBtnId);
    var tooltip = document.getElementById(opts.tooltipId);
    if (!canvas) return null;

    var parent = canvas.parentElement;
    var W = parent.clientWidth || 900;
    var H = parent.clientHeight || 500;
    var asp = W / H;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color("#2a2218");
    scene.fog = new THREE.FogExp2("#2a2218", 0.0005);

    var d = 40;
    var camera = new THREE.OrthographicCamera(-d * asp, d * asp, d, -d, 1, 1000);
    camera.position.set(60, 52, 60);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = Math.PI / 7;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    camera.lookAt(0, 4, 0);
    controls.target.set(0, 4, 0);

    // Stop auto-rotate on first interaction
    canvas.addEventListener("pointerdown", function () {
      controls.autoRotate = false;
    }, { once: true });

    // Lighting
    scene.add(new THREE.AmbientLight(0xfaf6f0, 0.5));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xeaddcf, 0.3));

    var sun = new THREE.DirectionalLight(0xfff5e0, 0.78);
    sun.position.set(55, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    var rim = new THREE.DirectionalLight(0xffe8c0, 0.2);
    rim.position.set(-40, 60, -60);
    scene.add(rim);

    return {
      scene: scene, camera: camera, renderer: renderer, controls: controls,
      canvas: canvas, select: select, resetBtn: resetBtn, tooltip: tooltip,
      restaurants: opts.restaurants,
      cuisineSummary: opts.cuisines || [],
      tb: null,           // tileBounds
      groundPlane: null,
      groundBorder: null,
      columns: [],
      labels: [],         // HTML label objects
      grid: null,
      maxCount: 0,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      handlers: {}
    };
  }

  /* ── Background table surface (fills dark margins) ─── */

  function createTableSurface(state) {
    if (state.tableSurface) return; // only create once

    var TABLE_SIZE = GEO_SIZE * 2.5;
    var TS = 512;
    var cvs = document.createElement("canvas");
    cvs.width = TS; cvs.height = TS;
    var tCtx = cvs.getContext("2d");

    // Dark wood base
    tCtx.fillStyle = "#2a2218";
    tCtx.fillRect(0, 0, TS, TS);

    // Wood grain noise
    var tImg = tCtx.getImageData(0, 0, TS, TS);
    var tPx = tImg.data;
    for (var ti = 0; ti < tPx.length; ti += 4) {
      var tn = (Math.random() - 0.5) * 14;
      tPx[ti]     = clampByte(tPx[ti] + tn);
      tPx[ti + 1] = clampByte(tPx[ti + 1] + tn * 0.8);
      tPx[ti + 2] = clampByte(tPx[ti + 2] + tn * 0.5);
    }
    tCtx.putImageData(tImg, 0, 0);

    // Horizontal grain lines
    tCtx.strokeStyle = "rgba(60,48,30,0.10)";
    tCtx.lineWidth = 0.8;
    for (var gy = 0; gy < TS; gy += 2 + Math.floor(Math.random() * 4)) {
      tCtx.beginPath();
      tCtx.moveTo(0, gy);
      for (var gx = 0; gx < TS; gx += 20) {
        tCtx.lineTo(gx, gy + Math.sin(gx * 0.015 + gy * 0.08) * 2);
      }
      tCtx.stroke();
    }

    // Warm highlight spots (leather sheen)
    for (var si = 0; si < 6; si++) {
      var sx = Math.random() * TS, sy = Math.random() * TS;
      var sg = tCtx.createRadialGradient(sx, sy, 0, sx, sy, 70 + Math.random() * 50);
      sg.addColorStop(0, "rgba(55,45,30,0.08)");
      sg.addColorStop(1, "rgba(55,45,30,0)");
      tCtx.fillStyle = sg;
      tCtx.fillRect(0, 0, TS, TS);
    }

    var tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);

    var geo = new THREE.PlaneGeometry(TABLE_SIZE, TABLE_SIZE);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({ map: tex });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -0.4;
    state.scene.add(mesh);
    state.tableSurface = mesh;
  }

  /* ── Ground plane ───────────────────────────────────── */

  function setGroundPlane(state, texture) {
    if (state.groundPlane) {
      state.scene.remove(state.groundPlane);
      state.groundPlane.geometry.dispose();
      state.groundPlane.material.dispose();
    }
    if (state.groundBorder) {
      var borders = Array.isArray(state.groundBorder) ? state.groundBorder : [state.groundBorder];
      borders.forEach(function(b) {
        state.scene.remove(b);
        if (b.geometry) b.geometry.dispose();
        if (b.material) b.material.dispose();
      });
    }

    var geo = new THREE.PlaneGeometry(GEO_SIZE, GEO_SIZE);
    geo.rotateX(-Math.PI / 2);

    var material;
    if (texture) {
      // MeshBasicMaterial ignores lighting → renders the map tiles as-is
      material = new THREE.MeshBasicMaterial({ map: texture });
    } else {
      material = new THREE.MeshStandardMaterial({ color: "#e2ddd4", roughness: 1, metalness: 0 });
    }
    var plane = new THREE.Mesh(geo, material);
    plane.receiveShadow = !texture;
    plane.position.y = 0.1;   // slight elevation
    state.scene.add(plane);
    state.groundPlane = plane;

    // Drop shadow layers beneath the map (floating-on-table effect)
    var shadowGeo = new THREE.PlaneGeometry(GEO_SIZE * 1.06, GEO_SIZE * 1.06);
    shadowGeo.rotateX(-Math.PI / 2);
    var shadowMat = new THREE.MeshBasicMaterial({
      color: "#0a0806", transparent: true, opacity: 0.18, depthWrite: false
    });
    var shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = -0.08;
    state.scene.add(shadow);

    // Mid shadow ring
    var shadow2Geo = new THREE.PlaneGeometry(GEO_SIZE * 1.14, GEO_SIZE * 1.14);
    shadow2Geo.rotateX(-Math.PI / 2);
    var shadow2 = new THREE.Mesh(shadow2Geo, new THREE.MeshBasicMaterial({
      color: "#0a0806", transparent: true, opacity: 0.08, depthWrite: false
    }));
    shadow2.position.y = -0.15;
    state.scene.add(shadow2);

    // Outer soft glow
    var shadow3Geo = new THREE.PlaneGeometry(GEO_SIZE * 1.24, GEO_SIZE * 1.24);
    shadow3Geo.rotateX(-Math.PI / 2);
    var shadow3 = new THREE.Mesh(shadow3Geo, new THREE.MeshBasicMaterial({
      color: "#0a0806", transparent: true, opacity: 0.04, depthWrite: false
    }));
    shadow3.position.y = -0.2;
    state.scene.add(shadow3);

    state.groundBorder = [shadow, shadow2, shadow3]; // track for cleanup
  }

  /* ── Columns ────────────────────────────────────────── */

  function clearColumns(state) {
    state.columns.forEach(function (c) {
      state.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
    });
    state.columns = [];
  }

  function buildColumns(state, cuisine) {
    clearColumns(state);
    if (!state.tb) return;

    // Grid binning — no smoothing, discrete columns = honest data
    var grid = [];
    for (var i = 0; i < GRID_RES; i++) {
      var row = [];
      for (var j = 0; j < GRID_RES; j++)
        row.push({ count: 0, sumStars: 0, cuisines: {} });
      grid.push(row);
    }

    var tb = state.tb;
    var latR = tb.maxLat - tb.minLat, lngR = tb.maxLng - tb.minLng;

    state.restaurants.forEach(function (r) {
      if (!isFinite(+r.lat) || !isFinite(+r.lng)) return;
      if (cuisine !== "All" && (!r.cuisines || r.cuisines.indexOf(cuisine) === -1)) return;
      var xi = Math.floor((r.lng - tb.minLng) / lngR * GRID_RES);
      var yi = Math.floor((r.lat - tb.minLat) / latR * GRID_RES);
      if (xi < 0 || xi >= GRID_RES || yi < 0 || yi >= GRID_RES) return;
      grid[xi][yi].count++;
      grid[xi][yi].sumStars += (r.stars || 0);
      var c = (r.cuisines && r.cuisines.length) ? r.cuisines[0] : "Other";
      grid[xi][yi].cuisines[c] = (grid[xi][yi].cuisines[c] || 0) + 1;
    });

    var maxC = 0;
    for (var x = 0; x < GRID_RES; x++)
      for (var y = 0; y < GRID_RES; y++)
        if (grid[x][y].count > maxC) maxC = grid[x][y].count;

    state.grid = grid;
    state.maxCount = maxC;
    if (maxC === 0) return;

    for (var x = 0; x < GRID_RES; x++) {
      for (var y = 0; y < GRID_RES; y++) {
        var cell = grid[x][y];
        if (cell.count === 0) continue;

        var ratio = cell.count / maxC;
        var h = MIN_HEIGHT + Math.pow(ratio, 0.5) * (MAX_HEIGHT - MIN_HEIGHT);
        var color = heatColor(ratio);

        var wx = ((x + 0.5) / GRID_RES - 0.5) * GEO_SIZE;
        var wz = -((y + 0.5) / GRID_RES - 0.5) * GEO_SIZE;

        var geo = new THREE.CylinderGeometry(COL_R_TOP, COL_R_BOT, h, COL_SEGS);
        var mat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.35,
          metalness: 0.12,
          transparent: true,
          opacity: 0.88
        });
        // Subtle glow on dense columns
        if (ratio > 0.55) {
          mat.emissive = color;
          mat.emissiveIntensity = ratio * 0.15;
        }

        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(wx, h / 2, wz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Start tiny for grow-in animation
        mesh.scale.y = 0.01;
        mesh.position.y = h / 2 * 0.01;

        state.scene.add(mesh);
        // Compute top cuisines for tooltip
        var sorted = [];
        for (var ck in cell.cuisines) sorted.push({ n: ck, c: cell.cuisines[ck] });
        sorted.sort(function (a, b) { return b.c - a.c; });
        var topCuisines = sorted.filter(function (e) { return e.n !== "Other"; }).slice(0, 3);

        state.columns.push({
          mesh: mesh, targetH: h, scaleY: 0.01,
          gx: x, gy: y,
          count: cell.count,
          avgStars: cell.sumStars / cell.count,
          domCuisine: dominantCuisine(cell),
          topCuisines: topCuisines,
          ratio: ratio
        });
      }
    }
  }

  /* ── Neighborhood labels (HTML overlays) ────────────── */

  function clearLabels(state) {
    state.labels.forEach(function (l) { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); });
    state.labels = [];
  }

  function addLabels(state) {
    clearLabels(state);
    if (!state.tb) return;

    var container = state.canvas.parentElement;

    NEIGHBORHOODS.forEach(function (nb) {
      var pos = toWorld(nb.lat, nb.lng, state.tb);
      if (Math.abs(pos.x) > GEO_SIZE * 0.48 || Math.abs(pos.z) > GEO_SIZE * 0.48) return;

      var el = document.createElement("div");
      el.className = "terrain-hood-label";
      el.textContent = nb.name;
      container.appendChild(el);

      state.labels.push({
        el: el,
        wp: new THREE.Vector3(pos.x, 1.5, pos.z)
      });
    });
  }

  function projectLabels(state) {
    var W = state.canvas.clientWidth, H = state.canvas.clientHeight;
    state.labels.forEach(function (l) {
      var p = l.wp.clone().project(state.camera);
      l.el.style.left = ((p.x * 0.5 + 0.5) * W) + "px";
      l.el.style.top  = ((-p.y * 0.5 + 0.5) * H) + "px";
      l.el.style.display = (p.z > 1) ? "none" : "";
    });
  }

  /* ── Cuisine dropdown ───────────────────────────────── */

  function populateSelect(state) {
    if (!state.select) return;
    state.select.innerHTML = "";

    var opt = document.createElement("option");
    opt.value = "All"; opt.textContent = "All Cuisines";
    state.select.appendChild(opt);

    var list = state.cuisineSummary.slice()
      .sort(function (a, b) { return b.count - a.count; })
      .map(function (d) { return d.cuisine; })
      .filter(function (c, i, a) { return c && a.indexOf(c) === i; });

    ["Pizza", "Burgers", "Italian", "Chinese", "Mexican", "Japanese",
     "Thai", "Vegan", "Korean", "Ethiopian", "Sandwiches"]
      .forEach(function (n) { if (list.indexOf(n) === -1) list.unshift(n); });

    list.slice(0, 22).forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c;
      state.select.appendChild(o);
    });
  }

  /* ── Interactions ───────────────────────────────────── */

  function bindInteractions(state) {
    function onMove(evt) {
      if (!state.columns.length) return;
      var rect = state.canvas.getBoundingClientRect();
      state.mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      state.mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      state.raycaster.setFromCamera(state.mouse, state.camera);

      var meshes = state.columns.map(function (c) { return c.mesh; });
      var hits = state.raycaster.intersectObjects(meshes);

      if (hits.length) {
        var hit = hits[0].object;
        var col = null;
        for (var i = 0; i < state.columns.length; i++) {
          if (state.columns[i].mesh === hit) { col = state.columns[i]; break; }
        }
        if (col) {
          // Build a meaningful title
          var title;
          if (state.select.value !== "All") {
            title = state.select.value;
          } else if (col.topCuisines.length > 0) {
            title = col.topCuisines.map(function (e) { return e.n; }).join(", ");
          } else {
            title = "Mixed Dining";
          }

          var pct = Math.round(col.ratio * 100);
          var pctColor = pct > 60 ? "#d4503a" : pct > 30 ? "#e8a838" : "#3a8c5c";

          // Sub-line: show cuisine mix if "All"
          var subLine = "";
          if (state.select.value === "All" && col.topCuisines.length > 1) {
            subLine = "<div style='margin-bottom:6px;font-size:0.68rem;opacity:0.55'>" +
              col.topCuisines.map(function (e) { return e.n + " (" + e.c + ")"; }).join(" &middot; ") +
              "</div>";
          }

          state.tooltip.innerHTML =
            "<div style='margin-bottom:4px;font-size:0.92rem;font-weight:700;color:#f0c040'>" +
              title + "</div>" + subLine +
            "<div style='display:flex;gap:14px;font-size:0.78rem'>" +
              "<div><span class='tt-lbl'>RESTAURANTS</span><br><strong class='tt-val'>" +
                col.count + "</strong></div>" +
              "<div><span class='tt-lbl'>AVG RATING</span><br><strong class='tt-val'>" +
                col.avgStars.toFixed(1) + " &#9733;</strong></div>" +
              "<div><span class='tt-lbl'>COMPETITION</span><br><strong class='tt-val' style='color:" +
                pctColor + "'>" + pct + "%</strong></div>" +
            "</div>";
          state.tooltip.style.display = "block";
          state.tooltip.classList.add("visible");
          state.tooltip.style.left = (evt.clientX - rect.left + 16) + "px";
          state.tooltip.style.top  = (evt.clientY - rect.top  - 20) + "px";
          return;
        }
      }
      state.tooltip.classList.remove("visible");
      state.tooltip.style.display = "none";
    }

    state.canvas.addEventListener("mousemove", onMove);
    state.canvas.addEventListener("mouseleave", function () {
      state.tooltip.classList.remove("visible");
      state.tooltip.style.display = "none";
    });
    state.handlers.pointerMove = onMove;

    if (state.resetBtn) {
      state.resetBtn.addEventListener("click", function () {
        state.camera.position.set(60, 52, 60);
        state.controls.target.set(0, 4, 0);
        state.controls.autoRotate = true;
        state.controls.update();
      });
    }

    if (state.select) {
      state.select.addEventListener("change", function () {
        buildColumns(state, state.select.value);
        if (state.grid && state.maxCount > 0) {
          var topoTex = generateTopographicTexture(state.grid, state.maxCount);
          setGroundPlane(state, topoTex);
        }
      });
    }
  }

  /* ── Render loop (pause / resume) ───────────────────── */

  function startLoop(state) {
    var running = false, rafId = null;

    function frame() {
      if (!running) return;
      state.controls.update();

      // Grow-in animation for columns
      var animating = false;
      state.columns.forEach(function (c) {
        if (c.scaleY < 0.998) {
          c.scaleY += (1 - c.scaleY) * 0.09;
          if (c.scaleY > 0.998) c.scaleY = 1;
          c.mesh.scale.y = c.scaleY;
          c.mesh.position.y = (c.targetH / 2) * c.scaleY;
          animating = true;
        }
      });

      // Project neighbourhood labels
      if (state.labels.length) projectLabels(state);

      state.renderer.render(state.scene, state.camera);
      rafId = requestAnimationFrame(frame);
    }

    function resume() { if (running) return; running = true; rafId = requestAnimationFrame(frame); }
    function pause()  { running = false; if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

    resume();
    return { pause: pause, resume: resume, stop: pause };
  }

  /* ── Resize ─────────────────────────────────────────── */

  function setupResize(state) {
    function onResize() {
      var p = state.canvas.parentElement;
      var w = p.clientWidth || 900, h = p.clientHeight || 500, a = w / h, d = 40;
      state.camera.left = -d * a; state.camera.right = d * a;
      state.camera.top = d; state.camera.bottom = -d;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);
    state.handlers.resize = onResize;
  }

  /* ── Init ───────────────────────────────────────────── */

  function init(opts) {
    if (!opts || !opts.restaurants || !opts.restaurants.length) return null;
    if (typeof THREE === "undefined") return null;

    var state = createState(opts);
    if (!state) return null;

    // Compute tile bounds synchronously → columns + labels appear immediately
    var db = dataBounds(state.restaurants);
    state.tb = clippedBounds(db);

    populateSelect(state);
    createTableSurface(state);          // wood-grain surface behind the map
    setGroundPlane(state, null);        // plain colour initially
    buildColumns(state, "All");
    addLabels(state);
    bindInteractions(state);
    setupResize(state);

    // Start render
    state.loop = startLoop(state);

    // Generate topographic texture from density data and apply
    if (state.grid && state.maxCount > 0) {
      var topoTex = generateTopographicTexture(state.grid, state.maxCount);
      setGroundPlane(state, topoTex);
    }

    // Expose pause / resume / stop (matches linter expectation)
    state.pause  = function () { if (state.loop) state.loop.pause(); };
    state.resume = function () {
      if (state.handlers.resize) state.handlers.resize();
      if (state.loop) state.loop.resume();
    };
    state.stop   = function () { if (state.loop) state.loop.stop(); };
    state.resize = state.handlers.resize;

    return state;
  }

  window.CuisineTerrain = { init: init };
})();
