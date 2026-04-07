const test = require("node:test");
const assert = require("node:assert/strict");

const {
  observeOnceWhenVisible,
  observeVisibilityToggle,
  createRestaurantIndex,
  filterRestaurantIndex,
  buildJourneyRestartUrl,
  queueJourneyRestart,
  consumeJourneyRestart,
} = require("../prototype/js/perf-utils.js");

test("observeOnceWhenVisible waits for visibility and only runs once", () => {
  const element = { id: "section-map" };
  const events = [];
  let observed = null;
  let disconnected = 0;
  let trigger = null;

  function MockIntersectionObserver(callback, options) {
    events.push({ type: "construct", options });
    trigger = callback;
    this.observe = function (target) {
      observed = target;
      events.push({ type: "observe", target });
    };
    this.disconnect = function () {
      disconnected += 1;
      events.push({ type: "disconnect" });
    };
  }

  let runs = 0;
  observeOnceWhenVisible(
    element,
    function () {
      runs += 1;
      events.push({ type: "run" });
    },
    { threshold: 0.25, rootMargin: "200px 0px" },
    { IntersectionObserver: MockIntersectionObserver }
  );

  assert.equal(runs, 0);
  assert.equal(observed, element);

  trigger([{ isIntersecting: false, target: element }]);
  assert.equal(runs, 0);
  assert.equal(disconnected, 0);

  trigger([{ isIntersecting: true, target: element }]);
  trigger([{ isIntersecting: true, target: element }]);

  assert.equal(runs, 1);
  assert.equal(disconnected, 1);
  assert.deepEqual(
    events.map(function (event) {
      return event.type;
    }),
    ["construct", "observe", "run", "disconnect"]
  );
});

test("observeOnceWhenVisible falls back to immediate execution without observer support", () => {
  let runs = 0;

  observeOnceWhenVisible(
    { id: "section-terrain" },
    function () {
      runs += 1;
    },
    {},
    {}
  );

  assert.equal(runs, 1);
});

test("observeVisibilityToggle reports visibility changes and ignores duplicate states", () => {
  const element = { id: "section-restaurant" };
  const seen = [];
  let observed = null;
  let trigger = null;

  function MockIntersectionObserver(callback) {
    trigger = callback;
    this.observe = function (target) {
      observed = target;
    };
    this.disconnect = function () {};
  }

  observeVisibilityToggle(
    element,
    function (isVisible) {
      seen.push(isVisible);
    },
    { threshold: 0.2 },
    { IntersectionObserver: MockIntersectionObserver }
  );

  assert.equal(observed, element);

  trigger([{ isIntersecting: false, target: element }]);
  trigger([{ isIntersecting: false, target: element }]);
  trigger([{ isIntersecting: true, target: element }]);
  trigger([{ isIntersecting: true, target: element }]);
  trigger([{ isIntersecting: false, target: element }]);

  assert.deepEqual(seen, [false, true, false]);
});

test("observeVisibilityToggle falls back to visible when observer support is unavailable", () => {
  const seen = [];

  observeVisibilityToggle(
    { id: "section-opportunity" },
    function (isVisible) {
      seen.push(isVisible);
    },
    {},
    {}
  );

  assert.deepEqual(seen, [true]);
});

test("createRestaurantIndex precomputes gem state and lowercase search text", () => {
  const indexed = createRestaurantIndex(
    [
      {
        name: "Hardena",
        cuisines: ["Indonesian"],
        categories: "Restaurants, Indonesian",
        lat: 39.94,
        lng: -75.16,
      },
      {
        name: "No Coordinates",
        cuisines: ["Pizza"],
        categories: "Restaurants, Pizza",
        lat: null,
        lng: -75.1,
      },
    ],
    function (restaurant) {
      return restaurant.cuisines.indexOf("Indonesian") >= 0;
    }
  );

  assert.equal(indexed.length, 1);
  assert.equal(indexed[0].isGem, true);
  assert.match(indexed[0].searchText, /hardena/);
  assert.match(indexed[0].searchText, /indonesian/);
});

test("filterRestaurantIndex applies cuisine filters and search without mutating source data", () => {
  const indexed = createRestaurantIndex(
    [
      {
        name: "Hardena",
        cuisines: ["Indonesian"],
        categories: "Restaurants, Indonesian",
        lat: 39.94,
        lng: -75.16,
      },
      {
        name: "Terakawa Ramen",
        cuisines: ["Ramen", "Japanese"],
        categories: "Restaurants, Ramen",
        lat: 39.95,
        lng: -75.17,
      },
      {
        name: "Neighborhood Pizza",
        cuisines: ["Pizza"],
        categories: "Restaurants, Pizza",
        lat: 39.93,
        lng: -75.15,
      },
    ],
    function (restaurant) {
      return restaurant.cuisines.indexOf("Indonesian") >= 0;
    }
  );

  const gemsOnly = filterRestaurantIndex(indexed, "Hidden Gems", "");
  const cuisineMatch = filterRestaurantIndex(indexed, "Ramen", "");
  const searchMatch = filterRestaurantIndex(indexed, "All", "pizza");

  assert.deepEqual(
    gemsOnly.map(function (entry) { return entry.data.name; }),
    ["Hardena"]
  );
  assert.deepEqual(
    cuisineMatch.map(function (entry) { return entry.data.name; }),
    ["Terakawa Ramen"]
  );
  assert.deepEqual(
    searchMatch.map(function (entry) { return entry.data.name; }),
    ["Neighborhood Pizza"]
  );
  assert.equal(indexed.length, 3);
});

test("buildJourneyRestartUrl strips the hash and keeps the current page path", () => {
  assert.equal(
    buildJourneyRestartUrl({
      pathname: "/CSC316/",
      search: "?view=full",
      hash: "#cta",
    }),
    "/CSC316/?view=full"
  );
});

test("queueJourneyRestart flags a top-of-page reset and navigates to the clean URL", () => {
  var assignedUrl = null;
  var stored = {};
  var runtime = {
    location: {
      pathname: "/prototype/",
      search: "",
      hash: "#cta",
      assign: function (nextUrl) {
        assignedUrl = nextUrl;
      },
    },
    history: {
      scrollRestoration: "auto",
    },
    sessionStorage: {
      setItem: function (key, value) {
        stored[key] = value;
      },
      getItem: function (key) {
        return stored[key] || null;
      },
      removeItem: function (key) {
        delete stored[key];
      },
    },
  };

  queueJourneyRestart(runtime);

  assert.equal(runtime.history.scrollRestoration, "manual");
  assert.equal(stored.journeyRestartAtTop, "1");
  assert.equal(assignedUrl, "/prototype/");
});

test("consumeJourneyRestart clears the flag and scrolls to the top once", () => {
  var scrollCalls = [];
  var stored = { journeyRestartAtTop: "1" };
  var runtime = {
    sessionStorage: {
      getItem: function (key) {
        return stored[key] || null;
      },
      removeItem: function (key) {
        delete stored[key];
      },
    },
    scrollTo: function (x, y) {
      scrollCalls.push([x, y]);
    },
  };

  assert.equal(consumeJourneyRestart(runtime), true);
  assert.deepEqual(scrollCalls, [[0, 0]]);
  assert.equal(stored.journeyRestartAtTop, undefined);
  assert.equal(consumeJourneyRestart(runtime), false);
});
