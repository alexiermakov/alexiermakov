// Experimental HUD homepage: boot sequence, text decode, live readouts, ticker.
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLYPHS = '█▓▒░/\\<>_#%&*01ЖШЩЮЯ';
  var $ = function (id) { return document.getElementById(id); };
  var rand = function (n) { return Math.floor(Math.random() * n); };

  // ---------- Decode: text assembles itself out of noise ----------
  var decodeTargets = Array.prototype.slice.call(document.querySelectorAll('[data-decode]'));
  decodeTargets.forEach(function (el) { el.dataset.text = el.textContent; });

  function scramble(text, revealed) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      out += i < revealed || ch === ' ' ? ch : GLYPHS[rand(GLYPHS.length)];
    }
    return out;
  }

  function decode(el, delay, duration) {
    var text = el.dataset.text;
    el.textContent = scramble(text, 0);
    el.style.visibility = 'hidden';
    setTimeout(function () {
      el.style.visibility = '';
      var start = performance.now();
      (function step() {
        var t = Math.min(1, (performance.now() - start) / duration);
        el.textContent = scramble(text, Math.floor(text.length * t));
        if (t < 1) setTimeout(step, 40);
      })();
    }, delay);
  }

  function runDecode() {
    decodeTargets.forEach(function (el, i) {
      var long = el.dataset.text.length > 60;
      decode(el, i * 90, long ? 1100 : 600);
    });
  }

  // ---------- Readouts ----------
  function countTo(el, to, duration, pad) {
    var start = performance.now();
    (function step() {
      var t = Math.min(1, (performance.now() - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(to * eased)).padStart(pad, '0');
      if (t < 1) setTimeout(step, 30);
    })();
  }

  var clock = $('clock');
  var fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function tickClock() { clock.textContent = fmt.format(new Date()); }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------- Ticker: seamless marquee that sometimes throws an ERROR ----------
  var ticker = $('ticker');
  var band = ticker.parentElement;
  var WORDS = 'ВЕДУЩИЙ_ПРОДУКТОВЫЙ_ДИЗАЙНЕР_ БАНКОВСКИЕ_ИНТЕРФЕЙСЫ_ 15+_ЛЕТ_В_ДИДЖИТАЛ_ ДАШБОРДЫ_ПЛАТЕЖИ_СПЕКИ_ ';
  function fillTicker(text) {
    // Two identical halves so translateX(-50%) loops without a seam
    var half = text.repeat(3);
    ticker.textContent = half + half;
  }
  fillTicker(WORDS);

  function scheduleError() {
    setTimeout(function () {
      band.classList.add('is-error');
      fillTicker('ERROR_ERROR_ERROR_RUNTIME_ ');
      setTimeout(function () {
        band.classList.remove('is-error');
        fillTicker(WORDS);
        scheduleError();
      }, 450);
    }, 9000 + rand(9000));
  }

  // ---------- Boot: counter 000 → 100, blue flash, hard cut ----------
  var boot = $('boot');

  function revealPage() {
    runDecode();
    countTo($('match'), 98, 1600, 3);
    if (!REDUCED) scheduleError();
  }

  function finishBoot() {
    if (boot.classList.contains('is-done')) return;
    boot.classList.add('is-flash');
    setTimeout(function () {
      boot.classList.add('is-done');
      if (window.__glitch) window.__glitch();
      revealPage();
    }, 90);
  }

  var seen = false;
  try { seen = sessionStorage.getItem('ae-boot') === '1'; sessionStorage.setItem('ae-boot', '1'); } catch (e) {}

  if (REDUCED || seen) {
    boot.classList.add('is-done');
    if (REDUCED) $('match').textContent = '098';
    else revealPage();
    return;
  }

  // Stepped, slightly uneven progress like a real loader
  var count = $('bootCount');
  var value = 0;
  (function load() {
    value = Math.min(100, value + 1 + rand(9));
    count.textContent = String(value).padStart(3, '0');
    if (value < 100) setTimeout(load, 40 + rand(70));
    else setTimeout(finishBoot, 260);
  })();
  boot.addEventListener('click', finishBoot);
  window.addEventListener('keydown', finishBoot, { once: true });
})();
