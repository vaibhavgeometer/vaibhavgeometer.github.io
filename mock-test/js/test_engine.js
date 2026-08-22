/**
 * IIT JAM Mathematics Mock Test - Core Test Engine
 * Screenshot-First Question Display with Interactive MCQ/MSQ/NAT Options
 */

(function() {
  const state = {
    topicId: '2026',
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

  // Initialize Engine
  function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramTopic = urlParams.get('topic') || urlParams.get('year') || '2026';
    const paramMode = urlParams.get('mode') || 'official';
    
    state.topicId = paramTopic;
    state.mode = paramMode;

    if (!window.MOCK_TESTS_DATA || !window.MOCK_TESTS_DATA[state.topicId]) {
      // If requested topic is not found, fallback to 2026
      if (window.MOCK_TESTS_DATA && window.MOCK_TESTS_DATA['2026']) {
        state.topicId = '2026';
      } else {
        alert('Invalid or missing test paper data. Redirecting to home portal.');
        window.location.href = '../index.html';
        return;
      }
    }

    state.test = window.MOCK_TESTS_DATA[state.topicId];
    
    // Set initial question statuses
    for (let i = 0; i < state.test.questions.length; i++) {
      state.status[i] = 'not_visited';
      state.responses[i] = null;
    }

    // Set first question as visited
    state.status[0] = 'not_answered';

    // Set timer duration
    state.timeRemaining = (state.test.duration_minutes || 180) * 60;
    if (state.mode === 'practice') {
      state.timeRemaining = 0; // untimed count-up
    }

    // Update Header Meta
    const titleEl = document.getElementById('exam-topic-title');
    const subEl = document.getElementById('exam-topic-sub');
    if (titleEl) titleEl.innerText = state.test.name;
    if (subEl) {
      const qCount = state.test.total_questions || state.test.questions.length;
      const marksCount = state.test.total_marks;
      const minsCount = state.test.duration_minutes;
      subEl.innerText = `${qCount} Questions • ${marksCount} Marks • ${minsCount} Mins • ${state.mode === 'practice' ? 'Practice Mode' : 'Official CBT'}`;
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
          alert('Time is up! Submitting your mock test automatically.');
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

    if (qNumEl) qNumEl.innerText = `Question ${state.currentIndex + 1} of ${state.test.total_questions || state.test.questions.length}`;
    
    const qYearEl = document.getElementById('q-year-display');
    if (qYearEl) {
      qYearEl.innerText = `${q.year || 'JAM'} • Q.${q.q_num}`;
    }

    if (qTypeEl) {
      qTypeEl.innerText = q.type;
      qTypeEl.className = `q-type-badge q-type-${q.type.toLowerCase()}`;
    }

    if (qMarksEl) {
      let negText = q.negative_marks > 0 ? `-${q.negative_marks}` : '0';
      qMarksEl.innerText = `Marks: +${q.marks} | Neg: ${negText}`;
    }

    // Render Question statement: Screenshot-First Display
    if (qBodyEl) {
      const imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';
      if (imgPath) {
        qBodyEl.innerHTML = `
          <div class="q-screenshot-wrapper">
            <div class="q-screenshot-toolbar">
              <span class="q-screenshot-pill">📸 Official Examination Question & Options</span>
              <button class="btn-screenshot-zoom" onclick="window.viewCurrentQuestionScreenshot()" title="View full size in modal">
                🔍 Enlarge Image
              </button>
            </div>
            <div class="q-screenshot-img-container">
              <img class="q-screenshot-img" src="${imgPath}" alt="Question ${q.q_num}" onclick="window.viewCurrentQuestionScreenshot()" />
            </div>
          </div>
        `;
      } else {
        qBodyEl.innerHTML = `<div class="q-text-statement">${q.question || 'Question statement not available.'}</div>`;
      }
    }

    // Render Options Container
    if (qOptionsEl) {
      qOptionsEl.innerHTML = '';
      const currentResp = state.responses[state.currentIndex];

      if (q.type === 'MCQ') {
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
          tile.setAttribute('data-option', optKey);
          tile.onclick = () => selectOption(optKey);
          
          tile.innerHTML = `
            <div class="choice-tile-badge">${optKey}</div>
            <div class="choice-tile-content">
              <span class="choice-tile-title">Option (${optKey})</span>
              ${optText ? `<span class="choice-tile-text">${optText}</span>` : ''}
            </div>
            <div class="choice-tile-radio">
              <div class="radio-inner"></div>
            </div>
          `;
          listDiv.appendChild(tile);
        });

        optionWrapper.appendChild(listDiv);
        qOptionsEl.appendChild(optionWrapper);

      } else if (q.type === 'MSQ') {
        const optionWrapper = document.createElement('div');
        optionWrapper.className = 'msq-choices-container';

        const banner = document.createElement('div');
        banner.className = 'choices-header-banner';
        banner.innerHTML = '<span style="color:var(--brand-accent);">ℹ Select ONE or MORE correct options (No negative marks):</span><span class="shortcut-tip">Keyboard: Press <strong>A, B, C, D</strong> to toggle</span>';
        optionWrapper.appendChild(banner);

        const listDiv = document.createElement('div');
        listDiv.className = 'choice-tiles-grid';

        const selectedSet = new Set(Array.isArray(currentResp) ? currentResp : []);

        ['A', 'B', 'C', 'D'].forEach(optKey => {
          const isSelected = selectedSet.has(optKey);
          const optText = (q.options && q.options[optKey]) ? q.options[optKey] : '';

          const tile = document.createElement('button');
          tile.type = 'button';
          tile.className = `choice-tile choice-tile-msq ${isSelected ? 'selected' : ''}`;
          tile.setAttribute('data-option', optKey);
          tile.onclick = () => toggleMsqOption(optKey);
          
          tile.innerHTML = `
            <div class="choice-tile-badge msq-badge">${optKey}</div>
            <div class="choice-tile-content">
              <span class="choice-tile-title">Option (${optKey})</span>
              ${optText ? `<span class="choice-tile-text">${optText}</span>` : ''}
            </div>
            <div class="choice-tile-checkbox ${isSelected ? 'checked' : ''}">
              ${isSelected ? '✓' : ''}
            </div>
          `;
          listDiv.appendChild(tile);
        });

        optionWrapper.appendChild(listDiv);
        qOptionsEl.appendChild(optionWrapper);

      } else if (q.type === 'NAT') {
        const natVal = (currentResp !== null && currentResp !== undefined) ? currentResp : '';
        const natDiv = document.createElement('div');
        natDiv.className = 'nat-container';
        natDiv.innerHTML = `
          <div class="nat-input-header">
            <label class="nat-input-label">Enter Numerical Answer (Real number / integer / decimal):</label>
            <span class="shortcut-tip">You can use your keyboard or on-screen keypad</span>
          </div>
          <div class="nat-input-row">
            <input type="text" id="nat-input" class="nat-input-field" value="${natVal}" placeholder="e.g. 2.5, -1, 0.45" oninput="window.setNatInput(this.value)" autocomplete="off">
            <button class="nat-clear-btn" onclick="window.pressNatKey('CLEAR')">Clear Entry</button>
          </div>
          <div class="nat-keypad-wrapper">
            <div class="nat-keypad">
              <button class="nat-key" onclick="window.pressNatKey('7')">7</button>
              <button class="nat-key" onclick="window.pressNatKey('8')">8</button>
              <button class="nat-key" onclick="window.pressNatKey('9')">9</button>
              <button class="nat-key nat-key-action" onclick="window.pressNatKey('BACK')">⌫ Del</button>
              <button class="nat-key" onclick="window.pressNatKey('4')">4</button>
              <button class="nat-key" onclick="window.pressNatKey('5')">5</button>
              <button class="nat-key" onclick="window.pressNatKey('6')">6</button>
              <button class="nat-key nat-key-action" onclick="window.pressNatKey('CLEAR')">Clear</button>
              <button class="nat-key" onclick="window.pressNatKey('1')">1</button>
              <button class="nat-key" onclick="window.pressNatKey('2')">2</button>
              <button class="nat-key" onclick="window.pressNatKey('3')">3</button>
              <button class="nat-key nat-key-sign" onclick="window.pressNatKey('-')">± Neg</button>
              <button class="nat-key" style="grid-column: span 2;" onclick="window.pressNatKey('0')">0</button>
              <button class="nat-key" style="grid-column: span 2;" onclick="window.pressNatKey('.')">. (dot)</button>
            </div>
          </div>
        `;
        qOptionsEl.appendChild(natDiv);
      }
    }

    // Trigger MathJax re-render if text equations are present
    if (window.renderMath) {
      window.renderMath(document.querySelector('.question-card'));
    }
  }

  function selectOption(optKey) {
    // If clicking already selected MCQ option, keep it or toggle
    state.responses[state.currentIndex] = optKey;
    const tiles = document.querySelectorAll('.choice-tiles-grid .choice-tile');
    tiles.forEach(tile => {
      const isThis = tile.getAttribute('data-option') === optKey;
      tile.classList.toggle('selected', isThis);
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

    const tiles = document.querySelectorAll('.choice-tiles-grid .choice-tile');
    const selectedSet = new Set(arr);
    tiles.forEach(tile => {
      const k = tile.getAttribute('data-option');
      const isSel = selectedSet.has(k);
      tile.classList.toggle('selected', isSel);
      const chkBox = tile.querySelector('.choice-tile-checkbox');
      if (chkBox) {
        chkBox.classList.toggle('checked', isSel);
        chkBox.innerText = isSel ? '✓' : '';
      }
    });
  }

  window.setNatInput = function(val) {
    state.responses[state.currentIndex] = (val && val.trim() !== '') ? val.trim() : null;
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
    input.focus();
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

    if (state.currentIndex < state.test.questions.length - 1) {
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

    if (state.currentIndex < state.test.questions.length - 1) {
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
      renderQuestion();
      renderPalette();
      updateSummaryStats();
    }
  };

  window.jumpToQuestion = function(index) {
    if (index >= 0 && index < state.test.questions.length) {
      // If current question has not been answered/marked, keep status
      if (state.status[index] === 'not_visited') {
        state.status[index] = 'not_answered';
      }
      state.currentIndex = index;
      renderQuestion();
      renderPalette();
      updateSummaryStats();

      // On mobile, close palette drawer if open
      const pane = document.getElementById('palette-pane');
      if (pane && pane.classList.contains('drawer-open')) {
        pane.classList.remove('drawer-open');
      }
    }
  };

  function renderPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    grid.innerHTML = '';
    state.test.questions.forEach((q, idx) => {
      // Check filter
      if (state.filter !== 'ALL' && q.type !== state.filter) {
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      const statusClass = `status-${state.status[idx] || 'not_visited'}`;
      const isCurrent = idx === state.currentIndex ? 'current-q' : '';
      btn.className = `palette-btn ${statusClass} ${isCurrent}`;
      btn.innerText = idx + 1;
      btn.title = `Question ${idx + 1} (${q.type}, ${q.marks}M) - ${state.status[idx]}`;
      btn.onclick = () => window.jumpToQuestion(idx);

      grid.appendChild(btn);
    });
  }

  function updateSummaryStats() {
    let answered = 0;
    let notAnswered = 0;
    let notVisited = 0;
    let review = 0;
    let ansReview = 0;

    const total = state.test.questions.length;
    for (let i = 0; i < total; i++) {
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

    // Modal summary stats
    setTxt('modal-summary-answered', answered + ansReview);
    setTxt('modal-summary-not-answered', notAnswered);
    setTxt('modal-summary-review', review);
    setTxt('modal-summary-not-visited', notVisited);
  }

  window.filterPalette = function(filterType) {
    state.filter = filterType;
    document.querySelectorAll('.palette-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
    });
    renderPalette();
  };

  window.togglePaletteDrawer = function() {
    const pane = document.getElementById('palette-pane');
    if (pane) pane.classList.toggle('drawer-open');
  };

  window.showSubmitModal = function() {
    const modal = document.getElementById('submit-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSubmitModal = function() {
    const modal = document.getElementById('submit-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.submitTest = function() {
    state.isSubmitted = true;
    if (state.timerInterval) clearInterval(state.timerInterval);
    window.closeSubmitModal();

    if (window.renderResults) {
      window.renderResults(state);
    }
  };

  // Screenshot Viewer Modal
  window.viewQuestionScreenshot = function(yearOrQ, qnum) {
    let imgPath = '';
    let titleStr = '';

    if (typeof yearOrQ === 'object' && yearOrQ !== null) {
      const q = yearOrQ;
      imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';
      titleStr = `📸 Official Paper Screenshot • <strong>${q.year || 'JAM'} (Q.${q.q_num})</strong>`;
    } else {
      const yr = String(yearOrQ).replace('JAM', '').trim();
      imgPath = `../assets/PYQs_Screenshots/${yr}/JAM_${yr}_Q${qnum}.png`;
      titleStr = `📸 Official Paper Screenshot • <strong>JAM ${yr} (Q.${qnum})</strong>`;
    }

    const modal = document.getElementById('screenshot-modal');
    const img = document.getElementById('screenshot-modal-img');
    const title = document.getElementById('screenshot-modal-title');
    const openLink = document.getElementById('screenshot-open-tab');
    const loadingEl = document.getElementById('screenshot-loading');

    if (title) title.innerHTML = titleStr;
    if (openLink) openLink.href = imgPath;

    if (loadingEl) {
      loadingEl.style.display = 'block';
      loadingEl.innerText = 'Loading High-Resolution Screenshot...';
    }

    if (img) {
      img.style.display = 'none';
      img.onload = () => {
        if (loadingEl) loadingEl.style.display = 'none';
        img.style.display = 'block';
      };
      img.onerror = () => {
        if (loadingEl) {
          loadingEl.style.display = 'block';
          loadingEl.innerText = 'Screenshot image file not found.';
        }
        img.style.display = 'none';
      };
      img.src = imgPath;
    }

    if (modal) modal.classList.remove('hidden');
  };

  window.viewCurrentQuestionScreenshot = function() {
    const q = state.test.questions[state.currentIndex];
    if (q) {
      window.viewQuestionScreenshot(q);
    }
  };

  window.closeScreenshotModal = function() {
    const modal = document.getElementById('screenshot-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.showQuestionPaperModal = function() {
    const modal = document.getElementById('qpaper-modal');
    const list = document.getElementById('qpaper-list');
    if (!modal || !list) return;

    list.innerHTML = '';
    state.test.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'qpaper-item-card';
      
      const imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';
      const userResp = state.responses[idx];
      let userAnsBadge = '<span class="qpaper-unans-badge">Not Attempted</span>';
      if (userResp !== null && userResp !== undefined && String(userResp).trim() !== '') {
        const respStr = Array.isArray(userResp) ? userResp.join(', ') : userResp;
        userAnsBadge = `<span class="qpaper-ans-badge">Selected: <strong>${respStr}</strong></span>`;
      }

      card.innerHTML = `
        <div class="qpaper-item-header">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <strong style="font-size:1.05rem;">Question ${idx + 1}</strong>
            <span class="q-type-badge q-type-${q.type.toLowerCase()}">${q.type}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">(${q.year || 'JAM'} Q.${q.q_num})</span>
            <span class="q-marks-pill">+${q.marks} Mark${q.marks > 1 ? 's' : ''}</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${userAnsBadge}
            <button class="nav-icon-btn" onclick="window.closeQuestionPaperModal(); window.jumpToQuestion(${idx});" title="Jump to this question" style="padding: 4px 12px; font-size: 0.85rem; font-weight:700;">
              Go to Question ↗
            </button>
          </div>
        </div>
        <div class="qpaper-item-body">
          ${imgPath ? `<img class="qpaper-screenshot-img" src="${imgPath}" alt="Question ${q.q_num}" loading="lazy" />` : `<div style="padding:12px;">${q.question || ''}</div>`}
        </div>
      `;
      list.appendChild(card);
    });

    modal.classList.remove('hidden');
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

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeIcon();
  };

  function updateThemeIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      btn.textContent = cur === 'dark' ? '☀' : '🌙';
    }
  }

  // Keyboard Navigation & Option Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeScreenshotModal();
      window.closeQuestionPaperModal();
      window.closeInstructionsModal();
      window.closeSubmitModal();
      return;
    }

    if (state.isSubmitted) return;
    
    // If user is focused on the NAT text box, only allow normal typing
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (e.key === 'Enter') {
        window.saveAndNext();
      }
      return;
    }

    const keyLower = e.key.toLowerCase();

    // Next / Prev navigation
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      window.saveAndNext();
    } else if (e.key === 'ArrowLeft') {
      window.prevQuestion();
    } else if (keyLower === 'r' || keyLower === 'm') {
      window.markForReviewAndNext();
    } else if (keyLower === 'c') {
      window.clearResponse();
    }
    // Option selection shortcuts: A, B, C, D or 1, 2, 3, 4
    else if (['a', 'b', 'c', 'd', '1', '2', '3', '4'].includes(keyLower)) {
      const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', 'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D' };
      const chosenOpt = keyMap[keyLower];
      const q = state.test.questions[state.currentIndex];
      if (q.type === 'MCQ') {
        selectOption(chosenOpt);
      } else if (q.type === 'MSQ') {
        toggleMsqOption(chosenOpt);
      }
    }
  });

  // Run init on DOM load
  document.addEventListener('DOMContentLoaded', init);

})();
