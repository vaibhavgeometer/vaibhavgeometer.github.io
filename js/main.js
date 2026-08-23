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
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const activePanel = document.getElementById(`tab-panel-${tabId}`);
    if (activePanel) {
      activePanel.classList.remove('hidden');
    }
  };

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

      const pdfLink = t.paper_pdf
        ? `<a href="${t.paper_pdf}" target="_blank" rel="noopener noreferrer" class="btn-test secondary" title="View Original Question Paper PDF">📄 PDF Paper</a>`
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
            <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-test primary" title="Start Timed Examination">⚡ Start Mock Test</a>
            <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-test secondary" title="Practice without Timer">📖 Practice Mode</a>
            ${pdfLink}
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

      const cheatBtn = t.cheat_sheet 
        ? `<a href="${t.cheat_sheet}" target="_blank" rel="noopener noreferrer" class="btn-test cheat" title="Open Formula Cheat Sheet">📑 Cheat Sheet</a>`
        : '';

      const eraBadgeLabel = t.era_label || (isComprehensive ? '2005–2026 Archive' : t.era);

      let actionButtons = '';
      if (!isZeroQuestions) {
        actionButtons = `
          <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-test primary" title="Take Timed CBT Exam">⚡ Start Mock Test</a>
          <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-test secondary" title="Practice without Timer">📖 Practice Mode</a>
          ${cheatBtn}
        `;
      } else {
        actionButtons = `
          <span class="btn-test disabled" title="This topic was not part of the JAM syllabus during this era">0 Qs (Added in 2022)</span>
          ${cheatBtn}
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
              <span class="meta-value">${isZeroQuestions ? 'Not in Era Syllabus' : (t.era === '2005-2014' ? 'Classic Pattern' : 'MCQ • MSQ • NAT')}</span>
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

  window.filterTopics = function(cat, btn) {
    window.filterTopicCategory(cat, btn);
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

  // --- Cheat Sheets Modal ---
  window.openCheatSheetsModal = function() {
    const modal = document.getElementById('cheatsheets-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeCheatSheetsModal = function() {
    const modal = document.getElementById('cheatsheets-modal');
    if (modal) modal.classList.add('hidden');
  };

  // --- Init ---
  document.addEventListener('DOMContentLoaded', () => {
    window.initTheme();
    window.renderYearMockTests();
    window.renderTopicMockTests();
  });

})();
