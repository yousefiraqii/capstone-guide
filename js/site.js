(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.nav-links');
  const menuToggle = document.querySelector('.menu-toggle');
  const backdrop = document.querySelector('.mobile-backdrop');
  const progress = document.querySelector('.progress');
  const topButton = document.querySelector('.back-top');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsViewTransitions = typeof document.startViewTransition === 'function'
    && typeof CSS !== 'undefined'
    && CSS.supports('view-transition-name: none');

  root.classList.add('js');

  const closeMenu = () => {
    nav?.classList.remove('open');
    backdrop?.classList.remove('show');
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (document.body) document.body.style.overflow = '';
  };

  menuToggle?.addEventListener('click', () => {
    const isOpen = !nav?.classList.contains('open');
    nav?.classList.toggle('open', isOpen);
    backdrop?.classList.toggle('show', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  backdrop?.addEventListener('click', closeMenu);
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  let scrollFrame = 0;
  const updateScrollState = () => {
    scrollFrame = 0;
    const scrollY = window.scrollY || root.scrollTop || 0;
    const maxScroll = root.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0})`;
    header?.classList.toggle('scrolled', scrollY > 30);
    if (topButton) {
      const visible = scrollY > 700;
      topButton.classList.toggle('show', visible);
      topButton.setAttribute('aria-hidden', String(!visible));
      topButton.tabIndex = visible ? 0 : -1;
    }
  };
  const scheduleScrollUpdate = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
  };
  window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
  updateScrollState();
  topButton?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  // Add reveals progressively so content stays visible unless observation is ready.
  const revealSelector = [
    '.page-hero > .container',
    '.section-head',
    '.chapter-head',
    '.time-frame-page .week',
    '.home-guides .card',
    '.authors-grid .author-card',
    '.poster-toc-card',
    '.journal-toc-card',
    '.toc-card',
    '.toc-group',
    '.gallery-item',
    '.doc-fig',
    '.panel-card',
  ].join(',');
  const revealElements = [...document.querySelectorAll(`.reveal, ${revealSelector}`)];
  revealElements.forEach((element) => element.classList.add('reveal'));

  const staggerSelector = '.home-guides, .authors-grid, .poster-toc-grid, .journal-contents-grid, .portfolio-toc-grid, .gallery';
  document.querySelectorAll(staggerSelector).forEach((group) => {
    [...group.children].filter((element) => element.classList.contains('reveal'))
      .forEach((element, index) => element.style.setProperty('--reveal-delay', `${Math.min(index * 80, 320)}ms`));
  });

  let revealObserver;
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('visible'));
  } else {
    try {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
      root.classList.add('motion-ready');
      revealElements.forEach((element) => revealObserver.observe(element));
    } catch {
      // If the browser's observer fails, keep every section readable.
      root.classList.remove('motion-ready');
      revealElements.forEach((element) => element.classList.add('visible'));
    }
  }

  document.querySelectorAll('img[data-zoom]').forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Open image: ${image.alt || 'Capstone guide image'}`);
  });
  if (document.querySelector('img[data-zoom]')) {
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Image viewer');
    const close = document.createElement('button');
    close.className = 'lightbox-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close image');
    close.textContent = '×';
    const figure = document.createElement('figure');
    const largeImage = document.createElement('img');
    const caption = document.createElement('figcaption');
    largeImage.alt = '';
    figure.append(largeImage, caption);
    dialog.append(close, figure);
    document.body.append(dialog);

    let opener;
    const openImage = (image) => {
      opener = image;
      largeImage.src = image.currentSrc || image.src;
      largeImage.alt = image.alt;
      caption.textContent = image.closest('figure')?.querySelector('figcaption')?.textContent || image.alt || '';
      dialog.showModal();
      close.focus();
    };
    document.querySelectorAll('img[data-zoom]').forEach((image) => {
      image.addEventListener('click', () => openImage(image));
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openImage(image);
        }
      });
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => opener?.focus());
  }

  const guidePage = document.querySelector('.portfolio-page, .poster-page, .journal-page, .logbook-page, .panel-page, .time-frame-page');
  if (guidePage) {
    const isPortfolio = guidePage.classList.contains('portfolio-page');
    const isPoster = guidePage.classList.contains('poster-page');
    const isJournal = guidePage.classList.contains('journal-page');
    const isLogbook = guidePage.classList.contains('logbook-page');
    const isTimeFrame = guidePage.classList.contains('time-frame-page');
    const selector = isPortfolio ? '.portfolio-page .chapter[id^="part-"]'
      : isPoster ? '.poster-page .chapter[id^="poster-"]'
        : isJournal ? '.journal-page .chapter[id^="journal-"]'
          : isLogbook ? '.logbook-page .chapter[id^="logbook-"]'
            : isTimeFrame ? '.time-frame-page .chapter#time-intro,.time-frame-page .chapter#time-general-rule,.time-frame-page .week[id^="time-week-"]'
              : '.panel-page h2[id^="panel-"]';
    const targets = [...document.querySelectorAll(selector)];
    if (targets.length) {
      const toc = document.createElement('nav');
      toc.className = 'pub-toc';
      toc.setAttribute('aria-label', isPortfolio ? 'Portfolio section shortcuts'
        : isPoster ? 'Poster section shortcuts'
          : isJournal ? 'Journal section shortcuts'
            : isLogbook ? 'Logbook section shortcuts'
              : isTimeFrame ? 'Time Frame section shortcuts' : 'Panel Review section shortcuts');
      const label = document.createElement('span');
      label.className = 'section-kicker';
      label.textContent = 'Sections';
      toc.append(label);
      const tocLinks = targets.map((element, index) => {
        const link = document.createElement('a');
        link.href = `#${element.id}`;
        link.textContent = element.dataset.tocTitle || element.querySelector('h2')?.textContent
          || element.querySelector('strong')?.textContent || `Section ${index + 1}`;
        toc.append(link);
        return link;
      });
      document.body.append(toc);

      if ('IntersectionObserver' in window) {
        const tocObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            tocLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
            if (isTimeFrame && entry.target.classList.contains('week')) {
              guidePage.querySelectorAll('.week.is-active').forEach((week) => week.classList.remove('is-active'));
              entry.target.classList.add('is-active');
            }
          });
        }, { rootMargin: '-35% 0px -55% 0px' });
        targets.forEach((element) => tocObserver.observe(element));
      }
    }
  }

  // Native MPA view transitions are CSS-driven; startViewTransition is for DOM updates in one document.
  let navigationStarted = false;
  const clearPageTransition = () => {
    document.body?.classList.remove('page-leave', 'page-enter');
    navigationStarted = false;
  };
  window.addEventListener('pageshow', clearPageTransition);
  if (!supportsViewTransitions && !reducedMotion.matches) {
    document.body.classList.add('page-enter');
    const finishPageEnter = (event) => {
      if (event.target !== document.body) return;
      document.body.classList.remove('page-enter');
      document.body.removeEventListener('animationend', finishPageEnter);
    };
    document.body.addEventListener('animationend', finishPageEnter);
  }

  // Keep native anchor behavior; CSS supplies smooth scrolling and header offset.
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let targetId;
      try {
        targetId = decodeURIComponent(anchor.getAttribute('href').slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      try {
        history.pushState(null, '', `#${encodeURIComponent(target.id)}`);
      } catch {
        // file:// previews can reject pushState; scrolling should still work.
      }
    });
  });

  if (!supportsViewTransitions) {
    document.addEventListener('click', (event) => {
      const clickedElement = event.target instanceof Element ? event.target : event.target.parentElement;
      const link = clickedElement?.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
        || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.href === location.href
        || (destination.hash && destination.pathname === location.pathname)) return;
      event.preventDefault();
      closeMenu();
      if (navigationStarted) return;
      navigationStarted = true;
      if (reducedMotion.matches) {
        location.assign(destination.href);
        return;
      }
      document.body.classList.add('page-leave');
      window.setTimeout(() => location.assign(destination.href), 250);
    });
  }
})();
