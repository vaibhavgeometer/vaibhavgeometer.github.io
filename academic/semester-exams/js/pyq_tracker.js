/* ============================================
   UNPG B.Sc. Semester V — PYQ Tracker & Search Engine (750 MCQs)
   ============================================
   - Hydrates all 750 MCQs across 15 official papers (2023-24, 2024-25, 2025-26)
   - Smart query parser (Course+Year+Q#, Year+Q#, Course+Q#, ID, Topic/Keyword)
   - Isolated localStorage ('sem_pyq_user_tracker_v1') + Cloud Sync integration
   - Subject (Mathematics / Physics) & Course (MAT301F-PHY302F) mini-cards
   - Bulk Solve / Unsolve, JSON Export / Import, High-Res Question Modal Viewer
   ============================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'sem_pyq_user_tracker_v1';
  const PAGE_SIZE = 24;

  const COURSE_CATALOG = [
    { code: 'MAT301F', title: 'Ring Theory & Linear Algebra', short: 'Ring Theory & LA', icon: '💍', subject: 'Mathematics', keywords: ['ring', 'ideal', 'field', 'homomorphism', 'quotient', 'polynomial', 'vector space', 'bilinear', 'linear transformation', 'matrix', 'eigenvalue', 'minimal polynomial', 'gaussian', 'integral domain', 'pid', 'ufd', 'subspace', 'kernel', 'basis'] },
    { code: 'MAT302F', title: 'Tensor Analysis', short: 'Tensor Analysis', icon: '∇', subject: 'Mathematics', keywords: ['tensor', 'covariant', 'contravariant', 'metric', 'christoffel', 'kronecker', 'levi-civita', 'riemann', 'ricci', 'geodesic', 'bianchi', 'einstein', 'affine', 'jacobian', 'transformation', 'invariant', 'rank'] },
    { code: 'MAT303F', title: 'Differential Geometry', short: 'Diff. Geometry', icon: '🌀', subject: 'Mathematics', keywords: ['curve', 'curvature', 'torsion', 'serret', 'frenet', 'osculating', 'evolute', 'involute', 'surface', 'first fundamental', 'second fundamental', 'gaussian curvature', 'mean curvature', 'asymptotic', 'umbilic', 'meusnier', 'euler', 'helix'] },
    { code: 'PHY301F', title: 'Classical & Statistical Mechanics', short: 'Classical & Stat Mech', icon: '⚙️', subject: 'Physics', keywords: ['lagrangian', 'hamiltonian', 'poisson', 'canonical', 'generalized', 'holonomic', 'central force', 'kepler', 'virial', 'd alembert', 'action', 'ensemble', 'boltzmann', 'fermi', 'bose', 'partition function', 'entropy', 'phase space', 'gibbs', 'planck', 'distribution'] },
    { code: 'PHY302F', title: 'Quantum Mechanics & Spectroscopy', short: 'Quantum & Spec', icon: '⚛️', subject: 'Physics', keywords: ['schrodinger', 'wave function', 'operator', 'commutator', 'eigenstate', 'harmonic oscillator', 'particle in a box', 'hydrogen', 'angular momentum', 'spin', 'pauli', 'perturbation', 'zeeman', 'stark', 'raman', 'balmer', 'selection rule', 'spectroscopy', 'bohr', 'de broglie'] }
  ];

  const COURSE_MAP = {};
  COURSE_CATALOG.forEach((c) => { COURSE_MAP[c.code] = c; });

  const state = {
    allQuestions: [],
    filteredQuestions: [],
    trackerData: { solved: {}, difficulty: {}, lastUpdated: null },
    filters: {
      year: 'ALL',
      subject: 'ALL',
      course: 'ALL',
      status: 'ALL',
      difficulty: 'ALL',
      sort: 'year_desc',
      search: '',
      idList: null,
      idLabel: ''
    },
    courseTabSubject: 'ALL',
    coursesCollapsed: false,
    currentPage: 1,
    showAll: false,
    modalQId: null,
    modalRevealed: false
  };

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.trackerData = {
            solved: (parsed.solved && typeof parsed.solved === 'object') ? parsed.solved : {},
            difficulty: (parsed.difficulty && typeof parsed.difficulty === 'object') ? parsed.difficulty : {},
            lastUpdated: parsed.lastUpdated || null
          };
          return;
        }
      }
    } catch (e) {}
    state.trackerData = { solved: {}, difficulty: {}, lastUpdated: null };
  }

  function saveStorage() {
    try {
      // Preserve latest difficulty overrides from SEM_DIFFICULTY if modified independently
      if (window.SEM_DIFFICULTY && typeof window.SEM_DIFFICULTY.getUserDifficultyMap === 'function') {
        state.trackerData.difficulty = window.SEM_DIFFICULTY.getUserDifficultyMap();
      }
      state.trackerData.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trackerData));
    } catch (e) {}

    if (window.SEM_STATS && typeof window.SEM_STATS.updateQuickStatsStrip === 'function') {
      window.SEM_STATS.updateQuickStatsStrip();
    }
    if (window.SEM_CLOUD_SYNC && typeof window.SEM_CLOUD_SYNC.scheduleAutoPush === 'function') {
      window.SEM_CLOUD_SYNC.scheduleAutoPush();
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatSolvedShortDate(iso) {
    if (!iso) return 'Solved';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Solved';
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dKey === todayKey) return 'Solved Today';
    return 'Solved ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function hydrateQuestions() {
    const out = [];
    const tests = window.MOCK_TESTS_DATA || {};
    Object.values(tests).forEach((t) => {
      const courseMeta = COURSE_MAP[t.course_code] || {};
      const cKeywords = (courseMeta.keywords || []).join(' ');
      (t.questions || []).forEach((q) => {
        const qNum = Number(q.q_num || 1);
        const explClean = (q.explanation && !String(q.explanation).startsWith('Verified according to standard university curriculum'))
          ? q.explanation
          : '';
        const item = {
          id: q.id,
          testId: t.id,
          testName: t.name,
          course_code: q.course_code || t.course_code,
          course_title: t.course_title || courseMeta.title || q.course_code,
          subject: t.subject || courseMeta.subject || 'General',
          year: q.year || t.year,
          qNum,
          type: q.type || 'MCQ',
          marks: Number(q.marks || 1.5),
          negativeMarks: Number(q.negative_marks || 0),
          image: q.image || '',
          question: q.question || '',
          answerKey: q.answer_key || 'A',
          explanation: q.explanation || '',
          videos: t.videos || [],
          searchBlob: [
            q.id,
            t.id,
            q.course_code || t.course_code,
            t.course_title,
            t.subject,
            t.year,
            `Q${qNum}`,
            `Q${String(qNum).padStart(2, '0')}`,
            cKeywords,
            q.question || '',
            explClean
          ].join(' ').toLowerCase()
        };
        item.diff = window.SEM_DIFFICULTY
          ? window.SEM_DIFFICULTY.getQuestionDifficulty(item, t)
          : { level: 'medium', meta: { label: 'Medium', shortLabel: 'Medium', emoji: '🟡', cssClass: 'diff-medium', order: 3 }, isUserTagged: false };
        out.push(item);
      });
    });
    state.allQuestions = out;
  }

  function refreshDifficultyMetadata() {
    state.allQuestions.forEach((item) => {
      if (window.SEM_DIFFICULTY) {
        item.diff = window.SEM_DIFFICULTY.getQuestionDifficulty(item);
      }
    });
  }

  function normalizeYearToken(tok) {
    if (!tok) return null;
    if (/2025/.test(tok)) return '2025-26';
    if (/2024/.test(tok)) return '2024-25';
    if (/2023/.test(tok)) return '2023-24';
    return null;
  }

  function parseSearchQuery(raw) {
    const qStr = String(raw || '').trim();
    if (!qStr) return { mode: 'empty' };

    const lower = qStr.toLowerCase();

    // Direct ID pattern like MAT301F_2025-26_Q12
    const fullIdMatch = lower.match(/^([a-z]{3}\d{3}f?)[_\s-]+(\d{4}(?:-\d{2})?)[_\s-]+q?(\d{1,2})$/i);
    if (fullIdMatch) {
      let c = fullIdMatch[1].toUpperCase();
      if (!c.endsWith('F')) c += 'F';
      const y = normalizeYearToken(fullIdMatch[2]) || fullIdMatch[2];
      const n = parseInt(fullIdMatch[3], 10);
      return { mode: 'exact_tuple', course: c, year: y, qNum: n };
    }

    // Course + Q# like "MAT301F Q15" or "PHY302 8"
    const cQMatch = lower.match(/^((?:mat|phy)\d{3}f?)\s*(?:q|#)?\s*(\d{1,2})$/i);
    if (cQMatch) {
      let c = cQMatch[1].toUpperCase();
      if (!c.endsWith('F')) c += 'F';
      return { mode: 'course_qnum', course: c, qNum: parseInt(cQMatch[2], 10) };
    }

    // Year + Q# like "2024 Q15" or "2025-26 12"
    const yQMatch = lower.match(/^(\d{4}(?:-\d{2})?)\s*(?:q|#)?\s*(\d{1,2})$/i);
    if (yQMatch) {
      const y = normalizeYearToken(yQMatch[1]);
      if (y) return { mode: 'year_qnum', year: y, qNum: parseInt(yQMatch[2], 10) };
    }

    // Pure Q# like "Q15" or "q 7"
    const pureQ = lower.match(/^q\s*#?\s*(\d{1,2})$/i);
    if (pureQ) {
      return { mode: 'qnum', qNum: parseInt(pureQ[1], 10) };
    }

    // Multi-word / keyword search
    const tokens = lower.split(/\s+/).filter(Boolean);
    return { mode: 'tokens', tokens, raw: lower };
  }

  function applyFilters() {
    refreshDifficultyMetadata();
    const f = state.filters;
    const parsedSearch = parseSearchQuery(f.search);

    let list = state.allQuestions.filter((q) => {
      if (Array.isArray(f.idList)) {
        if (!f.idList.includes(q.id)) return false;
      }

      if (f.year !== 'ALL' && q.year !== f.year) return false;
      if (f.subject !== 'ALL' && q.subject !== f.subject) return false;
      if (f.course !== 'ALL' && q.course_code !== f.course) return false;

      const isSolved = Boolean(state.trackerData.solved[q.id]);
      if (f.status === 'solved' && !isSolved) return false;
      if (f.status === 'unsolved' && isSolved) return false;

      if (f.difficulty !== 'ALL') {
        if (f.difficulty === 'EASY_OR_LESS') {
          if (q.diff.level !== 'very_easy' && q.diff.level !== 'easy') return false;
        } else if (f.difficulty === 'HARD_OR_MORE') {
          if (q.diff.level !== 'hard' && q.diff.level !== 'hardest') return false;
        } else if (q.diff.level !== f.difficulty) {
          return false;
        }
      }

      if (parsedSearch.mode === 'exact_tuple') {
        if (q.course_code !== parsedSearch.course || q.year !== parsedSearch.year || q.qNum !== parsedSearch.qNum) return false;
      } else if (parsedSearch.mode === 'course_qnum') {
        if (q.course_code !== parsedSearch.course || q.qNum !== parsedSearch.qNum) return false;
      } else if (parsedSearch.mode === 'year_qnum') {
        if (q.year !== parsedSearch.year || q.qNum !== parsedSearch.qNum) return false;
      } else if (parsedSearch.mode === 'qnum') {
        if (q.qNum !== parsedSearch.qNum) return false;
      } else if (parsedSearch.mode === 'tokens') {
        for (const tok of parsedSearch.tokens) {
          if (!q.searchBlob.includes(tok)) return false;
        }
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      if (f.sort === 'year_asc') {
        if (a.year !== b.year) return a.year.localeCompare(b.year);
        if (a.course_code !== b.course_code) return a.course_code.localeCompare(b.course_code);
        return a.qNum - b.qNum;
      }
      if (f.sort === 'course_asc') {
        if (a.course_code !== b.course_code) return a.course_code.localeCompare(b.course_code);
        if (a.year !== b.year) return b.year.localeCompare(a.year);
        return a.qNum - b.qNum;
      }
      if (f.sort === 'diff_asc') {
        const dA = (a.diff && a.diff.meta && a.diff.meta.order) || 3;
        const dB = (b.diff && b.diff.meta && b.diff.meta.order) || 3;
        if (dA !== dB) return dA - dB;
      }
      if (f.sort === 'diff_desc') {
        const dA = (a.diff && a.diff.meta && a.diff.meta.order) || 3;
        const dB = (b.diff && b.diff.meta && b.diff.meta.order) || 3;
        if (dA !== dB) return dB - dA;
      }
      if (f.sort === 'unsolved_first') {
        const sA = state.trackerData.solved[a.id] ? 1 : 0;
        const sB = state.trackerData.solved[b.id] ? 1 : 0;
        if (sA !== sB) return sA - sB;
      }
      // Default year_desc
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      if (a.course_code !== b.course_code) return a.course_code.localeCompare(b.course_code);
      return a.qNum - b.qNum;
    });

    state.filteredQuestions = list;
  }

  function renderProgressHeader() {
    const total = state.allQuestions.length || 750;
    let solvedCount = 0;
    state.allQuestions.forEach((q) => {
      if (state.trackerData.solved[q.id]) solvedCount++;
    });
    const unsolvedCount = Math.max(0, total - solvedCount);
    const pctExact = total > 0 ? ((solvedCount / total) * 100) : 0;
    const pctDisplay = pctExact.toFixed(1);

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('tracker-overall-percentage', `${solvedCount} / ${total}`);
    setTxt('tracker-exact-percentage', `${pctDisplay}% Completed`);
    setTxt('stat-pill-solved', `${solvedCount} Solved`);
    setTxt('stat-pill-unsolved', `${unsolvedCount} Remaining`);

    const barEl = document.getElementById('tracker-overall-bar');
    if (barEl) barEl.style.width = `${Math.min(100, pctExact)}%`;

    const heroPill = document.getElementById('hero-progress-pill');
    if (heroPill) {
      heroPill.textContent = `${solvedCount} / ${total} (${pctDisplay}%)`;
    }
    const navPill = document.getElementById('nav-tracker-progress-pill');
    if (navPill) {
      navPill.textContent = `${solvedCount}/${total}`;
    }

    renderSubjectMiniGrid();
    renderCourseMiniGrid();
    renderDifficultyDistPills();
  }

  function renderSubjectMiniGrid() {
    const grid = document.getElementById('topic-progress-mini-grid');
    if (!grid) return;

    const subjects = [
      { name: 'Mathematics', icon: '📐', desc: 'MAT301F · MAT302F · MAT303F' },
      { name: 'Physics', icon: '⚛️', desc: 'PHY301F · PHY302F' }
    ];

    grid.innerHTML = subjects.map((s) => {
      const qs = state.allQuestions.filter((q) => q.subject === s.name);
      const solved = qs.filter((q) => state.trackerData.solved[q.id]).length;
      const pct = qs.length ? ((solved / qs.length) * 100).toFixed(0) : 0;
      const active = state.filters.subject === s.name;
      return `
        <div class="topic-mini-card ${active ? 'active' : ''}" onclick="SEM_TRACKER.toggleSubjectCard('${s.name}')" title="Filter to ${s.name}">
          <div class="topic-mini-header">
            <span class="topic-mini-title">${s.icon} ${s.name}</span>
            <span style="font-size:0.78rem; color:var(--text-secondary); font-weight:700;">${solved}/${qs.length} (${pct}%)</span>
          </div>
          <div style="font-size:0.74rem; color:var(--text-muted); margin-bottom:6px;">${s.desc}</div>
          <div class="topic-mini-bar"><div class="topic-mini-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderCourseMiniGrid() {
    const grid = document.getElementById('subtopic-progress-mini-grid');
    if (!grid) return;

    const list = COURSE_CATALOG.filter((c) => state.courseTabSubject === 'ALL' || c.subject === state.courseTabSubject);
    const badge = document.getElementById('subtopic-total-badge');
    if (badge) badge.textContent = `${list.length} Courses`;

    grid.classList.toggle('collapsed', state.coursesCollapsed);
    const cIcon = document.getElementById('subtopic-collapse-icon');
    const cText = document.getElementById('subtopic-collapse-text');
    if (cIcon) cIcon.textContent = state.coursesCollapsed ? '▸' : '▾';
    if (cText) cText.textContent = state.coursesCollapsed ? 'Expand' : 'Collapse';

    grid.innerHTML = list.map((c) => {
      const qs = state.allQuestions.filter((q) => q.course_code === c.code);
      const solved = qs.filter((q) => state.trackerData.solved[q.id]).length;
      const pct = qs.length ? ((solved / qs.length) * 100).toFixed(0) : 0;
      const active = state.filters.course === c.code;
      const parentActive = state.filters.subject === c.subject && state.filters.course === 'ALL';
      return `
        <div class="subtopic-mini-card ${active ? 'active' : ''} ${parentActive ? 'parent-active' : ''}" onclick="SEM_TRACKER.toggleCourseCard('${c.code}')" title="Filter to ${c.code} (${c.title})">
          <div class="subtopic-mini-header">
            <div class="subtopic-mini-left">
              <span class="subtopic-mini-icon">${c.icon}</span>
              <span class="subtopic-mini-title">${c.code} · ${c.short}</span>
            </div>
            <div class="subtopic-mini-stats">
              <span class="subtopic-count">${solved}/${qs.length}</span>
              <span class="subtopic-pct">(${pct}%)</span>
            </div>
          </div>
          <div class="subtopic-mini-bar"><div class="subtopic-mini-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderDifficultyDistPills() {
    const wrap = document.getElementById('difficulty-dist-pills');
    if (!wrap || !window.SEM_DIFFICULTY) return;
    const stats = window.SEM_DIFFICULTY.getAllStats(state.allQuestions);
    const levels = window.SEM_DIFFICULTY.LEVELS;
    const order = window.SEM_DIFFICULTY.ORDER;

    wrap.innerHTML = order.map((key) => {
      const m = levels[key];
      const cnt = stats.counts[key] || 0;
      const active = state.filters.difficulty === key;
      return `
        <button class="diff-pill ${m.cssClass} ${active ? 'active' : ''}" style="cursor:pointer; ${active ? 'box-shadow:0 0 0 2px var(--text-main);' : ''}" onclick="SEM_TRACKER.toggleDifficultyFilter('${key}')" title="Filter ${m.label} questions">
          <span>${m.emoji} ${m.shortLabel}: <strong>${cnt}</strong></span>
        </button>
      `;
    }).join('');
  }

  function renderGrid() {
    const container = document.getElementById('tracker-questions-container');
    if (!container) return;

    const totalFiltered = state.filteredQuestions.length;
    const countEl = document.getElementById('tracker-results-count');
    if (countEl) countEl.textContent = totalFiltered;

    const noticeEl = document.getElementById('tracker-results-notice');
    if (noticeEl) {
      if (Array.isArray(state.filters.idList)) {
        noticeEl.innerHTML = `<span class="undated-stats-notice">Filtered: ${escapeHtml(state.filters.idLabel || 'Custom Selection')} <button class="btn-clear-date-filter" onclick="SEM_TRACKER.clearIdFilter()">✕ Clear</button></span>`;
      } else {
        noticeEl.innerHTML = '';
      }
    }

    if (totalFiltered === 0) {
      container.innerHTML = `
        <div class="tracker-empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No Matching Questions Found</div>
          <p class="empty-state-desc">Try clearing search keywords or switching Academic Year / Course / Difficulty filters back to All.</p>
          <button class="tracker-action-btn accent" style="margin-top:14px;" onclick="SEM_TRACKER.clearAllFilters()">Reset All Filters</button>
        </div>
      `;
      renderPagination(0, 1);
      return;
    }

    const totalPages = state.showAll ? 1 : Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = state.showAll ? 0 : (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = state.showAll
      ? state.filteredQuestions
      : state.filteredQuestions.slice(startIdx, startIdx + PAGE_SIZE);

    const diffLevels = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.LEVELS : {};
    const diffOrder = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.ORDER : [];

    container.innerHTML = pageItems.map((q) => {
      const solvedEntry = state.trackerData.solved[q.id];
      const isSolved = Boolean(solvedEntry);
      const solvedDateLabel = isSolved ? formatSolvedShortDate(solvedEntry.solvedAt) : '';

      const diffBadgeHtml = window.SEM_DIFFICULTY
        ? window.SEM_DIFFICULTY.getDifficultyBadgeHtml(q.diff, { short: true })
        : '';

      const diffOptionsHtml = diffOrder.map((lvlKey) => {
        const m = diffLevels[lvlKey];
        const sel = (q.diff.isUserTagged && q.diff.level === lvlKey) ? 'selected' : '';
        return `<option value="${lvlKey}" ${sel}>${m.emoji} ${m.shortLabel}</option>`;
      }).join('');

      const hasValidImg = Boolean(q.image);
      const mediaHtml = hasValidImg
        ? `
          <div class="q-card-image-wrap" onclick="SEM_TRACKER.openQuestionModal('${q.id}')" title="Click to inspect full resolution">
            <img src="${escapeHtml(q.image)}" alt="${escapeHtml(q.id)}" class="q-card-image" loading="lazy" />
            <span class="q-zoom-hint">🔍 Expand Q${q.qNum}</span>
          </div>
        `
        : `<div class="q-card-image-wrap" onclick="SEM_TRACKER.openQuestionModal('${q.id}')" style="padding:18px; background:var(--bg-body); color:var(--text-main); font-size:0.88rem;">${escapeHtml(q.question)}</div>`;

      const explClean = (q.explanation && !q.explanation.startsWith('Verified according to standard university curriculum'))
        ? `<div style="margin-top:6px; font-weight:500; font-size:0.78rem; color:var(--text-secondary);">${escapeHtml(q.explanation)}</div>`
        : '';

      return `
        <article class="q-tracker-card ${isSolved ? 'is-solved' : ''}" data-qid="${escapeHtml(q.id)}">
          <div class="q-card-header">
            <div class="q-header-left">
              <span class="q-id-pill">Q${q.qNum}</span>
              <span class="q-year-label">${escapeHtml(q.year)}</span>
              <span class="q-course-tag">${escapeHtml(q.course_code)}</span>
            </div>
            <div class="q-header-right">
              ${diffBadgeHtml}
              <span class="q-marks-pill">+${q.marks}</span>
            </div>
          </div>

          <div class="q-card-tags">
            <span class="q-topic-tag">${escapeHtml(q.course_title)}</span>
            <span class="q-subject-tag">${escapeHtml(q.subject)}</span>
            ${isSolved ? `<span class="q-solved-date-tag">✓ ${escapeHtml(solvedDateLabel)}</span>` : ''}
          </div>

          ${mediaHtml}

          <div class="q-card-footer">
            <div class="q-controls-row">
              <button class="btn-toggle-solved ${isSolved ? 'active' : ''}" onclick="SEM_TRACKER.toggleSolved('${q.id}')">
                ${isSolved ? '✅ Solved' : '○ Mark Solved'}
              </button>
              <select class="q-diff-select ${q.diff.isUserTagged ? 'is-user-tagged' : ''}" aria-label="Tag difficulty for ${escapeHtml(q.id)}" onchange="SEM_TRACKER.setDifficulty('${q.id}', this.value)">
                <option value="clear" ${!q.diff.isUserTagged ? 'selected' : ''}>Suggested (${escapeHtml(q.diff.meta.shortLabel)})</option>
                ${diffOptionsHtml}
              </select>
            </div>

            <div class="q-extra-row">
              <button class="btn-reveal-key" onclick="SEM_TRACKER.toggleCardAnswer(this)">🔑 Answer Key</button>
              <a class="q-cbt-link" href="mock-test/test.html?test=${encodeURIComponent(q.testId)}&q=${q.qNum}&mode=practice">🖥️ Open Paper ↗</a>
            </div>

            <div class="q-answer-display">
              <div><strong>Official Key:</strong> Option (${escapeHtml(q.answerKey)})</div>
              ${explClean}
            </div>
          </div>
        </article>
      `;
    }).join('');

    renderPagination(totalFiltered, totalPages);
  }

  function renderPagination(totalFiltered, totalPages) {
    const wrap = document.getElementById('tracker-pagination-container');
    if (!wrap) return;
    if (totalFiltered === 0) {
      wrap.innerHTML = '';
      return;
    }

    if (state.showAll) {
      wrap.innerHTML = `
        <span class="page-info-text">Showing all ${totalFiltered} questions</span>
        <button class="page-btn" onclick="SEM_TRACKER.toggleShowAll(false)">Paginate (24/page)</button>
      `;
      return;
    }

    const startItem = (state.currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(totalFiltered, state.currentPage * PAGE_SIZE);

    let html = `<button class="page-btn" ${state.currentPage <= 1 ? 'disabled' : ''} onclick="SEM_TRACKER.goToPage(${state.currentPage - 1})">← Prev</button>`;

    const maxPagesToShow = 5;
    let pStart = Math.max(1, state.currentPage - 2);
    let pEnd = Math.min(totalPages, pStart + maxPagesToShow - 1);
    if (pEnd - pStart < maxPagesToShow - 1) pStart = Math.max(1, pEnd - maxPagesToShow + 1);

    if (pStart > 1) {
      html += `<button class="page-btn" onclick="SEM_TRACKER.goToPage(1)">1</button>`;
      if (pStart > 2) html += `<span class="page-info-text">…</span>`;
    }
    for (let p = pStart; p <= pEnd; p++) {
      html += `<button class="page-btn ${p === state.currentPage ? 'active' : ''}" onclick="SEM_TRACKER.goToPage(${p})">${p}</button>`;
    }
    if (pEnd < totalPages) {
      if (pEnd < totalPages - 1) html += `<span class="page-info-text">…</span>`;
      html += `<button class="page-btn" onclick="SEM_TRACKER.goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" ${state.currentPage >= totalPages ? 'disabled' : ''} onclick="SEM_TRACKER.goToPage(${state.currentPage + 1})">Next →</button>`;
    html += `<span class="page-info-text">${startItem}–${endItem} of ${totalFiltered}</span>`;
    if (totalFiltered > PAGE_SIZE) {
      html += `<button class="page-btn" onclick="SEM_TRACKER.toggleShowAll(true)">Show All (${totalFiltered})</button>`;
    }

    wrap.innerHTML = html;
  }

  function renderAll() {
    applyFilters();
    renderProgressHeader();
    renderGrid();
  }

  function toggleSolved(qId) {
    const q = state.allQuestions.find((x) => x.id === qId);
    if (!q) return;
    if (state.trackerData.solved[qId]) {
      delete state.trackerData.solved[qId];
      showToast(`Marked ${q.course_code} ${q.year} Q${q.qNum} as Unsolved`);
    } else {
      state.trackerData.solved[qId] = {
        solvedAt: new Date().toISOString(),
        course_code: q.course_code,
        year: q.year
      };
      showToast(`Marked ${q.course_code} ${q.year} Q${q.qNum} Solved ✓`);
    }
    saveStorage();
    renderAll();
    if (state.modalQId === qId) renderModalBody();
  }

  function setDifficulty(qId, val) {
    if (window.SEM_DIFFICULTY) {
      window.SEM_DIFFICULTY.setQuestionDifficulty(qId, val);
    }
    refreshDifficultyMetadata();
    renderAll();
    if (state.modalQId === qId) renderModalBody();
    const label = val === 'clear' ? 'Suggested default' : ((window.SEM_DIFFICULTY && window.SEM_DIFFICULTY.LEVELS[val] && window.SEM_DIFFICULTY.LEVELS[val].label) || val);
    showToast(`Difficulty updated: ${label}`);
  }

  function toggleCardAnswer(btn) {
    const footer = btn.closest('.q-card-footer');
    if (!footer) return;
    const ans = footer.querySelector('.q-answer-display');
    if (!ans) return;
    const open = ans.classList.toggle('revealed');
    btn.textContent = open ? '🙈 Hide Answer' : '🔑 Answer Key';
    if (open && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([ans]).catch(() => {});
    }
  }

  function goToPage(page) {
    state.currentPage = Math.max(1, page);
    renderGrid();
    const container = document.getElementById('tracker-questions-container');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleShowAll(val) {
    state.showAll = Boolean(val);
    state.currentPage = 1;
    renderGrid();
  }

  function syncFilterInputs() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal('filter-year-select', state.filters.year);
    setVal('filter-subject-select', state.filters.subject);
    setVal('filter-course-select', state.filters.course);
    setVal('filter-status-select', state.filters.status);
    setVal('filter-diff-select', state.filters.difficulty);
    setVal('filter-sort-select', state.filters.sort);
    setVal('tracker-search-input', state.filters.search);
    setVal('hero-quick-search-input', state.filters.search);

    const clearBtn = document.getElementById('tracker-search-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('visible', Boolean(state.filters.search));
  }

  function setSearchQuery(query) {
    state.filters.search = String(query || '');
    state.currentPage = 1;
    syncFilterInputs();
    renderAll();
  }

  function setFilter(key, val) {
    state.filters[key] = val;
    if (key === 'subject') {
      // Reset course filter if incompatible with newly chosen subject
      if (val !== 'ALL' && state.filters.course !== 'ALL') {
        const c = COURSE_MAP[state.filters.course];
        if (!c || c.subject !== val) state.filters.course = 'ALL';
      }
      populateCourseDropdown();
    }
    state.currentPage = 1;
    syncFilterInputs();
    renderAll();
  }

  function populateCourseDropdown() {
    const sel = document.getElementById('filter-course-select');
    if (!sel) return;
    const prev = state.filters.course;
    const eligible = COURSE_CATALOG.filter((c) => state.filters.subject === 'ALL' || c.subject === state.filters.subject);
    sel.innerHTML = `<option value="ALL">All 5 Courses</option>` +
      eligible.map((c) => `<option value="${c.code}">${c.code} — ${c.title}</option>`).join('');
    if (eligible.some((c) => c.code === prev)) sel.value = prev;
    else {
      state.filters.course = 'ALL';
      sel.value = 'ALL';
    }
  }

  function toggleSubjectCard(subjectName) {
    state.filters.subject = (state.filters.subject === subjectName) ? 'ALL' : subjectName;
    state.filters.course = 'ALL';
    populateCourseDropdown();
    state.currentPage = 1;
    syncFilterInputs();
    renderAll();
  }

  function toggleCourseCard(courseCode) {
    if (state.filters.course === courseCode) {
      state.filters.course = 'ALL';
    } else {
      state.filters.course = courseCode;
      const meta = COURSE_MAP[courseCode];
      if (meta && state.filters.subject !== 'ALL' && state.filters.subject !== meta.subject) {
        state.filters.subject = meta.subject;
        populateCourseDropdown();
      }
    }
    state.currentPage = 1;
    syncFilterInputs();
    renderAll();
  }

  function toggleDifficultyFilter(diffKey) {
    state.filters.difficulty = (state.filters.difficulty === diffKey) ? 'ALL' : diffKey;
    state.currentPage = 1;
    syncFilterInputs();
    renderAll();
  }

  function setCourseTabSubject(subj, btn) {
    state.courseTabSubject = subj;
    document.querySelectorAll('.subtopic-tab').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCourseMiniGrid();
  }

  function toggleCourseCollapse() {
    state.coursesCollapsed = !state.coursesCollapsed;
    renderCourseMiniGrid();
  }

  function clearIdFilter() {
    state.filters.idList = null;
    state.filters.idLabel = '';
    state.currentPage = 1;
    renderAll();
  }

  function clearAllFilters() {
    state.filters = {
      year: 'ALL',
      subject: 'ALL',
      course: 'ALL',
      status: 'ALL',
      difficulty: 'ALL',
      sort: 'year_desc',
      search: '',
      idList: null,
      idLabel: ''
    };
    state.showAll = false;
    state.currentPage = 1;
    populateCourseDropdown();
    syncFilterInputs();
    renderAll();
  }

  function quickChip(query) {
    setSearchQuery(query);
    const inp = document.getElementById('tracker-search-input');
    if (inp) inp.focus();
  }

  function bulkMarkFiltered(action) {
    const targets = state.filteredQuestions;
    if (!targets.length) {
      showToast('No filtered questions to update.');
      return;
    }
    if (targets.length > 40 || action === 'unsolve') {
      const verb = action === 'solve' ? 'Mark ALL' : 'Mark Unsolved for ALL';
      if (!confirm(`${verb} ${targets.length} currently filtered questions?`)) return;
    }

    const nowIso = new Date().toISOString();
    targets.forEach((q) => {
      if (action === 'solve') {
        if (!state.trackerData.solved[q.id]) {
          state.trackerData.solved[q.id] = { solvedAt: nowIso, course_code: q.course_code, year: q.year };
        }
      } else {
        delete state.trackerData.solved[q.id];
      }
    });
    saveStorage();
    renderAll();
    showToast(`${action === 'solve' ? 'Marked Solved' : 'Marked Unsolved'}: ${targets.length} questions`);
  }

  function exportProgress() {
    saveStorage();
    const payload = {
      portal: 'UNPG_SEM_5',
      exportedAt: new Date().toISOString(),
      totalPYQs: state.allQuestions.length,
      tracker: state.trackerData
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unpg-sem5-pyq-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Exported Semester PYQ progress backup!');
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const tracker = parsed.tracker || parsed;
        if (!tracker || typeof tracker.solved !== 'object') {
          showToast('Invalid Semester PYQ backup JSON.');
          return;
        }
        state.trackerData = {
          solved: Object.assign({}, state.trackerData.solved, tracker.solved || {}),
          difficulty: Object.assign({}, state.trackerData.difficulty, tracker.difficulty || {}),
          lastUpdated: new Date().toISOString()
        };
        saveStorage();
        renderAll();
        showToast(`Imported backup (${Object.keys(state.trackerData.solved).length} solved total)!`);
      } catch (err) {
        showToast('Failed to parse JSON backup file.');
      }
    };
    reader.readAsText(file);
  }

  function importProgress(ev) {
    if (ev && ev.target && ev.target.files && ev.target.files[0]) {
      handleImportFile(ev.target.files[0]);
      ev.target.value = '';
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      if (e.target && e.target.files && e.target.files[0]) {
        handleImportFile(e.target.files[0]);
      }
    };
    input.click();
  }

  function resetAllProgress() {
    if (!confirm('Reset ALL solved history & custom difficulty tags for UNPG Semester V PYQs? This cannot be undone unless backed up or synced.')) return;
    state.trackerData = { solved: {}, difficulty: {}, lastUpdated: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trackerData));
    } catch (e) {}
    if (window.SEM_STATS) window.SEM_STATS.updateQuickStatsStrip();
    if (window.SEM_CLOUD_SYNC) window.SEM_CLOUD_SYNC.scheduleAutoPush();
    renderAll();
    showToast('All Semester V PYQ tracker progress cleared.');
  }

  function openQuestionModal(qId) {
    state.modalQId = qId;
    state.modalRevealed = false;
    const modal = document.getElementById('tracker-question-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderModalBody();
  }

  function closeModal() {
    const modal = document.getElementById('tracker-question-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    state.modalQId = null;
  }

  function modalNavigate(delta) {
    if (!state.modalQId || !state.filteredQuestions.length) return;
    const idx = state.filteredQuestions.findIndex((q) => q.id === state.modalQId);
    if (idx === -1) return;
    const nextIdx = (idx + delta + state.filteredQuestions.length) % state.filteredQuestions.length;
    state.modalQId = state.filteredQuestions[nextIdx].id;
    state.modalRevealed = false;
    renderModalBody();
  }

  function toggleModalAnswer() {
    state.modalRevealed = !state.modalRevealed;
    renderModalBody();
  }

  function renderModalBody() {
    const modal = document.getElementById('tracker-question-modal');
    if (!modal || !state.modalQId) return;
    const q = state.allQuestions.find((x) => x.id === state.modalQId);
    if (!q) return;

    const solvedEntry = state.trackerData.solved[q.id];
    const isSolved = Boolean(solvedEntry);
    const idx = state.filteredQuestions.findIndex((x) => x.id === q.id);
    const posLabel = idx !== -1 ? `${idx + 1} / ${state.filteredQuestions.length}` : '';

    const titleEl = modal.querySelector('.q-modal-title');
    if (titleEl) {
      const diffBadge = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.getDifficultyBadgeHtml(q.diff, { short: false }) : '';
      titleEl.innerHTML = `
        <span class="q-id-pill">${escapeHtml(q.course_code)}</span>
        <strong>${escapeHtml(q.year)} · Question ${q.qNum}</strong>
        <span style="font-size:0.82rem; color:var(--text-secondary);">${escapeHtml(q.course_title)}</span>
        ${diffBadge}
        ${isSolved ? `<span class="q-modal-solved-badge">✅ ${escapeHtml(formatSolvedShortDate(solvedEntry.solvedAt))}</span>` : ''}
      `;
    }

    const bodyEl = modal.querySelector('.q-modal-body');
    if (bodyEl) {
      const explText = (q.explanation && !q.explanation.startsWith('Verified according to standard university curriculum'))
        ? `<div style="margin-top:6px; font-size:0.88rem; color:var(--text-secondary);">${escapeHtml(q.explanation)}</div>`
        : '';
      const ansBox = state.modalRevealed
        ? `
          <div class="q-answer-display revealed" style="margin-top:14px; width:100%; max-width:760px;">
            <div><strong>Official Answer Key:</strong> Option (${escapeHtml(q.answerKey)}) &nbsp;|&nbsp; +${q.marks} Marks</div>
            ${explText}
          </div>
        `
        : '';

      bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%;">
          ${q.image
            ? `<img src="${escapeHtml(q.image)}" alt="${escapeHtml(q.id)}" class="q-modal-img" />`
            : `<div style="padding:20px; color:#1e293b; font-size:1rem;">${escapeHtml(q.question)}</div>`}
          ${ansBox}
        </div>
      `;
      if (state.modalRevealed && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([bodyEl]).catch(() => {});
      }
    }

    const footerEl = modal.querySelector('.q-modal-footer');
    if (footerEl) {
      const diffLevels = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.LEVELS : {};
      const diffOrder = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.ORDER : [];
      const diffOpts = diffOrder.map((k) => {
        const m = diffLevels[k];
        const sel = (q.diff.isUserTagged && q.diff.level === k) ? 'selected' : '';
        return `<option value="${k}" ${sel}>${m.emoji} ${m.label}</option>`;
      }).join('');

      footerEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button class="btn-toggle-solved ${isSolved ? 'active' : ''}" onclick="SEM_TRACKER.toggleSolved('${q.id}')">
            ${isSolved ? '✅ Solved' : '○ Mark Solved'}
          </button>
          <select class="q-diff-select ${q.diff.isUserTagged ? 'is-user-tagged' : ''}" onchange="SEM_TRACKER.setDifficulty('${q.id}', this.value)">
            <option value="clear" ${!q.diff.isUserTagged ? 'selected' : ''}>Suggested (${escapeHtml(q.diff.meta.label)})</option>
            ${diffOpts}
          </select>
          <button class="btn-reveal-key" onclick="SEM_TRACKER.toggleModalAnswer()">${state.modalRevealed ? '🙈 Hide Key' : '🔑 Reveal Answer Key'}</button>
          <a class="q-cbt-link" href="mock-test/test.html?test=${encodeURIComponent(q.testId)}&q=${q.qNum}&mode=practice">🖥️ Practice Paper ↗</a>
        </div>
        <div class="q-modal-nav-btns">
          ${posLabel ? `<span class="page-info-text">${posLabel}</span>` : ''}
          <button class="page-btn" onclick="SEM_TRACKER.modalNavigate(-1)">← Prev</button>
          <button class="page-btn" onclick="SEM_TRACKER.modalNavigate(1)">Next →</button>
        </div>
      `;
    }
  }

  function showToast(msg, duration) {
    let toast = document.getElementById('sem-tracker-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sem-tracker-toast';
      toast.className = 'tracker-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration || 2800);
  }

  function jumpToTracker(opts) {
    const o = opts || {};
    if (typeof window.switchMainTab === 'function') {
      window.switchMainTab('pyq-tracker');
    }
    if (o.reset) clearAllFilters();
    if (o.subject !== undefined) state.filters.subject = o.subject;
    if (o.course !== undefined) state.filters.course = o.course;
    if (o.year !== undefined) state.filters.year = o.year;
    if (o.difficulty !== undefined) state.filters.difficulty = o.difficulty;
    if (o.status !== undefined) state.filters.status = o.status;
    if (o.search !== undefined) state.filters.search = o.search;
    populateCourseDropdown();
    syncFilterInputs();
    renderAll();

    const el = document.getElementById('tab-panel-pyq-tracker');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function filterByQuestionIds(ids, label) {
    state.filters.idList = Array.isArray(ids) ? ids : [];
    state.filters.idLabel = label || 'Filtered Questions';
    state.currentPage = 1;
    syncFilterInputs();
    renderAll();
  }

  function refreshFromStorage() {
    loadStorage();
    renderAll();
  }

  function init() {
    loadStorage();
    hydrateQuestions();
    populateCourseDropdown();
    syncFilterInputs();
    renderAll();

    document.addEventListener('keydown', (e) => {
      if (!state.modalQId) return;
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft') modalNavigate(-1);
      else if (e.key === 'ArrowRight') modalNavigate(1);
    });

    window.addEventListener('sem-difficulty-updated', () => {
      loadStorage();
      renderAll();
    });
    window.addEventListener('sem-difficulty-visibility-changed', () => {
      renderAll();
    });
  }

  window.SEM_TRACKER = {
    STORAGE_KEY,
    COURSE_CATALOG,
    init,
    refreshFromStorage,
    getAllQuestions: () => state.allQuestions,
    getFilteredQuestions: () => state.filteredQuestions,
    getTrackerData: () => state.trackerData,
    setSearchQuery,
    setFilter,
    toggleSubjectCard,
    toggleCourseCard,
    toggleDifficultyFilter,
    setCourseTabSubject,
    toggleCourseCollapse,
    clearIdFilter,
    clearAllFilters,
    quickChip,
    goToPage,
    toggleShowAll,
    toggleSolved,
    setDifficulty,
    toggleCardAnswer,
    bulkMarkFiltered,
    exportProgress,
    importProgress,
    resetAllProgress,
    openQuestionModal,
    closeModal,
    modalNavigate,
    toggleModalAnswer,
    jumpToTracker,
    filterByQuestionIds,
    showToast
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
