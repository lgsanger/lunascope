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

  function ordinalDay(n) {
    var j = n % 10;
    var k = n % 100;
    if (k >= 11 && k <= 13) {
      return n + "th";
    }
    if (j === 1) {
      return n + "st";
    }
    if (j === 2) {
      return n + "nd";
    }
    if (j === 3) {
      return n + "rd";
    }
    return n + "th";
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /* Moon illumination — formulas from SunCalc (MIT, github.com/mourner/suncalc) */
  var moonDayMs = 1000 * 60 * 60 * 24;
  var J1970 = 2440588;
  var J2000 = 2451545;
  var oblE = (Math.PI / 180) * 23.4397;

  function toJulian(date) {
    return date.valueOf() / moonDayMs - 0.5 + J1970;
  }
  function toDays(date) {
    return toJulian(date) - J2000;
  }
  function rightAscension(l, b) {
    return Math.atan2(
      Math.sin(l) * Math.cos(oblE) - Math.tan(b) * Math.sin(oblE),
      Math.cos(l)
    );
  }
  function declination(l, b) {
    return Math.asin(
      Math.sin(b) * Math.cos(oblE) + Math.cos(b) * Math.sin(oblE) * Math.sin(l)
    );
  }
  function sunCoords(d) {
    var M = (Math.PI / 180) * (357.5291 + 0.98560028 * d);
    var C =
      (Math.PI / 180) *
      (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var P = (Math.PI / 180) * 102.9372;
    var L = M + C + P + Math.PI;
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
  }
  function moonCoords(d) {
    var L = (Math.PI / 180) * (218.316 + 13.176396 * d);
    var M = (Math.PI / 180) * (134.963 + 13.064993 * d);
    var F = (Math.PI / 180) * (93.272 + 13.22935 * d);
    var l = L + (Math.PI / 180) * 6.289 * Math.sin(M);
    var b = (Math.PI / 180) * 5.128 * Math.sin(F);
    var dt = 385001 - 20905 * Math.cos(M);
    return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
  }
  var earthSunKm = 149598000;
  function getMoonIllumination(date) {
    var d = toDays(date || new Date());
    var s = sunCoords(d);
    var m = moonCoords(d);
    var phi = Math.acos(
      Math.sin(s.dec) * Math.sin(m.dec) +
        Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
    );
    var inc = Math.atan2(
      earthSunKm * Math.sin(phi),
      m.dist - earthSunKm * Math.cos(phi)
    );
    var angle = Math.atan2(
      Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) -
        Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
    );
    return {
      fraction: (1 + Math.cos(inc)) / 2,
      phase:
        0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI,
      angle: angle,
    };
  }

  var MOON_LIT = "#b5a7c4";
  var MOON_SHADOW = "#6d6282";
  var MOON_CRATER = "#9487a2";

  var moonDrawState = { key: null, boxW: -1 };

  function moonPhaseLabel(phase) {
    var p = phase - Math.floor(phase);
    if (p < 0.03 || p > 0.97) {
      return "NEW MOON";
    }
    if (p < 0.22) {
      return "WAXING CRESCENT";
    }
    if (p < 0.28) {
      return "FIRST QUARTER";
    }
    if (p < 0.47) {
      return "WAXING GIBBOUS";
    }
    if (p < 0.53) {
      return "FULL MOON";
    }
    if (p < 0.72) {
      return "WANING GIBBOUS";
    }
    if (p < 0.78) {
      return "LAST QUARTER";
    }
    return "WANING CRESCENT";
  }

  function layoutTodayMoonCanvas(canvas) {
    var wrap = canvas.closest(".today-moon__image");
    if (!wrap) {
      return;
    }
    var rect = wrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var side = Math.max(2, Math.floor(rect.width * dpr));
    canvas.width = side;
    canvas.height = side;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.width + "px";
  }

  function drawMoonCraters(ctx, cx, cy, r) {
    ctx.fillStyle = MOON_CRATER;
    var spots = [
      { dx: 0.34, dy: -0.32, rr: 0.14 },
      { dx: -0.2, dy: 0.06, rr: 0.08 },
      { dx: -0.22, dy: 0.34, rr: 0.07 },
      { dx: 0.02, dy: 0.02, rr: 0.025 },
      { dx: 0.08, dy: 0.08, rr: 0.02 },
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      ctx.beginPath();
      ctx.arc(cx + s.dx * r, cy + s.dy * r, s.rr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTodayMoonCanvas(canvas, ill) {
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    var w = canvas.width;
    var h = canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var r = Math.min(w, h) * 0.48;
    var k = ill.fraction;
    var waxing = ill.phase < 0.5;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ill.angle);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = MOON_SHADOW;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.fillStyle = MOON_LIT;
    var xt;
    if (waxing) {
      xt = cx + (1 - 2 * k) * r;
      var rw = cx + r - xt;
      if (rw > 0) {
        ctx.fillRect(xt, cy - r, rw, 2 * r);
      }
    } else {
      xt = cx + (2 * k - 1) * r;
      var rw2 = xt - (cx - r);
      if (rw2 > 0) {
        ctx.fillRect(cx - r, cy - r, rw2, 2 * r);
      }
    }
    ctx.globalAlpha = 0.5;
    drawMoonCraters(ctx, cx, cy, r);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  var phaseIlluminationCache = {};

  function illuminationForPhaseLabel(wantLabel) {
    if (phaseIlluminationCache[wantLabel]) {
      return phaseIlluminationCache[wantLabel];
    }
    var t0 = new Date(2025, 0, 1).getTime();
    var t1 = new Date(2028, 0, 1).getTime();
    var step = 3 * 3600000;
    for (var t = t0; t < t1; t += step) {
      var d = new Date(t);
      var ill = getMoonIllumination(d);
      if (moonPhaseLabel(ill.phase) === wantLabel) {
        phaseIlluminationCache[wantLabel] = ill;
        return ill;
      }
    }
    var fb = getMoonIllumination(new Date());
    phaseIlluminationCache[wantLabel] = fb;
    return fb;
  }

  function layoutPhaseCanvas(canvas) {
    var wrap = canvas.closest(".phase-item__inner");
    if (!wrap) {
      return;
    }
    var rect = wrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var side = Math.max(2, Math.floor(rect.width * dpr));
    canvas.width = side;
    canvas.height = side;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.width + "px";
  }

  function initPhaseIllustrations() {
    var root = document.getElementById("screen-phases");
    if (!root || root.classList.contains("is-hidden")) {
      return;
    }
    var canvases = root.querySelectorAll(".phase-item__canvas");
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      var lbl = c.getAttribute("data-phase-label");
      if (!lbl) {
        continue;
      }
      var ill = illuminationForPhaseLabel(lbl);
      layoutPhaseCanvas(c);
      drawTodayMoonCanvas(c, ill);
    }
  }

  function maybeUpdateTodayMoon() {
    var canvas = document.getElementById("today-moon-canvas");
    if (!canvas) {
      return;
    }
    var wrap = canvas.closest(".today-moon__image");
    if (!wrap) {
      return;
    }
    var bw = wrap.getBoundingClientRect().width;
    var now = new Date();
    var key =
      now.getFullYear() +
      "-" +
      now.getMonth() +
      "-" +
      now.getDate() +
      "-" +
      now.getHours() +
      "-" +
      now.getMinutes();
    if (moonDrawState.key === key && Math.abs(bw - moonDrawState.boxW) < 0.5) {
      return;
    }
    moonDrawState.key = key;
    moonDrawState.boxW = bw;
    layoutTodayMoonCanvas(canvas);
    var ill = getMoonIllumination(now);
    drawTodayMoonCanvas(canvas, ill);
    var label = document.getElementById("today-phase-label");
    if (label) {
      label.textContent = moonPhaseLabel(ill.phase);
    }
  }

  function updateRealTimeDisplays() {
    var now = new Date();
    var line1 = document.getElementById("today-date-line1");
    var line2 = document.getElementById("today-date-line2");
    var timeEl = document.getElementById("today-time");
    if (line1 && line2) {
      var weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      var months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      var w = weekdays[now.getDay()];
      var mon = months[now.getMonth()];
      line1.textContent = w + ", " + mon + " " + ordinalDay(now.getDate());
      line2.textContent = String(now.getFullYear());
    }
    if (timeEl) {
      var h = now.getHours();
      var h12 = h % 12;
      if (h12 === 0) {
        h12 = 12;
      }
      var ampm = h >= 12 ? "PM" : "AM";
      timeEl.textContent =
        pad2(h12) +
        ":" +
        pad2(now.getMinutes()) +
        ":" +
        pad2(now.getSeconds()) +
        " " +
        ampm;
    }
    var calHeading = document.getElementById("calendar-year-heading");
    if (calHeading) {
      calHeading.textContent = now.getFullYear() + " Full Moons";
    }
    maybeUpdateTodayMoon();
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
    moonDrawState.key = null;
    updateRealTimeDisplays();
    notifyScheduleRefresh();
    initPhaseIllustrations();
  }

  window.addEventListener("hashchange", onHashChange);

  setInterval(updateRealTimeDisplays, 1000);

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

  function pushExcludeSelector(rects, starfield, selector, extraPad) {
    extraPad = extraPad || 0;
    var els = document.querySelectorAll(selector);
    for (var k = 0; k < els.length; k++) {
      var r = rectRelative(els[k], starfield);
      if (r.right - r.left < 2 || r.bottom - r.top < 2) {
        continue;
      }
      rects.push(expandRect(r, EXCLUDE_PAD + extraPad));
    }
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
    /* Keep sparkles out from behind typography and controls (all routes) */
    var textUiSelectors = [
      ".btn-back",
      ".screen-subtitle",
      ".screen-hint",
      ".calendar-notify",
      ".calendar-notify__status",
      ".calendar-item__moon",
      ".wireframe-note",
      ".phase-item__moon",
      ".reflection-card",
      ".void-card",
      ".card",
      ".today-moon__stage",
      ".journal-field",
    ];
    for (var s = 0; s < textUiSelectors.length; s++) {
      pushExcludeSelector(rects, starfield, textUiSelectors[s], 6);
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
    resizeTimer = setTimeout(function () {
      scheduleStarfield();
      moonDrawState.key = null;
      maybeUpdateTodayMoon();
      initPhaseIllustrations();
    }, 120);
  });

  /* Full moon reminders — Notification API + localStorage (SunCalc-style illumination peak) */
  var NOTIFY_STORAGE_KEY = "lunascope.fullMoonNotify.v1";
  /* 1-day chunks: long delays exceed typical setTimeout max (~24.85 days) */
  var NOTIFY_CHUNK_MS = 24 * 60 * 60 * 1000;
  var moonNotifyTimerId = null;

  function loadNotifyState() {
    try {
      var raw = localStorage.getItem(NOTIFY_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || !s.leadDays || !s.fullMoonAt || !s.reminderAt) {
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function saveNotifyState(state) {
    try {
      localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function formatFullMoonLine(d) {
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return (
      months[d.getMonth()] +
      " " +
      ordinalDay(d.getDate()) +
      ", " +
      d.getFullYear()
    );
  }

  function findNextFullMoonPeakAfter(fromDate) {
    var stepMs = 15 * 60 * 1000;
    var t = fromDate.getTime() + stepMs;
    var limit = fromDate.getTime() + 58 * moonDayMs;
    while (t < limit) {
      var f0 = getMoonIllumination(new Date(t - stepMs)).fraction;
      var f1 = getMoonIllumination(new Date(t)).fraction;
      var f2 = getMoonIllumination(new Date(t + stepMs)).fraction;
      if (f1 >= f0 && f1 >= f2 && f1 > 0.992) {
        return new Date(t);
      }
      t += stepMs;
    }
    return null;
  }

  function ensureFutureSchedule() {
    var state = loadNotifyState();
    if (!state) {
      return;
    }
    var fm = new Date(state.fullMoonAt).getTime();
    if (Date.now() < fm) {
      return;
    }
    var next = findNextFullMoonPeakAfter(new Date(fm + 2 * 3600000));
    if (!next) {
      return;
    }
    state.fullMoonAt = next.toISOString();
    state.reminderAt = new Date(
      next.getTime() - state.leadDays * moonDayMs
    ).toISOString();
    state.firedForFullMoon = null;
    saveNotifyState(state);
  }

  function clearMoonNotifyTimer() {
    if (moonNotifyTimerId !== null) {
      clearTimeout(moonNotifyTimerId);
      moonNotifyTimerId = null;
    }
  }

  function scheduleMoonNotifyTimer() {
    clearMoonNotifyTimer();
    var state = loadNotifyState();
    if (!state || Notification.permission !== "granted") {
      return;
    }
    ensureFutureSchedule();
    state = loadNotifyState();
    if (!state) {
      return;
    }
    var reminderAt = new Date(state.reminderAt).getTime();
    var now = Date.now();
    var delay = reminderAt - now;
    var chunk;
    if (delay <= 0) {
      fireFullMoonReminderIfDue();
      ensureFutureSchedule();
      chunk = NOTIFY_CHUNK_MS;
    } else {
      chunk = Math.min(delay, NOTIFY_CHUNK_MS);
    }
    moonNotifyTimerId = setTimeout(function () {
      moonNotifyTimerId = null;
      fireFullMoonReminderIfDue();
      scheduleMoonNotifyTimer();
    }, chunk);
  }

  function fireFullMoonReminderIfDue() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    ensureFutureSchedule();
    var state = loadNotifyState();
    if (!state) {
      return;
    }
    var reminderAt = new Date(state.reminderAt).getTime();
    var fullMoonAt = new Date(state.fullMoonAt).getTime();
    var now = Date.now();
    if (now < reminderAt) {
      return;
    }
    if (now >= fullMoonAt) {
      return;
    }
    if (state.firedForFullMoon === state.fullMoonAt) {
      return;
    }
    var when = new Date(state.fullMoonAt);
    try {
      new Notification("LUNASCOPE", {
        body:
          "Full moon on " +
          formatFullMoonLine(when) +
          ". You asked for a heads-up " +
          state.leadDays +
          " day" +
          (state.leadDays === 1 ? "" : "s") +
          " before.",
        tag: "lunascope-fullmoon",
        renotify: true,
      });
    } catch (e) {}
    state.firedForFullMoon = state.fullMoonAt;
    saveNotifyState(state);
  }

  function setNotifyStatusEl(el, message) {
    if (!el) {
      return;
    }
    el.textContent = message || "";
  }

  function refreshNotifyUi(root, statusEl) {
    var state = loadNotifyState();
    if (!statusEl) {
      return;
    }
    if (!state) {
      setNotifyStatusEl(statusEl, "");
      return;
    }
    var fm = new Date(state.fullMoonAt);
    var line =
      "Reminders on: " +
      state.leadDays +
      " day" +
      (state.leadDays === 1 ? "" : "s") +
      " before the full moon (next around " +
      formatFullMoonLine(fm) +
      ").";
    if (Notification.permission === "denied") {
      line =
        "Notifications are blocked. Enable them for this site in your browser settings to receive reminders.";
    }
    setNotifyStatusEl(statusEl, line);
  }

  function notifyScheduleRefresh() {
    ensureFutureSchedule();
    fireFullMoonReminderIfDue();
    scheduleMoonNotifyTimer();
    var root = document.querySelector("[data-calendar-notify]");
    var statusEl = document.getElementById("calendar-notify-status");
    refreshNotifyUi(root, statusEl);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      updateRealTimeDisplays();
      notifyScheduleRefresh();
    }
  });

  function initCalendarNotify() {
    var root = document.querySelector("[data-calendar-notify]");
    if (!root) {
      return;
    }
    var btn = root.querySelector(".calendar-notify__toggle");
    var panel = root.querySelector(".calendar-notify__panel");
    if (!btn || !panel) {
      return;
    }

    function setOpen(open) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
      if (open) {
        root.classList.add("calendar-notify--open");
      } else {
        root.classList.remove("calendar-notify--open");
      }
      scheduleStarfield();
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });

    var statusEl = document.getElementById("calendar-notify-status");

    function requestNotificationPermissionThen(cb) {
      if (!("Notification" in window)) {
        cb("unsupported");
        return;
      }
      var n = Notification;
      if (n.permission === "granted") {
        cb("granted");
        return;
      }
      if (n.permission === "denied") {
        cb("denied");
        return;
      }
      try {
        var req = n.requestPermission();
        if (req && typeof req.then === "function") {
          req.then(function (r) {
            cb(r);
          });
        } else {
          n.requestPermission(function (r) {
            cb(r);
          });
        }
      } catch (e) {
        cb("denied");
      }
    }

    function activateLeadDays(leadDays) {
      if (!("Notification" in window)) {
        setNotifyStatusEl(
          statusEl,
          "This browser does not support notifications."
        );
        setOpen(false);
        return;
      }
      function commitSchedule() {
        var peak = findNextFullMoonPeakAfter(new Date());
        if (!peak) {
          setNotifyStatusEl(
            statusEl,
            "Could not compute the next full moon. Try again later."
          );
          setOpen(false);
          return;
        }
        var reminder = new Date(peak.getTime() - leadDays * moonDayMs);
        var state = {
          v: 1,
          leadDays: leadDays,
          fullMoonAt: peak.toISOString(),
          reminderAt: reminder.toISOString(),
          firedForFullMoon: null,
        };
        saveNotifyState(state);
        notifyScheduleRefresh();
        setOpen(false);
      }
      requestNotificationPermissionThen(function (perm) {
        if (perm === "granted") {
          commitSchedule();
          return;
        }
        if (perm === "denied") {
          refreshNotifyUi(root, statusEl);
          setOpen(false);
          return;
        }
        setNotifyStatusEl(
          statusEl,
          "Permission was not granted. Try again when you are ready."
        );
        setOpen(false);
      });
    }

    var opts = root.querySelectorAll(".calendar-notify__option");
    for (var j = 0; j < opts.length; j++) {
      opts[j].addEventListener("click", function (e) {
        e.stopPropagation();
        var raw = e.currentTarget.getAttribute("data-lead-days");
        var lead = parseInt(raw, 10);
        if (isNaN(lead) || lead < 1) {
          return;
        }
        activateLeadDays(lead);
      });
    }

    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") {
        return;
      }
      if (btn.getAttribute("aria-expanded") === "true") {
        setOpen(false);
      }
    });

    notifyScheduleRefresh();
  }

  initCalendarNotify();

  onHashChange();
})();
