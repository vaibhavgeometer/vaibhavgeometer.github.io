(function () {
  'use strict';

  // --- Mobile Navbar Toggle ---
  function initMobileNav() {
    const btn = document.getElementById('nav-menu-btn');
    const controls = document.getElementById('site-nav-links');
    if (!btn || !controls) return;

    function setOpen(open) {
      controls.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '✕' : '☰';
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!controls.classList.contains('is-open'));
    });

    controls.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('click', function (e) {
      if (controls.classList.contains('is-open') && !controls.contains(e.target) && e.target !== btn) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && controls.classList.contains('is-open')) {
        setOpen(false);
      }
    });
  }

  // --- One-Click Copy Email ---
  function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  function initCopyEmail() {
    document.querySelectorAll('.js-copy-email').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const email = btn.getAttribute('data-email') || 'vaibhav27182@gmail.com';
        const originalHtml = btn.getAttribute('data-original-html') || btn.innerHTML;
        btn.setAttribute('data-original-html', originalHtml);

        const done = function () {
          btn.innerHTML = '<span>✓ Copied!</span>';
          btn.classList.add('is-copied');
          clearTimeout(btn._copyTimer);
          btn._copyTimer = setTimeout(function () {
            btn.innerHTML = originalHtml;
            btn.classList.remove('is-copied');
          }, 2200);
        };

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(email).then(done).catch(function () {
            if (copyTextFallback(email)) done();
          });
        } else if (copyTextFallback(email)) {
          done();
        }
      });
    });
  }

  // --- Art Gallery Lightbox Modal ---
  function initArtLightbox() {
    const triggers = Array.from(document.querySelectorAll('[data-lightbox="art"]'));
    if (!triggers.length) return;

    const items = [];
    const seenSrc = new Set();
    triggers.forEach(function (el) {
      const src = el.getAttribute('href');
      if (!src) return;
      let idx = items.findIndex(function (it) { return it.src === src; });
      if (idx === -1) {
        idx = items.length;
        seenSrc.add(src);
        items.push({
          src: src,
          title: el.getAttribute('data-title') || 'Artwork',
          desc: el.getAttribute('data-desc') || '',
          tag: el.getAttribute('data-tag') || ''
        });
      }
      el.setAttribute('data-lightbox-index', String(idx));
    });

    const modal = document.createElement('div');
    modal.id = 'art-lightbox-modal';
    modal.className = 'lightbox-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Artwork Preview');
    modal.innerHTML =
      '<div class="lightbox-dialog">' +
        '<div class="lightbox-header">' +
          '<div class="lightbox-title-wrap">' +
            '<span class="lightbox-tag" id="lb-tag"></span>' +
            '<h3 class="lightbox-title" id="lb-title"></h3>' +
          '</div>' +
          '<div class="lightbox-header-actions">' +
            '<span class="lightbox-counter" id="lb-counter"></span>' +
            '<a id="lb-full" href="#" target="_blank" rel="noopener noreferrer" class="lightbox-btn">Original ↗</a>' +
            '<button type="button" id="lb-close" class="lightbox-close-btn" aria-label="Close lightbox">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="lightbox-stage">' +
          '<button type="button" id="lb-prev" class="lightbox-nav prev" aria-label="Previous artwork">‹</button>' +
          '<img id="lb-img" src="" alt="" />' +
          '<button type="button" id="lb-next" class="lightbox-nav next" aria-label="Next artwork">›</button>' +
        '</div>' +
        '<p class="lightbox-desc" id="lb-desc"></p>' +
      '</div>';
    document.body.appendChild(modal);

    const imgEl = modal.querySelector('#lb-img');
    const titleEl = modal.querySelector('#lb-title');
    const tagEl = modal.querySelector('#lb-tag');
    const descEl = modal.querySelector('#lb-desc');
    const counterEl = modal.querySelector('#lb-counter');
    const fullEl = modal.querySelector('#lb-full');
    const closeBtn = modal.querySelector('#lb-close');
    const prevBtn = modal.querySelector('#lb-prev');
    const nextBtn = modal.querySelector('#lb-next');

    let currentIdx = 0;
    let lastFocused = null;

    function render(idx) {
      currentIdx = (idx + items.length) % items.length;
      const item = items[currentIdx];
      imgEl.src = item.src;
      imgEl.alt = item.title;
      titleEl.textContent = item.title;
      tagEl.textContent = item.tag;
      tagEl.style.display = item.tag ? 'inline-flex' : 'none';
      descEl.textContent = item.desc;
      descEl.style.display = item.desc ? 'block' : 'none';
      counterEl.textContent = (currentIdx + 1) + ' / ' + items.length;
      fullEl.href = item.src;
      const showNav = items.length > 1;
      prevBtn.style.display = showNav ? 'flex' : 'none';
      nextBtn.style.display = showNav ? 'flex' : 'none';
    }

    function openAt(idx) {
      lastFocused = document.activeElement;
      render(idx);
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function close() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    triggers.forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openAt(parseInt(el.getAttribute('data-lightbox-index') || '0', 10));
      });
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { render(currentIdx - 1); });
    nextBtn.addEventListener('click', function () { render(currentIdx + 1); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') render(currentIdx - 1);
      else if (e.key === 'ArrowRight') render(currentIdx + 1);
    });
  }

  function init() {
    initMobileNav();
    initCopyEmail();
    initArtLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
