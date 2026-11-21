/**
 * UNPG Padrauna & DDUGU B.Sc. Semester Exams Portal - Main Script
 * Manages Tab Switching, Dynamic Test Grid Rendering, Filters & Theme Toggle
 */

(function() {
  'use strict';

  let currentCourseFilter = 'ALL';
  let currentYearFilter = 'ALL';

  // Course Color & Icon Map
  const COURSE_META = {
    'MAT301F': { name: 'Ring Theory & Linear Algebra', icon: '📐', credits: '4 Credits', color: '#38bdf8' },
    'MAT302F': { name: 'Tensor Analysis', icon: '🌐', credits: '3 Credits', color: '#818cf8' },
    'MAT303F': { name: 'Differential Geometry', icon: '📈', credits: '3 Credits', color: '#34d399' },
    'PHY301F': { name: 'Classical & Statistical Mechanics', icon: '⚙️', credits: '4 Credits', color: '#fbbf24' },
    'PHY302F': { name: 'Quantum Mechanics & Spectroscopy', icon: '⚛️', credits: '4 Credits', color: '#c084fc' }
  };

  // Tab Switcher
  window.switchMainTab = function(tabId, btn) {
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const panels = {
      'year-tests': document.getElementById('tab-panel-year-tests'),
      'custom-generator': document.getElementById('tab-panel-custom-generator'),
      'resources': document.getElementById('tab-panel-resources')
    };

    Object.keys(panels).forEach(key => {
      const p = panels[key];
      if (p) {
        if (key === tabId) {
          p.classList.remove('hidden');
        } else {
          p.classList.add('hidden');
        }
      }
    });

    if (tabId === 'custom-generator' && window.updateCustomGeneratorSummary) {
      window.updateCustomGeneratorSummary();
    }
  };

  // Filter Mock Tests by Course or Year
  window.filterCourses = function(courseCode, btn) {
    currentCourseFilter = courseCode;
    document.querySelectorAll('.course-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderMockTests();
  };

  window.filterYears = function(year, btn) {
    currentYearFilter = year;
    document.querySelectorAll('.year-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderMockTests();
  };

  // Render Mock Test Cards from window.MOCK_TESTS_DATA
  function renderMockTests() {
    const container = document.getElementById('year-tests-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">Loading examination question datasets...</div>';
      return;
    }

    const testKeys = Object.keys(window.MOCK_TESTS_DATA);
    let filteredKeys = testKeys.filter(k => {
      const t = window.MOCK_TESTS_DATA[k];
      const courseMatch = (currentCourseFilter === 'ALL' || t.course_code === currentCourseFilter);
      const yearMatch = (currentYearFilter === 'ALL' || t.year === currentYearFilter);
      return courseMatch && yearMatch;
    });

    // Sort order: by course code then year descending
    filteredKeys.sort((a, b) => {
      const tA = window.MOCK_TESTS_DATA[a];
      const tB = window.MOCK_TESTS_DATA[b];
      if (tA.course_code !== tB.course_code) return tA.course_code.localeCompare(tB.course_code);
      return b.localeCompare(a);
    });

    if (filteredKeys.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">No Mock Tests Found</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">No question papers match the selected filter combination. Try selecting "All Courses" or "All Years".</p>
        </div>
      `;
      return;
    }

    let html = '';
    filteredKeys.forEach(key => {
      const t = window.MOCK_TESTS_DATA[key];
      const meta = COURSE_META[t.course_code] || { name: t.course_title, icon: '📚', credits: '3 Credits', color: '#38bdf8' };
      const qCount = t.total_questions || (t.questions ? t.questions.length : 50);
      const marksCount = t.total_marks || (qCount * 1.5);
      const minsCount = t.duration_minutes || 90;

      html += `
        <div class="topic-card" style="border-top: 3px solid ${meta.color};">
          <div class="topic-card-body">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
              <span class="course-code" style="color: ${meta.color}; font-size: 1.1rem; font-weight: 700;">
                ${meta.icon} ${t.course_code}
              </span>
              <span class="topic-badge" style="background: rgba(255,255,255,0.06); color: var(--text-main); border: 1px solid var(--border); font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;">
                ${t.year}
              </span>
            </div>

            <h3 class="topic-card-title" style="font-size: 1.05rem; margin-bottom: 6px; line-height: 1.4;">
              ${t.course_title || meta.name}
            </h3>

            <p class="topic-card-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px;">
              DDUGU & UNPG Padrauna Official Semester Examination Paper with high-resolution question screenshots and master verified solutions.
            </p>

            <div class="topic-meta-list" style="margin-bottom: 16px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
              <div class="topic-meta-item">
                <span class="meta-lbl">Questions</span>
                <span class="meta-val" style="color: #38bdf8;">${qCount} MCQs</span>
              </div>
              <div class="topic-meta-item">
                <span class="meta-lbl">Total Marks</span>
                <span class="meta-val" style="color: #4ade80;">${marksCount} Marks</span>
              </div>
              <div class="topic-meta-item">
                <span class="meta-lbl">Duration</span>
                <span class="meta-val" style="color: #f59e0b;">${minsCount} Mins</span>
              </div>
              <div class="topic-meta-item">
                <span class="meta-lbl">Marking</span>
                <span class="meta-val" style="color: #a78bfa;">+1.5 | 0 Neg.</span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-direction: column;">
              <a href="mock-test/test.html?test=${t.id}" class="btn-action btn-save-next" style="text-decoration: none; text-align: center; justify-content: center; padding: 10px 14px; font-weight: 700; font-size: 0.88rem;">
                ⚡ Start Interactive CBT Test
              </a>
              <button type="button" class="btn-action btn-secondary" onclick="window.downloadSinglePaperPdf('${t.id}')" style="justify-content: center; padding: 8px 14px; font-size: 0.82rem;">
                📥 Download Exam Paper (PDF)
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Download Single Paper PDF helper
  window.downloadSinglePaperPdf = async function(testId) {
    if (!window.MOCK_TESTS_DATA || !window.MOCK_TESTS_DATA[testId]) {
      alert('Paper data not available yet.');
      return;
    }
    const t = window.MOCK_TESTS_DATA[testId];
    
    // Check if custom PDF generator is available
    if (window.triggerCustomPdfGeneration) {
      // Set the course in generator
      document.querySelectorAll('input[name="custom-course"]').forEach(cb => {
        cb.checked = (cb.value === t.course_code);
      });
      const yearRadio = document.querySelector(`input[name="custom-year"][value="${t.year}"]`);
      if (yearRadio) yearRadio.checked = true;
      const countInput = document.getElementById('custom-q-slider');
      if (countInput) countInput.value = 50;

      window.triggerCustomPdfGeneration();
    } else {
      window.location.href = `mock-test/test.html?test=${testId}`;
    }
  };

  // Theme Toggling
  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('jam_theme', next);
    updateThemeIcon(next);
  };

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '🌙';
  }

  // Init
  function init() {
    const savedTheme = localStorage.getItem('jam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    renderMockTests();

    // Re-check after small delay if questions_data was still loading
    if (!window.MOCK_TESTS_DATA) {
      setTimeout(renderMockTests, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
