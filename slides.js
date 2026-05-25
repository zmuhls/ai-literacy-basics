'use strict';

let idx = 0;
const slides = Array.from(document.querySelectorAll('section.slide'));
const scrubber = document.getElementById('slide-scrubber');
const sliderCounter = document.getElementById('slider-counter');
const sliderProgress = document.querySelector('.slider-progress');
const sliderThumb = document.querySelector('.slider-thumb');
const lightbox = document.getElementById('image-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const announcer = document.getElementById('slide-announcer');
const leafletMaps = window.__deckLeafletMaps || (window.__deckLeafletMaps = []);
let announceTimer = null;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fragsOf(slide) {
  return Array.from(slide.querySelectorAll('.frag'));
}

function refreshSlideMedia(slide, delays) {
  var waitSteps = Array.isArray(delays) && delays.length ? delays : [0];
  waitSteps.forEach(function(delay) {
    setTimeout(function() {
      leafletMaps.forEach(function(map) {
        try {
          map.invalidateSize(false);
          if (typeof map.__deckRefit === 'function') map.__deckRefit();
        } catch (e) {}
      });
      var canv = slide.querySelector('canvas');
      if (canv && typeof canv.__deckResize === 'function') {
        try { canv.__deckResize(); } catch (e) {}
      }
    }, delay);
  });
}

function ensureSlideEnhancements(slide) {
  if (!slide) return;
  if (slide.dataset.slide === 'campus-map' && typeof window.__deckCreateCampusMap === 'function') {
    window.__deckCreateCampusMap();
  }
}

function show(i, revealAll) {
  var next = clamp(i, 0, slides.length - 1);
  var prevSlide = slides[idx];
  var nextSlide = slides[next];
  // Kill gallery timers and reset init flag so they reinitialize on re-entry
  prevSlide.querySelectorAll('.stage-gallery').forEach(function(g) {
    if (g._timer) { clearInterval(g._timer); g._timer = null; }
    delete g.dataset.init;
  });
  prevSlide.classList.remove('active');
  idx = next;
  nextSlide.classList.add('active');
  fragsOf(nextSlide).forEach(function(f) { f.classList.toggle('visible', !!revealAll); });

  ensureSlideEnhancements(nextSlide);

  if (sliderCounter) sliderCounter.textContent = (idx + 1) + ' / ' + slides.length;
  if (scrubber) scrubber.value = String(idx + 1);

  var progress = ((idx + 1) / slides.length) * 100;
  if (sliderProgress) sliderProgress.style.width = progress + '%';
  if (sliderThumb) sliderThumb.style.left = 'calc(' + progress + '% - 10px)';

  history.replaceState(null, '', '#' + (idx + 1));

  var f = nextSlide.querySelector('.content');
  if (f && document.activeElement !== scrubber) {
    f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  }

  initGalleries(nextSlide);

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      refreshSlideMedia(nextSlide, [0, 80, 220, 700]);
    });
  });

  if (announcer) {
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(function() {
      var label = nextSlide.getAttribute('aria-label') || ('Slide ' + (idx + 1));
      announcer.textContent = 'Slide ' + (idx + 1) + ' of ' + slides.length + ': ' + label;
    }, 140);
  }
}

function advance() {
  var frags = fragsOf(slides[idx]);
  var hidden = frags.filter(function(f) { return !f.classList.contains('visible'); });
  if (hidden.length) {
    var frag = hidden[0];
    frag.classList.add('visible');
    syncGalleryForward(frag, slides[idx]);
  } else if (idx < slides.length - 1) {
    show(idx + 1);
  }
}

function retreat() {
  var frags = fragsOf(slides[idx]);
  var shown = frags.filter(function(f) { return f.classList.contains('visible'); });
  if (shown.length) {
    var frag = shown[shown.length - 1];
    frag.classList.remove('visible');
    syncGalleryBackward(frag, slides[idx]);
  } else if (idx > 0) {
    show(idx - 1, true);
  }
}

/* ── Gallery ↔ fragment sync ── */
function syncGalleryForward(frag, slide) {
  var gallery = slide.querySelector('.stage-gallery');
  if (!gallery) return;
  if (frag.dataset.startGallery !== undefined) {
    startGalleryTimer(gallery);
  }
  if (frag.dataset.galleryIdx !== undefined) {
    showGalleryItem(gallery, parseInt(frag.dataset.galleryIdx, 10));
  }
}

