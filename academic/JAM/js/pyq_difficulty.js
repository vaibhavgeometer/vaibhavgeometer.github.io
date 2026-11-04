/**
 * IIT JAM Mathematics (MA) — Unified Question Difficulty Engine
 * Provides standard 5-level difficulty taxonomy, intelligent exam-pattern fallback inference,
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

  /**
   * Intelligently infer baseline difficulty from official IIT JAM examination structure
   * when the student has not yet manually tagged a question.
   */
  function inferBaselineDifficulty(qId, marks, type, qNum, year) {
    const num = parseInt(qNum) || 0;
    const m = parseFloat(marks) || 1;
    const t = String(type || 'MCQ').toUpperCase();
    const yr = parseInt(year) || 2020;

    // CBT Pattern Papers (2015–2026, 60 Questions)
    if (yr >= 2015 && num >= 1 && num <= 60) {
      // Section A: Multiple Choice Questions (Q1 - Q30)
      if (num >= 1 && num <= 10) {
        // 1-Mark MCQ
        if (num <= 5) return 'very_easy';
        return 'easy';
      }
      if (num >= 11 && num <= 30) {
        // 2-Mark MCQ
        if (num <= 20) return 'medium';
        return 'hard';
      }

      // Section B: Multiple Select Questions (Q31 - Q40, 2-Marks each, no partial marks)
      if (num >= 31 && num <= 40) {
        if (num <= 35) return 'hard';
        return 'hardest';
      }

      // Section C: Numerical Answer Type (Q41 - Q60)
      if (num >= 41 && num <= 50) {
        // 1-Mark NAT
        if (num <= 45) return 'easy';
        return 'medium';
      }
      if (num >= 51 && num <= 60) {
        // 2-Mark NAT
        if (num <= 55) return 'hard';
        return 'hardest';
      }
    }

    // Classic Pattern Papers (2005–2014) or General Fallback by Marks & Type
    if (t === 'MSQ') {
      return 'hard';
    }
    if (m >= 6) {
      // Classic 6-mark long subjective question
      return num % 2 === 0 ? 'hardest' : 'hard';
    }
    if (m >= 2) {
      return 'medium';
    }
    return 'easy';
  }

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
    
    // 1. Check User Tag
    const userMap = getUserTrackerData();
    const userRecord = userMap[normId];
    if (userRecord && userRecord.difficulty && DIFFICULTY_LEVELS[userRecord.difficulty]) {
      const level = DIFFICULTY_LEVELS[userRecord.difficulty];
      return {
        ...level,
        key: level.id,
        isUserTagged: true,
        normId: normId
      };
    }

    // 2. Fallback Inference
    const inferredKey = inferBaselineDifficulty(
      normId,
      fallbackParams.marks,
      fallbackParams.type,
      fallbackParams.qNum || fallbackParams.q_num,
      fallbackParams.year
    );
    const level = DIFFICULTY_LEVELS[inferredKey] || DIFFICULTY_LEVELS.medium;

    return {
      ...level,
      key: level.id,
      isUserTagged: false,
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
    const isInteractive = !!options.interactive;
    const size = options.size || 'md'; // sm, md, lg
    const showUserIndicator = options.showUserIndicator !== false;

    const userStar = (diffObj.isUserTagged && showUserIndicator) ? ' <span style="font-size:0.7em; opacity:0.85;" title="Tagged by You">★</span>' : '';

    return `
      <span class="q-diff-badge ${diffObj.class} size-${size} ${isInteractive ? 'interactive' : ''}"
            style="background:${diffObj.bg}; color:${diffObj.color}; border:1px solid ${diffObj.border};"
            data-diff="${diffObj.id}"
            title="${diffObj.label} Difficulty${diffObj.isUserTagged ? ' (Tagged by You)' : ' (Exam Benchmark)'}">
        <span class="diff-icon">${diffObj.icon}</span>
        <span class="diff-text">${diffObj.label}${userStar}</span>
      </span>
    `;
  }

  // Export to global window scope
  window.JAM_DIFFICULTY = {
    LEVELS: DIFFICULTY_LEVELS,
    inferBaselineDifficulty,
    getDifficulty: getQuestionDifficulty,
    setDifficulty: setQuestionDifficulty,
    getBadgeHtml: getDifficultyBadgeHtml
  };

  window.getJAMQuestionDifficulty = getQuestionDifficulty;
  window.setJAMQuestionDifficulty = setQuestionDifficulty;

})();

