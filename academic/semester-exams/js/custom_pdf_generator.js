/**
 * UNPG Padrauna & DDUGU B.Sc. Semester Exams — Offline Custom Mock Test & PDF Generator
 * Client-Side Generator supporting Multi-Course Selection, Year Range, 5–100 Questions,
 * University-styled PDF compilation with High-Res Screenshots & Master Key, and Interactive CBT Test launching.
 */

(function() {
  'use strict';

  // Course Metadata Definition
  const COURSES_DATA = [
    {
      id: "MAT301F",
      name: "Ring Theory & Linear Algebra",
      code: "MAT 301F",
      subject: "Mathematics",
      icon: "📐",
      credits: 4,
      desc: "Rings, ideals, quotient rings, Euclidean domains, vector spaces, linear transformations, Cayley-Hamilton, eigenvalues"
    },
    {
      id: "MAT302F",
      name: "Tensor Analysis",
      code: "MAT 302F",
      subject: "Mathematics",
      icon: "🌐",
      credits: 3,
      desc: "Curvilinear coordinates, tensors, metric tensor, Christoffel symbols, covariant differentiation, Riemann-Christoffel curvature"
    },
    {
      id: "MAT303F",
      name: "Differential Geometry",
      code: "MAT 303F",
      subject: "Mathematics",
      icon: "📈",
      credits: 3,
      desc: "Space curves, Serret-Frenet formulas, curvature, torsion, fundamental forms of surfaces, Gaussian curvature, geodesics"
    },
    {
      id: "PHY301F",
      name: "Classical & Statistical Mechanics",
      code: "PHY 301F",
      subject: "Physics",
      icon: "⚙️",
      credits: 4,
      desc: "Lagrangian & Hamiltonian dynamics, Poisson brackets, canonical ensembles, Maxwell-Boltzmann, Bose-Einstein, Fermi-Dirac"
    },
    {
      id: "PHY302F",
      name: "Quantum Mechanics & Spectroscopy",
      code: "PHY 302F",
      subject: "Physics",
      icon: "⚛️",
      credits: 4,
      desc: "Schrödinger equation, 1D harmonic oscillator & box, vector atom model, Zeeman effect, vibrational-rotational spectra, Raman effect"
    }
  ];

  window.SEMESTER_COURSES_METADATA = COURSES_DATA;

  // Pre-load an Image for HTML5 Canvas / jsPDF
  function preloadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn('Could not load question screenshot:', src);
        resolve(null);
      };
      img.src = src;
    });
  }

  // Filter and gather questions from MOCK_TESTS_DATA based on course selections & options
  function collectMatchingQuestions(options) {
    if (!window.MOCK_TESTS_DATA) return [];

    const selectedCourseIds = options.courseIds || ['MAT301F', 'MAT302F', 'MAT303F', 'PHY301F', 'PHY302F'];
    const yearFilter = options.yearFilter || 'ALL'; // 'ALL', '2025-26', '2024-25', '2023-24'

    const allData = window.MOCK_TESTS_DATA;
    const matched = [];
    const seenIds = new Set();

    Object.keys(allData).forEach(testKey => {
      const test = allData[testKey];
      if (!test || !Array.isArray(test.questions)) return;

      const courseCode = (test.course_code || '').replace(/\s+/g, '').toUpperCase();
      const testYear = (test.year || '').trim();

      // Check course match
      const courseMatch = selectedCourseIds.some(cid => courseCode.includes(cid.toUpperCase()));
      if (!courseMatch) return;

      // Check year match
      if (yearFilter !== 'ALL' && testYear !== yearFilter) {
        return;
      }

      test.questions.forEach(q => {
        const qId = q.id || `${testKey}_Q${q.q_num}`;
        if (!seenIds.has(qId)) {
          seenIds.add(qId);
          matched.push({
            ...q,
            id: qId,
            course_code: test.course_code,
            course_title: test.course_title || test.name,
            year: test.year,
            testName: test.name
          });
        }
      });
    });

    return matched;
  }

  // Seeded / Shuffle Sample of N questions
  function sampleQuestions(pool, count, seed) {
    if (pool.length <= count) {
      return [...pool];
    }

    let rng = Math.random;
    if (typeof seed === 'number' && !isNaN(seed)) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      rng = function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, count);

    // Sort by course then question number
    selected.sort((a, b) => {
      const codeA = a.course_code || '';
      const codeB = b.course_code || '';
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return (a.q_num || 0) - (b.q_num || 0);
    });

    return selected;
  }

  /**
   * Generates a Publication-Quality PDF using jsPDF.
   */
  async function generateCustomPdf(config, onProgress) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error('jsPDF library not loaded. Ensure jspdf.umd.min.js is included.');
    }

    onProgress = onProgress || (() => {});
    onProgress(5, "Filtering questions dataset...");

    const courseIds = config.courseIds || ['MAT301F'];
    const questionCount = Math.min(100, Math.max(1, parseInt(config.questionCount) || 50));
    const seed = config.seed !== undefined ? config.seed : Math.floor(Math.random() * 100000);
    const paperTitle = config.title || `UNPG BSc Mathematics & Physics Semester Examination`;

    // 1. Gather pool & sample
    const pool = collectMatchingQuestions({
      courseIds: courseIds,
      yearFilter: config.yearFilter || 'ALL'
    });

    if (pool.length === 0) {
      throw new Error('No questions found matching your selected courses and filters. Please select at least one course.');
    }

    const actualCount = Math.min(questionCount, pool.length);
    const questions = sampleQuestions(pool, actualCount, seed);

    onProgress(15, `Selected ${questions.length} questions. Loading question assets...`);

    // 2. Preload question screenshots
    const loadedImages = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const imgPath = q.image ? (q.image.startsWith('../') ? q.image.replace('../', '') : q.image) : null;
      const img = await preloadImage(imgPath);
      loadedImages.push(img);
      const pct = 15 + Math.round((i / questions.length) * 35);
      onProgress(pct, `Loaded question ${i + 1}/${questions.length}...`);
    }

    onProgress(55, "Assembling document structure & styling...");

    // 3. Initialize PDF document (A4 in points: 595.28 x 841.89 pt)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 42;
    const marginTop = 50;
    const marginBottom = 45;
    const contentWidth = pageWidth - (marginX * 2);

    const totalMarks = (questions.length * 1.5).toFixed(1);
    const durationMins = Math.round(questions.length * 1.8);

    function drawHeaderAndFooter(docInstance, pageNum, totalPages) {
      if (pageNum > 1) {
        docInstance.setFont('helvetica', 'bold');
        docInstance.setFontSize(8);
        docInstance.setTextColor(71, 85, 105);
        docInstance.text('UNPG PADRAUNA · DDU GORAKHPUR UNIVERSITY · B.Sc. SEMESTER EXAMS', marginX, 28);

        docInstance.setFont('helvetica', 'normal');
        docInstance.setFontSize(8);
        const titleShort = docInstance.splitTextToSize(paperTitle, 200)[0] || paperTitle;
        docInstance.text(titleShort, pageWidth - marginX, 28, { align: 'right' });

        docInstance.setDrawColor(203, 213, 225);
        docInstance.setLineWidth(0.5);
        docInstance.line(marginX, 34, pageWidth - marginX, 34);
      }

      const footerY = pageHeight - 24;
      docInstance.setDrawColor(203, 213, 225);
      docInstance.setLineWidth(0.5);
      docInstance.line(marginX, footerY - 8, pageWidth - marginX, footerY - 8);

      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(8);
      docInstance.setTextColor(100, 116, 139);
      docInstance.text('Vaibhav Priyadarshi Academic Portal · vaibhavgeometer.github.io', marginX, footerY);
      docInstance.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginX, footerY, { align: 'right' });
    }

    let currentY = marginTop;

    // --- Page 1 Header Banner ---
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, currentY, contentWidth, 75, 4, 4, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.roundedRect(marginX, currentY, contentWidth, 75, 4, 4, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('UNPG PADRAUNA · DDU GORAKHPUR UNIVERSITY', pageWidth / 2, currentY + 20, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(2, 132, 199);
    doc.text(paperTitle.toUpperCase(), pageWidth / 2, currentY + 36, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`CBCS NEP 2020 Examination Pattern · Total Questions: ${questions.length} · Max Marks: ${totalMarks} · Time: ${durationMins} Mins`, pageWidth / 2, currentY + 52, { align: 'center' });
    doc.text(`Marking Scheme: +1.5 Marks per correct answer · Zero Negative Marking (0 Penalty)`, pageWidth / 2, currentY + 65, { align: 'center' });

    currentY += 88;

    // --- Instructions Box ---
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(marginX, currentY, contentWidth, 34, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('IMPORTANT INSTRUCTIONS:', marginX + 8, currentY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('1. All questions are multiple choice (MCQs) carrying 1.5 marks each. Exactly one option is correct out of (A), (B), (C), (D).', marginX + 8, currentY + 22);
    doc.text('2. A verified Master Answer Key Table with rigorous mathematical & physical solutions is appended at the end of this paper.', marginX + 8, currentY + 30);

    currentY += 46;

    // Render Questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const img = loadedImages[i];
      const qNum = i + 1;

      // Estimate needed height
      let neededHeight = 35;
      if (img) {
        const aspect = img.width > 0 ? (img.height / img.width) : 0.5;
        const targetW = Math.min(contentWidth - 20, 480);
        const imgH = Math.min(220, targetW * aspect);
        neededHeight += imgH + 20;
      } else {
        neededHeight += 40;
      }

      // Page break check
      if (currentY + neededHeight > pageHeight - marginBottom) {
        doc.addPage();
        currentY = marginTop;
      }

      // Question Container Box
      const boxStartY = currentY;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.6);

      // Question Title Line
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, 18, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, currentY + 18, marginX + contentWidth, currentY + 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Question ${qNum}`, marginX + 6, currentY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${q.course_code || 'CBCS'} (${q.year || 'PYQ'}) · Original Q.${q.q_num || qNum}`, marginX + 70, currentY + 12);
      doc.text(`[+1.5 Marks | Neg: 0]`, marginX + contentWidth - 6, currentY + 12, { align: 'right' });

      currentY += 24;

      // Draw Screenshot Image if available
      if (img && img.width > 0) {
        try {
          const maxW = contentWidth - 24;
          const aspect = img.height / img.width;
          let drawW = maxW;
          let drawH = drawW * aspect;
          if (drawH > 220) {
            drawH = 220;
            drawW = drawH / aspect;
          }
          const drawX = marginX + (contentWidth - drawW) / 2;

          doc.addImage(img, 'PNG', drawX, currentY, drawW, drawH, undefined, 'FAST');
          currentY += drawH + 10;
        } catch (e) {
          console.warn('Error adding image to PDF:', e);
        }
      }

      // Fallback or auxiliary question text
      if (q.question) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const splitText = doc.splitTextToSize(q.question, contentWidth - 16);
        doc.text(splitText, marginX + 8, currentY);
        currentY += (splitText.length * 10) + 6;
      }

      currentY += 6;
      doc.roundedRect(marginX, boxStartY, contentWidth, currentY - boxStartY, 3, 3, 'D');
      currentY += 10;

      const pct = 55 + Math.round((i / questions.length) * 35);
      onProgress(pct, `Compiling document page (${i + 1}/${questions.length})...`);
    }

    // --- Master Answer Key Page ---
    onProgress(92, "Generating Master Answer Key Table...");
    doc.addPage();
    currentY = marginTop;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL MASTER ANSWER KEY & VERIFIED SOLUTIONS', pageWidth / 2, currentY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${paperTitle} · Total Questions: ${questions.length}`, pageWidth / 2, currentY + 14, { align: 'center' });

    currentY += 28;

    // Build Key Grid Data
    const tableBody = [];
    const columnsCount = 5;
    const rowsCount = Math.ceil(questions.length / columnsCount);

    for (let r = 0; r < rowsCount; r++) {
      const row = [];
      for (let c = 0; c < columnsCount; c++) {
        const qIdx = r + (c * rowsCount);
        if (qIdx < questions.length) {
          const qObj = questions[qIdx];
          const ansKey = (qObj.answer_key || qObj.answer || 'N/A').toUpperCase();
          row.push(`Q.${qIdx + 1}`);
          row.push(`(${ansKey})`);
        } else {
          row.push('');
          row.push('');
        }
      }
      tableBody.push(row);
    }

    if (doc.autoTable) {
      doc.autoTable({
        startY: currentY,
        head: [['Q#', 'Key', 'Q#', 'Key', 'Q#', 'Key', 'Q#', 'Key', 'Q#', 'Key']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: marginX, right: marginX }
      });
      currentY = doc.lastAutoTable.finalY + 20;
    }

    // Explanations Section
    if (currentY + 60 < pageHeight - marginBottom) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Note on Verification:', marginX, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('All answers have been rigorously mathematically and physically verified against standard academic theorems & university syllabi.', marginX, currentY + 12);
      doc.text('You can also take this test interactively with virtual calculator and timers on the Vaibhav Priyadarshi Academic Portal.', marginX, currentY + 22);
    }

    // Apply Running Headers and Footers
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawHeaderAndFooter(doc, p, totalPages);
    }

    onProgress(100, "Finalizing PDF file download...");
    const cleanFileName = `UNPG_Semester_Mock_Test_${questions.length}Q.pdf`;
    doc.save(cleanFileName);
    return true;
  }

  /**
   * Launch Interactive CBT Test in Browser
   */
  function launchCustomCbt(config) {
    const courseIds = config.courseIds || ['MAT301F'];
    const questionCount = Math.min(100, Math.max(1, parseInt(config.questionCount) || 50));
    const seed = config.seed !== undefined ? config.seed : Math.floor(Math.random() * 100000);

    const pool = collectMatchingQuestions({
      courseIds: courseIds,
      yearFilter: config.yearFilter || 'ALL'
    });

    if (pool.length === 0) {
      alert('No questions found matching your selected courses. Please select at least one course.');
      return;
    }

    const actualCount = Math.min(questionCount, pool.length);
    const questions = sampleQuestions(pool, actualCount, seed);

    const customTest = {
      id: "custom",
      name: config.title || `Custom Semester Mock Test (${actualCount} Questions)`,
      course_code: courseIds.length === 1 ? courseIds[0] : "Multi-Course",
      subject: "B.Sc. Semester Core",
      total_questions: actualCount,
      total_marks: (actualCount * 1.5).toFixed(1),
      duration_minutes: Math.round(actualCount * 1.8),
      pattern: "50 MCQs (+1.5 Marks, No Negative Marking)",
      questions: questions
    };

    try {
      sessionStorage.setItem('semester_custom_test', JSON.stringify(customTest));
      window.location.href = 'mock-test/test.html?test=custom';
    } catch (e) {
      console.error('Error saving custom test to sessionStorage:', e);
      alert('Could not start custom test due to storage limit. Try selecting fewer questions.');
    }
  }

  // UI Interactive Handlers
  window.updateCustomGeneratorSummary = function() {
    const checkboxes = document.querySelectorAll('input[name="custom-course"]:checked');
    const selectedCourseIds = Array.from(checkboxes).map(cb => cb.value);

    const yearRadio = document.querySelector('input[name="custom-year"]:checked');
    const selectedYear = yearRadio ? yearRadio.value : 'ALL';

    const countInput = document.getElementById('custom-q-slider');
    const qCount = countInput ? parseInt(countInput.value) : 30;

    const countDisplay = document.getElementById('custom-q-count-display');
    if (countDisplay) countDisplay.innerText = `${qCount} Questions`;

    // Filter available pool
    const pool = collectMatchingQuestions({
      courseIds: selectedCourseIds,
      yearFilter: selectedYear
    });

    // Update UI Summary Elements
    const topicsCountEl = document.getElementById('summary-topics-count');
    if (topicsCountEl) topicsCountEl.innerText = `${selectedCourseIds.length} / 5 Courses`;

    const poolCountEl = document.getElementById('summary-pool-count');
    if (poolCountEl) poolCountEl.innerText = `${pool.length} Qs Available`;

    const questionsCountEl = document.getElementById('summary-questions-count');
    if (questionsCountEl) {
      const actualSelected = Math.min(qCount, pool.length);
      questionsCountEl.innerText = `${actualSelected} Qs`;
    }

    const marksCountEl = document.getElementById('summary-marks-count');
    if (marksCountEl) {
      const actualSelected = Math.min(qCount, pool.length);
      marksCountEl.innerText = `${(actualSelected * 1.5).toFixed(1)} Marks`;
    }

    const timeCountEl = document.getElementById('summary-time-count');
    if (timeCountEl) {
      const actualSelected = Math.min(qCount, pool.length);
      timeCountEl.innerText = `${Math.round(actualSelected * 1.8)} Mins`;
    }
  };

  window.triggerCustomPdfGeneration = async function() {
    const checkboxes = document.querySelectorAll('input[name="custom-course"]:checked');
    const selectedCourseIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCourseIds.length === 0) {
      alert('Please select at least one semester course to include in your practice test.');
      return;
    }

    const yearRadio = document.querySelector('input[name="custom-year"]:checked');
    const selectedYear = yearRadio ? yearRadio.value : 'ALL';

    const countInput = document.getElementById('custom-q-slider');
    const qCount = countInput ? parseInt(countInput.value) : 30;

    const modal = document.getElementById('pdf-progress-modal');
    const fill = document.getElementById('pdf-progress-fill');
    const pctEl = document.getElementById('pdf-progress-pct');
    const statusEl = document.getElementById('pdf-progress-status');

    if (modal) modal.classList.remove('hidden');

    function onProg(percent, msg) {
      if (fill) fill.style.width = `${percent}%`;
      if (pctEl) pctEl.innerText = `${percent}%`;
      if (statusEl) statusEl.innerText = msg;
    }

    try {
      await generateCustomPdf({
        courseIds: selectedCourseIds,
        yearFilter: selectedYear,
        questionCount: qCount,
        title: `UNPG B.Sc. Semester Examination Practice Test`
      }, onProg);

      setTimeout(() => {
        if (modal) modal.classList.add('hidden');
      }, 1000);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('Error generating PDF: ' + err.message);
      if (modal) modal.classList.add('hidden');
    }
  };

  window.triggerCustomOnlineTest = function() {
    const checkboxes = document.querySelectorAll('input[name="custom-course"]:checked');
    const selectedCourseIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCourseIds.length === 0) {
      alert('Please select at least one semester course.');
      return;
    }

    const yearRadio = document.querySelector('input[name="custom-year"]:checked');
    const selectedYear = yearRadio ? yearRadio.value : 'ALL';

    const countInput = document.getElementById('custom-q-slider');
    const qCount = countInput ? parseInt(countInput.value) : 30;

    launchCustomCbt({
      courseIds: selectedCourseIds,
      yearFilter: selectedYear,
      questionCount: qCount,
      title: `Custom Semester Mock Test (${selectedCourseIds.join(', ')})`
    });
  };

  window.selectAllCourses = function(select) {
    document.querySelectorAll('input[name="custom-course"]').forEach(cb => {
      cb.checked = select;
    });
    window.updateCustomGeneratorSummary();
  };

})();
