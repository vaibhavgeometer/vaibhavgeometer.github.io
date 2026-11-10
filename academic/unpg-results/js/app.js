/**
 * UNPG BSc Math 2024-2028 Results Application
 * High-performance, client-side interactive results portal
 */

(function () {
  'use strict';

  const data = window.RESULTS_DATA;
  if (!data) {
    console.error('RESULTS_DATA not loaded!');
    return;
  }

  // State
  let currentTab = 'search';
  let currentTopperSubtab = 'overall';
  let currentSemesterView = 1;
  let currentSubjectFilterSem = 'all';
  let currentSubjectFilterGroup = 'all';

  // Elements
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchResultsCount = document.getElementById('search-results-count');
  const studentsGrid = document.getElementById('students-grid');
  const searchEmpty = document.getElementById('search-empty');
  const statusFilter = document.getElementById('status-filter');

  // Modal Elements
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalContent = document.getElementById('modal-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Helper functions
  function getGradeClass(grade) {
    const clean = (grade || '').replace('*', '').replace('+', '_plus');
    return 'grade-' + clean;
  }

  function getInitials(name) {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatRank(rank) {
    if (rank === 1) return '🥇 Rank 1';
    if (rank === 2) return '🥈 Rank 2';
    if (rank === 3) return '🥉 Rank 3';
    return `#${rank}`;
  }

  // --- TAB SWITCHING ---
  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
    window.location.hash = tabId;
  }

  // --- SEARCH & FILTER LOGIC ---
  function filterStudents() {
    const rawQuery = (searchInput.value || '').trim();
    const query = rawQuery.toLowerCase();
    const statusVal = statusFilter ? statusFilter.value : 'all';

    searchClearBtn.style.display = rawQuery ? 'block' : 'none';

    let filtered = data.students.filter(student => {
      // Status filter
      if (statusVal === 'completed' && student.num_semesters !== 4) return false;
      if (statusVal === 'discontinued' && student.num_semesters === 4) return false;

      if (!query) return true;

      // Match last 3 digits
      if (query.length === 3 && /^\d{3}$/.test(query)) {
        if (student.last_3 === query) return true;
      }

      // Match full or partial roll number
      if (student.roll.toLowerCase().includes(query)) return true;

      // Match name
      if (student.name.toLowerCase().includes(query)) return true;

      // Match father's name
      if (student.father_name && student.father_name.toLowerCase().includes(query)) return true;

      return false;
    });

    renderStudents(filtered, rawQuery);
  }

  function renderStudents(studentsList, query) {
    searchResultsCount.innerHTML = `Showing <strong>${studentsList.length}</strong> of ${data.students.length} students`;

    if (studentsList.length === 0) {
      studentsGrid.style.display = 'none';
      searchEmpty.style.display = 'block';
      return;
    }

    studentsGrid.style.display = 'grid';
    searchEmpty.style.display = 'none';

    studentsGrid.innerHTML = studentsList.map(s => {
      const isTop = s.overall_cgpa_rank && s.overall_cgpa_rank <= 3;
      const rankBadge = s.overall_cgpa_rank ? `<span class="roll-last-tag" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-weight:700;">${formatRank(s.overall_cgpa_rank)}</span>` : '';

      const semPills = [1, 2, 3, 4].map(sem => {
        const present = s.semesters[String(sem)];
        if (present) {
          return `<span class="sem-pill completed" title="Sem ${sem}: ${present.result}">Sem ${sem} (SGPA ${present.sgpa.toFixed(2)})</span>`;
        }
        return `<span class="sem-pill discontinued" title="Not Enrolled">Sem ${sem} (—)</span>`;
      }).join('');

      return `
        <div class="student-card">
          <div>
            <div class="student-card-top">
              <div class="student-avatar">${getInitials(s.name)}</div>
              <div class="student-meta">
                <div class="student-name" title="${s.name}">${s.name}</div>
                <div class="student-roll">
                  <span>Roll: ${s.roll}</span>
                  <span class="roll-last-tag">#${s.last_3}</span>
                  ${rankBadge}
                </div>
              </div>
            </div>

            <div class="student-scores-row">
              <div class="score-col">
                <div class="score-col-label">CGPA</div>
                <div class="score-col-val ${isTop ? 'topper' : 'good'}">${s.final_cgpa !== null ? s.final_cgpa.toFixed(2) : '—'}</div>
              </div>
              <div class="score-col">
                <div class="score-col-label">Latest SGPA</div>
                <div class="score-col-val">${s.latest_sgpa !== null ? s.latest_sgpa.toFixed(2) : '—'}</div>
              </div>
              <div class="score-col">
                <div class="score-col-label">Credits</div>
                <div class="score-col-val">${s.total_credits}</div>
              </div>
            </div>

            <div class="student-semesters-list">
              ${semPills}
            </div>
          </div>

          <div class="student-card-actions">
            <button class="btn-card-profile" onclick="window.showStudentProfile('${s.roll}')">
              <span>👤 View Profile</span>
            </button>
            <a href="${s.pdf_url}" target="_blank" class="btn-card-pdf" title="Download 4-Semester Grade Sheet PDF">
              <span>📄 PDF</span>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- STUDENT PROFILE MODAL ---
  window.showStudentProfile = function (roll) {
    const student = data.students.find(s => s.roll === roll);
    if (!student) return;

    window.location.hash = `student=${roll}`;

    let trendSteps = '';
    [1, 2, 3, 4].forEach(sem => {
      const semData = student.semesters[String(sem)];
      if (semData) {
        trendSteps += `
          <div class="trend-step">
            <div class="trend-step-sem">Semester ${sem}</div>
            <div class="trend-step-sgpa">${semData.sgpa.toFixed(2)}</div>
            <div style="font-size:0.75rem; color:${semData.result === 'PASSED' ? '#10b981' : '#f59e0b'}">${semData.result}</div>
          </div>
        `;
      } else {
        trendSteps += `
          <div class="trend-step" style="opacity:0.4;">
            <div class="trend-step-sem">Semester ${sem}</div>
            <div class="trend-step-sgpa" style="color:var(--text-muted)">—</div>
            <div style="font-size:0.75rem; color:var(--text-muted)">Left</div>
          </div>
        `;
      }
    });

    let scorecardsHtml = '';
    [1, 2, 3, 4].forEach(sem => {
      const semData = student.semesters[String(sem)];
      if (!semData) return;

      const coursesRows = semData.courses.map(c => `
        <tr>
          <td class="course-code-cell">${c.code}</td>
          <td class="course-title-cell">${c.title}</td>
          <td><span class="sem-pill" style="font-size:0.7rem;">${c.category}</span></td>
          <td class="marks-cell">${c.ext_theory}</td>
          <td class="marks-cell">${c.int_theory}</td>
          <td class="marks-cell">${c.int_pract}</td>
          <td class="marks-cell">${c.ext_pract}</td>
          <td class="marks-cell" style="font-weight:700;color:var(--text-primary);">${c.obt_marks}</td>
          <td class="marks-cell">${c.credits}</td>
          <td class="marks-cell"><span class="grade-badge ${getGradeClass(c.grade)}">${c.grade}</span></td>
          <td class="marks-cell" style="font-weight:600;">${c.grade_point}</td>
        </tr>
      `).join('');

      scorecardsHtml += `
        <div class="sem-scorecard-section">
          <div class="sem-scorecard-header">
            <h3>Semester ${semData.sem} (${['I', 'II', 'III', 'IV'][sem-1]})</h3>
            <div class="sem-scorecard-summary">
              <span>SGPA: <strong style="color:var(--accent-cyan);">${semData.sgpa.toFixed(2)}</strong></span>
              ${semData.cgpa !== null ? `<span>CGPA: <strong>${semData.cgpa.toFixed(2)}</strong></span>` : ''}
              <span>Result: <strong style="color:${semData.result === 'PASSED' ? '#10b981' : '#f59e0b'};">${semData.result}</strong></span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="courses-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Title</th>
                  <th>Type</th>
                  <th class="marks-cell">Ext Th</th>
                  <th class="marks-cell">Int Th</th>
                  <th class="marks-cell">Int Pr</th>
                  <th class="marks-cell">Ext Pr</th>
                  <th class="marks-cell">Obtained</th>
                  <th class="marks-cell">Credit</th>
                  <th class="marks-cell">Grade</th>
                  <th class="marks-cell">Point</th>
                </tr>
              </thead>
              <tbody>
                ${coursesRows}
              </tbody>
            </table>
          </div>
          ${semData.carry_over ? `
            <div style="padding:0.75rem 1.25rem; background:rgba(245,158,11,0.08); border-top:1px solid var(--border); font-size:0.85rem; color:#f59e0b;">
              ⚠️ <strong>Carry Over Paper:</strong> ${semData.carry_over}
            </div>
          ` : ''}
        </div>
      `;
    });

    modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group">
          <h2>${student.name}</h2>
          <p>Roll No: <strong>${student.roll}</strong> (Suffix: #${student.last_3}) · Enrollment: ${student.enrollment_no || 'N/A'}</p>
        </div>
        <button class="modal-close-btn" onclick="window.closeModal()">✕</button>
      </div>

      <div class="modal-body">
        <div class="info-table-grid">
          <div>
            <div class="info-item-label">Father's Name</div>
            <div class="info-item-val">${student.father_name || 'N/A'}</div>
          </div>
          <div>
            <div class="info-item-label">Mother's Name</div>
            <div class="info-item-val">${student.mother_name || 'N/A'}</div>
          </div>
          <div>
            <div class="info-item-label">Date of Birth</div>
            <div class="info-item-val">${student.dob || 'N/A'}</div>
          </div>
          <div>
            <div class="info-item-label">College</div>
            <div class="info-item-val" style="font-size:0.85rem;">${student.college_name}</div>
          </div>
          <div>
            <div class="info-item-label">Overall CGPA</div>
            <div class="info-item-val" style="font-size:1.25rem;color:var(--accent-cyan);font-weight:800;">
              ${student.final_cgpa ? student.final_cgpa.toFixed(2) : '—'}
              ${student.overall_cgpa_rank ? `<span style="font-size:0.85rem;color:#f59e0b;margin-left:0.5rem;">(${formatRank(student.overall_cgpa_rank)})</span>` : ''}
            </div>
          </div>
          <div>
            <div class="info-item-label">Academic Status</div>
            <div class="info-item-val">
              <span class="sem-pill ${student.num_semesters === 4 ? 'completed' : 'discontinued'}">${student.status_desc}</span>
            </div>
          </div>
        </div>

        <div class="sgpa-trend-box">
          <div style="font-size:0.85rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
            📈 Semester SGPA Progression
          </div>
          <div class="trend-steps">
            ${trendSteps}
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <h3 style="font-family:var(--font-heading);font-size:1.25rem;margin-bottom:1rem;color:var(--text-primary);">
            📋 Detailed Grade Sheets (Semesters 1 to 4)
          </h3>
          ${scorecardsHtml}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-card-profile" onclick="window.closeModal()" style="flex:initial;padding:0.6rem 1.25rem;">Close</button>
        <a href="${student.pdf_url}" target="_blank" class="search-btn" style="text-decoration:none;font-size:0.9rem;">
          <span>📄 Download Combined 4-Semester PDF</span>
        </a>
      </div>
    `;

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  // --- SUBJECT PROFILE MODAL ---
  window.showSubjectProfile = function (code) {
    const subject = data.subject_profiles.find(sp => sp.code === code);
    if (!subject) return;

    window.location.hash = `subject=${code}`;

    const toppersRows = subject.toppers.map(st => `
      <tr>
        <td style="font-weight:700;">${formatRank(st.rank)}</td>
        <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showStudentProfile('${st.roll}')">${st.name}</td>
        <td>${st.roll}</td>
        <td class="marks-cell" style="font-weight:800;color:var(--accent-cyan);">${st.obt_marks}</td>
        <td class="marks-cell"><span class="grade-badge ${getGradeClass(st.grade)}">${st.grade}</span></td>
      </tr>
    `).join('');

    const allStudentsRows = subject.all_students.map(st => `
      <tr>
        <td>#${st.rank}</td>
        <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showStudentProfile('${st.roll}')">${st.name}</td>
        <td>${st.roll}</td>
        <td class="marks-cell">${st.ext_theory}</td>
        <td class="marks-cell">${st.int_theory}</td>
        <td class="marks-cell">${st.int_pract}</td>
        <td class="marks-cell">${st.ext_pract}</td>
        <td class="marks-cell" style="font-weight:700;color:var(--text-primary);">${st.obt_marks}</td>
        <td class="marks-cell"><span class="grade-badge ${getGradeClass(st.grade)}">${st.grade}</span></td>
        <td class="marks-cell">${st.grade_point}</td>
      </tr>
    `).join('');

    modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group">
          <h2>${subject.title}</h2>
          <p>Code: <strong>${subject.code}</strong> · Semester ${subject.semester} · Category: ${subject.category} (${subject.credits} Credits)</p>
        </div>
        <button class="modal-close-btn" onclick="window.closeModal()">✕</button>
      </div>

      <div class="modal-body">
        <div class="info-table-grid">
          <div>
            <div class="info-item-label">Total Enrolled</div>
            <div class="info-item-val">${subject.total_students} Students</div>
          </div>
          <div>
            <div class="info-item-label">Pass Percentage</div>
            <div class="info-item-val" style="color:#10b981;font-weight:800;">${subject.pass_rate}% (${subject.passed_count}/${subject.total_students})</div>
          </div>
          <div>
            <div class="info-item-label">Highest Score</div>
            <div class="info-item-val" style="color:#f59e0b;font-weight:800;font-size:1.25rem;">${subject.high_score}</div>
          </div>
          <div>
            <div class="info-item-label">Average Score</div>
            <div class="info-item-val">${subject.avg_score}</div>
          </div>
          <div>
            <div class="info-item-label">Lowest Score</div>
            <div class="info-item-val">${subject.low_score}</div>
          </div>
        </div>

        <div style="margin-bottom:2rem;">
          <h3 style="font-family:var(--font-heading);font-size:1.15rem;margin-bottom:0.75rem;color:var(--text-primary);">
            🏆 Subject Toppers
          </h3>
          <div class="table-responsive">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th class="marks-cell">Marks Obtained</th>
                  <th class="marks-cell">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${toppersRows}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 style="font-family:var(--font-heading);font-size:1.15rem;margin-bottom:0.75rem;color:var(--text-primary);">
            👥 All Students Scores in this Subject
          </h3>
          <div class="table-responsive">
            <table class="courses-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th class="marks-cell">Ext Th</th>
                  <th class="marks-cell">Int Th</th>
                  <th class="marks-cell">Int Pr</th>
                  <th class="marks-cell">Ext Pr</th>
                  <th class="marks-cell">Obtained</th>
                  <th class="marks-cell">Grade</th>
                  <th class="marks-cell">Point</th>
                </tr>
              </thead>
              <tbody>
                ${allStudentsRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-card-profile" onclick="window.closeModal()" style="flex:initial;padding:0.6rem 1.5rem;">Close</button>
      </div>
    `;

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeModal = function () {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    window.location.hash = currentTab;
  };

  // --- TOPPERS SECTION ---
  function renderToppers() {
    const container = document.getElementById('toppers-view-container');
    if (!container) return;

    if (currentTopperSubtab === 'overall') {
      const top3 = data.overall_toppers.slice(0, 3);
      const rest = data.overall_toppers;

      container.innerHTML = `
        <div class="podium-grid">
          <!-- Rank 2 -->
          <div class="podium-card rank-2" onclick="window.showStudentProfile('${top3[1].roll}')" style="cursor:pointer;">
            <div class="podium-crown">🥈</div>
            <div class="podium-rank-badge">Rank 2 (Silver)</div>
            <div class="podium-name">${top3[1].name}</div>
            <div class="podium-roll">Roll: ${top3[1].roll}</div>
            <div class="podium-score">${top3[1].final_cgpa.toFixed(2)}</div>
            <div class="podium-score-sub">Cumulative CGPA</div>
            <button class="btn-card-profile">View Profile</button>
          </div>

          <!-- Rank 1 -->
          <div class="podium-card rank-1" onclick="window.showStudentProfile('${top3[0].roll}')" style="cursor:pointer;">
            <div class="podium-crown">👑</div>
            <div class="podium-rank-badge">Rank 1 (Gold)</div>
            <div class="podium-name">${top3[0].name}</div>
            <div class="podium-roll">Roll: ${top3[0].roll}</div>
            <div class="podium-score" style="color:#f59e0b;">${top3[0].final_cgpa.toFixed(2)}</div>
            <div class="podium-score-sub">Cumulative CGPA</div>
            <button class="btn-card-profile" style="background:#f59e0b;color:#000;border:none;">View Profile</button>
          </div>

          <!-- Rank 3 -->
          <div class="podium-card rank-3" onclick="window.showStudentProfile('${top3[2].roll}')" style="cursor:pointer;">
            <div class="podium-crown">🥉</div>
            <div class="podium-rank-badge">Rank 3 (Bronze)</div>
            <div class="podium-name">${top3[2].name}</div>
            <div class="podium-roll">Roll: ${top3[2].roll}</div>
            <div class="podium-score">${top3[2].final_cgpa.toFixed(2)}</div>
            <div class="podium-score-sub">Cumulative CGPA</div>
            <button class="btn-card-profile">View Profile</button>
          </div>
        </div>

        <div class="leaderboard-wrap">
          <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-family:var(--font-heading);font-size:1.15rem;color:var(--text-primary);">Overall Merit List (Batch 2024-2028)</h3>
            <span style="font-size:0.85rem;color:var(--text-muted);">${rest.length} Students Completed 4 Semesters</span>
          </div>
          <div class="table-responsive">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Last 3</th>
                  <th>CGPA</th>
                  <th>Credits</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${rest.map((s, idx) => `
                  <tr>
                    <td>
                      <span class="rank-pill ${idx === 0 ? 'r1' : (idx === 1 ? 'r2' : (idx === 2 ? 'r3' : ''))}">
                        ${idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${s.overall_cgpa_rank}`}
                      </span>
                    </td>
                    <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showStudentProfile('${s.roll}')">${s.name}</td>
                    <td>${s.roll}</td>
                    <td><span class="roll-last-tag">#${s.last_3}</span></td>
                    <td style="font-weight:700;font-family:var(--font-heading);font-size:1.1rem;color:${idx < 3 ? '#f59e0b' : 'var(--accent-cyan)'};">${s.final_cgpa.toFixed(2)}</td>
                    <td>${s.total_credits}</td>
                    <td>
                      <button class="btn-card-profile" style="padding:0.35rem 0.65rem;font-size:0.75rem;" onclick="window.showStudentProfile('${s.roll}')">Profile</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (currentTopperSubtab.startsWith('sem-')) {
      const semNum = currentTopperSubtab.split('-')[1];
      const toppersList = data.semester_toppers[semNum];
      const top3 = toppersList.slice(0, 3);

      container.innerHTML = `
        <div class="podium-grid">
          ${top3.length > 1 ? `
            <div class="podium-card rank-2" onclick="window.showStudentProfile('${top3[1].roll}')" style="cursor:pointer;">
              <div class="podium-crown">🥈</div>
              <div class="podium-rank-badge">Rank 2</div>
              <div class="podium-name">${top3[1].name}</div>
              <div class="podium-roll">Roll: ${top3[1].roll}</div>
              <div class="podium-score">${top3[1].sgpa.toFixed(2)}</div>
              <div class="podium-score-sub">Semester ${semNum} SGPA</div>
              <button class="btn-card-profile">View Profile</button>
            </div>
          ` : ''}

          ${top3.length > 0 ? `
            <div class="podium-card rank-1" onclick="window.showStudentProfile('${top3[0].roll}')" style="cursor:pointer;">
              <div class="podium-crown">👑</div>
              <div class="podium-rank-badge">Rank 1</div>
              <div class="podium-name">${top3[0].name}</div>
              <div class="podium-roll">Roll: ${top3[0].roll}</div>
              <div class="podium-score" style="color:#f59e0b;">${top3[0].sgpa.toFixed(2)}</div>
              <div class="podium-score-sub">Semester ${semNum} SGPA</div>
              <button class="btn-card-profile" style="background:#f59e0b;color:#000;border:none;">View Profile</button>
            </div>
          ` : ''}

          ${top3.length > 2 ? `
            <div class="podium-card rank-3" onclick="window.showStudentProfile('${top3[2].roll}')" style="cursor:pointer;">
              <div class="podium-crown">🥉</div>
              <div class="podium-rank-badge">Rank 3</div>
              <div class="podium-name">${top3[2].name}</div>
              <div class="podium-roll">Roll: ${top3[2].roll}</div>
              <div class="podium-score">${top3[2].sgpa.toFixed(2)}</div>
              <div class="podium-score-sub">Semester ${semNum} SGPA</div>
              <button class="btn-card-profile">View Profile</button>
            </div>
          ` : ''}
        </div>

        <div class="leaderboard-wrap">
          <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-family:var(--font-heading);font-size:1.15rem;color:var(--text-primary);">Semester ${semNum} Leaderboard</h3>
            <span style="font-size:0.85rem;color:var(--text-muted);">${toppersList.length} Students</span>
          </div>
          <div class="table-responsive">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>SGPA</th>
                  <th>CGPA</th>
                  <th>Result</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${toppersList.map((s, idx) => `
                  <tr>
                    <td>
                      <span class="rank-pill ${s.rank === 1 ? 'r1' : (s.rank === 2 ? 'r2' : (s.rank === 3 ? 'r3' : ''))}">
                        #${s.rank}
                      </span>
                    </td>
                    <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showStudentProfile('${s.roll}')">${s.name}</td>
                    <td>${s.roll}</td>
                    <td style="font-weight:700;font-family:var(--font-heading);font-size:1.1rem;color:${s.rank <= 3 ? '#f59e0b' : 'var(--accent-cyan)'};">${s.sgpa.toFixed(2)}</td>
                    <td>${s.cgpa !== null && s.cgpa !== undefined ? s.cgpa.toFixed(2) : '—'}</td>
                    <td><span class="sem-pill ${s.result === 'PASSED' ? 'completed' : 'discontinued'}">${s.result}</span></td>
                    <td>
                      <button class="btn-card-profile" style="padding:0.35rem 0.65rem;font-size:0.75rem;" onclick="window.showStudentProfile('${s.roll}')">Profile</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (currentTopperSubtab === 'subjects') {
      container.innerHTML = `
        <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
          <h3 style="font-family:var(--font-heading);font-size:1.15rem;color:var(--text-primary);">Subject-Wise Top Scorers</h3>
          <span style="font-size:0.85rem;color:var(--text-secondary);">Click on any subject to open its complete analysis</span>
        </div>
        <div class="table-responsive leaderboard-wrap">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Sem</th>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Subject</th>
                <th>Highest Score</th>
                <th>Top Scorer</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${data.subject_toppers.map(st => `
                <tr>
                  <td><span class="sem-pill">Sem ${st.semester}</span></td>
                  <td><span class="subject-code-pill" style="cursor:pointer;" onclick="window.showSubjectProfile('${st.code}')">${st.code}</span></td>
                  <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showSubjectProfile('${st.code}')">${st.title}</td>
                  <td>${st.subject}</td>
                  <td style="font-weight:800;color:#f59e0b;font-size:1.1rem;">${st.high_score}</td>
                  <td style="cursor:pointer;" onclick="window.showStudentProfile('${st.top_student.roll}')">
                    <strong>${st.top_student.name}</strong> <span style="font-size:0.8rem;color:var(--text-muted);">(Roll: ${st.top_student.roll})</span>
                  </td>
                  <td>
                    <button class="btn-card-profile" style="padding:0.35rem 0.65rem;font-size:0.75rem;" onclick="window.showSubjectProfile('${st.code}')">View Subject</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // --- SEMESTER OVERVIEWS ---
  function renderSemesterOverview() {
    const semData = data.semester_profiles.find(sp => sp.semester === currentSemesterView);
    if (!semData) return;

    document.querySelectorAll('.sem-select-card').forEach(card => {
      card.classList.toggle('active', parseInt(card.dataset.sem) === currentSemesterView);
    });

    const container = document.getElementById('semester-detail-container');
    if (!container) return;

    // Calculate Grade percentages for visual bar
    const totalGrades = Object.values(semData.grades_dist).reduce((a, b) => a + b, 0);
    const gradeColors = {
      'O': '#10b981', 'A+': '#059669', 'A': '#38bdf8', 'B+': '#6366f1',
      'B': '#f59e0b', 'C': '#ea580c', 'P': '#ca8a04', 'F': '#ef4444'
    };

    let gradeBars = '';
    let gradeLegend = '';
    for (const [g, count] of Object.entries(semData.grades_dist)) {
      if (count > 0 && totalGrades > 0) {
        const pct = ((count / totalGrades) * 100).toFixed(1);
        gradeBars += `<div class="grade-seg" style="width:${pct}%;background:${gradeColors[g] || '#64748b'};" title="Grade ${g}: ${count} (${pct}%)">${pct > 6 ? g : ''}</div>`;
        gradeLegend += `
          <div class="legend-item">
            <div class="legend-color" style="background:${gradeColors[g] || '#64748b'};"></div>
            <span><strong>${g}:</strong> ${count} (${pct}%)</span>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="sem-detail-box">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;">
          <div>
            <div class="unpg-badge">Official Semester Report</div>
            <h2 style="font-family:var(--font-heading);font-size:1.75rem;color:var(--text-primary);">
              Semester ${semData.roman} Overview
            </h2>
            <p style="color:var(--text-secondary);font-size:0.95rem;margin-top:0.25rem;">
              Total Enrolled: <strong>${semData.total_students} Students</strong> · ${semData.subjects_count} Courses Offered
            </p>
          </div>
          <div>
            <a href="${semData.pdf_url}" target="_blank" class="search-btn" style="text-decoration:none;">
              <span>📄 Download Full Semester ${semData.roman} PDF</span>
            </a>
          </div>
        </div>

        <div class="sem-metrics-grid">
          <div class="sem-metric-box">
            <div class="sem-metric-val" style="color:#10b981;">${semData.clear_pass_percentage}%</div>
            <div class="sem-metric-sub">Clear Pass Rate</div>
          </div>
          <div class="sem-metric-box">
            <div class="sem-metric-val" style="color:var(--accent-cyan);">${semData.avg_sgpa.toFixed(2)}</div>
            <div class="sem-metric-sub">Average SGPA</div>
          </div>
          <div class="sem-metric-box">
            <div class="sem-metric-val" style="color:#f59e0b;">${semData.high_sgpa.toFixed(2)}</div>
            <div class="sem-metric-sub">Highest SGPA</div>
          </div>
          <div class="sem-metric-box">
            <div class="sem-metric-val">${semData.passed}</div>
            <div class="sem-metric-sub">Passed Clear</div>
          </div>
          <div class="sem-metric-box">
            <div class="sem-metric-val" style="color:#f59e0b;">${semData.promoted}</div>
            <div class="sem-metric-sub">Promoted (Back/Carry)</div>
          </div>
          <div class="sem-metric-box">
            <div class="sem-metric-val" style="color:#f43f5e;">${semData.absent}</div>
            <div class="sem-metric-sub">Absent / Left</div>
          </div>
        </div>

        <div class="grades-dist-wrap">
          <div class="grades-dist-title">📊 Grade Distribution Across Courses</div>
          <div class="grades-bar">
            ${gradeBars}
          </div>
          <div class="grades-legend">
            ${gradeLegend}
          </div>
        </div>

        <!-- Semester Subjects Table -->
        <div style="margin-top:2rem;">
          <h3 style="font-family:var(--font-heading);font-size:1.15rem;margin-bottom:0.75rem;color:var(--text-primary);">
            📚 Courses in Semester ${semData.roman}
          </h3>
          <div class="table-responsive leaderboard-wrap">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Top Score</th>
                  <th>Pass Rate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${semData.subjects.map(s => `
                  <tr>
                    <td><span class="subject-code-pill" style="cursor:pointer;" onclick="window.showSubjectProfile('${s.code}')">${s.code}</span></td>
                    <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showSubjectProfile('${s.code}')">${s.title}</td>
                    <td style="font-weight:700;color:#f59e0b;">${s.high_score}</td>
                    <td style="color:#10b981;font-weight:600;">${s.pass_rate}%</td>
                    <td>
                      <button class="btn-card-profile" style="padding:0.35rem 0.65rem;font-size:0.75rem;" onclick="window.showSubjectProfile('${s.code}')">Profile</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Performers Table -->
        <div style="margin-top:2rem;">
          <h3 style="font-family:var(--font-heading);font-size:1.15rem;margin-bottom:0.75rem;color:var(--text-primary);">
            🌟 Top 10 Performers in Semester ${semData.roman}
          </h3>
          <div class="table-responsive leaderboard-wrap">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>SGPA</th>
                  <th>Result</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${semData.toppers.map((t, idx) => `
                  <tr>
                    <td><span class="rank-pill ${idx === 0 ? 'r1' : (idx === 1 ? 'r2' : (idx === 2 ? 'r3' : ''))}">#${t.rank}</span></td>
                    <td style="font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="window.showStudentProfile('${t.roll}')">${t.name}</td>
                    <td>${t.roll}</td>
                    <td style="font-weight:700;color:${idx < 3 ? '#f59e0b' : 'var(--accent-cyan)'};font-size:1.05rem;">${t.sgpa.toFixed(2)}</td>
                    <td><span class="sem-pill ${t.result === 'PASSED' ? 'completed' : 'discontinued'}">${t.result}</span></td>
                    <td>
                      <button class="btn-card-profile" style="padding:0.35rem 0.65rem;font-size:0.75rem;" onclick="window.showStudentProfile('${t.roll}')">Profile</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- SUBJECT PROFILES DIRECTORY ---
  function renderSubjectsDirectory() {
    const container = document.getElementById('subject-cards-grid');
    if (!container) return;

    let filtered = data.subject_profiles.filter(sp => {
      if (currentSubjectFilterSem !== 'all' && sp.semester !== parseInt(currentSubjectFilterSem)) return false;
      if (currentSubjectFilterGroup !== 'all' && sp.subject !== currentSubjectFilterGroup) return false;
      return true;
    });

    container.innerHTML = filtered.map(sp => `
      <div class="subject-card" onclick="window.showSubjectProfile('${sp.code}')">
        <div>
          <div class="subject-badge-row">
            <span class="subject-code-pill">${sp.code}</span>
            <span class="sem-pill">Sem ${sp.semester}</span>
          </div>
          <div class="subject-title">${sp.title}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">${sp.category} · ${sp.credits} Credits</div>
        </div>

        <div class="subject-stats-row">
          <div class="subject-stat">
            <div class="score-col-label">Top Score</div>
            <div class="subject-stat-val" style="color:#f59e0b;">${sp.high_score}</div>
          </div>
          <div class="subject-stat">
            <div class="score-col-label">Pass Rate</div>
            <div class="subject-stat-val" style="color:#10b981;">${sp.pass_rate}%</div>
          </div>
          <div class="subject-stat">
            <div class="score-col-label">Avg Marks</div>
            <div class="subject-stat-val">${sp.avg_score}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // --- HASH ROUTING ---
  function handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    if (hash.startsWith('student=')) {
      const roll = hash.split('=')[1];
      window.showStudentProfile(roll);
    } else if (hash.startsWith('subject=')) {
      const code = hash.split('=')[1];
      window.showSubjectProfile(code);
    } else if (['search', 'toppers', 'semesters', 'subjects', 'downloads'].includes(hash)) {
      switchTab(hash);
    }
  }

  // --- EVENT LISTENERS ---
  function initEvents() {
    // Tab clicks
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Search events
    searchInput.addEventListener('input', filterStudents);
    searchBtn.addEventListener('click', filterStudents);
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterStudents();
      searchInput.focus();
    });

    // Search chips
    document.querySelectorAll('.search-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        searchInput.value = chip.dataset.query;
        filterStudents();
        switchTab('search');
      });
    });

    if (statusFilter) {
      statusFilter.addEventListener('change', filterStudents);
    }

    // Topper subtabs
    document.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTopperSubtab = btn.dataset.subtab;
        renderToppers();
      });
    });

    // Semester select cards
    document.querySelectorAll('.sem-select-card').forEach(card => {
      card.addEventListener('click', () => {
        currentSemesterView = parseInt(card.dataset.sem);
        renderSemesterOverview();
      });
    });

    // Subject filters
    const subSemFilter = document.getElementById('subject-sem-filter');
    const subGroupFilter = document.getElementById('subject-group-filter');
    if (subSemFilter) {
      subSemFilter.addEventListener('change', (e) => {
        currentSubjectFilterSem = e.target.value;
        renderSubjectsDirectory();
      });
    }
    if (subGroupFilter) {
      subGroupFilter.addEventListener('change', (e) => {
        currentSubjectFilterGroup = e.target.value;
        renderSubjectsDirectory();
      });
    }

    // Modal close when clicking backdrop or escape
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        window.closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
        window.closeModal();
      }
      // Keyboard shortcut '/' to search
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        switchTab('search');
        searchInput.focus();
      }
    });

    window.addEventListener('hashchange', handleHashChange);
  }

  // --- INIT ---
  function init() {
    initEvents();
    filterStudents();
    renderToppers();
    renderSemesterOverview();
    renderSubjectsDirectory();
    handleHashChange();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

