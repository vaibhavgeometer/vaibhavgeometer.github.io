/**
 * IIT JAM Mock Test - Results & Comprehensive Solution Analytics
 */

(function() {
  window.renderResults = function(state) {
    const appEl = document.querySelector('.exam-app');
    if (!appEl) return;
    appEl.classList.add('results-mode');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const test = state.test;
    let totalMarks = 0;
    let maxMarks = test.total_marks;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let posMarks = 0;
    let negMarks = 0;

    const sectionStats = {
      'MCQ_1': { name: 'MCQ (1 Mark)', total: 0, attempted: 0, correct: 0, marks: 0 },
      'MCQ_2': { name: 'MCQ (2 Marks)', total: 0, attempted: 0, correct: 0, marks: 0 },
      'MSQ_2': { name: 'MSQ (2 Marks)', total: 0, attempted: 0, correct: 0, marks: 0 },
      'NAT_1': { name: 'NAT (1 Mark)', total: 0, attempted: 0, correct: 0, marks: 0 },
      'NAT_2': { name: 'NAT (2 Marks)', total: 0, attempted: 0, correct: 0, marks: 0 }
    };

    const evaluatedQuestions = test.questions.map((q, idx) => {
      const userResp = state.responses[idx];
      const key = q.answer_key;
      const secKey = `${q.type}_${q.marks}`;
      if (sectionStats[secKey]) sectionStats[secKey].total++;

      let status = 'unattempted';
      let earned = 0;

      const hasAttempted = userResp !== null && userResp !== undefined && 
        (Array.isArray(userResp) ? userResp.length > 0 : String(userResp).trim().length > 0);

      if (hasAttempted) {
        if (sectionStats[secKey]) sectionStats[secKey].attempted++;

        if (key === 'MTA') {
          status = 'correct';
          earned = q.marks;
        } else if (q.type === 'MCQ') {
          if (String(userResp).trim().toUpperCase() === String(key).trim().toUpperCase()) {
            status = 'correct';
            earned = q.marks;
          } else {
            status = 'incorrect';
            earned = -q.negative_marks;
          }
        } else if (q.type === 'MSQ') {
          // Compare arrays
          const correctArr = key.split(',').map(s => s.trim().toUpperCase()).sort();
          const userArr = (Array.isArray(userResp) ? userResp : [userResp]).map(s => s.trim().toUpperCase()).sort();
          if (JSON.stringify(correctArr) === JSON.stringify(userArr)) {
            status = 'correct';
            earned = q.marks;
          } else {
            status = 'incorrect';
            earned = 0; // MSQ has 0 negative mark
          }
        } else if (q.type === 'NAT') {
          // Compare numeric with tolerance
          const userNum = parseFloat(userResp);
          const keyNum = parseFloat(key);
          if (!isNaN(userNum) && !isNaN(keyNum) && Math.abs(userNum - keyNum) <= 0.05) {
            status = 'correct';
            earned = q.marks;
          } else if (String(userResp).trim() === String(key).trim()) {
            status = 'correct';
            earned = q.marks;
          } else {
            status = 'incorrect';
            earned = 0; // NAT has 0 negative mark
          }
        }
      }

      if (status === 'correct') {
        correctCount++;
        posMarks += q.marks;
        if (sectionStats[secKey]) {
          sectionStats[secKey].correct++;
          sectionStats[secKey].marks += q.marks;
        }
      } else if (status === 'incorrect') {
        incorrectCount++;
        if (earned < 0) {
          negMarks += Math.abs(earned);
          if (sectionStats[secKey]) sectionStats[secKey].marks += earned;
        }
      } else {
        unattemptedCount++;
      }

      totalMarks += earned;

      return {
        ...q,
        index: idx,
        userResponse: userResp,
        status: status,
        marksEarned: earned
      };
    });

    totalMarks = parseFloat(totalMarks.toFixed(2));
    posMarks = parseFloat(posMarks.toFixed(2));
    negMarks = parseFloat(negMarks.toFixed(2));
    const accuracy = (correctCount + incorrectCount) > 0 ? ((correctCount / (correctCount + incorrectCount)) * 100).toFixed(1) : 0;
    const percentage = ((totalMarks / maxMarks) * 100).toFixed(1);

    // Save best score to localStorage
    const storageKey = `jam_score_${state.topicId}`;
    const prevBest = parseFloat(localStorage.getItem(storageKey) || '-999');
    if (totalMarks > prevBest) {
      localStorage.setItem(storageKey, totalMarks);
    }

    // Build Results View HTML
    appEl.innerHTML = `
      <div class="results-container">
        <div class="scorecard-hero">
          <div class="scorecard-title">🎉 Test Completed: ${test.name}</div>
          <div class="scorecard-subtitle">Topic ${test.id} • Official IIT JAM Mathematical Analysis (2022–2026 PYQ)</div>
          
          <div class="score-circle">
            <div class="score-val">${totalMarks}</div>
            <div class="score-max">out of ${maxMarks}</div>
          </div>

          <div style="font-size: 1.1rem; font-weight: 700; opacity: 0.95;">
            Score: ${percentage}% • Accuracy: ${accuracy}%
          </div>
        </div>

        <div class="results-stats-grid">
          <div class="stat-card">
            <div class="stat-card-val val-total">${test.total_questions}</div>
            <div class="stat-card-lbl">Total Questions</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-correct">${correctCount}</div>
            <div class="stat-card-lbl">Correct (+${posMarks})</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-incorrect">${incorrectCount}</div>
            <div class="stat-card-lbl">Incorrect (-${negMarks})</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-unattempted">${unattemptedCount}</div>
            <div class="stat-card-lbl">Unattempted</div>
          </div>
        </div>

        <!-- Section-wise breakdown -->
        <div class="review-card" style="margin-bottom: 28px;">
          <h3 style="margin-bottom: 14px; font-size: 1.15rem; font-weight: 700;">📊 Section-Wise Breakdown</h3>
          <div style="overflow-x: auto;">
            <table class="results-breakdown-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Questions</th>
                  <th>Attempted</th>
                  <th>Correct</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(sectionStats).filter(s => s.total > 0).map(s => `
                  <tr>
                    <td style="font-weight: 600;">${s.name}</td>
                    <td>${s.total}</td>
                    <td>${s.attempted}</td>
                    <td class="col-correct">${s.correct}</td>
                    <td style="font-weight: 700;">${s.marks.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Solutions & Review -->
        <div class="review-section-header">
          <h3 style="font-size: 1.25rem; font-weight: 800;">📝 Question-by-Question Detailed Review</h3>
          <div class="review-filter-group">
            <button class="palette-filter-btn active" onclick="window.filterReview('ALL', this)">All (${test.total_questions})</button>
            <button class="palette-filter-btn" onclick="window.filterReview('correct', this)">Correct (${correctCount})</button>
            <button class="palette-filter-btn" onclick="window.filterReview('incorrect', this)">Incorrect (${incorrectCount})</button>
            <button class="palette-filter-btn" onclick="window.filterReview('unattempted', this)">Unattempted (${unattemptedCount})</button>
          </div>
        </div>

        <div id="review-list-container">
          ${renderReviewCards(evaluatedQuestions)}
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 36px; flex-wrap: wrap;">
          <button class="btn-start-test" style="max-width: 220px;" onclick="window.location.reload()">🔄 Retake Test</button>
          <a href="../index.html" class="btn-secondary btn-action" style="padding: 12px 24px; text-decoration: none;">🏠 Return to Main Portal</a>
          <button class="btn-secondary btn-action" onclick="window.print()">🖨 Print Scorecard</button>
        </div>
      </div>
    `;

    // Trigger MathJax rendering on solutions
    if (window.renderMath) {
      window.renderMath(document.querySelector('.results-container'));
    }

    // Filter Review Cards
    window.filterReview = function(filterStatus, btn) {
      document.querySelectorAll('.review-filter-group .palette-filter-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');

      const cards = document.querySelectorAll('.review-card-item');
      cards.forEach(card => {
        if (filterStatus === 'ALL' || card.dataset.status === filterStatus) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    };
  };

  function renderReviewCards(questions) {
    return questions.map(q => {
      let statusBadge = '';
      let marksBadge = '';
      if (q.status === 'correct') {
        statusBadge = `<span class="review-status-badge status-correct">✓ Correct</span>`;
        marksBadge = `<span class="review-marks-badge marks-pos">+${q.marksEarned}</span>`;
      } else if (q.status === 'incorrect') {
        statusBadge = `<span class="review-status-badge status-incorrect">✕ Incorrect</span>`;
        marksBadge = `<span class="review-marks-badge marks-neg">${q.marksEarned}</span>`;
      } else {
        statusBadge = `<span class="review-status-badge status-skipped">⚪ Skipped</span>`;
        marksBadge = `<span class="review-marks-badge marks-zero">0</span>`;
      }

      let userAnsDisplay = q.userResponse !== null && q.userResponse !== undefined ? 
        (Array.isArray(q.userResponse) ? q.userResponse.join(', ') : q.userResponse) : 'None';

      return `
        <div class="review-card review-card-item status-${q.status}" data-status="${q.status}">
          <div class="review-card-header">
            <div>
              <span class="q-num-badge">Question ${q.index + 1}</span>
              <span class="q-type-badge q-type-${q.type.toLowerCase()}" style="margin-left:8px;">${q.type}</span>
              <span style="font-size:0.8rem; color:var(--text-muted); margin-left:6px;">(${q.year} Q.${q.q_num})</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${statusBadge}
              ${marksBadge}
            </div>
          </div>

          <div class="q-body-content" style="font-size: 1rem; margin-bottom: 16px;">
            ${q.question}
          </div>

          ${q.options ? `
            <div class="options-list" style="margin-bottom: 16px;">
              ${['A', 'B', 'C', 'D'].map(opt => {
                if (!q.options[opt]) return '';
                const isCorrectOpt = q.answer_key.includes(opt);
                const isUserChosen = Array.isArray(q.userResponse) ? q.userResponse.includes(opt) : q.userResponse === opt;
                
                let optClass = 'opt-neutral';
                let optIcon = '';

                if (isCorrectOpt && isUserChosen) {
                  optClass = 'opt-correct-chosen';
                  optIcon = ' ✓ (Your Choice & Correct)';
                } else if (isCorrectOpt) {
                  optClass = 'opt-correct';
                  optIcon = ' ✓ (Correct)';
                } else if (isUserChosen) {
                  optClass = 'opt-incorrect';
                  optIcon = ' ✕ (Your Choice)';
                }

                return `
                  <div class="option-item ${optClass}" style="cursor:default;">
                    <div class="option-label">(${opt})</div>
                    <div class="option-text">${q.options[opt]} <strong class="opt-tag">${optIcon}</strong></div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <div class="review-response-box">
            <div class="review-response-row">
              <div><strong>Your Response:</strong> <span class="resp-val">${userAnsDisplay}</span></div>
              <div><strong>Correct Answer Key:</strong> <span class="key-val">${q.answer_key}</span></div>
            </div>
          </div>

          <div class="solution-box">
            <div class="solution-title">💡 Step-by-Step Mathematical Explanation</div>
            <div style="font-size: 0.95rem; line-height: 1.6; color: var(--text-primary);">
              ${formatExplanation(q.explanation)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatExplanation(text) {
    if (!text) return 'No explanation available.';
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }
})();

