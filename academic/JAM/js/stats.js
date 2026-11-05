/**
 * IIT JAM Mathematics (MA) — Study Stats & Daily Solving Analytics Engine
 * Tracks daily question counts (especially Today), study streaks, weekly/monthly velocity,
 * subject topic mastery, and exam completion forecasting.
 */

(function() {
  'use strict';

  const state = {
    activeTab: 'daily', // 'daily' | 'velocity' | 'mastery' | 'target'
    cachedAnalytics: null,
    targetDailyPace: 10 // default target pace in simulator
  };

  // ==========================================================================
  // Date Helpers (Timezone-Aware Local Date Formatting)
  // ==========================================================================

  function getLocalDateKey(dateObj) {
    const d = dateObj || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getISOWeekKey(dateObj) {
    const d = new Date(dateObj.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function getWeekRangeStr(dateObj) {
    const d = new Date(dateObj.getTime());
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const opt = { day: 'numeric', month: 'short' };
    return `${monday.toLocaleDateString('en-IN', opt)} – ${sunday.toLocaleDateString('en-IN', opt)}`;
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return '—';
    try {
      const parts = dateKey.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateKey;
    }
  }

  function parseDateKey(dateKey) {
    try {
      const parts = dateKey.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } catch (e) {
      return new Date();
    }
  }

  function getTopTopicsString(topics) {
    if (!topics) return '—';
    return Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([t, count]) => {
        const short = t === 'Multivariable Calculus and Differential Equations' ? 'Calculus & ODE'
          : (t === 'Linear Algebra and Algebra' ? 'Linear Algebra' : t);
        return `${short} (${count})`;
      }).join(', ');
  }

  // ==========================================================================
  // Core Analytics Calculation Engine
  // ==========================================================================

  function calculateAnalytics() {
    let userData = { questions: {}, oosMarkedUnnecessary: false };
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function') {
      userData = window.JAM_TRACKER.getUserData();
    } else {
      try {
        const raw = localStorage.getItem('jam_pyq_user_tracker_v1');
        if (raw) userData = JSON.parse(raw);
      } catch (e) {}
    }

    const questions = userData.questions || {};
    const masterData = window.JAM_CATEGORIZED_DATA || [];
    const masterMap = {};
    masterData.forEach(q => {
      masterMap[`JAM_${q.year}_Q${q.question_number}`] = q;
    });

    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayKey = getLocalDateKey(yesterday);
    const currentWeekKey = getISOWeekKey(now);
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Collect solved items
    const solvedList = [];
    Object.entries(questions).forEach(([qId, uState]) => {
      if (uState && uState.solved) {
        const qMeta = masterMap[qId] || {};
        let solvedDate = null;
        if (uState.solvedAt) {
          try {
            solvedDate = new Date(uState.solvedAt);
            if (isNaN(solvedDate.getTime())) solvedDate = null;
          } catch (e) {
            solvedDate = null;
          }
        }
        solvedList.push({
          id: qId,
          year: qMeta.year || 0,
          q_num: qMeta.question_number || 0,
          topic: qMeta.topic || 'Other',
          subtopic: qMeta.subtopic || 'General',
          isOOS: qMeta.topic === 'Out of Syllabus',
          solvedAt: solvedDate,
          difficulty: uState.difficulty || null
        });
      }
    });

    // 1. Group by Day (Strict date tracking: only items with valid timestamps are grouped into calendar days)
    const dailyMap = {};
    const undatedList = [];

    solvedList.forEach(item => {
      if (!item.solvedAt) {
        undatedList.push(item);
        return;
      }
      const dateKey = getLocalDateKey(item.solvedAt);
      if (!dailyMap[dateKey]) {
        const dayDate = parseDateKey(dateKey);
        dailyMap[dateKey] = {
          dateKey: dateKey,
          displayDate: formatDisplayDate(dateKey),
          dayName: dayDate.toLocaleDateString('en-IN', { weekday: 'short' }),
          newSolved: 0,
          topics: {},
          questions: [],
          cumulativeTotal: 0
        };
      }
      dailyMap[dateKey].newSolved++;
      dailyMap[dateKey].topics[item.topic] = (dailyMap[dateKey].topics[item.topic] || 0) + 1;
      dailyMap[dateKey].questions.push(item.id);
    });

    // Group undated solved questions (marked solved without date/time tag)
    let undatedGroup = null;
    if (undatedList.length > 0) {
      const undatedTopics = {};
      const undatedQuestions = [];
      undatedList.forEach(item => {
        undatedTopics[item.topic] = (undatedTopics[item.topic] || 0) + 1;
        undatedQuestions.push(item.id);
      });
      undatedGroup = {
        dateKey: 'undated',
        displayDate: 'Earlier / Undated',
        dayName: '—',
        newSolved: undatedList.length,
        topics: undatedTopics,
        questions: undatedQuestions,
        cumulativeTotal: undatedList.length,
        isUndated: true
      };
    }

    // Sort days chronologically for cumulative sum (starting from earlier/undated total)
    const sortedDaysAsc = Object.values(dailyMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    let runningTotal = undatedList.length;
    sortedDaysAsc.forEach(d => {
      runningTotal += d.newSolved;
      d.cumulativeTotal = runningTotal;
    });

    // Sort days descending for display
    const dailyListDesc = Object.values(dailyMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // 2. Streaks calculation (only active calendar dates with real solving timestamps)
    const activeDateKeys = Object.keys(dailyMap).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    if (activeDateKeys.length > 0) {
      // Check if solved today or yesterday to keep streak active
      const hasToday = !!dailyMap[todayKey];
      const hasYesterday = !!dailyMap[yesterdayKey];

      if (hasToday || hasYesterday) {
        let checkDate = hasToday ? new Date(now) : new Date(yesterday);
        while (true) {
          const k = getLocalDateKey(checkDate);
          if (dailyMap[k]) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      // Longest streak
      for (let i = 0; i < activeDateKeys.length; i++) {
        if (i === 0) {
          tempStreak = 1;
        } else {
          const prev = parseDateKey(activeDateKeys[i - 1]);
          const curr = parseDateKey(activeDateKeys[i]);
          const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            tempStreak = 1;
          }
        }
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // 3. Most productive day (only from actual dated calendar days)
    let mostProductiveDay = { date: '—', count: 0 };
    Object.values(dailyMap).forEach(d => {
      if (d.newSolved > mostProductiveDay.count) {
        mostProductiveDay = { date: d.displayDate, count: d.newSolved, dateKey: d.dateKey };
      }
    });

    // 4. Weekly Velocity (only items with valid timestamps)
    const weeklyMap = {};
    solvedList.forEach(item => {
      if (!item.solvedAt) return; // Do not count undated in current week pace
      const d = item.solvedAt;
      const wKey = getISOWeekKey(d);
      const dayKey = getLocalDateKey(d);
      if (!weeklyMap[wKey]) {
        weeklyMap[wKey] = {
          weekKey: wKey,
          weekRange: getWeekRangeStr(d),
          newSolved: 0,
          activeDates: new Set(),
          topics: {},
          cumulativeTotal: 0
        };
      }
      weeklyMap[wKey].newSolved++;
      weeklyMap[wKey].activeDates.add(dayKey);
      weeklyMap[wKey].topics[item.topic] = (weeklyMap[wKey].topics[item.topic] || 0) + 1;
    });

    const weeklyListDesc = Object.values(weeklyMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    // 5. Monthly Velocity (only items with valid timestamps)
    const monthlyMap = {};
    solvedList.forEach(item => {
      if (!item.solvedAt) return; // Do not count undated in current month pace
      const d = item.solvedAt;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dayKey = getLocalDateKey(d);
      if (!monthlyMap[mKey]) {
        monthlyMap[mKey] = {
          monthKey: mKey,
          monthName: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          newSolved: 0,
          activeDates: new Set(),
          topics: {},
          cumulativeTotal: 0
        };
      }
      monthlyMap[mKey].newSolved++;
      monthlyMap[mKey].activeDates.add(dayKey);
      monthlyMap[mKey].topics[item.topic] = (monthlyMap[mKey].topics[item.topic] || 0) + 1;
    });

    const monthlyListDesc = Object.values(monthlyMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // 6. Subject Topic Mastery (all solved items counted, dated & undated)
    const topicStats = {
      'Real Analysis': { total: 286, solved: 0 },
      'Multivariable Calculus and Differential Equations': { total: 257, solved: 0 },
      'Linear Algebra and Algebra': { total: 255, solved: 0 },
      'Out of Syllabus': { total: 87, solved: 0 }
    };
    solvedList.forEach(item => {
      if (topicStats[item.topic]) {
        topicStats[item.topic].solved++;
      }
    });

    // 7. Today & This Week Specific Counts
    const todaySolved = dailyMap[todayKey]?.newSolved || 0;
    const yesterdaySolved = dailyMap[yesterdayKey]?.newSolved || 0;
    const thisWeekSolved = weeklyMap[currentWeekKey]?.newSolved || 0;
    const thisWeekActiveDays = weeklyMap[currentWeekKey]?.activeDates.size || (todaySolved > 0 ? 1 : 0);
    const thisWeekDailyPace = thisWeekActiveDays > 0 ? (thisWeekSolved / thisWeekActiveDays).toFixed(1) : '0.0';

    // 8. Forecast / Remaining Calculations
    const coreTotal = 798;
    const inSyllabusSolved = solvedList.filter(x => !x.isOOS).length;
    const remainingCore = Math.max(0, coreTotal - inSyllabusSolved);

    // Recent 7-day velocity (only from actual dated days)
    let recent7DaysSolved = 0;
    for (let i = 0; i < 7; i++) {
      const pastD = new Date(now.getTime() - (i * 86400000));
      const pk = getLocalDateKey(pastD);
      if (dailyMap[pk]) recent7DaysSolved += dailyMap[pk].newSolved;
    }
    const recentDailyPace = Math.max(0.5, recent7DaysSolved > 0 ? (recent7DaysSolved / 7) : 5);
    const daysToFinish = Math.ceil(remainingCore / recentDailyPace);
    const estimatedFinishDate = new Date(now.getTime() + (daysToFinish * 86400000));

    state.cachedAnalytics = {
      totalSolved: solvedList.length,
      inSyllabusSolved: inSyllabusSolved,
      undatedCount: undatedList.length,
      undatedGroup: undatedGroup,
      remainingCore: remainingCore,
      todayKey: todayKey,
      todaySolved: todaySolved,
      yesterdaySolved: yesterdaySolved,
      thisWeekSolved: thisWeekSolved,
      thisWeekActiveDays: thisWeekActiveDays,
      thisWeekDailyPace: thisWeekDailyPace,
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      mostProductiveDay: mostProductiveDay,
      daily: dailyListDesc,
      weekly: weeklyListDesc,
      monthly: monthlyListDesc,
      topicStats: topicStats,
      recentDailyPace: recentDailyPace.toFixed(1),
      daysToFinish: daysToFinish,
      estimatedFinishDate: estimatedFinishDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      lastUpdated: new Date().toISOString()
    };

    return state.cachedAnalytics;
  }

  // ==========================================================================
  // UI Rendering: Quick Stats Strip in Progress Card
  // ==========================================================================

  function updateQuickStatsStrip() {
    const data = calculateAnalytics();

    // 1. Header action button today badge
    const headerTodayBadge = document.getElementById('stats-today-pill');
    if (headerTodayBadge) {
      headerTodayBadge.textContent = `Today: +${data.todaySolved}`;
      if (data.todaySolved > 0) {
        headerTodayBadge.classList.add('has-solved');
      } else {
        headerTodayBadge.classList.remove('has-solved');
      }
    }

    // 2. Quick card: Today
    const qTodayVal = document.getElementById('stat-quick-today');
    const qTodaySub = document.getElementById('stat-quick-today-sub');
    if (qTodayVal) {
      qTodayVal.textContent = `+${data.todaySolved} Qs`;
      if (data.todaySolved > 0) {
        qTodayVal.classList.add('highlight-green');
      } else {
        qTodayVal.classList.remove('highlight-green');
      }
    }
    if (qTodaySub) {
      if (data.todaySolved > 0) {
        qTodaySub.textContent = `🔥 Great progress! (Yesterday: +${data.yesterdaySolved})`;
      } else {
        qTodaySub.textContent = data.yesterdaySolved > 0 ? `Yesterday: +${data.yesterdaySolved} Qs` : `Start today's session!`;
      }
    }

    // 3. Quick card: Streak
    const qStreakVal = document.getElementById('stat-quick-streak');
    const qStreakSub = document.getElementById('stat-quick-streak-sub');
    if (qStreakVal) {
      qStreakVal.textContent = `${data.currentStreak} Day${data.currentStreak === 1 ? '' : 's'}`;
      if (data.currentStreak > 0) {
        qStreakVal.classList.add('highlight-streak');
      } else {
        qStreakVal.classList.remove('highlight-streak');
      }
    }
    if (qStreakSub) {
      qStreakSub.textContent = `Best: ${data.longestStreak} Day${data.longestStreak === 1 ? '' : 's'} 🏆`;
    }

    // 4. Quick card: This Week
    const qWeekVal = document.getElementById('stat-quick-week');
    const qWeekSub = document.getElementById('stat-quick-week-sub');
    if (qWeekVal) qWeekVal.textContent = `+${data.thisWeekSolved} Qs`;
    if (qWeekSub) qWeekSub.textContent = `Pace: ${data.thisWeekDailyPace} Qs/day`;

    // 5. Quick card: Forecast
    const qForecastVal = document.getElementById('stat-quick-forecast');
    const qRemainingSub = document.getElementById('stat-quick-remaining');
    if (qForecastVal) {
      if (data.remainingCore === 0) {
        qForecastVal.textContent = '🎉 100% Core PYQs Solved!';
      } else {
        qForecastVal.textContent = `~${data.estimatedFinishDate}`;
      }
    }
    if (qRemainingSub) {
      qRemainingSub.textContent = `${data.remainingCore} Core questions left`;
    }

    // If analytics modal is currently open, refresh its contents in real-time
    const modal = document.getElementById('stats-analytics-modal');
    if (modal && !modal.classList.contains('hidden')) {
      renderModalContent();
    }
  }

  // ==========================================================================
  // Detailed Analytics Modal Dashboard
  // ==========================================================================

  function renderModalContent() {
    const modal = document.getElementById('stats-analytics-modal');
    if (!modal) return;

    const data = calculateAnalytics();

    modal.innerHTML = `
      <div class="modal-card stats-modal-card">
        <div class="modal-header">
          <div class="modal-title">
            <span style="font-size: 1.3rem;">📊</span>
            <span>Study Analytics & Daily Solving Tracker</span>
          </div>
          <button class="modal-close-btn" onclick="window.JAM_STATS.closeModal()" title="Close (Esc)">✕</button>
        </div>

        <!-- Top Milestone KPI Row -->
        <div class="stats-kpi-bar">
          <div class="stats-kpi-item ${data.todaySolved > 0 ? 'active' : ''}">
            <div class="stats-kpi-label">📅 Solved Today</div>
            <div class="stats-kpi-val ${data.todaySolved > 0 ? 'text-green' : ''}">+${data.todaySolved}</div>
            <div class="stats-kpi-sub">Target: 10 Qs/day</div>
          </div>
          <div class="stats-kpi-item ${data.currentStreak > 0 ? 'active' : ''}">
            <div class="stats-kpi-label">🔥 Current Streak</div>
            <div class="stats-kpi-val text-amber">${data.currentStreak} <span style="font-size:0.9rem;">days</span></div>
            <div class="stats-kpi-sub">Best: ${data.longestStreak} days 🏆</div>
          </div>
          <div class="stats-kpi-item">
            <div class="stats-kpi-label">📆 This Week</div>
            <div class="stats-kpi-val text-blue">+${data.thisWeekSolved}</div>
            <div class="stats-kpi-sub">${data.thisWeekDailyPace} Qs/day pace</div>
          </div>
          <div class="stats-kpi-item">
            <div class="stats-kpi-label">🎯 Core Solved</div>
            <div class="stats-kpi-val text-purple">${data.inSyllabusSolved} <span style="font-size:0.85rem;">/ 798</span></div>
            <div class="stats-kpi-sub">${((data.inSyllabusSolved / 798) * 100).toFixed(1)}% Completed</div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="stats-modal-tabs">
          <button class="stats-tab-btn ${state.activeTab === 'daily' ? 'active' : ''}" onclick="window.JAM_STATS.switchTab('daily')">
            <span>📅</span> <span>Daily Solving History</span>
          </button>
          <button class="stats-tab-btn ${state.activeTab === 'velocity' ? 'active' : ''}" onclick="window.JAM_STATS.switchTab('velocity')">
            <span>📈</span> <span>Weekly & Monthly Pace</span>
          </button>
          <button class="stats-tab-btn ${state.activeTab === 'mastery' ? 'active' : ''}" onclick="window.JAM_STATS.switchTab('mastery')">
            <span>📚</span> <span>Subject Mastery</span>
          </button>
          <button class="stats-tab-btn ${state.activeTab === 'target' ? 'active' : ''}" onclick="window.JAM_STATS.switchTab('target')">
            <span>🎯</span> <span>Target Simulator</span>
          </button>
        </div>

        <!-- Tab Body -->
        <div class="modal-body" style="padding-top: 16px;">
          ${renderTabBody(data)}
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; border-top: 1px solid var(--border);">
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            ⭐ Most Productive Day: <strong style="color:var(--text-main);">${data.mostProductiveDay.count > 0 ? `${data.mostProductiveDay.date} (+${data.mostProductiveDay.count} questions)` : '—'}</strong>
          </div>
          <button type="button" class="btn-test secondary" onclick="window.JAM_STATS.closeModal()">Close</button>
        </div>
      </div>
    `;
  }

  function renderTabBody(data) {
    // ------------------------------------------------------------------------
    // Tab 1: Daily Solving Log
    // ------------------------------------------------------------------------
    if (state.activeTab === 'daily') {
      const maxDaily = Math.max(...data.daily.map(d => d.newSolved), 1);
      const hasAnyHistory = data.daily.length > 0 || (data.undatedGroup && data.undatedGroup.newSolved > 0);

      return `
        <div class="stats-tab-content">
          <div class="stats-today-spotlight">
            <div class="stats-today-spotlight-left">
              <span class="spotlight-badge">TODAY'S STUDY STATUS</span>
              <div class="spotlight-number">+${data.todaySolved} <span>Questions Solved</span></div>
              <p class="spotlight-msg">
                ${data.todaySolved === 0
                  ? 'No questions solved yet today. Mark questions solved in the question bank below to log today\'s progress!'
                  : (data.todaySolved >= 15 ? '🌟 Exceptional pace today! You are crushing your IIT JAM prep!' : 'Keep going! Every question solved strengthens your exam intuition.')}
              </p>
            </div>
            ${data.todaySolved > 0 ? `
              <button class="btn-spotlight-filter" onclick="window.JAM_STATS.filterByDate('${data.todayKey}')">
                🔍 View Today's ${data.todaySolved} Questions ↗
              </button>
            ` : ''}
          </div>

          <h4 style="color: var(--text-main); font-size: 0.95rem; margin: 18px 0 10px 0;">
            📅 Day-by-Day Solving History
          </h4>

          ${!hasAnyHistory ? `
            <div class="stats-empty-state">
              <span style="font-size: 2rem;">📝</span>
              <p>No questions marked as solved yet. Once you solve questions, your daily activity and study streak will appear here!</p>
            </div>
          ` : `
            <div class="stats-table-wrapper">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th style="text-align:center;">Solved</th>
                    <th>Visual Bar</th>
                    <th>Key Topics Studied</th>
                    <th style="text-align:right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.daily.map(d => {
                    const isToday = d.dateKey === data.todayKey;
                    const isYest = d.dateKey === getLocalDateKey(new Date(Date.now() - 86400000));
                    const barWidth = Math.min(100, Math.round((d.newSolved / maxDaily) * 100));
                    const topTopicsStr = getTopTopicsString(d.topics);

                    return `
                      <tr class="${isToday ? 'row-today' : ''}">
                        <td>
                          <strong>${d.displayDate}</strong>
                          ${isToday ? '<span class="today-tag">TODAY</span>' : (isYest ? '<span class="yest-tag">YEST</span>' : '')}
                        </td>
                        <td>${d.dayName}</td>
                        <td style="text-align:center;">
                          <span class="daily-solved-badge ${d.newSolved >= 10 ? 'high' : ''}">+${d.newSolved}</span>
                        </td>
                        <td style="width: 140px;">
                          <div class="daily-progress-bar-bg">
                            <div class="daily-progress-bar-fill" style="width: ${barWidth}%;"></div>
                          </div>
                        </td>
                        <td style="font-size:0.8rem; color:var(--text-secondary);">${topTopicsStr || '—'}</td>
                        <td style="text-align:right;">
                          <button class="btn-table-action" onclick="window.JAM_STATS.filterByDate('${d.dateKey}')" title="Filter tracker to questions solved on this date">
                            View Qs ↗
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}

                  ${data.undatedGroup ? `
                    <tr class="row-undated">
                      <td>
                        <strong>${data.undatedGroup.displayDate}</strong>
                        <span class="undated-tag" title="Questions marked solved before timestamps or without date tag">PRIOR</span>
                      </td>
                      <td style="color:var(--text-muted);">${data.undatedGroup.dayName}</td>
                      <td style="text-align:center;">
                        <span class="daily-solved-badge undated">+${data.undatedGroup.newSolved}</span>
                      </td>
                      <td style="width: 140px;">
                        <div class="daily-progress-bar-bg" title="${data.undatedGroup.newSolved} undated solved questions">
                          <div class="daily-progress-bar-fill" style="width: 100%; opacity: 0.45; background: var(--text-muted);"></div>
                        </div>
                      </td>
                      <td style="font-size:0.8rem; color:var(--text-secondary);">${getTopTopicsString(data.undatedGroup.topics)}</td>
                      <td style="text-align:right;">
                        <button class="btn-table-action" onclick="window.JAM_STATS.filterByDate('undated')" title="Filter tracker to earlier questions solved without date tag">
                          View Qs ↗
                        </button>
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
    }

    // ------------------------------------------------------------------------
    // Tab 2: Weekly & Monthly Velocity
    // ------------------------------------------------------------------------
    if (state.activeTab === 'velocity') {
      return `
        <div class="stats-tab-content">
          <h4 style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 10px;">
            📆 Weekly Progress Breakdown
          </h4>

          ${data.weekly.length === 0 ? `
            <div class="stats-empty-state"><p>No weekly activity recorded yet.</p></div>
          ` : `
            <div class="stats-table-wrapper" style="margin-bottom: 24px;">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Date Range</th>
                    <th style="text-align:center;">Questions Solved</th>
                    <th style="text-align:center;">Active Days</th>
                    <th style="text-align:center;">Daily Pace</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.weekly.map(w => {
                    const activeCount = w.activeDates.size;
                    const pace = activeCount > 0 ? (w.newSolved / activeCount).toFixed(1) : '0.0';
                    return `
                      <tr>
                        <td><strong>${w.weekKey}</strong></td>
                        <td>${w.weekRange}</td>
                        <td style="text-align:center;"><strong style="color:var(--accent);">+${w.newSolved}</strong></td>
                        <td style="text-align:center;">${activeCount} day${activeCount === 1 ? '' : 's'}</td>
                        <td style="text-align:center;"><span class="daily-solved-badge">${pace} Qs/day</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}

          <h4 style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 10px;">
            🗓️ Monthly Progress Summary
          </h4>

          ${data.monthly.length === 0 ? `
            <div class="stats-empty-state"><p>No monthly activity recorded yet.</p></div>
          ` : `
            <div class="stats-table-wrapper">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style="text-align:center;">Questions Solved</th>
                    <th style="text-align:center;">Active Study Days</th>
                    <th>Dominant Topic</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.monthly.map(m => {
                    const topTopic = Object.entries(m.topics).sort((a, b) => b[1] - a[1])[0];
                    const topTopicStr = topTopic ? `${topTopic[0]} (${topTopic[1]} Qs)` : '—';
                    return `
                      <tr>
                        <td><strong>${m.monthName}</strong></td>
                        <td style="text-align:center;"><strong style="color:var(--green);">+${m.newSolved}</strong></td>
                        <td style="text-align:center;">${m.activeDates.size} day${m.activeDates.size === 1 ? '' : 's'}</td>
                        <td>${topTopicStr}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}

          ${data.undatedCount > 0 ? `
            <div class="undated-stats-notice">
              <span style="font-size:1.1rem; line-height:1;">ℹ️</span>
              <div>
                <strong>${data.undatedCount} question${data.undatedCount === 1 ? '' : 's'}</strong> were marked solved prior to date-time tracking. They are omitted from daily & weekly pace to keep velocity accurate, but remain 100% accounted for in <strong>Core Solved (${data.inSyllabusSolved} / 798)</strong> and <strong>Subject Mastery</strong>.
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    // ------------------------------------------------------------------------
    // Tab 3: Subject Topic Mastery
    // ------------------------------------------------------------------------
    if (state.activeTab === 'mastery') {
      return `
        <div class="stats-tab-content">
          <div class="mastery-cards-grid">
            ${Object.entries(data.topicStats).map(([topicName, ts]) => {
              const pct = ts.total > 0 ? ((ts.solved / ts.total) * 100).toFixed(1) : '0.0';
              const remaining = ts.total - ts.solved;
              let badgeClass = 'status-not-started';
              let badgeLabel = '⚪ Not Started';
              if (ts.solved === ts.total && ts.total > 0) {
                badgeClass = 'status-mastered';
                badgeLabel = '🟢 Mastered (100%)';
              } else if (ts.solved > 0) {
                badgeClass = 'status-in-progress';
                badgeLabel = `🟡 In Progress (${pct}%)`;
              }
              if (topicName === 'Out of Syllabus') {
                badgeLabel = 'Classical Era Topics';
              }

              return `
                <div class="mastery-card">
                  <div class="mastery-card-header">
                    <div>
                      <strong class="mastery-card-title">${topicName}</strong>
                      <div class="mastery-card-sub">${ts.solved} / ${ts.total} official examination questions</div>
                    </div>
                    <span class="mastery-badge ${badgeClass}">${badgeLabel}</span>
                  </div>

                  <div class="mastery-progress-bar-bg">
                    <div class="mastery-progress-bar-fill" style="width: ${pct}%;"></div>
                  </div>

                  <div class="mastery-card-footer">
                    <span>${pct}% completed</span>
                    <span style="color:var(--text-muted);">${remaining} questions left</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // ------------------------------------------------------------------------
    // Tab 4: Target Simulator & Completion Countdown
    // ------------------------------------------------------------------------
    if (state.activeTab === 'target') {
      const pace = state.targetDailyPace;
      const daysNeeded = Math.ceil(data.remainingCore / pace);
      const targetDate = new Date(Date.now() + (daysNeeded * 86400000));
      const targetDateStr = targetDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      return `
        <div class="stats-tab-content">
          <div class="target-sim-hero">
            <h4 style="color:var(--text-main); margin-bottom:6px;">🎯 IIT JAM Syllabus Completion Simulator</h4>
            <p style="color:var(--text-secondary); font-size:0.88rem; margin-bottom:18px;">
              Calculate exactly when you will complete all <strong>798 Core In-Syllabus PYQs</strong> based on your target daily solving pace.
            </p>

            <div class="target-sim-slider-row">
              <label for="target-pace-slider">Target Solving Pace:</label>
              <div style="display:flex; align-items:center; gap:16px;">
                <input type="range" id="target-pace-slider" min="1" max="30" value="${pace}" oninput="window.JAM_STATS.onSliderChange(this.value)" style="flex:1;">
                <span class="target-pace-display">${pace} Qs / Day</span>
              </div>
            </div>

            <!-- Dynamic Result Card -->
            <div class="target-result-card">
              <div class="target-result-grid">
                <div>
                  <span class="target-res-label">Remaining Core PYQs</span>
                  <div class="target-res-val">${data.remainingCore} questions</div>
                </div>
                <div>
                  <span class="target-res-label">Study Days Needed</span>
                  <div class="target-res-val text-amber">${daysNeeded} Days</div>
                </div>
                <div>
                  <span class="target-res-label">Estimated Completion Date</span>
                  <div class="target-res-val text-green">${targetDateStr}</div>
                </div>
              </div>
            </div>

            <!-- Pre-set Buttons -->
            <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; justify-content:center;">
              <button class="btn-preset-pace" onclick="window.JAM_STATS.onSliderChange(5)">5 Qs/day (~${Math.ceil(data.remainingCore / 5)} days)</button>
              <button class="btn-preset-pace" onclick="window.JAM_STATS.onSliderChange(10)">10 Qs/day (~${Math.ceil(data.remainingCore / 10)} days)</button>
              <button class="btn-preset-pace" onclick="window.JAM_STATS.onSliderChange(15)">15 Qs/day (~${Math.ceil(data.remainingCore / 15)} days)</button>
              <button class="btn-preset-pace" onclick="window.JAM_STATS.onSliderChange(20)">20 Qs/day (~${Math.ceil(data.remainingCore / 20)} days)</button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  // ==========================================================================
  // Public Controllers
  // ==========================================================================

  function openModal() {
    const modal = document.getElementById('stats-analytics-modal');
    if (!modal) return;
    renderModalContent();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('stats-analytics-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    renderModalContent();
  }

  function onSliderChange(val) {
    state.targetDailyPace = parseInt(val, 10) || 10;
    renderModalContent();
  }

  // Filter tracker by specific date or undated group
  function filterByDate(dateKey) {
    closeModal();
    const data = calculateAnalytics();
    let dayItem = null;
    let label = '';

    if (dateKey === 'undated') {
      dayItem = data.undatedGroup;
      label = `Earlier / Undated Solved Questions (+${dayItem?.newSolved || 0})`;
    } else {
      dayItem = data.daily.find(d => d.dateKey === dateKey);
      label = dayItem ? `Questions Solved on ${dayItem.displayDate} (+${dayItem.newSolved})` : '';
    }

    if (!dayItem || !dayItem.questions || dayItem.questions.length === 0) {
      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
        window.JAM_TRACKER.showToast('No questions found.');
      }
      return;
    }

    // Switch to tracker tab first if currently on another tab
    if (window.switchMainTab) {
      window.switchMainTab('pyq-tracker');
    }

    // Scroll to tracker questions container
    const qListEl = document.getElementById('tracker-questions-container') || document.getElementById('tab-panel-pyq-tracker');
    if (qListEl) {
      qListEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.filterByQuestionIds === 'function') {
      window.JAM_TRACKER.filterByQuestionIds(dayItem.questions, label);
    } else {
      // Fallback: search box
      const searchInput = document.getElementById('tracker-search-input');
      if (searchInput && window.JAM_TRACKER.onSearchInput) {
        searchInput.value = '';
        window.JAM_TRACKER.onStatusChange('solved');
      }
      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
        window.JAM_TRACKER.showToast(label);
      }
    }
  }

  // ==========================================================================
  // Initialization & Hooks
  // ==========================================================================

  window.JAM_STATS = {
    init: function() {
      updateQuickStatsStrip();

      // Keyboard Esc handler
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('stats-analytics-modal');
          if (modal && !modal.classList.contains('hidden')) {
            closeModal();
          }
        }
      });
    },

    openModal: openModal,
    closeModal: closeModal,
    switchTab: switchTab,
    onSliderChange: onSliderChange,
    filterByDate: filterByDate,
    refreshStats: updateQuickStatsStrip,
    getAnalytics: calculateAnalytics
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.JAM_STATS.init());
  } else {
    window.JAM_STATS.init();
  }

})();

