// Rare "broken monitor" glitch while scrolling, in the spirit of the scene cuts in
// Cyberpunk: Edgerunners: many thin torn strips of black and acid colour,
// drawn on a low-res canvas over the page, plus a shudder of the page itself.
(function () {
  'use strict';

  // Flicker is opt-out for anyone who asked the OS for less motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PIXEL = 3;                 // one canvas pixel = 3 screen px, for the blocky look
  var COOLDOWN = [12000, 26000]; // ms between glitches, randomised
  var CHANCE = 0.45;             // odds per long scroll stretch once the cooldown is over
  var PALETTE = [
    ['#39ff14', 4], ['#7dff4a', 2], ['#2fb82a', 2], // acid greens
    ['#ff2a1a', 4], ['#e8331f', 2],                 // reds
    ['#ff3d7f', 2], ['#ff8a1c', 1], ['#f4f23a', 1], // pink, orange, yellow
    ['#00e5ff', 3], ['#ff1fd1', 3], ['#2a35ff', 3], // cyan, magenta, electric blue: dead sub-pixels
    ['#8f5bff', 1], ['#18c9a0', 1], ['#f2f2f2', 2]  // violet, teal, stuck-white
  ];
  var CLUSTER = 0.75;            // share of strips that crowd around the damaged corner

  var viewport = document.querySelector('.viewport') || document.body;
  var canvas = document.createElement('canvas');
  canvas.className = 'glitch';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var paletteBag = [];
  PALETTE.forEach(function (p) { for (var i = 0; i < p[1]; i++) paletteBag.push(p[0]); });

  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  var W = 0;
  var H = 0;
  function resize() {
    W = canvas.width = Math.ceil(window.innerWidth / PIXEL);
    H = canvas.height = Math.ceil(window.innerHeight / PIXEL);
  }

  // 0 at the damaged edge, growing away from it; squared so most values stay close
  function nearEdge(span) { return Math.pow(Math.random(), 2) * span; }

  // Each glitch "breaks" one bottom corner of the panel: strips crowd there,
  // and a few pixel rows get stuck, running in from the damaged edge
  var damage = null;
  function breakPanel() {
    var left = Math.random() < 0.5;
    var stuck = [];
    var n = 3 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var len = Math.floor(W * rand(0.15, 0.55));
      stuck.push({
        x: left ? 0 : W - len,
        y: Math.floor(H - 1 - nearEdge(H * 0.6)),
        len: len,
        color: pick(paletteBag)
      });
    }
    damage = { left: left, stuck: stuck };
  }

  function drawStuck(rows) {
    rows.forEach(function (s) {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.len, 1);
    });
  }

  function drawFrame(intensity) {
    ctx.clearRect(0, 0, W, H);
    if (!damage) breakPanel();
    var cols = 20;
    var colW = W / cols;
    // Many thin, short strips instead of a few heavy blocks
    var bands = Math.round(33 + intensity * 66);
    // A few slightly taller chunks keep some "torn signal" mass
    var chunks = intensity > 0.4 ? 2 + Math.round(Math.random() * 2) : 0;

    // Flat colour strips first, black tears on top
    var blacks = [];
    for (var i = 0; i < bands + chunks; i++) {
      var big = i >= bands;
      var clustered = Math.random() < CLUSTER;
      // Clustered strips pile up towards the bottom and the damaged side
      var y = clustered ? Math.floor(H - 1 - nearEdge(H * 0.7)) : Math.floor(rand(0, H));
      var h = Math.max(1, Math.floor(rand(1, H * (big ? 0.04 : 0.006 + intensity * 0.014))));
      var w = Math.ceil(rand(big ? 2 : 1, big ? 5 : 4)) * colW + Math.floor(rand(-3, 3));
      // Strips snap to a fine column grid, like broken macroblocks
      var col = clustered ? Math.floor(nearEdge(cols * 0.6)) : Math.floor(rand(-1, cols));
      var x = damage.left || !clustered
        ? col * colW + Math.floor(rand(-2, 2))
        : W - col * colW - w + Math.floor(rand(-2, 2));
      if (!big && Math.random() < 0.45) {
        blacks.push([x, y, w, h]);
      } else {
        ctx.globalAlpha = rand(0.75, 1);
        ctx.fillStyle = pick(paletteBag);
        ctx.fillRect(x, y, w, h);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    blacks.forEach(function (b) { ctx.fillRect(b[0], b[1], b[2], b[3]); });

    // Stuck rows: flicker, but never move
    drawStuck(damage.stuck.filter(function () { return Math.random() > 0.15; }));

    // Dead-pixel spray right in the broken corner
    var dots = Math.round(40 + intensity * 90);
    for (var d = 0; d < dots; d++) {
      var dx = nearEdge(W * 0.3);
      var size = Math.random() < 0.8 ? 1 : 2;
      ctx.fillStyle = pick(paletteBag);
      ctx.fillRect(Math.floor(damage.left ? dx : W - 1 - dx), Math.floor(H - 1 - nearEdge(H * 0.45)), size, size);
    }

    // A few hairline tears across the whole width
    var lines = Math.round(intensity * 4);
    for (var l = 0; l < lines; l++) {
      ctx.fillStyle = Math.random() < 0.6 ? '#000' : pick(paletteBag);
      ctx.fillRect(0, Math.floor(rand(0, H)), W, 1);
    }

    // The page underneath shudders and loses its colour balance
    viewport.style.transform = 'translate3d(' + Math.round(rand(-1, 1) * 24 * intensity) + 'px,0,0)';
    viewport.style.filter = 'hue-rotate(' + Math.round(rand(-60, 60)) + 'deg) saturate(' + rand(1.4, 2.6).toFixed(2) +
      ') contrast(' + rand(1.1, 1.6).toFixed(2) + ')';
  }

  function clear() {
    ctx.clearRect(0, 0, W, H);
    viewport.style.removeProperty('transform');
    viewport.style.removeProperty('filter');
    canvas.style.opacity = '0';
  }

  // ---------- Afterglow: the panel doesn't recover at once ----------
  // Two stuck rows stay on screen and fade over a few seconds; one gives up earlier
  var afterTimers = [];
  var AFTERGLOW_MS = 3200;

  function cancelAfterglow() {
    afterTimers.forEach(clearTimeout);
    afterTimers = [];
    canvas.style.transition = 'none';
  }

  function settle() {
    if (!damage || damage.stuck.length < 2) return;
    var rows = damage.stuck.slice(0, 2);
    ctx.clearRect(0, 0, W, H);
    drawStuck(rows);
    canvas.style.transition = 'none';
    canvas.style.opacity = '1';
    void canvas.offsetWidth; // commit opacity 1 before the transition starts
    canvas.style.transition = 'opacity ' + AFTERGLOW_MS + 'ms cubic-bezier(0.55, 0, 0.9, 0.4)';
    canvas.style.opacity = '0';
    afterTimers.push(setTimeout(function () {
      ctx.clearRect(0, 0, W, H);
      drawStuck(rows.slice(1));
    }, rand(700, 1500)));
    afterTimers.push(setTimeout(function () {
      ctx.clearRect(0, 0, W, H);
      canvas.style.transition = 'none';
    }, AFTERGLOW_MS + 50));
  }

  var playing = false;

  // One burst: stepped (not smooth) frames for a choppy, broken-signal feel
  function burst(duration, done) {
    var start = performance.now();
    canvas.style.opacity = '1';
    (function step() {
      var t = (performance.now() - start) / duration;
      if (t >= 1) { clear(); done(); return; }
      // Hits hard, then fades out unevenly
      var intensity = Math.min(1, t * 6) * (1 - t * 0.6) * rand(0.6, 1);
      drawFrame(intensity);
      setTimeout(step, rand(45, 85));
    })();
  }

  function glitch() {
    if (playing) return;
    playing = true;
    cancelAfterglow();
    resize();
    breakPanel(); // the aftershock below reuses the same broken corner
    var end = function () { playing = false; settle(); };
    burst(rand(380, 560), function () {
      // Sometimes the signal drops once more right after
      if (Math.random() < 0.55) {
        setTimeout(function () { burst(rand(90, 160), end); }, rand(120, 260));
      } else {
        end();
      }
    });
  }

  // ---------- Triggers: rare, and only while the visitor is actually scrolling ----------
  var lastY = window.scrollY;
  var travelled = 0;
  var nextAllowed = performance.now() + 2500;
  var first = true;

  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    travelled += Math.abs(y - lastY);
    lastY = y;
    if (playing || travelled < window.innerHeight * 1.1) return;
    travelled = 0;
    var now = performance.now();
    if (now < nextAllowed) return;
    // The first long scroll always glitches so the effect is discovered; later ones are a coin flip
    if (first || Math.random() < CHANCE) {
      first = false;
      nextAllowed = now + rand(COOLDOWN[0], COOLDOWN[1]);
      glitch();
    }
  }, { passive: true });

  window.addEventListener('resize', resize);
  resize();

  // Handy for tuning from the console: __glitch() plays one, __glitch.freeze(0..1) holds a frame
  window.__glitch = glitch;
  glitch.freeze = function (intensity) {
    resize();
    breakPanel();
    canvas.style.opacity = '1';
    drawFrame(intensity === undefined ? 1 : intensity);
  };
  glitch.clear = function () { cancelAfterglow(); clear(); };
})();
