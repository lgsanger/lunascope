(function () {
  var STAR_PATH =
    "M 12.000 1.000 L 14.687 9.313 L 20.200 12.000 L 14.687 14.687 L 12.000 23.000 L 9.313 14.687 L 3.800 12.000 L 9.313 9.313 Z";

  var EXCLUDE_PAD = 10;
  var TITLE_EXTRA_PAD = 8;
  var MAX_TRIES = 160;
  var NS = "http://www.w3.org/2000/svg";

  var routes = {
    "": "home",
    "/": "home",
    "/today": "today",
    "/calendar": "calendar",
    "/phases": "phases",
    "/reflection": "reflection",
    "/past": "past",
    "/void": "void",
  };

  function getRouteId() {
    var h = window.location.hash.slice(1);
    if (!h || h === "/") {
      return "home";
    }
    var path = h.charAt(0) === "/" ? h : "/" + h;
    return routes.hasOwnProperty(path) ? routes[path] : "home";
  }

  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.add("is-hidden");
    }
    var el = document.getElementById("screen-" + id);
    if (el) {
      el.classList.remove("is-hidden");
    }
    window.scrollTo(0, 0);
    document.title = id === "home" ? "LUNASCOPE" : "LUNASCOPE — " + id;
  }

  function onHashChange() {
    showScreen(getRouteId());
    scheduleStarfield();
  }

  window.addEventListener("hashchange", onHashChange);

  function rectRelative(el, container) {
    var er = el.getBoundingClientRect();
    var cr = container.getBoundingClientRect();
    return {
      left: er.left - cr.left,
      top: er.top - cr.top,
      right: er.right - cr.left,
      bottom: er.bottom - cr.top,
    };
  }

  function expandRect(r, pad) {
    return {
      left: r.left - pad,
      top: r.top - pad,
      right: r.right + pad,
      bottom: r.bottom + pad,
    };
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function getExcludeRects(starfield) {
    var rects = [];
    var pills = document.querySelectorAll(".home-nav .btn-pill");
    for (var i = 0; i < pills.length; i++) {
      var r = rectRelative(pills[i], starfield);
      if (r.right - r.left < 2 || r.bottom - r.top < 2) {
        continue;
      }
      rects.push(expandRect(r, EXCLUDE_PAD));
    }
    var titles = document.querySelectorAll(".brand-title");
    for (var j = 0; j < titles.length; j++) {
      var tr = rectRelative(titles[j], starfield);
      if (tr.right - tr.left < 2 || tr.bottom - tr.top < 2) {
        continue;
      }
      rects.push(expandRect(tr, EXCLUDE_PAD + TITLE_EXTRA_PAD));
    }
    return rects;
  }

  function starHitsExclude(cx, cy, half, excludeRects) {
    var star = {
      left: cx - half,
      top: cy - half,
      right: cx + half,
      bottom: cy + half,
    };
    for (var i = 0; i < excludeRects.length; i++) {
      if (rectsOverlap(star, excludeRects[i])) {
        return true;
      }
    }
    return false;
  }

  function placeStars(starfield) {
    var w = starfield.clientWidth;
    var h = starfield.clientHeight;
    if (w < 1 || h < 1) {
      return;
    }

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var targetCount = reduce ? 32 : 88;

    starfield.textContent = "";

    var excludeRects = getExcludeRects(starfield);
    var placed = 0;
    var tries = 0;

    while (placed < targetCount && tries < MAX_TRIES * targetCount) {
      tries += 1;
      var cx = Math.random() * w;
      var cy = Math.random() * h;
      var size = 8 + Math.random() * 18;
      var half = size * 0.6;
      if (starHitsExclude(cx, cy, half, excludeRects)) {
        continue;
      }

      var rotation = Math.random() * 360;
      var opacity = 0.18 + Math.random() * 0.35;

      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "starfield__star");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.style.left = cx + "px";
      svg.style.top = cy + "px";
      svg.style.opacity = String(opacity);
      svg.style.transform =
        "translate(-50%, -50%) rotate(" + rotation + "deg)";

      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", STAR_PATH);
      path.setAttribute("fill", "currentColor");
      svg.appendChild(path);

      starfield.appendChild(svg);
      placed += 1;
    }
  }

  var resizeTimer;

  function scheduleStarfield() {
    var starfield = document.getElementById("starfield");
    if (!starfield) {
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        placeStars(starfield);
      });
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleStarfield, 120);
  });

  onHashChange();
})();
