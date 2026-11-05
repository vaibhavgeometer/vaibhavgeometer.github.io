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
    
    // Baseline Exam Suggestion
    const inferredKey = inferBaselineDifficulty(
      normId,
      fallbackParams.marks,
      fallbackParams.type,
      fallbackParams.qNum || fallbackParams.q_num,
      fallbackParams.year
    );
    const suggestedLevel = DIFFICULTY_LEVELS[inferredKey] || DIFFICULTY_LEVELS.medium;

    // Check User Tag
    const userMap = getUserTrackerData();
    const userRecord = userMap[normId];
    const isUserTagged = !!(userRecord && userRecord.difficulty && DIFFICULTY_LEVELS[userRecord.difficulty]);
    const userLevel = isUserTagged ? DIFFICULTY_LEVELS[userRecord.difficulty] : null;

    const activeLevel = userLevel || suggestedLevel;

    return {
      ...activeLevel,
      id: activeLevel.id,
      key: activeLevel.id,
      isUserTagged: isUserTagged,
      userLevel: userLevel,
      userDifficulty: userRecord?.difficulty || null,
      suggestedLevel: suggestedLevel,
      suggestedDifficulty: inferredKey,
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

  const HIDE_SUGGESTED_KEY = 'jam_hide_suggested_difficulty';

  /**
   * Check if suggested difficulty is hidden across the website
   */
  function isHideSuggested() {
    try {
      return localStorage.getItem(HIDE_SUGGESTED_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Set visibility of suggested difficulty
   */
  function setHideSuggested(shouldHide) {
    try {
      localStorage.setItem(HIDE_SUGGESTED_KEY, shouldHide ? 'true' : 'false');
    } catch (e) {}

    // Apply or remove classes
    if (document.documentElement) {
      document.documentElement.classList.toggle('hide-suggested-difficulty', shouldHide);
    }
    if (document.body) {
      document.body.classList.toggle('hide-suggested-difficulty', shouldHide);
    }

    // Update buttons in DOM
    updateToggleButtonsUI(shouldHide);

    // Notify any active components
    try {
      window.dispatchEvent(new CustomEvent('jam-difficulty-visibility-changed', {
        detail: { hideSuggested: shouldHide }
      }));
    } catch (e) {}

    // If tracker is loaded, re-render question list & modal dropdowns
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.render === 'function') {
      window.JAM_TRACKER.render();
    }

    // If mock test is active, update current question difficulty UI
    if (window.updateCurrentQuestionDifficultyUI) {
      window.updateCurrentQuestionDifficultyUI();
    }
  }

  /**
   * Toggle visibility of suggested difficulty across the website
   */
  function toggleHideSuggested() {
    const next = !isHideSuggested();
    setHideSuggested(next);

    const msg = next
      ? '🙈 Suggested difficulty is now hidden across the website.'
      : '👁️ Suggested difficulty is now visible across the website.';

    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
      window.JAM_TRACKER.showToast(msg);
    } else if (window.showToast) {
      window.showToast(msg);
    }

    return next;
  }

  /**
   * Sync toggle button states across the UI
   */
  function updateToggleButtonsUI(shouldHide) {
    const isHidden = shouldHide !== undefined ? shouldHide : isHideSuggested();

    // 1. Main Tracker Actions Bar Button
    const mainBtn = document.getElementById('btn-toggle-suggested-diff');
    const mainIcon = document.getElementById('btn-toggle-suggested-diff-icon');
    const mainText = document.getElementById('btn-toggle-suggested-diff-text');
    if (mainBtn) {
      if (isHidden) {
        mainBtn.classList.add('active');
        if (mainIcon) mainIcon.textContent = '👁️';
        if (mainText) mainText.textContent = 'Show Suggested Difficulty';
        mainBtn.title = 'Suggested difficulty is currently hidden. Click to show suggested exam difficulty badges.';
      } else {
        mainBtn.classList.remove('active');
        if (mainIcon) mainIcon.textContent = '🙈';
        if (mainText) mainText.textContent = 'Hide Suggested Difficulty';
        mainBtn.title = 'Click to hide all suggested difficulty benchmarks across the whole website.';
      }
    }

    // 2. Mini Toggle Button in Tagged Difficulty row
    const miniBtn = document.getElementById('btn-diff-toggle-mini');
    if (miniBtn) {
      if (isHidden) {
        miniBtn.classList.add('active');
        miniBtn.innerHTML = '👁️ Show Suggested';
        miniBtn.title = 'Suggested difficulty is hidden. Click to show.';
      } else {
        miniBtn.classList.remove('active');
        miniBtn.innerHTML = '🙈 Hide Suggested';
        miniBtn.title = 'Hide suggested difficulty badges.';
      }
    }

    // 3. Mock Test Toggle Button
    const mockBtn = document.getElementById('btn-mock-toggle-diff');
    if (mockBtn) {
      if (isHidden) {
        mockBtn.classList.add('active');
        mockBtn.innerHTML = '👁️ Show Suggested';
      } else {
        mockBtn.classList.remove('active');
        mockBtn.innerHTML = '🙈 Hide Suggested';
      }
    }
  }

  // Pre-apply class to prevent flash of content
  if (isHideSuggested()) {
    if (document.documentElement) {
      document.documentElement.classList.add('hide-suggested-difficulty');
    }
  }

  /**
   * Generate standard HTML badge string
   */
  function getDifficultyBadgeHtml(diffObj, options) {
    options = options || {};
    const isInteractive = !!options.interactive;
    const size = options.size || 'md'; // sm, md, lg
    const sug = diffObj.suggestedLevel || diffObj;
    const isHidden = isHideSuggested();

    if (diffObj.isUserTagged) {
      const sugNote = isHidden ? '' : ` (Suggested: ${sug.label})`;
      return `
        <span class="q-diff-badge ${diffObj.class} size-${size} is-user-tagged ${isInteractive ? 'interactive' : ''}"
              style="background:${diffObj.bg}; color:${diffObj.color}; border:1px solid ${diffObj.border};"
              data-diff="${diffObj.id}"
              title="Your Custom Tag: ${diffObj.label}${sugNote}">
          <span class="diff-icon">${diffObj.icon}</span>
          <span class="diff-text">${diffObj.label} <span class="diff-tag-pill user">★ My Tag</span></span>
        </span>
      `;
    } else {
      if (isHidden) {
        return '';
      }
      return `
        <span class="q-diff-badge ${sug.class} size-${size} is-suggested ${isInteractive ? 'interactive' : ''}"
              style="background:${sug.bg}; color:${sug.color}; border:1px dashed ${sug.border};"
              data-diff="${sug.id}"
              title="Suggested by Exam Benchmark: ${sug.label} • You have not rated this question yet (Unrated)">
          <span class="diff-icon">${sug.icon}</span>
          <span class="diff-text">Suggested: ${sug.label} <span class="diff-tag-pill unrated">(Unrated)</span></span>
        </span>
      `;
    }
  }

  // Initialize state on DOM ready
  function initDifficultyUI() {
    if (isHideSuggested()) {
      if (document.body) {
        document.body.classList.add('hide-suggested-difficulty');
      }
    }
    updateToggleButtonsUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDifficultyUI);
  } else {
    initDifficultyUI();
  }

  // Export to global window scope
  window.JAM_DIFFICULTY = {
    LEVELS: DIFFICULTY_LEVELS,
    inferBaselineDifficulty,
    getDifficulty: getQuestionDifficulty,
    setDifficulty: setQuestionDifficulty,
    getBadgeHtml: getDifficultyBadgeHtml,
    isHideSuggested,
    setHideSuggested,
    toggleHideSuggested,
    updateToggleButtonsUI
  };

  window.getJAMQuestionDifficulty = getQuestionDifficulty;
  window.setJAMQuestionDifficulty = setQuestionDifficulty;

})();

