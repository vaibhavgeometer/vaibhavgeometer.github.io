/**
 * IIT JAM Mathematics Mock Test - Core Test Engine
 */

(function() {
  const state = {
    topicId: '1.1',
    test: null,
    currentIndex: 0,
    responses: {},       // { [index]: "A" | ["A","B"] | "12.5" }
    status: {},          // { [index]: "not_visited" | "not_answered" | "answered" | "review" | "ans_review" }
    timeRemaining: 0,    // in seconds
    timerInterval: null,
    filter: 'ALL',
    isSubmitted: false,
    mode: 'official',    // 'official' or 'practice'
    startTime: Date.now()
  };

  // Initialize
  function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramTopic = urlParams.get('topic') || '1.1';
    const paramMode = urlParams.get('mode') || 'official';
    
    state.topicId = paramTopic;
    state.mode = paramMode;

    if (!window.MOCK_TESTS_DATA || !window.MOCK_TESTS_DATA[state.topicId]) {
      alert('Invalid or missing topic data. Redirecting to home portal.');
      window.location.href = 'index.html';
      return;
    }

    state.test = window.MOCK_TESTS_DATA[state.topicId];
    
    // Set initial status
    for (let i = 0; i < state.test.questions.length; i++) {
      state.status[i] = 'not_visited';
      state.responses[i] = null;
    }

    // Set first question as not answered (visited)
    state.status[0] = 'not_answered';

    // Set timer
    state.timeRemaining = state.test.duration_minutes * 60;
    if (state.mode === 'practice') {
      state.timeRemaining = 0; // untimed count-up
    }

    // Update Header
    const titleEl = document.getElementById('exam-topic-title');
    const subEl = document.getElementById('exam-topic-sub');
    if (titleEl) titleEl.innerText = `Test ${state.test.id}: ${state.test.name}`;
    if (subEl) subEl.innerText = `${state.test.total_questions} Questions • ${state.test.total_marks} Marks • ${state.test.duration_minutes} Mins`;

    // Start Timer
    startTimer();

    // Render First Question and Palette
    renderQuestion();
    renderPalette();
    updateSummaryStats();

    // Setup Theme
    const savedTheme = localStorage.getItem('jam_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
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
          alert('Time is up! Submitting your test automatically.');
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
    if (!q) return;

    const qNumEl = document.getElementById('q-num-display');
    const qTypeEl = document.getElementById('q-type-badge');
    const qMarksEl = document.getElementById('q-marks-pill');
    const qBodyEl = document.getElementById('q-body-text');
    const qOptionsEl = document.getElementById('q-options-container');

    if (qNumEl) qNumEl.innerText = `Question ${state.currentIndex + 1} of ${state.test.total_questions}`;
    
    if (qTypeEl) {
      qTypeEl.innerText = q.type;
      qTypeEl.className = `q-type-badge q-type-${q.type.toLowerCase()}`;
    }

    if (qMarksEl) {
      let negText = q.negative_marks > 0 ? `-${q.negative_marks}` : '0';
      qMarksEl.innerText = `Marks: +${q.marks} | Neg: ${negText}`;
    }

    if (qBodyEl) {
      qBodyEl.innerHTML = q.question;
    }

    if (qOptionsEl) {
      qOptionsEl.innerHTML = '';

      const currentResp = state.responses[state.currentIndex];

      if (q.type === 'MCQ') {
        const listDiv = document.createElement('div');
        listDiv.className = 'options-list';

        ['A', 'B', 'C', 'D'].forEach(optKey => {
          if (q.options && q.options[optKey]) {
            const isSelected = currentResp === optKey;
            const item = document.createElement('div');
            item.className = `option-item ${isSelected ? 'selected' : ''}`;
            item.onclick = () => selectOption(optKey);
            item.innerHTML = `
              <div class="option-label">(${optKey})</div>
              <div class="option-text">${q.options[optKey]}</div>
            `;
            listDiv.appendChild(item);
          }
        });
        qOptionsEl.appendChild(listDiv);

      } else if (q.type === 'MSQ') {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:0.85rem; font-weight:600; color:var(--brand-accent); margin-bottom:10px;';
        hint.innerText = 'ℹ (Select ONE or MORE correct options. No partial marks)';
        qOptionsEl.appendChild(hint);

        const listDiv = document.createElement('div');
        listDiv.className = 'options-list';

        const selectedSet = new Set(Array.isArray(currentResp) ? currentResp : []);

        ['A', 'B', 'C', 'D'].forEach(optKey => {
          if (q.options && q.options[optKey]) {
            const isSelected = selectedSet.has(optKey);
            const item = document.createElement('div');
            item.className = `option-item ${isSelected ? 'selected' : ''}`;
            item.onclick = () => toggleMsqOption(optKey);
            item.innerHTML = `
              <div class="option-label" style="display:flex;align-items:center;gap:6px;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events:none;transform:scale(1.2);">
                (${optKey})
              </div>
              <div class="option-text">${q.options[optKey]}</div>
            `;
            listDiv.appendChild(item);
          }
        });
        qOptionsEl.appendChild(listDiv);

      } else if (q.type === 'NAT') {
        const natVal = currentResp !== null && currentResp !== undefined ? currentResp : '';
        const natDiv = document.createElement('div');
        natDiv.className = 'nat-container';
        natDiv.innerHTML = `
          <label class="nat-input-label">Enter Numerical Answer (Keyboard or Keypad):</label>
          <input type="text" id="nat-input" class="nat-input-field" value="${natVal}" placeholder="e.g. 2.5 or -1" oninput="window.setNatInput(this.value)">
          <div class="nat-keypad">
            <button class="nat-key" onclick="window.pressNatKey('7')">7</button>
            <button class="nat-key" onclick="window.pressNatKey('8')">8</button>
            <button class="nat-key" onclick="window.pressNatKey('9')">9</button>
            <button class="nat-key nat-key-action" onclick="window.pressNatKey('BACK')">⌫</button>
            <button class="nat-key" onclick="window.pressNatKey('4')">4</button>
            <button class="nat-key" onclick="window.pressNatKey('5')">5</button>
            <button class="nat-key" onclick="window.pressNatKey('6')">6</button>
            <button class="nat-key nat-key-action" onclick="window.pressNatKey('CLEAR')">Clear</button>
            <button class="nat-key" onclick="window.pressNatKey('1')">1</button>
            <button class="nat-key" onclick="window.pressNatKey('2')">2</button>
            <button class="nat-key" onclick="window.pressNatKey('3')">3</button>
            <button class="nat-key" onclick="window.pressNatKey('-')">±</button>
            <button class="nat-key" style="grid-column: span 2;" onclick="window.pressNatKey('0')">0</button>
            <button class="nat-key" style="grid-column: span 2;" onclick="window.pressNatKey('.')">.</button>
          </div>
        `;
        qOptionsEl.appendChild(natDiv);
      }
    }

    // Trigger MathJax re-render for formulas
    if (window.renderMath) {
      window.renderMath(document.querySelector('.question-card'));
    }
  }

  function selectOption(optKey) {
    state.responses[state.currentIndex] = optKey;
    const items = document.querySelectorAll('.options-list .option-item');
    ['A', 'B', 'C', 'D'].forEach((key, i) => {
      if (items[i]) {
        items[i].classList.toggle('selected', key === optKey);
      }
    });
  }

  function toggleMsqOption(optKey) {
    let current = state.responses[state.currentIndex];
    let arr = Array.isArray(current) ? [...current] : [];
    const idx = arr.indexOf(optKey);
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(optKey);
    }
    arr.sort();
    state.responses[state.currentIndex] = arr.length > 0 ? arr : null;

    const items = document.querySelectorAll('.options-list .option-item');
    const selectedSet = new Set(arr);
    ['A', 'B', 'C', 'D'].forEach((key, i) => {
      if (items[i]) {
        const isSel = selectedSet.has(key);
        items[i].classList.toggle('selected', isSel);
        const chk = items[i].querySelector('input[type="checkbox"]');
        if (chk) chk.checked = isSel;
      }
    });
  }

  window.setNatInput = function(val) {
    state.responses[state.currentIndex] = val.trim() !== '' ? val.trim() : null;
  };

  window.pressNatKey = function(key) {
    const input = document.getElementById('nat-input');
    if (!input) return;
    let cur = input.value || '';

    if (key === 'CLEAR') {
      cur = '';
    } else if (key === 'BACK') {
      cur = cur.slice(0, -1);
    } else if (key === '-') {
      if (cur.startsWith('-')) cur = cur.slice(1);
      else cur = '-' + cur;
    } else if (key === '.') {
      if (!cur.includes('.')) cur += '.';
    } else {
      cur += key;
    }

    input.value = cur;
    window.setNatInput(cur);
  };

  function hasResponse(index) {
    const resp = state.responses[index];
    if (resp === null || resp === undefined) return false;
    if (Array.isArray(resp)) return resp.length > 0;
    if (typeof resp === 'string') return resp.trim().length > 0;
    return false;
  }

  window.saveAndNext = function() {
    if (hasResponse(state.currentIndex)) {
      state.status[state.currentIndex] = 'answered';
    } else {
      state.status[state.currentIndex] = 'not_answered';
    }

    if (state.currentIndex < state.test.total_questions - 1) {
      state.currentIndex++;
      if (state.status[state.currentIndex] === 'not_visited') {
        state.status[state.currentIndex] = 'not_answered';
      }
    }
    renderQuestion();
    renderPalette();
    updateSummaryStats();
  };

  window.markForReviewAndNext = function() {
    if (hasResponse(state.currentIndex)) {
      state.status[state.currentIndex] = 'ans_review';
    } else {
      state.status[state.currentIndex] = 'review';
    }

    if (state.currentIndex < state.test.total_questions - 1) {
      state.currentIndex++;
      if (state.status[state.currentIndex] === 'not_visited') {
        state.status[state.currentIndex] = 'not_answered';
      }
    }
    renderQuestion();
    renderPalette();
    updateSummaryStats();
  };

  window.clearResponse = function() {
    state.responses[state.currentIndex] = null;
    state.status[state.currentIndex] = 'not_answered';
    renderQuestion();
    renderPalette();
    updateSummaryStats();
  };

  window.prevQuestion = function() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      if (state.status[state.currentIndex] === 'not_visited') {
        state.status[state.currentIndex] = 'not_answered';
      }
      renderQuestion();
      renderPalette();
      updateSummaryStats();
    }
  };

  window.jumpToQuestion = function(index) {
    if (index >= 0 && index < state.test.total_questions) {
      // If leaving current and was unvisited, mark not_answered
      if (state.status[state.currentIndex] === 'not_visited') {
        state.status[state.currentIndex] = 'not_answered';
      }
      
      state.currentIndex = index;
      if (state.status[index] === 'not_visited') {
        state.status[index] = 'not_answered';
      }
      
      renderQuestion();
      renderPalette();
      updateSummaryStats();

      // Close mobile drawer
      window.togglePaletteDrawer(false);
    }
  };

  function renderPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    grid.innerHTML = '';

    state.test.questions.forEach((q, idx) => {
      if (state.filter !== 'ALL' && q.type !== state.filter) {
        return;
      }

      const btn = document.createElement('button');
      const st = state.status[idx] || 'not_visited';
      btn.className = `palette-btn st-${st.replace('_', '-')} ${state.currentIndex === idx ? 'current' : ''}`;
      btn.innerText = idx + 1;
      btn.title = `Q${idx + 1} (${q.type}, ${q.marks}M): ${st.replace('_', ' ')}`;
      btn.onclick = () => window.jumpToQuestion(idx);
      grid.appendChild(btn);
    });
  }

  function updateSummaryStats() {
    let counts = {
      answered: 0,
      not_answered: 0,
      not_visited: 0,
      review: 0,
      ans_review: 0
    };

    for (let i = 0; i < state.test.total_questions; i++) {
      const st = state.status[i] || 'not_visited';
      counts[st] = (counts[st] || 0) + 1;
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setVal('count-answered', counts.answered);
    setVal('count-not-answered', counts.not_answered);
    setVal('count-not-visited', counts.not_visited);
    setVal('count-review', counts.review);
    setVal('count-ans-review', counts.ans_review);

    // Update modal summary cards
    setVal('modal-summary-answered', counts.answered + counts.ans_review);
    setVal('modal-summary-not-answered', counts.not_answered);
    setVal('modal-summary-review', counts.review + counts.ans_review);
    setVal('modal-summary-not-visited', counts.not_visited);
  }

  window.filterPalette = function(type) {
    state.filter = type;
    document.querySelectorAll('.palette-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === type);
    });
    renderPalette();
  };

  window.togglePaletteDrawer = function(force) {
    const pane = document.getElementById('palette-pane');
    if (pane) {
      if (force !== undefined) pane.classList.toggle('open', force);
      else pane.classList.toggle('open');
    }
  };

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeIcon();
  };

  function updateThemeIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (btn) btn.innerHTML = isDark ? '☀' : '🌙';
  }

  window.showSubmitModal = function() {
    updateSummaryStats();
    const modal = document.getElementById('submit-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSubmitModal = function() {
    const modal = document.getElementById('submit-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.submitTest = function() {
    window.closeSubmitModal();
    state.isSubmitted = true;
    if (state.timerInterval) clearInterval(state.timerInterval);

    // Transition to Results
    if (window.renderResults) {
      window.renderResults(state);
    }
  };

  // Dispatcher if MathJax initializes asynchronously after init()
  window.onMathJaxReady = function() {
    if (!state.isSubmitted && state.test) {
      renderQuestion();
    }
  };

  window.showQuestionPaperModal = function() {
    const modal = document.getElementById('qpaper-modal');
    const list = document.getElementById('qpaper-list');
    if (!modal || !list) return;

    list.innerHTML = '';
    state.test.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      
      let optionsHtml = '';
      if (q.options) {
        optionsHtml = `
          <div class="options-list" style="margin: 12px 0;">
            ${['A', 'B', 'C', 'D'].map(opt => {
              if (!q.options[opt]) return '';
              return `
                <div class="option-item" style="cursor: pointer;" onclick="window.closeQuestionPaperModal(); window.jumpToQuestion(${idx});">
                  <div class="option-label">(${opt})</div>
                  <div class="option-text">${q.options[opt]}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="review-card-header">
          <div>
            <strong>Question ${idx + 1}</strong>
            <span class="q-type-badge q-type-${q.type.toLowerCase()}" style="margin-left: 8px;">${q.type}</span>
            <span style="font-size: 0.82rem; color: var(--text-muted); margin-left: 6px;">(${q.year} Q.${q.q_num})</span>
            <span class="q-marks-pill" style="margin-left: 8px;">${q.marks} Mark${q.marks > 1 ? 's' : ''}</span>
          </div>
          <button class="nav-icon-btn" onclick="window.closeQuestionPaperModal(); window.jumpToQuestion(${idx});" title="Jump to this question in workspace">
            Go to Question ↗
          </button>
        </div>
        <div class="q-body-content" style="margin: 14px 0 10px 0; font-size: 1rem;">
          ${q.question}
        </div>
        ${optionsHtml}
      `;
      list.appendChild(card);
    });

    modal.classList.remove('hidden');
    if (window.renderMath) window.renderMath(list);
  };

  window.closeQuestionPaperModal = function() {
    const modal = document.getElementById('qpaper-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.showInstructionsModal = function() {
    const modal = document.getElementById('instructions-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeInstructionsModal = function() {
    const modal = document.getElementById('instructions-modal');
    if (modal) modal.classList.add('hidden');
  };

  // Keyboard navigation shortcuts
  document.addEventListener('keydown', (e) => {
    if (state.isSubmitted) return;
    // Don't trigger shortcuts if focus is inside input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      window.saveAndNext();
    } else if (e.key === 'ArrowLeft') {
      window.prevQuestion();
    } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
      const q = state.test.questions[state.currentIndex];
      if (q.type === 'MCQ') selectOption(e.key.toUpperCase());
      else if (q.type === 'MSQ') toggleMsqOption(e.key.toUpperCase());
    }
  });

  // Run init on DOM load
  document.addEventListener('DOMContentLoaded', init);
})();
