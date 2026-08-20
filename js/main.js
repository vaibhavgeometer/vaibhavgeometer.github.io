/**
 * IIT JAM Mock Test — Main Portal Logic (Minimalistic)
 * Theme management, topic card rendering, and filtering.
 */

(function() {

  // --- Theme ---
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

  // --- Render Topic Cards ---
  window.renderPortalMockTests = function() {
    const container = document.getElementById('topics-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      setTimeout(window.renderPortalMockTests, 100);
      return;
    }

    const topics = Object.values(window.MOCK_TESTS_DATA);
    container.innerHTML = topics.map(t => {
      const bestScore = localStorage.getItem(`jam_score_${t.id}`);
      const scoreBadge = bestScore !== null
        ? `<span class="best-score">★ Best: ${bestScore}/${t.total_marks}</span>`
        : '';

      const cheatBtn = t.cheat_sheet 
        ? `<a href="${t.cheat_sheet}" target="_blank" class="btn-test cheat" title="View ${t.name} Concept & Formula Cheat Sheet">📑 Cheat Sheet</a>`
        : '';

      return `
        <div class="topic-card" data-category="${t.category}">
          <div class="topic-card-top">
            <span class="topic-num">${t.id}</span>
            ${scoreBadge}
          </div>
          <h3 class="topic-card-title">${t.name}</h3>
          <div class="topic-meta">
            <div class="topic-meta-item">
              <span class="meta-label">Questions</span>
              <span class="meta-value">${t.total_questions}</span>
            </div>
            <div class="topic-meta-item">
              <span class="meta-label">Marks</span>
              <span class="meta-value">${t.total_marks}</span>
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
            <a href="mock-test/test.html?topic=${t.id}&mode=official" class="btn-test primary" title="Take Timed CBT Exam">⚡ Start Test</a>
            <a href="mock-test/test.html?topic=${t.id}&mode=practice" class="btn-test secondary" title="Practice without Timer">📖 Practice</a>
            ${cheatBtn}
          </div>
        </div>
      `;
    }).join('');
  };

  // --- Filter Topics ---
  window.filterTopics = function(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
    window.renderPortalMockTests();
  });

})();
