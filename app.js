(function () {
  var STAR_PATH =
    "M 12.000 1.000 L 14.687 9.313 L 20.200 12.000 L 14.687 14.687 L 12.000 23.000 L 9.313 14.687 L 3.800 12.000 L 9.313 9.313 Z";

  var NS = "http://www.w3.org/2000/svg";
  var reflectionMeditationAudioEl = null;

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

  /* New Moon reflection — prompt advances once per actual lunation (after each new moon), not on a rolling mean-lunation clock */
  var REFLECTION_PROMPTS = [
    {
      tag: "RELEASE",
      body:
        "What heavy emotions, limiting beliefs, or toxic situations am I ready to release with gratitude?",
    },
    {
      tag: "CELEBRATE",
      body:
        "What am I proud of accomplishing or navigating over the last two weeks?",
    },
    {
      tag: "ILLUMINATE",
      body:
        "What truth or hidden pattern is the light of this full moon bringing to my awareness?",
    },
    {
      tag: "ALIGN",
      body:
        "How can I better align my daily actions with my highest self and long-term vision?",
    },
    {
      tag: "FORGIVE",
      body:
        "Who—or what part of myself—do I need to forgive to move forward?",
    },
    {
      tag: "RELATIONSHIPS",
      body:
        "How can I foster more authenticity and vulnerability in my partnerships?",
    },
    {
      tag: "SHADOW WORK",
      body:
        "What fears am I avoiding, and how can I honor them instead of running from them?",
    },
    {
      tag: "GROWTH",
      body:
        "What lessons have I learned in this lunar cycle?",
    },
  ];

  var SYNODIC_DAY_MS = 29.530588853 * 86400000;
  var REF_NEW_MOON_REF_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

  /** Most recent new moon: time of minimum illuminated fraction at or before `beforeMs`. */
  function findLastNewMoonInstant(beforeMs) {
    var stepCoarse = 4 * 3600000;
    var windowMs = 42 * 24 * 3600000;
    var start = beforeMs - 120000;
    var minFr = 2;
    var minT = start;
    var t;
    for (t = start; t > start - windowMs; t -= stepCoarse) {
      var fr = getMoonIllumination(new Date(t)).fraction;
      if (fr < minFr) {
        minFr = fr;
        minT = t;
      }
    }
    var refineLo = minT - 48 * 3600000;
    var refineHi = minT + 48 * 3600000;
    var refineStep = 15 * 60 * 1000;
    minFr = 2;
    for (t = refineLo; t <= refineHi; t += refineStep) {
      var fr2 = getMoonIllumination(new Date(t)).fraction;
      if (fr2 < minFr) {
        minFr = fr2;
        minT = t;
      }
    }
    return new Date(minT);
  }

  var lastNmForPromptCache = { at: 0, inst: null };
  var LAST_NM_CACHE_MS = 90 * 1000;
  var LAST_NM_NEAR_NEW_CACHE_MS = 12 * 1000;

  function getLastNewMoonInstantForPrompt(force) {
    var now = Date.now();
    var fr = getMoonIllumination(new Date(now)).fraction;
    var nearNew = fr < 0.2;
    var maxAge = nearNew ? LAST_NM_NEAR_NEW_CACHE_MS : LAST_NM_CACHE_MS;
    if (!force && lastNmForPromptCache.inst && now - lastNmForPromptCache.at < maxAge) {
      return lastNmForPromptCache.inst;
    }
    lastNmForPromptCache.at = now;
    lastNmForPromptCache.inst = findLastNewMoonInstant(now);
    return lastNmForPromptCache.inst;
  }

  function reflectionPromptSerialFromLastNewMoon(lastNewMoonMs) {
    return Math.floor((lastNewMoonMs - REF_NEW_MOON_REF_MS) / SYNODIC_DAY_MS);
  }

  var prevPromptLastNewMoonMs = null;

  function updateReflectionPrompt() {
    var tagEl = document.getElementById("reflection-prompt-tag");
    var bodyEl = document.getElementById("reflection-prompt-body");
    if (!tagEl || !bodyEl) {
      return;
    }
    var lastNm = getLastNewMoonInstantForPrompt(true);
    if (!lastNm) {
      return;
    }
    var t = lastNm.getTime();
    var li = reflectionPromptSerialFromLastNewMoon(t);
    var n = REFLECTION_PROMPTS.length;
    var idx = ((li % n) + n) % n;
    var item = REFLECTION_PROMPTS[idx];
    tagEl.textContent = item.tag;
    bodyEl.textContent = item.body;
    prevPromptLastNewMoonMs = t;
  }

  function maybeUpdateReflectionPrompt() {
    var lastNm = getLastNewMoonInstantForPrompt(false);
    if (!lastNm) {
      return;
    }
    var t = lastNm.getTime();
    if (prevPromptLastNewMoonMs === t) {
      return;
    }
    updateReflectionPrompt();
  }

  /* Saved reflections — local archive for “My Past Reflections” */
  var REFLECTION_ARCHIVE_KEY = "lunascope.savedReflections.v1";
  var reflectionSaveStatusTimer = null;

  function loadSavedReflections() {
    try {
      var raw = localStorage.getItem(REFLECTION_ARCHIVE_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      var out = [];
      for (var i = 0; i < parsed.length; i++) {
        var e = parsed[i];
        if (e && typeof e.text === "string" && e.savedAt) {
          out.push({
            id: e.id || String(i),
            tag: typeof e.tag === "string" ? e.tag : "REFLECTION",
            text: e.text,
            savedAt: e.savedAt,
          });
        }
      }
      return out;
    } catch (err) {
      return [];
    }
  }

  function persistSavedReflections(list) {
    try {
      localStorage.setItem(REFLECTION_ARCHIVE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  function formatReflectionDateShort(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      return "";
    }
    return d.getMonth() + 1 + "/" + d.getDate() + "/" + d.getFullYear();
  }

  function renderPastReflections() {
    var listEl = document.getElementById("past-reflection-list");
    var emptyEl = document.getElementById("past-reflection-empty");
    if (!listEl) {
      return;
    }
    var items = loadSavedReflections().slice();
    items.sort(function (a, b) {
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });
    listEl.innerHTML = "";
    if (items.length === 0) {
      if (emptyEl) {
        emptyEl.hidden = false;
      }
      return;
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var art = document.createElement("article");
      art.className = "reflection-card";
      art.setAttribute("role", "listitem");
      var meta = document.createElement("p");
      meta.className = "reflection-card__meta";
      meta.textContent =
        (it.tag || "REFLECTION") + " ✧ " + formatReflectionDateShort(it.savedAt);
      var body = document.createElement("p");
      body.className = "reflection-card__text";
      body.textContent = it.text;
      art.appendChild(meta);
      art.appendChild(body);
      listEl.appendChild(art);
    }
    scheduleStarfield();
  }

  function addPastReflectionEntry(text, tag, savedAtIso) {
    var entry = {
      id:
        String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10),
      tag: (tag || "").trim() || "REFLECTION",
      text: text,
      savedAt: savedAtIso || new Date().toISOString(),
    };
    var list = loadSavedReflections();
    list.push(entry);
    return persistSavedReflections(list);
  }

  function saveReflectionFromEditor() {
    var statusEl = document.getElementById("reflection-save-status");
    var field = document.getElementById("reflection-journal");
    var tagEl = document.getElementById("reflection-prompt-tag");
    if (!field || !tagEl) {
      return;
    }
    var text = (field.textContent || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();
    if (!text.length) {
      if (statusEl) {
        statusEl.textContent = "";
      }
      field.focus();
      return;
    }
    if (!addPastReflectionEntry(text, tagEl.textContent, null)) {
      if (statusEl) {
        statusEl.textContent =
          "Could not save — storage may be full or unavailable.";
      }
      return;
    }
    field.textContent = "";
    scheduleStarfield();
    if (statusEl) {
      statusEl.textContent = "Saved.";
      window.clearTimeout(reflectionSaveStatusTimer);
      reflectionSaveStatusTimer = window.setTimeout(function () {
        statusEl.textContent = "";
      }, 2500);
    }
    if (getRouteId() === "past") {
      renderPastReflections();
    }
  }

  /* IAU constellation names (English) — random label per anonymous void post */
  var IAU_CONSTELLATIONS = [
    "Andromeda",
    "Antlia",
    "Apus",
    "Aquarius",
    "Aquila",
    "Ara",
    "Aries",
    "Auriga",
    "Bootes",
    "Caelum",
    "Camelopardalis",
    "Cancer",
    "Canes Venatici",
    "Canis Major",
    "Canis Minor",
    "Capricornus",
    "Carina",
    "Cassiopeia",
    "Centaurus",
    "Cepheus",
    "Cetus",
    "Chamaeleon",
    "Circinus",
    "Columba",
    "Coma Berenices",
    "Corona Australis",
    "Corona Borealis",
    "Corvus",
    "Crater",
    "Crux",
    "Cygnus",
    "Delphinus",
    "Dorado",
    "Draco",
    "Equuleus",
    "Eridanus",
    "Fornax",
    "Gemini",
    "Grus",
    "Hercules",
    "Horologium",
    "Hydra",
    "Hydrus",
    "Indus",
    "Lacerta",
    "Leo",
    "Leo Minor",
    "Lepus",
    "Libra",
    "Lupus",
    "Lynx",
    "Lyra",
    "Mensa",
    "Microscopium",
    "Monoceros",
    "Musca",
    "Norma",
    "Octans",
    "Ophiuchus",
    "Orion",
    "Pavo",
    "Pegasus",
    "Perseus",
    "Phoenix",
    "Pictor",
    "Pisces",
    "Piscis Austrinus",
    "Puppis",
    "Pyxis",
    "Reticulum",
    "Sagitta",
    "Sagittarius",
    "Scorpius",
    "Sculptor",
    "Scutum",
    "Serpens",
    "Sextans",
    "Taurus",
    "Telescopium",
    "Triangulum",
    "Triangulum Australe",
    "Tucana",
    "Ursa Major",
    "Ursa Minor",
    "Vela",
    "Virgo",
    "Volans",
    "Vulpecula",
  ];

  function randomConstellationName() {
    var a = IAU_CONSTELLATIONS;
    return a[Math.floor(Math.random() * a.length)];
  }

  var VOID_POSTS_KEY = "lunascope.voidPosts.v1";
  var reflectionVoidStatusTimer = null;

  var VOID_EMPTY_COPY =
    "No posts yet. From Reflection Prompt, choose \u201cPost to Reflection Void\u201d \u2014 your words appear here under a random constellation name, with the date you posted.";

  function getVoidRemoteConfig() {
    var c = typeof window !== "undefined" && window.LUNASCOPE_VOID;
    if (!c || !c.supabaseUrl || !c.supabaseAnonKey) {
      return null;
    }
    var url = String(c.supabaseUrl).trim();
    var key = String(c.supabaseAnonKey).trim();
    if (!url || !key) {
      return null;
    }
    return { supabaseUrl: url, supabaseAnonKey: key };
  }

  function fetchVoidPostsRemote(cfg, done) {
    var base = cfg.supabaseUrl.replace(/\/$/, "");
    var reqUrl =
      base +
      "/rest/v1/void_posts?select=id,constellation,body,posted_at&order=posted_at.desc";
    fetch(reqUrl, {
      method: "GET",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: "Bearer " + cfg.supabaseAnonKey,
        Accept: "application/json",
      },
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("void fetch " + res.status);
        }
        return res.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows)) {
          done(new Error("void bad payload"), null);
          return;
        }
        var items = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          if (
            r &&
            typeof r.body === "string" &&
            r.posted_at &&
            typeof r.constellation === "string"
          ) {
            items.push({
              id: r.id,
              constellation: r.constellation,
              text: r.body,
              postedAt: r.posted_at,
            });
          }
        }
        done(null, items);
      })
      .catch(function (e) {
        done(e, null);
      });
  }

  function insertVoidPostRemote(cfg, entry, done) {
    var base = cfg.supabaseUrl.replace(/\/$/, "");
    var reqUrl = base + "/rest/v1/void_posts";
    fetch(reqUrl, {
      method: "POST",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: "Bearer " + cfg.supabaseAnonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        constellation: entry.constellation,
        body: entry.text,
        posted_at: entry.postedAt,
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("void insert " + res.status);
        }
        done(null);
      })
      .catch(function (e) {
        done(e);
      });
  }

  function loadVoidPosts() {
    try {
      var raw = localStorage.getItem(VOID_POSTS_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      var out = [];
      for (var i = 0; i < parsed.length; i++) {
        var e = parsed[i];
        if (
          e &&
          typeof e.text === "string" &&
          e.postedAt &&
          typeof e.constellation === "string"
        ) {
          out.push({
            id: e.id || String(i),
            constellation: e.constellation,
            text: e.text,
            postedAt: e.postedAt,
          });
        }
      }
      return out;
    } catch (err) {
      return [];
    }
  }

  function persistVoidPosts(list) {
    try {
      localStorage.setItem(VOID_POSTS_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  function renderVoidListIntoDom(items, listEl, emptyEl) {
    items = items.slice().sort(function (a, b) {
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
    listEl.innerHTML = "";
    if (items.length === 0) {
      if (emptyEl) {
        emptyEl.hidden = false;
      }
      scheduleStarfield();
      return;
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    for (var v = 0; v < items.length; v++) {
      var it = items[v];
      var art = document.createElement("article");
      art.className = "void-card";
      art.setAttribute("role", "listitem");
      var meta = document.createElement("p");
      meta.className = "void-card__meta";
      meta.textContent =
        (it.constellation || "—") +
        " ✧ " +
        formatReflectionDateShort(it.postedAt);
      var body = document.createElement("p");
      body.className = "void-card__text";
      body.textContent = it.text;
      art.appendChild(meta);
      art.appendChild(body);
      listEl.appendChild(art);
    }
    scheduleStarfield();
  }

  function renderVoidReflections() {
    var listEl = document.getElementById("void-reflection-list");
    var emptyEl = document.getElementById("void-reflection-empty");
    if (!listEl) {
      return;
    }
    var cfg = getVoidRemoteConfig();
    if (cfg) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "Loading reflections…";
      }
      listEl.innerHTML = "";
      fetchVoidPostsRemote(cfg, function (err, items) {
        if (err) {
          var local = loadVoidPosts();
          if (local.length === 0) {
            if (emptyEl) {
              emptyEl.hidden = false;
              emptyEl.textContent =
                "Could not load shared reflections. Check config.js (Supabase) or try again later.";
            }
            listEl.innerHTML = "";
          } else {
            if (emptyEl) {
              emptyEl.textContent = VOID_EMPTY_COPY;
              emptyEl.hidden = true;
            }
            renderVoidListIntoDom(local, listEl, emptyEl);
          }
          scheduleStarfield();
          return;
        }
        if (emptyEl) {
          emptyEl.textContent = VOID_EMPTY_COPY;
        }
        renderVoidListIntoDom(items || [], listEl, emptyEl);
      });
      return;
    }
    if (emptyEl) {
      emptyEl.textContent = VOID_EMPTY_COPY;
    }
    renderVoidListIntoDom(loadVoidPosts(), listEl, emptyEl);
  }

  function postReflectionToVoid() {
    var statusEl = document.getElementById("reflection-void-status");
    var field = document.getElementById("reflection-journal");
    var tagEl = document.getElementById("reflection-prompt-tag");
    if (!field) {
      return;
    }
    var text = (field.textContent || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();
    if (!text.length) {
      if (statusEl) {
        statusEl.textContent = "";
      }
      field.focus();
      return;
    }
    var tag = tagEl ? (tagEl.textContent || "").trim() : "";
    var postedAt = new Date().toISOString();
    if (!addPastReflectionEntry(text, tag, postedAt)) {
      if (statusEl) {
        statusEl.textContent =
          "Could not save — storage may be full or unavailable.";
      }
      return;
    }
    var entry = {
      constellation: randomConstellationName(),
      text: text,
      postedAt: postedAt,
    };
    var cfg = getVoidRemoteConfig();
    if (cfg) {
      insertVoidPostRemote(cfg, entry, function (err) {
        if (err) {
          if (statusEl) {
            statusEl.textContent =
              "Saved to My Past Reflections. Could not post to the shared Void.";
          }
          field.textContent = "";
          scheduleStarfield();
          window.clearTimeout(reflectionVoidStatusTimer);
          reflectionVoidStatusTimer = window.setTimeout(function () {
            if (statusEl) {
              statusEl.textContent = "";
            }
          }, 4200);
          if (getRouteId() === "past") {
            renderPastReflections();
          }
          return;
        }
        field.textContent = "";
        scheduleStarfield();
        if (statusEl) {
          statusEl.textContent =
            "Posted to the shared Void and saved to My Past Reflections.";
          window.clearTimeout(reflectionVoidStatusTimer);
          reflectionVoidStatusTimer = window.setTimeout(function () {
            statusEl.textContent = "";
          }, 3200);
        }
        if (getRouteId() === "past") {
          renderPastReflections();
        }
        if (getRouteId() === "void") {
          renderVoidReflections();
        }
      });
      return;
    }
    var list = loadVoidPosts();
    list.push({
      id:
        String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10),
      constellation: entry.constellation,
      text: entry.text,
      postedAt: entry.postedAt,
    });
    if (!persistVoidPosts(list)) {
      if (statusEl) {
        statusEl.textContent =
          "Saved to My Past Reflections. Could not post to the Void.";
      }
      field.textContent = "";
      scheduleStarfield();
      window.clearTimeout(reflectionVoidStatusTimer);
      reflectionVoidStatusTimer = window.setTimeout(function () {
        if (statusEl) {
          statusEl.textContent = "";
        }
      }, 4200);
      if (getRouteId() === "past") {
        renderPastReflections();
      }
      return;
    }
    field.textContent = "";
    scheduleStarfield();
    if (statusEl) {
      statusEl.textContent =
        "Posted to the Void and saved to My Past Reflections.";
      window.clearTimeout(reflectionVoidStatusTimer);
      reflectionVoidStatusTimer = window.setTimeout(function () {
        statusEl.textContent = "";
      }, 3200);
    }
    if (getRouteId() === "past") {
      renderPastReflections();
    }
    if (getRouteId() === "void") {
      renderVoidReflections();
    }
  }

  function initReflectionArchive() {
    var saveBtn = document.getElementById("reflection-save-btn");
    var voidBtn = document.getElementById("reflection-post-void-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", saveReflectionFromEditor);
    }
    if (voidBtn) {
      voidBtn.addEventListener("click", postReflectionToVoid);
    }
  }

  function initReflectionMeditation() {
    var audio = document.getElementById("reflection-meditation-audio");
    var playBtn = document.getElementById("reflection-meditation-play");
    var pauseBtn = document.getElementById("reflection-meditation-pause");
    var card = document.getElementById("reflection-meditation-card");
    if (!audio || !playBtn || !pauseBtn || !card) {
      return;
    }
    reflectionMeditationAudioEl = audio;

    function meditationHasSrc() {
      var attr = audio.getAttribute("src");
      return !!(attr && attr.trim()) || !!(audio.currentSrc && audio.currentSrc.length > 0);
    }

    function updateMeditationControls() {
      var hasSrc = meditationHasSrc();
      if (!hasSrc) {
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        card.classList.remove("reflection-meditation--playing");
        return;
      }
      var playing = !audio.paused && !audio.ended;
      playBtn.disabled = playing;
      pauseBtn.disabled = !playing;
      card.classList.toggle("reflection-meditation--playing", playing);
    }

    playBtn.addEventListener("click", function () {
      if (!meditationHasSrc()) {
        return;
      }
      var p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(updateMeditationControls).catch(function () {
          updateMeditationControls();
        });
      } else {
        updateMeditationControls();
      }
    });

    pauseBtn.addEventListener("click", function () {
      audio.pause();
      updateMeditationControls();
    });

    audio.addEventListener("play", updateMeditationControls);
    audio.addEventListener("pause", updateMeditationControls);
    audio.addEventListener("ended", updateMeditationControls);

    updateMeditationControls();
  }

  function pauseReflectionMeditationIfNeeded() {
    if (reflectionMeditationAudioEl && !reflectionMeditationAudioEl.paused) {
      reflectionMeditationAudioEl.pause();
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
    maybeUpdateReflectionPrompt();
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
    var route = getRouteId();
    if (route !== "reflection") {
      pauseReflectionMeditationIfNeeded();
    }
    showScreen(route);
    scheduleStarfield();
    moonDrawState.key = null;
    updateRealTimeDisplays();
    notifyScheduleRefresh();
    initPhaseIllustrations();
    if (route === "past") {
      renderPastReflections();
    }
    if (route === "void") {
      renderVoidReflections();
    }
  }

  window.addEventListener("hashchange", onHashChange);

  setInterval(updateRealTimeDisplays, 1000);

  function syncStarfieldMinHeight(starfield) {
    var docEl = document.documentElement;
    var body = document.body;
    var scrollH = Math.max(
      docEl.scrollHeight,
      body ? body.scrollHeight : 0,
      docEl.clientHeight,
      window.innerHeight || 0
    );
    starfield.style.minHeight = scrollH + "px";
  }

  function placeStars(starfield) {
    syncStarfieldMinHeight(starfield);
    var w = starfield.clientWidth;
    var h = starfield.clientHeight;
    if (w < 2) {
      w = window.innerWidth || document.documentElement.clientWidth || 320;
    }
    if (h < 2) {
      h = window.innerHeight || document.documentElement.clientHeight || 568;
    }

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* Scale count with viewport area — dense fill (no exclusion zones) */
    var referenceArea = 220000;
    var baseStars = reduce ? 40 : 115;
    var targetCount = Math.round((baseStars * (w * h)) / referenceArea);
    if (targetCount < (reduce ? 28 : 72)) {
      targetCount = reduce ? 28 : 72;
    }
    if (targetCount > (reduce ? 52 : 380)) {
      targetCount = reduce ? 52 : 380;
    }

    starfield.textContent = "";

    function appendStarSvg(cx, cy, size, opacity, rotation) {
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "starfield__star");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.style.left = cx + "px";
      svg.style.top = cy + "px";
      svg.style.setProperty("--star-op", String(opacity));
      if (!reduce) {
        var twDur = 1.8 + Math.random() * 7.2;
        svg.style.setProperty("--twinkle-dur", twDur + "s");
        svg.style.setProperty("--twinkle-delay", -Math.random() * twDur + "s");
      }
      svg.style.transform =
        "translate(-50%, -50%) rotate(" + rotation + "deg)";

      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", STAR_PATH);
      path.setAttribute("fill", "currentColor");
      svg.appendChild(path);

      starfield.appendChild(svg);
    }

    var pi;
    for (pi = 0; pi < targetCount; pi++) {
      var cx = Math.random() * w;
      var cy = Math.random() * h;
      var size = 6 + Math.random() * 20;
      var rotation = Math.random() * 360;
      var opacity = 0.52 + Math.random() * 0.42;
      appendStarSvg(cx, cy, size, opacity, rotation);
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

  window.addEventListener("orientationchange", function () {
    setTimeout(function () {
      scheduleStarfield();
    }, 250);
  });

  window.addEventListener("pageshow", function () {
    scheduleStarfield();
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
  initReflectionArchive();
  initReflectionMeditation();

  onHashChange();
})();
