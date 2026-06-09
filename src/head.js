/*
  Render-blocking bootstrap, loaded synchronously in <head> on every page so
  the classes below are set before first paint (no flash). Shared by all pages.
*/

/* Flag JS availability so CSS can serve no-JS fallbacks */
document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

/* Resolve theme before first paint: stored choice, else OS preference */
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();

/* First ever homepage visit: play the full hero intro (headline builds,
   then the logo draws). Every other load just plays the logo flourish up
   to 3 times per session. Skipped entirely for reduced motion. Runs in
   <head> so hidden start states are set before first paint (no flash). */
(function () {
  try {
    /* Crawlers, link unfurlers, Lighthouse/PageSpeed and headless renderers
       get the instant, fully-rendered page (no intro) for the best LCP. */
    if (/bot|crawl|spider|slurp|bingpreview|lighthouse|pagespeed|headless|facebookexternalhit|embedly|whatsapp|telegram/i.test(navigator.userAgent || '')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var isHome = location.pathname === '/' || /\/index\.html$/.test(location.pathname);
    if (isHome && !localStorage.getItem('intro-seen')) {
      document.documentElement.classList.add('intro');
      localStorage.setItem('intro-seen', '1');
    } else {
      var plays = parseInt(sessionStorage.getItem('wm-plays') || '0', 10);
      if (plays < 3) {
        document.documentElement.classList.add('wordmark-animate');
        sessionStorage.setItem('wm-plays', String(plays + 1));
      }
    }
  } catch (e) {}
})();
