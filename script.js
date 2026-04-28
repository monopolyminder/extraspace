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

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => links.classList.remove('open'));
  });

  const fadeTargets = document.querySelectorAll(
    '.step-card, .review-card, .info-block, .algo-detail, .stat-card, .timeline-item, ' +
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
