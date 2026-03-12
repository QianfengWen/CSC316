(function () {
  "use strict";

  var CATEGORY_COLORS = {
    "Pizza": "#e8a838",       // Yellow
    "Vegan": "#3a8c5c",       // Green
    "Italian": "#2a8a8a",     // Teal/Blue
    "Sandwiches": "#d4503a",  // Red
    "Burgers": "#d4503a",
    "Chinese": "#c44d6e",
    "Mexican": "#e85c4a",
    "Japanese": "#5a9fd4",
    "Thai": "#7b5ea7",
    "Other": "#dddddd"
  };

  function getBounds(restaurants) {
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    restaurants.forEach(function (r) {
      var lat = Number(r.lat), lng = Number(r.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
    return { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng };
  }

  function createState(opts) {
    var canvas = document.getElementById(opts.canvasId);
    var select = document.getElementById(opts.selectId);
    var resetBtn = document.getElementById(opts.resetBtnId);
    var tooltip = document.getElementById(opts.tooltipId);
    if (!canvas) return null;

    var parent = canvas.parentElement;
    var width = parent.clientWidth || 900;
    var height = parent.clientHeight || 500;
    var aspect = width / height;

    //init Three.js scene
    var scene = new THREE.Scene();
    scene.background = new THREE.Color('#faf6f0');

    var d = 60;
    var camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(100, 80, 100);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    camera.lookAt(scene.position);
    controls.target.copy(scene.position);

    //lighting
    var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xeaddcf, 0.5);
    scene.add(hemisphereLight);

    var dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      controls: controls,
      canvas: canvas,
      select: select,
      resetBtn: resetBtn,
      tooltip: tooltip,
      restaurants: opts.restaurants,
      cuisineSummary: opts.cuisines || [],
      terrainMesh: null,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      grid: null,
      SEGMENTS: 64,
      geoSize: 100,
      handlers: {}
    };
  }

  function rebuildTerrain(state, targetCuisine) {
    if (state.terrainMesh) {
      state.scene.remove(state.terrainMesh);
      state.terrainMesh.geometry.dispose();
      state.terrainMesh.material.dispose();
      state.terrainMesh = null;
    }

    var bounds = getBounds(state.restaurants);
    var SEGMENTS = state.SEGMENTS;

    // Initialize raw grid
    var grid = [];
    for (var i = 0; i < SEGMENTS; i++) {
      var row = [];
      for (var j = 0; j < SEGMENTS; j++) {
        row.push({ count: 0, sumStars: 0, cuisines: {} });
      }
      grid.push(row);
    }

    // Populate grid
    state.restaurants.forEach(function (d) {
      if (!isFinite(d.lat) || !isFinite(d.lng)) return;

      // Filter by cuisine if a specific one is selected
      if (targetCuisine !== "All" && (!d.cuisines || d.cuisines.indexOf(targetCuisine) === -1)) {
        return;
      }

      var nx = (d.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1);
      var ny = (d.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1);
      var xIdx = Math.floor(nx * (SEGMENTS - 1));
      var zIdx = Math.floor((1 - ny) * (SEGMENTS - 1)); // Invert Y so North is -Z

      if (xIdx >= 0 && xIdx < SEGMENTS && zIdx >= 0 && zIdx < SEGMENTS) {
        grid[xIdx][zIdx].count += 1;
        grid[xIdx][zIdx].sumStars += d.stars || 0;
        var c = (d.cuisines && d.cuisines.length > 0) ? d.cuisines[0] : 'Other';
        grid[xIdx][zIdx].cuisines[c] = (grid[xIdx][zIdx].cuisines[c] || 0) + 1;
      }
    });

    // Gaussian smoothing
    var tempGrid = [];
    for (var r = 0; r < SEGMENTS; r++) {
      var sRow = [];
      for (var c = 0; c < SEGMENTS; c++) {
        sRow.push({ count: 0, sumStars: 0, dominantCuisine: 'Other' });
      }
      tempGrid.push(sRow);
    }

    var kernel = [
      [1/16, 2/16, 1/16],
      [2/16, 4/16, 2/16],
      [1/16, 2/16, 1/16]
    ];

    // first pass of smoothing and determining dominant cuisine
    for (var x = 1; x < SEGMENTS - 1; x++) {
      for (var z = 1; z < SEGMENTS - 1; z++) {
        var sCount = 0, sStars = 0;
        for (var kx = -1; kx <= 1; kx++) {
          for (var kz = -1; kz <= 1; kz++) {
            var weight = kernel[kx + 1][kz + 1];
            sCount += grid[x + kx][z + kz].count * weight;
            sStars += grid[x + kx][z + kz].sumStars * weight;
          }
        }
        tempGrid[x][z].count = sCount;
        tempGrid[x][z].sumStars = sStars;
        
        var rawCell = grid[x][z];
        var dom = 'Other';
        var maxC = 0;
        for (var key in rawCell.cuisines) {
          if (rawCell.cuisines[key] > maxC) {
            maxC = rawCell.cuisines[key];
            dom = key;
          }
        }
        tempGrid[x][z].dominantCuisine = dom;
      }
    }

    // second pass to create final smoothed grid and find max density for color scaling
    var smoothGrid = [];
    for (var r = 0; r < SEGMENTS; r++) {
      var sRow = [];
      for (var c = 0; c < SEGMENTS; c++) {
        sRow.push({ count: 0, sumStars: 0, dominantCuisine: tempGrid[r][c].dominantCuisine });
      }
      smoothGrid.push(sRow);
    }

    var maxDensity = 0;

    for (var x = 1; x < SEGMENTS - 1; x++) {
      for (var z = 1; z < SEGMENTS - 1; z++) {
        var sCount = 0, sStars = 0;
        for (var kx = -1; kx <= 1; kx++) {
          for (var kz = -1; kz <= 1; kz++) {
            var weight = kernel[kx + 1][kz + 1];
            sCount += tempGrid[x + kx][z + kz].count * weight;
            sStars += tempGrid[x + kx][z + kz].sumStars * weight;
          }
        }
        smoothGrid[x][z].count = sCount;
        smoothGrid[x][z].sumStars = sStars;
        
        if (sCount > maxDensity) maxDensity = sCount;
      }
    }

    state.grid = smoothGrid;
    state.maxDensity = maxDensity;

    // Create geometry and colors
    var geometry = new THREE.PlaneGeometry(state.geoSize, state.geoSize, SEGMENTS - 1, SEGMENTS - 1);
    geometry.rotateX(-Math.PI / 2);

    var positions = geometry.attributes.position.array;
    var colors = [];
    var colorAttribute = new THREE.Color();
    var heightMultiplier = 4.8; // Height scaling factor for better visual differentiation, can be adjusted based on maxDensity

    for (var i = 0; i < positions.length / 3; i++) {
      var xIndex = i % SEGMENTS;
      var zIndex = Math.floor(i / SEGMENTS);
      var cell = smoothGrid[xIndex][zIndex];

      var avgStars = cell.count > 0.05 ? (cell.sumStars / cell.count) : 0;
      var yHeight = 0;
      if (cell.count > 0.05) {
        yHeight = avgStars * heightMultiplier * Math.log1p(cell.count / 1.5);
      }
      positions[i * 3 + 1] = yHeight;

      var domCuisine = targetCuisine !== "All" ? targetCuisine : cell.dominantCuisine;
      var baseHex = CATEGORY_COLORS[domCuisine] || CATEGORY_COLORS["Other"];
      colorAttribute.set(baseHex);

      if (cell.count < 0.05) {
        colorAttribute.set('#eaddcf');
      } else {
        var densityRatio = Math.min(cell.count / (maxDensity * 0.4 || 1), 1.0);
        
        // Color Variation based on height and density
        var hsl = {};
        colorAttribute.getHSL(hsl);
        
        // Height-based lightness boost, capped to prevent oversaturation
        var heightBoost = Math.min(yHeight / 15, 1.0);
        hsl.l = Math.max(0.2, Math.min(0.9, hsl.l + heightBoost * 0.2 - (1 - densityRatio) * 0.25));
        hsl.s = Math.max(0, Math.min(1.0, hsl.s + heightBoost * 0.15));
        
        var noise = Math.sin(xIndex * 0.3) * Math.cos(zIndex * 0.3) * 0.03;
        hsl.h = (hsl.h + noise + 1.0) % 1.0;
        
        colorAttribute.setHSL(hsl.h, hsl.s, hsl.l);

        if (densityRatio < 0.3) {
          colorAttribute.lerp(new THREE.Color('#faf6f0'), 1 - (densityRatio / 0.3));
        }
      }
      colors.push(colorAttribute.r, colorAttribute.g, colorAttribute.b);
    }

    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    var material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.1
    });

    var terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    state.scene.add(terrainMesh);
    state.terrainMesh = terrainMesh;
  }

  function populateCuisineOptions(state) {
    if (!state.select) return;
    state.select.innerHTML = "";
    
    var optAll = document.createElement("option");
    optAll.value = "All";
    optAll.textContent = "All Cuisines Overview";
    state.select.appendChild(optAll);

    var cuisines = state.cuisineSummary
      .slice()
      .sort(function (a, b) { return b.count - a.count; })
      .map(function (d) { return d.cuisine; })
      .filter(function (c, i, arr) { return c && arr.indexOf(c) === i; });

    var preferred = ["Burgers", "Thai", "Italian", "Pizza", "Vegan", "Chinese", "Mexican"];
    preferred.forEach(function (name) {
      if (cuisines.indexOf(name) === -1) cuisines.unshift(name);
    });

    cuisines.slice(0, 20).forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      state.select.appendChild(opt);
    });
  }

  function bindInteractions(state) {
    function onPointerMove(evt) {
      if (!state.terrainMesh || !state.grid) return;
      var rect = state.canvas.getBoundingClientRect();
      state.mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      state.mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      
      state.raycaster.setFromCamera(state.mouse, state.camera);
      var hits = state.raycaster.intersectObject(state.terrainMesh);

      if (hits.length > 0) {
        var hit = hits[0];
        var nx = (hit.point.x + state.geoSize / 2) / state.geoSize;
        var nz = (hit.point.z + state.geoSize / 2) / state.geoSize;
        var xIndex = Math.floor(nx * state.SEGMENTS);
        var zIndex = Math.floor(nz * state.SEGMENTS);
        
        xIndex = Math.max(0, Math.min(state.SEGMENTS - 1, xIndex));
        zIndex = Math.max(0, Math.min(state.SEGMENTS - 1, zIndex));

        var cell = state.grid[xIndex][zIndex];
        if (cell.count > 0.1) {
          var avgStars = cell.sumStars / cell.count;
          var displayCuisine = state.select.value === "All" ? cell.dominantCuisine : state.select.value;
          var html = "<strong>" + displayCuisine + " Area</strong><br>" +
            "<span style='color:#f0c040'>Density Score:</span> " + cell.count.toFixed(1) + "<br>" +
            "<span style='color:#f0c040'>Avg Rating:</span> " + avgStars.toFixed(2);
          
          state.tooltip.innerHTML = html;
          state.tooltip.style.display = "block";
          state.tooltip.classList.add("visible");
          state.tooltip.style.left = (evt.clientX - rect.left + 14) + "px";
          state.tooltip.style.top = (evt.clientY - rect.top - 16) + "px";
          return;
        }
      }
      
      state.tooltip.classList.remove("visible");
      state.tooltip.style.display = "none";
    }

    state.canvas.addEventListener("mousemove", onPointerMove);
    state.canvas.addEventListener("mouseleave", function () {
      state.tooltip.classList.remove("visible");
      state.tooltip.style.display = "none";
    });
    state.handlers.pointerMove = onPointerMove;

    if (state.resetBtn) {
      state.resetBtn.addEventListener("click", function () {
        state.camera.position.set(100, 80, 100);
        state.controls.target.set(0, 0, 0);
        state.controls.update();
      });
    }

    if (state.select) {
      state.select.addEventListener("change", function () {
        rebuildTerrain(state, state.select.value);
      });
    }
  }

  function startLoop(state) {
    function frame() {
      state.controls.update();
      state.renderer.render(state.scene, state.camera);
      state._anim = requestAnimationFrame(frame);
    }
    frame();
  }

  function setupResize(state) {
    function onResize() {
      var parent = state.canvas.parentElement;
      var width = parent.clientWidth || 900;
      var height = parent.clientHeight || 500;
      var aspect = width / height;
      var d = 60;
      state.camera.left = -d * aspect;
      state.camera.right = d * aspect;
      state.camera.top = d;
      state.camera.bottom = -d;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(width, height);
    }
    window.addEventListener("resize", onResize);
    state.handlers.resize = onResize;
  }

  function init(opts) {
    if (!opts || !opts.restaurants || !opts.restaurants.length) return null;
    if (typeof THREE === "undefined") return null;

    var state = createState(opts);
    if (!state) return null;

    populateCuisineOptions(state);
    bindInteractions(state);
    setupResize(state);

    rebuildTerrain(state, state.select.value);
    startLoop(state);

    return state;
  }

  window.CuisineTerrain = {
    init: init
  };
})();