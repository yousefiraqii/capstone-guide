const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8');
const PAGE_FILES = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));

function readPage(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function createPage(name, { observe = false } = {}) {
  const dom = new JSDOM(readPage(name), {
    url: pathToFileURL(path.join(ROOT, name)).href,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // jsdom omits browser APIs used by the site; these stubs make behavior deterministic.
  window.matchMedia = () => ({ matches: true, media: '(prefers-reduced-motion: reduce)' });
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };

  const observers = [];
  if (observe) {
    window.matchMedia = () => ({ matches: false, media: '(prefers-reduced-motion: no-preference)' });
    window.IntersectionObserver = class MockIntersectionObserver {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.targets = [];
        observers.push(this);
      }
      observe(target) { this.targets.push(target); }
      unobserve(target) { this.targets = this.targets.filter((item) => item !== target); }
      trigger(target, isIntersecting = true) {
        this.callback([{ target, isIntersecting }], this);
      }
    };
  }

  window.eval(SCRIPT);
  return { dom, window, observers };
}

function localTarget(pageName, reference) {
  const url = new URL(reference, pathToFileURL(path.join(ROOT, pageName)));
  if (url.protocol !== 'file:') return null;
  return fileURLToPath(url);
}

test('site structure and deployment assets', async (t) => {
  for (const pageName of PAGE_FILES) {
    await t.test(`${pageName} has a title, main landmark, and skip link`, () => {
      const dom = new JSDOM(readPage(pageName));
      const { document } = dom.window;
      assert.ok(document.title.trim(), 'page title should not be empty');
      assert.equal(document.querySelectorAll('main#main').length, 1);
      assert.equal(document.querySelector('.skip-link')?.getAttribute('href'), '#main');
      dom.window.close();
    });
  }

  await t.test('all local links, media, stylesheets, scripts, and fragments resolve', () => {
    const idsByPage = new Map();
    for (const pageName of PAGE_FILES) {
      const dom = new JSDOM(readPage(pageName));
      idsByPage.set(path.resolve(ROOT, pageName), new Set(
        [...dom.window.document.querySelectorAll('[id]')].map((element) => element.id),
      ));
      dom.window.close();
    }

    for (const pageName of PAGE_FILES) {
      const dom = new JSDOM(readPage(pageName), {
        url: pathToFileURL(path.join(ROOT, pageName)).href,
      });
      const { document } = dom.window;
      for (const element of document.querySelectorAll('[href], [src]')) {
        const reference = element.getAttribute('href') || element.getAttribute('src');
        const target = localTarget(pageName, reference);
        if (!target) continue;

        const resolvedUrl = new URL(reference, pathToFileURL(path.join(ROOT, pageName)));
        if (resolvedUrl.pathname !== pathToFileURL(path.join(ROOT, pageName)).pathname) {
          assert.ok(fs.existsSync(target), `${pageName} references missing local file: ${reference}`);
        }

        const fragment = new URL(reference, pathToFileURL(path.join(ROOT, pageName))).hash.slice(1);
        if (fragment) {
          const destinationPage = target.endsWith('.html') ? path.resolve(target) : path.resolve(ROOT, pageName);
          assert.ok(idsByPage.get(destinationPage)?.has(decodeURIComponent(fragment)), `${pageName} references missing fragment: ${reference}`);
        }
      }
      dom.window.close();
    }
  });

  await t.test('new-window links protect the opener and no javascript URLs are present', () => {
    for (const pageName of PAGE_FILES) {
      const dom = new JSDOM(readPage(pageName));
      for (const link of dom.window.document.querySelectorAll('a[target="_blank"]')) {
        assert.match(link.rel, /\bnoopener\b/, `${pageName}: target=_blank must use rel=noopener`);
      }
      for (const element of dom.window.document.querySelectorAll('[href], [src]')) {
        assert.notEqual(new URL(element.getAttribute('href') || element.getAttribute('src'), 'https://test.invalid').protocol, 'javascript:');
      }
      dom.window.close();
    }
  });

  await t.test('homepage authors have a local photo, name, and Batch 27 role', () => {
    const dom = new JSDOM(readPage('index.html'));
    const authors = [...dom.window.document.querySelectorAll('#authors .author-card')];
    assert.equal(authors.length, 7);
    for (const card of authors) {
      const image = card.querySelector('img');
      assert.ok(image?.alt.trim(), 'author photo needs descriptive alt text');
      assert.match(image.getAttribute('src'), /^media\/authors\/author-\d+\.jpg$/);
      assert.ok(fs.existsSync(path.join(ROOT, image.getAttribute('src'))));
      assert.ok(card.querySelector('h3')?.textContent.trim());
      assert.match(card.querySelector('.author-role')?.textContent || '', /Batch [’']27/);
    }
    dom.window.close();
  });

  await t.test('Vercel deployment config keeps required security headers and font hosts', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    const headers = config.headers.flatMap((rule) => rule.headers);
    const values = Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));
    assert.equal(values['x-content-type-options'], 'nosniff');
    assert.equal(values['x-frame-options'], 'DENY');
    assert.match(values['content-security-policy'], /script-src 'self'/);
    assert.match(values['content-security-policy'], /https:\/\/fonts\.googleapis\.com/);
    assert.match(values['content-security-policy'], /https:\/\/fonts\.gstatic\.com/);
  });

  await t.test('motion styles define cross-page transitions, shared timings, and reduced-motion overrides', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css/site.css'), 'utf8');
    assert.match(css, /@view-transition\s*\{\s*navigation\s*:\s*auto/);
    assert.match(css, /--motion-ease\s*:\s*cubic-bezier\(\.22,1,\.36,1\)/);
    assert.match(css, /--motion-exit\s*:\s*250ms/);
    assert.match(css, /--motion-enter\s*:\s*350ms/);
    assert.match(css, /prefers-reduced-motion\s*:\s*reduce/);
    assert.match(css, /scroll-margin-top/);
  });
});

