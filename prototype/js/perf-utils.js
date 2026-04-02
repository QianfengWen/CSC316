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

  return {
    createRestaurantIndex: createRestaurantIndex,
    filterRestaurantIndex: filterRestaurantIndex,
    observeOnceWhenVisible: observeOnceWhenVisible,
    observeVisibilityToggle: observeVisibilityToggle,
  };
});
