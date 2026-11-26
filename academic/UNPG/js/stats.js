/* ============================================
   UNPG B.Sc. Semester V — Interactive Study Statistics Engine
   ============================================
   - Tracks Today's Solved, Active Streak, Weekly & Monthly Pace, Target Simulator
   - Subject Mastery (Mathematics 450 Qs, Physics 300 Qs) + 5 Course Breakdowns
   - Uses exact tracker.css modal & analytics component styling
   ============================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'sem_pyq_user_tracker_v1';
  const TOTAL_PYQS = 750;

  const COURSE_CATALOG = [
    { code: 'MAT301F', title: 'Ring Theory & Linear Algebra', subject: 'Mathematics', total: 150 },
    { code: 'MAT302F', title: 'Tensor Analysis', subject: 'Mathematics', total: 150 },
    { code: 'MAT303F', title: 'Differential Geometry', subject: 'Mathematics', total: 150 },
    { code: 'PHY301F', title: 'Classical & Statistical Mechanics', subject: 'Physics', total: 150 },
    { code: 'PHY302F', title: 'Quantum Mechanics & Spectroscopy', subject: 'Physics', total: 150 }
  ];

  let activeTab = 'daily';
  let dailyTargetPace = 25;

  function toLocalDateKey(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function addDays(dateKey, delta) {
    const parts = String(dateKey).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + delta);
    return toLocalDateKey(d);
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return '';
    const todayKey = toLocalDateKey(new Date());
    const yestKey = addDays(todayKey, -1);
    if (dateKey === todayKey) return 'Today';
    if (dateKey === yestKey) return 'Yesterday';
    const parts = dateKey.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function loadSolvedMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.solved && typeof parsed.solved === 'object') {
          return parsed.solved;
        }
      }
    } catch (e) {}
    return {};
  }

  function getQuestionPool() {
    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.getAllQuestions === 'function') {
      const list = window.SEM_TRACKER.getAllQuestions();
      if (list && list.length) return list;
    }
    const out = [];
    if (window.MOCK_TESTS_DATA) {
      Object.values(window.MOCK_TESTS_DATA).forEach((t) => {
        (t.questions || []).forEach((q) => {
          out.push(Object.assign({}, q, {
            course_code: q.course_code || t.course_code,
            course_title: q.course_title || t.course_title,
            subject: q.subject || t.subject,
            year: q.year || t.year
          }));
        });
      });
    }
    return out;
  }

  function calculateAnalytics() {
    const solvedMap = loadSolvedMap();
    const allQuestions = getQuestionPool();
    const totalAvailable = allQuestions.length || TOTAL_PYQS;

    const todayKey = toLocalDateKey(new Date());
    const yestKey = addDays(todayKey, -1);
    const last7Start = addDays(todayKey, -6);
    const last30Start = addDays(todayKey, -29);

    const dailyMap = {};
    const qLookup = {};
    allQuestions.forEach((q) => { qLookup[q.id] = q; });

    let totalSolved = 0;
    let todayCount = 0;
    let yesterdayCount = 0;
    let last7DaysCount = 0;
    let last30DaysCount = 0;

    const subjectSolved = { Mathematics: 0, Physics: 0 };
    const courseSolved = {};
    COURSE_CATALOG.forEach((c) => { courseSolved[c.code] = 0; });

    Object.entries(solvedMap).forEach(([qId, entry]) => {
      if (!entry || (typeof entry === 'object' && entry.solved === false)) return;
      if (allQuestions.length > 0 ? !qLookup[qId] : !/^(MAT|PHY)\d{3}F_20\d{2}-\d{2}_Q\d+$/.test(qId)) return;
      totalSolved++;
      const qObj = qLookup[qId];
      const courseCode = (qObj && qObj.course_code) || (entry && entry.course_code) || (qId.split('_')[0] || '');
      const subject = (qObj && qObj.subject) || (courseCode.startsWith('PHY') ? 'Physics' : 'Mathematics');

      if (subjectSolved[subject] !== undefined) subjectSolved[subject]++;
      if (courseSolved[courseCode] !== undefined) courseSolved[courseCode]++;

      const ts = (typeof entry === 'string') ? entry : (entry.solvedAt || new Date().toISOString());
      const dKey = toLocalDateKey(ts);
      if (dKey) {
        if (!dailyMap[dKey]) dailyMap[dKey] = [];
        dailyMap[dKey].push(qId);
        if (dKey === todayKey) todayCount++;
        if (dKey === yestKey) yesterdayCount++;
        if (dKey >= last7Start && dKey <= todayKey) last7DaysCount++;
        if (dKey >= last30Start && dKey <= todayKey) last30DaysCount++;
      }
    });

    const activeDateKeys = Object.keys(dailyMap).sort();
    const activeDaysCount = activeDateKeys.length;

    let currentStreak = 0;
    let cursor = dailyMap[todayKey] ? todayKey : (dailyMap[yestKey] ? yestKey : null);
    while (cursor && dailyMap[cursor] && dailyMap[cursor].length > 0) {
      currentStreak++;
      cursor = addDays(cursor, -1);
    }

    let bestStreak = 0;
    let runStreak = 0;
    let prevDay = null;
    activeDateKeys.forEach((dk) => {
      if (!prevDay || addDays(prevDay, 1) === dk) {
        runStreak++;
      } else {
        runStreak = 1;
      }
      if (runStreak > bestStreak) bestStreak = runStreak;
      prevDay = dk;
    });

    const remainingCount = Math.max(0, totalAvailable - totalSolved);
    const avgPaceActive = activeDaysCount > 0 ? +(totalSolved / activeDaysCount).toFixed(1) : 0;
    const recentPace7d = +(last7DaysCount / 7).toFixed(1);

    const activeHistory = activeDateKeys
      .slice()
      .reverse()
      .map((dk) => {
        const ids = dailyMap[dk];
        const byCourse = {};
        ids.forEach((id) => {
          const c = id.split('_')[0];
          byCourse[c] = (byCourse[c] || 0) + 1;
        });
        return {
          dateKey: dk,
          displayDate: formatDisplayDate(dk),
          isToday: dk === todayKey,
          isYesterday: dk === yestKey,
          count: ids.length,
          ids,
          byCourse
        };
      });

    const diffBreakdown = {
      very_easy: { total: 0, solved: 0 },
      easy: { total: 0, solved: 0 },
      medium: { total: 0, solved: 0 },
      hard: { total: 0, solved: 0 },
      hardest: { total: 0, solved: 0 }
    };
    allQuestions.forEach((q) => {
      const info = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.getQuestionDifficulty(q) : { level: 'medium' };
      const lvl = info.level || 'medium';
      if (diffBreakdown[lvl]) {
        diffBreakdown[lvl].total++;
        if (solvedMap[q.id]) diffBreakdown[lvl].solved++;
      }
    });

    return {
      totalAvailable,
      totalSolved,
      remainingCount,
      todayKey,
      yestKey,
      todayCount,
      yesterdayCount,
      last7DaysCount,
      last30DaysCount,
      activeDaysCount,
      currentStreak,
      bestStreak,
      avgPaceActive,
      recentPace7d,
      dailyMap,
      activeHistory,
      subjectSolved,
      courseSolved,
      diffBreakdown
    };
  }

  function updateQuickStatsStrip() {
    const a = calculateAnalytics();

    const pillEl = document.getElementById('stats-today-pill');
    if (pillEl) {
      pillEl.textContent = a.todayCount > 0 ? `${a.todayCount} Today` : 'Analytics';
      pillEl.classList.toggle('has-solved', a.todayCount > 0);
    }

    const qToday = document.getElementById('stat-quick-today');
    const qTodaySub = document.getElementById('stat-quick-today-sub');
    if (qToday) qToday.textContent = `${a.todayCount} Q${a.todayCount === 1 ? '' : 's'}`;
    if (qTodaySub) {
      qTodaySub.textContent = a.todayCount === 0
        ? (a.yesterdayCount > 0 ? `Yesterday: ${a.yesterdayCount} Qs` : 'Start solving today!')
        : `${Math.round((a.todayCount / 50) * 100)}% of 1 paper today`;
    }

    const qStreak = document.getElementById('stat-quick-streak');
    const qStreakSub = document.getElementById('stat-quick-streak-sub');
    if (qStreak) qStreak.textContent = `${a.currentStreak} Day${a.currentStreak === 1 ? '' : 's'}`;
    if (qStreakSub) qStreakSub.textContent = `Best: ${a.bestStreak} day${a.bestStreak === 1 ? '' : 's'}`;

    const qWeek = document.getElementById('stat-quick-week');
    const qWeekSub = document.getElementById('stat-quick-week-sub');
    if (qWeek) qWeek.textContent = `${a.last7DaysCount} Qs`;
    if (qWeekSub) qWeekSub.textContent = `Avg: ${a.recentPace7d} / day`;

    const qForecast = document.getElementById('stat-quick-forecast');
    const qRemaining = document.getElementById('stat-quick-remaining');
    if (qRemaining) qRemaining.textContent = `${a.remainingCount} of ${a.totalAvailable} remaining`;
    if (qForecast) {
      if (a.remainingCount === 0) {
        qForecast.textContent = '100% Complete!';
      } else if (a.avgPaceActive > 0) {
        const estDays = Math.ceil(a.remainingCount / Math.max(a.recentPace7d || a.avgPaceActive, 0.5));
        qForecast.textContent = `~${estDays} Days`;
      } else {
        qForecast.textContent = 'Click to simulate';
      }
    }

    if (isModalOpen()) renderModalContent();
  }

  function isModalOpen() {
    const modal = document.getElementById('stats-analytics-modal');
    return modal && !modal.classList.contains('hidden');
  }

  function openStatsModal(tabName) {
    const modal = document.getElementById('stats-analytics-modal');
    if (!modal) return;
    if (tabName) activeTab = tabName;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderModalContent();
  }

  function closeStatsModal() {
    const modal = document.getElementById('stats-analytics-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function switchTab(tabName) {
    activeTab = tabName || 'daily';
    renderModalContent();
  }

  function filterByDate(dateKey) {
    const a = calculateAnalytics();
    const ids = a.dailyMap[dateKey] || [];
    closeStatsModal();
    if (typeof window.switchMainTab === 'function') {
      window.switchMainTab('pyq-tracker');
    }
    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.filterByQuestionIds === 'function') {
      window.SEM_TRACKER.filterByQuestionIds(ids, `Solved on ${formatDisplayDate(dateKey)}`);
    }
  }

  function jumpToCourseFilter(courseCode) {
    closeStatsModal();
    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.jumpToTracker === 'function') {
      window.SEM_TRACKER.jumpToTracker({ course: courseCode });
    }
  }

  function jumpToSubjectFilter(subjectName) {
    closeStatsModal();
    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.jumpToTracker === 'function') {
      window.SEM_TRACKER.jumpToTracker({ subject: subjectName });
    }
  }

  function setSimulatorPace(paceVal) {
    const num = Math.max(1, Math.min(200, parseInt(paceVal, 10) || 15));
    dailyTargetPace = num;
    const a = calculateAnalytics();
    const daysEl = document.getElementById('target-res-days');
    const dateEl = document.getElementById('target-res-date');
    const papersEl = document.getElementById('target-res-papers');
    const sliderEl = document.getElementById('target-pace-slider');
    const labelEl = document.getElementById('target-pace-val-display');

    if (sliderEl && Number(sliderEl.value) !== num) sliderEl.value = num;
    if (labelEl) labelEl.textContent = `${num} Qs / day`;

    const daysNeeded = a.remainingCount === 0 ? 0 : Math.ceil(a.remainingCount / num);
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysNeeded);

    if (daysEl) daysEl.textContent = a.remainingCount === 0 ? 'Done! 🎉' : `${daysNeeded} Days`;
    if (dateEl) {
      dateEl.textContent = a.remainingCount === 0
        ? 'Completed'
        : finishDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (papersEl) {
      papersEl.textContent = `${((num * 7) / 50).toFixed(1)} Papers/wk`;
    }
  }

  function renderDailyTab(a) {
    const spotlightBtn = a.todayCount > 0
      ? `<button class="btn-spotlight-filter" onclick="SEM_STATS.filterByDate('${a.todayKey}')">🔍 Filter Today's ${a.todayCount} Qs</button>`
      : `<button class="btn-spotlight-filter" onclick="SEM_STATS.closeStatsModal(); window.switchMainTab && window.switchMainTab('pyq-tracker');">🎯 Start Solving Now</button>`;

    const maxCount = Math.max(1, ...a.activeHistory.map((h) => h.count));

    const tableRows = a.activeHistory.length === 0
      ? `<tr><td colspan="4"><div class="stats-empty-state">No solved questions recorded yet. Mark questions as Solved in the PYQ Tracker or finish a CBT Mock Test!</div></td></tr>`
      : a.activeHistory.slice(0, 30).map((item) => {
          const tagCls = item.isToday ? 'today-tag' : (item.isYesterday ? 'yest-tag' : '');
          const tagHtml = tagCls
            ? `<span class="${tagCls}">${item.displayDate}</span>`
            : `<strong>${item.displayDate}</strong> <small style="color:var(--text-muted)">(${item.dateKey})</small>`;
          const courseBreakdown = Object.entries(item.byCourse)
            .map(([c, cnt]) => `${c} (${cnt})`)
            .join(', ');
          const barPct = Math.round((item.count / maxCount) * 100);
          return `
            <tr class="${item.isToday ? 'row-today' : ''}">
              <td>${tagHtml}</td>
              <td>
                <span class="daily-solved-badge ${item.count >= 25 ? 'high' : ''}">${item.count} Solved</span>
                <div class="daily-progress-bar-bg"><div class="daily-progress-bar-fill" style="width:${barPct}%"></div></div>
              </td>
              <td style="font-size:0.8rem; color:var(--text-secondary);">${courseBreakdown}</td>
              <td>
                <button class="btn-table-action" onclick="SEM_STATS.filterByDate('${item.dateKey}')">View Qs →</button>
              </td>
            </tr>
          `;
        }).join('');

    return `
      <div class="stats-today-spotlight">
        <div class="stats-today-spotlight-left">
          <span class="spotlight-badge">TODAY'S PROGRESS · ${a.todayKey}</span>
          <div class="spotlight-number">${a.todayCount} <span>Questions Solved</span></div>
          <p class="spotlight-msg">
            ${a.todayCount === 0
              ? 'Solve even 5 MCQs today to build your Semester V preparation streak!'
              : `Great momentum! That equals ${((a.todayCount / 50) * 100).toFixed(0)}% of a standard 50-question paper today.`}
          </p>
        </div>
        ${spotlightBtn}
      </div>

      <div class="stats-table-wrapper">
        <table class="stats-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Questions Solved</th>
              <th>Course Breakdown</th>
              <th>Inspect</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderVelocityTab(a) {
    return `
      <div class="mastery-cards-grid" style="margin-bottom:18px;">
        <div class="mastery-card">
          <div class="mastery-card-header">
            <div>
              <div class="mastery-card-title">🔥 Current Streak</div>
              <div class="mastery-card-sub">Consecutive active study days</div>
            </div>
            <span class="mastery-badge status-in-progress">${a.currentStreak} Days</span>
          </div>
          <div class="mastery-card-footer">
            <span>Best recorded streak</span>
            <strong>${a.bestStreak} days</strong>
          </div>
        </div>

        <div class="mastery-card">
          <div class="mastery-card-header">
            <div>
              <div class="mastery-card-title">📅 Weekly Pace (7 Days)</div>
              <div class="mastery-card-sub">Solved in last 7 days</div>
            </div>
            <span class="mastery-badge status-mastered">${a.last7DaysCount} Qs</span>
          </div>
          <div class="mastery-card-footer">
            <span>7-day rolling velocity</span>
            <strong>${a.recentPace7d} Qs/day</strong>
          </div>
        </div>

        <div class="mastery-card">
          <div class="mastery-card-header">
            <div>
              <div class="mastery-card-title">📆 Monthly Output (30 Days)</div>
              <div class="mastery-card-sub">Active study days: ${a.activeDaysCount}</div>
            </div>
            <span class="mastery-badge status-in-progress">${a.last30DaysCount} Qs</span>
          </div>
          <div class="mastery-card-footer">
            <span>Active-day average</span>
            <strong>${a.avgPaceActive} Qs/day</strong>
          </div>
        </div>
      </div>

      <div class="target-sim-hero">
        <h4>📊 UNPG Semester V Benchmark</h4>
        <p style="font-size:0.86rem; color:var(--text-secondary); line-height:1.5;">
          The full 3-year Semester V bank contains <strong>750 MCQs across 15 papers</strong> (2023–24, 2024–25, 2025–26). Solving <strong>25 Qs/day</strong> clears all 15 papers in 30 days; solving <strong>1 full paper/day (50 Qs)</strong> completes the entire bank in 15 days.
        </p>
      </div>
    `;
  }

  function renderMasteryTab(a) {
    const mathSolved = a.subjectSolved.Mathematics || 0;
    const phySolved = a.subjectSolved.Physics || 0;
    const mathPct = ((mathSolved / 450) * 100).toFixed(1);
    const phyPct = ((phySolved / 300) * 100).toFixed(1);

    const getBadgeCls = (pctNum) => pctNum >= 80 ? 'status-mastered' : (pctNum > 0 ? 'status-in-progress' : 'status-not-started');
    const getBadgeTxt = (pctNum) => pctNum >= 80 ? 'Mastered' : (pctNum > 0 ? 'In Progress' : 'Not Started');

    const coursesHtml = COURSE_CATALOG.map((c) => {
      const s = a.courseSolved[c.code] || 0;
      const pct = ((s / c.total) * 100).toFixed(1);
      return `
        <div class="mastery-subtopic-item" style="cursor:pointer;" onclick="SEM_STATS.jumpToCourseFilter('${c.code}')" title="Click to open ${c.code} in PYQ Tracker">
          <div class="mastery-subtopic-info">
            <span class="mastery-subtopic-title">${c.code} · ${c.title} (${c.subject})</span>
            <span class="mastery-subtopic-count">${s} / ${c.total} (${pct}%)</span>
          </div>
          <div class="mastery-subtopic-bar">
            <div class="mastery-subtopic-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    const diffMeta = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.LEVELS : {};
    const diffOrder = window.SEM_DIFFICULTY ? window.SEM_DIFFICULTY.ORDER : ['very_easy', 'easy', 'medium', 'hard', 'hardest'];
    const diffHtml = diffOrder.map((lvl) => {
      const d = a.diffBreakdown[lvl] || { total: 0, solved: 0 };
      const meta = diffMeta[lvl] || { emoji: '•', label: lvl, color: '#818cf8' };
      const pct = d.total > 0 ? ((d.solved / d.total) * 100).toFixed(1) : '0.0';
      return `
        <div class="mastery-subtopic-item">
          <div class="mastery-subtopic-info">
            <span class="mastery-subtopic-title">${meta.emoji} ${meta.label}</span>
            <span class="mastery-subtopic-count">${d.solved} / ${d.total} (${pct}%)</span>
          </div>
          <div class="mastery-subtopic-bar">
            <div class="mastery-subtopic-fill" style="width:${pct}%; background:${meta.color}"></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="mastery-cards-grid">
        <div class="mastery-card" style="cursor:pointer;" onclick="SEM_STATS.jumpToSubjectFilter('Mathematics')">
          <div class="mastery-card-header">
            <div>
              <div class="mastery-card-title">📐 Mathematics</div>
              <div class="mastery-card-sub">MAT301F · MAT302F · MAT303F</div>
            </div>
            <span class="mastery-badge ${getBadgeCls(parseFloat(mathPct))}">${getBadgeTxt(parseFloat(mathPct))}</span>
          </div>
          <div class="mastery-progress-bar-bg"><div class="mastery-progress-bar-fill" style="width:${mathPct}%"></div></div>
          <div class="mastery-card-footer">
            <span>${mathSolved} / 450 Solved</span>
            <strong>${mathPct}%</strong>
          </div>
        </div>

        <div class="mastery-card" style="cursor:pointer;" onclick="SEM_STATS.jumpToSubjectFilter('Physics')">
          <div class="mastery-card-header">
            <div>
              <div class="mastery-card-title">⚛️ Physics</div>
              <div class="mastery-card-sub">PHY301F · PHY302F</div>
            </div>
            <span class="mastery-badge ${getBadgeCls(parseFloat(phyPct))}">${getBadgeTxt(parseFloat(phyPct))}</span>
          </div>
          <div class="mastery-progress-bar-bg"><div class="mastery-progress-bar-fill" style="width:${phyPct}%; background:var(--green);"></div></div>
          <div class="mastery-card-footer">
            <span>${phySolved} / 300 Solved</span>
            <strong>${phyPct}%</strong>
          </div>
        </div>
      </div>

      <h4 style="font-size:0.9rem; color:var(--text-main); margin:16px 0 8px;">📚 Paper-Wise Mastery (Click any course to open in Tracker)</h4>
      <div class="mastery-subtopics-list">${coursesHtml}</div>

      <h4 style="font-size:0.9rem; color:var(--text-main); margin:18px 0 8px;">⚡ Difficulty Tier Coverage</h4>
      <div class="mastery-subtopics-list">${diffHtml}</div>
    `;
  }

  function renderTargetTab(a) {
    const initialPace = dailyTargetPace;
    const daysNeeded = a.remainingCount === 0 ? 0 : Math.ceil(a.remainingCount / initialPace);
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysNeeded);

    return `
      <div class="target-sim-hero">
        <h4>🎯 PYQ Completion Simulator</h4>
        <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:14px;">
          Remaining backlog: <strong>${a.remainingCount}</strong> of ${a.totalAvailable} MCQs (${a.totalSolved} solved). Adjust your daily target pace:
        </p>

        <div class="target-sim-slider-row">
          <label for="target-pace-slider">Daily Solving Target</label>
          <input type="range" id="target-pace-slider" min="5" max="100" step="5" value="${initialPace}" oninput="SEM_STATS.setSimulatorPace(this.value)" style="flex:1; accent-color:var(--accent);" />
          <span id="target-pace-val-display" class="target-pace-display">${initialPace} Qs / day</span>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          <button class="btn-preset-pace" onclick="SEM_STATS.setSimulatorPace(10)">10 Qs/day</button>
          <button class="btn-preset-pace" onclick="SEM_STATS.setSimulatorPace(25)">25 Qs/day (Half Paper)</button>
          <button class="btn-preset-pace" onclick="SEM_STATS.setSimulatorPace(50)">50 Qs/day (1 Full Paper)</button>
          <button class="btn-preset-pace" onclick="SEM_STATS.setSimulatorPace(75)">75 Qs/day</button>
        </div>
      </div>

      <div class="target-result-card">
        <div class="target-result-grid">
          <div>
            <span class="target-res-label">Days to 100% Bank</span>
            <strong id="target-res-days" class="target-res-val">${a.remainingCount === 0 ? 'Done! 🎉' : `${daysNeeded} Days`}</strong>
          </div>
          <div>
            <span class="target-res-label">Estimated Finish Date</span>
            <strong id="target-res-date" class="target-res-val">${a.remainingCount === 0 ? 'Completed' : finishDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          </div>
          <div>
            <span class="target-res-label">Weekly Paper Equivalent</span>
            <strong id="target-res-papers" class="target-res-val">${((initialPace * 7) / 50).toFixed(1)} Papers/wk</strong>
          </div>
        </div>
      </div>
    `;
  }

  function renderModalContent() {
    const modal = document.getElementById('stats-analytics-modal');
    if (!modal) return;
    const body = modal.querySelector('.stats-modal-body');
    if (!body) return;

    const a = calculateAnalytics();
    const overallPct = a.totalAvailable > 0 ? ((a.totalSolved / a.totalAvailable) * 100).toFixed(1) : '0.0';

    const kpiHtml = `
      <div class="stats-kpi-bar">
        <div class="stats-kpi-item ${a.todayCount > 0 ? 'active' : ''}">
          <span class="stats-kpi-label">Today</span>
          <span class="stats-kpi-val">${a.todayCount} Qs</span>
          <span class="stats-kpi-sub">${a.todayKey}</span>
        </div>
        <div class="stats-kpi-item">
          <span class="stats-kpi-label">Streak</span>
          <span class="stats-kpi-val">${a.currentStreak}d</span>
          <span class="stats-kpi-sub">Best: ${a.bestStreak}d</span>
        </div>
        <div class="stats-kpi-item">
          <span class="stats-kpi-label">Last 7 Days</span>
          <span class="stats-kpi-val">${a.last7DaysCount} Qs</span>
          <span class="stats-kpi-sub">${a.recentPace7d}/day</span>
        </div>
        <div class="stats-kpi-item">
          <span class="stats-kpi-label">Overall</span>
          <span class="stats-kpi-val">${overallPct}%</span>
          <span class="stats-kpi-sub">${a.totalSolved}/${a.totalAvailable}</span>
        </div>
      </div>
    `;

    const tabsHtml = `
      <div class="stats-modal-tabs">
        <button class="stats-tab-btn ${activeTab === 'daily' ? 'active' : ''}" onclick="SEM_STATS.switchTab('daily')">📅 Daily Solving History</button>
        <button class="stats-tab-btn ${activeTab === 'velocity' ? 'active' : ''}" onclick="SEM_STATS.switchTab('velocity')">📈 Weekly &amp; Monthly Pace</button>
        <button class="stats-tab-btn ${activeTab === 'mastery' ? 'active' : ''}" onclick="SEM_STATS.switchTab('mastery')">📊 Subject &amp; Course Mastery</button>
        <button class="stats-tab-btn ${activeTab === 'target' ? 'active' : ''}" onclick="SEM_STATS.switchTab('target')">🎯 Target Simulator</button>
      </div>
    `;

    let panelHtml = '';
    if (activeTab === 'daily') panelHtml = renderDailyTab(a);
    else if (activeTab === 'velocity') panelHtml = renderVelocityTab(a);
    else if (activeTab === 'mastery') panelHtml = renderMasteryTab(a);
    else panelHtml = renderTargetTab(a);

    body.innerHTML = kpiHtml + tabsHtml + `<div class="stats-tab-content">${panelHtml}</div>`;
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalOpen()) closeStatsModal();
    });
    window.addEventListener('sem-difficulty-updated', () => {
      updateQuickStatsStrip();
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(updateQuickStatsStrip, 80));
    } else {
      setTimeout(updateQuickStatsStrip, 80);
    }
  }

  window.SEM_STATS = {
    COURSE_CATALOG,
    calculateAnalytics,
    updateQuickStatsStrip,
    openStatsModal,
    closeStatsModal,
    switchTab,
    filterByDate,
    jumpToCourseFilter,
    jumpToSubjectFilter,
    setSimulatorPace
  };

  init();
})();
