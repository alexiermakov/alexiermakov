// Scroll-driven scene: the 9 Figma frames (Desktop 1–9) are keyframes.
// Every item has a position per frame; scrolling interpolates between them.
// Rendered 1:1 (no scaling): x follows Figma's "N% + px" constraints, y is px from the top.
(function () {
  'use strict';

  var DESIGN_H = 1024;
  var FRAMES = 9;
  var DESKTOP = window.matchMedia('(min-width: 1024px)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  var scene = document.getElementById('scene');
  var $ = function (id) { return document.getElementById(id); };

  // Decorative repeats not worth hand-writing in the markup
  (function fillRepeats() {
    var row = document.querySelector('.bars__row');
    var pointer = row.querySelector('.bars__pointer');
    for (var i = 0; i < 23; i++) row.insertBefore(document.createElement('i'), pointer);
    var dots = document.querySelector('.trade__dots');
    for (var j = 0; j < 30; j++) dots.appendChild(document.createElement('i'));
  })();

  // x as [fraction of viewport width, px] — the left edge of the item
  function X(f, px) { return [f, px]; }
  function repeat(v, n) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  // Card keyframes per frame. y is the top edge in design px;
  // 'peek' = anchored to the viewport bottom in frame 1, values ≥ DESIGN_H are below the fold.
  var CARDS = {
    steps:    { x: [X(0.375, -98), X(0.375, -122.63)].concat(repeat(X(0.25, -109), 7)),
                y: ['peek', 356, 114, 114, -200, -200, -200, -200, -200],
                s: [0.6484, 1, 1, 1, 1, 1, 1, 1, 1] },
    phone:    { x: repeat(X(0.375, -118), 4).concat(repeat(X(0.2917, -54), 5)),
                y: [1500, 583, 197, 197, -117, -476, -980, -980, -980] },
    ai:       { x: repeat(X(0.4167, 122), 9), y: [1600, 1300, 624, 624, 310, -49, -553, -553, -553] },
    trade:    { x: repeat(X(0.4583, -145), 4).concat(repeat(X(0.375, -72), 5)),
                y: [1600, 1500, 1300, 907, 593, 234, -270, -270, -270] },
    bars:     { x: repeat(X(0.5, -200), 9), y: [1700, 1600, 1400, 1150, 878, 519, 15, -421, -421] },
    margin:   { x: repeat(X(0.25, 157), 9), y: [1800, 1700, 1500, 1300, 1100, 796, 292, -144, -496] },
    withdraw: { x: repeat(X(0.5, -79), 9), y: [1900, 1800, 1600, 1400, 1250, 1100, 850, 414, 62] },
    // Tiny below-the-fold widget in frames 1–6 that grows into the big card
    streak:   { x: repeat(X(0.375, -46.15), 6).concat(repeat(X(0.375, -143), 3)),
                y: [1062.5, 1062.5, 1062.5, 1062.5, 1062.5, 1062.5, 639, 203, -149],
                s: [0.368, 0.368, 0.368, 0.368, 0.368, 0.368, 1, 1, 1] },
    wolves:   { x: repeat(X(0.7083, -153), 9), y: [1900, 1800, 1700, 1500, 1300, 1150, 914, 478, 126] },
    // Money peeks up from the bottom edge in frame 8 and rises fully in frame 9, with
    // To Do beside it. 'bN' = top edge N px above the viewport bottom (793 of 1024 in
    // Figma is 'b231'), so they keep their place on viewports of any height; '|M' keeps
    // them 16px clear of the card above (withdraw ends at 576 / 224, streak at 100).
    // x matches Figma at 1920 and spreads them apart on narrower screens, so To Do,
    // Money and the wolves stay side by side instead of overlapping.
    money:    { x: repeat(X(0.55, -248), 9), y: repeat(1900, 6).concat([1229, 'b231|592', 'b583|240']) },
    todo:     { x: repeat(X(0.45, -460), 9), y: repeat(1900, 6).concat([1500, 1100, 'b441|116']) }
  };

  var items = Object.keys(CARDS).map(function (id) {
    return { el: $(id), kf: CARDS[id] };
  });

  var intro = $('intro');
  var avatar = $('avatar');
  var contacts = $('contacts');
  var cLine = contacts.querySelector('.contacts__line');
  var cExtra = contacts.querySelector('.contacts__extra');

  var W = 0;
  var H = DESIGN_H;
  var segment = 1; // scroll px per frame-to-frame step
  var current = 0; // smoothed progress, 0 … FRAMES - 1
  var target = 0;
  var running = false;
  var headKf = null;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function px(x) { return x[0] * W + x[1]; }

  function resolveY(y) {
    // Frame 1 peek: the steps card shows its top 85px above the viewport bottom (939 of 1024)
    if (y === 'peek') return H - (DESIGN_H - 939);
    // 'bN|M': top edge N px above the viewport bottom, whatever the viewport height,
    // but never above M (so on short viewports it doesn't slide over the card above)
    if (typeof y === 'string') {
      var parts = y.slice(1).split('|');
      return Math.max(H - parseFloat(parts[0]), parseFloat(parts[1] || -Infinity));
    }
    // Items still below the fold must stay below it on viewports taller than the design
    return y >= DESIGN_H ? y + Math.max(0, H - DESIGN_H) : y;
  }

  function at(arr, i, t, map) {
    if (!arr) return undefined;
    var a = arr[i];
    var b = arr[Math.min(i + 1, arr.length - 1)];
    return map ? lerp(map(a), map(b), t) : lerp(a, b, t);
  }

  function place(el, x, y, s, o) {
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)' + (s !== undefined && s !== 1 ? ' scale(' + s + ')' : '');
    if (o !== undefined) {
      el.style.opacity = o;
      el.style.pointerEvents = o < 0.05 ? 'none' : '';
    }
  }

  function measureHead() {
    var introH = intro.offsetHeight; // includes the 24px top padding
    var avatarY = introH + 40;
    var contactsH = contacts.offsetHeight;
    // Frame 1: the column ends 114px above the viewport bottom (910 of 1024), never over the photo
    var contactsY1 = Math.max(avatarY + 90 + 40, H - (DESIGN_H - 910) - contactsH);
    var left = 0.25 * W + 46;
    headKf = {
      intro:    { x: [left, left], y: [0, -420], o: [1, 0] },
      avatar:   { x: [left, left, 0.9167 * W - 5], y: [avatarY, 24, 24] },
      // Frame 2: under the photo; frame 3+: only the links line, top-left
      contacts: { x: [left, left, 0.0833 * W + 53.5 - cLine.offsetWidth / 2], y: [contactsY1, 154, 0] },
      extra:    [1, 1, 0]
    };
  }

  function render(p) {
    var i = Math.min(Math.floor(p), FRAMES - 2);
    var t = p - i;

    items.forEach(function (it) {
      place(it.el, at(it.kf.x, i, t, px), at(it.kf.y, i, t, resolveY), at(it.kf.s, i, t));
    });

    // Header items only change during the first two steps
    var hi = Math.min(Math.floor(p), 1);
    var ht = Math.min(p - hi, 1);
    var k = headKf;
    var pick = function (arr) { return arr.length > hi + 1 ? lerp(arr[hi], arr[hi + 1], ht) : arr[arr.length - 1]; };

    place(intro, pick(k.intro.x), pick(k.intro.y), 1, pick(k.intro.o));
    place(avatar, pick(k.avatar.x), pick(k.avatar.y));
    place(contacts, pick(k.contacts.x), pick(k.contacts.y));
    cExtra.style.opacity = pick(k.extra);
    cExtra.style.pointerEvents = pick(k.extra) < 0.05 ? 'none' : '';
  }

  function tick() {
    var diff = target - current;
    current = REDUCED.matches || Math.abs(diff) < 0.0005 ? target : current + diff * 0.14;
    render(current);
    if (current !== target) requestAnimationFrame(tick);
    else running = false;
  }

  function onScroll() {
    target = Math.max(0, Math.min(FRAMES - 1, window.scrollY / segment));
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  // Reset only what this script sets (cards.js owns other inline styles, e.g. clip-path)
  function clearInline() {
    [scene, intro, avatar, contacts, cExtra].concat(items.map(function (it) { return it.el; }))
      .forEach(function (el) {
        ['height', 'transform', 'opacity', 'pointer-events', 'zoom'].forEach(function (prop) {
          el.style.removeProperty(prop);
        });
      });
  }

  function fitCardsToColumn() {
    var room = document.documentElement.clientWidth - 32;
    items.forEach(function (it) {
      var w = it.el.offsetWidth;
      if (w > room) it.el.style.zoom = room / w;
    });
  }

  function layout() {
    clearInline();
    if (!DESKTOP.matches) {
      window.removeEventListener('scroll', onScroll);
      fitCardsToColumn();
      return;
    }

    W = document.documentElement.clientWidth;
    H = window.innerHeight;
    segment = H * 0.75;
    scene.style.height = H + segment * (FRAMES - 1) + 'px';

    measureHead();
    window.addEventListener('scroll', onScroll, { passive: true });
    target = current = Math.max(0, Math.min(FRAMES - 1, window.scrollY / segment));
    render(current);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 100);
  });
  DESKTOP.addEventListener('change', layout);

  layout();
  // Text metrics change once Geist arrives
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
