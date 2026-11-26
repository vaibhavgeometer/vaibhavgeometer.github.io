/* ============================================
   UNPG B.Sc. Semester V — CBT Evaluation & Analytics Engine
   ============================================
   - Calculates exact Semester V marks (+1.5 MCQ, 0 Negative)
   - Saves Best Score in localStorage ('sem_score_<testId>') + triggers Cloud Sync
   - Renders Difficulty Tier Breakdown & Solution Review Filters
   - Preserves official YouTube Video Solutions links & explanations
   ============================================ */
(function () {
  'use strict';

  let lastResultContext = null;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveImgPath(imgPath) {
    if (!imgPath) return '';
    if (/^(https?:|data:|\/|\.\.)/.test(imgPath)) return imgPath;
    return `../${imgPath}`;
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${String(r).padStart(2, '0')}s`;
  }

  function saveBestScore(testId, score, totalMarks, pct) {
    if (!testId || testId === 'custom') return false;
    const key = `sem_score_${testId}`;
    let isNewBest = true;
    try {
      const prevRaw = localStorage.getItem(key);
      if (prevRaw) {
        let prevPct = 0;
        try {
          const parsed = JSON.parse(prevRaw);
          prevPct = Number(parsed.percentage !== undefined ? parsed.percentage : (parsed.score / totalMarks) * 100);
        } catch (e) {
          prevPct = (Number(prevRaw) / totalMarks) * 100;
        }
        if (pct < prevPct) isNewBest = false;
      }
      if (isNewBest) {
        localStorage.setItem(key, JSON.stringify({
          score: Number(score.toFixed(2)),
          total: Number(totalMarks.toFixed(2)),
          percentage: Number(pct.toFixed(1)),
          date: new Date().toISOString()
        }));
      }
    } catch (e) {}

    if (window.SEM_CLOUD_SYNC && typeof window.SEM_CLOUD_SYNC.scheduleAutoPush === 'function') {
      window.SEM_CLOUD_SYNC.scheduleAutoPush();
    }
    return isNewBest;
  }

  window.renderTestResults = function (state, isAutoSubmit) {
    const questions = state.questions || [];
    const totalQ = questions.length;
    const diffLevels = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.LEVELS : {};
    const diffOrder = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.ORDER : ['very_easy', 'easy', 'medium', 'hard', 'hardest'];

    const diffStats = {};
    diffOrder.forEach((k) => {
      diffStats[k] = { total: 0, correct: 0, incorrect: 0, unattempted: 0, earned: 0, max: 0 };
    });

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let totalMarksEarned = 0;
    let totalPossibleMarks = 0;

    const evaluatedItems = questions.map((q, idx) => {
      const m = Number(q.marks !== undefined ? q.marks : 1.5);
      const neg = Number(q.negative_marks !== undefined ? q.negative_marks : 0);
      totalPossibleMarks += m;

      const userAns = state.responses[idx] || null;
      const officialKey = String(q.answer_key || 'A').trim().toUpperCase();
      let outcome = 'unattempted';
      let delta = 0;

      if (!userAns) {
        outcome = 'unattempted';
        unattemptedCount++;
      } else if (userAns === officialKey) {
        outcome = 'correct';
        delta = m;
        totalMarksEarned += m;
        correctCount++;
      } else {
        outcome = 'incorrect';
        delta = -neg;
        totalMarksEarned -= neg;
        incorrectCount++;
      }

      const diffInfo = window.SEM_DIFFICULTY
        ? window.SEM_DIFFICULTY.getQuestionDifficulty(q, state.testObj)
        : { level: 'medium', meta: { label: 'Medium', shortLabel: 'Medium', emoji: '🟡', color: '#f59e0b', cssClass: 'diff-medium' }, isUserTagged: false };

      const lvl = diffInfo.level || 'medium';
      if (diffStats[lvl]) {
        diffStats[lvl].total++;
        diffStats[lvl].max += m;
        if (outcome === 'correct') {
          diffStats[lvl].correct++;
          diffStats[lvl].earned += m;
        } else if (outcome === 'incorrect') {
          diffStats[lvl].incorrect++;
          diffStats[lvl].earned -= neg;
        } else {
          diffStats[lvl].unattempted++;
        }
      }

      return {
        idx,
        q,
        userAns,
        officialKey,
        outcome,
        delta,
        marks: m,
        diffInfo
      };
    });

    const attemptedCount = correctCount + incorrectCount;
    const accuracy = attemptedCount > 0 ? ((correctCount / attemptedCount) * 100) : 0;
    const pct = totalPossibleMarks > 0 ? ((Math.max(0, totalMarksEarned) / totalPossibleMarks) * 100) : 0;
    const savedNewBest = !state.isCustom
      ? saveBestScore(state.testId, totalMarksEarned, totalPossibleMarks, pct)
      : false;

    lastResultContext = { state, evaluatedItems };

    const appEl = document.querySelector('.exam-app');
    const mainEl = appEl || document.querySelector('.exam-workspace') || document.body;
    if (appEl) {
      appEl.classList.add('results-mode');
    }

    // YouTube Videos Card (if official paper has videos)
    const videos = Array.isArray(state.testObj.videos) ? state.testObj.videos : [];
    const videosHtml = videos.length
      ? `
        <div class="results-diff-section" style="border-color:rgba(239,68,68,0.35);">
          <div class="results-diff-header">
            <span class="results-diff-title">🎥 Video Solution Lectures for This Paper</span>
            <span style="font-size:0.82rem; color:var(--text-secondary);">Step-by-step walkthroughs by Vaibhav</span>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${videos.map((v) => `
              <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener" class="btn-action btn-save-next" style="text-decoration:none; background:#dc2626; border-color:#dc2626;">
                ▶ ${escapeHtml(v.title || 'Watch Solution on YouTube')} ↗
              </a>
            `).join('')}
          </div>
        </div>
      `
      : '';

    // Difficulty Tier Breakdown
    const diffCardsHtml = diffOrder.map((lvl) => {
      const ds = diffStats[lvl];
      if (!ds || ds.total === 0) return '';
      const meta = diffLevels[lvl] || { emoji: '•', label: lvl, color: '#6366f1' };
      const acc = ds.total > 0 ? Math.round((ds.correct / ds.total) * 100) : 0;
      return `
        <div class="diff-stat-card">
          <div class="diff-stat-top">
            <span class="diff-stat-name">${meta.emoji} ${meta.label}</span>
            <span class="diff-stat-score">${ds.correct}/${ds.total}</span>
          </div>
          <div class="diff-stat-meta">
            <span>Marks: ${ds.earned.toFixed(1)} / ${ds.max.toFixed(1)}</span>
            <span>${acc}%</span>
          </div>
          <div class="diff-stat-bar">
            <div class="diff-stat-fill" style="width:${acc}%; background:${meta.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    const diffSectionHtml = diffCardsHtml
      ? `
        <div class="results-diff-section">
          <div class="results-diff-header">
            <span class="results-diff-title">📊 Difficulty Tier Performance</span>
            <span style="font-size:0.82rem; color:var(--text-secondary);">Calibrated to UNPG Semester V 5-tier model</span>
          </div>
          <div class="results-diff-grid">${diffCardsHtml}</div>
        </div>
      `
      : '';

    const reviewCardsHtml = buildReviewCardsHtml(evaluatedItems, 'ALL');

    const resultsHtml = `
      <div class="results-container" id="results-root">
        <div class="scorecard-hero">
          <div class="scorecard-title">${escapeHtml(state.testObj.name || state.testId)}</div>
          <div class="scorecard-subtitle">
            ${isAutoSubmit ? '⏰ Time Expired — Auto-Submitted · ' : ''}
            ${state.mode === 'practice' ? 'Practice Mode' : 'Official CBT Mode'} · Time Taken: ${formatDuration(state.elapsedSeconds)}
            ${savedNewBest && !state.isCustom ? ' · ★ Personal Best Saved!' : ''}
          </div>
          <div class="score-circle">
            <span class="score-val">${totalMarksEarned.toFixed(1)}</span>
            <span class="score-max">/ ${totalPossibleMarks.toFixed(1)}</span>
          </div>
          <div style="font-size:1.05rem; font-weight:700; opacity:0.95;">
            Overall Percentage: ${pct.toFixed(1)}% &nbsp;|&nbsp; Accuracy: ${accuracy.toFixed(1)}%
          </div>
        </div>

        <div class="results-actions-bar">
          <a href="../index.html" class="btn-action btn-secondary" style="text-decoration:none;">← Return to Portal</a>
          <button type="button" class="btn-action btn-save-next" onclick="window.reattemptCurrentTest()">🔄 Reattempt Paper</button>
          ${correctCount > 0 ? `<button type="button" id="btn-sync-correct-tracker" class="btn-action btn-secondary" style="border-color:var(--brand-primary); color:var(--brand-primary);" onclick="window.markCorrectInPyqTracker()">✅ Mark ${correctCount} Correct Solved in Tracker</button>` : ''}
        </div>

        <div class="results-stats-grid">
          <div class="stat-card">
            <div class="stat-card-val val-total">${totalQ}</div>
            <div class="stat-card-lbl">Total Questions</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-correct">${correctCount}</div>
            <div class="stat-card-lbl">Correct (+1.5 each)</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-incorrect">${incorrectCount}</div>
            <div class="stat-card-lbl">Incorrect (0 Neg)</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-unattempted">${unattemptedCount}</div>
            <div class="stat-card-lbl">Unattempted</div>
          </div>
        </div>

        ${videosHtml}
        ${diffSectionHtml}

        <div class="solution-review-section">
          <div class="solution-header-row">
            <div class="solution-title">📝 Detailed Question &amp; Answer Key Review</div>
            <div class="solution-filter-tabs">
              <button type="button" class="sol-filter-btn active" onclick="window.filterSolutions('ALL', this)">All (${totalQ})</button>
              <button type="button" class="sol-filter-btn" onclick="window.filterSolutions('correct', this)">Correct (${correctCount})</button>
              <button type="button" class="sol-filter-btn" onclick="window.filterSolutions('incorrect', this)">Incorrect (${incorrectCount})</button>
              <button type="button" class="sol-filter-btn" onclick="window.filterSolutions('unattempted', this)">Skipped (${unattemptedCount})</button>
              <button type="button" class="sol-filter-btn" onclick="window.filterSolutions('diff_easy', this)">🟢🔵 Easy Tiers</button>
              <button type="button" class="sol-filter-btn" onclick="window.filterSolutions('diff_medium', this)">🟡 Medium</button>
              <button type="button" class="sol-filter-btn" onclick="window.filterSolutions('diff_hard', this)">🔴🟣 Hard Tiers</button>
            </div>
          </div>
          <div class="solution-cards-list" id="solution-cards-list">
            ${reviewCardsHtml}
          </div>
        </div>
      </div>
    `;

    if (appEl) {
      appEl.innerHTML = resultsHtml;
    } else if (mainEl !== document.body) {
      mainEl.outerHTML = resultsHtml;
    } else {
      document.body.innerHTML = resultsHtml;
    }

    // Hide CBT workspace/footer/drawer controls if rendered outside .exam-app replacement
    const bottomFooter = document.querySelector('.exam-footer');
    if (bottomFooter) bottomFooter.style.display = 'none';
    const drawerToggle = document.querySelector('.palette-drawer-toggle');
    if (drawerToggle) drawerToggle.style.display = 'none';

    if (window.MathJax && window.MathJax.typesetPromise) {
      const root = document.getElementById('results-root');
      if (root) window.MathJax.typesetPromise([root]).catch(() => {});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function buildReviewCardsHtml(items, filterKey) {
    const filtered = items.filter((it) => {
      if (filterKey === 'correct') return it.outcome === 'correct';
      if (filterKey === 'incorrect') return it.outcome === 'incorrect';
      if (filterKey === 'unattempted') return it.outcome === 'unattempted';
      if (filterKey === 'diff_easy') return it.diffInfo.level === 'very_easy' || it.diffInfo.level === 'easy';
      if (filterKey === 'diff_medium') return it.diffInfo.level === 'medium';
      if (filterKey === 'diff_hard') return it.diffInfo.level === 'hard' || it.diffInfo.level === 'hardest';
      return true;
    });

    if (!filtered.length) {
      return '<div class="stat-card" style="padding:30px;">No questions match this filter category.</div>';
    }

    return filtered.map((it) => {
      const q = it.q;
      const origNum = q.q_num || it.idx + 1;
      const imgSrc = resolveImgPath(q.image);
      const pillCls = it.outcome === 'correct' ? 'pill-correct' : (it.outcome === 'incorrect' ? 'pill-incorrect' : 'pill-unattempted');
      const pillTxt = it.outcome === 'correct'
        ? `✅ Correct (+${it.delta})`
        : (it.outcome === 'incorrect' ? '❌ Incorrect (0)' : '⚪ Unattempted (0)');

      const diffBadge = window.SEM_DIFFICULTY
        ? window.SEM_DIFFICULTY.getDifficultyBadgeHtml(it.diffInfo, { short: true })
        : '';

      const explClean = (q.explanation && !String(q.explanation).startsWith('Verified according to standard university curriculum'))
        ? `
          <div class="solution-box" style="margin:0 20px 16px;">
            <div class="solution-title" style="font-size:0.9rem; margin-bottom:4px;">💡 Explanation</div>
            <div style="font-size:0.9rem; line-height:1.5;">${escapeHtml(q.explanation)}</div>
          </div>
        `
        : '';

      return `
        <div class="review-q-card">
          <div class="review-q-header">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <span class="review-q-num">Q${it.idx + 1}</span>
              <span style="font-size:0.82rem; color:var(--text-secondary);">${escapeHtml(q.course_code || '')} · ${escapeHtml(q.year || '')} (Paper Q${origNum})</span>
              ${diffBadge}
            </div>
            <span class="review-status-pill ${pillCls}">${pillTxt}</span>
          </div>

          <div class="review-q-body">
            ${imgSrc
              ? `<div class="review-screenshot-box"><img src="${escapeHtml(imgSrc)}" alt="Q${origNum}" class="review-screenshot-img" loading="lazy" /></div>`
              : `<div style="font-size:0.95rem; color:var(--text-primary);">${escapeHtml(q.question)}</div>`}
          </div>

          <div class="review-answers-box">
            <div class="review-answer-item">
              <span class="ans-label">Your Answer</span>
              <span class="ans-val user-val">${it.userAns ? `Option (${it.userAns})` : '— Not Attempted —'}</span>
            </div>
            <div class="review-answer-item">
              <span class="ans-label">Official Answer Key</span>
              <span class="ans-val key-val">Option (${escapeHtml(it.officialKey)})</span>
            </div>
            <div class="review-answer-item">
              <span class="ans-label">Marks Awarded</span>
              <span class="ans-val ${it.delta > 0 ? 'pos' : (it.delta < 0 ? 'neg' : 'zero')}">${it.delta > 0 ? '+' + it.delta : it.delta} / ${it.marks}</span>
            </div>
          </div>
          ${explClean}
        </div>
      `;
    }).join('');
  }

  window.filterSolutions = function (filterKey, btnEl) {
    if (!lastResultContext) return;
    document.querySelectorAll('.sol-filter-btn').forEach((b) => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    const listEl = document.getElementById('solution-cards-list');
    if (listEl) {
      listEl.innerHTML = buildReviewCardsHtml(lastResultContext.evaluatedItems, filterKey);
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([listEl]).catch(() => {});
      }
    }
  };

  window.markCorrectInPyqTracker = function () {
    if (!lastResultContext) return;
    const correctItems = lastResultContext.evaluatedItems.filter((it) => it.outcome === 'correct');
    if (!correctItems.length) return;
    try {
      const key = 'sem_pyq_user_tracker_v1';
      let store = { solved: {}, difficulty: {}, lastUpdated: new Date().toISOString() };
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          store.solved = p.solved || {};
          store.difficulty = p.difficulty || {};
        }
      }
      const nowIso = new Date().toISOString();
      correctItems.forEach((it) => {
        store.solved[it.q.id] = {
          solvedAt: nowIso,
          course_code: it.q.course_code || '',
          year: it.q.year || ''
        };
      });
      store.lastUpdated = nowIso;
      localStorage.setItem(key, JSON.stringify(store));
      if (window.SEM_CLOUD_SYNC && typeof window.SEM_CLOUD_SYNC.scheduleAutoPush === 'function') {
        window.SEM_CLOUD_SYNC.scheduleAutoPush();
      }
      const btn = document.getElementById('btn-sync-correct-tracker');
      if (btn) {
        btn.textContent = `✅ Synced ${correctItems.length} Qs to Tracker`;
        btn.disabled = true;
      }
      let toast = document.querySelector('.diff-toast-notification');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'diff-toast-notification';
        document.body.appendChild(toast);
      }
      toast.textContent = `Synced ${correctItems.length} correct question(s) to PYQ Tracker!`;
      toast.classList.add('show');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
    } catch (e) {}
  };

  window.reattemptCurrentTest = function () {
    window.location.reload();
  };
})();
