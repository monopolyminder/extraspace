/*
  Deferred page behavior, shared by every page. Each concern lives in its own
  init function; everything degrades gracefully when its markup is absent.
  (The before-first-paint bootstrap — js/theme/intro classes — is in head.js.)
*/

/* Click-to-load YouTube facade: swap the static poster for the real iframe */
function initVideoFacade() {
  /* Poster is self-hosted; fall back to YouTube's thumbnail if it 404s */
  document.querySelectorAll('.hero-video-poster').forEach(img => {
    img.addEventListener('error', function fallbackPoster() {
      img.removeEventListener('error', fallbackPoster);
      const id = img.closest('.js-yt-facade')?.dataset?.ytId;
      if (!id) return;
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    });
  });

  document.querySelectorAll('.js-yt-facade').forEach(trigger => {
    const host = trigger.closest('.hero-video-frame');
    if (!host) return;
    const id = trigger.dataset.ytId;
    if (!id) return;

    const load = () => {
      if (trigger.getAttribute('data-loaded') === 'true') return;
      trigger.setAttribute('data-loaded', 'true');
      trigger.remove();

      const iframe = document.createElement('iframe');
      iframe.className = 'hero-video-iframe';
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
      iframe.title = 'Video: Extra Space Storage consumer awareness overview';
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      );
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.allowFullscreen = true;
      host.appendChild(iframe);
    };

    trigger.addEventListener('click', e => {
      e.preventDefault();
      load();
    });
  });
}

/* Theme toggle button; follows the OS unless the visitor chose explicitly */
function initThemeToggle() {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const systemTheme = () => (themeMedia.matches ? 'dark' : 'light');

  const applyTheme = theme => {
    root.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
  };

  applyTheme(root.getAttribute('data-theme') || systemTheme());

  themeMedia.addEventListener('change', () => {
    let stored = null;
    try {
      stored = localStorage.getItem('theme');
    } catch (e) {}
    if (stored !== 'light' && stored !== 'dark') applyTheme(systemTheme());
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next =
        (root.getAttribute('data-theme') || systemTheme()) === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {}
    });
  }
}

/* Section-rail progress fill and the back-to-top button, both scroll-driven */
function initScrollProgress() {
  const sectionRail = document.getElementById('sectionRail');
  const railFill = sectionRail?.querySelector('.rail-fill');
  const backToTop = document.getElementById('backToTop');

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    if (railFill) railFill.style.setProperty('--rail-progress', ratio.toFixed(4));
    const pastHero = window.scrollY > window.innerHeight * 0.6;
    if (sectionRail) sectionRail.classList.toggle('visible', pastHero);
    if (backToTop) backToTop.classList.toggle('visible', window.scrollY > window.innerHeight * 1.2);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

/* Sync active state across the top-nav links and the vertical rail links */
function initScrollSpy() {
  const sectionLinkMap = new Map();
  document.querySelectorAll('.nav-links a[href^="#"], .rail-link[href^="#"]').forEach(a => {
    const section = document.getElementById(a.getAttribute('href').slice(1));
    if (!section) return;
    if (!sectionLinkMap.has(section)) sectionLinkMap.set(section, []);
    sectionLinkMap.get(section).push(a);
  });
  if (!sectionLinkMap.size) return;

  const spy = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        sectionLinkMap.forEach(links => links.forEach(l => l.classList.remove('active')));
        sectionLinkMap.get(entry.target)?.forEach(l => l.classList.add('active'));
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );
  sectionLinkMap.forEach((links, section) => spy.observe(section));
}

/* The top-nav itself is fully CSS-only: a checkbox-hack hamburger drives the
   mobile menu, and the "How It Works" flyout opens on :hover / :focus-within.
   Both work identically with or without JS, so there's no nav script. */

/* "Earlier cases" expander: open by default on desktop, collapsed on narrow
   viewports, while leaving the caret usable at any width. */
function initCaseExpander() {
  const caseExpander = document.querySelector('.case-collapse');
  if (!caseExpander) return;

  const wideView = window.matchMedia('(min-width: 901px)');
  let userToggled = false;
  let syncing = false;

  const syncExpander = () => {
    if (userToggled) return;
    syncing = true;
    caseExpander.open = wideView.matches;
    syncing = false;
  };

  caseExpander.addEventListener('toggle', () => {
    if (!syncing) userToggled = true;
  });

  syncExpander();
  wideView.addEventListener('change', syncExpander);
}

/* "Want to go further?" links jump to the escalation options and expand
   them. Without JS the anchor still scrolls to the (closed) summary. */
function initEscalateOpener() {
  const escalate = document.getElementById('escalate');
  if (!escalate) return;
  document.querySelectorAll('a[href="#escalate"]').forEach(link => {
    link.addEventListener('click', () => {
      escalate.open = true;
    });
  });
}

/* Language preference: the nav EN/ES link stores the visitor's explicit
   choice, and Spanish-browser visitors on English pages get a one-time,
   dismissible suggestion toast. English is always the default; nobody is
   auto-redirected. */
function initLangSuggest() {
  const readPref = () => {
    try {
      return localStorage.getItem('lang');
    } catch (e) {
      return null;
    }
  };
  const storePref = lang => {
    try {
      localStorage.setItem('lang', lang);
    } catch (e) {}
  };

  /* The nav toggle records the explicit choice before navigating */
  document.querySelectorAll('.nav-lang a[data-lang]').forEach(link => {
    link.addEventListener('click', () => storePref(link.dataset.lang));
  });

  /* Suggest Spanish only on English pages, only without a stored choice */
  if (document.documentElement.lang !== 'en' || readPref()) return;
  const languages = navigator.languages || [navigator.language];
  if (!languages.some(l => /^es(-|$)/i.test(l || ''))) return;

  const esHref = document.querySelector('.nav-lang a[data-lang="es"]')?.getAttribute('href');
  if (!esHref) return;

  const toast = document.createElement('div');
  toast.className = 'lang-toast';
  toast.setAttribute('lang', 'es');
  toast.setAttribute('role', 'status');
  toast.innerHTML =
    '<p class="lang-toast-text">Este sitio está disponible en español.</p>' +
    '<a class="lang-toast-link"></a>' +
    '<button type="button" class="lang-toast-dismiss" aria-label="Cerrar">&#10005;</button>';
  const go = toast.querySelector('.lang-toast-link');
  go.href = esHref;
  go.textContent = 'Ver en español →';
  go.addEventListener('click', () => storePref('es'));
  toast.querySelector('.lang-toast-dismiss').addEventListener('click', () => {
    storePref('en');
    toast.remove();
  });
  document.body.appendChild(toast);
}

/* Fade cards in as they scroll into view. Only elements that start below the
   fold are animated — anything already on screen at load stays fully visible,
   so it never blinks out and fades back in. */
function initScrollReveal() {
  const fadeTargets = document.querySelectorAll(
    '.step-card, .faq-item, .info-block, .algo-detail, .stat-card, .timeline-item, ' +
    '.monopoly-note, .case-card, .bbb-note, .reveal-card, .protect-card, .response-card, .response-rebuttal'
  );

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  const viewportH = window.innerHeight;
  fadeTargets.forEach(el => {
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < viewportH && rect.bottom > 0;
    if (alreadyVisible) return;
    el.classList.add('fade-in');
    observer.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initVideoFacade();
  initThemeToggle();
  initScrollProgress();
  initScrollSpy();
  initCaseExpander();
  initEscalateOpener();
  initLangSuggest();
  initScrollReveal();
});
