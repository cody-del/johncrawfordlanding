const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-navigation');
const dropdowns = [...document.querySelectorAll('.nav-dropdown')];

if (menuToggle && navigation) {
function closeMenus(restoreFocus = false) {
  navigation.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  dropdowns.forEach(dropdown => { dropdown.open = false; });
  if (restoreFocus) menuToggle.focus();
}

menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  if (!open) dropdowns.forEach(dropdown => { dropdown.open = false; });
});

dropdowns.forEach(dropdown => {
  dropdown.addEventListener('toggle', () => {
    if (dropdown.open) dropdowns.forEach(other => {
      if (other !== dropdown) other.open = false;
    });
  });
});

navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenus();
});

document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenus();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (navigation.classList.contains('is-open')) closeMenus(true);
  else dropdowns.forEach(dropdown => {
    if (dropdown.open) {
      dropdown.open = false;
      dropdown.querySelector('summary').focus();
    }
  });
});

window.matchMedia('(min-width: 1024px)').addEventListener('change', () => closeMenus());
}
document.querySelector('#year').textContent = new Date().getFullYear();

document.querySelectorAll('[data-landing-dialog]').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.landingDialog)?.showModal();
  });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('.hero');
const heroVideo = document.querySelector('#hero-video');
const videoToggle = document.querySelector('.hero-video-toggle');
if (hero && heroVideo && videoToggle) {
const mobileVideo = window.matchMedia('(max-width: 700px)');
const connection = navigator.connection;
let wantsPlayback = !reduceMotion.matches && !connection?.saveData;
let heroVisible = true;
let userPaused = false;

function updateVideoLabel() {
  const label = wantsPlayback ? 'Pause background video' : 'Play background video';
  videoToggle.setAttribute('aria-label', label);
  videoToggle.title = label;
  videoToggle.dataset.playing = String(wantsPlayback);
}

function ensureVideoSource() {
  const source = mobileVideo.matches ? heroVideo.dataset.mobileSrc : heroVideo.dataset.desktopSrc;
  if (heroVideo.getAttribute('src') === source) return;
  heroVideo.closest('.hero-media').classList.remove('is-ready');
  heroVideo.src = source;
  heroVideo.load();
}

function syncVideoPlayback() {
  updateVideoLabel();
  if (!wantsPlayback || !heroVisible || document.hidden) {
    heroVideo.pause();
    return;
  }
  ensureVideoSource();
  heroVideo.play().catch(error => {
    if (error.name !== 'AbortError' && heroVisible && !document.hidden) {
      wantsPlayback = false;
      updateVideoLabel();
    }
  });
}

if (heroVideo.canPlayType('video/mp4')) {
  heroVideo.muted = true;
  heroVideo.defaultMuted = true;
  videoToggle.hidden = false;
  videoToggle.addEventListener('click', () => {
    wantsPlayback = !wantsPlayback;
    userPaused = !wantsPlayback;
    syncVideoPlayback();
  });
  heroVideo.addEventListener('playing', () => {
    heroVideo.closest('.hero-media').classList.add('is-ready');
  });
  heroVideo.addEventListener('error', () => {
    wantsPlayback = false;
    heroVideo.closest('.hero-media').classList.remove('is-ready');
    videoToggle.hidden = true;
  });
  reduceMotion.addEventListener('change', () => {
    wantsPlayback = !userPaused && !reduceMotion.matches && !connection?.saveData;
    syncVideoPlayback();
  });
  mobileVideo.addEventListener('change', syncVideoPlayback);
  document.addEventListener('visibilitychange', syncVideoPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      syncVideoPlayback();
    }, { threshold: 0 }).observe(hero);
  }
  syncVideoPlayback();
}
}

const reviewsSection = document.querySelector('.reviews');
const reviewsTrack = document.querySelector('.reviews-track');
const reviewCards = [...document.querySelectorAll('.review-card')];
const reviewPosition = document.querySelector('.reviews-position');
const reviewDialog = document.querySelector('#review-dialog');

