document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hero-video-poster').forEach(img => {
    img.addEventListener('error', function fallbackPoster() {
      img.removeEventListener('error', fallbackPoster);
      const id = img.closest('.js-yt-facade')?.dataset?.ytId;
      if (id) img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
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

    trigger.addEventListener('click', load);
  });

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

  // Sync active state across the top-nav links and the vertical rail links
  const sectionLinkMap = new Map();
  document.querySelectorAll('.nav-links a[href^="#"], .rail-link[href^="#"]').forEach(a => {
    const section = document.getElementById(a.getAttribute('href').slice(1));
    if (!section) return;
    if (!sectionLinkMap.has(section)) sectionLinkMap.set(section, []);
    sectionLinkMap.get(section).push(a);
  });

  if (sectionLinkMap.size) {
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

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => links.classList.remove('open'));
  });

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.nav-dropdown-toggle');
    if (!btn) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);

      document.querySelectorAll('.nav-dropdown').forEach(other => {
        if (other !== dropdown) {
          other.classList.remove('open');
          other.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
        }
      });
    });

    dropdown.addEventListener('mouseenter', () => {
      if (!finePointer.matches) return;
      dropdown.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    });

    dropdown.addEventListener('mouseleave', () => {
      if (!finePointer.matches) return;
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.nav-dropdown')) return;
    document.querySelectorAll('.nav-dropdown.open').forEach(dropdown => {
      dropdown.classList.remove('open');
      dropdown.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  });

  const fadeTargets = document.querySelectorAll(
    '.step-card, .faq-item, .info-block, .algo-detail, .stat-card, .timeline-item, ' +
    '.monopoly-note, .case-card, .bbb-note, .reveal-card, .protect-card, .response-card, .response-rebuttal'
  );

  fadeTargets.forEach(el => el.classList.add('fade-in'));

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

  fadeTargets.forEach(el => observer.observe(el));
});
