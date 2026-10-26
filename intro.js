// First screen entrance: the text comes in line by line (intro, then the photo, then
// the contacts), and once the last line is in, the first widget floats up from below.
// Words are wrapped one by one and grouped into lines by where they actually wrapped,
// so it follows the real line breaks at any width. The word spans stay afterwards;
// they are inline and don't change the layout.
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('reveal')) return;

  var LINE_GAP = 75;     // ms between lines
  var WIDGET_DELAY = 250; // ms after the last line starts before the widget rises

  function words(el) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!node.nodeValue.trim()) return;
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement('span');
        w.className = 'rv-w';
        w.textContent = part;
        frag.appendChild(w);
        out.push(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return out;
  }

  // Groups of words that sit on the same line, in reading order
  function lines(ws) {
    var groups = [];
    var lastTop = null;
    ws.forEach(function (w) {
      var top = Math.round(w.getBoundingClientRect().top);
      if (lastTop === null || Math.abs(top - lastTop) > 4) groups.push([]);
      groups[groups.length - 1].push(w);
      lastTop = top;
    });
    return groups;
  }

  function play() {
    var steps = [];
    var intro = document.querySelector('#intro .text');
    var avatar = document.getElementById('avatar');
    var contacts = document.getElementById('contacts');
    var widget = document.getElementById('steps');

    lines(words(intro)).forEach(function (l) { steps.push(l); });
    steps.push([avatar]);
    lines(words(contacts)).forEach(function (l) { steps.push(l); });

    steps.forEach(function (group, i) {
      group.forEach(function (el) { el.style.transitionDelay = i * LINE_GAP + 'ms'; });
    });

    // Next frame, so the hidden state is painted before the transitions start
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('reveal-go');
        var widgetAt = (steps.length - 1) * LINE_GAP + WIDGET_DELAY;
        if (widget) widget.style.transitionDelay = widgetAt + 'ms';
        // Tidy up once everything has landed
        setTimeout(function () {
          root.classList.remove('reveal', 'reveal-go');
          document.querySelectorAll('.rv-w').forEach(function (w) { w.style.transitionDelay = ''; });
          [avatar, widget].forEach(function (el) { if (el) el.style.transitionDelay = ''; });
        }, widgetAt + 1400);
      });
    });
  }

  // Line breaks depend on the web font, so wait for it (but not forever)
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(play);
})();
