/**
 * IIT JAM Mathematics (MA) — Unified Question Difficulty Engine
 * Provides standard 5-level difficulty taxonomy,
 * user localStorage persistence, and cloud auto-sync integration.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'jam_pyq_user_tracker_v1';

  // 5 Canonical Difficulty Levels
  const DIFFICULTY_LEVELS = {
    'very_easy': {
      id: 'very_easy',
      label: 'Very Easy',
      shortLabel: 'V. Easy',
      icon: '🟢',
      order: 1,
      class: 'diff-very-easy',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.35)'
    },
    'easy': {
      id: 'easy',
      label: 'Easy',
      shortLabel: 'Easy',
      icon: '🔵',
      order: 2,
      class: 'diff-easy',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.15)',
      border: 'rgba(6, 182, 212, 0.35)'
    },
    'medium': {
      id: 'medium',
      label: 'Medium',
      shortLabel: 'Medium',
      icon: '🟡',
      order: 3,
      class: 'diff-medium',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.35)'
    },
    'hard': {
      id: 'hard',
      label: 'Hard',
      shortLabel: 'Hard',
      icon: '🟠',
      order: 4,
      class: 'diff-hard',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.35)'
    },
    'hardest': {
      id: 'hardest',
      label: 'Hardest',
      shortLabel: 'Hardest',
      icon: '🟣',
      order: 5,
      class: 'diff-hardest',
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.15)',
      border: 'rgba(168, 85, 247, 0.35)'
    }
  };

  const UNRATED_LEVEL = {
    id: 'unrated',
    label: 'Unrated',
    shortLabel: 'Unrated',
    icon: '⚪',
    order: 0,
    class: 'diff-unrated',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.28)'
  };

  /**
   * Get user tracker questions map from localStorage
   */
  function getUserTrackerData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed && parsed.questions ? parsed.questions : {};
      }
    } catch (e) {
      console.warn('Could not read user tracker data for difficulty:', e);
    }
    return {};
  }

  /**
   * Resolve a clean question ID
   */
  function normalizeQuestionId(qId, year, qNum) {
    if (qId && String(qId).startsWith('JAM_')) return String(qId);
    if (year && qNum) return `JAM_${year}_Q${qNum}`;
    if (qId) return String(qId);
    return 'JAM_UNKNOWN';
  }

  /**
   * Get Question Difficulty
   * @param {string} qId - e.g. "JAM_2026_Q1"
   * @param {object} [fallbackParams] - { marks, type, qNum, year }
   * @returns {object} { id, label, shortLabel, icon, order, class, color, bg, border, isUserTagged }
   */
  function getQuestionDifficulty(qId, fallbackParams) {
    fallbackParams = fallbackParams || {};
    const normId = normalizeQuestionId(qId, fallbackParams.year, fallbackParams.qNum || fallbackParams.q_num);

    // Check User Tag
    const userMap = getUserTrackerData();
    const userRecord = userMap[normId];
    const isUserTagged = !!(userRecord && userRecord.difficulty && DIFFICULTY_LEVELS[userRecord.difficulty]);
    const userLevel = isUserTagged ? DIFFICULTY_LEVELS[userRecord.difficulty] : null;
    const activeLevel = userLevel || UNRATED_LEVEL;

    return {
      ...activeLevel,
      id: activeLevel.id,
      key: activeLevel.id,
      isUserTagged: isUserTagged,
      userLevel: userLevel,
      userDifficulty: isUserTagged ? userRecord.difficulty : null,
      normId: normId
    };
  }

  /**
   * Set Question Difficulty
   * @param {string} qId
   * @param {string} difficultyKey - 'very_easy' | 'easy' | 'medium' | 'hard' | 'hardest' | '' (reset)
   * @param {object} [extraParams]
   */
  function setQuestionDifficulty(qId, difficultyKey, extraParams) {
    extraParams = extraParams || {};
    const normId = normalizeQuestionId(qId, extraParams.year, extraParams.qNum || extraParams.q_num);

    try {
      let data = { questions: {}, oosMarkedUnnecessary: false };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = JSON.parse(raw);
        if (!data.questions) data.questions = {};
      }

      if (!data.questions[normId]) {
        data.questions[normId] = {
          solved: false,
          solvedAt: null,
          difficulty: null,
          unnecessary: false
        };
      }

      const cleanKey = (difficultyKey && DIFFICULTY_LEVELS[difficultyKey]) ? difficultyKey : null;
      data.questions[normId].difficulty = cleanKey;
      data.lastUpdated = new Date().toISOString();

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      // Trigger Cloud Sync if available
      if (window.JAM_CLOUD_SYNC && typeof window.JAM_CLOUD_SYNC.triggerAutoSync === 'function') {
        window.JAM_CLOUD_SYNC.triggerAutoSync();
      }

      // Broadcast event for UI tabs / open windows
      try {
        const event = new CustomEvent('jam-difficulty-updated', {
          detail: {
            qId: normId,
            difficulty: cleanKey,
            level: cleanKey ? DIFFICULTY_LEVELS[cleanKey] : null
          }
        });
        window.dispatchEvent(event);
      } catch (e) {}

      return true;
    } catch (e) {
      console.error('Failed to set question difficulty:', e);
      return false;
    }
  }

  /**
   * Generate standard HTML badge string
   */
  function getDifficultyBadgeHtml(diffObj, options) {
    options = options || {};
    if (!diffObj || !diffObj.isUserTagged) {
      return '';
    }
    const isInteractive = !!options.interactive;
    const size = options.size || 'md'; // sm, md, lg

    return `
      <span class="q-diff-badge ${diffObj.class} size-${size} is-user-tagged ${isInteractive ? 'interactive' : ''}"
            style="background:${diffObj.bg}; color:${diffObj.color}; border:1px solid ${diffObj.border};"
            data-diff="${diffObj.id}"
            title="Your Custom Tag: ${diffObj.label}">
        <span class="diff-icon">${diffObj.icon}</span>
        <span class="diff-text">${diffObj.label} <span class="diff-tag-pill user">★ My Tag</span></span>
      </span>
    `;
  }

  // Export to global window scope
  window.JAM_DIFFICULTY = {
    LEVELS: DIFFICULTY_LEVELS,
    getDifficulty: getQuestionDifficulty,
    setDifficulty: setQuestionDifficulty,
    getBadgeHtml: getDifficultyBadgeHtml
  };

  window.getJAMQuestionDifficulty = getQuestionDifficulty;
  window.setJAMQuestionDifficulty = setQuestionDifficulty;

})();
