(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PerfUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeText(value) {
    return String(value || "").toLowerCase();
  }

  function hasCoordinates(restaurant) {
    if (!restaurant || restaurant.lat === null || restaurant.lng === null) return false;
    if (restaurant.lat === "" || restaurant.lng === "") return false;
    return isFinite(Number(restaurant.lat)) && isFinite(Number(restaurant.lng));
  }

  function buildSearchText(restaurant) {
    var cuisines = Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(" ") : "";
    return normalizeText([
      restaurant.name,
      cuisines,
      restaurant.categories,
    ].join(" "));
  }

  function createRestaurantIndex(restaurants, isGemCuisine) {
    return (restaurants || []).filter(hasCoordinates).map(function (restaurant, index) {
      return {
        id: index,
        data: restaurant,
        isGem: !!isGemCuisine(restaurant),
        searchText: buildSearchText(restaurant),
      };
    });
  }

  function filterRestaurantIndex(indexedRestaurants, activeFilter, searchTerm) {
    var normalizedSearch = normalizeText(searchTerm).trim();

    return (indexedRestaurants || []).filter(function (entry) {
      var cuisines = Array.isArray(entry.data.cuisines) ? entry.data.cuisines : [];
      var passesFilter = true;
      var passesSearch = true;

      if (activeFilter === "Hidden Gems") {
        passesFilter = entry.isGem;
      } else if (activeFilter && activeFilter !== "All") {
        passesFilter = cuisines.indexOf(activeFilter) !== -1;
      }

      if (normalizedSearch) {
        passesSearch = entry.searchText.indexOf(normalizedSearch) !== -1;
      }

      return passesFilter && passesSearch;
    });
  }

  function observeOnceWhenVisible(element, callback, options, env) {
    var runtime = env || (typeof window !== "undefined" ? window : {});
    var Observer = runtime.IntersectionObserver;
    var fired = false;

    function runOnce() {
      if (fired) return;
      fired = true;
      callback();
    }

    if (!element || typeof callback !== "function") {
      return { disconnect: function () {} };
    }

    if (typeof Observer !== "function") {
      runOnce();
      return { disconnect: function () {} };
    }

    var observer = new Observer(function (entries) {
      entries.forEach(function (entry) {
        if (!fired && entry.isIntersecting) {
          runOnce();
          observer.disconnect();
        }
      });
    }, options || {});

    observer.observe(element);
    return observer;
  }

  function observeVisibilityToggle(element, callback, options, env) {
    var runtime = env || (typeof window !== "undefined" ? window : {});
    var Observer = runtime.IntersectionObserver;
    var lastState = null;

    function emit(nextState) {
      if (lastState === nextState) return;
      lastState = nextState;
      callback(nextState);
    }

    if (!element || typeof callback !== "function") {
      return { disconnect: function () {} };
    }

    if (typeof Observer !== "function") {
      emit(true);
      return { disconnect: function () {} };
    }

    var observer = new Observer(function (entries) {
      entries.forEach(function (entry) {
        emit(!!entry.isIntersecting);
      });
    }, options || {});

    observer.observe(element);
    return observer;
  }

  function buildJourneyRestartUrl(locationLike) {
    if (!locationLike) return "/";
    return String(locationLike.pathname || "/") + String(locationLike.search || "");
  }

  function queueJourneyRestart(runtime) {
    var env = runtime || (typeof window !== "undefined" ? window : {});
    var locationLike = env.location;
    var targetUrl = buildJourneyRestartUrl(locationLike);

    try {
      if (env.history && "scrollRestoration" in env.history) {
        env.history.scrollRestoration = "manual";
      }
    } catch (err) {}

    try {
      if (env.sessionStorage && typeof env.sessionStorage.setItem === "function") {
        env.sessionStorage.setItem("journeyRestartAtTop", "1");
      }
    } catch (err) {}

    if (!locationLike) return targetUrl;

    if (typeof locationLike.replace === "function") {
      locationLike.replace(targetUrl);
    } else if (typeof locationLike.assign === "function") {
      locationLike.assign(targetUrl);
    }

    return targetUrl;
  }

  function consumeJourneyRestart(runtime) {
    var env = runtime || (typeof window !== "undefined" ? window : {});
    var storage = env.sessionStorage;

    try {
      if (!storage || typeof storage.getItem !== "function") return false;
      if (storage.getItem("journeyRestartAtTop") !== "1") return false;
      if (typeof storage.removeItem === "function") {
        storage.removeItem("journeyRestartAtTop");
      }
    } catch (err) {
      return false;
    }

    if (typeof env.scrollTo === "function") {
      env.scrollTo(0, 0);
    }

    return true;
  }

  return {
    buildJourneyRestartUrl: buildJourneyRestartUrl,
    consumeJourneyRestart: consumeJourneyRestart,
    createRestaurantIndex: createRestaurantIndex,
    filterRestaurantIndex: filterRestaurantIndex,
    observeOnceWhenVisible: observeOnceWhenVisible,
    observeVisibilityToggle: observeVisibilityToggle,
    queueJourneyRestart: queueJourneyRestart,
  };
});
