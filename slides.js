'use strict';

let idx = 0;
const slides = Array.from(document.querySelectorAll('section.slide'));
const scrubber = document.getElementById('slide-scrubber');
const sliderCounter = document.getElementById('slider-counter');
const sliderProgress = document.querySelector('.slider-progress');
const sliderThumb = document.querySelector('.slider-thumb');
const announcer = document.getElementById('slide-announcer');
let announceTimer = null;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fragsOf(slide) {
  return Array.from(slide.querySelectorAll('.frag'));
}

function syncSlider() {
  if (sliderCounter) sliderCounter.textContent = (idx + 1) + ' / ' + slides.length;
  if (scrubber) scrubber.value = String(idx + 1);
  const progress = ((idx + 1) / slides.length) * 100;
  if (sliderProgress) sliderProgress.style.width = progress + '%';
  if (sliderThumb) sliderThumb.style.left = 'calc(' + progress + '% - 5px)';
}

function show(i, revealAll) {
  const next = clamp(i, 0, slides.length - 1);
  slides[idx].classList.remove('active');
  idx = next;
  const slide = slides[idx];
  slide.classList.add('active');
  fragsOf(slide).forEach(f => f.classList.toggle('visible', !!revealAll));
  syncSlider();
  history.replaceState(null, '', '#' + (idx + 1));

  const focusTarget = slide.querySelector('.content');
  if (focusTarget && document.activeElement !== scrubber) {
    focusTarget.setAttribute('tabindex', '-1');
    focusTarget.focus({ preventScroll: true });
  }

  if (announcer) {
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const label = slide.getAttribute('aria-label') || ('Slide ' + (idx + 1));
      announcer.textContent = 'Slide ' + (idx + 1) + ' of ' + slides.length + ': ' + label;
    }, 120);
  }
}

function advance() {
  const frags = fragsOf(slides[idx]);
  const hidden = frags.filter(f => !f.classList.contains('visible'));
  if (hidden.length) {
    hidden[0].classList.add('visible');
  } else if (idx < slides.length - 1) {
    show(idx + 1, false);
  }
}

function retreat() {
  const frags = fragsOf(slides[idx]);
  const shown = frags.filter(f => f.classList.contains('visible'));
  if (shown.length) {
    shown[shown.length - 1].classList.remove('visible');
  } else if (idx > 0) {
    show(idx - 1, true);
  }
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function() {});
    }
  } catch (err) {}
}

document.addEventListener('keydown', function(e) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); advance(); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); retreat(); }
  if (e.key === 'Home') { e.preventDefault(); show(0, false); }
  if (e.key === 'End') { e.preventDefault(); show(slides.length - 1, true); }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
});

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnFullscreen = document.getElementById('btn-fullscreen');
if (btnPrev) btnPrev.addEventListener('click', retreat);
if (btnNext) btnNext.addEventListener('click', advance);
if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

if (scrubber) {
  scrubber.min = 1;
  scrubber.max = slides.length;
  scrubber.step = 1;
  scrubber.addEventListener('input', function(e) {
    show(parseInt(e.target.value, 10) - 1, true);
  });
}

let tx = 0, ty = 0, swipeOk = false;

document.addEventListener('touchstart', function(e) {
  if (e.touches.length !== 1 || e.target === scrubber || e.target.closest('.sticky-footer')) {
    swipeOk = false;
    return;
  }
  tx = e.touches[0].clientX;
  ty = e.touches[0].clientY;
  swipeOk = true;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
  if (!swipeOk || e.touches.length !== 1) return;
  if (Math.abs(e.touches[0].clientY - ty) > Math.abs(e.touches[0].clientX - tx) * 1.5) swipeOk = false;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  if (!swipeOk) return;
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) >= 48 && Math.abs(dx) >= Math.abs(dy) * 1.2) {
    dx < 0 ? advance() : retreat();
  }
  swipeOk = false;
}, { passive: true });

window.addEventListener('hashchange', function() {
  const m = location.hash.match(/^#(\d+)$/);
  if (m) show(parseInt(m[1], 10) - 1, true);
});

slides.forEach((s, i) => s.setAttribute('data-slide-num', i + 1));
const m = location.hash.match(/^#(\d+)$/);
show(m ? clamp(parseInt(m[1], 10) - 1, 0, slides.length - 1) : 0, false);

// Sandbox screenshot carousel (self-contained; does not touch deck navigation)
(function initShotCarousel() {
  const car = document.querySelector('.shot-carousel');
  if (!car) return;
  const items = Array.from(car.querySelectorAll('.shot-slide'));
  const pips = Array.from(car.querySelectorAll('.shot-pip'));
  const cap = document.getElementById('sandboxCap');
  const interval = parseInt(car.getAttribute('data-interval'), 10) || 5000;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ci = 0, timer = null;

  function go(i) {
    ci = (i + items.length) % items.length;
    items.forEach((s, k) => s.classList.toggle('is-active', k === ci));
    pips.forEach((p, k) => {
      p.classList.toggle('is-active', k === ci);
      p.setAttribute('aria-selected', k === ci ? 'true' : 'false');
    });
    if (cap && pips[ci]) cap.textContent = pips[ci].getAttribute('data-cap');
  }
  function start() { if (reduce) return; stop(); timer = setInterval(() => go(ci + 1), interval); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  pips.forEach((p, k) => p.addEventListener('click', () => { go(k); start(); }));
  car.addEventListener('pointerenter', stop);
  car.addEventListener('pointerleave', start);
  go(0);
  start();
})();
