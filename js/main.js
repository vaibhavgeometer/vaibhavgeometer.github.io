/**
 * IIT JAM Mathematics Portal - Main Logic
 * 22-Year (2005-2026) Mock Tests, Topic-Wise Tests, Filters & Theme Management
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
    const btn = document.getElementById('theme-btn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
      btn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    }
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

  // --- Render Topic-Wise Mock Tests ---
  window.renderTopicMockTests = function() {
    const container = document.getElementById('topics-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      setTimeout(window.renderTopicMockTests, 100);
      return;
    }

    const allData = window.MOCK_TESTS_DATA;
    // Filter keys that look like '1.1', '1.2', etc.
    const topicKeys = Object.keys(allData)
      .filter(k => /^\d+\.\d+$/.test(k))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    container.innerHTML = topicKeys.map(k => {
      const t = allData[k];
      const bestScore = localStorage.getItem(`jam_score_${t.id}`);
      const scoreBadge = bestScore !== null
        ? `<span class="best-score">★ Best: ${bestScore}/${t.total_marks}</span>`
        : '';

      const cheatBtn = t.cheat_sheet 
        ? `<a href="${t.cheat_sheet}" target="_blank" rel="noopener noreferrer" class="btn-test cheat" title="Open Formula Cheat Sheet">📑 Cheat Sheet</a>`
        : '';

      return `
        <div class="topic-card" data-category="${t.category}">
          <div class="topic-card-top">
            <span class="topic-num">Topic ${t.id}</span>
            <span class="era-tag tag-cbt">2005–2026 Archive</span>
            ${scoreBadge}
          </div>
          <h3 class="topic-card-title">${t.name}</h3>
          <div class="topic-meta">
            <div class="topic-meta-item">
              <span class="meta-label">Questions</span>
              <span class="meta-value">${t.total_questions || t.questions.length} Qs</span>
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
              <span class="meta-value">MCQ • MSQ • NAT</span>
            </div>
          </div>
          <div class="topic-actions">
            <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-test primary" title="Take Timed CBT Exam">⚡ Start Mock Test</a>
            <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-test secondary" title="Practice without Timer">📖 Practice Mode</a>
            ${cheatBtn}
          </div>
        </div>
      `;
    }).join('');
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

  // --- Filter Topic Tests ---
  window.filterTopics = function(cat, btn) {
    document.querySelectorAll('.topic-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.querySelectorAll('#topics-container .topic-card').forEach(card => {
      card.style.display = (cat === 'ALL' || card.dataset.category === cat) ? 'flex' : 'none';
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
