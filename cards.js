// Card details that CSS can't express on its own:
// Figma-style smoothed corners and the rolling step counter.
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- Smoothed corners (Figma "corner smoothing") ----------
  // Port of the figma-squircle path math: each corner is a circular arc
  // blended into the edges with two cubic curves.
  function cornerParams(r, smoothing, budget) {
    var p = Math.min((1 + smoothing) * r, budget);
    smoothing = Math.min(smoothing, budget / r - 1);
    var rad = function (deg) { return (deg * Math.PI) / 180; };
    var arcMeasure = 90 * (1 - smoothing);
    var arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
    var alpha = (90 - arcMeasure) / 2;
    var p3ToP4 = r * Math.tan(rad(alpha / 2));
    var beta = 45 * smoothing;
    var c = p3ToP4 * Math.cos(rad(beta));
    var d = c * Math.tan(rad(beta));
    var b = (p - arc - c - d) / 3;
    return { a: 2 * b, b: b, c: c, d: d, p: p, arc: arc, r: r };
  }

  function squirclePath(w, h, radius, smoothing) {
    var k = cornerParams(radius, smoothing, Math.min(w, h) / 2);
    var a = k.a, b = k.b, c = k.c, d = k.d, p = k.p, s = k.arc, r = k.r;
    var f = function (n) { return +n.toFixed(3); };
    return [
      'M', f(w - p), 0,
      'c', f(a), 0, f(a + b), 0, f(a + b + c), f(d),
      'a', r, r, 0, 0, 1, f(s), f(s),
      'c', f(d), f(c), f(d), f(b + c), f(d), f(a + b + c),
      'L', w, f(h - p),
      'c', 0, f(a), 0, f(a + b), f(-d), f(a + b + c),
      'a', r, r, 0, 0, 1, f(-s), f(s),
      'c', f(-c), f(d), f(-(b + c)), f(d), f(-(a + b + c)), f(d),
      'L', f(p), h,
      'c', f(-a), 0, f(-(a + b)), 0, f(-(a + b + c)), f(-d),
      'a', r, r, 0, 0, 1, f(-s), f(-s),
      'c', f(-d), f(-c), f(-d), f(-(b + c)), f(-d), f(-(a + b + c)),
      'L', 0, f(p),
      'c', 0, f(-a), 0, f(-(a + b)), f(d), f(-(a + b + c)),
      'a', r, r, 0, 0, 1, f(s), f(-s),
      'c', f(c), f(-d), f(b + c), f(-d), f(a + b + c), f(-d),
      'Z'
    ].join(' ');
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  document.querySelectorAll('[data-smooth-radius]').forEach(function (el) {
    var radius = parseFloat(el.dataset.smoothRadius);
    var path = squirclePath(el.offsetWidth, el.offsetHeight, radius, 0.8);
    el.style.borderRadius = '0';
    el.style.clipPath = "path('" + path + "')";
    // A CSS border can't follow the squircle, so the Glass window gets its outline as a path
    if (el.classList.contains('ai__input')) {
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'ai__outline');
      svg.setAttribute('viewBox', '0 0 ' + el.offsetWidth + ' ' + el.offsetHeight);
      svg.setAttribute('aria-hidden', 'true');
      var outline = document.createElementNS(SVG_NS, 'path');
      outline.setAttribute('d', path);
      svg.appendChild(outline);
      el.appendChild(svg);
    }
  });

  // ---------- Liquid Glass lens (Figma GLASS effect, approximated) ----------
  // A displacement map makes each point sample from nearer the capsule's rim, so the
  // rim content (the white shine, the mirrored label) is stretched in across the glass,
  // like light bending through a thick lens; R, G and B are displaced
  // by slightly different amounts for the dispersion fringe. It runs as a plain CSS
  // filter on the button's under-layer, which every modern browser supports.
  var LENS = { refraction: 0.32, depth: 24, dispersion: 0.32, frost: 4 };

  // res > 1 renders the map finer than CSS pixels (small lenses look blocky otherwise)
  function lensMap(w, h, radius, bevel, maxShift, res) {
    res = res || 1;
    var W = Math.round(w * res), Hh = Math.round(h * res);
    var c = document.createElement('canvas');
    c.width = W;
    c.height = Hh;
    var g = c.getContext('2d');
    var img = g.createImageData(W, Hh);
    var cx = w / 2, cy = h / 2;
    for (var py = 0; py < Hh; py++) {
      for (var px = 0; px < W; px++) {
        var x = px / res, y = py / res;
        // Signed distance to the rounded rect and its outward normal
        var dx = Math.abs(x + 0.5 / res - cx) - (w / 2 - radius);
        var dy = Math.abs(y + 0.5 / res - cy) - (h / 2 - radius);
        var ox = Math.max(dx, 0), oy = Math.max(dy, 0);
        var outside = Math.sqrt(ox * ox + oy * oy);
        var inside = -(outside + Math.min(Math.max(dx, dy), 0) - radius);
        var nx = 0, ny = 0;
        if (dx > 0 && dy > 0) { nx = ox / (outside || 1); ny = oy / (outside || 1); }
        else if (dx > dy) nx = 1;
        else ny = 1;
        nx *= Math.sign(x + 0.5 / res - cx);
        ny *= Math.sign(y + 0.5 / res - cy);
        var t = inside >= bevel || inside < 0 ? 0 : 1 - inside / bevel;
        // Strongest near the rim, but never shifted further than the rim itself,
        // so the glass never samples outside the button
        var mag = Math.min(t, inside / maxShift);
        var i = (py * W + px) * 4;
        img.data[i] = 128 + nx * mag * 127;
        img.data[i + 1] = 128 + ny * mag * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // WebKit (Safari, and every browser on iPhone/iPad) applies url() filters on HTML
  // unclipped and offset: the lens showed as a square box with the shine slid sideways.
  // There the glass gets a plain soft blur instead of the SVG lens.
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var SAFARI = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/.test(navigator.userAgent);
  var NO_SVG_LENS = IOS || SAFARI;

  (function liquidGlass() {
    var layers = document.querySelectorAll('.lg-btn__under');
    if (!layers.length) return;

    if (NO_SVG_LENS) {
      layers.forEach(function (layer) { layer.setAttribute('data-soft', ''); });
    } else (function buildLenses() {
      var defs = document.createElementNS(SVG_NS, 'svg');
      defs.setAttribute('width', '0');
      defs.setAttribute('height', '0');
      defs.setAttribute('aria-hidden', 'true');
      defs.style.position = 'absolute';
      document.body.appendChild(defs);
      var made = {};
      var scale = LENS.refraction * 70;
      var spread = LENS.dispersion * 0.15; // a thin fringe, not a colour cast

      layers.forEach(function (layer) {
        var w = layer.offsetWidth, h = layer.offsetHeight;
        var id = 'lg-lens-' + w + 'x' + h;
        if (!made[id]) {
          made[id] = true;
          var channel = function (k, matrix, name) {
            return '<feDisplacementMap in="frost" in2="map" scale="' + (scale * k).toFixed(2) +
              '" xChannelSelector="R" yChannelSelector="G" result="d' + name + '"/>' +
              '<feColorMatrix in="d' + name + '" type="matrix" values="' + matrix + '" result="' + name + '"/>';
          };
          defs.insertAdjacentHTML('beforeend',
            '<filter id="' + id + '" x="0" y="0" width="' + w + '" height="' + h + '" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
              '<feImage href="' + lensMap(w, h, h / 2, Math.min(h / 2, LENS.depth * 0.75), scale * (1 + spread) / 2) + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="map"/>' +
              '<feGaussianBlur in="SourceGraphic" stdDeviation="' + LENS.frost / 2 + '" result="frost"/>' +
              channel(1 + spread, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r') +
              channel(1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g') +
              channel(1 - spread, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b') +
              '<feBlend in="r" in2="g" mode="screen" result="rg"/>' +
              '<feBlend in="rg" in2="b" mode="screen"/>' +
            '</filter>');
        }
        layer.style.setProperty('--lens', 'url(#' + id + ')');
        layer.setAttribute('data-lens', '');
      });
    })();

    // Specular glint follows the pointer across the glass
    document.querySelectorAll('.lg-btn').forEach(function (btn) {
      var glass = btn.querySelector('.lg-btn__glass');
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        glass.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        glass.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  })();

  // ---------- Glass cards (Figma GLASS effect on a whole card) ----------
  // Same lens as the buttons, sized to the card: what lies under the glass (the chart,
  // the glows, the base) bends near the rim. No frost — Figma's card glass is sharp.
  // Settings come from the Figma layer: data-glass="refraction depth dispersion".
  (function glassCards() {
    var layers = document.querySelectorAll('[data-glass]');
    if (!layers.length || NO_SVG_LENS) return;
    var defs = document.createElementNS(SVG_NS, 'svg');
    defs.setAttribute('width', '0');
    defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.position = 'absolute';
    document.body.appendChild(defs);

    layers.forEach(function (layer, n) {
      var p = layer.dataset.glass.split(' ').map(parseFloat);
      var w = Math.round(layer.offsetWidth), h = Math.round(layer.offsetHeight);
      if (!w || !h) return; // hidden card
      var r = parseFloat(layer.dataset.glassRadius);
      // Gentler than the buttons: a card's rim is long, and a wide shift smears
      // the edge column into a flat band instead of bending what is under it
      var scale = p[0] * (parseFloat(layer.dataset.glassScale) || 30);
      // A thinner fringe than the buttons: along a long straight rim a strong one
      // reads as a coloured stripe, not as dispersion
      var spread = p[2] * 0.05;
      var id = 'glass-card-' + n;
      var channel = function (k, matrix, name) {
        return '<feDisplacementMap in="soft" in2="map" scale="' + (scale * k).toFixed(2) +
          '" xChannelSelector="R" yChannelSelector="G" result="d' + name + '"/>' +
          '<feColorMatrix in="d' + name + '" type="matrix" values="' + matrix + '" result="' + name + '"/>';
      };
      defs.insertAdjacentHTML('beforeend',
        '<filter id="' + id + '" x="0" y="0" width="' + w + '" height="' + h + '" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
          '<feImage href="' + lensMap(w, h, r, p[1] * 0.75, scale * (1 + spread) / 2, w < 80 ? 4 : 2) + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="map"/>' +
          // a hint of frost: displaced pixels otherwise come out stepped along the rim
          '<feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="soft"/>' +
          channel(1 + spread, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r') +
          channel(1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g') +
          channel(1 - spread, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b') +
          '<feBlend in="r" in2="g" mode="screen" result="rg"/>' +
          '<feBlend in="rg" in2="b" mode="screen"/>' +
        '</filter>');
      layer.style.filter = 'url(#' + id + ')';
    });
  })();

  // ---------- Money chart: intro (count up, draw the line, show the indicator) ----------
  // ---------- and the indicator you can move along the line ----------
  (function moneyChart() {
    var card = document.getElementById('money');
    if (!card) return;

    var chart = card.querySelector('.money__chart');
    var head = card.querySelector('.money__head');
    var intEl = card.querySelector('.money__int');
    var centsEl = card.querySelector('.money__cents');
    var pctEl = card.querySelector('.money__pct');
    var TOTAL = 267188819; // cents
    var PCT = 343;         // hundredths of a percent
    var DRAW = 1700, BEAD_AT = 1450;
    var CHART_W = 310.228;

    // The line's path (same as money-chart.svg), sampled once into x → y for the glowing tip
    var d = 'M1.595 97.4562H20.8406C29.9115 97.4562 34.4469 97.4562 38.6192 96.2852C39.9989 95.898 41.3397 95.4179 42.629 94.8495C46.5281 93.1305 49.6897 90.3746 56.0128 84.8628L74.8111 68.4764C81.1341 62.9647 84.2958 60.2087 88.1948 58.4897C89.4841 57.9213 90.825 57.4412 92.2046 57.054C96.3769 55.883 100.912 55.883 109.983 55.883H111.742C120.788 55.883 125.311 55.883 129.473 54.718C130.85 54.3327 132.188 53.855 133.475 53.2894C137.366 51.5789 140.526 48.836 146.844 43.3506L155.218 36.0811C161.537 30.5954 164.696 27.8525 168.587 26.142C169.874 25.5764 171.212 25.0987 172.589 24.7134C176.751 23.5484 181.274 23.5484 190.32 23.5484H211.634C216.049 23.5484 218.257 23.5484 220.411 23.8425C221.883 24.0436 223.334 24.3468 224.748 24.7491C226.816 25.3375 228.771 26.2076 232.68 27.9476C245.88 33.8238 252.481 36.7619 259.08 36.8093C263.535 36.8412 267.931 35.9471 271.884 34.2052C286.023 27.974 298.514 10.7532 311.823 1.595';
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    var pts = [];
    var len = path.getTotalLength();
    for (var l = 0; l <= len; l += len / 400) {
      var pt = path.getPointAtLength(l);
      pts.push([pt.x - 1.582, pt.y - 1.596]); // svg → chart box (the img is inset by -0.85% / -0.51%)
    }
    function yAt(x) {
      for (var i = 1; i < pts.length; i++) {
        if (pts[i][0] >= x) {
          var a = pts[i - 1], b = pts[i], k = (x - a[0]) / ((b[0] - a[0]) || 1);
          return a[1] + (b[1] - a[1]) * k;
        }
      }
      return pts[pts.length - 1][1];
    }

    function money(c) {
      var int = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      var cents = ('0' + (c % 100)).slice(-2);
      intEl.textContent = int;
      centsEl.textContent = ',' + cents;
    }
    function pct(v) { pctEl.textContent = Math.floor(v / 100) + ',' + ('0' + (v % 100)).slice(-2); }

    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

    var raf = 0, beadTimer = 0, state = 'done';

    function reset() {
      cancelAnimationFrame(raf);
      clearTimeout(beadTimer);
      card.setAttribute('data-intro', 'wait');
      chart.style.setProperty('--draw', 0);
      head.style.opacity = 0;
      money(0);
      pct(0);
      state = 'wait';
    }

    function play() {
      state = 'playing';
      var start = performance.now();
      beadTimer = setTimeout(function () { card.removeAttribute('data-intro'); }, BEAD_AT);
      (function frame(now) {
        var t = Math.min(1, (now - start) / DRAW);
        var draw = easeInOut(t);
        chart.style.setProperty('--draw', draw);
        var x = draw * CHART_W;
        head.style.transform = 'translate(' + x + 'px,' + yAt(x) + 'px)';
        head.style.opacity = t < 0.08 ? t / 0.08 : t > 0.85 ? (1 - t) / 0.15 : 1;
        var e = easeOut(t);
        money(Math.round(TOTAL * e));
        pct(Math.round(PCT * e));
        if (t < 1) raf = requestAnimationFrame(frame);
        else state = 'done';
      })(start);
    }

    // Indicator: a point on the line at card x, kept between the chart's edges.
    // Hover, drag (touch: horizontal drags; vertical ones still scroll) or arrow keys
    // move it; while that happens it shows as the glass bead (CSS: [data-active]).
    var pointer = card.querySelector('.money__pointer');
    var CHART_X = -6.38, CHART_Y = 160.7, CARD_W = 300;
    var MIN_X = 22, MAX_X = 284;
    var cur = 172.26, goal = cur, following = false, dragging = false, idle = 0;

    // Reading the line: its height at the far right is today's balance, at the far left
    // the start of the period (+3,43% ago), so the figures follow the point you hold
    var Y_FROM = yAt(MIN_X - CHART_X), Y_TO = yAt(MAX_X - CHART_X);
    var FROM = TOTAL / (1 + PCT / 10000);

    function place(x) {
      var y = yAt(x - CHART_X);
      pointer.style.setProperty('--px', x + 'px');
      pointer.style.setProperty('--py', (y + CHART_Y) + 'px');
      if (!card.hasAttribute('data-active') || state !== 'done') return;
      var v = FROM + (TOTAL - FROM) * (Y_FROM - y) / (Y_FROM - Y_TO);
      money(Math.round(v));
      pct(Math.max(0, Math.round((v / FROM - 1) * 10000)));
    }
    function follow() {
      cur += (goal - cur) * 0.25;
      if (Math.abs(goal - cur) < 0.05) cur = goal;
      place(cur);
      if (cur !== goal) requestAnimationFrame(follow);
      else following = false;
    }
    function aim(x) {
      goal = Math.max(MIN_X, Math.min(MAX_X, x));
      if (!following) { following = true; requestAnimationFrame(follow); }
    }
    // Pointer x in card px (the card may be zoomed to fit a phone)
    function local(e) {
      var r = card.getBoundingClientRect();
      return (e.clientX - r.left) * CARD_W / r.width;
    }
    function activate() {
      clearTimeout(idle);
      card.setAttribute('data-active', '');
      place(cur);
    }
    // Back at rest the card shows today's figures again
    function deactivate(delay) {
      clearTimeout(idle);
      idle = setTimeout(function () {
        card.removeAttribute('data-active');
        if (state === 'done') { money(TOTAL); pct(PCT); }
      }, delay || 0);
    }

    card.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') { activate(); aim(local(e)); }
    });
    card.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' || dragging) aim(local(e));
    });
    card.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && !dragging) deactivate();
    });
    card.addEventListener('pointerdown', function (e) {
      dragging = true;
      activate();
      aim(local(e));
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      card.addEventListener(type, function (e) {
        dragging = false;
        if (e.pointerType !== 'mouse') deactivate(900);
      });
    });
    card.addEventListener('keydown', function (e) {
      var step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      activate();
      aim(goal + step * (e.shiftKey ? 40 : 12));
      deactivate(1500);
    });
    card.addEventListener('blur', function () { deactivate(); });
    place(cur);

    // The intro plays each time the card comes into view (the last frame of the scroll scene)
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    reset();
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.intersectionRatio >= 0.6 && state === 'wait') play();
        else if (en.intersectionRatio === 0 && state !== 'wait') reset();
      });
    }, { threshold: [0, 0.6] }).observe(card);
  })();

  // ---------- Rolling counter: 00,000 → target ----------
  function buildOdometer(el) {
    var target = el.dataset.count;
    var spacing = parseFloat(getComputedStyle(el).letterSpacing) || 0;
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    el.appendChild(probe);
    var widthOf = function (ch) { probe.textContent = ch; return probe.getBoundingClientRect().width; };

    var odo = document.createElement('span');
    odo.className = 'odo';
    odo.setAttribute('aria-hidden', 'true');
    var reels = [];
    var digitIndex = 0;

    target.split('').forEach(function (ch, i) {
      var slot = document.createElement('span');
      slot.className = 'odo__slot';
      // Each slot takes its final glyph's width, so the settled number keeps the font's own spacing
      var gap = i < target.length - 1 ? spacing : 0;
      slot.style.width = widthOf(ch) + gap + 'px';

      if (!/\d/.test(ch)) {
        slot.textContent = ch;
      } else {
        // Digits further right spin through more full turns, like a mechanical counter
        var turns = digitIndex + 1;
        var reel = document.createElement('span');
        reel.className = 'odo__reel';
        for (var n = 0; n <= turns * 10 + Number(ch); n++) {
          var cell = document.createElement('span');
          cell.textContent = n % 10;
          reel.appendChild(cell);
        }
        reel.style.setProperty('--odo-time', 1.4 + digitIndex * 0.2 + 's');
        slot.appendChild(reel);
        reels.push({ reel: reel, stop: turns * 10 + Number(ch) });
        digitIndex++;
      }
      odo.appendChild(slot);
    });

    el.textContent = '';
    el.appendChild(odo);

    return function roll() {
      reels.forEach(function (r) {
        r.reel.style.transform = 'translateY(' + -r.stop * 1.2 + 'em)';
      });
    };
  }

  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      if (REDUCED.matches || !('IntersectionObserver' in window)) return;
      var roll = buildOdometer(el);
      // Roll once the card is fully on screen (in frame 1 it only peeks from below)
      var card = el.closest('.card') || el;
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].intersectionRatio >= 0.99) {
          io.disconnect();
          roll();
        }
      }, { threshold: [0.99] });
      io.observe(card);
    });
  }

  // ---------- Glass prompt: Create floods the window red and summons the devil ----------
  (function glass() {
    var form = document.getElementById('ai');
    if (!form) return;
    var input = form.querySelector('.ai__prompt');
    var create = form.querySelector('.lg-btn--primary');
    var devil = form.querySelector('.ai__devil');
    var timers = [];

    // Faces on the 5×5 emoji sheet (736px, shown at 64.46%), as [column, row]
    var SHEET_SCALE = 474.4 / 736;
    function showFace(col, row) {
      var x = (550 - (4 - col) * 126.25) * SHEET_SCALE;
      var y = (177.7 + (row - 1) * 119.5) * SHEET_SCALE;
      devil.style.backgroundPosition = -x + 'px ' + -y + 'px';
    }
    // Blank stare → shock → anger → the devil from the design
    var ARRIVAL = [[4, 0], [3, 0], [1, 3], [4, 1]];
    showFace(4, 1);

    // ---- Custom shimmering caret: follows the text insertion point ----
    var caret = form.querySelector('.ai__caret');
    var measure = document.createElement('canvas').getContext('2d');
    var typingTimer;

    function placeCaret() {
      var cs = getComputedStyle(input);
      measure.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var start = input.selectionStart == null ? input.value.length : input.selectionStart;
      // A selection shows the native highlight instead, like a system caret
      caret.hidden = input.selectionStart !== input.selectionEnd;
      var x = measure.measureText(input.value.slice(0, start)).width - input.scrollLeft;
      x = Math.max(0, Math.min(x + (input.value ? parseFloat(cs.paddingLeft) : 0), input.clientWidth - 2));
      caret.style.setProperty('--cx', x + 'px');
    }

    function typing() {
      caret.classList.add('is-typing');
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () { caret.classList.remove('is-typing'); }, 600);
      // Wait a frame so selectionStart and scrollLeft reflect the keystroke
      requestAnimationFrame(placeCaret);
    }

    ['input', 'keydown', 'click', 'focus', 'select'].forEach(function (type) {
      input.addEventListener(type, typing);
    });
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === input) placeCaret();
    });
    form.addEventListener('reset', function () { setTimeout(placeCaret); });
    if (document.fonts) document.fonts.ready.then(placeCaret);

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function flood() {
      if (form.classList.contains('is-red')) return;
      // The red spreads out from the Create button
      var box = form.querySelector('.ai__input');
      form.style.setProperty('--fx', create.offsetLeft + create.offsetWidth / 2 + 'px');
      form.style.setProperty('--fy', create.offsetTop + create.offsetHeight / 2 + 'px');
      input.blur();
      form.classList.add('is-red');
      if (REDUCED.matches) { showFace(4, 1); return; }
      ARRIVAL.forEach(function (face, i) {
        timers.push(setTimeout(function () { showFace(face[0], face[1]); }, 350 + i * 140));
      });
      timers.push(setTimeout(function () { form.classList.add('is-laughing'); }, 350 + ARRIVAL.length * 140));
      box.offsetWidth; // keep the flood origin applied before the transition
    }

    function restore() {
      clearTimers();
      form.classList.remove('is-red', 'is-laughing');
      showFace(4, 1);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      flood();
    });
    // Back: step out of the field, Cancel (type=reset) clears it natively
    form.querySelector('[data-action="back"]').addEventListener('click', function () {
      input.value = '';
      input.blur();
      placeCaret();
    });
    devil.addEventListener('click', function () {
      restore();
      input.focus();
    });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && form.classList.contains('is-red')) restore();
    });
  })();

  // ---------- Trade: drag the risk knob (pointer, touch or arrow keys) ----------
  (function riskSlider() {
    var slider = document.querySelector('.trade__slider');
    if (!slider) return;
    var knob = slider.querySelector('.trade__knob');
    var fill = slider.querySelector('.trade__fill');
    var values = slider.closest('.trade').querySelectorAll('.trade__value');
    // Card px: the knob travels from the track start to its end; 250 USDC is where the
    // design puts it (left 47.31 of 1.434…231.53), so the full track is 1250 USDC
    var START = 1.434, TRAVEL = 237.269 - START - 5.735, MAX = 1250, MIN = 10, STEP = 10;
    var value = 250;

    function set(v) {
      value = Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
      var x = START + TRAVEL * value / MAX;
      knob.style.left = x + 'px';
      fill.style.width = x + 1.43 + 'px';
      var text = value.toLocaleString('en-US');
      values.forEach(function (el) { el.textContent = text; });
      slider.setAttribute('aria-valuenow', value);
    }
    // Pointer x → value (the card may be scaled to fit a phone)
    function fromPointer(e) {
      var r = slider.getBoundingClientRect();
      var k = r.width / slider.offsetWidth;
      set(((e.clientX - r.left) / k - START - 5.735 / 2) / TRAVEL * MAX);
    }

    slider.addEventListener('pointerdown', function (e) {
      slider.setPointerCapture(e.pointerId);
      slider.classList.add('is-dragging');
      fromPointer(e);
    });
    slider.addEventListener('pointermove', function (e) {
      if (slider.classList.contains('is-dragging')) fromPointer(e);
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      slider.addEventListener(type, function () { slider.classList.remove('is-dragging'); });
    });
    slider.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (e.key === 'Home') d = -MAX;
      if (e.key === 'End') d = MAX;
      if (!d) return;
      e.preventDefault();
      set(value + d * (e.shiftKey ? 100 : STEP));
    });
  })();

  // ---------- Risk bars: drag the level along the bars, or pick a chip ----------
  (function riskBars() {
    var card = document.getElementById('bars');
    if (!card) return;
    var row = card.querySelector('.bars__row');
    var pointer = row.querySelector('.bars__pointer');
    var pctEl = card.querySelector('.bars__pct');
    var riskEl = card.querySelector('.bars__risk');
    var chips = card.querySelectorAll('.bars__chips span');
    var PITCH = 13, PAD = 1, LAST = 26, ACCOUNT = 10000; // bars are 3px + 10px gap
    // Bar colours by position: green → the design's yellow at bar 4 → orange → red
    var STOPS = [[0, [135, 248, 64]], [3, [225, 253, 16]], [14, [255, 170, 30]], [26, [255, 70, 60]]];
    var level = 3;

    function colour(k) {
      for (var j = 1; j < STOPS.length; j++) {
        if (k <= STOPS[j][0]) {
          var a = STOPS[j - 1], b = STOPS[j], t = (k - a[0]) / (b[0] - a[0]);
          return 'rgb(' + a[1].map(function (c, n) { return Math.round(c + (b[1][n] - c) * t); }).join(',') + ')';
        }
      }
    }
    // Risk grows faster towards the end: bar 4 is the design's 5%, the last bar 100%
    function pctOf(i) { return Math.round(100 * Math.pow(i / LAST, 1.39)); }
    function levelOf(pct) { return Math.round(LAST * Math.pow(pct / 100, 1 / 1.39)); }

    function set(i) {
      level = Math.max(0, Math.min(LAST, i));
      var bars = row.querySelectorAll('i');
      bars.forEach(function (bar, k) {
        var on = k <= level;
        bar.style.height = on ? 13 + 8 * (level ? k / level : 1) + 'px' : '';
        bar.style.background = on ? colour(k) : '';
      });
      pointer.style.left = PAD + PITCH * level + 1.5 - 6.95 + 'px';
      var pct = pctOf(level);
      pctEl.textContent = pct + '%';
      pctEl.style.color = colour(level);
      riskEl.textContent = pct + '% ($' + (ACCOUNT * pct / 100).toLocaleString('en-US') + ')';
      row.setAttribute('aria-valuenow', pct);
      row.setAttribute('aria-valuetext', pct + '%');
    }
    function fromPointer(e) {
      var r = row.getBoundingClientRect();
      var k = r.width / row.offsetWidth; // the card may be scaled to fit a phone
      set(Math.round(((e.clientX - r.left) / k - PAD - 1.5) / PITCH));
    }

    var dragging = false;
    row.addEventListener('pointerdown', function (e) {
      dragging = true;
      row.setPointerCapture(e.pointerId);
      fromPointer(e);
    });
    row.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      row.addEventListener(type, function () { dragging = false; });
    });
    row.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (e.key === 'Home') d = -LAST;
      if (e.key === 'End') d = LAST;
      if (!d) return;
      e.preventDefault();
      set(level + d);
    });
    // Chips jump to their level: 0%, 10%, 20%, 50%, MAX
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        set(chip.textContent === 'MAX' ? LAST : levelOf(parseFloat(chip.textContent)));
      });
    });

    set(level);
  })();

  var fontReady = document.fonts && document.fonts.load
    ? document.fonts.load('26px "Lebowski"').catch(function () {})
    : Promise.resolve();
  fontReady.then(initCounters);
})();
