/**
 * IIT JAM Mathematics Mock Test - Results & Detailed Solution Analytics
 * Screenshot-First Solution Review, Official Range Matching & Performance Metrics
 */

(function() {

  // NAT Range / Value Evaluator
  function evaluateNatAnswer(userResp, keyStr) {
    if (userResp === null || userResp === undefined || String(userResp).trim() === '') {
      return false;
    }

    const uStr = String(userResp).trim();
    const uNum = parseFloat(uStr);
    if (isNaN(uNum)) {
      return false;
    }

    const cleanKey = String(keyStr).trim();
    
    // Check if key is exact single number
    const singleNum = parseFloat(cleanKey);
    if (!isNaN(singleNum) && cleanKey.indexOf('to') === -1 && cleanKey.indexOf(':') === -1 && cleanKey.indexOf('or') === -1) {
      return Math.abs(uNum - singleNum) <= 0.05;
    }

    // Check for "or" clauses e.g. "31 to 31 or 46 to 46"
    const orClauses = cleanKey.split(/\s+or\s+/i);
    for (const clause of orClauses) {
      // Range check: "A to B" or "A:B" or "A - B"
      let rangeMatch = clause.match(/([+-]?\d+(?:\.\d+)?)\s*(?:to|:)\s*([+-]?\d+(?:\.\d+)?)/i);
      if (rangeMatch) {
        const minVal = Math.min(parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2]));
        const maxVal = Math.max(parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2]));
        if (uNum >= minVal - 0.001 && uNum <= maxVal + 0.001) {
          return true;
        }
      } else {
        const val = parseFloat(clause.trim());
        if (!isNaN(val) && Math.abs(uNum - val) <= 0.05) {
          return true;
        }
      }
    }

    return false;
  }

  // MSQ Multi-option Evaluator
  function evaluateMsqAnswer(userResp, keyStr) {
    if (!userResp) return false;
    const userArr = (Array.isArray(userResp) ? userResp : [userResp])
      .map(s => String(s).trim().toUpperCase())
      .filter(s => s)
      .sort();

    // Key string might be "A;C;D" or "A, B, D" or "A,C"
    const keyArr = String(keyStr)
      .split(/[;,]/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s)
      .sort();

    if (userArr.length === 0 || userArr.length !== keyArr.length) {
      return false;
    }

    for (let i = 0; i < keyArr.length; i++) {
      if (keyArr[i] !== userArr[i]) return false;
    }
    return true;
  }

  window.renderResults = function(state) {
    const appEl = document.querySelector('.exam-app');
    if (!appEl) return;
    appEl.classList.add('results-mode');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const test = state.test;
    let totalMarksEarned = 0;
    let maxMarks = test.total_marks || 100;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let positiveMarksEarned = 0;
    let negativeMarksLost = 0;

    const evaluatedQuestions = test.questions.map((q, idx) => {
      const userResp = state.responses[idx];
      const key = q.answer_key || '';
      let status = 'unattempted';
      let earned = 0;

      const hasAttempted = userResp !== null && userResp !== undefined && 
        (Array.isArray(userResp) ? userResp.length > 0 : String(userResp).trim().length > 0);

      if (key.toUpperCase() === 'MTA' || key.toLowerCase().includes('marks to all')) {
        status = 'mta';
        earned = q.marks;
        correctCount++;
        positiveMarksEarned += q.marks;
      } else if (hasAttempted) {
        if (q.type === 'MCQ') {
          const u = String(userResp).trim().toUpperCase();
          const k = String(key).trim().toUpperCase();
          if (u === k) {
            status = 'correct';
            earned = q.marks;
            correctCount++;
            positiveMarksEarned += q.marks;
          } else {
            status = 'incorrect';
            earned = -Math.abs(q.negative_marks || 0);
            incorrectCount++;
            negativeMarksLost += Math.abs(q.negative_marks || 0);
          }
        } else if (q.type === 'MSQ') {
          if (evaluateMsqAnswer(userResp, key)) {
            status = 'correct';
            earned = q.marks;
            correctCount++;
            positiveMarksEarned += q.marks;
          } else {
            status = 'incorrect';
            earned = 0; // MSQ has 0 negative mark
            incorrectCount++;
          }
        } else if (q.type === 'NAT') {
          if (evaluateNatAnswer(userResp, key)) {
            status = 'correct';
            earned = q.marks;
            correctCount++;
            positiveMarksEarned += q.marks;
          } else {
            status = 'incorrect';
            earned = 0; // NAT has 0 negative mark
            incorrectCount++;
          }
        }
      } else {
        unattemptedCount++;
      }

      totalMarksEarned += earned;

      return {
        ...q,
        index: idx,
        userResponse: userResp,
        status: status,
        marksEarned: earned
      };
    });

    totalMarksEarned = parseFloat(totalMarksEarned.toFixed(2));
    positiveMarksEarned = parseFloat(positiveMarksEarned.toFixed(2));
    negativeMarksLost = parseFloat(negativeMarksLost.toFixed(2));
    
    const attemptedCount = correctCount + incorrectCount;
    const accuracy = attemptedCount > 0 ? ((correctCount / attemptedCount) * 100).toFixed(1) : '0.0';
    const percentage = maxMarks > 0 ? ((totalMarksEarned / maxMarks) * 100).toFixed(1) : '0.0';

    // Save best score to localStorage
    const storageKey = `jam_score_${state.topicId}`;
    const prevBest = parseFloat(localStorage.getItem(storageKey) || '-999');
    if (totalMarksEarned > prevBest) {
      localStorage.setItem(storageKey, totalMarksEarned);
    }

    // Build Results View HTML
    appEl.innerHTML = `
      <div class="results-container">
        <!-- Results Hero Banner -->
        <div class="scorecard-hero">
          <div class="scorecard-title">🎉 Test Completed: ${test.name}</div>
          <div class="scorecard-subtitle">Official IIT JAM Mathematical Computer-Based Examination • ${test.total_questions || test.questions.length} Questions</div>
          
          <div class="score-circle">
            <div class="score-val">${totalMarksEarned}</div>
            <div class="score-max">out of ${maxMarks} Marks</div>
          </div>

          <div class="score-pills-row">
            <span class="score-pill">📊 Score: <strong>${percentage}%</strong></span>
            <span class="score-pill">🎯 Accuracy: <strong>${accuracy}%</strong></span>
            <span class="score-pill">⏱ Attempted: <strong>${attemptedCount} / ${test.questions.length}</strong></span>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="results-stats-grid">
          <div class="stat-card">
            <div class="stat-card-val val-total">${test.questions.length}</div>
            <div class="stat-card-lbl">Total Questions</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-correct">${correctCount}</div>
            <div class="stat-card-lbl">Correct Answers</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-incorrect">${incorrectCount}</div>
            <div class="stat-card-lbl">Incorrect Answers</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val val-unattempted">${unattemptedCount}</div>
            <div class="stat-card-lbl">Unattempted</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val" style="color:#16a34a;">+${positiveMarksEarned}</div>
            <div class="stat-card-lbl">Positive Marks</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-val" style="color:#dc2626;">-${negativeMarksLost}</div>
            <div class="stat-card-lbl">Negative Penalty</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="results-actions-bar">
          <button class="btn-action btn-save-next" onclick="window.location.reload()">
            🔄 Retake This Test
          </button>
          <a href="../index.html" class="btn-action btn-secondary" style="display:inline-flex; align-items:center; text-decoration:none;">
            ← Back to All Mock Tests
          </a>
        </div>

        <!-- Question Review Section -->
        <div class="solution-review-section">
          <div class="solution-header-row">
            <h2 class="solution-title">📋 Question-by-Question Solution Review</h2>
            <div class="solution-filter-tabs">
              <button class="sol-filter-btn active" onclick="window.filterSolutionReview('ALL', this)">All (${test.questions.length})</button>
              <button class="sol-filter-btn" onclick="window.filterSolutionReview('correct', this)">Correct (${correctCount})</button>
              <button class="sol-filter-btn" onclick="window.filterSolutionReview('incorrect', this)">Incorrect (${incorrectCount})</button>
              <button class="sol-filter-btn" onclick="window.filterSolutionReview('unattempted', this)">Unattempted (${unattemptedCount})</button>
            </div>
          </div>

          <div class="solution-cards-list" id="solution-cards-container">
            ${evaluatedQuestions.map((q, i) => {
              const imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';
              
              let statusPillClass = 'pill-unattempted';
              let statusPillText = '⚪ Unattempted (0 Marks)';
              if (q.status === 'correct') {
                statusPillClass = 'pill-correct';
                statusPillText = `🟢 Correct (+${q.marksEarned} Marks)`;
              } else if (q.status === 'incorrect') {
                statusPillClass = 'pill-incorrect';
                statusPillText = `🔴 Incorrect (${q.marksEarned} Marks)`;
              } else if (q.status === 'mta') {
                statusPillClass = 'pill-mta';
                statusPillText = `🟣 Marks to All (+${q.marksEarned} Marks)`;
              }

              let userRespDisplay = '<span style="color:var(--text-muted);">None</span>';
              if (q.userResponse !== null && q.userResponse !== undefined && String(q.userResponse).trim() !== '') {
                const uStr = Array.isArray(q.userResponse) ? q.userResponse.join(', ') : q.userResponse;
                userRespDisplay = `<strong>(${uStr})</strong>`;
              }

              let keyDisplay = `<strong>(${q.answer_key})</strong>`;
              if (q.type === 'NAT') {
                keyDisplay = `<strong>${q.answer_key}</strong>`;
              }

              return `
                <div class="review-q-card" data-status="${q.status}">
                  <div class="review-q-header">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <span class="review-q-num">Question ${i + 1}</span>
                      <span class="q-type-badge q-type-${q.type.toLowerCase()}">${q.type}</span>
                      <span style="font-size:0.85rem; color:var(--text-muted);">${q.year || 'JAM'} • Q.${q.q_num}</span>
                    </div>
                    <span class="review-status-pill ${statusPillClass}">${statusPillText}</span>
                  </div>

                  <div class="review-q-body">
                    ${imgPath ? `
                      <div class="review-screenshot-box">
                        <img class="review-screenshot-img" src="${imgPath}" alt="Question ${q.q_num}" loading="lazy" />
                      </div>
                    ` : `<div style="padding:12px;">${q.question || ''}</div>`}
                  </div>

                  <div class="review-answers-box">
                    <div class="review-answer-item">
                      <span class="ans-label">Your Response:</span>
                      <span class="ans-val user-val">${userRespDisplay}</span>
                    </div>
                    <div class="review-answer-item">
                      <span class="ans-label">Official Answer Key:</span>
                      <span class="ans-val key-val">${keyDisplay}</span>
                    </div>
                    <div class="review-answer-item">
                      <span class="ans-label">Marks Awarded:</span>
                      <span class="ans-val ${q.marksEarned > 0 ? 'pos' : (q.marksEarned < 0 ? 'neg' : 'zero')}">
                        ${q.marksEarned > 0 ? `+${q.marksEarned}` : q.marksEarned}
                      </span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Trigger MathJax re-render for text questions/explanations with LaTeX in solution view
    if (window.renderMath) {
      window.renderMath(appEl);
    }
  };

  window.filterSolutionReview = function(statusFilter, btn) {
    document.querySelectorAll('.sol-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const cards = document.querySelectorAll('#solution-cards-container .review-q-card');
    cards.forEach(card => {
      if (statusFilter === 'ALL' || card.getAttribute('data-status') === statusFilter) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  };

})();
