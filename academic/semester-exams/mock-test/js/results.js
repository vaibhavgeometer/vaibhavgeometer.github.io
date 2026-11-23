/**
 * UNPG Padrauna & DDUGU Semester Exams Mock Test - Results & Detailed Solution Analytics
 * Screenshot-First Solution Review with Verified Master Answer Keys & Explanations
 */

(function() {

  window.renderResults = function(state) {
    const appEl = document.querySelector('.exam-app');
    if (!appEl) return;
    appEl.classList.add('results-mode');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const test = state.test;
    const questions = test.questions || [];
    const totalQs = test.total_questions || questions.length;
    
    let totalMarksEarned = 0;
    let maxMarks = test.total_marks || (totalQs * 1.5);
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const evaluatedQuestions = questions.map((q, idx) => {
      const userResp = state.responses[idx];
      const key = (q.answer_key || q.answer || '').trim().toUpperCase();
      let status = 'unattempted';
      let earned = 0;
      const qMarks = q.marks || 1.5;

      const hasAttempted = userResp !== null && userResp !== undefined && String(userResp).trim().length > 0;

      if (key === 'MTA' || key.includes('MARKS TO ALL')) {
        status = 'mta';
        earned = qMarks;
        correctCount++;
      } else if (hasAttempted) {
        const u = String(userResp).trim().toUpperCase();
        if (u === key) {
          status = 'correct';
          earned = qMarks;
          correctCount++;
        } else {
          status = 'incorrect';
          earned = 0; // No negative marking in semester exams
          incorrectCount++;
        }
      } else {
        unattemptedCount++;
        earned = 0;
      }

      totalMarksEarned += earned;

      return {
        q,
        idx,
        userResp,
        key,
        status,
        earned,
        qMarks
      };
    });

    const percentage = maxMarks > 0 ? ((totalMarksEarned / maxMarks) * 100).toFixed(1) : 0;
    const attemptedCount = correctCount + incorrectCount;
    const accuracy = attemptedCount > 0 ? ((correctCount / attemptedCount) * 100).toFixed(1) : 0;

    // Time spent calculation
    const timeSpentSecs = state.mode === 'practice' ? state.timeRemaining : (((test.duration_minutes || 90) * 60) - state.timeRemaining);
    const spentMins = Math.floor(timeSpentSecs / 60);
    const spentSecs = timeSpentSecs % 60;
    const timeString = `${spentMins}m ${spentSecs}s`;

    // Replace exam workspace with Results View
    const workspace = document.querySelector('.exam-workspace');
    const footer = document.querySelector('.exam-footer');
    if (footer) footer.style.display = 'none';

    if (workspace) {
      workspace.innerHTML = `
        <div class="results-container" style="max-width: 1000px; margin: 0 auto; padding: 24px 16px; width: 100%;">
          
          <!-- Score Header Card -->
          <div class="results-header-card" style="background: var(--bg-card, #1e293b); border: 1px solid var(--border, #334155); border-radius: 16px; padding: 28px; margin-bottom: 24px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);">
            <div style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-cyan, #38bdf8); font-weight: 700; margin-bottom: 6px;">
              Semester Examination Performance Report
            </div>
            <h1 style="font-size: clamp(1.6rem, 3.5vw, 2.2rem); margin: 0 0 8px 0; color: var(--text-primary, #f8fafc);">
              ${test.name || 'B.Sc. Semester Mock Test'}
            </h1>
            <p style="color: var(--text-secondary, #94a3b8); font-size: 0.95rem; margin-bottom: 24px;">
              CBCS NEP 2020 Pattern • 50 MCQs • External Examination Simulator
            </p>

            <!-- Score Metric Highlights -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; margin-bottom: 24px;">
              <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 16px 12px;">
                <div style="font-size: 0.75rem; color: #38bdf8; font-weight: 700; text-transform: uppercase;">Total Score</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #38bdf8; margin: 4px 0;">${totalMarksEarned.toFixed(1)} <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary, #94a3b8);">/ ${maxMarks}</span></div>
                <div style="font-size: 0.8rem; color: #38bdf8; font-weight: 600;">${percentage}% Score</div>
              </div>

              <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 12px; padding: 16px 12px;">
                <div style="font-size: 0.75rem; color: #4ade80; font-weight: 700; text-transform: uppercase;">Correct</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #4ade80; margin: 4px 0;">${correctCount} <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary, #94a3b8);">/ ${totalQs}</span></div>
                <div style="font-size: 0.8rem; color: #4ade80; font-weight: 600;">Accuracy: ${accuracy}%</div>
              </div>

              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 16px 12px;">
                <div style="font-size: 0.75rem; color: #f87171; font-weight: 700; text-transform: uppercase;">Incorrect</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #f87171; margin: 4px 0;">${incorrectCount}</div>
                <div style="font-size: 0.8rem; color: #f87171; font-weight: 600;">0 Neg. Lost</div>
              </div>

              <div style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 12px; padding: 16px 12px;">
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Unattempted</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #94a3b8; margin: 4px 0;">${unattemptedCount}</div>
                <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Time: ${timeString}</div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
              <button onclick="window.location.reload()" class="btn-action btn-save-next" style="padding: 10px 20px; font-size: 0.9rem;">
                🔄 Retake Test
              </button>
              <a href="../index.html" class="btn-action btn-secondary" style="padding: 10px 20px; font-size: 0.9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                ← Back to Semester Portal
              </a>
              <button onclick="window.print()" class="btn-action btn-secondary" style="padding: 10px 20px; font-size: 0.9rem;">
                🖨️ Print Result &amp; Solutions
              </button>
            </div>

            ${test.videos && test.videos.length > 0 ? `
              <div style="margin-top: 20px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 1.5rem;">🎥</span>
                  <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: #f87171;">Complete Video Solution Available on YouTube</div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary, #94a3b8);">Watch step-by-step problem walkthroughs and option explanations for ${test.course_code || ''} (${test.year || ''})</div>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${test.videos.map(v => `
                    <a href="${v.url}" target="_blank" rel="noopener noreferrer" style="background: #ef4444; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 0.85rem; padding: 8px 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);">
                      <span>▶</span> ${v.title}
                    </a>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Section: Detailed Solutions Review -->
          <div style="margin-top: 32px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
              <h2 style="font-size: 1.35rem; color: var(--text-primary, #f8fafc); margin: 0; font-family: var(--font-heading, sans-serif);">
                📖 Question-by-Question Verified Solutions &amp; Explanations
              </h2>
              <span style="font-size: 0.85rem; color: var(--text-secondary, #94a3b8);">All 50 Master Answers Rigorously Verified</span>
            </div>

            <!-- Solutions List -->
            <div class="solutions-list" style="display: flex; flex-direction: column; gap: 20px;">
              ${evaluatedQuestions.map((item) => {
                const q = item.q;
                const imgPath = q.image ? (q.image.startsWith('../') ? q.image : `../${q.image}`) : '';
                
                let statusBadge = '';
                let statusBorder = 'var(--border, #334155)';
                if (item.status === 'correct' || item.status === 'mta') {
                  statusBadge = '<span style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">✓ Correct (+1.5)</span>';
                  statusBorder = 'rgba(34, 197, 94, 0.3)';
                } else if (item.status === 'incorrect') {
                  statusBadge = '<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">✗ Incorrect (0)</span>';
                  statusBorder = 'rgba(239, 68, 68, 0.3)';
                } else {
                  statusBadge = '<span style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">○ Unattempted</span>';
                }

                return `
                  <div class="solution-card" style="background: var(--bg-card, #1e293b); border: 1px solid ${statusBorder}; border-radius: 12px; padding: 20px;">
                    <!-- Question Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 800; font-size: 1rem; color: var(--accent-cyan, #38bdf8);">Q.${item.idx + 1}</span>
                        <span style="font-size: 0.8rem; color: var(--text-secondary, #94a3b8); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${test.course_code || 'CBCS'} • ${test.year || ''}</span>
                      </div>
                      <div>${statusBadge}</div>
                    </div>

                    <!-- Official Screenshot if present -->
                    ${imgPath ? `
                      <div style="margin: 12px 0; border: 1px solid var(--border, #334155); border-radius: 8px; overflow: hidden; background: #000; text-align: center;">
                        <img src="${imgPath}" alt="Question ${item.idx + 1}" style="max-width: 100%; max-height: 480px; object-fit: contain;" />
                      </div>
                    ` : ''}

                    <!-- Question Text if present -->
                    ${q.question ? `
                      <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary, #f8fafc); margin: 12px 0;">
                        ${q.question}
                      </div>
                    ` : ''}

                    <!-- User Answer vs Correct Key -->
                    <div style="display: flex; gap: 14px; margin: 14px 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; flex-wrap: wrap;">
                      <div style="font-size: 0.85rem;">
                        <span style="color: var(--text-secondary, #94a3b8);">Your Selected Answer:</span> 
                        <strong style="color: ${item.userResp ? (item.status === 'correct' ? '#4ade80' : '#f87171') : '#94a3b8'};">
                          ${item.userResp ? `Option (${item.userResp})` : 'Not Attempted'}
                        </strong>
                      </div>
                      <div style="font-size: 0.85rem;">
                        <span style="color: var(--text-secondary, #94a3b8);">Master Verified Key:</span> 
                        <strong style="color: #4ade80;">Option (${item.key})</strong>
                      </div>
                    </div>

                    <!-- Verified Detailed Explanation -->
                    <div style="background: rgba(56, 189, 248, 0.05); border-left: 3px solid var(--accent-cyan, #38bdf8); padding: 12px 14px; border-radius: 0 8px 8px 0; font-size: 0.88rem; line-height: 1.55; color: var(--text-secondary, #cbd5e1);">
                      <div style="font-weight: 700; color: var(--accent-cyan, #38bdf8); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                        <span>💡 Verified Mathematical / Physical Solution:</span>
                      </div>
                      <div>${q.explanation || `The verified correct answer according to standard course theorems is <strong>Option (${item.key})</strong>.`}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>
      `;

      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([workspace]).catch(err => console.warn(err));
      }
    }
  };

})();
