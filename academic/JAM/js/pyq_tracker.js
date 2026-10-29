/**
 * IIT JAM Mathematics (MA) — PYQ Tracker, Search & Question Bank Engine
 * Covers all 885 official examination questions (2005–2026)
 * Real-time localStorage persistence, multi-level filters, flexible search & one-click bulk actions
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'jam_pyq_user_tracker_v1';
  const PAGE_SIZE = 24;

  // Semantic query alias mapping for topic / concept searches
  const TOPIC_ALIASES = {
    'differential equation': ['differential equations', 'ode'],
    'differential equations': ['differential equations', 'ode'],
    'ode': ['differential equations'],
    'pde': ['differential equations'],
    'abelian group': ['groups'],
    'abelian groups': ['groups'],
    'group': ['groups'],
    'groups': ['groups'],
    'group theory': ['groups'],
    'permutation': ['groups', 'basic algebra'],
    'cyclic group': ['groups'],
    'matrix': ['matrices'],
    'matrices': ['matrices'],
    'determinant': ['matrices'],
    'eigenvalue': ['matrices'],
    'eigenvalues': ['matrices'],
    'eigen': ['matrices'],
    'vector space': ['finite dimensional vector spaces'],
    'vector spaces': ['finite dimensional vector spaces'],
    'linear algebra': ['matrices', 'finite dimensional vector spaces', 'linear algebra and algebra'],
    'subspace': ['finite dimensional vector spaces'],
    'basis': ['finite dimensional vector spaces'],
    'dimension': ['finite dimensional vector spaces'],
    'real analysis': ['real analysis'],
    'sequence': ['sequences and series of real numbers'],
    'sequences': ['sequences and series of real numbers'],
    'series': ['sequences and series of real numbers'],
    'power series': ['sequences and series of real numbers'],
    'convergence': ['sequences and series of real numbers'],
    'calculus': ['integral calculus', 'functions of one real variable', 'functions of two or three real variables'],
    'integral': ['integral calculus'],
    'integrals': ['integral calculus'],
    'multiple integral': ['integral calculus'],
    'double integral': ['integral calculus'],
    'triple integral': ['integral calculus'],
    'several variables': ['functions of two or three real variables'],
    'multivariable': ['functions of two or three real variables'],
    'partial derivative': ['functions of two or three real variables'],
    'one variable': ['functions of one real variable'],
    'continuity': ['functions of one real variable'],
    'differentiability': ['functions of one real variable'],
    'mean value': ['functions of one real variable'],
    'taylor': ['functions of one real variable'],
    'out of syllabus': ['out of syllabus'],
    'oos': ['out of syllabus'],
    'unnecessary': ['out of syllabus']
  };

  // Subtopic mapping per topic
  const TOPIC_SUBTOPICS_MAP = {
    'Real Analysis': [
      'Sequences and Series of Real Numbers',
      'Functions of One Real Variable'
    ],
    'Multivariable Calculus and Differential Equations': [
      'Differential Equations',
      'Integral Calculus',
      'Functions of Two or Three Real Variables'
    ],
    'Linear Algebra and Algebra': [
      'Matrices',
      'Finite Dimensional Vector Spaces',
      'Groups',
      'Basic algebra'
    ],
    'Out of Syllabus': [
      'Out of Syllabus'
    ]
  };

  // State object
  const state = {
    masterQuestions: [],
    filteredQuestions: [],
    currentPage: 1,
    showAllCards: false,
    activeModalQuestionId: null,
    searchQuery: '',
    selectedYear: 'ALL',
    selectedTopic: 'ALL',
    selectedSubtopic: 'ALL',
    selectedStatus: 'ALL', // ALL | solved | unsolved | unnecessary
    selectedDifficulty: 'ALL', // ALL | very_easy | easy | medium | hard | hardest | unrated
    selectedSort: 'default', // default (year desc, q_num asc) | year_asc | diff_desc | diff_asc
    revealedKeys: new Set(),
    userData: {
      questions: {},
      oosMarkedUnnecessary: false
    }
  };

  // Difficulty metadata
  const DIFFICULTY_CONFIG = {
    'very_easy': { label: 'Very Easy', class: 'diff-very-easy', order: 1, icon: '🟢' },
    'easy': { label: 'Easy', class: 'diff-easy', order: 2, icon: '🔵' },
    'medium': { label: 'Medium', class: 'diff-medium', order: 3, icon: '🟡' },
    'hard': { label: 'Hard', class: 'diff-hard', order: 4, icon: '🟠' },
    'hardest': { label: 'Hardest', class: 'diff-hardest', order: 5, icon: '🟣' }
  };

  // --- Date & Time Formatters for Solved Status ---
  function formatSolvedDateTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const datePart = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart}, ${timePart}`;
    } catch (e) {
      return isoString;
    }
  }

  function formatSolvedTooltip(isoString) {
    if (!isoString) return 'Marked as solved';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Marked as solved';
      return 'Exact solved time: ' + d.toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Exact solved time: ' + isoString;
    }
  }

  // --- Storage Helpers ---
  function loadUserData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.userData = {
          questions: parsed.questions || {},
          oosMarkedUnnecessary: !!parsed.oosMarkedUnnecessary,
          lastUpdated: parsed.lastUpdated || null
        };
      } else {
        state.userData = { questions: {}, oosMarkedUnnecessary: false, lastUpdated: null };
      }
    } catch (e) {
      console.warn('Could not load user tracker data from localStorage:', e);
      state.userData = { questions: {}, oosMarkedUnnecessary: false, lastUpdated: null };
    }
  }

  function saveUserData() {
    try {
      state.userData.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userData));
      if (window.JAM_GDRIVE_SYNC && typeof window.JAM_GDRIVE_SYNC.triggerAutoSync === 'function') {
        window.JAM_GDRIVE_SYNC.triggerAutoSync();
      }
    } catch (e) {
      console.error('Could not save user tracker data to localStorage:', e);
    }
  }

  function getQuestionState(id) {
    return state.userData.questions[id] || { solved: false, solvedAt: null, difficulty: null, unnecessary: false };
  }

  function updateQuestionState(id, partial) {
    if (!state.userData.questions[id]) {
      state.userData.questions[id] = { solved: false, solvedAt: null, difficulty: null, unnecessary: false };
    }
    Object.assign(state.userData.questions[id], partial);
    saveUserData();
  }

  // --- Master Dataset Builder ---
  function initMasterQuestions() {
    if (!window.JAM_CATEGORIZED_DATA || !Array.isArray(window.JAM_CATEGORIZED_DATA)) {
      console.error('JAM_CATEGORIZED_DATA not found. Retrying in 100ms...');
      setTimeout(initMasterQuestions, 100);
      return;
    }

    const mockData = window.MOCK_TESTS_DATA || {};
    state.masterQuestions = window.JAM_CATEGORIZED_DATA.map(q => {
      const yrStr = String(q.year);
      const yrObj = mockData[yrStr];
      const qObj = yrObj ? yrObj.questions.find(x => x.q_num === q.question_number) : null;
      const qId = qObj ? qObj.id : `JAM_${q.year}_Q${q.question_number}`;
      const isOOS = q.topic === 'Out of Syllabus';

      return {
        id: qId,
        year: q.year,
        q_num: q.question_number,
        topic: q.topic,
        sub_topic: q.sub_topic,
        type: qObj ? qObj.type : 'MCQ',
        marks: qObj ? qObj.marks : (q.year < 2015 ? 6 : 1),
        negative_marks: qObj ? qObj.negative_marks : 0,
        image: qObj ? qObj.image : `assets/PYQs_Screenshots/${q.year}/JAM_${q.year}_Q${q.question_number}.png`,
        answer_key: q.answer || (qObj ? qObj.answer_key : 'N/A'),
        explanation: qObj ? qObj.explanation : `<strong>Official Key: ${q.answer}</strong><br>• IIT JAM ${q.year} Mathematics (MA) — Question ${q.question_number}`,
        isOOS: isOOS
      };
    });

    // Populate Subtopic Options
    updateSubtopicDropdown();

    // Compute progress & render
    applyFiltersAndRender();
  }

  // --- Progress Statistics Calculation ---
  function computeProgressStats() {
    const total = state.masterQuestions.length; // 885
    let solvedCount = 0;
    let unnecessaryCount = 0;
    let inSyllabusTotal = 0;
    let inSyllabusSolved = 0;

    const diffCounts = {
      very_easy: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      hardest: 0,
      unrated: 0
    };

    const topicStats = {};
    for (const t of Object.keys(TOPIC_SUBTOPICS_MAP)) {
      topicStats[t] = { total: 0, solved: 0 };
    }

    state.masterQuestions.forEach(q => {
      const u = getQuestionState(q.id);
      const isSolved = !!u.solved;
      const isUnnecessary = !!u.unnecessary;

      if (isSolved) solvedCount++;
      if (isUnnecessary) unnecessaryCount++;

      if (!q.isOOS) {
        inSyllabusTotal++;
        if (isSolved) inSyllabusSolved++;
      }

      if (u.difficulty && diffCounts[u.difficulty] !== undefined) {
        diffCounts[u.difficulty]++;
      } else {
        diffCounts.unrated++;
      }

      if (topicStats[q.topic]) {
        topicStats[q.topic].total++;
        if (isSolved) topicStats[q.topic].solved++;
      }
    });

    const isOOSExcluded = state.userData.oosMarkedUnnecessary;
    const effectiveTotal = isOOSExcluded ? (total - unnecessaryCount) : total;
    const effectiveSolved = isOOSExcluded ? inSyllabusSolved : solvedCount;
    const percentage = effectiveTotal > 0 ? Math.round((effectiveSolved / effectiveTotal) * 100) : 0;
    const exactPercentage = effectiveTotal > 0 ? ((effectiveSolved / effectiveTotal) * 100).toFixed(1) : '0.0';

    return {
      total,
      solvedCount,
      unsolvedCount: total - solvedCount,
      unnecessaryCount,
      inSyllabusTotal,
      inSyllabusSolved,
      effectiveTotal,
      effectiveSolved,
      percentage,
      exactPercentage,
      isOOSExcluded,
      diffCounts,
      topicStats
    };
  }

  function updateProgressUI() {
    const stats = computeProgressStats();

    // Percentage displays
    const pctEl = document.getElementById('tracker-overall-percentage');
    if (pctEl) pctEl.innerHTML = `${stats.percentage}<span style="font-size:1.5rem">%</span>`;

    const barEl = document.getElementById('tracker-overall-bar');
    if (barEl) barEl.style.width = `${stats.percentage}%`;

    // Sub-text & Badge displays
    const exactPctEl = document.getElementById('tracker-exact-percentage');
    if (exactPctEl) {
      if (stats.isOOSExcluded) {
        exactPctEl.textContent = `${stats.inSyllabusSolved} / ${stats.inSyllabusTotal} Core In-Syllabus PYQs (${stats.exactPercentage}%) • 87 Out of Syllabus excluded`;
      } else {
        exactPctEl.textContent = `${stats.solvedCount} / ${stats.total} Total PYQs (${stats.exactPercentage}%)`;
      }
    }

    // Hero Badge & Header Badge
    const heroPill = document.getElementById('hero-progress-pill');
    if (heroPill) heroPill.textContent = `${stats.percentage}% Solved (${stats.solvedCount}/${stats.total})`;

    const navPill = document.getElementById('nav-tracker-progress-pill');
    if (navPill) navPill.textContent = `${stats.percentage}%`;

    // Summary Pills
    const solvedPill = document.getElementById('stat-pill-solved');
    if (solvedPill) solvedPill.textContent = `✓ ${stats.solvedCount} Solved`;

    const unsolvedPill = document.getElementById('stat-pill-unsolved');
    if (unsolvedPill) unsolvedPill.textContent = `○ ${stats.unsolvedCount} Unsolved`;

    const unnecessaryPill = document.getElementById('stat-pill-unnecessary');
    if (unnecessaryPill) unnecessaryPill.textContent = `🚫 ${stats.unnecessaryCount} Unnecessary`;

    // Button state for OOS unnecessary
    const oosBtn = document.getElementById('btn-mark-oos-unnecessary');
    if (oosBtn) {
      if (stats.isOOSExcluded) {
        oosBtn.innerHTML = `<span>🔄</span> <span>Restore Out of Syllabus (87 Qs)</span>`;
        oosBtn.classList.add('accent');
      } else {
        oosBtn.innerHTML = `<span>🚫</span> <span>Mark Out of Syllabus as Unnecessary (87 Qs)</span>`;
        oosBtn.classList.remove('accent');
      }
    }

    // Difficulty Distribution
    const diffContainer = document.getElementById('difficulty-dist-pills');
    if (diffContainer) {
      diffContainer.innerHTML = `
        <span class="difficulty-dist-label">Tagged Difficulty:</span>
        <span class="diff-pill diff-very-easy">🟢 Very Easy: ${stats.diffCounts.very_easy}</span>
        <span class="diff-pill diff-easy">🔵 Easy: ${stats.diffCounts.easy}</span>
        <span class="diff-pill diff-medium">🟡 Medium: ${stats.diffCounts.medium}</span>
        <span class="diff-pill diff-hard">🟠 Hard: ${stats.diffCounts.hard}</span>
        <span class="diff-pill diff-hardest">🟣 Hardest: ${stats.diffCounts.hardest}</span>
        <span class="diff-pill diff-unrated">⚪ Unrated: ${stats.diffCounts.unrated}</span>
      `;
    }

    // Topic Mini-Bars
    const topicContainer = document.getElementById('topic-progress-mini-grid');
    if (topicContainer) {
      topicContainer.innerHTML = Object.entries(stats.topicStats).map(([topicName, ts]) => {
        const pct = ts.total > 0 ? Math.round((ts.solved / ts.total) * 100) : 0;
        const shortName = topicName === 'Multivariable Calculus and Differential Equations'
          ? 'Calculus & ODE'
          : (topicName === 'Linear Algebra and Algebra' ? 'Linear Algebra & Groups' : topicName);
        return `
          <div class="topic-mini-card">
            <div class="topic-mini-header">
              <span class="topic-mini-title" title="${topicName}">${shortName}</span>
              <span>${ts.solved}/${ts.total} (${pct}%)</span>
            </div>
            <div class="topic-mini-bar">
              <div class="topic-mini-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // --- Search & Filter Logic ---
  function parseSearchQuery(query) {
    if (!query) return null;
    const raw = query.trim().toLowerCase();
    if (!raw) return null;

    const clean = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

    // Pattern 1: year + question number (e.g., '2013, Q17', '2005, 7', '2005 7', 'JAM 2013 Q17', '2005 Q6')
    let m = clean.match(/^(?:jam\s+)?(20\d{2})\s*(?:q|question)?\s*(\d{1,2})$/i);
    if (m) {
      return { type: 'year_q', year: parseInt(m[1]), q_num: parseInt(m[2]) };
    }

    // Pattern 2: question number + year (e.g., '7 2005', 'Q17 2013', '17 2005')
    m = clean.match(/^(?:q|question)?\s*(\d{1,2})\s*(?:jam\s+)?(20\d{2})$/i);
    if (m) {
      return { type: 'year_q', year: parseInt(m[2]), q_num: parseInt(m[1]) };
    }

    // Pattern 3: Question ID (e.g., 'JAM_2013_Q17', '2013_Q17')
    m = clean.match(/^(?:jam[_-])?(20\d{2})[_-]q?(\d{1,2})$/i);
    if (m) {
      return { type: 'year_q', year: parseInt(m[1]), q_num: parseInt(m[2]) };
    }

    // Semantic keyword mapping
    const searchTerms = [clean];
    for (const [key, aliases] of Object.entries(TOPIC_ALIASES)) {
      if (clean.includes(key)) {
        searchTerms.push(...aliases);
      }
    }

    return { type: 'text', raw: clean, searchTerms };
  }

  function filterQuestions() {
    const parsedSearch = parseSearchQuery(state.searchQuery);
    let fallbackNotice = null;

    let pool = state.masterQuestions.filter(q => {
      // 1. Year Filter
      if (state.selectedYear !== 'ALL') {
        if (state.selectedYear === 'cbt') {
          if (q.year < 2015) return false;
        } else if (state.selectedYear === 'classic') {
          if (q.year >= 2015) return false;
        } else {
          if (String(q.year) !== state.selectedYear) return false;
        }
      }

      // 2. Topic Filter
      if (state.selectedTopic !== 'ALL' && q.topic !== state.selectedTopic) {
        return false;
      }

      // 3. Subtopic Filter
      if (state.selectedSubtopic !== 'ALL' && q.sub_topic !== state.selectedSubtopic) {
        return false;
      }

      // 4. Status Filter (solved / unsolved / unnecessary)
      const u = getQuestionState(q.id);
      if (state.selectedStatus === 'solved' && !u.solved) return false;
      if (state.selectedStatus === 'unsolved' && u.solved) return false;
      if (state.selectedStatus === 'unnecessary' && !u.unnecessary) return false;

      // 5. Difficulty Filter
      if (state.selectedDifficulty !== 'ALL') {
        if (state.selectedDifficulty === 'unrated') {
          if (u.difficulty) return false;
        } else {
          if (u.difficulty !== state.selectedDifficulty) return false;
        }
      }

      return true;
    });

    // 6. Search Query Filter
    if (parsedSearch) {
      if (parsedSearch.type === 'year_q') {
        // Direct target match: Year and Question Number
        const exactMatch = pool.filter(q => q.year === parsedSearch.year && q.q_num === parsedSearch.q_num);
        if (exactMatch.length > 0) {
          pool = exactMatch;
        } else {
          // If question number doesn't exist for that specific year (e.g. 2013 Q17, since 2013 paper only had 10 questions)
          const allQuestionsForYear = state.masterQuestions.filter(q => q.year === parsedSearch.year);
          const maxQ = allQuestionsForYear.length > 0 ? Math.max(...allQuestionsForYear.map(x => x.q_num)) : 0;
          fallbackNotice = `Note: Question ${parsedSearch.q_num} does not exist in IIT JAM ${parsedSearch.year} (that paper only contains Q1 to Q${maxQ}). Displaying all questions from JAM ${parsedSearch.year} and Question ${parsedSearch.q_num} from other exam papers.`;

          pool = pool.filter(q => q.year === parsedSearch.year || q.q_num === parsedSearch.q_num);
        }
      } else {
        // Text search across topic, subtopic, id, year, explanation, answer key
        const terms = parsedSearch.searchTerms;
        pool = pool.filter(q => {
          const tLow = q.topic.toLowerCase();
          const sLow = q.sub_topic.toLowerCase();
          const idLow = q.id.toLowerCase();
          const yrLow = String(q.year);
          const qNumLow = `q${q.q_num}`;
          const typeLow = q.type.toLowerCase();

          return terms.some(term => {
            return tLow.includes(term) ||
                   sLow.includes(term) ||
                   idLow.includes(term) ||
                   yrLow === term ||
                   qNumLow === term ||
                   typeLow === term;
          });
        });
      }
    }

    // 7. Sorting
    if (state.selectedSort === 'year_asc') {
      pool.sort((a, b) => (a.year - b.year) || (a.q_num - b.q_num));
    } else if (state.selectedSort === 'recently_solved') {
      pool.sort((a, b) => {
        const sa = getQuestionState(a.id);
        const sb = getQuestionState(b.id);
        const timeA = (sa.solved && sa.solvedAt) ? new Date(sa.solvedAt).getTime() : 0;
        const timeB = (sb.solved && sb.solvedAt) ? new Date(sb.solvedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return (b.year - a.year) || (a.q_num - b.q_num);
      });
    } else if (state.selectedSort === 'diff_desc') {
      pool.sort((a, b) => {
        const da = DIFFICULTY_CONFIG[getQuestionState(a.id).difficulty]?.order || 0;
        const db = DIFFICULTY_CONFIG[getQuestionState(b.id).difficulty]?.order || 0;
        return (db - da) || (b.year - a.year) || (a.q_num - b.q_num);
      });
    } else if (state.selectedSort === 'diff_asc') {
      pool.sort((a, b) => {
        const da = DIFFICULTY_CONFIG[getQuestionState(a.id).difficulty]?.order || 99;
        const db = DIFFICULTY_CONFIG[getQuestionState(b.id).difficulty]?.order || 99;
        return (da - db) || (b.year - a.year) || (a.q_num - b.q_num);
      });
    } else {
      // Default: Year Descending, Q Number Ascending
      pool.sort((a, b) => (b.year - a.year) || (a.q_num - b.q_num));
    }

    state.filteredQuestions = pool;
    state.currentNotice = fallbackNotice;
  }

  // --- Render Questions Grid ---
  function renderQuestionCard(q) {
    const userState = getQuestionState(q.id);
    const isSolved = !!userState.solved;
    const isUnnecessary = !!userState.unnecessary;
    const currentDiff = userState.difficulty || '';
    const isRevealed = state.revealedKeys.has(q.id);

    const qType = (q.type || 'MCQ').toUpperCase();
    const typeClass = qType.toLowerCase();

    return `
      <div class="q-tracker-card ${isSolved ? 'is-solved' : ''} ${isUnnecessary ? 'is-unnecessary' : ''}" id="card-${q.id}" data-id="${q.id}">
        <!-- Header -->
        <div class="q-card-header">
          <div class="q-header-left">
            <span class="q-id-pill">${q.id.replace('JAM_', '')}</span>
            <span class="q-year-label">JAM ${q.year} • Q${q.q_num}</span>
          </div>
          <div class="q-header-right">
            <span class="q-type-badge ${typeClass}">${qType}</span>
            <span class="q-marks-pill">+${q.marks}M</span>
          </div>
        </div>

        <!-- Tags -->
        <div class="q-card-tags">
          <span class="q-topic-tag" title="${q.sub_topic}">📂 ${q.sub_topic}</span>
          ${isSolved ? `<span class="q-solved-date-tag" title="${formatSolvedTooltip(userState.solvedAt)}">🕒 Solved${userState.solvedAt ? ': ' + formatSolvedDateTime(userState.solvedAt) : ''}</span>` : ''}
          ${q.isOOS ? '<span class="q-oos-tag">⚠️ Out of Syllabus</span>' : ''}
          ${isUnnecessary ? '<span class="q-oos-tag" style="background:rgba(245,158,11,0.2);color:#f59e0b;border-color:rgba(245,158,11,0.4);">🚫 Unnecessary</span>' : ''}
        </div>

        <!-- Question Screenshot -->
        <div class="q-card-image-wrap" onclick="window.JAM_TRACKER.openModal('${q.id}')" title="Click to view full-resolution question in modal">
          <img src="${q.image}" alt="${q.id}" class="q-card-image" loading="lazy" onerror="this.onerror=null; this.src='assets/PYQs_Screenshots/2026/JAM_2026_Q1.png';">
          <div class="q-zoom-hint">🔍 Expand</div>
        </div>

        <!-- Footer / Interactive Controls -->
        <div class="q-card-footer">
          <div class="q-controls-row">
            <!-- Solved / Unsolved Toggle -->
            <button class="btn-toggle-solved ${isSolved ? 'active' : ''}" onclick="window.JAM_TRACKER.toggleSolved('${q.id}')" title="Mark this question as solved or unsolved">
              ${isSolved ? '✓ Solved' : '○ Mark Solved'}
            </button>

            <!-- Difficulty Tag Selector -->
            <select class="q-diff-select" onchange="window.JAM_TRACKER.setDifficulty('${q.id}', this.value)" title="Tag question difficulty">
              <option value="" ${!currentDiff ? 'selected' : ''}>🏷️ Difficulty</option>
              <option value="very_easy" ${currentDiff === 'very_easy' ? 'selected' : ''}>🟢 Very Easy</option>
              <option value="easy" ${currentDiff === 'easy' ? 'selected' : ''}>🔵 Easy</option>
              <option value="medium" ${currentDiff === 'medium' ? 'selected' : ''}>🟡 Medium</option>
              <option value="hard" ${currentDiff === 'hard' ? 'selected' : ''}>🟠 Hard</option>
              <option value="hardest" ${currentDiff === 'hardest' ? 'selected' : ''}>🟣 Hardest</option>
            </select>
          </div>

          ${isSolved ? `
            <div class="q-solved-meta-row" title="${formatSolvedTooltip(userState.solvedAt)}">
              <span class="q-solved-meta-icon">✓</span>
              <span class="q-solved-meta-text">Solved: <strong>${userState.solvedAt ? formatSolvedDateTime(userState.solvedAt) : 'Yes'}</strong></span>
            </div>
          ` : ''}

          <div class="q-extra-row">
            <div>
              <button class="btn-reveal-key" onclick="window.JAM_TRACKER.toggleAnswerKey('${q.id}')">
                ${isRevealed ? '🙈 Hide Key' : '🔑 Show Key'}
              </button>
              <span class="q-answer-display ${isRevealed ? 'revealed' : ''}">: ${q.answer_key}</span>
            </div>
            <a href="mock-test/test.html?year=${q.year}" target="_blank" class="q-cbt-link" title="Open CBT Mock Test for JAM ${q.year}">
              💻 Open Paper
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function renderGrid() {
    const container = document.getElementById('tracker-questions-container');
    const countEl = document.getElementById('tracker-results-count');
    const noticeEl = document.getElementById('tracker-results-notice');
    if (!container) return;

    const list = state.filteredQuestions;
    const totalCount = list.length;

    // Notice for special searches (e.g. 2013 Q17)
    if (noticeEl) {
      if (state.currentNotice) {
        noticeEl.innerHTML = `<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:10px 14px;border-radius:6px;font-size:0.85rem;color:#f59e0b;margin-bottom:14px;">⚠️ ${state.currentNotice}</div>`;
        noticeEl.classList.remove('hidden');
      } else {
        noticeEl.innerHTML = '';
        noticeEl.classList.add('hidden');
      }
    }

    if (countEl) {
      countEl.innerHTML = `Showing <strong>${totalCount}</strong> of <strong>${state.masterQuestions.length}</strong> official PYQs`;
    }

    if (totalCount === 0) {
      container.innerHTML = `
        <div class="tracker-empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No Matching Questions Found</div>
          <p class="empty-state-desc">No questions match your current query or filter combinations. Try clearing your search, selecting "All Topics", or resetting filters.</p>
          <button class="tracker-action-btn accent" onclick="window.JAM_TRACKER.resetFilters()">Clear All Filters</button>
        </div>
      `;
      renderPagination(0);
      return;
    }

    // Pagination slice
    let displayList = list;
    if (!state.showAllCards) {
      const startIndex = (state.currentPage - 1) * PAGE_SIZE;
      const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);
      displayList = list.slice(startIndex, endIndex);
    }

    container.innerHTML = displayList.map(renderQuestionCard).join('');
    renderPagination(totalCount);
  }

  function renderPagination(totalCount) {
    const container = document.getElementById('tracker-pagination-container');
    if (!container) return;

    if (state.showAllCards || totalCount <= PAGE_SIZE) {
      if (state.showAllCards && totalCount > PAGE_SIZE) {
        container.innerHTML = `
          <button class="page-btn" onclick="window.JAM_TRACKER.toggleShowAll(false)">📄 Paginate (24 per page)</button>
          <span class="page-info-text">Showing all ${totalCount} questions</span>
        `;
      } else {
        container.innerHTML = '';
      }
      return;
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const curr = state.currentPage;

    let html = `
      <button class="page-btn" onclick="window.JAM_TRACKER.goToPage(${curr - 1})" ${curr <= 1 ? 'disabled' : ''}>← Prev</button>
      <span class="page-info-text">Page <strong>${curr}</strong> of <strong>${totalPages}</strong></span>
      <button class="page-btn" onclick="window.JAM_TRACKER.goToPage(${curr + 1})" ${curr >= totalPages ? 'disabled' : ''}>Next →</button>
      <button class="page-btn" onclick="window.JAM_TRACKER.toggleShowAll(true)" style="margin-left:12px;">📑 Show All (${totalCount})</button>
    `;

    container.innerHTML = html;
  }

  // Update dynamic subtopic dropdown based on chosen topic
  function updateSubtopicDropdown() {
    const subSelect = document.getElementById('filter-subtopic-select');
    if (!subSelect) return;

    const topic = state.selectedTopic;
    let options = '<option value="ALL">All Subtopics</option>';

    if (topic !== 'ALL' && TOPIC_SUBTOPICS_MAP[topic]) {
      TOPIC_SUBTOPICS_MAP[topic].forEach(st => {
        options += `<option value="${st}">${st}</option>`;
      });
    } else {
      // All Subtopics across all topics
      const allSubtopics = new Set();
      Object.values(TOPIC_SUBTOPICS_MAP).forEach(list => list.forEach(s => allSubtopics.add(s)));
      allSubtopics.forEach(st => {
        options += `<option value="${st}">${st}</option>`;
      });
    }

    subSelect.innerHTML = options;
    subSelect.value = state.selectedSubtopic;
  }

  function applyFiltersAndRender() {
    filterQuestions();
    updateProgressUI();
    renderGrid();
  }

  // --- Modal Screenshot Viewer ---
  function openQuestionModal(id) {
    const q = state.masterQuestions.find(x => x.id === id);
    if (!q) return;

    state.activeModalQuestionId = id;
    const modal = document.getElementById('tracker-question-modal');
    const userState = getQuestionState(q.id);
    const isSolved = !!userState.solved;
    const isRevealed = state.revealedKeys.has(q.id);

    if (modal) {
      modal.innerHTML = `
        <div class="q-modal-overlay" onclick="window.JAM_TRACKER.closeModal(event)">
          <div class="q-modal-dialog" onclick="event.stopPropagation()">
            <div class="q-modal-header">
              <div class="q-modal-title">
                <span class="q-id-pill">${q.id.replace('JAM_', '')}</span>
                <span>IIT JAM ${q.year} • Question ${q.q_num}</span>
              </div>
              <button class="q-modal-close-btn" onclick="window.JAM_TRACKER.closeModal()" title="Close (Esc)">✕</button>
            </div>
            <div class="q-modal-body">
              <img src="${q.image}" alt="${q.id}" class="q-modal-img">
            </div>
            <div class="q-modal-footer">
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <button class="btn-toggle-solved ${isSolved ? 'active' : ''}" onclick="window.JAM_TRACKER.toggleSolved('${q.id}'); window.JAM_TRACKER.openModal('${q.id}');">
                  ${isSolved ? '✓ Solved' : '○ Mark Solved'}
                </button>
                <select class="q-diff-select" onchange="window.JAM_TRACKER.setDifficulty('${q.id}', this.value); window.JAM_TRACKER.openModal('${q.id}');">
                  <option value="" ${!userState.difficulty ? 'selected' : ''}>🏷️ Difficulty</option>
                  <option value="very_easy" ${userState.difficulty === 'very_easy' ? 'selected' : ''}>🟢 Very Easy</option>
                  <option value="easy" ${userState.difficulty === 'easy' ? 'selected' : ''}>🔵 Easy</option>
                  <option value="medium" ${userState.difficulty === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                  <option value="hard" ${userState.difficulty === 'hard' ? 'selected' : ''}>🟠 Hard</option>
                  <option value="hardest" ${userState.difficulty === 'hardest' ? 'selected' : ''}>🟣 Hardest</option>
                </select>
                <button class="btn-reveal-key" onclick="window.JAM_TRACKER.toggleAnswerKey('${q.id}'); window.JAM_TRACKER.openModal('${q.id}');">
                  ${isRevealed ? '🙈 Hide Key' : '🔑 Show Key'}
                </button>
                <span class="q-answer-display ${isRevealed ? 'revealed' : ''}">: ${q.answer_key}</span>
                ${isSolved ? `
                  <span class="q-modal-solved-badge" title="${formatSolvedTooltip(userState.solvedAt)}">
                    <span style="color:#10b981;font-weight:700;">✓ Solved:</span>
                    <strong>${userState.solvedAt ? formatSolvedDateTime(userState.solvedAt) : 'Yes'}</strong>
                  </span>
                ` : ''}
              </div>
              <div class="q-modal-nav-btns">
                <button class="page-btn" onclick="window.JAM_TRACKER.modalNavigate(-1)">← Previous</button>
                <button class="page-btn" onclick="window.JAM_TRACKER.modalNavigate(1)">Next →</button>
              </div>
            </div>
          </div>
        </div>
      `;
      modal.classList.remove('hidden');
    }
  }

  function closeModal(event) {
    if (event && event.target && !event.target.classList.contains('q-modal-overlay')) {
      return;
    }
    const modal = document.getElementById('tracker-question-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
    state.activeModalQuestionId = null;
  }

  function modalNavigate(direction) {
    if (!state.activeModalQuestionId) return;
    const currentList = state.filteredQuestions.length > 0 ? state.filteredQuestions : state.masterQuestions;
    const idx = currentList.findIndex(x => x.id === state.activeModalQuestionId);
    if (idx !== -1) {
      let nextIdx = idx + direction;
      if (nextIdx < 0) nextIdx = currentList.length - 1;
      if (nextIdx >= currentList.length) nextIdx = 0;
      openQuestionModal(currentList[nextIdx].id);
    }
  }

  // Toast notification helper
  function showToast(msg) {
    const existing = document.querySelector('.tracker-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'tracker-toast';
    toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Public API ---
  window.JAM_TRACKER = {
    init: function() {
      loadUserData();
      initMasterQuestions();

      // Keyboard listeners for modal
      document.addEventListener('keydown', (e) => {
        if (!state.activeModalQuestionId) return;
        if (e.key === 'Escape') closeModal();
        else if (e.key === 'ArrowLeft') modalNavigate(-1);
        else if (e.key === 'ArrowRight') modalNavigate(1);
      });
    },

    toggleSolved: function(id) {
      const curr = getQuestionState(id);
      const nextSolved = !curr.solved;
      const now = new Date().toISOString();
      updateQuestionState(id, {
        solved: nextSolved,
        solvedAt: nextSolved ? now : null
      });
      applyFiltersAndRender();
      if (window.JAM_LOGGER) {
        const q = state.masterQuestions.find(x => x.id === id);
        const meta = q ? ` (${q.year} Q${q.q_num} • ${q.sub_topic})` : '';
        window.JAM_LOGGER.logAction(nextSolved ? 'SOLVED' : 'UNSOLVED', `Question ${id.replace('JAM_', '')}${meta} marked as ${nextSolved ? 'Solved' : 'Unsolved'}`);
      }
      showToast(nextSolved ? `Question ${id.replace('JAM_', '')} marked as Solved!` : `Question ${id.replace('JAM_', '')} marked Unsolved`);
    },

    setDifficulty: function(id, diff) {
      updateQuestionState(id, { difficulty: diff || null });
      applyFiltersAndRender();
      if (window.JAM_LOGGER) {
        const label = DIFFICULTY_CONFIG[diff]?.label || diff || 'Unrated';
        window.JAM_LOGGER.logAction('DIFFICULTY', `Question ${id.replace('JAM_', '')} tagged as ${label}`);
      }
      if (diff) {
        showToast(`Tagged as ${DIFFICULTY_CONFIG[diff]?.label || diff}`);
      }
    },

    toggleAnswerKey: function(id) {
      const nextShow = !state.revealedKeys.has(id);
      if (state.revealedKeys.has(id)) {
        state.revealedKeys.delete(id);
      } else {
        state.revealedKeys.add(id);
      }
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('ANSWER_KEY', `${nextShow ? 'Revealed' : 'Hid'} answer key for Question ${id.replace('JAM_', '')}`);
      }
      renderGrid();
    },

    openModal: function(id) {
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('MODAL_OPEN', `Expanded high-res screenshot modal for Question ${id.replace('JAM_', '')}`);
      }
      openQuestionModal(id);
    },

    closeModal: function(e) {
      closeModal(e);
    },

    modalNavigate: function(dir) {
      modalNavigate(dir);
    },

    // Demand 2: Mark all out of syllabus questions as unnecessary
    markAllOOSAsUnnecessary: function() {
      const nextVal = !state.userData.oosMarkedUnnecessary;
      state.userData.oosMarkedUnnecessary = nextVal;

      state.masterQuestions.forEach(q => {
        if (q.isOOS) {
          if (!state.userData.questions[q.id]) {
            state.userData.questions[q.id] = { solved: false, solvedAt: null, difficulty: null, unnecessary: false };
          }
          state.userData.questions[q.id].unnecessary = nextVal;
        }
      });

      saveUserData();
      applyFiltersAndRender();
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('BULK_OOS', nextVal ? 'Marked all 87 Out-of-Syllabus questions as Unnecessary' : 'Restored Out-of-Syllabus questions to regular pool');
      }
      showToast(nextVal ? 'All 87 Out of Syllabus questions marked as Unnecessary!' : 'Out of Syllabus questions restored to regular pool');
    },

    // Demand 2: Mark all questions of a particular topic or subtopic as solved or not solved in one click
    bulkMarkFiltered: function(isSolved) {
      const list = state.filteredQuestions;
      if (list.length === 0) {
        alert('No questions currently filtered to mark.');
        return;
      }

      const actionWord = isSolved ? 'Solved' : 'Unsolved';
      const count = list.length;
      if (!confirm(`Are you sure you want to mark all ${count} currently filtered questions as ${actionWord}?`)) {
        return;
      }

      const now = new Date().toISOString();
      list.forEach(q => {
        if (!state.userData.questions[q.id]) {
          state.userData.questions[q.id] = { solved: false, solvedAt: null, difficulty: null, unnecessary: false };
        }
        state.userData.questions[q.id].solved = isSolved;
        state.userData.questions[q.id].solvedAt = isSolved ? (state.userData.questions[q.id].solvedAt || now) : null;
      });

      saveUserData();
      applyFiltersAndRender();
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('BULK_MARK', `Bulk marked ${count} filtered questions as ${actionWord}`);
      }
      showToast(`Marked ${count} questions as ${actionWord}!`);
    },

    // Reset all progress
    resetAllProgress: function() {
      if (!confirm('⚠️ Are you sure you want to reset all your progress, solved statuses, and difficulty tags? This cannot be undone.')) {
        return;
      }
      state.userData = { questions: {}, oosMarkedUnnecessary: false };
      saveUserData();
      applyFiltersAndRender();
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('RESET', 'Reset all user tracker progress and difficulty tags to 0%');
      }
      showToast('All progress has been reset to 0%.');
    },

    // Export progress as JSON file
    exportProgress: function() {
      const exportPayload = {
        app: 'IIT_JAM_Mathematics_MA_PYQ_Tracker',
        version: '1.2',
        exportedAt: new Date().toISOString(),
        lastUpdated: state.userData.lastUpdated || new Date().toISOString(),
        oosMarkedUnnecessary: !!state.userData.oosMarkedUnnecessary,
        questions: state.userData.questions || {}
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'IIT_JAM_MA_My_PYQ_Progress.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('EXPORT', 'Exported local progress JSON backup');
      }
      showToast('Progress exported successfully!');
    },

    // Import progress from JSON file
    importProgress: function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            if (parsed && typeof parsed.questions === 'object') {
              state.userData = {
                questions: parsed.questions,
                oosMarkedUnnecessary: !!parsed.oosMarkedUnnecessary,
                lastUpdated: parsed.lastUpdated || new Date().toISOString()
              };
              saveUserData();
              applyFiltersAndRender();
              if (window.JAM_LOGGER) {
                window.JAM_LOGGER.logAction('IMPORT', `Imported progress JSON backup (${Object.keys(parsed.questions).length} questions)`);
              }
              showToast('Progress successfully imported!');
            } else {
              alert('Invalid progress JSON structure.');
            }
          } catch (err) {
            alert('Could not parse JSON file: ' + err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },

    // Filter Handlers
    onSearchInput: function(val) {
      state.searchQuery = val || '';
      state.currentPage = 1;

      const clearBtn = document.getElementById('tracker-search-clear-btn');
      if (clearBtn) {
        if (state.searchQuery) clearBtn.classList.add('visible');
        else clearBtn.classList.remove('visible');
      }

      if (window.JAM_LOGGER && state.searchQuery.trim().length >= 2) {
        window.JAM_LOGGER.logAction('SEARCH', `Search query: "${state.searchQuery.trim()}"`);
      }

      applyFiltersAndRender();
    },

    setSearchChip: function(query) {
      const input = document.getElementById('tracker-search-input');
      if (input) input.value = query;

      const heroInput = document.getElementById('hero-quick-search-input');
      if (heroInput) heroInput.value = query;

      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('SEARCH_CHIP', `Selected search chip: "${query}"`);
      }

      this.onSearchInput(query);
    },

    clearSearch: function() {
      const input = document.getElementById('tracker-search-input');
      if (input) input.value = '';

      const heroInput = document.getElementById('hero-quick-search-input');
      if (heroInput) heroInput.value = '';

      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('SEARCH_CLEAR', 'Cleared search input');
      }

      this.onSearchInput('');
    },

    onYearChange: function(val) {
      state.selectedYear = val;
      state.currentPage = 1;
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('FILTER_YEAR', `Year filter changed to: ${val}`);
      }
      applyFiltersAndRender();
    },

    onTopicChange: function(val) {
      state.selectedTopic = val;
      state.selectedSubtopic = 'ALL';
      state.currentPage = 1;
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('FILTER_TOPIC', `Topic filter changed to: "${val}"`);
      }
      updateSubtopicDropdown();
      applyFiltersAndRender();
    },

    onSubtopicChange: function(val) {
      state.selectedSubtopic = val;
      state.currentPage = 1;
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('FILTER_SUBTOPIC', `Subtopic filter changed to: "${val}"`);
      }
      applyFiltersAndRender();
    },

    onStatusChange: function(val) {
      state.selectedStatus = val;
      state.currentPage = 1;
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('FILTER_STATUS', `Status filter changed to: ${val}`);
      }
      applyFiltersAndRender();
    },

    onDifficultyChange: function(val) {
      state.selectedDifficulty = val;
      state.currentPage = 1;
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('FILTER_DIFFICULTY', `Difficulty filter changed to: ${val}`);
      }
      applyFiltersAndRender();
    },

    onSortChange: function(val) {
      state.selectedSort = val;
      state.currentPage = 1;
      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('SORT_CHANGE', `Sort order changed to: ${val}`);
      }
      applyFiltersAndRender();
    },

    resetFilters: function() {
      state.searchQuery = '';
      state.selectedYear = 'ALL';
      state.selectedTopic = 'ALL';
      state.selectedSubtopic = 'ALL';
      state.selectedStatus = 'ALL';
      state.selectedDifficulty = 'ALL';
      state.selectedSort = 'default';
      state.currentPage = 1;

      if (window.JAM_LOGGER) {
        window.JAM_LOGGER.logAction('FILTER_RESET', 'Cleared all filters and reset to default view');
      }

      const searchInput = document.getElementById('tracker-search-input');
      if (searchInput) searchInput.value = '';

      const yrSelect = document.getElementById('filter-year-select');
      if (yrSelect) yrSelect.value = 'ALL';

      const topSelect = document.getElementById('filter-topic-select');
      if (topSelect) topSelect.value = 'ALL';

      const subSelect = document.getElementById('filter-subtopic-select');
      if (subSelect) subSelect.value = 'ALL';

      const statSelect = document.getElementById('filter-status-select');
      if (statSelect) statSelect.value = 'ALL';

      const diffSelect = document.getElementById('filter-diff-select');
      if (diffSelect) diffSelect.value = 'ALL';

      const sortSelect = document.getElementById('filter-sort-select');
      if (sortSelect) sortSelect.value = 'default';

      updateSubtopicDropdown();
      applyFiltersAndRender();
    },

    // Navigation and Pagination
    goToPage: function(page) {
      state.currentPage = page;
      renderGrid();
      const target = document.getElementById('tracker-bulk-ribbon');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    toggleShowAll: function(val) {
      state.showAllCards = !!val;
      renderGrid();
    },

    // Switch to tracker tab and optional search query
    jumpToTracker: function(searchQuery) {
      // Find tab button
      const btn = document.getElementById('tab-btn-pyq-tracker');
      if (window.switchMainTab) {
        window.switchMainTab('pyq-tracker', btn);
      }

      if (typeof searchQuery === 'string' && searchQuery.trim()) {
        const input = document.getElementById('tracker-search-input');
        if (input) input.value = searchQuery.trim();
        this.onSearchInput(searchQuery.trim());
      }

      // Smooth scroll to tracker panel
      setTimeout(() => {
        const panel = document.getElementById('tab-panel-pyq-tracker');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    },

    // Data exchange & helper hooks for Google Drive sync
    getUserData: function() {
      return state.userData;
    },

    loadUserDataFromBackup: function(backupData) {
      if (!backupData || typeof backupData.questions !== 'object') {
        throw new Error('Invalid backup data structure');
      }
      state.userData = {
        questions: backupData.questions,
        oosMarkedUnnecessary: !!backupData.oosMarkedUnnecessary,
        lastUpdated: backupData.lastUpdated || new Date().toISOString()
      };
      saveUserData();
      applyFiltersAndRender();
      showToast('Progress successfully restored from backup!');
    },

    formatSolvedDateTime: formatSolvedDateTime,
    formatSolvedTooltip: formatSolvedTooltip,
    showToast: showToast
  };

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    window.JAM_TRACKER.init();
  });

})();
