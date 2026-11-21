/**
 * UNPG Padrauna & DDUGU Semester Exams Mock Test - Core Test Engine
 * Screenshot-First Question Display with Interactive MCQ (A, B, C, D) Option Selectors
 */

(function() {
  const state = {
    testId: 'MAT301F_2024-25',
    test: null,
    currentIndex: 0,
    responses: {},       // { [index]: "A" | "B" | "C" | "D" }
    status: {},          // { [index]: "not_visited" | "not_answered" | "answered" | "review" | "ans_review" }
    timeRemaining: 0,    // in seconds
    timerInterval: null,
    filter: 'ALL',
    isSubmitted: false,
    mode: 'official',    // 'official' or 'practice'
    startTime: 0
  };

  // Initialize Engine
  function init() {
    state.startTime = Date.now();
    const urlParams = new URLSearchParams(window.location.search);
    const paramTest = urlParams.get('test') || urlParams.get('topic') || urlParams.get('id');
    const paramCourse = urlParams.get('course');
    const paramYear = urlParams.get('year');
    const paramMode = urlParams.get('mode') || 'official';
    
    let resolvedId = paramTest;
    if (!resolvedId && paramCourse && paramYear) {
      resolvedId = `${paramCourse}_${paramYear}`;
    }
    if (!resolvedId) {
      resolvedId = 'MAT301F_2024-25';
    }

    state.testId = resolvedId;
    state.mode = paramMode;

    if (state.testId === 'custom') {
      try {
        const customJson = sessionStorage.getItem('semester_custom_test');
        if (customJson) {
          state.test = JSON.parse(customJson);
        }
      } catch (e) {
        console.error('Error parsing custom test from sessionStorage:', e);
      }
    }

    if (!state.test) {
      if (window.MOCK_TESTS_DATA && window.MOCK_TESTS_DATA[state.testId]) {
        state.test = window.MOCK_TESTS_DATA[state.testId];
      } else if (window.MOCK_TESTS_DATA) {
        // Fallback to first available test
        const firstKey = Object.keys(window.MOCK_TESTS_DATA)[0];
        if (firstKey) {
          state.testId = firstKey;
          state.test = window.MOCK_TESTS_DATA[firstKey];
        }
      }
    }

    if (!state.test || !state.test.questions || state.test.questions.length === 0) {
      alert('Unable to load test paper. Redirecting to Semester Exams Portal.');
      window.location.href = '../index.html';
      return;
    }
    
    // Set initial question statuses
    for (let i = 0; i < state.test.questions.length; i++) {
      state.status[i] = 'not_visited';
      state.responses[i] = null;
    }

    // Set first question as visited
    state.status[0] = 'not_answered';

    // Set timer duration
    state.timeRemaining = (state.test.duration_minutes || 90) * 60;
    if (state.mode === 'practice') {
      state.timeRemaining = 0; // untimed count-up
    }

    // Update Header Meta
    const titleEl = document.getElementById('exam-topic-title');
    const subEl = document.getElementById('exam-topic-sub');
    if (titleEl) titleEl.innerText = state.test.name;
    if (subEl) {
      const qCount = state.test.total_questions || state.test.questions.length;
      const marksCount = state.test.total_marks || (qCount * 1.5);
      const minsCount = state.test.duration_minutes || 90;
      subEl.innerText = `${qCount} MCQs • ${marksCount} Marks • ${minsCount} Mins • ${state.mode === 'practice' ? 'Practice Mode' : 'Official CBT'}`;
    }

    // Start Timer
    startTimer();

    // Render First Question and Question Palette
    renderQuestion();
    renderPalette();
    updateSummaryStats();

    // Setup Theme
    const savedTheme = localStorage.getItem('jam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();

    // Setup Keyboard Shortcuts
    setupKeyboardShortcuts();
  }

  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    
    const timerBox = document.getElementById('exam-timer');

    state.timerInterval = setInterval(() => {
      if (state.isSubmitted) {
        clearInterval(state.timerInterval);
        return;
      }

      if (state.mode === 'official') {
        if (state.timeRemaining > 0) {
          state.timeRemaining--;
        } else {
          clearInterval(state.timerInterval);
          alert('Time is up! Submitting your semester mock test automatically.');
          submitTest();
          return;
        }

        // Warning state when less than 5 minutes left
        if (timerBox) {
          if (state.timeRemaining <= 300) {
            timerBox.className = 'timer-box timer-warning';
          } else {
            timerBox.className = 'timer-box timer-normal';
          }
        }
      } else {
        // Practice count-up
        state.timeRemaining++;
        if (timerBox) timerBox.className = 'timer-box timer-normal';
      }

      updateTimerDisplay();
    }, 1000);

    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const disp = document.getElementById('timer-display');
    if (!disp) return;

    const totalSecs = state.timeRemaining;
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      disp.innerText = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    } else {
      disp.innerText = `${pad(mins)}:${pad(secs)}`;
    }
  }

  function renderQuestion() {
    const q = state.test.questions[state.currentIndex];
    const qBodyEl = document.getElementById('q-body-text');
    if (!q) return;

    const qNumEl = document.getElementById('q-num-display');
    const qTypeEl = document.getElementById('q-type-badge');
    const qMarksEl = document.getElementById('q-marks-pill');
    const qOptionsEl = document.getElementById('q-options-container');

    const totalQs = state.test.total_questions || state.test.questions.length;
    if (qNumEl) qNumEl.innerText = `Question ${state.currentIndex + 1} of ${totalQs}`;
    
    const qYearEl = document.getElementById('q-year-display');
    if (qYearEl) {
      qYearEl.innerText = `${state.test.course_code || 'CBCS'} • Q.${q.q_num || (state.currentIndex + 1)}`;
    }

    if (qTypeEl) {
      qTypeEl.innerText = 'MCQ';
      qTypeEl.className = 'q-type-badge q-type-mcq';
    }

    if (qMarksEl) {
      const m = q.marks || 1.5;
      qMarksEl.innerText = `Marks: +${m} | Neg: 0`;
    }

    // Render Question Statement & Screenshot
    if (qBodyEl) {
      let html = '';
      const imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';
      
      if (imgPath) {
        html += `
          <div class="q-screenshot-wrapper">
            <div class="q-screenshot-toolbar">
              <span class="q-screenshot-pill">📸 Official University Examination Paper (Question ${q.q_num || (state.currentIndex + 1)})</span>
              <button class="btn-screenshot-zoom" onclick="window.viewCurrentQuestionScreenshot()" title="View full size in modal">
                🔍 Enlarge Image
              </button>
            </div>
            <div class="q-screenshot-img-container">
              <img class="q-screenshot-img" src="${imgPath}" alt="Question ${q.q_num}" onclick="window.viewCurrentQuestionScreenshot()" onerror="this.style.display='none'" />
            </div>
          </div>
        `;
      }

      if (q.question) {
        html += `
          <div class="q-text-statement" style="margin-top: ${imgPath ? '14px' : '0'};">
            ${q.question}
          </div>
        `;
      }

      qBodyEl.innerHTML = html;

      // Typeset MathJax if available
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([qBodyEl]).catch(err => console.warn('MathJax render error:', err));
      }
    }

    // Render Options Container (4 Choices: A, B, C, D)
    if (qOptionsEl) {
      qOptionsEl.innerHTML = '';
      const currentResp = state.responses[state.currentIndex];

      const optionWrapper = document.createElement('div');
      optionWrapper.className = 'mcq-choices-container';

      const banner = document.createElement('div');
      banner.className = 'choices-header-banner';
      banner.innerHTML = '<span>Select your chosen option:</span><span class="shortcut-tip">Keyboard: Press <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, or <strong>D</strong> (or 1, 2, 3, 4)</span>';
      optionWrapper.appendChild(banner);

      const listDiv = document.createElement('div');
      listDiv.className = 'choice-tiles-grid';

      ['A', 'B', 'C', 'D'].forEach(optKey => {
        const isSelected = currentResp === optKey;
        const optText = (q.options && q.options[optKey]) ? q.options[optKey] : '';
        
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = `choice-tile ${isSelected ? 'selected' : ''}`;
        tile.onclick = () => selectOption(optKey);

        const keyBadge = document.createElement('span');
        keyBadge.className = 'choice-key-badge';
        keyBadge.innerText = optKey;

        const textSpan = document.createElement('span');
        textSpan.className = 'choice-text';
        textSpan.innerHTML = optText ? optText : `Option (${optKey})`;

        tile.appendChild(keyBadge);
        tile.appendChild(textSpan);
        listDiv.appendChild(tile);
      });

      optionWrapper.appendChild(listDiv);
      qOptionsEl.appendChild(optionWrapper);

      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([qOptionsEl]).catch(err => console.warn('MathJax error:', err));
      }
    }
  }

  function selectOption(optKey) {
    if (state.isSubmitted) return;
    state.responses[state.currentIndex] = optKey;
    
    // Update question status to answered (or ans_review if it was review)
    if (state.status[state.currentIndex] === 'review' || state.status[state.currentIndex] === 'ans_review') {
      state.status[state.currentIndex] = 'ans_review';
    } else {
      state.status[state.currentIndex] = 'answered';
    }

    renderQuestion();
    renderPalette();
    updateSummaryStats();
  }

  function renderPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const questions = state.test.questions;
    for (let i = 0; i < questions.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const statusClass = state.status[i] || 'not_visited';
      btn.className = `palette-btn btn-${statusClass} ${i === state.currentIndex ? 'current' : ''}`;
      btn.innerText = i + 1;
      btn.title = `Question ${i + 1} (${statusClass.replace('_', ' ')})`;
      btn.onclick = () => jumpToQuestion(i);
      grid.appendChild(btn);
    }
  }

  function jumpToQuestion(index) {
    if (index < 0 || index >= state.test.questions.length) return;
    
    // If current was not visited, mark it as not answered
    if (state.status[state.currentIndex] === 'not_visited') {
      state.status[state.currentIndex] = 'not_answered';
    } else if (state.status[state.currentIndex] === 'answered' && state.responses[state.currentIndex] === null) {
      state.status[state.currentIndex] = 'not_answered';
    }

    state.currentIndex = index;
    if (state.status[state.currentIndex] === 'not_visited') {
      state.status[state.currentIndex] = 'not_answered';
    }

    renderQuestion();
    renderPalette();
    updateSummaryStats();
    closePaletteDrawer();
  }

  function saveAndNext() {
    if (state.responses[state.currentIndex] !== null) {
      if (state.status[state.currentIndex] === 'ans_review') {
        state.status[state.currentIndex] = 'ans_review';
      } else {
        state.status[state.currentIndex] = 'answered';
      }
    } else {
      if (state.status[state.currentIndex] !== 'review') {
        state.status[state.currentIndex] = 'not_answered';
      }
    }

    if (state.currentIndex < state.test.questions.length - 1) {
      jumpToQuestion(state.currentIndex + 1);
    } else {
      renderPalette();
      updateSummaryStats();
      showSubmitModal();
    }
  }

  function prevQuestion() {
    if (state.currentIndex > 0) {
      jumpToQuestion(state.currentIndex - 1);
    }
  }

  function markForReviewAndNext() {
    if (state.responses[state.currentIndex] !== null) {
      state.status[state.currentIndex] = 'ans_review';
    } else {
      state.status[state.currentIndex] = 'review';
    }

    if (state.currentIndex < state.test.questions.length - 1) {
      jumpToQuestion(state.currentIndex + 1);
    } else {
      renderPalette();
      updateSummaryStats();
    }
  }

  function clearResponse() {
    state.responses[state.currentIndex] = null;
    if (state.status[state.currentIndex] === 'ans_review') {
      state.status[state.currentIndex] = 'review';
    } else {
      state.status[state.currentIndex] = 'not_answered';
    }
    renderQuestion();
    renderPalette();
    updateSummaryStats();
  }

  function updateSummaryStats() {
    let answered = 0;
    let notAnswered = 0;
    let notVisited = 0;
    let review = 0;
    let ansReview = 0;

    for (let i = 0; i < state.test.questions.length; i++) {
      const st = state.status[i];
      if (st === 'answered') answered++;
      else if (st === 'not_answered') notAnswered++;
      else if (st === 'not_visited') notVisited++;
      else if (st === 'review') review++;
      else if (st === 'ans_review') ansReview++;
    }

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setTxt('count-answered', answered);
    setTxt('count-not-answered', notAnswered);
    setTxt('count-not-visited', notVisited);
    setTxt('count-review', review);
    setTxt('count-ans-review', ansReview);

    setTxt('modal-summary-answered', answered + ansReview);
    setTxt('modal-summary-not-answered', notAnswered);
    setTxt('modal-summary-review', review);
    setTxt('modal-summary-not-visited', notVisited);
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (state.isSubmitted) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      const key = e.key.toUpperCase();
      if (['A', '1'].includes(key)) {
        selectOption('A');
      } else if (['B', '2'].includes(key)) {
        selectOption('B');
      } else if (['C', '3'].includes(key)) {
        selectOption('C');
      } else if (['D', '4'].includes(key)) {
        selectOption('D');
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        saveAndNext();
      } else if (e.key === 'ArrowLeft') {
        prevQuestion();
      }
    });
  }

  // Modals & Navigation Helpers
  window.saveAndNext = saveAndNext;
  window.prevQuestion = prevQuestion;
  window.markForReviewAndNext = markForReviewAndNext;
  window.clearResponse = clearResponse;
  window.jumpToQuestion = jumpToQuestion;

  window.togglePaletteDrawer = function() {
    const pane = document.getElementById('palette-pane');
    const bdrop = document.getElementById('palette-backdrop');
    if (pane) pane.classList.toggle('open');
    if (bdrop) bdrop.classList.toggle('show');
  };

  window.closePaletteDrawer = function() {
    const pane = document.getElementById('palette-pane');
    const bdrop = document.getElementById('palette-backdrop');
    if (pane) pane.classList.remove('open');
    if (bdrop) bdrop.classList.remove('show');
  };

  window.showSubmitModal = function() {
    updateSummaryStats();
    const m = document.getElementById('submit-modal');
    if (m) m.classList.remove('hidden');
  };

  window.closeSubmitModal = function() {
    const m = document.getElementById('submit-modal');
    if (m) m.classList.add('hidden');
  };

  window.submitTest = function() {
    state.isSubmitted = true;
    closeSubmitModal();
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (window.renderResults) {
      window.renderResults(state);
    }
  };

  window.showQuestionPaperModal = function() {
    const m = document.getElementById('qpaper-modal');
    const list = document.getElementById('qpaper-list');
    if (!m || !list) return;

    list.innerHTML = '';
    state.test.questions.forEach((q, idx) => {
      const row = document.createElement('div');
      row.className = 'qpaper-item';
      const imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';

      row.innerHTML = `
        <div class="qpaper-item-header">
          <strong>Question ${idx + 1}</strong>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">Marks: +${q.marks || 1.5} | Neg: 0</span>
          <button type="button" class="btn-jump-q" onclick="window.closeQuestionPaperModal(); window.jumpToQuestion(${idx});">Jump to Question</button>
        </div>
        ${imgPath ? `<img src="${imgPath}" alt="Question ${idx + 1}" style="max-width: 100%; border-radius: 6px; margin: 8px 0;" />` : ''}
        ${q.question ? `<div style="margin: 6px 0;">${q.question}</div>` : ''}
      `;
      list.appendChild(row);
    });

    m.classList.remove('hidden');
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([list]).catch(err => console.warn(err));
    }
  };

  window.closeQuestionPaperModal = function() {
    const m = document.getElementById('qpaper-modal');
    if (m) m.classList.add('hidden');
  };

  window.showInstructionsModal = function() {
    const m = document.getElementById('instructions-modal');
    if (m) m.classList.remove('hidden');
  };

  window.closeInstructionsModal = function() {
    const m = document.getElementById('instructions-modal');
    if (m) m.classList.add('hidden');
  };

  window.viewCurrentQuestionScreenshot = function() {
    const q = state.test.questions[state.currentIndex];
    if (!q || !q.image) {
      alert('Official question paper screenshot not available for this question.');
      return;
    }

    const imgPath = q.image.startsWith('../') ? q.image : `../${q.image}`;
    const modal = document.getElementById('screenshot-modal');
    const img = document.getElementById('screenshot-modal-img');
    const title = document.getElementById('screenshot-modal-title');
    const openTab = document.getElementById('screenshot-open-tab');

    if (modal && img) {
      img.src = imgPath;
      if (title) title.innerText = `📸 Official Examination Paper — Question ${q.q_num || (state.currentIndex + 1)}`;
      if (openTab) openTab.href = imgPath;
      modal.classList.remove('hidden');
    }
  };

  window.closeScreenshotModal = function() {
    const modal = document.getElementById('screenshot-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.toggleTheme = function() {
    const curr = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeIcon();
  };

  function updateThemeIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    const curr = document.documentElement.getAttribute('data-theme') || 'dark';
    if (btn) btn.innerText = curr === 'dark' ? '☀' : '🌙';
  }

  // Auto-init on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