if (reviewsSection && reviewsTrack && reviewCards.length) {
  reviewsSection.classList.add('is-ready');
  const previousReviews = document.querySelector('.reviews-previous');
  const nextReviews = document.querySelector('.reviews-next');
  const reviewStep = () => reviewCards[1].offsetLeft - reviewCards[0].offsetLeft;
  let reviewTarget = reviewsTrack.scrollLeft;

  function updateReviews() {
    reviewTarget = reviewsTrack.scrollLeft;
    const visibleCount = Math.min(reviewCards.length, Math.round(reviewsTrack.clientWidth / reviewStep()));
    const first = Math.min(reviewCards.length - visibleCount, Math.max(0, Math.round(reviewsTrack.scrollLeft / reviewStep())));
    reviewPosition.textContent = `${first + 1}–${Math.min(first + visibleCount, reviewCards.length)} of ${reviewCards.length}`;
    previousReviews.hidden = nextReviews.hidden = reviewCards.length <= visibleCount;
    reviewCards.forEach(card => {
      const quote = card.querySelector('.review-quote');
      card.querySelector('.review-read-more').hidden = quote.scrollHeight <= quote.clientHeight + 1;
    });
  }

  function moveReviews(direction) {
    const maxScroll = reviewsTrack.scrollWidth - reviewsTrack.clientWidth;
    let destination = reviewTarget + direction * reviewStep();
    if (direction > 0 && reviewTarget >= maxScroll - 2) destination = 0;
    if (direction < 0 && reviewTarget <= 2) destination = maxScroll;
    reviewTarget = Math.max(0, Math.min(maxScroll, destination));
    reviewsTrack.scrollTo({ left: reviewTarget, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  }

  previousReviews.addEventListener('click', () => moveReviews(-1));
  nextReviews.addEventListener('click', () => moveReviews(1));
  reviewsTrack.addEventListener('keydown', event => {
    if (event.target !== reviewsTrack || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    moveReviews(event.key === 'ArrowRight' ? 1 : -1);
  });
  let reviewScrollTimer;
  reviewsTrack.addEventListener('scroll', () => {
    clearTimeout(reviewScrollTimer);
    reviewScrollTimer = setTimeout(updateReviews, 150);
  }, { passive: true });
  new ResizeObserver(updateReviews).observe(reviewsTrack);
  document.fonts.ready.then(updateReviews);

  reviewCards.forEach(card => {
    card.querySelector('.review-read-more').addEventListener('click', () => {
      document.querySelector('#review-dialog-name').textContent = card.querySelector('.review-name').textContent;
      document.querySelector('.review-dialog-quote').textContent = card.querySelector('.review-quote').textContent;
      reviewDialog.showModal();
    });
  });
  updateReviews();
}

// Lead forms post to /api/lead (netlify/functions/lead.mjs), which sends the lead to GoHighLevel.
// netlify/lib/lead.mjs refuses anything sent sooner than this after the page loads.
const LEAD_MIN_FILL_MS = 3000;
const LEAD_CALL_US = 'We couldn’t confirm your request. Please call (818) 884-5464 before sending it again.';
document.querySelectorAll('form[data-lead-form]').forEach(form => {
  const status = form.querySelector('.lead-form-status');
  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = button.textContent;
  const fields = [...form.querySelectorAll('input:not([type="radio"]):not([name="website"]), select, textarea')];
  let pending = false;

  function problem(field) {
    const value = field.value.trim();
    if (!value) return field.required ? 'Please complete the ' + field.labels[0].textContent.toLowerCase() + ' field.' : '';
    if (field.type === 'email' && !field.validity.valid) return 'Please enter a valid email address.';
    if (field.type === 'tel') {
      const digits = value.replace(/\D/g, '');
      if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) return 'Please enter a 10-digit US phone number.';
    }
    if (field.name === 'postal-code' && !/^\d{5}$/.test(value)) return 'Please enter a 5-digit ZIP code.';
    return '';
  }

  function show(message, isError) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.focus();
  }

  fields.forEach(field => field.addEventListener('input', () => {
    if (field.getAttribute('aria-invalid') === 'true' && !problem(field)) field.setAttribute('aria-invalid', 'false');
  }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const invalid = fields.filter(field => {
      const error = problem(field);
      field.setAttribute('aria-invalid', String(!!error));
      return error;
    });
    if (invalid.length) {
      show(problem(invalid[0]), true);
      invalid[0].focus();
      return;
    }
    pending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    status.textContent = '';
    try {
      // Someone whose browser autofills the form can be faster than the minimum;
      // wait it out rather than have the lead rejected.
      const wait = LEAD_MIN_FILL_MS + 100 - performance.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      const payload = Object.fromEntries(new FormData(form));
      payload.form = form.dataset.leadForm;
      payload.page = location.pathname;
      // Time since the page started loading, on this browser's own clock.
      payload.elapsedMs = Math.round(performance.now());
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // AbortSignal.timeout is missing before Safari 16; send without a timeout there rather than fail.
        signal: AbortSignal.timeout?.(20000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || LEAD_CALL_US);
      form.reset();
      form.classList.add('is-sent');
      show('Thank you. We received your request and will contact you soon.', false);
    } catch (error) {
      show(error.name === 'TimeoutError' || error instanceof TypeError || error instanceof SyntaxError ? LEAD_CALL_US : error.message, true);
    } finally {
      pending = false;
      button.disabled = false;
      button.textContent = buttonLabel;
      form.removeAttribute('aria-busy');
    }
  });
});
