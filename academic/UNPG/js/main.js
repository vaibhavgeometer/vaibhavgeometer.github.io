/* ============================================
   UNPG B.Sc. Semester V — Main Portal Controller
   ============================================
   - Shared Dark / Light theme persistence ('jam_theme')
   - 5-Tab Navigation + Deep Hash Routing (#mock-tests, #pyq-tracker, #custom-generator, #videos, #courses, #materials)
   - Quick Topic & Difficulty Drill Launcher -> CBT Mode
   - 15 Official CBT Mock Test Cards (Timed / Practice / Official PDF / YouTube Solution / Best Score)
   - Complete 3-Step Custom Mock Test & PDF Generator UI + Live Summary + Preview Modal
   - Dedicated Video Solutions Showcase (16 YouTube Lectures)
   ============================================ */
(function () {
  'use strict';

  const COURSE_META = {
    MAT301F: { name: 'Ring Theory & Linear Algebra', short: 'Ring Theory & LA', icon: '💍', subject: 'Mathematics', color: '#818cf8' },
    MAT302F: { name: 'Tensor Analysis', short: 'Tensor Analysis', icon: '∇', subject: 'Mathematics', color: '#a78bfa' },
    MAT303F: { name: 'Differential Geometry', short: 'Diff. Geometry', icon: '🌀', subject: 'Mathematics', color: '#c084fc' },
    PHY301F: { name: 'Classical & Statistical Mechanics', short: 'Classical & Stat Mech', icon: '⚙️', subject: 'Physics', color: '#38bdf8' },
    PHY302F: { name: 'Quantum Mechanics & Spectroscopy', short: 'Quantum & Spec', icon: '⚛️', subject: 'Physics', color: '#34d399' }
  };

  const ALL_COURSE_IDS = Object.keys(COURSE_META);
  const TAB_IDS = ['year-tests', 'pyq-tracker', 'custom-generator', 'videos', 'resources'];

  let currentYearFilter = 'ALL';
  let currentCourseFilter = 'ALL';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Theme Synchronization ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('jam_theme', theme);
    } catch (e) {}
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function initTheme() {
    let saved = 'dark';
    try {
      saved = localStorage.getItem('jam_theme') || 'dark';
    } catch (e) {}
    applyTheme(saved);
  }

  window.togglePortalTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };
  window.toggleTheme = window.togglePortalTheme;

  // --- Main Tab Navigation ---
  window.switchMainTab = function (tabName, opts) {
    let target = tabName;
    if (target === 'exam-papers' || target === 'mock-tests') target = 'year-tests';
    else if (target === 'tracker') target = 'pyq-tracker';
    else if (target === 'video-solutions') target = 'videos';
    else if (target === 'courses' || target === 'materials' || target === 'exam-papers-repo' || target === 'videos-repo') target = 'resources';

    if (!TAB_IDS.includes(target)) target = 'year-tests';

    TAB_IDS.forEach((id) => {
      const btn = document.getElementById(`tab-btn-${id}`);
      const panel = document.getElementById(`tab-panel-${id}`);
      const active = id === target;
      if (btn) btn.classList.toggle('active', active);
      if (panel) panel.classList.toggle('hidden', !active);
    });

    if (target === 'custom-generator') {
      updateOnlineStatus();
      updateCustomGeneratorSummary();
    } else if (target === 'pyq-tracker' && window.SEM_TRACKER) {
      window.SEM_TRACKER.refreshFromStorage();
    } else if (target === 'year-tests') {
      renderYearMockTests();
    } else if (target === 'videos') {
      renderVideoSolutions();
    }

    if (!opts || !opts.skipScrollSection) {
      if (tabName === 'courses' || tabName === 'materials' || tabName === 'exam-papers-repo' || tabName === 'videos-repo') {
        const sec = document.getElementById(tabName);
        if (sec) setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }
    }
  };

  // --- Best Score Reader ---
  function readSavedTestScore(testId, defaultMax) {
    try {
      const raw = localStorage.getItem(`sem_score_${testId}`);
      if (!raw) return null;
      try {
        const p = JSON.parse(raw);
        if (p && typeof p.score === 'number') {
          return { score: p.score, total: p.total || defaultMax, pct: p.percentage };
        }
      } catch (e) {
        const num = parseFloat(raw);
        if (!isNaN(num)) return { score: num, total: defaultMax, pct: (num / defaultMax) * 100 };
      }
    } catch (e) {}
    return null;
  }

  // --- Filter Handlers (Year & Course) ---
  window.setYearFilter = function (yearVal, btn) {
    currentYearFilter = yearVal || 'ALL';
    document.querySelectorAll('#mock-year-filter-tabs .year-filter-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderYearMockTests();
  };

  window.setCourseFilter = function (courseVal, btn) {
    currentCourseFilter = courseVal || 'ALL';
    document.querySelectorAll('#mock-course-filter-tabs .filter-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderYearMockTests();
  };

  window.setVideoYearFilter = function (yearVal, btn) {
    currentYearFilter = yearVal || 'ALL';
    document.querySelectorAll('#video-year-filter-tabs .year-filter-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderVideoSolutions();
  };

  window.setVideoCourseFilter = function (courseVal, btn) {
    currentCourseFilter = courseVal || 'ALL';
    document.querySelectorAll('#video-course-filter-tabs .filter-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderVideoSolutions();
  };

  // --- Render 15 Mock Test & Official Paper Cards ---
  function renderYearMockTests() {
    const container = document.getElementById('year-tests-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Loading examination papers...</div>';
      return;
    }

    const list = Object.values(window.MOCK_TESTS_DATA).filter((t) => {
      const yOk = currentYearFilter === 'ALL' || t.year === currentYearFilter;
      const cOk = currentCourseFilter === 'ALL' ||
        (currentCourseFilter === 'SUBJECT_MATH' && t.subject === 'Mathematics') ||
        (currentCourseFilter === 'SUBJECT_PHY' && t.subject === 'Physics') ||
        t.course_code === currentCourseFilter;
      return yOk && cOk;
    });

    list.sort((a, b) => {
      if (a.year !== b.year) return String(b.year).localeCompare(String(a.year));
      return String(a.course_code).localeCompare(String(b.course_code));
    });

    if (!list.length) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);">No papers match the selected filters.</div>';
      return;
    }

    container.innerHTML = list.map((t) => {
      const meta = COURSE_META[t.course_code] || { name: t.course_title, icon: '📚', color: '#818cf8' };
      const qCount = t.total_questions || (t.questions ? t.questions.length : 50);
      const marksTotal = t.total_marks || (qCount * 1.5);
      const minsTotal = t.duration_minutes || 90;
      const best = readSavedTestScore(t.id, marksTotal);
      const bestHtml = best
        ? `<span class="best-score">★ Best: ${best.score}/${best.total}</span>`
        : `<span class="era-tag tag-cbt">90m CBT Ready</span>`;

      const pdfFileName = `${t.id}_Official_Exam_Paper.pdf`;
      const pdfPath = `assets/pdfs/${pdfFileName}`;

      let videoHtml = '';
      if (t.videos && t.videos.length === 1) {
        const v = t.videos[0];
        videoHtml = `
          <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="btn-test btn-video-yt" style="width:100%; margin-top:8px;" title="${escapeHtml(v.title)}">
            ▶ Watch Video Solution (YouTube) ↗
          </a>
        `;
      } else if (t.videos && t.videos.length > 1) {
        videoHtml = `
          <div style="display:flex; gap:8px; margin-top:8px;">
            ${t.videos.map((v) => `
              <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="btn-test btn-video-yt" style="flex:1; font-size:0.78rem;" title="${escapeHtml(v.title)}">
                ▶ ${escapeHtml(v.title.split('(')[0].trim())} ↗
              </a>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="topic-card year-card" style="border-top: 3px solid ${meta.color};">
          <div class="topic-card-top">
            <span class="year-badge">${escapeHtml(t.course_code)} · ${escapeHtml(t.year)}</span>
            ${bestHtml}
          </div>

          <div class="topic-card-title">${meta.icon} ${escapeHtml(t.course_title || meta.name)}</div>
          <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45;">
            UNPG / DDUGU ${escapeHtml(t.subject)} Paper · Official screenshots, verified answer key, interactive CBT simulator, printable PDF, and YouTube walkthrough.
          </p>

          <div class="topic-meta">
            <div class="topic-meta-item">
              <span class="meta-label">Questions</span>
              <span class="meta-value">${qCount} MCQs</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Max Marks</span>
              <span class="meta-value">${marksTotal}</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Marking</span>
              <span class="meta-value">+1.5 | 0 Neg</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Time</span>
              <span class="meta-value">${minsTotal} Mins</span>
            </div>
          </div>

          <div class="topic-actions">
            <a href="mock-test/test.html?test=${encodeURIComponent(t.id)}&mode=official" class="btn-test primary">⚡ Start CBT Test</a>
            <a href="mock-test/test.html?test=${encodeURIComponent(t.id)}&mode=practice" class="btn-test secondary">📖 Practice</a>
            <a href="${pdfPath}" target="_blank" class="btn-test cheat btn-mock-pdf" title="Open Official Printable Paper PDF (with Answer Key)">📥 Official Paper PDF</a>
          </div>
          ${videoHtml}
        </div>
      `;
    }).join('');
  }

  window.refreshSemMockTestCards = renderYearMockTests;

  // --- Quick Drill Launcher from CBT Mock Tab ---
  window.quickLaunchDifficultyDrill = function (tierPreset) {
    if (!window.SEM_CUSTOM_GENERATOR) return;

    let diffs = ['very_easy', 'easy'];
    let label = 'Easy Warmup Drill';
    if (tierPreset === 'medium') {
      diffs = ['medium'];
      label = 'Standard Medium Drill';
    } else if (tierPreset === 'hard') {
      diffs = ['hard', 'hardest'];
      label = 'Advanced Challenge Drill';
    }

    const pool = window.SEM_CUSTOM_GENERATOR.collectMatchingQuestions({
      courseIds: ALL_COURSE_IDS,
      yearFilter: 'ALL',
      solvedStatus: 'ALL',
      difficulties: diffs
    });

    const sampled = window.SEM_CUSTOM_GENERATOR.sampleQuestions(pool, Math.min(25, pool.length));
    if (!sampled.length) {
      alert('No questions found for this preset.');
      return;
    }

    const customObj = {
      id: 'custom',
      name: `Semester V Quick Drill — ${label}`,
      course_code: 'MIXED',
      course_title: label,
      subject: 'Mathematics & Physics',
      year: '2023–2026',
      total_questions: sampled.length,
      total_marks: Number((sampled.length * 1.5).toFixed(1)),
      duration_minutes: Math.max(20, Math.round(sampled.length * 1.8)),
      questions: sampled
    };

    try {
      sessionStorage.setItem('semester_custom_test', JSON.stringify(customObj));
      window.location.href = 'mock-test/test.html?test=custom&mode=practice';
    } catch (e) {
      alert('Could not launch drill due to browser sessionStorage restrictions.');
    }
  };

  // --- Dedicated Video Solutions Showcase ---
  function renderVideoSolutions() {
    const container = document.getElementById('video-solutions-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Loading video lectures...</div>';
      return;
    }

    const videoList = [];
    Object.values(window.MOCK_TESTS_DATA).forEach((t) => {
      const yOk = currentYearFilter === 'ALL' || t.year === currentYearFilter;
      const cOk = currentCourseFilter === 'ALL' ||
        (currentCourseFilter === 'SUBJECT_MATH' && t.subject === 'Mathematics') ||
        (currentCourseFilter === 'SUBJECT_PHY' && t.subject === 'Physics') ||
        t.course_code === currentCourseFilter;
      if (!yOk || !cOk) return;
      (t.videos || []).forEach((v) => videoList.push({ test: t, video: v }));
    });

    videoList.sort((a, b) => {
      if (a.test.course_code !== b.test.course_code) return a.test.course_code.localeCompare(b.test.course_code);
      if (a.test.year !== b.test.year) return b.test.year.localeCompare(a.test.year);
      return a.video.title.localeCompare(b.video.title);
    });

    if (!videoList.length) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);">No video solutions match these filters.</div>';
      return;
    }

    container.innerHTML = videoList.map(({ test: t, video: v }) => {
      const meta = COURSE_META[t.course_code] || { name: t.course_title, icon: '📚', color: '#38bdf8' };
      const thumbUrl = `https://img.youtube.com/vi/${v.yt_id}/mqdefault.jpg`;
      const pdfPath = `assets/pdfs/${t.id}_Official_Exam_Paper.pdf`;
      return `
        <div class="video-card topic-card" style="border-top: 3px solid ${meta.color}; padding: 16px;">
          <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="video-thumb-link" title="Watch ${escapeHtml(t.course_code)} ${escapeHtml(t.year)} on YouTube">
            <div class="video-thumb-wrap">
              <img src="${thumbUrl}" alt="${escapeHtml(t.course_code)} ${escapeHtml(t.year)}" class="video-thumb-img" loading="lazy" />
              <div class="video-play-overlay">▶</div>
              <span class="video-duration-tag">${escapeHtml(v.title)}</span>
            </div>
          </a>
          <div class="topic-card-top" style="margin-top:4px;">
            <span class="year-badge">${meta.icon} ${escapeHtml(t.course_code)}</span>
            <span class="era-tag tag-classic">${escapeHtml(t.year)}</span>
          </div>
          <div class="topic-card-title" style="font-size:1rem;">${escapeHtml(t.course_title || meta.name)}</div>
          <p style="font-size:0.8rem; color:var(--text-secondary);">Complete step-by-step video solution for ${escapeHtml(t.course_code)} (${escapeHtml(t.year)}).</p>
          <div class="topic-actions" style="margin-top:auto;">
            <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="btn-test btn-video-yt" style="flex:1.4;">▶ Watch on YouTube ↗</a>
            <a href="mock-test/test.html?test=${encodeURIComponent(t.id)}&mode=official" class="btn-test primary" style="flex:1;">⚡ CBT Mock</a>
            <a href="${pdfPath}" target="_blank" class="btn-test cheat btn-mock-pdf" style="flex:1;">📥 PDF</a>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Custom Test & PDF Generator Controller ---
  window.syncQuestionCount = function (val) {
    let n = parseInt(val, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 100) n = 100;

    const inp = document.getElementById('custom-q-input');
    const slider = document.getElementById('custom-q-slider');
    if (inp && Number(inp.value) !== n) inp.value = n;
    if (slider && Number(slider.value) !== n) slider.value = n;

    document.querySelectorAll('.count-preset-chips .chip-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.getAttribute('data-q')) === n);
    });

    updateCustomGeneratorSummary();
  };

  window.customGeneratorSelectAll = function (mode) {
    const checkboxes = document.querySelectorAll('input[name="custom_course"]');
    checkboxes.forEach((cb) => {
      if (mode === 'all') cb.checked = true;
      else if (mode === 'none') cb.checked = false;
      else if (mode === 'math') cb.checked = cb.value.startsWith('MAT');
      else if (mode === 'physics') cb.checked = cb.value.startsWith('PHY');
    });
    updateCustomGeneratorSummary();
  };

  window.applyCustomDifficultyPreset = function (preset, btn) {
    const cbs = document.querySelectorAll('input[name="custom_diff"]');
    let activeSet = ['very_easy', 'easy', 'medium', 'hard', 'hardest'];
    if (preset === 'easy') activeSet = ['very_easy', 'easy'];
    else if (preset === 'standard') activeSet = ['easy', 'medium', 'hard'];
    else if (preset === 'hard') activeSet = ['hard', 'hardest'];

    cbs.forEach((cb) => {
      cb.checked = activeSet.includes(cb.value);
    });
    document.querySelectorAll('.custom-diff-presets .preset-chip-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateCustomGeneratorSummary();
  };

  window.handleCustomGeneratorChange = function () {
    updateCustomGeneratorSummary();
  };

  function getCustomGeneratorConfig() {
    const courseIds = Array.from(document.querySelectorAll('input[name="custom_course"]:checked')).map((el) => el.value);
    const qInp = document.getElementById('custom-q-input');
    const titleInp = document.getElementById('custom-test-title');
    const yearRadio = document.querySelector('input[name="custom_year"]:checked');
    const solvedRadio = document.querySelector('input[name="custom_solved"]:checked');
    const diffCbs = Array.from(document.querySelectorAll('input[name="custom_diff"]:checked')).map((el) => el.value);

    return {
      courseIds,
      questionCount: Math.max(1, Math.min(100, parseInt((qInp && qInp.value) || '50', 10) || 50)),
      customTitle: titleInp ? titleInp.value.trim() : '',
      yearFilter: yearRadio ? yearRadio.value : 'ALL',
      solvedStatus: solvedRadio ? solvedRadio.value : 'ALL',
      difficulties: diffCbs
    };
  }

  function updateCustomGeneratorSummary() {
    if (!window.SEM_CUSTOM_GENERATOR) return;
    const cfg = getCustomGeneratorConfig();

    // Update individual course counts under current year/status/diff filters
    ALL_COURSE_IDS.forEach((cId) => {
      const cntEl = document.getElementById(`count-${cId}`);
      if (!cntEl) return;
      const matchedForCourse = window.SEM_CUSTOM_GENERATOR.collectMatchingQuestions(
        Object.assign({}, cfg, { courseIds: [cId] })
      );
      cntEl.textContent = `${matchedForCourse.length} Qs`;
    });

    const pool = window.SEM_CUSTOM_GENERATOR.collectMatchingQuestions(cfg);
    const actualQ = Math.min(cfg.questionCount, pool.length);
    const marksTotal = (actualQ * 1.5).toFixed(1);
    const durationMins = actualQ > 0 ? Math.max(15, Math.round(actualQ * 1.8)) : 0;

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT('summary-topics-count', `${cfg.courseIds.length} / ${ALL_COURSE_IDS.length}`);
    setT('summary-pool-count', `${pool.length} Qs`);
    setT('summary-questions-count', `${actualQ}${pool.length < cfg.questionCount && pool.length > 0 ? ' (Capped)' : ''}`);
    setT('summary-marks-count', `${marksTotal}`);
    setT('summary-time-count', `${durationMins} Mins`);
    setT('summary-structure-label', 'MCQ (+1.5 / 0 Neg)');

    const solvedMap = { ALL: 'All Questions', unsolved: 'Unsolved Only', solved: 'Solved Only' };
    setT('summary-solved-label', solvedMap[cfg.solvedStatus] || 'All');

    const diffLabel = cfg.difficulties.length === 5
      ? 'All 5 Tiers'
      : (cfg.difficulties.length === 0 ? 'None' : `${cfg.difficulties.length} Selected`);
    setT('summary-diff-label', diffLabel);

    const btnPdf = document.getElementById('btn-generate-custom-pdf');
    const btnCbt = document.getElementById('btn-start-custom-cbt');
    const btnPrev = document.getElementById('btn-preview-custom-qs');
    const disabled = pool.length === 0;
    if (btnPdf) btnPdf.disabled = disabled;
    if (btnCbt) btnCbt.disabled = disabled;
    if (btnPrev) btnPrev.disabled = disabled;
  }

  window.updateCustomGeneratorSummary = updateCustomGeneratorSummary;

  function updateOnlineStatus() {
    const banner = document.getElementById('custom-offline-banner');
    if (banner) {
      banner.classList.toggle('hidden', navigator.onLine !== false);
    }
  }

  window.triggerCustomPdfGeneration = async function () {
    if (!window.SEM_CUSTOM_GENERATOR) return;
    const cfg = getCustomGeneratorConfig();
    const modal = document.getElementById('pdf-progress-modal');
    const titleEl = document.getElementById('pdf-progress-title');
    const fillEl = document.getElementById('pdf-progress-fill');
    const pctEl = document.getElementById('pdf-progress-pct');
    const statusEl = document.getElementById('pdf-progress-status');

    if (modal) modal.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Generating Custom Mock Test PDF...';

    try {
      const result = await window.SEM_CUSTOM_GENERATOR.generateCustomPdf(cfg, (pct, msg) => {
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (statusEl) statusEl.textContent = msg;
      });
      setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        if (window.SEM_TRACKER) window.SEM_TRACKER.showToast(`Downloaded ${result.fileName} (${result.totalQuestions} MCQs)`);
      }, 450);
    } catch (err) {
      if (modal) modal.classList.add('hidden');
      alert(err && err.message ? err.message : 'PDF generation failed.');
    }
  };

  window.triggerCustomOnlineTest = function () {
    if (!window.SEM_CUSTOM_GENERATOR) return;
    const cfg = getCustomGeneratorConfig();
    const pool = window.SEM_CUSTOM_GENERATOR.collectMatchingQuestions(cfg);
    if (!pool.length) {
      alert('No questions match your current filters.');
      return;
    }

    const sampled = window.SEM_CUSTOM_GENERATOR.sampleQuestions(pool, cfg.questionCount);
    const totalMarks = sampled.reduce((s, q) => s + Number(q.marks || 1.5), 0);
    const durationMins = Math.max(15, Math.round(sampled.length * 1.8));
    const titleText = cfg.customTitle || `UNPG Semester V Custom CBT (${sampled.length} Qs)`;

    const customObj = {
      id: 'custom',
      name: titleText,
      course_code: cfg.courseIds.length === 1 ? cfg.courseIds[0] : 'CUSTOM',
      course_title: `${cfg.courseIds.length} Courses Mixed`,
      subject: 'Mathematics & Physics',
      year: cfg.yearFilter === 'ALL' ? '2023–2026' : cfg.yearFilter,
      total_questions: sampled.length,
      total_marks: Number(totalMarks.toFixed(1)),
      duration_minutes: durationMins,
      questions: sampled
    };

    try {
      sessionStorage.setItem('semester_custom_test', JSON.stringify(customObj));
      window.location.href = 'mock-test/test.html?test=custom&mode=official';
    } catch (e) {
      alert('Could not start custom CBT session (sessionStorage unavailable).');
    }
  };

  window.openCustomQuestionsPreview = function () {
    if (!window.SEM_CUSTOM_GENERATOR) return;
    const cfg = getCustomGeneratorConfig();
    const pool = window.SEM_CUSTOM_GENERATOR.collectMatchingQuestions(cfg);
    const sampled = window.SEM_CUSTOM_GENERATOR.sampleQuestions(pool, cfg.questionCount);

    const modal = document.getElementById('custom-preview-modal');
    const cntEl = document.getElementById('preview-total-count');
    const bodyEl = document.getElementById('custom-preview-body');
    if (!modal || !bodyEl) return;

    if (cntEl) cntEl.textContent = `${sampled.length} of ${pool.length} matching Qs`;

    if (!sampled.length) {
      bodyEl.innerHTML = '<div style="text-align:center; padding:32px; color:var(--text-secondary);">No questions match your current selection.</div>';
    } else {
      bodyEl.innerHTML = sampled.map((q, idx) => {
        const solvedPill = q.isSolved
          ? '<span class="preview-status-pill solved">✓ Solved</span>'
          : '<span class="preview-status-pill unsolved">Unsolved</span>';
        const diffBadge = window.SEM_DIFFICULTY
          ? window.SEM_DIFFICULTY.getDifficultyBadgeHtml(q.diffInfo, { short: true })
          : '';
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; background:var(--bg-body); flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="color:var(--accent);">#${idx + 1}</strong>
              <span style="font-weight:700; font-size:0.86rem;">${escapeHtml(q.course_code)} · ${escapeHtml(q.year)} Q${q.q_num}</span>
              <span style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(q.course_title)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${diffBadge}
              ${solvedPill}
            </div>
          </div>
        `;
      }).join('');
    }

    modal.classList.remove('hidden');
  };

  window.closeCustomQuestionsPreview = function () {
    const modal = document.getElementById('custom-preview-modal');
    if (modal) modal.classList.add('hidden');
  };

  // --- Top-Level Portal Mode Switcher (Exams vs Results) ---
  window.switchPortalMode = function (mode, opts) {
    const targetMode = mode === 'results' ? 'results' : 'exams';
    const examsSec = document.getElementById('unpg-exams-section');
    const resultsSec = document.getElementById('unpg-results-section');
    const examsBtn = document.getElementById('portal-mode-exams-btn');
    const resultsBtn = document.getElementById('portal-mode-results-btn');

    if (examsSec) examsSec.classList.toggle('hidden', targetMode !== 'exams');
    if (resultsSec) resultsSec.classList.toggle('hidden', targetMode !== 'results');
    if (examsBtn) examsBtn.classList.toggle('active', targetMode === 'exams');
    if (resultsBtn) resultsBtn.classList.toggle('active', targetMode === 'results');

    if (!opts || !opts.skipHash) {
      window.location.hash = targetMode;
    }

    if (!opts || !opts.skipScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- Hash Navigation ---
  function handleHash() {
    const raw = (window.location.hash || '').replace('#', '').trim().toLowerCase();
    if (!raw) return;

    if (['results', 'search', 'toppers', 'semesters', 'subjects', 'downloads'].includes(raw) ||
        raw.startsWith('student=') || raw.startsWith('subject=')) {
      window.switchPortalMode('results', { skipHash: true, skipScroll: true });
      return;
    }

    if (raw === 'exams') {
      window.switchPortalMode('exams', { skipHash: true, skipScroll: true });
      return;
    }

    if (['pyq-tracker', 'tracker'].includes(raw)) {
      window.switchPortalMode('exams', { skipHash: true, skipScroll: true });
      window.switchMainTab('pyq-tracker');
    } else if (['custom-generator', 'custom', 'custom-pdf'].includes(raw)) {
      window.switchPortalMode('exams', { skipHash: true, skipScroll: true });
      window.switchMainTab('custom-generator');
    } else if (['videos', 'video-solutions'].includes(raw)) {
      window.switchPortalMode('exams', { skipHash: true, skipScroll: true });
      window.switchMainTab('videos');
    } else if (['courses', 'materials', 'resources', 'exam-papers-repo', 'videos-repo'].includes(raw)) {
      window.switchPortalMode('exams', { skipHash: true, skipScroll: true });
      window.switchMainTab(raw);
    } else if (['year-tests', 'mock-tests', 'exam-papers'].includes(raw)) {
      window.switchPortalMode('exams', { skipHash: true, skipScroll: true });
      window.switchMainTab('year-tests');
    }
  }

  function init() {
    initTheme();
    renderYearMockTests();
    renderVideoSolutions();
    updateCustomGeneratorSummary();
    updateOnlineStatus();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('sem-difficulty-updated', updateCustomGeneratorSummary);

    handleHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
