/**
 * IIT JAM Mathematics (MA) — Google Drive Cloud Backup & Real-Time Sync Engine
 * Manages dedicated Google Drive folder: "JAM Progress"
 * Automatically creates & syncs:
 *   1. 'IIT_JAM_MA_PYQ_Tracker_Backup.json' — Full tracker state & progress JSON
 *   2. 'JAM_Tracker_Activity_Log.txt' — Real-time audit trail of every button click & user action
 *   3. 'JAM_Progress_Analytics.md' — Periodic Daily, Weekly, and Monthly progress analytics
 * Privacy-first: Uses 'drive.file' scope — only touches files created by this application.
 */

(function() {
  'use strict';

  // Constants & Storage Keys
  const FOLDER_NAME = 'JAM Progress';
  const BACKUP_FILE_NAME = 'IIT_JAM_MA_PYQ_Tracker_Backup.json';
  const LOG_FILE_NAME = 'JAM_Tracker_Activity_Log.txt';
  const ANALYTICS_FILE_NAME = 'JAM_Progress_Analytics.md';

  const STORAGE_CLIENT_ID = 'jam_gdrive_client_id';
  const STORAGE_ACCESS_TOKEN = 'jam_gdrive_access_token';
  const STORAGE_TOKEN_EXPIRY = 'jam_gdrive_token_expiry';
  const STORAGE_USER_INFO = 'jam_gdrive_user_info';
  const STORAGE_FOLDER_ID = 'jam_gdrive_folder_id';
  const STORAGE_FILE_ID = 'jam_gdrive_file_id';
  const STORAGE_LOG_FILE_ID = 'jam_gdrive_log_file_id';
  const STORAGE_ANALYTICS_FILE_ID = 'jam_gdrive_analytics_file_id';
  const STORAGE_LAST_SYNC = 'jam_gdrive_last_sync';
  const STORAGE_AUTO_SYNC_ENABLED = 'jam_gdrive_auto_sync_enabled';
  const STORAGE_ACTIVITY_LOGS = 'jam_tracker_activity_logs';

  // Optional Default Client ID (leave empty so users configure their own client ID or via window.JAM_GDRIVE_DEFAULT_CLIENT_ID)
  // Users enter their own Google OAuth Client ID directly in the UI modal, stored strictly in their browser's localStorage.
  const DEFAULT_CLIENT_ID = window.JAM_GDRIVE_DEFAULT_CLIENT_ID || '';

  // Internal State
  const state = {
    clientId: localStorage.getItem(STORAGE_CLIENT_ID) || DEFAULT_CLIENT_ID,
    accessToken: localStorage.getItem(STORAGE_ACCESS_TOKEN) || null,
    tokenExpiry: parseInt(localStorage.getItem(STORAGE_TOKEN_EXPIRY) || '0', 10),
    userInfo: null,
    folderId: localStorage.getItem(STORAGE_FOLDER_ID) || null,
    fileId: localStorage.getItem(STORAGE_FILE_ID) || null,
    logFileId: localStorage.getItem(STORAGE_LOG_FILE_ID) || null,
    analyticsFileId: localStorage.getItem(STORAGE_ANALYTICS_FILE_ID) || null,
    lastSyncTime: localStorage.getItem(STORAGE_LAST_SYNC) || null,
    autoSyncEnabled: localStorage.getItem(STORAGE_AUTO_SYNC_ENABLED) !== 'false',
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error' | 'expired'
    statusMessage: '',
    tokenClient: null,
    debounceTimer: null,
    isInitialSyncInProgress: false
  };

  // Parse saved user info if available
  try {
    const rawUser = localStorage.getItem(STORAGE_USER_INFO);
    if (rawUser) state.userInfo = JSON.parse(rawUser);
  } catch (e) {
    state.userInfo = null;
  }

  // ==========================================================================
  // Subsystem 1: User Activity & Action Logger
  // ==========================================================================
  const JAM_LOGGER = {
    logAction: function(category, details) {
      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const timeStr = now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        const logEntry = {
          iso: now.toISOString(),
          displayTime: `${dateStr} ${timeStr} IST`,
          category: String(category || 'ACTION').toUpperCase(),
          details: String(details || '')
        };

        const raw = localStorage.getItem(STORAGE_ACTIVITY_LOGS);
        let logs = raw ? JSON.parse(raw) : [];
        logs.push(logEntry);

        // Keep last 2500 events in local storage
        if (logs.length > 2500) {
          logs = logs.slice(logs.length - 2500);
        }
        localStorage.setItem(STORAGE_ACTIVITY_LOGS, JSON.stringify(logs));
      } catch (e) {
        console.warn('Logging error:', e);
      }
    },

    getLogs: function() {
      try {
        const raw = localStorage.getItem(STORAGE_ACTIVITY_LOGS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    generateLogFileText: function() {
      const logs = this.getLogs();
      const header = [
        '================================================================================',
        'IIT JAM MATHEMATICS (MA) — USER ACTIVITY & INTERACTION AUDIT LOG',
        `Google Drive Folder : "${FOLDER_NAME}"`,
        `File Name           : "${LOG_FILE_NAME}"`,
        `Last Updated        : ${new Date().toLocaleString('en-IN')} IST`,
        `Total Actions Logged: ${logs.length}`,
        '================================================================================',
        '',
        'TIMESTAMP (IST)           | ACTION TYPE        | DETAILS',
        '--------------------------------------------------------------------------------'
      ];

      if (logs.length === 0) {
        header.push('(No user actions recorded yet. Clicks and toggles will appear here.)');
      } else {
        logs.forEach(entry => {
          const timePad = (entry.displayTime || '').padEnd(25, ' ');
          const catPad = (entry.category || '').padEnd(18, ' ');
          header.push(`${timePad} | ${catPad} | ${entry.details}`);
        });
      }

      header.push('--------------------------------------------------------------------------------');
      header.push('=== End of Activity Log ===');
      return header.join('\r\n');
    }
  };
  window.JAM_LOGGER = JAM_LOGGER;

  // Global delegated click listener for auxiliary buttons (CBT links, modals, etc.)
  document.addEventListener('click', (e) => {
    try {
      const cbt = e.target.closest('.q-cbt-link');
      if (cbt) {
        JAM_LOGGER.logAction('CBT_OPEN', cbt.getAttribute('title') || 'Opened CBT Mock Test');
      }
      const chip = e.target.closest('.search-chip');
      if (chip) {
        JAM_LOGGER.logAction('SEARCH_CHIP', `Clicked quick search chip: "${chip.textContent.trim()}"`);
      }
      const pageBtn = e.target.closest('.page-btn');
      if (pageBtn) {
        JAM_LOGGER.logAction('PAGINATION', `Clicked: "${pageBtn.textContent.trim()}"`);
      }
    } catch (err) {}
  });

  // ==========================================================================
  // Subsystem 2: Daily, Weekly, and Monthly Progress Analytics Engine
  // ==========================================================================
  const JAM_ANALYTICS = {
    getISOWeek: function(d) {
      const date = new Date(d.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
      const week1 = new Date(date.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    },

    getWeekRangeStr: function(d) {
      const date = new Date(d.getTime());
      const day = (date.getDay() + 6) % 7;
      const monday = new Date(date);
      monday.setDate(date.getDate() - day);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const opt = { day: 'numeric', month: 'short', year: 'numeric' };
      return `${monday.toLocaleDateString('en-IN', opt)} – ${sunday.toLocaleDateString('en-IN', opt)}`;
    },

    calculateAnalytics: function(userData) {
      const questions = userData.questions || {};
      const masterData = window.JAM_CATEGORIZED_DATA || [];
      const masterMap = {};
      masterData.forEach(q => {
        masterMap[`JAM_${q.year}_Q${q.question_number}`] = q;
      });

      // Filter solved questions
      const solvedList = [];
      Object.entries(questions).forEach(([id, uState]) => {
        if (uState && uState.solved) {
          const qMeta = masterMap[id] || {};
          let solvedDate = null;
          if (uState.solvedAt) {
            solvedDate = new Date(uState.solvedAt);
          } else if (userData.lastUpdated) {
            solvedDate = new Date(userData.lastUpdated);
          } else {
            solvedDate = new Date();
          }

          solvedList.push({
            id: id,
            solvedDate: solvedDate,
            dateKey: solvedDate.toISOString().split('T')[0],
            weekKey: this.getISOWeek(solvedDate),
            weekRange: this.getWeekRangeStr(solvedDate),
            monthKey: `${solvedDate.getFullYear()}-${String(solvedDate.getMonth() + 1).padStart(2, '0')}`,
            monthName: solvedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            year: solvedDate.getFullYear(),
            topic: qMeta.topic || 'General',
            sub_topic: qMeta.sub_topic || 'General',
            difficulty: uState.difficulty || 'unrated',
            isOOS: qMeta.topic === 'Out of Syllabus'
          });
        }
      });

      // Sort chronological by solved timestamp
      solvedList.sort((a, b) => a.solvedDate.getTime() - b.solvedDate.getTime());

      // 1. Daily Aggregation
      const dailyMap = {};
      let runningSolved = 0;
      solvedList.forEach(item => {
        runningSolved++;
        if (!dailyMap[item.dateKey]) {
          dailyMap[item.dateKey] = {
            dateKey: item.dateKey,
            dayName: item.solvedDate.toLocaleDateString('en-IN', { weekday: 'long' }),
            newSolved: 0,
            cumulativeTotal: 0,
            questions: [],
            topics: {},
            difficulties: {}
          };
        }
        const d = dailyMap[item.dateKey];
        d.newSolved++;
        d.cumulativeTotal = runningSolved;
        d.questions.push(item.id.replace('JAM_', ''));
        d.topics[item.topic] = (d.topics[item.topic] || 0) + 1;
        d.difficulties[item.difficulty] = (d.difficulties[item.difficulty] || 0) + 1;
      });

      // 2. Weekly Aggregation
      const weeklyMap = {};
      let runningWeeklySolved = 0;
      solvedList.forEach(item => {
        runningWeeklySolved++;
        if (!weeklyMap[item.weekKey]) {
          weeklyMap[item.weekKey] = {
            weekKey: item.weekKey,
            weekRange: item.weekRange,
            newSolved: 0,
            cumulativeTotal: 0,
            activeDates: new Set(),
            topics: {},
            questions: []
          };
        }
        const w = weeklyMap[item.weekKey];
        w.newSolved++;
        w.cumulativeTotal = runningWeeklySolved;
        w.activeDates.add(item.dateKey);
        w.questions.push(item.id.replace('JAM_', ''));
        w.topics[item.topic] = (w.topics[item.topic] || 0) + 1;
      });

      // 3. Monthly Aggregation
      const monthlyMap = {};
      let runningMonthlySolved = 0;
      solvedList.forEach(item => {
        runningMonthlySolved++;
        if (!monthlyMap[item.monthKey]) {
          monthlyMap[item.monthKey] = {
            monthKey: item.monthKey,
            monthName: item.monthName,
            newSolved: 0,
            cumulativeTotal: 0,
            activeDates: new Set(),
            topics: {},
            difficulties: {},
            questions: []
          };
        }
        const m = monthlyMap[item.monthKey];
        m.newSolved++;
        m.cumulativeTotal = runningMonthlySolved;
        m.activeDates.add(item.dateKey);
        m.questions.push(item.id.replace('JAM_', ''));
        m.topics[item.topic] = (m.topics[item.topic] || 0) + 1;
        m.difficulties[item.difficulty] = (m.difficulties[item.difficulty] || 0) + 1;
      });

      // 4. Streaks & Best Day
      const uniqueDates = Object.keys(dailyMap).sort();
      let currentStreak = 0;
      let longestStreak = 0;
      let mostProductiveDay = { date: 'N/A', count: 0 };

      uniqueDates.forEach(dt => {
        const cnt = dailyMap[dt].newSolved;
        if (cnt > mostProductiveDay.count) {
          mostProductiveDay = { date: dt, count: cnt };
        }
      });

      if (uniqueDates.length > 0) {
        const dateSet = new Set(uniqueDates);
        const now = new Date();
        const formatYMD = d => d.toISOString().split('T')[0];
        const todayStr = formatYMD(now);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatYMD(yesterday);

        const checkDate = dateSet.has(todayStr) ? now : (dateSet.has(yesterdayStr) ? yesterday : null);
        if (checkDate) {
          const curr = new Date(checkDate);
          while (dateSet.has(formatYMD(curr))) {
            currentStreak++;
            curr.setDate(curr.getDate() - 1);
          }
        }

        // Longest streak
        let tempStreak = 0;
        let prevDate = null;
        uniqueDates.forEach(dtStr => {
          const curD = new Date(dtStr);
          if (prevDate) {
            const diffDays = Math.round((curD.getTime() - prevDate.getTime()) / 86400000);
            if (diffDays === 1) {
              tempStreak++;
            } else {
              tempStreak = 1;
            }
          } else {
            tempStreak = 1;
          }
          prevDate = curD;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        });
      }

      // Topic totals
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

      return {
        totalSolved: solvedList.length,
        inSyllabusSolved: solvedList.filter(x => !x.isOOS).length,
        daily: Object.values(dailyMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
        weekly: Object.values(weeklyMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
        monthly: Object.values(monthlyMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
        currentStreak: currentStreak,
        longestStreak: longestStreak,
        mostProductiveDay: mostProductiveDay,
        topicStats: topicStats,
        lastUpdated: new Date().toISOString()
      };
    },

    generateMarkdown: function(userData) {
      const stats = this.calculateAnalytics(userData);
      const totalPYQs = 885;
      const corePYQs = 798;
      const totalPct = ((stats.totalSolved / totalPYQs) * 100).toFixed(1);
      const corePct = ((stats.inSyllabusSolved / corePYQs) * 100).toFixed(1);
      const updateTime = new Date().toLocaleString('en-IN', {
        dateStyle: 'full',
        timeStyle: 'medium'
      });

      const md = [];
      md.push('# 📊 IIT JAM Mathematics (MA) — Solving Progress & Study Analytics');
      md.push(`> **Google Drive Folder**: \`${FOLDER_NAME}\` | **File**: \`${ANALYTICS_FILE_NAME}\``);
      md.push(`> **Last Synchronized**: ${updateTime} IST`);
      md.push('');
      md.push('---');
      md.push('');

      // Section 1: Executive Milestone Overview
      md.push('## 🎯 Current Milestone Overview');
      md.push('');
      md.push('| Metric | Status / Score | Details |');
      md.push('| :--- | :--- | :--- |');
      md.push(`| **Core In-Syllabus Solved** | **${stats.inSyllabusSolved} / ${corePYQs} (${corePct}%)** | Target: 798 official in-syllabus questions |`);
      md.push(`| **Total 22-Year PYQs Solved** | **${stats.totalSolved} / ${totalPYQs} (${totalPct}%)** | Across 2005–2026 examination papers |`);
      md.push(`| **Out of Syllabus Marked** | **${userData.oosMarkedUnnecessary ? 'Excluded (87 Questions)' : 'Active in Pool'}** | Classical topics removed from current JAM syllabus |`);
      md.push(`| **Current Active Streak** | **🔥 ${stats.currentStreak} Day${stats.currentStreak === 1 ? '' : 's'}** | Consecutive solving days |`);
      md.push(`| **Longest Streak** | **🏆 ${stats.longestStreak} Day${stats.longestStreak === 1 ? '' : 's'}** | Personal best study streak |`);
      md.push(`| **Most Productive Day** | **⭐ ${stats.mostProductiveDay.date}** | **+${stats.mostProductiveDay.count} questions solved** |`);
      md.push('');
      md.push('---');
      md.push('');

      // Section 2: Daily Progress
      md.push('## 📅 Daily Solving Progress (Day-by-Day)');
      md.push('');
      if (stats.daily.length === 0) {
        md.push('*No solved questions recorded yet. Mark questions solved in the PYQ Tracker to view daily logs.*');
      } else {
        md.push('| Date | Day | New Solved | Cumulative Total | Top Focus Topic | Solved Questions |');
        md.push('| :--- | :--- | :---: | :---: | :--- | :--- |');
        stats.daily.forEach(d => {
          const topTopic = Object.entries(d.topics).sort((a, b) => b[1] - a[1])[0];
          const topTopicStr = topTopic ? `${topTopic[0]} (${topTopic[1]})` : '—';
          const qListStr = d.questions.slice(0, 10).map(x => `\`${x}\``).join(', ') + (d.questions.length > 10 ? ` *(+${d.questions.length - 10} more)*` : '');
          const cumPct = ((d.cumulativeTotal / totalPYQs) * 100).toFixed(1);
          md.push(`| **${d.dateKey}** | ${d.dayName} | **+${d.newSolved}** | **${d.cumulativeTotal} / ${totalPYQs} (${cumPct}%)** | ${topTopicStr} | ${qListStr} |`);
        });
      }
      md.push('');
      md.push('---');
      md.push('');

      // Section 3: Weekly Progress
      md.push('## 📆 Weekly Solving Progress (Week-by-Week)');
      md.push('');
      if (stats.weekly.length === 0) {
        md.push('*No weekly activity recorded yet.*');
      } else {
        md.push('| Week | Date Range | Questions Solved | Active Days | Daily Pace | Week-End Total |');
        md.push('| :--- | :--- | :---: | :---: | :---: | :---: |');
        stats.weekly.forEach(w => {
          const activeDaysCount = w.activeDates.size;
          const pace = activeDaysCount > 0 ? (w.newSolved / activeDaysCount).toFixed(1) : '0.0';
          const cumPct = ((w.cumulativeTotal / totalPYQs) * 100).toFixed(1);
          md.push(`| **${w.weekKey}** | ${w.weekRange} | **+${w.newSolved}** | ${activeDaysCount} day${activeDaysCount === 1 ? '' : 's'} | ${pace} Qs/day | **${w.cumulativeTotal} / ${totalPYQs} (${cumPct}%)** |`);
        });
      }
      md.push('');
      md.push('---');
      md.push('');

      // Section 4: Monthly Progress
      md.push('## 🗓️ Monthly Solving Progress (Month-by-Month)');
      md.push('');
      if (stats.monthly.length === 0) {
        md.push('*No monthly activity recorded yet.*');
      } else {
        md.push('| Month | Questions Solved | Active Study Days | Dominant Topic | Month-End Total |');
        md.push('| :--- | :---: | :---: | :--- | :---: |');
        stats.monthly.forEach(m => {
          const topTopic = Object.entries(m.topics).sort((a, b) => b[1] - a[1])[0];
          const topTopicStr = topTopic ? `${topTopic[0]} (${topTopic[1]} Qs)` : '—';
          const cumPct = ((m.cumulativeTotal / totalPYQs) * 100).toFixed(1);
          md.push(`| **${m.monthName}** | **+${m.newSolved}** | ${m.activeDates.size} day${m.activeDates.size === 1 ? '' : 's'} | ${topTopicStr} | **${m.cumulativeTotal} / ${totalPYQs} (${cumPct}%)** |`);
        });
      }
      md.push('');
      md.push('---');
      md.push('');

      // Section 5: Topic Mastery Status
      md.push('## 📚 Subject Topic Mastery Status');
      md.push('');
      md.push('| Subject Topic | Solved | Total | Completion | Status |');
      md.push('| :--- | :---: | :---: | :---: | :--- |');
      Object.entries(stats.topicStats).forEach(([topicName, ts]) => {
        const pct = ts.total > 0 ? ((ts.solved / ts.total) * 100).toFixed(1) : '0.0';
        let statusBadge = '⚪ Not Started';
        if (ts.solved === ts.total && ts.total > 0) statusBadge = '🟢 Mastered (100%)';
        else if (ts.solved > 0) statusBadge = `🟡 In Progress (${pct}%)`;
        if (topicName === 'Out of Syllabus' && userData.oosMarkedUnnecessary) {
          statusBadge = '🚫 Excluded by User';
        }
        md.push(`| **${topicName}** | **${ts.solved}** | ${ts.total} | **${pct}%** | ${statusBadge} |`);
      });
      md.push('');
      md.push('---');
      md.push('');
      md.push('*Automatically generated and synced to Google Drive by IIT JAM Mathematics (MA) Portal (`https://vaibhavgeometer.github.io/academic/JAM/`).*');

      return md.join('\r\n');
    }
  };
  window.JAM_ANALYTICS = JAM_ANALYTICS;

  // ==========================================================================
  // Subsystem 3: Google Drive REST API & Multi-File Cloud Sync
  // ==========================================================================

  function isLinked() {
    return !!(state.accessToken && state.folderId);
  }

  function isTokenExpired() {
    if (!state.accessToken || !state.tokenExpiry) return true;
    return Date.now() >= (state.tokenExpiry - 60000);
  }

  function getClientId() {
    return state.clientId || localStorage.getItem(STORAGE_CLIENT_ID) || DEFAULT_CLIENT_ID;
  }

  function formatRelativeSyncTime(isoString) {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 15) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return 'Recently';
    }
  }

  function formatFullDateTime(isoString) {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoString;
    }
  }

  function getTrackerPayload() {
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
    let solvedCount = 0;
    Object.values(questions).forEach(q => {
      if (q && q.solved) solvedCount++;
    });

    // Calculate periodic analytics data to bundle into JSON
    const analytics = JAM_ANALYTICS.calculateAnalytics(userData);

    return {
      app: 'IIT_JAM_Mathematics_MA_PYQ_Tracker',
      version: '1.2',
      folder: FOLDER_NAME,
      backupSource: 'Google Drive Instant Auto-Sync Engine',
      exportedAt: new Date().toISOString(),
      lastUpdated: userData.lastUpdated || new Date().toISOString(),
      stats: {
        totalOfficialPYQs: 885,
        solvedCount: solvedCount,
        inSyllabusSolved: analytics.inSyllabusSolved,
        oosMarkedUnnecessary: !!userData.oosMarkedUnnecessary
      },
      oosMarkedUnnecessary: !!userData.oosMarkedUnnecessary,
      analytics: {
        currentStreak: analytics.currentStreak,
        longestStreak: analytics.longestStreak,
        mostProductiveDay: analytics.mostProductiveDay,
        dailySummary: analytics.daily.map(d => ({ date: d.dateKey, newSolved: d.newSolved, cumulative: d.cumulativeTotal })),
        weeklySummary: analytics.weekly.map(w => ({ week: w.weekKey, range: w.weekRange, newSolved: w.newSolved })),
        monthlySummary: analytics.monthly.map(m => ({ month: m.monthName, newSolved: m.newSolved }))
      },
      questions: questions
    };
  }

  async function fetchUserInfo(token) {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        state.userInfo = await resp.json();
        localStorage.setItem(STORAGE_USER_INFO, JSON.stringify(state.userInfo));
      }
    } catch (e) {
      console.warn('Could not fetch user profile info:', e);
    }
  }

  // --- Folder Management ---
  async function ensureDriveFolder(token) {
    // 1. Check existing stored folder ID
    if (state.folderId) {
      try {
        const checkResp = await fetch(`https://www.googleapis.com/drive/v3/files/${state.folderId}?fields=id,name,trashed`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (checkResp.ok) {
          const folderData = await checkResp.json();
          if (!folderData.trashed) return state.folderId;
        }
      } catch (e) {}
    }

    // 2. Search for existing folder named "JAM Progress"
    const q = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
    const searchResp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (searchResp.ok) {
      const data = await searchResp.json();
      if (data.files && data.files.length > 0) {
        state.folderId = data.files[0].id;
        localStorage.setItem(STORAGE_FOLDER_ID, state.folderId);
        return state.folderId;
      }
    }

    // 3. Create "JAM Progress" folder
    const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'IIT JAM Mathematics PYQ Tracker - Progress Backups, Activity Logs & Analytics'
      })
    });

    if (!createResp.ok) {
      const errText = await createResp.text();
      throw new Error(`Could not create folder "${FOLDER_NAME}" in Google Drive: ${createResp.status} ${errText}`);
    }

    const folderData = await createResp.json();
    state.folderId = folderData.id;
    localStorage.setItem(STORAGE_FOLDER_ID, state.folderId);
    return state.folderId;
  }

  // --- File Placement & Creation inside "JAM Progress" Folder ---
  async function ensureFileInFolder(token, folderId, fileName, mimeType, description, initialBody) {
    // 1. Search if file already exists anywhere in Drive
    const q = `name = '${fileName}' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents,modifiedTime)&spaces=drive`;
    const searchResp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (searchResp.ok) {
      const data = await searchResp.json();
      if (data.files && data.files.length > 0) {
        const file = data.files[0];
        const parents = file.parents || [];

        // If file is not inside folderId (e.g. was previously in root of Drive), move it into "JAM Progress"!
        if (!parents.includes(folderId)) {
          const removeStr = parents.length > 0 ? parents.join(',') : 'root';
          const moveUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?addParents=${folderId}&removeParents=${encodeURIComponent(removeStr)}&fields=id,parents`;
          try {
            await fetch(moveUrl, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (moveErr) {
            console.warn(`Could not move ${fileName} into ${FOLDER_NAME}:`, moveErr);
          }
        }
        return file.id;
      }
    }

    // 2. Create file directly inside folderId
    const boundary = '-------JAM_DRIVE_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: mimeType.split(';')[0].trim(),
      parents: [folderId],
      description: description
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      initialBody +
      closeDelimiter;

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Failed to create ${fileName} in Google Drive: ${resp.status} ${errText}`);
    }

    const newFileData = await resp.json();
    return newFileData.id;
  }

  // --- Fast Media PATCH ---
  async function updateFileMedia(fileId, token, mimeType, content) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType
      },
      body: content
    });

    if (resp.status === 401) {
      throw new Error('UNAUTHORIZED_TOKEN_EXPIRED');
    }
    if (resp.status === 404) {
      throw new Error('FILE_NOT_FOUND_MAYBE_TRASHED');
    }
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Drive media sync error (${resp.status}): ${errBody}`);
    }

    return await resp.json();
  }

  // --- Read File from Drive ---
  async function readDriveFile(fileId, token) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Failed to read file from Drive: ${resp.status} ${errBody}`);
    }
    return await resp.json();
  }

  // --- Master Multi-File Synchronizer ---
  async function performSync(isManual = false) {
    if (!isLinked()) return;

    if (isTokenExpired()) {
      state.syncStatus = 'expired';
      state.statusMessage = 'Google Drive session expired. Click to re-link.';
      updateUI();
      if (isManual) {
        showToast('Google Drive session expired. Re-authorizing...');
        authorize();
      }
      return;
    }

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing files to "JAM Progress"...';
    updateUI();

    try {
      // 1. Ensure folder structure is intact
      const folderId = await ensureDriveFolder(state.accessToken);

      // 2. Generate content for all 3 files
      const trackerPayload = getTrackerPayload();
      const activityLogText = JAM_LOGGER.generateLogFileText();
      const analyticsMarkdown = JAM_ANALYTICS.generateMarkdown(
        window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function'
          ? window.JAM_TRACKER.getUserData()
          : trackerPayload
      );

      // 3. Ensure IDs for all 3 files exist
      if (!state.fileId) {
        state.fileId = await ensureFileInFolder(
          state.accessToken, folderId, BACKUP_FILE_NAME,
          'application/json', 'Real-time JSON Progress & State',
          JSON.stringify(trackerPayload, null, 2)
        );
        localStorage.setItem(STORAGE_FILE_ID, state.fileId);
      }

      if (!state.logFileId) {
        state.logFileId = await ensureFileInFolder(
          state.accessToken, folderId, LOG_FILE_NAME,
          'text/plain; charset=UTF-8', 'Live Activity & Click Audit Trail',
          activityLogText
        );
        localStorage.setItem(STORAGE_LOG_FILE_ID, state.logFileId);
      }

      if (!state.analyticsFileId) {
        state.analyticsFileId = await ensureFileInFolder(
          state.accessToken, folderId, ANALYTICS_FILE_NAME,
          'text/markdown; charset=UTF-8', 'Daily, Weekly & Monthly Progress Analytics',
          analyticsMarkdown
        );
        localStorage.setItem(STORAGE_ANALYTICS_FILE_ID, state.analyticsFileId);
      }

      // 4. Concurrently update all 3 files via Media PATCH
      try {
        await Promise.all([
          updateFileMedia(state.fileId, state.accessToken, 'application/json', JSON.stringify(trackerPayload, null, 2)),
          updateFileMedia(state.logFileId, state.accessToken, 'text/plain; charset=UTF-8', activityLogText),
          updateFileMedia(state.analyticsFileId, state.accessToken, 'text/markdown; charset=UTF-8', analyticsMarkdown)
        ]);
      } catch (updateErr) {
        if (updateErr.message === 'FILE_NOT_FOUND_MAYBE_TRASHED') {
          // One or more files were trashed in Drive; recreate them
          state.fileId = await ensureFileInFolder(
            state.accessToken, folderId, BACKUP_FILE_NAME,
            'application/json', 'Real-time JSON Progress & State',
            JSON.stringify(trackerPayload, null, 2)
          );
          localStorage.setItem(STORAGE_FILE_ID, state.fileId);

          state.logFileId = await ensureFileInFolder(
            state.accessToken, folderId, LOG_FILE_NAME,
            'text/plain; charset=UTF-8', 'Live Activity & Click Audit Trail',
            activityLogText
          );
          localStorage.setItem(STORAGE_LOG_FILE_ID, state.logFileId);

          state.analyticsFileId = await ensureFileInFolder(
            state.accessToken, folderId, ANALYTICS_FILE_NAME,
            'text/markdown; charset=UTF-8', 'Daily, Weekly & Monthly Progress Analytics',
            analyticsMarkdown
          );
          localStorage.setItem(STORAGE_ANALYTICS_FILE_ID, state.analyticsFileId);
        } else if (updateErr.message === 'UNAUTHORIZED_TOKEN_EXPIRED') {
          state.syncStatus = 'expired';
          state.statusMessage = 'Session expired. Click to re-link.';
          updateUI();
          return;
        } else {
          throw updateErr;
        }
      }

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
      state.syncStatus = 'synced';
      state.statusMessage = `Synced to "JAM Progress" (${formatRelativeSyncTime(state.lastSyncTime)})`;
      updateUI();

      if (isManual) {
        showToast('✓ Successfully synced 3 files to Google Drive folder "JAM Progress"!');
      }
    } catch (err) {
      console.error('Google Drive Sync Error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Sync failed (Offline / Error)';
      updateUI();
      if (isManual) {
        alert('Could not sync to Google Drive: ' + err.message);
      }
    }
  }

  function triggerAutoSync() {
    if (!isLinked() || !state.autoSyncEnabled) return;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing to Drive...';
    updateHeaderButtonUI();

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    // 350ms debounce: instant feel while batching rapid multi-clicks
    state.debounceTimer = setTimeout(() => {
      performSync(false);
    }, 350);
  }

  // --- Google OAuth2 Authorization ---
  function initTokenClient() {
    const clientId = getClientId();
    if (!clientId) return null;

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      console.warn('Google Identity Services library not yet loaded.');
      return null;
    }

    try {
      state.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (resp) => {
          if (resp.error) {
            console.error('Google Auth Error:', resp);
            state.syncStatus = 'error';
            state.statusMessage = 'Authentication failed: ' + (resp.error_description || resp.error);
            updateUI();
            alert('Google Drive authorization failed: ' + (resp.error_description || resp.error));
            return;
          }

          await handleAuthSuccess(resp);
        }
      });
      return state.tokenClient;
    } catch (e) {
      console.error('Failed to init Google token client:', e);
      return null;
    }
  }

  async function handleAuthSuccess(tokenResponse) {
    state.accessToken = tokenResponse.access_token;
    const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3600;
    state.tokenExpiry = Date.now() + (expiresIn * 1000);

    localStorage.setItem(STORAGE_ACCESS_TOKEN, state.accessToken);
    localStorage.setItem(STORAGE_TOKEN_EXPIRY, String(state.tokenExpiry));

    state.syncStatus = 'syncing';
    state.statusMessage = 'Connecting to Google Drive...';
    updateUI();

    try {
      // 1. Fetch user profile
      await fetchUserInfo(state.accessToken);

      // 2. Ensure folder "JAM Progress" exists
      const folderId = await ensureDriveFolder(state.accessToken);

      // 3. Prepare initial files
      const trackerPayload = getTrackerPayload();
      const activityLogText = JAM_LOGGER.generateLogFileText();
      const analyticsMarkdown = JAM_ANALYTICS.generateMarkdown(
        window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function'
          ? window.JAM_TRACKER.getUserData()
          : trackerPayload
      );

      // 4. Ensure all 3 files exist and are placed inside folder "JAM Progress"
      state.fileId = await ensureFileInFolder(
        state.accessToken, folderId, BACKUP_FILE_NAME,
        'application/json', 'Real-time JSON Progress & State',
        JSON.stringify(trackerPayload, null, 2)
      );
      localStorage.setItem(STORAGE_FILE_ID, state.fileId);

      state.logFileId = await ensureFileInFolder(
        state.accessToken, folderId, LOG_FILE_NAME,
        'text/plain; charset=UTF-8', 'Live Activity & Click Audit Trail',
        activityLogText
      );
      localStorage.setItem(STORAGE_LOG_FILE_ID, state.logFileId);

      state.analyticsFileId = await ensureFileInFolder(
        state.accessToken, folderId, ANALYTICS_FILE_NAME,
        'text/markdown; charset=UTF-8', 'Daily, Weekly & Monthly Progress Analytics',
        analyticsMarkdown
      );
      localStorage.setItem(STORAGE_ANALYTICS_FILE_ID, state.analyticsFileId);

      // 5. Update media with current latest content
      await Promise.all([
        updateFileMedia(state.fileId, state.accessToken, 'application/json', JSON.stringify(trackerPayload, null, 2)),
        updateFileMedia(state.logFileId, state.accessToken, 'text/plain; charset=UTF-8', activityLogText),
        updateFileMedia(state.analyticsFileId, state.accessToken, 'text/markdown; charset=UTF-8', analyticsMarkdown)
      ]);

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
      state.syncStatus = 'synced';
      state.statusMessage = `Linked to "${FOLDER_NAME}" (${formatRelativeSyncTime(state.lastSyncTime)})`;
      updateUI();

      JAM_LOGGER.logAction('DRIVE_LINK', `Linked Google Drive account (${state.userInfo?.email || 'user'}). Initialized folder "${FOLDER_NAME}" with 3 files.`);
      showToast(`✓ Google Drive linked! 3 files initialized inside folder "${FOLDER_NAME}".`);
    } catch (err) {
      console.error('Error during Google Drive initial sync:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Link error: ' + err.message;
      updateUI();
      alert('Could not complete Google Drive setup: ' + err.message);
    }
  }

  function authorize() {
    const clientId = getClientId();
    if (!clientId) {
      openModal();
      setTimeout(() => {
        const input = document.getElementById('gdrive-client-id-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      alert('Google Identity Services is still loading. Please check your internet connection or try again in a few seconds.');
      return;
    }

    const client = initTokenClient();
    if (client) {
      client.requestAccessToken({ prompt: isTokenExpired() ? 'consent' : '' });
    }
  }

  function disconnect() {
    const confirmDisconnect = confirm(
      'Are you sure you want to disconnect Google Drive?\n\n' +
      '• Your existing "JAM Progress" folder and files in Google Drive will NOT be deleted.\n' +
      '• New progress will no longer auto-sync to your Google Drive.'
    );
    if (!confirmDisconnect) return;

    if (state.accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(state.accessToken, () => {});
      } catch (e) {}
    }

    JAM_LOGGER.logAction('DRIVE_UNLINK', 'Disconnected Google Drive account.');

    localStorage.removeItem(STORAGE_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_USER_INFO);
    localStorage.removeItem(STORAGE_FOLDER_ID);
    localStorage.removeItem(STORAGE_FILE_ID);
    localStorage.removeItem(STORAGE_LOG_FILE_ID);
    localStorage.removeItem(STORAGE_ANALYTICS_FILE_ID);
    localStorage.removeItem(STORAGE_LAST_SYNC);

    state.accessToken = null;
    state.tokenExpiry = 0;
    state.userInfo = null;
    state.folderId = null;
    state.fileId = null;
    state.logFileId = null;
    state.analyticsFileId = null;
    state.lastSyncTime = null;
    state.syncStatus = 'idle';
    state.statusMessage = 'Google Drive unlinked';

    updateUI();
    showToast('Google Drive account unlinked.');
  }

  async function restoreFromDrive() {
    if (!isLinked()) return;

    if (isTokenExpired()) {
      showToast('Google Drive session expired. Re-authorizing...');
      authorize();
      return;
    }

    const confirmRestore = confirm(
      '⚠️ RESTORE FROM GOOGLE DRIVE\n\n' +
      'This will replace your current browser PYQ tracker progress with the backup file from your Google Drive folder "JAM Progress".\n\n' +
      'Are you sure you want to continue?'
    );
    if (!confirmRestore) return;

    try {
      state.syncStatus = 'syncing';
      state.statusMessage = 'Downloading backup from Google Drive...';
      updateUI();

      const driveData = await readDriveFile(state.fileId, state.accessToken);

      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
        window.JAM_TRACKER.loadUserDataFromBackup(driveData);
      } else {
        localStorage.setItem('jam_pyq_user_tracker_v1', JSON.stringify({
          questions: driveData.questions || {},
          oosMarkedUnnecessary: !!driveData.oosMarkedUnnecessary
        }));
        if (window.JAM_TRACKER && typeof window.JAM_TRACKER.init === 'function') {
          window.JAM_TRACKER.init();
        }
      }

      state.syncStatus = 'synced';
      state.statusMessage = 'Restored from Google Drive ✓';
      updateUI();
      closeModal();
      JAM_LOGGER.logAction('DRIVE_RESTORE', 'Restored progress from Google Drive backup JSON.');
      showToast('✓ Progress restored successfully from Google Drive!');
    } catch (err) {
      console.error('Restore Error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Restore failed: ' + err.message;
      updateUI();
      alert('Failed to restore from Google Drive: ' + err.message);
    }
  }

  function openFolderInDrive() {
    if (state.folderId) {
      window.open(`https://drive.google.com/drive/folders/${state.folderId}`, '_blank');
    } else {
      window.open('https://drive.google.com/', '_blank');
    }
  }

  function openFileInDrive(fileId) {
    const id = fileId || state.fileId;
    if (id) {
      window.open(`https://drive.google.com/file/d/${id}/view`, '_blank');
    } else {
      window.open('https://drive.google.com/', '_blank');
    }
  }

  function setCustomClientId(newClientId) {
    const val = (newClientId || '').trim();
    state.clientId = val;
    if (val) {
      localStorage.setItem(STORAGE_CLIENT_ID, val);
      showToast('Google Client ID saved locally in your browser!');
    } else {
      localStorage.removeItem(STORAGE_CLIENT_ID);
      showToast('Custom Client ID cleared.');
    }
    state.tokenClient = null;
    updateUI();
  }

  function toggleAutoSync(enabled) {
    state.autoSyncEnabled = !!enabled;
    localStorage.setItem(STORAGE_AUTO_SYNC_ENABLED, String(state.autoSyncEnabled));
    updateUI();
    showToast(state.autoSyncEnabled ? 'Real-time Google Drive sync enabled' : 'Auto-sync paused');
  }

  // --- UI Rendering ---

  function updateHeaderButtonUI() {
    const btn = document.getElementById('btn-gdrive-sync');
    const label = document.getElementById('btn-gdrive-text');
    const dot = document.getElementById('gdrive-quick-dot');

    if (!btn) return;

    if (isLinked()) {
      btn.classList.add('linked');
      if (state.syncStatus === 'syncing') {
        if (label) label.textContent = 'Syncing...';
        if (dot) dot.className = 'gdrive-status-indicator syncing';
        btn.setAttribute('title', `Syncing 3 files to folder "${FOLDER_NAME}" in Google Drive...`);
      } else if (state.syncStatus === 'expired') {
        if (label) label.textContent = 'Drive: Re-link';
        if (dot) dot.className = 'gdrive-status-indicator expired';
        btn.setAttribute('title', 'Google Drive session expired. Click to re-link.');
      } else if (state.syncStatus === 'error') {
        if (label) label.textContent = 'Drive: Error';
        if (dot) dot.className = 'gdrive-status-indicator error';
        btn.setAttribute('title', 'Google Drive sync error. Click to view details.');
      } else {
        const timeStr = formatRelativeSyncTime(state.lastSyncTime);
        if (label) label.textContent = `Drive: Synced (${timeStr})`;
        if (dot) dot.className = 'gdrive-status-indicator synced';
        btn.setAttribute('title', `Google Drive Auto-Sync Active • Folder: "${FOLDER_NAME}" (3 files synced). Last: ${formatFullDateTime(state.lastSyncTime)}.`);
      }
    } else {
      btn.classList.remove('linked');
      if (label) label.textContent = 'Link Google Drive';
      if (dot) dot.className = 'gdrive-status-indicator';
      btn.setAttribute('title', 'Link your Google Drive account for instant real-time cloud backup into "JAM Progress"');
    }
  }

  function renderModalContent() {
    const modal = document.getElementById('gdrive-sync-modal');
    if (!modal) return;

    const linked = isLinked();
    const expired = isTokenExpired();
    const clientId = getClientId();
    const currentOrigin = window.location.origin;

    let statusPillHtml = '';
    if (linked) {
      if (expired) {
        statusPillHtml = '<span class="gdrive-badge-status expired">⚠️ Session Expired — Re-link Required</span>';
      } else if (state.syncStatus === 'syncing') {
        statusPillHtml = '<span class="gdrive-badge-status syncing">🔄 Syncing 3 files to Drive...</span>';
      } else {
        statusPillHtml = `<span class="gdrive-badge-status synced">🟢 Connected · "${FOLDER_NAME}"</span>`;
      }
    } else {
      statusPillHtml = '<span class="gdrive-badge-status unlinked">⚪ Not Connected</span>';
    }

    const userName = state.userInfo?.name || 'Google User';
    const userEmail = state.userInfo?.email || 'Connected Account';
    const userPicture = state.userInfo?.picture || '';

    modal.innerHTML = `
      <div class="modal-card gdrive-modal-card">
        <div class="modal-header">
          <div class="modal-title">
            <svg class="gdrive-icon-svg" viewBox="0 0 87.3 78" width="22" height="22">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
            <span>Google Drive Cloud Sync & "JAM Progress" Hub</span>
          </div>
          <button class="modal-close-btn" onclick="window.JAM_GDRIVE_SYNC.closeModal()" title="Close (Esc)">✕</button>
        </div>

        <div class="modal-body">
          <!-- Connection Status Card -->
          <div class="gdrive-status-card ${linked ? 'active' : ''}">
            <div class="gdrive-status-header">
              <div class="gdrive-user-meta">
                ${userPicture ? `<img src="${userPicture}" alt="${userName}" class="gdrive-user-avatar">` : '<div class="gdrive-user-avatar-placeholder">👤</div>'}
                <div>
                  <div class="gdrive-user-name">${linked ? userName : 'No Account Linked'}</div>
                  <div class="gdrive-user-email">${linked ? userEmail : 'Link your Google Drive for real-time 3-file sync'}</div>
                </div>
              </div>
              <div>${statusPillHtml}</div>
            </div>

            ${linked ? `
              <div class="gdrive-file-info-box">
                <div class="gdrive-info-row" style="border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                  <span class="gdrive-info-label">📁 Target Folder:</span>
                  <span class="gdrive-info-val">
                    <strong style="color:var(--accent);">"${FOLDER_NAME}"</strong>
                    <button class="btn-mini-link" onclick="window.JAM_GDRIVE_SYNC.openFolderInDrive()" title="Open folder in Google Drive">📂 Open Folder ↗</button>
                  </span>
                </div>

                <div class="gdrive-files-managed-list">
                  <div class="gdrive-file-row">
                    <div class="gdrive-file-row-left">
                      <span class="gdrive-file-icon">📄</span>
                      <div>
                        <strong>${BACKUP_FILE_NAME}</strong>
                        <div class="gdrive-file-subtext">Real-time tracker state, solved questions & answers JSON</div>
                      </div>
                    </div>
                    <button class="btn-mini-link" onclick="window.JAM_GDRIVE_SYNC.openFileInDrive('${state.fileId}')">View ↗</button>
                  </div>

                  <div class="gdrive-file-row">
                    <div class="gdrive-file-row-left">
                      <span class="gdrive-file-icon">📝</span>
                      <div>
                        <strong>${LOG_FILE_NAME}</strong>
                        <div class="gdrive-file-subtext">Complete chronological audit trail of all button clicks & actions</div>
                      </div>
                    </div>
                    <button class="btn-mini-link" onclick="window.JAM_GDRIVE_SYNC.openFileInDrive('${state.logFileId}')">View ↗</button>
                  </div>

                  <div class="gdrive-file-row">
                    <div class="gdrive-file-row-left">
                      <span class="gdrive-file-icon">📊</span>
                      <div>
                        <strong>${ANALYTICS_FILE_NAME}</strong>
                        <div class="gdrive-file-subtext">Daily, Weekly & Monthly progress report with breakdown tables</div>
                      </div>
                    </div>
                    <button class="btn-mini-link" onclick="window.JAM_GDRIVE_SYNC.openFileInDrive('${state.analyticsFileId}')">View ↗</button>
                  </div>
                </div>

                <div class="gdrive-info-row" style="margin-top: 6px; padding-top: 8px; border-top: 1px dashed var(--border);">
                  <span class="gdrive-info-label">⏱️ Last Synced:</span>
                  <span class="gdrive-info-val">${formatFullDateTime(state.lastSyncTime)} (${formatRelativeSyncTime(state.lastSyncTime)})</span>
                </div>

                <div class="gdrive-info-row">
                  <span class="gdrive-info-label">⚡ Instant Auto-Sync:</span>
                  <label class="gdrive-toggle-label">
                    <input type="checkbox" id="gdrive-auto-sync-checkbox" ${state.autoSyncEnabled ? 'checked' : ''} onchange="window.JAM_GDRIVE_SYNC.toggleAutoSync(this.checked)">
                    <span>Sync all 3 files automatically on every click</span>
                  </label>
                </div>
              </div>

              <!-- Action Controls for Linked Account -->
              <div class="gdrive-action-buttons-grid">
                <button class="btn-gdrive-action primary" onclick="window.JAM_GDRIVE_SYNC.syncNow()">
                  <span>🔄</span> <span>Sync All to Drive Now</span>
                </button>
                <button class="btn-gdrive-action secondary" onclick="window.JAM_GDRIVE_SYNC.openFolderInDrive()">
                  <span>📂</span> <span>Open "JAM Progress"</span>
                </button>
                <button class="btn-gdrive-action secondary" onclick="window.JAM_GDRIVE_SYNC.restoreFromDrive()">
                  <span>📥</span> <span>Restore from Drive</span>
                </button>
                <button class="btn-gdrive-action danger" onclick="window.JAM_GDRIVE_SYNC.disconnect()">
                  <span>🔌</span> <span>Disconnect Drive</span>
                </button>
              </div>
            ` : `
              <div class="gdrive-features-list">
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">📁</span>
                  <div>
                    <strong>Dedicated "JAM Progress" Folder</strong>
                    <p>All your progress files are neatly organized inside a dedicated <code>JAM Progress</code> folder in your personal Google Drive.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">📝</span>
                  <div>
                    <strong>Live User Action & Click Log File</strong>
                    <p>A companion <code>${LOG_FILE_NAME}</code> records every action you take (marking questions, difficulty tags, searches, filters, resets) with exact timestamps.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">📊</span>
                  <div>
                    <strong>Daily, Weekly & Monthly Analytics Report</strong>
                    <p>An automated <code>${ANALYTICS_FILE_NAME}</code> report tracks how many questions you solve each day, week, and month, with streak tracking and subject mastery tables.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">🔒</span>
                  <div>
                    <strong>Zero-Risk Privacy Guarantee</strong>
                    <p>Uses the official Google <code>drive.file</code> scope. The app can ONLY access its own <code>JAM Progress</code> folder and files — it cannot see or touch any other files in your Google Drive.</p>
                  </div>
                </div>
              </div>

              <div style="margin-top: 18px; text-align: center;">
                <button class="btn-test primary gdrive-connect-hero-btn" onclick="window.JAM_GDRIVE_SYNC.authorize()">
                  <svg class="gdrive-icon-svg" viewBox="0 0 87.3 78" width="18" height="18">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span>Link Google Drive Account</span>
                </button>
              </div>
            `}
          </div>

          <!-- Google Cloud Client ID Configuration (Collapsible / Configurable) -->
          <div class="gdrive-config-accordion">
            <details class="gdrive-details" ${!clientId ? 'open' : ''}>
              <summary class="gdrive-summary">
                <span>⚙️ Google OAuth Client ID Settings</span>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">${clientId ? '(Configured in your browser ✓)' : '(Required for setup)'}</span>
              </summary>
              <div class="gdrive-details-content">
                <p class="gdrive-config-hint">
                  Your Client ID is stored strictly in your browser's local storage and is never committed to GitHub or shared.
                </p>
                <div class="gdrive-input-group">
                  <label for="gdrive-client-id-input" class="gdrive-input-label">OAuth 2.0 Web Client ID:</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="text" id="gdrive-client-id-input" class="gdrive-input-field" placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com" value="${clientId}">
                    <button class="btn-test secondary" onclick="window.JAM_GDRIVE_SYNC.saveInputClientId()">Save</button>
                  </div>
                </div>

                <div class="gdrive-instructions-card">
                  <div class="gdrive-instructions-title">📋 2-Minute Google Client ID Setup Guide:</div>
                  <ol class="gdrive-instructions-list">
                    <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:700;">Google Cloud Console Credentials Page</a>.</li>
                    <li>Create or select any project, then click <strong>Library</strong> and enable <strong>Google Drive API</strong>.</li>
                    <li>Under <strong>Credentials</strong>, click <strong>Create Credentials</strong> → <strong>OAuth client ID</strong>.</li>
                    <li>Select Application type: <strong>Web application</strong>.</li>
                    <li>Under <strong>Authorized JavaScript origins</strong>, click <em>+ ADD URI</em> and paste: <code>${currentOrigin}</code></li>
                    <li>Click <strong>Create</strong>, copy the Client ID string, paste it in the box above, and click <strong>Save & Link</strong>!</li>
                  </ol>
                </div>

                <div class="gdrive-instructions-card" style="margin-top: 12px; border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.05);">
                  <div class="gdrive-instructions-title" style="color: #f59e0b;">⚠️ Fixing "Error 403: access_denied / App not verified":</div>
                  <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 8px 0; line-height: 1.4;">
                    When your Google Cloud app is in <em>Testing</em> mode, Google requires you to add your email address to the authorized test list:
                  </p>
                  <ol class="gdrive-instructions-list">
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:700;">OAuth consent screen</a> in Google Cloud Console.</li>
                    <li>Scroll down to the <strong>Test users</strong> section and click <strong>+ ADD USERS</strong>.</li>
                    <li>Enter your email address (e.g. <code>your-email@gmail.com</code>) and click <strong>SAVE</strong>.</li>
                    <li><em>(To allow all public users)</em>: Under <strong>Publishing status</strong> at the top of that page, click <strong>PUBLISH APP</strong> so any user can link without needing to be added as a tester.</li>
                  </ol>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; border-top: 1px solid var(--border);">
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            🔒 Stored safely in your private "JAM Progress" folder · Zero data saved on external servers
          </span>
          <button type="button" class="btn-test secondary" onclick="window.JAM_GDRIVE_SYNC.closeModal()">Close</button>
        </div>
      </div>
    `;
  }

  function updateUI() {
    updateHeaderButtonUI();
    const modal = document.getElementById('gdrive-sync-modal');
    if (modal && !modal.classList.contains('hidden')) {
      renderModalContent();
    }
  }

  function openModal() {
    const modal = document.getElementById('gdrive-sync-modal');
    if (!modal) return;
    renderModalContent();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('gdrive-sync-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function saveInputClientId() {
    const input = document.getElementById('gdrive-client-id-input');
    if (input) {
      setCustomClientId(input.value);
    }
  }

  function showToast(msg) {
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
      window.JAM_TRACKER.showToast(msg);
    } else {
      console.log('[Google Drive Sync]', msg);
    }
  }

  // --- Public API ---
  window.JAM_GDRIVE_SYNC = {
    init: function() {
      if (window.google?.accounts?.oauth2) {
        initTokenClient();
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.google?.accounts?.oauth2) {
            initTokenClient();
            clearInterval(interval);
          } else if (attempts > 30) {
            clearInterval(interval);
          }
        }, 200);
      }

      updateUI();

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('gdrive-sync-modal');
          if (modal && !modal.classList.contains('hidden')) {
            closeModal();
          }
        }
      });
    },

    openModal: openModal,
    closeModal: closeModal,
    authorize: authorize,
    disconnect: disconnect,
    syncNow: () => performSync(true),
    triggerAutoSync: triggerAutoSync,
    restoreFromDrive: restoreFromDrive,
    openFolderInDrive: openFolderInDrive,
    openFileInDrive: openFileInDrive,
    toggleAutoSync: toggleAutoSync,
    saveInputClientId: saveInputClientId,
    setCustomClientId: setCustomClientId,
    isLinked: isLinked,
    getSyncStatus: () => state.syncStatus
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.JAM_GDRIVE_SYNC.init());
  } else {
    window.JAM_GDRIVE_SYNC.init();
  }

})();
