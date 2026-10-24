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

  function lensMap(w, h, radius, bevel, maxShift) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    var img = g.createImageData(w, h);
    var cx = w / 2, cy = h / 2;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        // Signed distance to the rounded rect and its outward normal
        var dx = Math.abs(x + 0.5 - cx) - (w / 2 - radius);
        var dy = Math.abs(y + 0.5 - cy) - (h / 2 - radius);
        var ox = Math.max(dx, 0), oy = Math.max(dy, 0);
        var outside = Math.sqrt(ox * ox + oy * oy);
        var inside = -(outside + Math.min(Math.max(dx, dy), 0) - radius);
        var nx = 0, ny = 0;
        if (dx > 0 && dy > 0) { nx = ox / (outside || 1); ny = oy / (outside || 1); }
        else if (dx > dy) nx = 1;
        else ny = 1;
        nx *= Math.sign(x + 0.5 - cx);
        ny *= Math.sign(y + 0.5 - cy);
        var t = inside >= bevel || inside < 0 ? 0 : 1 - inside / bevel;
        // Strongest near the rim, but never shifted further than the rim itself,
        // so the glass never samples outside the button
        var mag = Math.min(t, inside / maxShift);
        var i = (y * w + x) * 4;
        img.data[i] = 128 + nx * mag * 127;
        img.data[i + 1] = 128 + ny * mag * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  (function liquidGlass() {
    var layers = document.querySelectorAll('.lg-btn__under');
    if (!layers.length) return;

    (function buildLenses() {
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

  var fontReady = document.fonts && document.fonts.load
    ? document.fonts.load('26px "Lebowski"').catch(function () {})
    : Promise.resolve();
  fontReady.then(initCounters);
})();