test('shared browser behavior', async (t) => {
  await t.test('mobile menu opens, closes from backdrop, Escape, and navigation links', () => {
    const { dom, window } = createPage('index.html');
    const toggle = window.document.querySelector('.menu-toggle');
    const nav = window.document.querySelector('.nav-links');
    const backdrop = window.document.querySelector('.mobile-backdrop');

    toggle.click();
    assert.ok(nav.classList.contains('open'));
    assert.ok(backdrop.classList.contains('show'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(window.document.body.style.overflow, 'hidden');

    backdrop.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(window.document.body.style.overflow, '');

    toggle.click();
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(nav.classList.contains('open'), false);

    toggle.click();
    nav.querySelector('a').dispatchEvent(new window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
    assert.equal(nav.classList.contains('open'), false);
    dom.window.close();
  });

  await t.test('scroll state updates progress, sticky header, and back-to-top visibility', async () => {
    const { dom, window } = createPage('index.html');
    Object.defineProperty(window.document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    window.dispatchEvent(new window.Event('scroll'));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    assert.equal(window.document.querySelector('.progress').style.transform, 'scaleX(0.8)');
    assert.ok(window.document.querySelector('.site-header').classList.contains('scrolled'));
    assert.ok(window.document.querySelector('.back-top').classList.contains('show'));
    window.document.querySelector('.back-top').click();
    dom.window.close();
  });

  await t.test('reduced-motion fallback immediately reveals animated content', () => {
    const { dom, window } = createPage('index.html');
    assert.ok(window.document.querySelector('.reveal').classList.contains('visible'));
    dom.window.close();
  });

  await t.test('same-page anchors scroll with reduced-motion settings and preserve modified clicks', () => {
    const { dom, window } = createPage('index.html');
    const target = window.document.querySelector('#authors');
    let scrollBehavior;
    target.scrollIntoView = (options) => { scrollBehavior = options.behavior; };
    const anchor = window.document.querySelector('a[href="#authors"]');
    const regularClick = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(regularClick);
    assert.equal(regularClick.defaultPrevented, true);
    assert.equal(scrollBehavior, 'auto');

    const modifiedClick = new window.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    anchor.dispatchEvent(modifiedClick);
    assert.equal(modifiedClick.defaultPrevented, false);
    dom.window.close();
  });

  await t.test('scroll reveals start only after motion setup and reveal once when intersecting', () => {
    const { dom, window, observers } = createPage('index.html', { observe: true });
    const target = window.document.querySelector('.authors-grid .author-card');
    const revealObserver = observers[0];
    assert.ok(window.document.documentElement.classList.contains('motion-ready'));
    assert.equal(target.classList.contains('visible'), false);
    revealObserver.trigger(target);
    assert.equal(target.classList.contains('visible'), true);
    assert.equal(revealObserver.targets.includes(target), false);
    dom.window.close();
  });

  await t.test('lightbox opens by mouse and keyboard, closes, and restores focus', () => {
    const { dom, window } = createPage('portfolio.html');
    const image = window.document.querySelector('img[data-zoom]');
    const dialog = window.document.querySelector('dialog.lightbox');
    assert.ok(image);
    assert.equal(image.getAttribute('role'), 'button');
    assert.equal(image.tabIndex, 0);

    image.click();
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector('img').alt, image.alt);
    dialog.querySelector('.lightbox-close').click();
    assert.equal(dialog.open, false);
    assert.equal(window.document.activeElement, image);

    image.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(dialog.open, true);
    dialog.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    dom.window.close();
  });

  await t.test('guide page creates functional section shortcuts and highlights the visible section', () => {
    const { dom, window, observers } = createPage('portfolio.html', { observe: true });
    const targets = window.document.querySelectorAll('.portfolio-page .chapter[id^="part-"]');
    const toc = window.document.querySelector('.pub-toc');
    assert.ok(toc);
    assert.equal(toc.querySelectorAll('a').length, targets.length);
    for (const link of toc.querySelectorAll('a')) {
      assert.ok(window.document.getElementById(link.hash.slice(1)));
    }
    const shortcutObserver = observers.at(-1);
    const target = targets[1];
    shortcutObserver.trigger(target);
    assert.equal(toc.querySelector(`a[href="#${target.id}"]`).classList.contains('active'), true);
    dom.window.close();
  });

  await t.test('section shortcuts still render without IntersectionObserver', () => {
    const { dom, window } = createPage('poster.html');
    const toc = window.document.querySelector('.pub-toc');
    assert.ok(toc);
    assert.ok(toc.querySelectorAll('a').length > 0);
    dom.window.close();
  });

  await t.test('timeline highlights one active milestone as the reader advances', () => {
    const { dom, window, observers } = createPage('time-frame.html', { observe: true });
    const weeks = [...window.document.querySelectorAll('.time-frame-page .week')];
    const timelineObserver = observers.at(-1);
    timelineObserver.trigger(weeks[0]);
    assert.equal(weeks[0].classList.contains('is-active'), true);
    timelineObserver.trigger(weeks[1]);
    assert.equal(weeks[0].classList.contains('is-active'), false);
    assert.equal(weeks[1].classList.contains('is-active'), true);
    dom.window.close();
  });
});
