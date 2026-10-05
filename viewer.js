/* Клиентская часть копии: масштаб холста, слайдшоу, анимации Readymag. */
(function () {
  'use strict';

  var PHONE_BREAK = 640;

  /* ---------- масштаб холста ---------- */

  function canvasWidth() {
    return window.innerWidth <= PHONE_BREAK ? 320 : 1024;
  }

  function fit() {
    var vw = window.innerWidth || document.documentElement.clientWidth;
    if (!vw) return;
    document.documentElement.style.setProperty('--zoom', vw / canvasWidth());
  }

  fit();
  window.addEventListener('resize', fit);

  /* ---------- слайдшоу ---------- */

  function initSlideshow(el) {
    var slides = el.querySelectorAll('.ss-slide');
    if (slides.length < 2) return;

    var counter = el.querySelector('.ss-count');
    var mode = el.dataset.play || 'autoplay';
    var fps = parseFloat(el.dataset.fps || '0.8');
    // Превью в таблице работ заданы 0.1–0.5 с/кадр — «риффл»-мельтешение.
    // Держим читаемый нижний порог (родное hover_frame_rate), большие галереи (3–4 с) не трогаем.
    var MIN_DELAY = 800;
    var delay = Math.max(parseFloat(el.dataset.delay || '2') * 1000, MIN_DELAY);
    var i = 0;
    var timer = null;

    function show(next) {
      var prev = slides[i];
      i = (next + slides.length) % slides.length;
      prev.classList.remove('on');
      prev.classList.add('out');
      slides[i].classList.remove('out');
      slides[i].classList.add('on');
      window.setTimeout(function () {
        prev.classList.remove('out');
      }, 800);
      if (counter) counter.textContent = i + 1 + '/' + slides.length;
    }

    function start(ms) {
      stop();
      timer = window.setInterval(function () {
        show(i + 1);
      }, ms);
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }

    if (mode === 'autoplay') {
      start(delay);
    } else if (mode === 'hover') {
      el.addEventListener('mouseenter', function () {
        start(1000 / Math.max(fps, 0.1));
      });
      el.addEventListener('mouseleave', stop);
    } else if (mode === 'click') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () {
        show(i + 1);
      });
    }
  }

  /* ---------- анимации ---------- */

  var byId = {};
  document.querySelectorAll('.w[data-id]').forEach(function (el) {
    byId[el.dataset.id] = el;
  });

  function transitionOf(a) {
    return ['opacity', 'transform'].map(function (p) {
      return p + ' ' + a.duration + 's ' + ease(a.ease) + ' ' + a.delay + 's';
    }).join(',');
  }

  function ease(name) {
    return name === 'ease-both' ? 'ease-in-out' : name === 'linear' ? 'linear' : 'ease';
  }

  /* Анимации типа load играют один раз при открытии страницы, не по скроллу. */
  var loadQueue = [];

  function applyLoad(el, a) {
    if (a.fromOpacity === null) return;
    el.style.opacity = a.fromOpacity / 100;
    loadQueue.push(function () {
      el.style.transition = transitionOf(a);
      el.style.opacity = a.opacity / 100;
    });
  }

  function runLoadQueue() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        loadQueue.forEach(function (fn) {
          fn();
        });
        loadQueue = [];
      });
    });
  }

  function applyHover(el, a) {
    var from = a.fromOpacity === null ? null : a.fromOpacity / 100;
    var to = a.opacity === null ? null : a.opacity / 100;
    var scaleTo = a.scale === null ? null : a.scale / 100;

    if (from !== null) el.style.opacity = from;
    el.style.transition = transitionOf(a);

    var triggers = a.trigger.length
      ? a.trigger.map(function (id) { return byId[id]; }).filter(Boolean)
      : [el];

    triggers.forEach(function (t) {
      t.addEventListener('mouseenter', function () {
        if (to !== null) el.style.opacity = to;
        if (scaleTo !== null) el.style.transform = 'scale(' + scaleTo + ')';
        if (scaleTo !== null) el.style.zIndex = 9999;
      });
      t.addEventListener('mouseleave', function () {
        if (from !== null) el.style.opacity = from;
        if (scaleTo !== null) el.style.transform = '';
        if (scaleTo !== null) el.style.zIndex = '';
      });
    });
  }

  /* Клик по одному виджету переключает состояние другого (раскрытие текста). */
  function applyClick(el, a) {
    var from = a.fromOpacity === null ? null : a.fromOpacity / 100;
    var to = a.opacity === null ? null : a.opacity / 100;
    if (from !== null) el.style.opacity = from;
    el.style.transition = transitionOf(a);

    var triggers = a.trigger.length
      ? a.trigger.map(function (id) { return byId[id]; }).filter(Boolean)
      : [el];
    var open = false;

    triggers.forEach(function (t) {
      t.style.cursor = 'pointer';
      t.addEventListener('click', function () {
        open = !open;
        if (to !== null) el.style.opacity = open ? to : from;
      });
    });
  }

  function applyLoop(el, a) {
    var dur = a.duration || 2;
    if (a.rotate !== null) {
      el.style.setProperty('--rot-from', (a.fromRotate || 0) + 'deg');
      el.style.setProperty('--rot-to', a.rotate + 'deg');
      el.style.animation = 'rm-swing-rotate ' + dur + 's ease-in-out infinite alternate';
    } else if (a.scale !== null) {
      el.style.setProperty('--sc-from', (a.fromScale || 100) / 100);
      el.style.setProperty('--sc-to', a.scale / 100);
      el.style.animation = 'rm-swing-scale ' + dur + 's ease-in-out infinite alternate';
    } else if (a.dx !== null || a.dy !== null) {
      el.style.setProperty('--mv-x', (a.dx || 0) + 'px');
      el.style.setProperty('--mv-y', (a.dy || 0) + 'px');
      el.style.animation = 'rm-swing-move ' + dur + 's ease-in-out infinite alternate';
    }
  }

  var parallax = [];

  function applyScroll(el, a) {
    parallax.push({ el: el, speed: (a.speed || 0) / 100, base: parseFloat(getComputedStyle(el).top) || 0 });
  }

  document.querySelectorAll('.w[data-anim]').forEach(function (el) {
    var list;
    try {
      list = JSON.parse(el.dataset.anim);
    } catch (e) {
      return;
    }
    list.forEach(function (a) {
      if (a.loop === 'swing') applyLoop(el, a);
      else if (a.type === 'load') applyLoad(el, a);
      else if (a.type === 'hover') applyHover(el, a);
      else if (a.type === 'click') applyClick(el, a);
      else if (a.type === 'scroll') applyScroll(el, a);
    });
  });

  if (parallax.length) {
    window.addEventListener(
      'scroll',
      function () {
        var y = window.scrollY;
        parallax.forEach(function (p) {
          p.el.style.transform = 'translateY(' + -y * p.speed + 'px)';
        });
      },
      { passive: true }
    );
  }

  runLoadQueue();

  document.querySelectorAll('.w-slideshow').forEach(initSlideshow);

  /* ---------- видео (HLS) ---------- */

  var videos = document.querySelectorAll('.w-video video[data-src]');
  if (videos.length) {
    videos.forEach(function (v) {
      var src = v.dataset.src;
      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
      } else if (window.Hls && window.Hls.isSupported()) {
        var hls = new window.Hls();
        hls.loadSource(src);
        hls.attachMedia(v);
      } else {
        v.parentElement.classList.add('missing');
      }
      v.addEventListener('error', function () {
        v.parentElement.classList.add('missing');
      });
    });
  }
})();
