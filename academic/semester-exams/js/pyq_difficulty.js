/* ============================================
   UNPG B.Sc. Semester V (Mathematics & Physics)
   PYQ Difficulty Classification & User Tagging Engine
   ============================================
   - Separate isolated storage namespace (`sem_pyq_user_tracker_v1`)
   - Supports 5-tier classification: very_easy, easy, medium, hard, hardest
   - User custom difficulty tagging & localStorage persistence
   ============================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'sem_pyq_user_tracker_v1';

  const LEVELS = {
    very_easy: {
      key: 'very_easy',
      label: 'Very Easy',
      shortLabel: 'V. Easy',
      emoji: '🟢',
      color: '#10b981',
      cssClass: 'diff-very-easy',
      order: 1
    },
    easy: {
      key: 'easy',
      label: 'Easy',
      shortLabel: 'Easy',
      emoji: '🔵',
      color: '#06b6d4',
      cssClass: 'diff-easy',
      order: 2
    },
    medium: {
      key: 'medium',
      label: 'Medium',
      shortLabel: 'Medium',
      emoji: '🟡',
      color: '#f59e0b',
      cssClass: 'diff-medium',
      order: 3
    },
    hard: {
      key: 'hard',
      label: 'Hard',
      shortLabel: 'Hard',
      emoji: '🔴',
      color: '#ef4444',
      cssClass: 'diff-hard',
      order: 4
    },
    hardest: {
      key: 'hardest',
      label: 'Very Hard',
      shortLabel: 'Hardest',
      emoji: '🟣',
      color: '#a855f7',
      cssClass: 'diff-hardest',
      order: 5
    }
  };

  const UNRATED_META = {
    key: 'unrated',
    label: 'Unrated',
    shortLabel: 'Unrated',
    emoji: '⚪',
    color: '#94a3b8',
    cssClass: 'diff-unrated',
    order: 0
  };

  const ORDER = ['very_easy', 'easy', 'medium', 'hard', 'hardest'];

  function loadStoreRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.solved || typeof parsed.solved !== 'object') parsed.solved = {};
          if (!parsed.difficulty || typeof parsed.difficulty !== 'object') parsed.difficulty = {};
          return parsed;
        }
      }
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }
    return { solved: {}, difficulty: {}, lastUpdated: null };
  }

  function saveStoreRaw(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Ignore quota errors
    }
  }

  function getUserDifficultyMap() {
    return loadStoreRaw().difficulty || {};
  }

  function saveUserDifficultyMap(diffMap) {
    const store = loadStoreRaw();
    store.difficulty = diffMap || {};
    saveStoreRaw(store);
  }

  function getQuestionDifficulty(q) {
    const qId = typeof q === 'string' ? q : (q && q.id) || '';
    const map = getUserDifficultyMap();
    const userLevel = map[qId];

    if (userLevel && LEVELS[userLevel]) {
      return {
        level: userLevel,
        meta: LEVELS[userLevel],
        source: 'user',
        isUserTagged: true
      };
    }

    return {
      level: 'unrated',
      meta: UNRATED_META,
      source: 'unrated',
      isUserTagged: false
    };
  }

  function setQuestionDifficulty(qId, levelKey) {
    if (!qId) return null;
    const store = loadStoreRaw();
    if (!store.difficulty) store.difficulty = {};

    if (!levelKey || levelKey === 'clear' || levelKey === 'reset' || !LEVELS[levelKey]) {
      delete store.difficulty[qId];
    } else {
      store.difficulty[qId] = levelKey;
    }
    saveStoreRaw(store);

    try {
      window.dispatchEvent(new CustomEvent('sem-difficulty-updated', {
        detail: { qId, level: store.difficulty[qId] || null }
      }));
    } catch (e) {}

    if (window.SEM_CLOUD_SYNC && typeof window.SEM_CLOUD_SYNC.scheduleAutoPush === 'function') {
      window.SEM_CLOUD_SYNC.scheduleAutoPush();
    }

    return getQuestionDifficulty(qId);
  }

  function getAllStats(questions) {
    const list = Array.isArray(questions) ? questions : [];
    const counts = { very_easy: 0, easy: 0, medium: 0, hard: 0, hardest: 0, unrated: 0 };
    const userCounts = { very_easy: 0, easy: 0, medium: 0, hard: 0, hardest: 0 };
    const map = getUserDifficultyMap();

    list.forEach((q) => {
      const userLvl = map[q.id];
      if (userLvl && LEVELS[userLvl]) {
        counts[userLvl]++;
        userCounts[userLvl]++;
      } else {
        counts.unrated++;
      }
    });

    return {
      total: list.length,
      counts,
      userCounts,
      userTotal: Object.keys(map).length
    };
  }

  function getDifficultyBadgeHtml(diffInfo, opts) {
    const options = opts || {};
    const info = diffInfo || { level: 'unrated', meta: UNRATED_META, isUserTagged: false };
    if (!info.isUserTagged) {
      return '';
    }
    const meta = info.meta || LEVELS[info.level] || UNRATED_META;
    const text = options.short ? meta.shortLabel : meta.label;
    const sizeClass = options.size ? `size-${options.size}` : '';

    return `<span class="q-diff-badge ${meta.cssClass} is-user-tagged ${sizeClass}" title="Difficulty: ${meta.label} (My Tag)">` +
      `<span>${meta.emoji} ${text}</span>` +
      (options.hideSourcePill ? '' : `<span class="diff-tag-pill user">My Tag</span>`) +
      `</span>`;
  }

  window.SEM_DIFFICULTY = {
    STORAGE_KEY,
    LEVELS,
    ORDER,
    getUserDifficultyMap,
    saveUserDifficultyMap,
    getQuestionDifficulty,
    setQuestionDifficulty,
    getAllStats,
    getDifficultyBadgeHtml
  };

  window.getSEMQuestionDifficulty = getQuestionDifficulty;
  window.setSEMQuestionDifficulty = setQuestionDifficulty;
})();
