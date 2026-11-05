/**
 * IIT JAM Mathematics Portal - Main Logic
 * 22-Year (2005-2026) Mock Tests, 27 Era-Based Subtopic Tests (3 Eras x 9 Topics), Filters & Theme Management
 */

(function() {

  // --- Theme Management ---
  window.initTheme = function() {
    const saved = localStorage.getItem('jam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  };

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeIcon(next);
  };

  function updateThemeIcon(theme) {
    const allBtns = document.querySelectorAll('#theme-btn, #theme-toggle-btn');
    allBtns.forEach(b => {
      b.textContent = theme === 'dark' ? '☀' : '🌙';
      b.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    });
  }

  // --- Tab Navigation (Year Tests vs Topic Tests vs Resources) ---
  window.switchMainTab = function(tabId, btn) {
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    if (!btn) {
      btn = document.getElementById(`tab-btn-${tabId}`) ||
            document.querySelector(`.main-tab-btn[onclick*="'${tabId}'"]`);
    }
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const activePanel = document.getElementById(`tab-panel-${tabId}`);
    if (activePanel) {
      activePanel.classList.remove('hidden');
    }
  };
  window.switchTab = window.switchMainTab;

  // --- Render 22-Year Mock Tests ---
  window.renderYearMockTests = function() {
    const container = document.getElementById('year-tests-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      setTimeout(window.renderYearMockTests, 100);
      return;
    }

    const allData = window.MOCK_TESTS_DATA;
    // Filter keys that are 4-digit years (2005..2026)
    const yearKeys = Object.keys(allData)
      .filter(k => /^\d{4}$/.test(k))
      .sort((a, b) => parseInt(b) - parseInt(a));

    container.innerHTML = yearKeys.map(yrStr => {
      const t = allData[yrStr];
      const yrNum = parseInt(yrStr);
      const isCBT = yrNum >= 2015;
      const era = isCBT ? 'cbt' : 'classic';
      const eraTag = isCBT ? 'CBT Pattern' : 'Classic Paper';
      const eraTagClass = isCBT ? 'tag-cbt' : 'tag-classic';

      const bestScore = localStorage.getItem(`jam_score_${t.id}`);
      const scoreBadge = bestScore !== null
        ? `<span class="best-score">★ Best: ${bestScore}/${t.total_marks}</span>`
        : '';

      const mockPdfLink = t.mock_pdf
        ? `<a href="${t.mock_pdf}" target="_blank" rel="noopener noreferrer" class="btn-test secondary btn-mock-pdf" title="Download Official Mock Test PDF with Question Screenshots & Answer Key">📥 Mock PDF</a>`
        : '';

      return `
        <div class="topic-card year-card" data-era="${era}">
          <div class="topic-card-top">
            <span class="year-badge">JAM ${yrStr}</span>
            <span class="era-tag ${eraTagClass}">${eraTag}</span>
            ${scoreBadge}
          </div>
          <h3 class="topic-card-title">${t.name}</h3>
          <div class="topic-meta">
            <div class="topic-meta-item">
              <span class="meta-label">Questions</span>
              <span class="meta-value">${t.total_questions || t.questions.length}</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Total Marks</span>
              <span class="meta-value">${t.total_marks} Marks</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Duration</span>
              <span class="meta-value">${t.duration_minutes} min</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Pattern</span>
              <span class="meta-value">${t.pattern || (isCBT ? 'MCQ • MSQ • NAT' : 'MCQ')}</span>
            </div>
          </div>
          <div class="topic-actions">
            <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-test primary" title="Start Timed Examination">⚡ Start Test</a>
            <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-test secondary" title="Practice without Timer">📖 Practice</a>
            ${mockPdfLink}
          </div>
        </div>
      `;
    }).join('');
  };

  // --- Render 27 Subtopic Mock Tests & Full Archive ---
  window.topicFilterState = {
    era: 'ALL',
    category: 'ALL'
  };

  window.renderTopicMockTests = function() {
    const container = document.getElementById('topics-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      setTimeout(window.renderTopicMockTests, 100);
      return;
    }

    const allData = window.MOCK_TESTS_DATA;
    
    // Order keys: 2022-2026 (1.1..3.4), 2015-2021 (1.1..3.4), 2005-2014 (1.1..3.4), comprehensive (1.1..3.4)
    const eraOrder = ['2022-2026', '2015-2021', '2005-2014'];
    const subtopicKeys = ['1.1', '1.2', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4'];

    const allTopicTestKeys = [];

    // Add 27 Era-based Subtopic Tests
    eraOrder.forEach(era => {
      subtopicKeys.forEach(st => {
        const k = `${era}_${st}`;
        if (allData[k]) allTopicTestKeys.push(k);
      });
    });

    // Add 9 Comprehensive Full-Archive Tests
    subtopicKeys.forEach(st => {
      if (allData[st]) allTopicTestKeys.push(st);
    });

    container.innerHTML = allTopicTestKeys.map(k => {
      const t = allData[k];
      const isComprehensive = t.era === 'comprehensive';
      const isZeroQuestions = (t.total_questions || (t.questions ? t.questions.length : 0)) === 0;

      let tagClass = 'tag-cbt';
      if (t.era === '2022-2026') tagClass = 'tag-recent';
      else if (t.era === '2015-2021') tagClass = 'tag-cbt';
      else if (t.era === '2005-2014') tagClass = 'tag-classic';
      else if (isComprehensive) tagClass = 'tag-archive';

      const bestScore = localStorage.getItem(`jam_score_${t.id}`);
      const scoreBadge = bestScore !== null
        ? `<span class="best-score">★ Best: ${bestScore}/${t.total_marks}</span>`
        : '';

      const mockPdfBtn = t.mock_pdf
        ? `<a href="${t.mock_pdf}" target="_blank" rel="noopener noreferrer" class="btn-test secondary" title="Download Official Mock Test PDF with Question Screenshots & Answer Key">📥 Mock PDF</a>`
        : '';

      const eraBadgeLabel = t.era_label || (isComprehensive ? '2005–2026 Archive' : t.era);

      const customDiffBtn = !isZeroQuestions
        ? `<button type="button" class="btn-test secondary" onclick="window.launchTopicCustomGenerator('${t.topic_id || t.id}')" title="Configure test or PDF for this topic filtered by difficulty">🎯 By Difficulty</button>`
        : '';

      let actionButtons = '';
      if (!isZeroQuestions) {
        actionButtons = `
          <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-test primary" title="Take Timed CBT Exam">⚡ Start Test</a>
          <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-test secondary" title="Practice without Timer">📖 Practice</a>
          ${customDiffBtn}
          ${mockPdfBtn}
        `;
      } else {
        actionButtons = `
          <span class="btn-test disabled" title="This topic was not part of the JAM syllabus during this era">0 Qs (Added in 2022)</span>
        `;
      }

      return `
        <div class="topic-card ${isZeroQuestions ? 'card-zero-qs' : ''}" data-era="${t.era}" data-category="${t.category}" data-topic-id="${t.topic_id || ''}">
          <div class="topic-card-top">
            <span class="topic-num">Topic ${t.topic_id || t.id}</span>
            <span class="era-tag ${tagClass}">${eraBadgeLabel}</span>
            ${scoreBadge}
          </div>
          <h3 class="topic-card-title">${t.name}</h3>
          <div class="topic-meta">
            <div class="topic-meta-item">
              <span class="meta-label">Questions</span>
              <span class="meta-value">${t.total_questions || (t.questions ? t.questions.length : 0)} Qs</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Total Marks</span>
              <span class="meta-value">${t.total_marks} Marks</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Duration</span>
              <span class="meta-value">${t.duration_minutes} min</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Pattern</span>
              <span class="meta-value">${isZeroQuestions ? 'Not in Era Syllabus' : (t.pattern || (t.era === '2005-2014' ? 'Classic Pattern' : 'MCQ • MSQ • NAT'))}</span>
            </div>
          </div>
          <div class="topic-actions">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');

    window.applyTopicFilters();
  };

  // --- Apply Dual Filters (Era & Category) ---
  window.applyTopicFilters = function() {
    const selectedEra = window.topicFilterState.era;
    const selectedCat = window.topicFilterState.category;

    const cards = document.querySelectorAll('#topics-container .topic-card');
    cards.forEach(card => {
      const cardEra = card.dataset.era;
      const cardCat = card.dataset.category;

      let matchEra = false;
      if (selectedEra === 'ALL') {
        // Show all 27 era-based subtopic tests (exclude comprehensive 2005-2026 archive cards when ALL 27 era tests are selected)
        matchEra = (cardEra !== 'comprehensive');
      } else {
        matchEra = (cardEra === selectedEra);
      }

      let matchCat = (selectedCat === 'ALL' || cardCat === selectedCat);

      card.style.display = (matchEra && matchCat) ? 'flex' : 'none';
    });
  };

  // --- Filter Topic Era ---
  window.filterTopicEra = function(era, btn) {
    window.topicFilterState.era = era;
    document.querySelectorAll('.topic-era-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.applyTopicFilters();
  };

  // --- Filter Topic Category ---
  window.filterTopicCategory = function(cat, btn) {
    window.topicFilterState.category = cat;
    document.querySelectorAll('.topic-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.applyTopicFilters();
  };

  // --- Filter Year Tests (All / CBT / Classic) ---
  window.filterYears = function(era, btn) {
    document.querySelectorAll('.year-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.querySelectorAll('#year-tests-container .year-card').forEach(card => {
      if (era === 'ALL' || card.dataset.era === era) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  };

  // --- Legacy Modal compatibility ---
  window.openCheatSheetsModal = function() {
    window.location.href = 'analytics/';
  };

  window.closeCheatSheetsModal = function() {};

  // --- Custom Test & Offline PDF Generator Logic ---
  window.initCustomGenerator = function() {
    if (!window.MOCK_TESTS_DATA) {
      setTimeout(window.initCustomGenerator, 100);
      return;
    }

    if (window.JAM_CUSTOM_GENERATOR && typeof window.JAM_CUSTOM_GENERATOR.ensureOOSMockTestData === 'function') {
      window.JAM_CUSTOM_GENERATOR.ensureOOSMockTestData();
    }

    const allData = window.MOCK_TESTS_DATA;
    // Populate topic counts for 1.1 through 3.4 and oos
    const topicIds = ['1.1', '1.2', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', 'oos'];
    topicIds.forEach(id => {
      const countEl = document.getElementById(`count-${id}`);
      if (countEl) {
        const topicTest = allData[id];
        const qCount = topicTest && topicTest.questions ? topicTest.questions.length : (id === 'oos' ? 87 : 0);
        countEl.textContent = `${qCount} Qs`;
      }
    });

    window.updateCustomGeneratorSummary();
  };

  window.syncQuestionCount = function(val) {
    const num = Math.max(1, Math.min(100, parseInt(val) || 30));
    const slider = document.getElementById('custom-q-slider');
    const input = document.getElementById('custom-q-input');
    if (slider) slider.value = num;
    if (input) input.value = num;

    // Update preset chips
    document.querySelectorAll('.count-preset-chips .chip-btn').forEach(chip => {
      const chipNum = parseInt(chip.dataset.count);
      if (chipNum === num) chip.classList.add('active');
      else chip.classList.remove('active');
    });

    window.updateCustomGeneratorSummary();
  };

  window.customGeneratorSelectAll = function(selectAll) {
    document.querySelectorAll('input[name="custom-topic"]').forEach(cb => {
      cb.checked = !!selectAll;
    });
    window.updateCustomGeneratorSummary();
  };

  window.customGeneratorSelectCategory = function(catKey) {
    document.querySelectorAll('.custom-topic-item').forEach(item => {
      const cb = item.querySelector('input[name="custom-topic"]');
      if (cb) {
        cb.checked = (item.dataset.cat === catKey);
      }
    });
    window.updateCustomGeneratorSummary();
  };

  window.getCustomGeneratorConfig = function() {
    const selectedTopics = Array.from(document.querySelectorAll('input[name="custom-topic"]:checked')).map(cb => cb.value);
    const qCountInput = document.getElementById('custom-q-input');
    const qCount = Math.max(1, Math.min(100, parseInt(qCountInput ? qCountInput.value : 30) || 30));
    
    const eraRadio = document.querySelector('input[name="custom-era"]:checked');
    const era = eraRadio ? eraRadio.value : 'ALL';

    const types = [];
    if (document.getElementById('custom-type-mcq')?.checked) types.push('MCQ');
    if (document.getElementById('custom-type-msq')?.checked) types.push('MSQ');
    if (document.getElementById('custom-type-nat')?.checked) types.push('NAT');

    // Solved status selection
    const solvedRadio = document.querySelector('input[name="custom-solved-status"]:checked');
    const solvedStatus = solvedRadio ? solvedRadio.value : 'ALL';

    // Difficulty selection
    const diffCheckboxes = document.querySelectorAll('input[name="custom-difficulty"]:checked');
    let difficulties = Array.from(diffCheckboxes).map(cb => cb.value);
    if (difficulties.length === 0 || difficulties.includes('ALL')) {
      difficulties = ['ALL'];
    }

    // Difficulty source mode selection (combined vs user_tagged vs suggested)
    const diffSourceRadio = document.querySelector('input[name="custom-diff-source"]:checked');
    const diffSource = diffSourceRadio ? diffSourceRadio.value : 'combined';

    const titleInput = document.getElementById('custom-test-title');
    const title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : 'IIT JAM Mathematics Custom Practice Test';

    return {
      topicIds: selectedTopics,
      questionCount: qCount,
      eraFilter: era,
      types: types,
      solvedStatus: solvedStatus,
      difficulties: difficulties,
      difficultySource: diffSource,
      title: title
    };
  };

  window.onDiffSourceChange = function(val) {
    const noteEl = document.getElementById('custom-diff-help-note');
    if (noteEl) {
      if (val === 'user_tagged') {
        noteEl.innerHTML = '★ <strong>User Tagged Only:</strong> Only questions you personally rated (★ My Tag) will be included in the pool. Questions without your rating are excluded.';
      } else if (val === 'suggested') {
        noteEl.innerHTML = '🏛️ <strong>Pre-Suggested Only:</strong> Questions are evaluated purely using the official IIT JAM pre-suggested exam benchmarks (ignoring personal tags).';
      } else {
        noteEl.innerHTML = '🔄 <strong>Combined Mode (Default):</strong> Matches questions using your personal rating (★ My Tag) when tagged; otherwise falls back to the pre-suggested exam benchmark.';
      }
    }
    window.updateCustomGeneratorSummary();
  };

  window.handleDifficultyFilterChange = function(clickedCb) {
    const allCb = document.querySelector('input[name="custom-difficulty"][value="ALL"]');
    const specificCbs = document.querySelectorAll('input[name="custom-difficulty"]:not([value="ALL"])');

    if (clickedCb && clickedCb.value === 'ALL') {
      if (clickedCb.checked) {
        specificCbs.forEach(cb => { cb.checked = false; });
      } else {
        clickedCb.checked = true;
      }
    } else {
      const anySpecificChecked = Array.from(specificCbs).some(cb => cb.checked);
      if (anySpecificChecked) {
        if (allCb) allCb.checked = false;
      } else {
        if (allCb) allCb.checked = true;
      }
    }

    window.updateCustomGeneratorSummary();
  };

  window.applyCustomDifficultyPreset = function(presetKey) {
    const allCb = document.querySelector('input[name="custom-difficulty"][value="ALL"]');
    const specificCbs = document.querySelectorAll('input[name="custom-difficulty"]:not([value="ALL"])');

    specificCbs.forEach(cb => { cb.checked = false; });
    if (allCb) allCb.checked = false;

    if (presetKey === 'all') {
      if (allCb) allCb.checked = true;
    } else if (presetKey === 'easy') {
      const vEasy = document.querySelector('input[name="custom-difficulty"][value="very_easy"]');
      const easy = document.querySelector('input[name="custom-difficulty"][value="easy"]');
      if (vEasy) vEasy.checked = true;
      if (easy) easy.checked = true;
    } else if (presetKey === 'medium') {
      const med = document.querySelector('input[name="custom-difficulty"][value="medium"]');
      if (med) med.checked = true;
    } else if (presetKey === 'hard') {
      const hard = document.querySelector('input[name="custom-difficulty"][value="hard"]');
      if (hard) hard.checked = true;
    } else if (presetKey === 'challenging') {
      const hard = document.querySelector('input[name="custom-difficulty"][value="hard"]');
      const hardest = document.querySelector('input[name="custom-difficulty"][value="hardest"]');
      if (hard) hard.checked = true;
      if (hardest) hardest.checked = true;
    }

    window.updateCustomGeneratorSummary();
  };

  window.updateCustomGeneratorSummary = function() {
    if (!window.JAM_CUSTOM_GENERATOR || !window.MOCK_TESTS_DATA) {
      setTimeout(window.updateCustomGeneratorSummary, 100);
      return;
    }

    const config = window.getCustomGeneratorConfig();
    const pool = window.JAM_CUSTOM_GENERATOR.collectMatchingQuestions(config);
    const requestedCount = config.questionCount;
    const actualCount = Math.min(requestedCount, pool.length);

    // Get tracker user data for pool counts
    let userQuestions = {};
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function') {
      const uData = window.JAM_TRACKER.getUserData();
      userQuestions = uData && uData.questions ? uData.questions : {};
    } else {
      try {
        const raw = localStorage.getItem('jam_pyq_user_tracker_v1');
        if (raw) userQuestions = JSON.parse(raw).questions || {};
      } catch (e) {}
    }

    let userTaggedCount = 0;
    let preSuggestedCount = 0;
    let solvedCount = 0;
    let unsolvedCount = 0;

    pool.forEach(q => {
      const yrMatch = (q.year || '').toString().match(/\d{4}/);
      const yr = yrMatch ? parseInt(yrMatch[0]) : 2020;
      const num = q.q_num || q.question_number || 1;
      const normId = q.id && String(q.id).startsWith('JAM_') ? String(q.id) : `JAM_${yr}_Q${num}`;
      const uState = userQuestions[normId] || {};
      if (uState.solved) solvedCount++; else unsolvedCount++;

      const qDiff = window.getJAMQuestionDifficulty ? window.getJAMQuestionDifficulty(normId, {
        marks: q.marks,
        type: q.type,
        qNum: num,
        year: yr
      }) : null;
      if (qDiff && qDiff.isUserTagged) userTaggedCount++; else preSuggestedCount++;
    });

    // Estimate marks
    let estMarks = 0;
    if (pool.length > 0) {
      const samplePreview = window.JAM_CUSTOM_GENERATOR.sampleQuestions(pool, actualCount, 42);
      estMarks = samplePreview.reduce((sum, q) => sum + (q.marks || 1), 0);
    }
    const estMins = Math.max(15, Math.round(actualCount * 3.0));

    // Update UI elements
    const totalTopicsAvailable = document.querySelectorAll('input[name="custom-topic"]').length || 10;
    const topicsCountEl = document.getElementById('summary-topics-count');
    if (topicsCountEl) topicsCountEl.textContent = `${config.topicIds.length} / ${totalTopicsAvailable}`;

    const poolCountEl = document.getElementById('summary-pool-count');
    if (poolCountEl) {
      poolCountEl.textContent = `${pool.length} Qs`;
      poolCountEl.title = `Available pool: ${pool.length} questions (${solvedCount} Solved, ${unsolvedCount} Unsolved • ${userTaggedCount} User-Tagged, ${preSuggestedCount} Pre-Suggested)`;
    }

    const qCountEl = document.getElementById('summary-questions-count');
    if (qCountEl) qCountEl.textContent = `${actualCount} Qs`;

    const marksCountEl = document.getElementById('summary-marks-count');
    if (marksCountEl) marksCountEl.textContent = `~${estMarks} Marks`;

    const timeCountEl = document.getElementById('summary-time-count');
    if (timeCountEl) timeCountEl.textContent = `${estMins} Mins`;

    const structLabel = document.getElementById('summary-structure-label');
    if (structLabel) {
      const typesStr = config.types.join(' • ') || 'None';
      structLabel.textContent = typesStr;
    }

    // Solved status metric
    const solvedLabelEl = document.getElementById('summary-solved-label');
    if (solvedLabelEl) {
      if (config.solvedStatus === 'unsolved') {
        solvedLabelEl.textContent = '⭕ Unsolved Only';
        solvedLabelEl.style.color = '#38bdf8';
      } else if (config.solvedStatus === 'solved') {
        solvedLabelEl.textContent = '✓ Solved Only';
        solvedLabelEl.style.color = 'var(--green)';
      } else {
        solvedLabelEl.textContent = 'All Questions';
        solvedLabelEl.style.color = '#94a3b8';
      }
    }

    // Difficulty filter metric
    const diffLabelEl = document.getElementById('summary-diff-label');
    if (diffLabelEl) {
      const diffMap = {
        'very_easy': '🟢 V.Easy',
        'easy': '🔵 Easy',
        'medium': '🟡 Medium',
        'hard': '🟠 Hard',
        'hardest': '🟣 Hardest'
      };
      let diffNames = 'All Levels';
      if (config.difficulties.length > 0 && !config.difficulties.includes('ALL')) {
        diffNames = config.difficulties.map(d => diffMap[d] || d).join(', ');
      }

      const sourceTag = config.difficultySource === 'user_tagged' ? ' (★ User Tagged)' 
        : (config.difficultySource === 'suggested' ? ' (🏛️ Pre-Suggested)' : ' (Combined)');
      diffLabelEl.textContent = `${diffNames}${sourceTag}`;
    }

    // Toggle button disabled state
    const btnPdf = document.getElementById('btn-generate-custom-pdf');
    const btnCbt = document.getElementById('btn-start-custom-cbt');
    const isValid = config.topicIds.length > 0 && config.types.length > 0 && pool.length > 0;

    if (btnPdf) btnPdf.disabled = !isValid;
    if (btnCbt) btnCbt.disabled = !isValid;
  };

  // --- Online / Offline Status Monitoring ---
  window.updateOnlineStatus = function() {
    const banner = document.getElementById('custom-offline-banner');
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (banner) {
      if (isOffline) banner.classList.remove('hidden');
      else banner.classList.add('hidden');
    }
  };

  window.addEventListener('online', () => window.updateOnlineStatus());
  window.addEventListener('offline', () => window.updateOnlineStatus());

  window.triggerCustomPdfGeneration = async function() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      window.updateOnlineStatus();
      alert('⚠️ Internet Connection Required: You appear to be offline. An active internet connection is required to download official question screenshots for compiling the custom PDF. Please connect to the internet and try again.');
      return;
    }

    const config = window.getCustomGeneratorConfig();
    if (config.topicIds.length === 0) {
      alert('Please select at least one syllabus topic.');
      return;
    }
    if (config.types.length === 0) {
      alert('Please select at least one question type (MCQ, MSQ, or NAT).');
      return;
    }

    const modal = document.getElementById('pdf-progress-modal');
    const fill = document.getElementById('pdf-progress-fill');
    const pctEl = document.getElementById('pdf-progress-pct');
    const statusEl = document.getElementById('pdf-progress-status');
    const titleEl = document.getElementById('pdf-progress-title');

    if (modal) modal.classList.remove('hidden');
    if (titleEl) titleEl.textContent = '📑 Compiling Publication LaTeX PDF...';

    try {
      await window.JAM_CUSTOM_GENERATOR.generateCustomPdf(config, (progressPct, statusText) => {
        if (fill) fill.style.width = `${progressPct}%`;
        if (pctEl) pctEl.textContent = `${progressPct}%`;
        if (statusEl) statusEl.textContent = statusText;
      });

      if (statusEl) statusEl.textContent = '✅ PDF Generated and downloaded successfully!';
      setTimeout(() => {
        if (modal) modal.classList.add('hidden');
      }, 1500);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      if (modal) modal.classList.add('hidden');
      alert(`⚠️ PDF Generation Error:\n\n${err.message || err}`);
    }
  };

  window.triggerCustomOnlineTest = function() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      window.updateOnlineStatus();
      alert('⚠️ Internet Connection Required: You appear to be offline. An active internet connection is required to load question screenshots in the CBT simulator.');
      return;
    }

    const config = window.getCustomGeneratorConfig();
    if (config.topicIds.length === 0) {
      alert('Please select at least one syllabus topic.');
      return;
    }

    const pool = window.JAM_CUSTOM_GENERATOR.collectMatchingQuestions(config);
    if (pool.length === 0) {
      alert('No matching questions found in pool. Please adjust your topic/era selections.');
      return;
    }

    const actualCount = Math.min(config.questionCount, pool.length);
    const sampled = window.JAM_CUSTOM_GENERATOR.sampleQuestions(pool, actualCount);
    const totalMarks = sampled.reduce((sum, q) => sum + (q.marks || 1), 0);
    const durationMins = Math.max(15, Math.round(actualCount * 3.0));

    // Enrich with question difficulty
    const enrichedSampled = sampled.map(q => {
      const qDiff = window.getJAMQuestionDifficulty ? window.getJAMQuestionDifficulty(q.id, {
        marks: q.marks,
        type: q.type,
        qNum: q.q_num,
        year: q.year
      }) : null;
      return {
        ...q,
        difficulty: qDiff ? qDiff.id : 'medium'
      };
    });

    const customTestData = {
      id: "custom",
      name: config.title,
      category: "Custom Topic Practice Test",
      era: config.eraFilter || "cbt",
      solved_status: config.solvedStatus || "ALL",
      difficulty_source: config.difficultySource || "combined",
      total_questions: enrichedSampled.length,
      total_marks: totalMarks,
      duration_minutes: durationMins,
      pattern: "MCQ • MSQ • NAT",
      questions: enrichedSampled
    };

    try {
      sessionStorage.setItem('jam_custom_test', JSON.stringify(customTestData));
      window.location.href = 'mock-test/test.html?topic=custom&mode=official';
    } catch (e) {
      console.error('Failed to save custom test to sessionStorage:', e);
      alert('Could not initialize CBT simulator: ' + e.message);
    }
  };

  window.openCustomQuestionsPreview = function() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      window.updateOnlineStatus();
      alert('⚠️ Internet Connection Required: You appear to be offline. An active internet connection is required to fetch question screenshots.');
      return;
    }

    const config = window.getCustomGeneratorConfig();
    const pool = window.JAM_CUSTOM_GENERATOR.collectMatchingQuestions(config);
    if (pool.length === 0) {
      alert('No questions match your current selection.');
      return;
    }

    const actualCount = Math.min(config.questionCount, pool.length);
    const sampled = window.JAM_CUSTOM_GENERATOR.sampleQuestions(pool, actualCount, 42);

    const countEl = document.getElementById('preview-total-count');
    if (countEl) countEl.textContent = `${sampled.length}`;

    // Get tracker user data for solved status
    let userQuestions = {};
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function') {
      const uData = window.JAM_TRACKER.getUserData();
      userQuestions = uData && uData.questions ? uData.questions : {};
    } else {
      try {
        const raw = localStorage.getItem('jam_pyq_user_tracker_v1');
        if (raw) userQuestions = JSON.parse(raw).questions || {};
      } catch (e) {}
    }

    const body = document.getElementById('custom-preview-body');
    if (body) {
      body.innerHTML = sampled.map((q, idx) => {
        const qNum = idx + 1;
        const qType = (q.type || 'MCQ').toUpperCase();
        const typeBadgeClass = qType === 'MCQ' ? 'tag-cbt' : (qType === 'MSQ' ? 'tag-recent' : 'tag-archive');
        
        const yrMatch = (q.year || '').toString().match(/\d{4}/);
        const yr = yrMatch ? parseInt(yrMatch[0]) : 2020;
        const qNumVal = q.q_num || q.question_number || qNum;
        const normId = q.id && String(q.id).startsWith('JAM_') ? String(q.id) : `JAM_${yr}_Q${qNumVal}`;
        const uState = userQuestions[normId] || {};
        const isSolved = !!uState.solved;

        const qDiff = window.getJAMQuestionDifficulty ? window.getJAMQuestionDifficulty(normId, {
          marks: q.marks,
          type: q.type,
          qNum: qNumVal,
          year: yr
        }) : { label: 'Medium', class: 'diff-medium', icon: '🟡', isUserTagged: false };

        // Explicitly clear difficulty badge showing whether it's User Tagged or Pre-Suggested
        const diffBadgeHtml = qDiff.isUserTagged
          ? `<span class="q-diff-badge ${qDiff.class} size-sm is-user-tagged" style="background:${qDiff.bg}; color:${qDiff.color}; border:1px solid ${qDiff.border};" title="Your Custom Rating: ${qDiff.label}"><span>${qDiff.icon}</span> <span>${qDiff.label}</span> <span class="diff-tag-pill user">★ My Tag</span></span>`
          : `<span class="q-diff-badge ${qDiff.class} size-sm is-suggested" style="background:${qDiff.bg}; color:${qDiff.color}; border:1px dashed ${qDiff.border};" title="Official Pre-Suggested Exam Benchmark: ${qDiff.label}"><span>${qDiff.icon}</span> <span>${qDiff.label}</span> <span class="diff-tag-pill unrated">(Pre-Suggested)</span></span>`;

        const solvedBadge = isSolved
          ? `<span class="preview-status-pill solved">✓ Solved</span>`
          : `<span class="preview-status-pill unsolved">⭕ Unsolved</span>`;

        return `
          <div style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; background: var(--bg-card);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Q${qNum}</strong>
                <span style="color: var(--text-secondary); font-size: 12px;">${q.year} • Q${q.q_num || qNum} (${q.id})</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <span class="era-tag ${typeBadgeClass}">${qType}</span>
                ${solvedBadge}
                ${diffBadgeHtml}
                <span class="era-tag" style="background: var(--accent-dim); color: var(--accent);">+${q.marks || 1} M</span>
                <span style="font-size: 11px; font-weight: 600; color: var(--green); margin-left: 6px;">Key: ${q.answer_key || 'N/A'}</span>
              </div>
            </div>
            <div style="text-align: center; background: #fff; border-radius: 6px; padding: 8px;">
              <img src="${q.image}" alt="Question ${qNum}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" loading="lazy">
            </div>
          </div>
        `;
      }).join('');
    }

    const modal = document.getElementById('custom-preview-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeCustomQuestionsPreview = function() {
    const modal = document.getElementById('custom-preview-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.launchTopicCustomGenerator = function(topicId) {
    window.switchTab('custom-generator');
    const cleanId = String(topicId).replace(/^\d{4}-\d{4}_/, '').trim();
    document.querySelectorAll('input[name="custom-topic"]').forEach(cb => {
      cb.checked = (cb.value === cleanId || cb.value === topicId);
    });
    window.updateCustomGeneratorSummary();
    const configCard = document.querySelector('.custom-config-card');
    if (configCard) {
      configCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.quickLaunchTopicDifficultyDrill = function(diffPreset) {
    window.switchTab('custom-generator');
    window.customGeneratorSelectAll(true);
    window.applyCustomDifficultyPreset(diffPreset);
    const summaryCard = document.querySelector('.custom-summary-card');
    if (summaryCard) {
      summaryCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // --- Hash Navigation Support ---
  function handleUrlHash() {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (!hash) return;
    const validTabs = ['year-tests', 'pyq-tracker', 'topic-tests', 'custom-generator', 'resources'];
    if (validTabs.includes(hash)) {
      window.switchMainTab(hash);
    }
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', () => {
    window.initTheme();
    window.renderYearMockTests();
    window.renderTopicMockTests();
    window.initCustomGenerator();
    window.updateOnlineStatus();
    handleUrlHash();
  });

  window.addEventListener('hashchange', handleUrlHash);

})();