function syncGalleryBackward(frag, slide) {
  var gallery = slide.querySelector('.stage-gallery');
  if (!gallery) return;
  if (frag.dataset.startGallery !== undefined && gallery._timer) {
    clearInterval(gallery._timer);
    gallery._timer = null;
    showGalleryItem(gallery, 0);
  }
  if (frag.dataset.galleryIdx !== undefined) {
    var visible = fragsOf(slide).filter(function(f) {
      return f.classList.contains('visible') && f.dataset.galleryIdx !== undefined;
    });
    showGalleryItem(gallery, visible.length
      ? parseInt(visible[visible.length - 1].dataset.galleryIdx, 10) : 0);
  }
}

function closeLightbox() {
  if (!lightbox || !lightbox.classList.contains('open')) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  lightboxImage.src = '';
  lightboxImage.alt = '';
  lightboxCaption.textContent = '';
}

function openLightbox(img) {
  if (!lightbox || !img) return;
  var captionEl = img.closest('figure') ? img.closest('figure').querySelector('figcaption') : null;
  var captionText = captionEl ? (captionEl.textContent || '').trim() : '';
  lightboxImage.src = img.currentSrc || img.src;
  lightboxImage.alt = img.alt || captionText || 'Zoomed slide image';
  lightboxCaption.textContent = captionText || img.alt || '';
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  if (lightboxClose) lightboxClose.focus({ preventScroll: true });
}

function toggleOverview() {
  var on = document.body.classList.toggle('overview');
  if (on) {
    slides[idx].scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}

/* ── Gallery (multi-image carousel in stage) ── */
function initGalleries(slide) {
  var galleries = slide.querySelectorAll('.stage-gallery');
  galleries.forEach(function(gallery) {
    if (gallery.dataset.init) return;
    gallery.dataset.init = '1';
    var items = gallery.querySelectorAll('.gallery-item');
    var dots = gallery.querySelector('.gallery-dots');
    if (!dots || items.length < 2) return;
    dots.innerHTML = '';
    items.forEach(function(item, i) {
      var dot = document.createElement('button');
      dot.className = 'gallery-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Image ' + (i + 1) + ' of ' + items.length);
      dot.addEventListener('click', function() { showGalleryItem(gallery, i); });
      dots.appendChild(dot);
    });
    if ('fragSync' in gallery.dataset) return;
    startGalleryTimer(gallery);
  });
}

function showGalleryItem(gallery, i) {
  var items = gallery.querySelectorAll('.gallery-item');
  var dots = gallery.querySelectorAll('.gallery-dot');
  items.forEach(function(item, j) { item.classList.toggle('active', j === i); });
  dots.forEach(function(dot, j) { dot.classList.toggle('active', j === i); });
}

/* ── Event listeners ── */
slides.forEach(function(s, i) {
  s.setAttribute('data-slide-num', i + 1);
  var title = s.querySelector('.content h1');
  if (s.classList.contains('placeholder-slide')) {
    var headingLen = title ? (title.textContent || '').trim().length : 0;
    var subtitle = s.querySelector('.content h2');
    var subtitleLen = subtitle ? (subtitle.textContent || '').trim().length : 0;
    var bullets = Array.from(s.querySelectorAll('.content li'));
    var bulletChars = bullets.reduce(function(sum, li) {
      return sum + ((li.textContent || '').trim().length);
    }, 0);
    var quoteChars = Array.from(s.querySelectorAll('.content blockquote')).reduce(function(sum, q) {
      return sum + ((q.textContent || '').trim().length);
    }, 0);
    var score = headingLen * 1.15 + subtitleLen * 0.7 + bulletChars + quoteChars * 1.2;
    if (headingLen > 52 || score > 320) s.classList.add('crowded');
    if (score > 230 || bullets.length >= 5 || quoteChars > 110) s.classList.add('needs-split-review');
    if (score > 320 || bullets.length >= 7 || quoteChars > 180) s.classList.add('force-single-panel');
  }
  s.addEventListener('click', function() {
    if (!document.body.classList.contains('overview')) return;
    document.body.classList.remove('overview');
    show(i, true);
  });
});

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
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (document.body.classList.contains('blanked')) { document.body.classList.remove('blanked'); return; }
    if (lightbox && lightbox.classList.contains('open')) { closeLightbox(); return; }
    toggleOverview();
    return;
  }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); return; }
  if (e.key === 'b' || e.key === 'B' || e.key === '.') {
    e.preventDefault();
    document.body.classList.toggle('blanked');
    if (announcer) announcer.textContent = document.body.classList.contains('blanked') ? 'Screen blanked' : 'Screen restored';
    return;
  }
  if (lightbox && lightbox.classList.contains('open')) return;
  if (document.body.classList.contains('overview')) return;
  if (['ArrowRight','PageDown',' '].includes(e.key)) { e.preventDefault(); advance(); }
  if (['ArrowLeft','PageUp'].includes(e.key)) { e.preventDefault(); retreat(); }
  if (e.key === 'Home') { e.preventDefault(); show(0); }
  if (e.key === 'End') { e.preventDefault(); show(slides.length - 1, true); }
});

