// Policy pages: send "Get Free Quote" back to the campaign page the visitor came from,
// so the lead is credited to the right landing page, and keep the footer year current.
(() => {
  const KEY = 'jc-landing-page';
  const isLanding = path => /^\/lp\/[a-z0-9-]+\/$/.test(path);
  let landing = null;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === location.origin && isLanding(ref.pathname)) {
      landing = ref.pathname;
      sessionStorage.setItem(KEY, landing);
    } else {
      const saved = sessionStorage.getItem(KEY);
      if (saved && isLanding(saved)) landing = saved;
    }
  } catch (error) {
    landing = null;
  }
  if (landing) {
    document.querySelectorAll('a[data-quote-link]').forEach(link => {
      link.href = `${landing}#contact`;
    });
  }
  document.querySelectorAll('[data-year]').forEach(year => {
    year.textContent = new Date().getFullYear();
  });
})();
