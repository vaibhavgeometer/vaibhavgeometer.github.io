/**
 * UNPG Padrauna & DDUGU B.Sc. Semester Exams Portal - Main Script
 * Manages Tab Switching, Exam Paper Grid Rendering, Video Solutions Grid, Filters & Theme Toggle
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

  // Tab Switcher between Exam Papers, Video Solutions, and Study Materials Hub
  window.switchMainTab = function(tabId, btn) {
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = btn || document.getElementById(`tab-btn-${tabId}`);
    if (targetBtn) targetBtn.classList.add('active');

    const panels = {
      'exam-papers': document.getElementById('tab-panel-exam-papers'),
      'videos': document.getElementById('tab-panel-videos'),
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

    if (tabId === 'videos') {
      renderVideoSolutions();
    }
  };

  // Filter Exam Papers & Videos by Course or Year
  window.filterCourses = function(courseCode, btn) {
    currentCourseFilter = courseCode;
    document.querySelectorAll('.course-filter-btn').forEach(b => {
      if (b.getAttribute('data-course') === courseCode || (!b.getAttribute('data-course') && b.textContent.includes(courseCode))) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    if (btn) btn.classList.add('active');
    renderExamPapers();
    renderVideoSolutions();
  };

  window.filterYears = function(year, btn) {
    currentYearFilter = year;
    document.querySelectorAll('.year-filter-btn').forEach(b => {
      if (b.getAttribute('data-year') === year || (!b.getAttribute('data-year') && b.textContent.includes(year))) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    if (btn) btn.classList.add('active');
    renderExamPapers();
    renderVideoSolutions();
  };

  // Render Exam Paper Cards from window.MOCK_TESTS_DATA
  function renderExamPapers() {
    const container = document.getElementById('exam-papers-container');
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
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">No Examination Papers Found</h3>
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
      const pdfFileName = `${t.id}_Official_Exam_Paper.pdf`;
      const pdfPath = `assets/pdfs/${pdfFileName}`;

      // Build Video Solution Button(s)
      let videoBtnsHtml = '';
      if (t.videos && t.videos.length > 0) {
        if (t.videos.length === 1) {
          const v = t.videos[0];
          videoBtnsHtml = `
            <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="btn-test btn-video-yt" style="width: 100%; padding: 9px 14px; font-size: 0.85rem;" title="Watch complete solution for ${t.course_code} (${t.year}) on YouTube">
              <svg class="yt-icon" viewBox="0 0 24 24" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>▶ Watch Video Solution</span>
            </a>
          `;
        } else {
          videoBtnsHtml = `
            <div style="display: flex; gap: 8px;">
              ${t.videos.map((v) => `
                <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="btn-test btn-video-yt" style="flex: 1; padding: 8px 8px; font-size: 0.8rem;" title="Watch ${v.title} on YouTube">
                  <svg class="yt-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <span>${v.title}</span>
                </a>
              `).join('')}
            </div>
          `;
        }
      }

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
              Official University Examination Paper with all 50 MCQs, questions &amp; all 4 options clearly visible, master verified answer key table, and full YouTube video solution.
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
              ${videoBtnsHtml}
              <a href="${pdfPath}" download="${pdfFileName}" class="btn-test primary" style="width: 100%; padding: 10px 14px; font-size: 0.88rem;">
                📥 Download Exam Paper (PDF)
              </a>
              <a href="${pdfPath}" target="_blank" class="btn-test secondary" style="width: 100%; padding: 8px 14px; font-size: 0.82rem;">
                📄 View / Open PDF in Browser
              </a>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Render Dedicated Video Solutions Grid
  function renderVideoSolutions() {
    const container = document.getElementById('video-solutions-container');
    if (!container) return;

    if (!window.MOCK_TESTS_DATA) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">Loading video datasets...</div>';
      return;
    }

    const testKeys = Object.keys(window.MOCK_TESTS_DATA);
    let videoList = [];
    testKeys.forEach(k => {
      const t = window.MOCK_TESTS_DATA[k];
      const courseMatch = (currentCourseFilter === 'ALL' || t.course_code === currentCourseFilter);
      const yearMatch = (currentYearFilter === 'ALL' || t.year === currentYearFilter);
      if (!courseMatch || !yearMatch) return;

      if (t.videos && t.videos.length) {
        t.videos.forEach(v => {
          videoList.push({
            test: t,
            video: v
          });
        });
      }
    });

    // Sort by course code then year descending
    videoList.sort((a, b) => {
      if (a.test.course_code !== b.test.course_code) return a.test.course_code.localeCompare(b.test.course_code);
      if (a.test.year !== b.test.year) return b.test.year.localeCompare(a.test.year);
      return a.video.title.localeCompare(b.video.title);
    });

    if (videoList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">No Video Solutions Found</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">No videos match the selected filters. Try selecting "All Courses" or "All Years".</p>
        </div>
      `;
      return;
    }

    let html = '';
    videoList.forEach(item => {
      const t = item.test;
      const v = item.video;
      const meta = COURSE_META[t.course_code] || { name: t.course_title, icon: '📚', color: '#38bdf8' };
      const thumbUrl = `https://img.youtube.com/vi/${v.yt_id}/mqdefault.jpg`;
      const pdfFileName = `${t.id}_Official_Exam_Paper.pdf`;
      const pdfPath = `assets/pdfs/${pdfFileName}`;

      html += `
        <div class="video-card topic-card" style="border-top: 3px solid ${meta.color}; display: flex; flex-direction: column;">
          <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="video-thumb-link" title="Play ${t.course_code} ${t.year} on YouTube">
            <div class="video-thumb-wrap">
              <img src="${thumbUrl}" alt="${t.course_code} ${t.year} ${v.title}" class="video-thumb-img" loading="lazy">
              <div class="video-play-overlay">
                <svg viewBox="0 0 68 48" width="52" height="36"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#ff0000"></path><path d="M45 24L27 14v20" fill="#ffffff"></path></svg>
              </div>
              <span class="video-duration-tag">▶ YouTube</span>
            </div>
          </a>
          <div class="topic-card-body" style="padding-top: 14px; display: flex; flex-direction: column; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
              <span class="course-code" style="color: ${meta.color}; font-size: 1.05rem; font-weight: 700;">
                ${meta.icon} ${t.course_code}
              </span>
              <span class="topic-badge" style="background: rgba(255,255,255,0.06); color: var(--text-main); border: 1px solid var(--border); font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;">
                ${t.year}
              </span>
            </div>

            <h3 class="topic-card-title" style="font-size: 1.05rem; margin-bottom: 4px; line-height: 1.35;">
              ${t.course_title || meta.name}
            </h3>
            <div style="font-size: 0.88rem; font-weight: 600; color: #f87171; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>▶</span> ${v.title}
            </div>

            <p class="topic-card-desc" style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 14px;">
              Complete university examination paper video walkthrough with detailed solutions and option analysis.
            </p>

            <div style="display: flex; gap: 8px; flex-direction: column; margin-top: auto;">
              <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="btn-test btn-video-yt" style="width: 100%; padding: 10px 14px; font-size: 0.88rem;">
                <svg class="yt-icon" viewBox="0 0 24 24" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                <span>Watch on YouTube</span>
              </a>
              <a href="${pdfPath}" target="_blank" class="btn-test secondary" style="width: 100%; padding: 8px 14px; font-size: 0.82rem;">
                📄 View Question Paper (PDF)
              </a>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

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

  // Check URL Hash on Load & Hash Changes
  function handleHash() {
    const hash = window.location.hash;
    if (hash === '#videos' || hash === '#video-solutions') {
      window.switchMainTab('videos');
    } else if (hash === '#courses' || hash === '#materials' || hash === '#resources') {
      window.switchMainTab('resources');
    } else if (hash === '#exam-papers') {
      window.switchMainTab('exam-papers');
    }
  }

  // Init
  function init() {
    const savedTheme = localStorage.getItem('jam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    renderExamPapers();
    renderVideoSolutions();

    handleHash();
    window.addEventListener('hashchange', handleHash);

    // Re-check after small delay if questions_data was still loading
    if (!window.MOCK_TESTS_DATA) {
      setTimeout(() => {
        renderExamPapers();
        renderVideoSolutions();
      }, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