var btnPrev = document.getElementById('btn-prev');
var btnNext = document.getElementById('btn-next');
var btnFullscreen = document.getElementById('btn-fullscreen');
if (btnPrev) btnPrev.addEventListener('click', retreat);
if (btnNext) btnNext.addEventListener('click', advance);
if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

if (scrubber) {
  scrubber.min = 1;
  scrubber.max = slides.length;
  scrubber.step = 1;
  scrubber.addEventListener('input', function(e) {
    show(parseInt(e.target.value) - 1, true);
  });
}

/* ── Touch / swipe ── */
var tx = 0, ty = 0, swipeOk = false;

document.addEventListener('touchstart', function(e) {
  if (e.touches.length !== 1 || e.target.closest('.stage') || e.target === scrubber || e.target.closest('.sticky-footer')) { swipeOk = false; return; }
  tx = e.touches[0].clientX; ty = e.touches[0].clientY; swipeOk = true;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
  if (!swipeOk || e.touches.length !== 1) return;
  if (Math.abs(e.touches[0].clientY - ty) > Math.abs(e.touches[0].clientX - tx) * 1.5) swipeOk = false;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  if (!swipeOk) return;
  var dx = e.changedTouches[0].clientX - tx;
  var dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) >= 48 && Math.abs(dx) >= Math.abs(dy) * 1.2) { dx < 0 ? advance() : retreat(); }
  else if (Math.abs(dx) < 16 && Math.abs(dy) < 16) { advance(); }
  swipeOk = false;
}, { passive: true });

/* ── Trackpad wheel ── */
var wheelLock = false;
document.addEventListener('wheel', function(e) {
  if (document.body.classList.contains('overview') || e.target === scrubber || e.target.closest('.sticky-footer') || wheelLock) return;
  var absX = Math.abs(e.deltaX), absY = Math.abs(e.deltaY);
  if (absX < 30 || absX < absY) return;
  wheelLock = true;
  e.deltaX > 0 ? advance() : retreat();
  setTimeout(function() { wheelLock = false; }, 400);
}, { passive: true });

document.addEventListener('click', function(e) {
  var img = e.target.closest('.stage img');
  if (img && !document.body.classList.contains('overview')) {
    e.preventDefault();
    e.stopPropagation();
    openLightbox(img);
    return;
  }
  if (lightbox && e.target === lightbox) closeLightbox();
});

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

function startGalleryTimer(gallery) {
  if (gallery._timer || document.hidden) return;
  var items = gallery.querySelectorAll('.gallery-item');
  var interval = parseInt(gallery.dataset.interval || '6000', 10);
  gallery._timer = setInterval(function() {
    var cur = gallery.querySelector('.gallery-item.active');
    var curIdx = Array.from(items).indexOf(cur);
    showGalleryItem(gallery, (curIdx + 1) % items.length);
  }, interval);
}

document.addEventListener('visibilitychange', function() {
  var activeSlide = slides[idx];
  if (!activeSlide) return;
  activeSlide.querySelectorAll('.stage-gallery').forEach(function(g) {
    if (document.hidden) {
      if (g._timer) { clearInterval(g._timer); g._timer = null; g._wasRunning = true; }
    } else if (g._wasRunning && !('fragSync' in g.dataset)) {
      g._wasRunning = false;
      startGalleryTimer(g);
    }
  });
});

window.addEventListener('hashchange', function() {
  var m = location.hash.match(/^#(\d+)$/);
  if (m) show(parseInt(m[1], 10) - 1, true);
});

var m = location.hash.match(/^#(\d+)$/);
show(m ? clamp(parseInt(m[1], 10) - 1, 0, slides.length - 1) : 0, false);
