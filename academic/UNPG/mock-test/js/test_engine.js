/* ============================================
   UNPG B.Sc. Semester V — CBT Simulator Engine
   ============================================
   - Supports Official 90-min Timed Mode & Unlimited Practice Mode
   - Supports URL params: ?test=..., ?course=...&year=..., ?q=..., ?mode=official|practice
   - Supports Custom Tests via sessionStorage 'semester_custom_test' (?test=custom)
   - Screenshot-first question rendering with high-res zoom viewer
   - Live 5-tier Difficulty Tagging (SEM_DIFFICULTY)
   - Full keyboard shortcuts & shared dark/light theme ('jam_theme')
   ============================================ */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  let requestedId = params.get('test') || params.get('id') || '';
  const courseParam = params.get('course') || '';
  const yearParam = params.get('year') || '';
  const modeParam = (params.get('mode') || 'official').toLowerCase();
  const initialQParam = parseInt(params.get('q') || '1', 10);

  if (!requestedId && courseParam && yearParam) {
    requestedId = `${courseParam}_${yearParam}`;
  }
  if (!requestedId) {
    requestedId = 'MAT301F_2025-26';
  }

  let currentTest = null;
  let isCustomTest = false;

  if (requestedId === 'custom') {
    try {
      const rawCustom = sessionStorage.getItem('semester_custom_test');
      if (rawCustom) {
        currentTest = JSON.parse(rawCustom);
        isCustomTest = true;
      }
    } catch (e) {}
  }

  if (!currentTest && window.MOCK_TESTS_DATA) {
    currentTest = window.MOCK_TESTS_DATA[requestedId] || Object.values(window.MOCK_TESTS_DATA)[0];
  }

  if (!currentTest) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;text-align:center;"><h2>Mock Test Data Not Loaded</h2><p><a href="../index.html">Return to Semester Exams Portal</a></p></div>';
    return;
  }

  const questions = Array.isArray(currentTest.questions) ? currentTest.questions : [];
  const totalQ = questions.length;
  const startIdx = (Number.isFinite(initialQParam) && initialQParam >= 1 && initialQParam <= totalQ)
    ? (initialQParam - 1)
    : 0;

  const isPractice = modeParam === 'practice';
  const durationSeconds = (Number(currentTest.duration_minutes) || 90) * 60;

  const state = {
    testId: currentTest.id || requestedId,
    testObj: currentTest,
    isCustom: isCustomTest,
    mode: isPractice ? 'practice' : 'official',
    questions,
    totalQ,
    currentIdx: startIdx,
    responses: {}, // index -> 'A' | 'B' | 'C' | 'D'
    status: {},    // index -> 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked'
    timerInterval: null,
    remainingSeconds: isPractice ? 0 : durationSeconds,
    elapsedSeconds: 0,
    submitted: false
  };

  for (let i = 0; i < totalQ; i++) {
    state.status[i] = i === startIdx ? 'not_answered' : 'not_visited';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveScreenshotSrc(imgPath) {
    if (!imgPath) return '';
    if (/^(https?:|data:|\/|\.\.)/.test(imgPath)) return imgPath;
    return `../${imgPath}`;
  }

  // --- Theme Initialization (shared site-wide key 'jam_theme') ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('jam_theme', theme);
    } catch (e) {}
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function initTheme() {
    let saved = 'light';
    try {
      saved = localStorage.getItem('jam_theme') || 'dark';
    } catch (e) {}
    applyTheme(saved);
  }

  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  // --- Timer Logic ---
  function formatClock(sec) {
    const s = Math.max(0, Math.floor(sec));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(rem)}` : `${pad(mins)}:${pad(rem)}`;
  }

  function startTimer() {
    const timerBox = document.getElementById('exam-timer');
    const disp = document.getElementById('timer-display');

    const tick = () => {
      if (state.submitted) return;
      state.elapsedSeconds++;
      if (state.mode === 'practice') {
        if (disp) disp.textContent = `Elapsed: ${formatClock(state.elapsedSeconds)}`;
      } else {
        state.remainingSeconds = Math.max(0, state.remainingSeconds - 1);
        if (disp) disp.textContent = formatClock(state.remainingSeconds);
        if (timerBox) {
          timerBox.classList.toggle('warning', state.remainingSeconds <= 600 && state.remainingSeconds > 120);
          timerBox.classList.toggle('danger', state.remainingSeconds <= 120);
        }
        if (state.remainingSeconds <= 0) {
          clearInterval(state.timerInterval);
          window.submitTest(true);
        }
      }
    };

    if (disp) {
      disp.textContent = state.mode === 'practice'
        ? `Practice · ${formatClock(0)}`
        : formatClock(state.remainingSeconds);
    }
    state.timerInterval = setInterval(tick, 1000);
  }

  // --- Difficulty Integration ---
  function renderDifficultyUI() {
    const q = state.questions[state.currentIdx];
    if (!q || !window.SEM_DIFFICULTY) return;

    const info = window.SEM_DIFFICULTY.getQuestionDifficulty(q, state.testObj);

    const btn = document.getElementById('q-diff-btn');
    const icon = document.getElementById('q-diff-btn-icon');
    const txt = document.getElementById('q-diff-btn-text');
    const usrEl = document.getElementById('q-diff-info-user');

    if (btn) {
      btn.className = `q-diff-badge-btn ${info.meta.cssClass} ${info.isUserTagged ? 'is-user-tagged' : ''}`;
    }
    if (icon) icon.textContent = info.meta.emoji;
    if (txt) txt.textContent = info.meta.label;

    if (usrEl) {
      usrEl.textContent = info.isUserTagged
        ? `${info.meta.emoji} ${info.meta.label}`
        : '⚪ Unrated';
    }

    document.querySelectorAll('.q-diff-dropdown-item').forEach((item) => {
      const val = item.getAttribute('data-diff-val') || '';
      const active = info.isUserTagged ? (val === info.level) : (val === '');
      item.classList.toggle('active', active);
    });
  }

  function showDifficultyToast(msg) {
    let el = document.querySelector('.diff-toast-notification');
    if (!el) {
      el = document.createElement('div');
      el.className = 'diff-toast-notification';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  window.toggleDifficultyMenu = function (ev) {
    if (ev) ev.stopPropagation();
    const wrap = document.getElementById('q-diff-selector-wrap');
    const dd = document.getElementById('q-diff-dropdown');
    if (!dd || !wrap) return;
    const isHidden = dd.classList.contains('hidden');
    dd.classList.toggle('hidden', !isHidden);
    wrap.classList.toggle('open', isHidden);
  };

  window.selectCurrentQuestionDifficulty = function (levelKey) {
    const q = state.questions[state.currentIdx];
    if (!q || !window.SEM_DIFFICULTY) return;
    const res = window.SEM_DIFFICULTY.setQuestionDifficulty(q.id, levelKey);
    const dd = document.getElementById('q-diff-dropdown');
    const wrap = document.getElementById('q-diff-selector-wrap');
    if (dd) dd.classList.add('hidden');
    if (wrap) wrap.classList.remove('open');
    renderDifficultyUI();
    showDifficultyToast(levelKey
      ? `Tagged Q${q.q_num || state.currentIdx + 1}: ${res.meta.emoji} ${res.meta.label}`
      : `Cleared personal tag (reverted to ${res.meta.label})`);
  };

  // --- Palette & Question Rendering ---
  function updatePaletteCounts() {
    let ans = 0;
    let notAns = 0;
    let notVis = 0;
    let rev = 0;
    let ansRev = 0;
    for (let i = 0; i < totalQ; i++) {
      const st = state.status[i];
      if (st === 'answered') ans++;
      else if (st === 'not_answered') notAns++;
      else if (st === 'marked') rev++;
      else if (st === 'answered_marked') ansRev++;
      else notVis++;
    }
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setT('count-answered', ans);
    setT('count-not-answered', notAns);
    setT('count-not-visited', notVis);
    setT('count-review', rev);
    setT('count-ans-review', ansRev);
  }

  function renderPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    grid.innerHTML = state.questions.map((q, idx) => {
      const st = state.status[idx];
      let cls = 'q-num-btn ';
      if (st === 'answered') cls += 'st-answered';
      else if (st === 'not_answered') cls += 'st-not-answered';
      else if (st === 'marked') cls += 'st-marked';
      else if (st === 'answered_marked') cls += 'st-ans-marked';
      else cls += 'st-not-visited';
      if (idx === state.currentIdx) cls += ' current';

      return `<button type="button" class="${cls}" onclick="window.jumpToQuestion(${idx})" title="Question ${idx + 1}">${idx + 1}</button>`;
    }).join('');

    updatePaletteCounts();
  }

  function renderQuestion() {
    const q = state.questions[state.currentIdx];
    if (!q) return;

    if (state.status[state.currentIdx] === 'not_visited') {
      state.status[state.currentIdx] = 'not_answered';
    }

    const qNumDisplay = document.getElementById('q-num-display');
    const qYearDisplay = document.getElementById('q-year-display');
    const qTypeBadge = document.getElementById('q-type-badge');
    const qMarksPill = document.getElementById('q-marks-pill');
    const bodyEl = document.getElementById('q-body-text');
    const optsContainer = document.getElementById('q-options-container');
    const btnShot = document.getElementById('btn-view-screenshot');

    const dispNum = state.currentIdx + 1;
    const origNum = q.q_num || dispNum;
    const courseLabel = q.course_code || state.testObj.course_code || '';
    const yearLabel = q.year || state.testObj.year || '';

    if (qNumDisplay) qNumDisplay.textContent = `Question ${dispNum} of ${totalQ}`;
    if (qYearDisplay) {
      qYearDisplay.textContent = state.isCustom
        ? `${courseLabel} · ${yearLabel} (Q${origNum})`
        : `${yearLabel} Official · Q${origNum}`;
    }
    if (qTypeBadge) qTypeBadge.textContent = q.type || 'MCQ';
    if (qMarksPill) {
      const m = q.marks !== undefined ? q.marks : 1.5;
      const neg = q.negative_marks !== undefined ? q.negative_marks : 0;
      qMarksPill.textContent = `Marks: +${m} | Neg: ${neg > 0 ? '-' + neg : '0'}`;
    }

    const imgSrc = resolveScreenshotSrc(q.image);
    if (btnShot) {
      btnShot.style.display = imgSrc ? 'inline-flex' : 'none';
    }

    // Screenshot-first clean display
    if (bodyEl) {
      if (imgSrc) {
        bodyEl.innerHTML = `
          <div class="q-screenshot-wrapper">
            <img src="${escapeHtml(imgSrc)}" alt="Question ${origNum} (${escapeHtml(courseLabel)} ${escapeHtml(yearLabel)})" class="q-screenshot-img" onclick="window.viewCurrentQuestionScreenshot()" title="Click to enlarge question image" />
          </div>
        `;
      } else {
        bodyEl.innerHTML = `<div class="q-text-fallback">${escapeHtml(q.question || 'Question image unavailable.')}</div>`;
      }
    }

    // Choice Tiles matching app.css
    const keys = ['A', 'B', 'C', 'D'];
    const selected = state.responses[state.currentIdx] || null;
    if (optsContainer) {
      optsContainer.innerHTML = `
        <div class="choice-tiles-grid">
          ${keys.map((k) => {
            const rawOpt = q.options && q.options[k] ? String(q.options[k]).trim() : '';
            const isPlaceholder = !rawOpt || rawOpt === `Option (${k})` || rawOpt === `(${k})`;
            const isSel = selected === k;
            return `
              <div class="choice-tile ${isSel ? 'selected' : ''}" role="button" tabindex="0" onclick="window.selectMCQOption('${k}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.selectMCQOption('${k}');}">
                <div class="choice-tile-badge">${k}</div>
                <div class="choice-tile-content">
                  <div class="choice-tile-title">Option (${k})</div>
                  ${!isPlaceholder ? `<div class="choice-tile-text">${escapeHtml(rawOpt)}</div>` : ''}
                </div>
                <div class="choice-tile-radio"><div class="radio-inner"></div></div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    renderDifficultyUI();
    renderPalette();

    if (window.MathJax && window.MathJax.typesetPromise && bodyEl) {
      window.MathJax.typesetPromise([bodyEl, optsContainer]).catch(() => {});
    }
  }

  // --- Navigation & Response Actions ---
  window.selectMCQOption = function (optKey) {
    if (state.submitted) return;
    state.responses[state.currentIdx] = optKey;
    const prevSt = state.status[state.currentIdx];
    state.status[state.currentIdx] = (prevSt === 'marked' || prevSt === 'answered_marked')
      ? 'answered_marked'
      : 'answered';
    renderQuestion();
  };

  window.jumpToQuestion = function (idx) {
    if (idx < 0 || idx >= totalQ) return;
    state.currentIdx = idx;
    renderQuestion();
    window.closePaletteDrawer();
  };

  window.saveAndNext = function () {
    const hasResp = Boolean(state.responses[state.currentIdx]);
    state.status[state.currentIdx] = hasResp ? 'answered' : 'not_answered';
    if (state.currentIdx < totalQ - 1) {
      state.currentIdx++;
    }
    renderQuestion();
  };

  window.markForReviewAndNext = function () {
    const hasResp = Boolean(state.responses[state.currentIdx]);
    state.status[state.currentIdx] = hasResp ? 'answered_marked' : 'marked';
    if (state.currentIdx < totalQ - 1) {
      state.currentIdx++;
    }
    renderQuestion();
  };

  window.clearResponse = function () {
    delete state.responses[state.currentIdx];
    state.status[state.currentIdx] = 'not_answered';
    renderQuestion();
  };

  window.prevQuestion = function () {
    if (state.currentIdx > 0) {
      state.currentIdx--;
      renderQuestion();
    }
  };

  // --- Palette Drawer (Mobile) ---
  window.togglePaletteDrawer = function () {
    const pane = document.getElementById('palette-pane');
    const backdrop = document.getElementById('palette-backdrop');
    if (!pane) return;
    const opening = !pane.classList.contains('drawer-open');
    pane.classList.toggle('drawer-open', opening);
    if (backdrop) backdrop.classList.toggle('active', opening);
  };

  window.closePaletteDrawer = function () {
    const pane = document.getElementById('palette-pane');
    const backdrop = document.getElementById('palette-backdrop');
    if (pane) pane.classList.remove('drawer-open');
    if (backdrop) backdrop.classList.remove('active');
  };

  // --- Modals ---
  window.showSubmitModal = function () {
    let ans = 0;
    let notAns = 0;
    let rev = 0;
    let notVis = 0;
    for (let i = 0; i < totalQ; i++) {
      const st = state.status[i];
      if (st === 'answered' || st === 'answered_marked') ans++;
      if (st === 'marked' || st === 'answered_marked') rev++;
      if (st === 'not_answered') notAns++;
      if (st === 'not_visited') notVis++;
    }
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setT('modal-summary-answered', ans);
    setT('modal-summary-not-answered', notAns);
    setT('modal-summary-review', rev);
    setT('modal-summary-not-visited', notVis);

    const modal = document.getElementById('submit-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSubmitModal = function () {
    const modal = document.getElementById('submit-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.submitTest = function (isAuto) {
    if (state.submitted) return;
    state.submitted = true;
    clearInterval(state.timerInterval);
    window.closeSubmitModal();
    window.closePaletteDrawer();

    if (typeof window.renderTestResults === 'function') {
      window.renderTestResults(state, Boolean(isAuto));
    }
  };

  window.showQuestionPaperModal = function () {
    const modal = document.getElementById('qpaper-modal');
    const list = document.getElementById('qpaper-list');
    if (!modal || !list) return;

    list.innerHTML = state.questions.map((q, idx) => {
      const st = state.status[idx];
      const badge = state.responses[idx]
        ? `<span style="color:var(--brand-primary);font-weight:700;">Answered: (${state.responses[idx]})</span>`
        : `<span style="color:var(--text-muted);">${st === 'marked' ? 'Marked for Review' : 'Unattempted'}</span>`;
      const imgSrc = resolveScreenshotSrc(q.image);
      return `
        <div class="qpaper-item" style="padding:14px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:12px;cursor:pointer;" onclick="window.closeQuestionPaperModal();window.jumpToQuestion(${idx});">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong>Q${idx + 1} · ${escapeHtml(q.course_code || state.testObj.course_code)} (${escapeHtml(q.year || state.testObj.year)})</strong>
            ${badge}
          </div>
          ${imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="Q${idx + 1}" style="max-width:100%;height:auto;border-radius:4px;background:#fff;padding:4px;" loading="lazy" />`
            : `<p style="font-size:0.88rem;color:var(--text-secondary);">${escapeHtml(q.question)}</p>`}
        </div>
      `;
    }).join('');

    modal.classList.remove('hidden');
  };

  window.closeQuestionPaperModal = function () {
    const modal = document.getElementById('qpaper-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.viewCurrentQuestionScreenshot = function () {
    const q = state.questions[state.currentIdx];
    if (!q || !q.image) return;
    const src = resolveScreenshotSrc(q.image);
    const modal = document.getElementById('screenshot-modal');
    const img = document.getElementById('screenshot-modal-img');
    const title = document.getElementById('screenshot-modal-title');
    const link = document.getElementById('screenshot-open-tab');
    const loading = document.getElementById('screenshot-loading');

    if (title) title.textContent = `${q.course_code || state.testObj.course_code} ${q.year || state.testObj.year} — Question ${q.q_num || state.currentIdx + 1}`;
    if (link) link.href = src;
    if (loading) loading.classList.remove('hidden');
    if (img) {
      img.onload = () => { if (loading) loading.classList.add('hidden'); };
      img.onerror = () => { if (loading) loading.classList.add('hidden'); };
      img.src = src;
    }
    if (modal) modal.classList.remove('hidden');
  };

  window.closeScreenshotModal = function () {
    const modal = document.getElementById('screenshot-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.showInstructionsModal = function () {
    const modal = document.getElementById('instructions-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeInstructionsModal = function () {
    const modal = document.getElementById('instructions-modal');
    if (modal) modal.classList.add('hidden');
  };

  // --- Initialization ---
  function init() {
    initTheme();

    const titleEl = document.getElementById('exam-topic-title');
    const subEl = document.getElementById('exam-topic-sub');
    if (titleEl) titleEl.textContent = currentTest.name || `${currentTest.course_code} ${currentTest.year}`;
    if (subEl) {
      const modeTxt = state.mode === 'practice' ? 'Practice Mode (Untimed)' : `Official Timed Mode (${currentTest.duration_minutes || 90} Mins)`;
      const marksTotal = currentTest.total_marks || (totalQ * 1.5);
      subEl.textContent = `UNPG / DDUGU Semester V · ${totalQ} MCQs · ${marksTotal} Marks · ${modeTxt}`;
    }

    document.title = `${currentTest.name || currentTest.id} — CBT Mock Test`;

    document.addEventListener('click', (ev) => {
      const wrap = document.getElementById('q-diff-selector-wrap');
      const dd = document.getElementById('q-diff-dropdown');
      if (wrap && dd && !wrap.contains(ev.target)) {
        dd.classList.add('hidden');
        wrap.classList.remove('open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (state.submitted) return;
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key;
      if (key === 'Escape') {
        window.closeScreenshotModal();
        window.closeQuestionPaperModal();
        window.closeSubmitModal();
        window.closeInstructionsModal();
        window.closePaletteDrawer();
        const dd = document.getElementById('q-diff-dropdown');
        const wrap = document.getElementById('q-diff-selector-wrap');
        if (dd) dd.classList.add('hidden');
        if (wrap) wrap.classList.remove('open');
        return;
      }

      if (key === 'a' || key === 'A' || key === '1') window.selectMCQOption('A');
      else if (key === 'b' || key === 'B' || key === '2') window.selectMCQOption('B');
      else if (key === 'c' || key === 'C' || key === '3') window.selectMCQOption('C');
      else if (key === 'd' || key === 'D' || key === '4') window.selectMCQOption('D');
      else if (key === 'ArrowRight') window.saveAndNext();
      else if (key === 'ArrowLeft') window.prevQuestion();
      else if (key === 'Enter') window.saveAndNext();
      else if (key === 'r' || key === 'R' || key === 'm' || key === 'M') window.markForReviewAndNext();
      else if (key === 'x' || key === 'X' || key === 'Delete') window.clearResponse();
    });

    window.addEventListener('sem-difficulty-updated', renderDifficultyUI);
    window.addEventListener('sem-difficulty-visibility-changed', renderDifficultyUI);

    renderQuestion();
    startTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
