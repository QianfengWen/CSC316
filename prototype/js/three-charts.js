/* ============================================================
   Hidden Gems — Philadelphia Restaurant Market Analysis
   Three.js 3D chart visualizations
   Loaded after Three.js + OrbitControls from CDN

   Provides three interactive 3D charts:
     1. Competition bar chart  (init3DCompetition)
     2. Restaurant scatter plot (init3DScatter)
     3. Opportunity matrix      (init3DOpportunity)

   Expects THREE and THREE.OrbitControls to be loaded already.
   ============================================================ */
(function () {
  "use strict";

  // ── Style Constants ─────────────────────────────────────────
  var COLORS = {
    red: "#d4503a",
    gold: "#e8a838",
    green: "#3a8c5c",
    teal: "#2a8a8a",
    dark: "#1a1410",
    muted: "#7a6e5f"
  };

  // ── Shared Utilities ────────────────────────────────────────

  /**
   * Create a standard Three.js scene with camera, renderer, controls, and lights.
   * Returns {scene, camera, renderer, controls}.
   */
  function createScene(canvas, width, height) {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.set(30, 25, 40);
    camera.lookAt(0, 0, 0);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    var controls = null;
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 5;
      controls.maxDistance = 200;
      controls.maxPolarAngle = Math.PI * 0.85;
    }

    var ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    var directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(20, 30, 20);
    scene.add(directional);
    var fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-15, 10, -10);
    scene.add(fill);

    return { scene: scene, camera: camera, renderer: renderer, controls: controls };
  }

  function setupRaycasting(scene, camera, canvas, objects, onHover, onClick) {
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var currentHover = null;

    function coords(event) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    function handleMove(event) {
      coords(event);
      raycaster.setFromCamera(mouse, camera);
      var hits = raycaster.intersectObjects(objects, false);
      if (hits.length > 0) {
        var obj = hits[0].object;
        if (obj !== currentHover) { currentHover = obj; if (onHover) onHover(obj, event); }
      } else if (currentHover !== null) {
        currentHover = null;
        if (onHover) onHover(null, event);
      }
    }
    function handleClick(event) {
      coords(event);
      raycaster.setFromCamera(mouse, camera);
      var hits = raycaster.intersectObjects(objects, false);
      if (hits.length > 0 && onClick) onClick(hits[0].object, event);
    }
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("click", handleClick);
    return {
      dispose: function () {
        canvas.removeEventListener("mousemove", handleMove);
        canvas.removeEventListener("click", handleClick);
      }
    };
  }

  function positionHTMLTooltip(tooltip, camera, renderer, position3D) {
    var vector = position3D.clone().project(camera);
    var wH = renderer.domElement.clientWidth / 2;
    var hH = renderer.domElement.clientHeight / 2;
    var rect = renderer.domElement.getBoundingClientRect();
    tooltip.style.left = (rect.left + vector.x * wH + wH) + "px";
    tooltip.style.top = (rect.top - vector.y * hH + hH - 10) + "px";
  }

  function animateScene(renderer, scene, camera, controls) {
    var running = true, animId = null;
    function loop() {
      if (!running) return;
      animId = requestAnimationFrame(loop);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    loop();
    return function () { running = false; if (animId) cancelAnimationFrame(animId); };
  }

  function makeTextSprite(text, opts) {
    opts = opts || {};
    var fontSize = opts.fontSize || 28;
    var color = opts.color || "#1a1410";
    var bgColor = opts.backgroundColor || null;
    var padding = opts.padding || 6;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    ctx.font = "bold " + fontSize + "px Arial, sans-serif";
    var tw = ctx.measureText(text).width;
    canvas.width = tw + padding * 2;
    canvas.height = fontSize + padding * 2;
    ctx.font = "bold " + fontSize + "px Arial, sans-serif";
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    }
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.fillText(text, padding, padding);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    var scale = opts.scale || 3;
    sprite.scale.set(scale * (canvas.width / canvas.height), scale, 1);
    return sprite;
  }

  function getOrCreateTooltip() {
    var id = "three-chart-tooltip";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.cssText =
        "position:fixed;pointer-events:none;z-index:9999;" +
        "background:rgba(26,20,16,0.92);color:#faf6f0;padding:10px 14px;" +
        "border-radius:6px;font-size:13px;line-height:1.5;max-width:260px;" +
        "box-shadow:0 4px 16px rgba(0,0,0,0.25);display:none;" +
        "transform:translate(-50%,-100%);font-family:inherit;";
      document.body.appendChild(el);
    }
    return el;
  }

  function lerpColor(colorA, colorB, t) {
    var a = new THREE.Color(colorA);
    var b = new THREE.Color(colorB);
    return a.lerp(b, Math.max(0, Math.min(1, t)));
  }

  function disposeScene(scene) {
    scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });
  }

  function createWallGrid(w, h, divs, colorHex) {
    var pts = [], hw = w / 2, hh = h / 2, sw = w / divs, sh = h / divs;
    for (var i = 0; i <= divs; i++) {
      var x = -hw + i * sw;
      pts.push(new THREE.Vector3(x, -hh, 0), new THREE.Vector3(x, hh, 0));
    }
    for (var j = 0; j <= divs; j++) {
      var y = -hh + j * sh;
      pts.push(new THREE.Vector3(-hw, y, 0), new THREE.Vector3(hw, y, 0));
    }
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.3 });
    return new THREE.LineSegments(geo, mat);
  }

  // Shared camera-fly animation helper
  function flyCamera(camera, controls, targetPos, targetLook, duration) {
    var startPos = camera.position.clone();
    var startTarget = controls ? controls.target.clone() : targetLook.clone();
    var startTime = performance.now();
    var id = null;
    function step() {
      var t = Math.min((performance.now() - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(startPos, targetPos, ease);
      if (controls) {
        controls.target.lerpVectors(startTarget, targetLook, ease);
        controls.update();
      }
      if (t < 1) id = requestAnimationFrame(step);
    }
    step();
    return function cancel() { if (id) cancelAnimationFrame(id); };
  }

  // ── 3D Competition Bar Chart ────────────────────────────────
  //
  // Displays an extruded bar chart where each bar represents a cuisine.
  // Height = restaurant count, color grades from green (low) to red (high).
  // Top 25 cuisines by count, arranged in a 5-column grid.
  // Hover highlights a bar and shows a tooltip; click flies the camera in.

  function init3DCompetition(canvas, cuisineData) {
    var parent = canvas.parentElement;
    var width = parent.clientWidth || 800, height = parent.clientHeight || 500;
    var env = createScene(canvas, width, height);
    var scene = env.scene, camera = env.camera, renderer = env.renderer, controls = env.controls;

    var sorted = cuisineData.slice().sort(function (a, b) { return b.count - a.count; });
    var data = sorted.slice(0, 25);
    var maxCount = d3.max(data, function (d) { return d.count; }) || 1;
    var barW = 1.8, barD = 1.8, spacing = 2.6, cols = 5, hScale = 30 / maxCount;
    var bars = [];
    var barGroup = new THREE.Group();
    scene.add(barGroup);

    // Ground plane
    var gGeo = new THREE.PlaneGeometry(cols * spacing + 6, Math.ceil(data.length / cols) * spacing + 6);
    var gMat = new THREE.MeshStandardMaterial({
      color: 0xf0ebe3, roughness: 0.9, transparent: true, opacity: 0.5
    });
    var ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    barGroup.add(ground);

    data.forEach(function (d, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var bH = Math.max(d.count * hScale, 0.3);
      var t = d.count / maxCount;
      var bColor = lerpColor(COLORS.green, COLORS.red, t);
      var geo = new THREE.BoxGeometry(barW, bH, barD);
      var mat = new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.4, metalness: 0.1 });
      var mesh = new THREE.Mesh(geo, mat);
      var xP = col * spacing - (cols - 1) * spacing / 2;
      var zP = row * spacing - (Math.ceil(data.length / cols) - 1) * spacing / 2;
      mesh.position.set(xP, bH / 2, zP);
      mesh.userData = {
        cuisine: d.cuisine, count: d.count, avgRating: d.avg_rating,
        originalColor: bColor.clone(), targetY: bH / 2, barHeight: bH
      };
      barGroup.add(mesh);
      bars.push(mesh);

      var label = makeTextSprite(d.cuisine, { fontSize: 20, color: "#1a1410", scale: 1.4 });
      label.position.set(xP, -0.3, zP + barD / 2 + 0.8);
      barGroup.add(label);
    });

    // Center the group horizontally
    var box = new THREE.Box3().setFromObject(barGroup);
    var ctr = box.getCenter(new THREE.Vector3());
    barGroup.position.sub(new THREE.Vector3(ctr.x, 0, ctr.z));

    camera.position.set(20, 22, 30);
    camera.lookAt(0, 5, 0);
    controls.target.set(0, 5, 0);
    controls.update();

    var tooltip = getOrCreateTooltip();
    var hBar = null;

    function onHover(obj, event) {
      if (hBar && hBar !== obj) {
        hBar.material.color.copy(hBar.userData.originalColor);
        hBar.material.emissive.setHex(0x000000);
      }
      if (obj && obj.userData.cuisine) {
        obj.material.emissive.setHex(0x333333);
        hBar = obj;
        var d = obj.userData;
        tooltip.innerHTML =
          "<strong>" + d.cuisine + "</strong><br>" +
          "Restaurants: " + d.count.toLocaleString() + "<br>" +
          "Avg Rating: " + d.avgRating.toFixed(2) + " &#9733;";
        tooltip.style.display = "block";
        var wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        wp.y += d.barHeight / 2 + 1;
        positionHTMLTooltip(tooltip, camera, renderer, wp);
      } else {
        if (hBar) { hBar.material.color.copy(hBar.userData.originalColor); hBar.material.emissive.setHex(0x000000); hBar = null; }
        tooltip.style.display = "none";
      }
    }

    var cancelFly = null;
    function onClick(obj) {
      if (!obj || !obj.userData.cuisine) return;
      if (cancelFly) cancelFly();
      var wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      var tgt = new THREE.Vector3(wp.x + 6, wp.y + obj.userData.barHeight + 4, wp.z + 8);
      var look = wp.clone(); look.y = obj.userData.barHeight / 2;
      cancelFly = flyCamera(camera, controls, tgt, look, 800);
    }

    var raycasting = setupRaycasting(scene, camera, canvas, bars, onHover, onClick);
    var stopAnim = animateScene(renderer, scene, camera, controls);

    // Entrance animation: bars grow from 0
    var animStart = performance.now(), animDur = 1200;
    bars.forEach(function (b) { b.scale.y = 0.01; b.position.y = 0; });
    function growBars() {
      var t = Math.min((performance.now() - animStart) / animDur, 1);
      var ease = 1 - Math.pow(1 - t, 3);
      bars.forEach(function (b) {
        b.scale.y = 0.01 + ease * 0.99;
        b.position.y = b.userData.targetY * b.scale.y;
      });
      if (t < 1) requestAnimationFrame(growBars);
    }
    requestAnimationFrame(growBars);

    return {
      resize: function () {
        var w = parent.clientWidth || 800, h = parent.clientHeight || 500;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      },
      dispose: function () {
        stopAnim(); raycasting.dispose(); disposeScene(scene); renderer.dispose();
        tooltip.style.display = "none"; if (cancelFly) cancelFly();
      }
    };
  }

  // ── 3D Scatter Plot ─────────────────────────────────────────
  //
  // Each restaurant is a sphere in 3D space:
  //   X = review count (log scale)
  //   Y = star rating (1-5)
  //   Z = competition level of primary cuisine (log scale)
  // Color: green (high rated) to red (low rated).
  // Size varies slightly by review count.
  // Uses InstancedMesh for performance (max 1500 points).
  // Invisible hit spheres provide raycasting targets.

  function init3DScatter(canvas, restaurants, cuisineData) {
    var parent = canvas.parentElement;
    var width = parent.clientWidth || 800, height = parent.clientHeight || 500;
    var env = createScene(canvas, width, height);
    var scene = env.scene, camera = env.camera, renderer = env.renderer, controls = env.controls;

    // Cuisine -> count lookup
    var ccMap = {};
    cuisineData.forEach(function (c) { ccMap[c.cuisine] = c.count; });

    // Sample for performance
    var maxPts = 1500, sampled = restaurants;
    if (restaurants.length > maxPts) {
      sampled = restaurants.slice();
      for (var si = sampled.length - 1; si > 0; si--) {
        var sj = Math.floor(Math.random() * (si + 1));
        var tmp = sampled[si]; sampled[si] = sampled[sj]; sampled[sj] = tmp;
      }
      sampled = sampled.slice(0, maxPts);
    }

    var axis = 30;
    var maxRev = d3.max(sampled, function (d) { return d.review_count; }) || 1;
    var logMaxRev = Math.log10(Math.max(maxRev, 10));
    var maxCC = d3.max(cuisineData, function (d) { return d.count; }) || 1;
    var logMaxCC = Math.log10(Math.max(maxCC, 10));

    function xS(rc) { return (Math.log10(Math.max(rc, 1)) / logMaxRev) * axis; }
    function yS(st) { return ((st - 1) / 4) * axis; }
    function zS(cc) { return (Math.log10(Math.max(cc, 1)) / logMaxCC) * axis; }

    // InstancedMesh for the scatter points
    var sGeo = new THREE.SphereGeometry(0.25, 12, 8);
    var iMesh = new THREE.InstancedMesh(
      sGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), sampled.length
    );
    var dummy = new THREE.Object3D();
    var ptData = [];

    sampled.forEach(function (r, i) {
      var pc = (r.cuisines && r.cuisines.length > 0) ? r.cuisines[0] : "Other";
      var cc = ccMap[pc] || 1;
      var x = xS(r.review_count), y = yS(r.stars), z = zS(cc);
      var sz = 0.15 + (Math.log10(Math.max(r.review_count, 1)) / logMaxRev) * 0.35;
      dummy.position.set(x, y, z);
      dummy.scale.set(sz * 2, sz * 2, sz * 2);
      dummy.updateMatrix();
      iMesh.setMatrixAt(i, dummy.matrix);
      var c = lerpColor(COLORS.red, COLORS.green, (r.stars - 1) / 4);
      iMesh.setColorAt(i, c);
      ptData.push({ name: r.name, stars: r.stars, reviewCount: r.review_count, cuisine: pc, position: new THREE.Vector3(x, y, z) });
    });
    iMesh.instanceMatrix.needsUpdate = true;
    if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
    scene.add(iMesh);

    // Invisible hit spheres for raycasting
    var hitSpheres = [];
    var hGeo = new THREE.SphereGeometry(0.4, 6, 4);
    var hMat = new THREE.MeshBasicMaterial({ visible: false });
    ptData.forEach(function (pd, i) {
      var hit = new THREE.Mesh(hGeo, hMat);
      hit.position.copy(pd.position);
      hit.userData = pd;
      hit.userData.instanceIndex = i;
      scene.add(hit);
      hitSpheres.push(hit);
    });

    // Reference grids on floor, back wall, and side wall
    var gridH = new THREE.GridHelper(axis, 10, 0xcccccc, 0xe0e0e0);
    gridH.position.set(axis / 2, 0, axis / 2);
    scene.add(gridH);

    var backWall = createWallGrid(axis, axis, 10, 0xdddddd);
    backWall.rotation.x = Math.PI / 2;
    backWall.position.set(axis / 2, axis / 2, 0);
    scene.add(backWall);

    var sideWall = createWallGrid(axis, axis, 10, 0xdddddd);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.rotation.z = Math.PI / 2;
    sideWall.position.set(0, axis / 2, axis / 2);
    scene.add(sideWall);

    // Solid axis lines for X, Y, Z
    var axisLineMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 2 });
    var xAxisPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(axis, 0, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(xAxisPts), axisLineMat));
    var yAxisPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axis, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(yAxisPts), axisLineMat));
    var zAxisPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axis)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(zAxisPts), axisLineMat));

    // Axis labels
    var xL = makeTextSprite("Reviews (log)", { fontSize: 24, color: COLORS.dark, scale: 2.5 });
    xL.position.set(axis / 2, -2, axis + 2); scene.add(xL);
    var yL = makeTextSprite("Star Rating", { fontSize: 24, color: COLORS.dark, scale: 2.5 });
    yL.position.set(-3, axis / 2, 0); scene.add(yL);
    var zL = makeTextSprite("Competition (log)", { fontSize: 24, color: COLORS.dark, scale: 2.5 });
    zL.position.set(axis + 3, -2, axis / 2); scene.add(zL);

    [1, 2, 3, 4, 5].forEach(function (r) {
      var tick = makeTextSprite(r.toString(), { fontSize: 20, color: COLORS.muted, scale: 1.5 });
      tick.position.set(-1.5, yS(r), -1); scene.add(tick);
    });

    camera.position.set(40, 25, 45);
    camera.lookAt(axis / 2, axis / 3, axis / 2);
    controls.target.set(axis / 2, axis / 3, axis / 2);
    controls.update();

    var tooltip = getOrCreateTooltip();
    function onHover(obj, event) {
      if (obj && obj.userData.name) {
        var d = obj.userData;
        tooltip.innerHTML =
          "<strong>" + d.name + "</strong><br>" +
          "Rating: " + d.stars.toFixed(1) + " &#9733;<br>" +
          "Reviews: " + d.reviewCount.toLocaleString() + "<br>" +
          "Cuisine: " + d.cuisine;
        tooltip.style.display = "block";
        var wp = d.position.clone(); wp.y += 1;
        positionHTMLTooltip(tooltip, camera, renderer, wp);
      } else {
        tooltip.style.display = "none";
      }
    }

    var raycasting = setupRaycasting(scene, camera, canvas, hitSpheres, onHover, null);
    var stopAnim = animateScene(renderer, scene, camera, controls);

    return {
      resize: function () {
        var w = parent.clientWidth || 800, h = parent.clientHeight || 500;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      },
      dispose: function () {
        stopAnim(); raycasting.dispose(); disposeScene(scene); renderer.dispose();
        tooltip.style.display = "none";
      }
    };
  }

  // ── 3D Opportunity Matrix ───────────────────────────────────
  //
  // Positions each cuisine in 3D:
  //   X = competition (log count)
  //   Y = avg rating
  //   Z = std rating (volatility)
  // Sphere size = median reviews.
  // Color = stability (green = low std / stable, red = high std / volatile).
  // Gold wireframe outlines mark "hidden gem" cuisines (count < 80 && rating > 3.7).
  // Click flies the camera to the selected cuisine sphere.

  function init3DOpportunity(canvas, cuisineData) {
    var parent = canvas.parentElement;
    var width = parent.clientWidth || 800, height = parent.clientHeight || 500;
    var env = createScene(canvas, width, height);
    var scene = env.scene, camera = env.camera, renderer = env.renderer, controls = env.controls;

    var axis = 30;
    var maxCnt = d3.max(cuisineData, function (d) { return d.count; }) || 1;
    var logMaxCnt = Math.log10(Math.max(maxCnt, 10));
    var rExt = d3.extent(cuisineData, function (d) { return d.avg_rating; });
    var minR = rExt[0] || 1, maxR = rExt[1] || 5;
    var sExt = d3.extent(cuisineData, function (d) { return d.std_rating; });
    var minS = sExt[0] || 0, maxS = sExt[1] || 2;
    var mExt = d3.extent(cuisineData, function (d) { return d.median_reviews; });
    var minM = mExt[0] || 1, maxM = mExt[1] || 100;

    function xSc(cnt) { return (Math.log10(Math.max(cnt, 1)) / logMaxCnt) * axis; }
    function ySc(rat) { return ((rat - minR) / (maxR - minR || 1)) * axis; }
    function zSc(std) { return ((std - minS) / (maxS - minS || 1)) * axis; }
    function szSc(med) { return 0.4 + ((med - minM) / (maxM - minM || 1)) * 1.2; }

    var spheres = [];
    var gemGroup = new THREE.Group();
    scene.add(gemGroup);

    cuisineData.forEach(function (d) {
      var x = xSc(d.count), y = ySc(d.avg_rating), z = zSc(d.std_rating);
      var radius = szSc(d.median_reviews);
      var stdNorm = (d.std_rating - minS) / (maxS - minS || 1);
      var sColor = lerpColor(COLORS.green, COLORS.red, stdNorm);

      var geo = new THREE.SphereGeometry(radius, 20, 16);
      var mat = new THREE.MeshStandardMaterial({
        color: sColor, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0.85
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.userData = {
        cuisine: d.cuisine, count: d.count, avgRating: d.avg_rating,
        stdRating: d.std_rating, medianReviews: d.median_reviews,
        avgReviews: d.avg_reviews, weightedRating: d.weighted_rating,
        stability: d.stability, opportunity: d.opportunity,
        originalColor: sColor.clone(), isGem: d.count < 80 && d.avg_rating > 3.7
      };
      gemGroup.add(mesh);
      spheres.push(mesh);

      // Gold wireframe for gem cuisines
      if (d.count < 80 && d.avg_rating > 3.7) {
        var wGeo = new THREE.SphereGeometry(radius + 0.1, 16, 12);
        var wMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(COLORS.gold), wireframe: true, transparent: true, opacity: 0.7
        });
        var wMesh = new THREE.Mesh(wGeo, wMat);
        wMesh.position.set(x, y, z);
        gemGroup.add(wMesh);
      }
    });

    // Floor grid
    var gridH = new THREE.GridHelper(axis, 10, 0xcccccc, 0xe0e0e0);
    gridH.position.set(axis / 2, 0, axis / 2);
    scene.add(gridH);

    // Solid axis lines for spatial reference
    var axMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 2 });
    var xaPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(axis, 0, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(xaPts), axMat));
    var yaPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axis, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(yaPts), axMat));
    var zaPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axis)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(zaPts), axMat));

    // Axis labels
    var xAL = makeTextSprite("Competition (log count)", { fontSize: 22, color: COLORS.dark, scale: 2.5 });
    xAL.position.set(axis / 2, -2.5, axis + 3); scene.add(xAL);
    var yAL = makeTextSprite("Avg Rating", { fontSize: 22, color: COLORS.dark, scale: 2.5 });
    yAL.position.set(-4, axis / 2, 0); scene.add(yAL);
    var zAL = makeTextSprite("Std Rating (Volatility)", { fontSize: 22, color: COLORS.dark, scale: 2.5 });
    zAL.position.set(axis + 4, -2.5, axis / 2); scene.add(zAL);

    // Rating tick marks
    [2.0, 2.5, 3.0, 3.5, 4.0, 4.5].forEach(function (r) {
      if (r >= minR && r <= maxR) {
        var tick = makeTextSprite(r.toFixed(1), { fontSize: 18, color: COLORS.muted, scale: 1.3 });
        tick.position.set(-2, ySc(r), -1); scene.add(tick);
      }
    });

    // Legend
    var legend = makeTextSprite("Gold wireframe = Hidden Gem", {
      fontSize: 20, color: COLORS.gold, backgroundColor: "rgba(26,20,16,0.7)", scale: 3
    });
    legend.position.set(axis / 2, axis + 3, axis / 2); scene.add(legend);

    camera.position.set(38, 28, 45);
    camera.lookAt(axis / 2, axis / 3, axis / 2);
    controls.target.set(axis / 2, axis / 3, axis / 2);
    controls.update();

    var tooltip = getOrCreateTooltip();
    var hSphere = null;

    function onHover(obj, event) {
      if (hSphere && hSphere !== obj) {
        hSphere.material.emissive.setHex(0x000000);
        hSphere.scale.set(1, 1, 1);
      }
      if (obj && obj.userData.cuisine) {
        obj.material.emissive.setHex(0x222222);
        obj.scale.set(1.2, 1.2, 1.2);
        hSphere = obj;
        var d = obj.userData;
        var gem = d.isGem ? '<span style="color:' + COLORS.gold + ';font-weight:bold;"> &#x2B50; Hidden Gem</span><br>' : "";
        tooltip.innerHTML =
          "<strong>" + d.cuisine + "</strong><br>" + gem +
          "Restaurants: " + d.count.toLocaleString() + "<br>" +
          "Avg Rating: " + d.avgRating.toFixed(2) + " &#9733;<br>" +
          "Std Rating: " + d.stdRating.toFixed(2) + "<br>" +
          "Median Reviews: " + d.medianReviews.toFixed(0) + "<br>" +
          "Weighted Rating: " + d.weightedRating.toFixed(2) + "<br>" +
          "Stability: " + d.stability.toFixed(2) + "<br>" +
          "Opportunity: " + d.opportunity.toFixed(2);
        tooltip.style.display = "block";
        var wp = new THREE.Vector3(); obj.getWorldPosition(wp); wp.y += 2;
        positionHTMLTooltip(tooltip, camera, renderer, wp);
      } else {
        if (hSphere) { hSphere.material.emissive.setHex(0x000000); hSphere.scale.set(1, 1, 1); hSphere = null; }
        tooltip.style.display = "none";
      }
    }

    var cancelFly = null;
    function onClick(obj) {
      if (!obj || !obj.userData.cuisine) return;
      if (cancelFly) cancelFly();
      var wp = new THREE.Vector3(); obj.getWorldPosition(wp);
      cancelFly = flyCamera(camera, controls,
        new THREE.Vector3(wp.x + 8, wp.y + 5, wp.z + 10), wp.clone(), 800);
    }

    var raycasting = setupRaycasting(scene, camera, canvas, spheres, onHover, onClick);
    var stopAnim = animateScene(renderer, scene, camera, controls);

    // Entrance animation: spheres scale up
    var animStart = performance.now(), animDur = 1000;
    spheres.forEach(function (s) { s.scale.set(0.01, 0.01, 0.01); });
    function growSpheres() {
      var t = Math.min((performance.now() - animStart) / animDur, 1);
      var sc = 0.01 + (1 - Math.pow(1 - t, 3)) * 0.99;
      spheres.forEach(function (s) { s.scale.set(sc, sc, sc); });
      if (t < 1) requestAnimationFrame(growSpheres);
    }
    requestAnimationFrame(growSpheres);

    return {
      resize: function () {
        var w = parent.clientWidth || 800, h = parent.clientHeight || 500;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      },
      dispose: function () {
        stopAnim(); raycasting.dispose(); disposeScene(scene); renderer.dispose();
        tooltip.style.display = "none"; if (cancelFly) cancelFly();
      }
    };
  }

  // ── Export ──────────────────────────────────────────────────
  window.ThreeCharts = {
    initCompetition: init3DCompetition,
    initScatter: init3DScatter,
    initOpportunity: init3DOpportunity
  };

})();
