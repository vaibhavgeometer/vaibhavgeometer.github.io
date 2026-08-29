/**
 * IIT JAM Mathematics (MA) — Offline Custom Mock Test & PDF Generator
 * Pure Client-Side Generator supporting Multi-Topic Selection, 1-100 Questions,
 * LaTeX-styled PDF compilation matching Official Mock Test Series, and Interactive CBT Test launching.
 */

(function() {
  'use strict';

  // Topic Metadata Definition
  const TOPICS_DATA = [
    {
      id: "1.1",
      name: "Sequences & Series of Real Numbers",
      subject: "Real Analysis",
      subjectKey: "real_analysis",
      icon: "🔢",
      subTopicName: "Sequences and Series of Real Numbers"
    },
    {
      id: "1.2",
      name: "Functions of One Real Variable",
      subject: "Real Analysis",
      subjectKey: "real_analysis",
      icon: "📈",
      subTopicName: "Functions of One Real Variable"
    },
    {
      id: "2.1",
      name: "Functions of 2 or 3 Variables",
      subject: "Multivariable Calculus & ODE",
      subjectKey: "calculus_ode",
      icon: "🌐",
      subTopicName: "Functions of Two or Three Real Variables"
    },
    {
      id: "2.2",
      name: "Integral Calculus (Multiple Integrals)",
      subject: "Multivariable Calculus & ODE",
      subjectKey: "calculus_ode",
      icon: "∬",
      subTopicName: "Integral Calculus"
    },
    {
      id: "2.3",
      name: "Ordinary Differential Equations (ODE)",
      subject: "Multivariable Calculus & ODE",
      subjectKey: "calculus_ode",
      icon: "🧮",
      subTopicName: "Differential Equations"
    },
    {
      id: "3.1",
      name: "Basic Algebra (P&C, Binomial)",
      subject: "Linear Algebra & Algebra",
      subjectKey: "linear_algebra",
      icon: "📐",
      subTopicName: "Basic algebra"
    },
    {
      id: "3.2",
      name: "Matrices & Systems of Linear Equations",
      subject: "Linear Algebra & Algebra",
      subjectKey: "linear_algebra",
      icon: "🔲",
      subTopicName: "Matrices"
    },
    {
      id: "3.3",
      name: "Finite Dimensional Vector Spaces",
      subject: "Linear Algebra & Algebra",
      subjectKey: "linear_algebra",
      icon: "🌌",
      subTopicName: "Finite Dimensional Vector Spaces"
    },
    {
      id: "3.4",
      name: "Group Theory",
      subject: "Linear Algebra & Algebra",
      subjectKey: "linear_algebra",
      icon: "🔄",
      subTopicName: "Groups"
    }
  ];

  window.TOPICS_METADATA = TOPICS_DATA;

  // Helper to extract clean answer key string
  function cleanAnswerKey(k) {
    if (!k) return "N/A";
    let s = String(k).trim();
    s = s.replace(/;/g, ', ');
    s = s.replace(/\s*,\s*/g, ', ');
    s = s.replace(/\s*(?:to|TO|To|–|—)\s*/g, ' to ');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
  }

  // Pre-load an Image for HTML5 Canvas / jsPDF
  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return reject(new Error('Device is offline'));
      }
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn('Could not load question image:', src);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          reject(new Error('Device is offline'));
        } else {
          resolve(null);
        }
      };
      img.src = src;
    });
  }

  // Filter and gather questions from MOCK_TESTS_DATA based on topic selections & options
  function collectMatchingQuestions(options) {
    if (!window.MOCK_TESTS_DATA) return [];

    const selectedTopicIds = options.topicIds || [];
    const selectedTypes = options.types || ['MCQ', 'MSQ', 'NAT'];
    const eraFilter = options.eraFilter || 'ALL'; // ALL, CBT (2015-2026), Classic (2005-2014)

    const allData = window.MOCK_TESTS_DATA;
    const matched = [];
    const seenIds = new Set();

    selectedTopicIds.forEach(topicId => {
      // Use comprehensive topic archive if available
      const topicTest = allData[topicId];
      if (topicTest && topicTest.questions && topicTest.questions.length > 0) {
        topicTest.questions.forEach(q => {
          if (!seenIds.has(q.id)) {
            seenIds.add(q.id);
            matched.push({
              ...q,
              topicId: topicId,
              topicName: topicTest.name.split('(')[0].trim()
            });
          }
        });
      }
    });

    // Apply era and question type filters
    return matched.filter(q => {
      // Type match
      const qType = (q.type || 'MCQ').toUpperCase();
      if (!selectedTypes.includes(qType)) return false;

      // Era match
      const yrMatch = (q.year || '').match(/\d{4}/);
      const yr = yrMatch ? parseInt(yrMatch[0]) : (q.year ? parseInt(q.year) : 2020);
      if (eraFilter === 'cbt' && yr < 2015) return false;
      if (eraFilter === 'classic' && yr >= 2015) return false;

      return true;
    });
  }

  // Seeded / Shuffle Sample of N questions
  function sampleQuestions(pool, count, seed) {
    if (pool.length <= count) {
      return [...pool];
    }

    // Pseudo-random generator if seed provided, else Math.random
    let rng = Math.random;
    if (typeof seed === 'number' && !isNaN(seed)) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      rng = function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }

    // Shuffle copy of pool
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Pick top count
    const selected = shuffled.slice(0, count);

    // Sort into Standard CBT Exam Section Hierarchy:
    // Section A (MCQ: 1M then 2M) -> Section B (MSQ: 2M) -> Section C (NAT: 1M then 2M)
    selected.sort((a, b) => {
      const typeRank = { 'MCQ': 1, 'MSQ': 2, 'NAT': 3 };
      const rankA = typeRank[a.type || 'MCQ'] || 4;
      const rankB = typeRank[b.type || 'MCQ'] || 4;
      if (rankA !== rankB) return rankA - rankB;

      const marksA = a.marks || 1;
      const marksB = b.marks || 1;
      if (marksA !== marksB) return marksA - marksB;

      return (a.id || '').localeCompare(b.id || '');
    });

    return selected;
  }

  /**
   * Generates a Publication-Quality PDF matching the reference format using jsPDF.
   * @param {Object} config
   * @param {Function} onProgress (percent, statusText)
   */
  async function generateCustomPdf(config, onProgress) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error('jsPDF library not loaded. Ensure jspdf.umd.min.js is included.');
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Internet Connection Required: You appear to be offline. An active internet connection is required to fetch official question screenshots for generating the PDF.');
    }

    onProgress = onProgress || (() => {});
    onProgress(5, "Filtering questions dataset...");

    const topicIds = config.topicIds || ['2.3'];
    const questionCount = Math.min(100, Math.max(1, parseInt(config.questionCount) || 30));
    const seed = config.seed !== undefined ? config.seed : Math.floor(Math.random() * 100000);
    const paperTitle = config.title || `IIT JAM Mathematics Custom Practice Test`;

    // 1. Gather pool & sample
    const pool = collectMatchingQuestions({
      topicIds: topicIds,
      types: config.types || ['MCQ', 'MSQ', 'NAT'],
      eraFilter: config.eraFilter || 'ALL'
    });

    if (pool.length === 0) {
      throw new Error('No questions found matching your selected topics and filters. Please select more topics.');
    }

    const actualCount = Math.min(questionCount, pool.length);
    const questions = sampleQuestions(pool, actualCount, seed);

    onProgress(15, `Selected ${questions.length} questions. Downloading screenshots...`);

    // 2. Preload all question screenshot images
    const loadedImages = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        const img = await preloadImage(q.image);
        loadedImages.push(img);
      } catch (err) {
        throw new Error('Internet Connection Required: Failed to download question screenshots because you are offline. Please reconnect to the internet and try again.');
      }
      const pct = 15 + Math.round((i / questions.length) * 35);
      onProgress(pct, `Loaded question asset ${i + 1}/${questions.length}...`);
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
    const marginX = 42; // ~1.5 cm
    const marginTop = 50;
    const marginBottom = 45;
    const contentWidth = pageWidth - (marginX * 2);

    // Calculate metadata metrics
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const mcqCount = questions.filter(q => (q.type || 'MCQ') === 'MCQ').length;
    const msqCount = questions.filter(q => q.type === 'MSQ').length;
    const natCount = questions.filter(q => q.type === 'NAT').length;
    const durationMins = Math.max(15, Math.round(questions.length * 3.0));

    // Get selected topic names string
    const selectedTopicNames = TOPICS_DATA
      .filter(t => topicIds.includes(t.id))
      .map(t => t.name)
      .join(', ');

    // -------------------------------------------------------------
    // Helper: Draw Running Header & Running Footer
    // -------------------------------------------------------------
    function drawHeaderAndFooter(docInstance, pageNum, totalPages) {
      // Header on pages > 1
      if (pageNum > 1) {
        docInstance.setFont('helvetica', 'bold');
        docInstance.setFontSize(8.5);
        docInstance.setTextColor(30, 41, 59);
        docInstance.text('IIT JAM Mathematics (MA) • Custom Mock Test', marginX, 30);

        docInstance.setFont('helvetica', 'italic');
        docInstance.setFontSize(8.5);
        docInstance.setTextColor(71, 85, 105);
        const titleShort = docInstance.splitTextToSize(paperTitle, 220)[0] || paperTitle;
        docInstance.text(titleShort, pageWidth - marginX, 30, { align: 'right' });

        // Divider
        docInstance.setDrawColor(203, 213, 225);
        docInstance.setLineWidth(0.6);
        docInstance.line(marginX, 36, pageWidth - marginX, 36);
      }

      // Footer on all pages
      const footerY = pageHeight - 25;
      docInstance.setDrawColor(203, 213, 225);
      docInstance.setLineWidth(0.6);
      docInstance.line(marginX, footerY - 8, pageWidth - marginX, footerY - 8);

      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(8);
      docInstance.setTextColor(100, 116, 139);
      docInstance.text('IIT JAM MA CBT Portal • vaibhavgeometer.github.io', marginX, footerY + 4);

      docInstance.setFont('helvetica', 'bold');
      docInstance.setTextColor(30, 41, 59);
      docInstance.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginX, footerY + 4, { align: 'right' });
    }

    // -------------------------------------------------------------
    // PAGE 1: COVER / SUMMARY PAGE (LaTeX Formatted Overview)
    // -------------------------------------------------------------
    let curY = marginTop;

    // Header Box
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.roundedRect(marginX, curY, contentWidth, 75, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 138); // Navy
    doc.text('JOINT ADMISSION TEST FOR MASTERS • IIT JAM MATHEMATICS (MA)', pageWidth / 2, curY + 18, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(15, 23, 42); // Slate dark
    const wrappedTitle = doc.splitTextToSize(paperTitle, contentWidth - 30);
    doc.text(wrappedTitle[0], pageWidth / 2, curY + 38, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const subtopicsText = `Topics: ${selectedTopicNames.length > 70 ? selectedTopicNames.substring(0, 67) + '...' : selectedTopicNames} • ${questions.length} Selected PYQs`;
    doc.text(subtopicsText, pageWidth / 2, curY + 58, { align: 'center' });

    curY += 86;

    // 4 Stat Cards Grid
    const statGutter = 8;
    const statCardWidth = (contentWidth - (statGutter * 3)) / 4;
    const statCardHeight = 44;

    const statItems = [
      { label: "TOTAL QUESTIONS", value: `${questions.length}`, color: [15, 118, 110] }, // Teal
      { label: "TOTAL MARKS", value: `${totalMarks} M`, color: [29, 78, 216] },      // Blue
      { label: "TEST DURATION", value: `${durationMins} Min`, color: [180, 83, 9] }, // Amber
      { label: "PAPER PATTERN", value: "MCQ • MSQ • NAT", color: [51, 65, 85] }     // Slate
    ];

    statItems.forEach((st, idx) => {
      const cardX = marginX + (idx * (statCardWidth + statGutter));
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.8);
      doc.roundedRect(cardX, curY, statCardWidth, statCardHeight, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(st.label, cardX + (statCardWidth / 2), curY + 14, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(st.label === "PAPER PATTERN" ? 8.5 : 12);
      doc.setTextColor(st.color[0], st.color[1], st.color[2]);
      doc.text(st.value, cardX + (statCardWidth / 2), curY + 32, { align: 'center' });
    });

    curY += statCardHeight + 14;

    // Section Structure Table
    const tableRowHeight = 19;
    const tableWidth = contentWidth;
    const colWidths = [120, 55, 95, 105, 136];

    // Table Header
    doc.setFillColor(30, 41, 59); // Dark slate
    doc.roundedRect(marginX, curY, tableWidth, 20, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let curColX = marginX;
    const headers = ['Section / Type', 'Questions', 'Marking Scheme', 'Negative Marking', 'Format / Details'];
    const aligns = ['left', 'center', 'center', 'center', 'left'];

    headers.forEach((h, i) => {
      const colX = aligns[i] === 'center' ? curColX + (colWidths[i] / 2) : (curColX + 8);
      doc.text(h, colX, curY + 13, { align: aligns[i] });
      curColX += colWidths[i];
    });

    curY += 20;

    const rowsData = [];
    if (mcqCount > 0) rowsData.push(['Section A: MCQ', `${mcqCount}`, '+1 / +2 Marks', '-1/3 / -2/3 Marks', '4 Options (1 Correct)']);
    if (msqCount > 0) rowsData.push(['Section B: MSQ', `${msqCount}`, '+2 Marks', 'Nil (0)', '4 Options (1+ Correct)']);
    if (natCount > 0) rowsData.push(['Section C: NAT', `${natCount}`, '+1 / +2 Marks', 'Nil (0)', 'Real Decimal Value']);

    rowsData.forEach((row, rIdx) => {
      doc.setFillColor(rIdx % 2 === 0 ? 248 : 255, rIdx % 2 === 0 ? 250 : 255, rIdx % 2 === 0 ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.rect(marginX, curY, tableWidth, tableRowHeight, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      let colXPos = marginX;
      row.forEach((cell, cIdx) => {
        if (cIdx === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        const textX = aligns[cIdx] === 'center' ? colXPos + (colWidths[cIdx] / 2) : (colXPos + 8);
        doc.text(cell, textX, curY + 12.5, { align: aligns[cIdx] });
        colXPos += colWidths[cIdx];
      });

      curY += tableRowHeight;
    });

    curY += 14;

    // Important Instructions Callout Block
    const instructionsBoxY = curY;
    const instructionsHeight = 220;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.8);
    doc.roundedRect(marginX, instructionsBoxY, contentWidth, instructionsHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 138);
    doc.text('IMPORTANT INSTRUCTIONS FOR CANDIDATES', marginX + 12, instructionsBoxY + 18);

    const instructions = [
      "1. Authentic Examination PYQs: This custom question paper comprises verified official IIT JAM Mathematics (MA) questions selected based on your chosen topics.",
      "2. Section A (Multiple Choice Questions - MCQ): Each question has four options, with only one correct choice. Wrong answers carry negative penalty: 1/3 deduction for 1-mark questions, and 2/3 deduction for 2-mark questions.",
      "3. Section B (Multiple Select Questions - MSQ): Each question has four options, where one or more than one option(s) may be correct. Full marks are awarded only if all correct choices and zero incorrect choices are chosen. No partial or negative marking.",
      "4. Section C (Numerical Answer Type - NAT): Numerical answers are real numbers entered via keyboard. Full credit is awarded if the numerical answer falls within the official accepted interval. No negative marking.",
      "5. Master Answer Key & Solutions: Complete official answers, acceptance ranges, and evaluation rubrics are provided on the final page of this document.",
      "6. Online Interactive Simulator: You can also practice this test with interactive timers, virtual scientific calculator, and instant scoring analytics at vaibhavgeometer.github.io."
    ];

    let instY = instructionsBoxY + 34;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    instructions.forEach(inst => {
      const wrappedInst = doc.splitTextToSize(inst, contentWidth - 24);
      doc.text(wrappedInst, marginX + 12, instY);
      instY += (wrappedInst.length * 10.5) + 4;
    });

    // Branding note at bottom
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('IIT JAM Mathematics Custom Practice Series • Curated by Vaibhav Geometer', pageWidth / 2, instructionsBoxY + instructionsHeight + 20, { align: 'center' });

    // -------------------------------------------------------------
    // QUESTIONS SECTION (Cards with Badges & High-Res Screenshots)
    // -------------------------------------------------------------
    onProgress(60, "Generating question cards and rendering screenshots...");

    let currentSectionType = null;
    const pageCardLimit = pageHeight - marginBottom - 30;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const img = loadedImages[i];
      const qNum = i + 1;
      const qType = (q.type || 'MCQ').toUpperCase();
      const qMarks = q.marks || 1;
      const qNeg = q.negative_marks || (qType === 'MCQ' ? (qMarks === 1 ? '0.33' : '0.67') : 0);
      const negStr = Number(qNeg) > 0 ? `-${qNeg}` : 'Nil (0)';
      const qYear = q.year ? `JAM ${String(q.year).replace(/[^0-9]/g, '')}` : 'JAM';
      const origQNum = q.q_num || qNum;
      const qId = q.id || `Q_${qNum}`;

      // Section Title Banner if type changed
      const secTitle = qType === 'MCQ' ? "SECTION A: MULTIPLE CHOICE QUESTIONS (MCQ)" :
                       (qType === 'MSQ' ? "SECTION B: MULTIPLE SELECT QUESTIONS (MSQ)" : "SECTION C: NUMERICAL ANSWER TYPE (NAT)");

      // Check if we need to start a new page
      if (i === 0 || qType !== currentSectionType) {
        doc.addPage();
        curY = marginTop;
        currentSectionType = qType;

        // Draw Section Banner
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(marginX, curY, contentWidth, 20, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(secTitle, marginX + 10, curY + 13.5);
        curY += 28;
      }

      // Calculate Card & Image Dimensions
      const cardPaddingX = 8;
      const cardHeaderHeight = 22;
      const maxImgWidth = contentWidth - (cardPaddingX * 2);
      let imgDrawWidth = maxImgWidth;
      let imgDrawHeight = 80;

      if (img && img.naturalWidth && img.naturalHeight) {
        const aspect = img.naturalHeight / img.naturalWidth;
        imgDrawHeight = Math.min(imgDrawWidth * aspect, 280);
        imgDrawWidth = imgDrawHeight / aspect;
      }

      const totalCardHeight = cardHeaderHeight + imgDrawHeight + 14;

      // If card exceeds page bounds, break page
      if (curY + totalCardHeight > pageCardLimit) {
        doc.addPage();
        curY = marginTop;
      }

      // Draw Question Card Outer Box
      const cardTopY = curY;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.8);
      doc.roundedRect(marginX, cardTopY, contentWidth, totalCardHeight, 4, 4, 'FD');

      // Card Header Rectangle
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.8);
      doc.roundedRect(marginX, cardTopY, contentWidth, cardHeaderHeight, 4, 4, 'FD');
      // Fix bottom border flat edge
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, cardTopY + cardHeaderHeight, marginX + contentWidth, cardTopY + cardHeaderHeight);

      // 1. Question Number Pill
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(marginX + 6, cardTopY + 3.5, 62, 15, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Question ${qNum}`, marginX + 37, cardTopY + 14, { align: 'center' });

      // 2. Metadata Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`(${qYear} • Q${origQNum} • ID: ${qId})`, marginX + 74, cardTopY + 14);

      // 3. Badges on Right: Type, Marks, Neg
      let rightBadgeX = marginX + contentWidth - 6;

      // Penalty Badge
      const negBadgeWidth = 48;
      rightBadgeX -= negBadgeWidth;
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.setLineWidth(0.6);
      doc.roundedRect(rightBadgeX, cardTopY + 3.5, negBadgeWidth, 15, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(153, 27, 27);
      doc.text(`Neg: ${negStr}`, rightBadgeX + (negBadgeWidth / 2), cardTopY + 14, { align: 'center' });

      // Marks Badge
      const marksBadgeWidth = 32;
      rightBadgeX -= (marksBadgeWidth + 4);
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.6);
      doc.roundedRect(rightBadgeX, cardTopY + 3.5, marksBadgeWidth, 15, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`+${qMarks} M`, rightBadgeX + (marksBadgeWidth / 2), cardTopY + 14, { align: 'center' });

      // Type Badge
      const typeBadgeWidth = 34;
      rightBadgeX -= (typeBadgeWidth + 4);
      let typeBg = [239, 246, 255];   // Blue for MCQ
      let typeStroke = [147, 197, 253];
      let typeTextCol = [30, 64, 175];
      if (qType === 'MSQ') {
        typeBg = [240, 253, 244];     // Green for MSQ
        typeStroke = [134, 239, 172];
        typeTextCol = [22, 101, 52];
      } else if (qType === 'NAT') {
        typeBg = [255, 251, 235];     // Amber for NAT
        typeStroke = [253, 230, 138];
        typeTextCol = [146, 64, 14];
      }

      doc.setFillColor(typeBg[0], typeBg[1], typeBg[2]);
      doc.setDrawColor(typeStroke[0], typeStroke[1], typeStroke[2]);
      doc.setLineWidth(0.6);
      doc.roundedRect(rightBadgeX, cardTopY + 3.5, typeBadgeWidth, 15, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(typeTextCol[0], typeTextCol[1], typeTextCol[2]);
      doc.text(qType, rightBadgeX + (typeBadgeWidth / 2), cardTopY + 14, { align: 'center' });

      // 4. Draw Screenshot Image Centered inside Card Body
      const imgX = marginX + ((contentWidth - imgDrawWidth) / 2);
      const imgY = cardTopY + cardHeaderHeight + 6;

      if (img) {
        try {
          doc.addImage(img, 'PNG', imgX, imgY, imgDrawWidth, imgDrawHeight, undefined, 'FAST');
        } catch (err) {
          console.warn('Error drawing image for question', q.id, err);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text(`[Screenshot: ${q.image}]`, marginX + 15, imgY + 25);
        }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`[Question Screenshot: ${q.image}]`, marginX + 15, imgY + 25);
      }

      curY += totalCardHeight + 10;
      onProgress(60 + Math.round((i / questions.length) * 28), `Assembled question ${i + 1}/${questions.length}...`);
    }

    // -------------------------------------------------------------
    // MASTER ANSWER KEY & EVALUATION RUBRIC PAGE
    // -------------------------------------------------------------
    onProgress(90, "Compiling Master Answer Key & Evaluation Rubric...");

    doc.addPage();
    curY = marginTop;

    // Header Banner
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(marginX, curY, contentWidth, 36, 4, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('OFFICIAL MASTER ANSWER KEY & EVALUATION RUBRIC', pageWidth / 2, curY + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${paperTitle} • All Official Answers & Acceptance Ranges`, pageWidth / 2, curY + 29, { align: 'center' });

    curY += 46;

    // 3-Column (or 2-Column) Key Table Layout
    const numCols = questions.length >= 30 ? 3 : (questions.length > 10 ? 2 : 1);
    const chunkColGutter = 8;
    const singleChunkWidth = (contentWidth - ((numCols - 1) * chunkColGutter)) / numCols;
    const chunkSize = Math.ceil(questions.length / numCols);

    const chunks = [];
    for (let c = 0; c < numCols; c++) {
      chunks.push(questions.slice(c * chunkSize, (c + 1) * chunkSize));
    }

    const keyRowHeight = 16.5;
    const keySubCols = [
      singleChunkWidth * 0.18, // Q.No
      singleChunkWidth * 0.22, // Type
      singleChunkWidth * 0.20, // Marks
      singleChunkWidth * 0.40  // Official Key
    ];

    let maxKeyTableBottomY = curY;

    chunks.forEach((chunk, cIdx) => {
      if (!chunk || chunk.length === 0) return;
      const chunkX = marginX + (cIdx * (singleChunkWidth + chunkColGutter));
      let chunkY = curY;

      // Chunk Table Header
      doc.setFillColor(51, 65, 85);
      doc.roundedRect(chunkX, chunkY, singleChunkWidth, 18, 3, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);

      const headerLabels = ['Q. No.', 'Type', 'Marks', 'Official Key'];
      let subX = chunkX;
      headerLabels.forEach((hl, hi) => {
        const textCenter = subX + (keySubCols[hi] / 2);
        doc.text(hl, textCenter, chunkY + 11.5, { align: 'center' });
        subX += keySubCols[hi];
      });

      chunkY += 18;

      // Chunk Table Rows
      chunk.forEach((qInChunk, rIdx) => {
        const qOverallIdx = questions.indexOf(qInChunk) + 1;
        const qType = (qInChunk.type || 'MCQ').toUpperCase();
        const qMarks = `+${qInChunk.marks || 1}`;
        const rawKey = cleanAnswerKey(qInChunk.answer_key);

        doc.setFillColor(rIdx % 2 === 0 ? 248 : 255, rIdx % 2 === 0 ? 250 : 255, rIdx % 2 === 0 ? 252 : 255);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.rect(chunkX, chunkY, singleChunkWidth, keyRowHeight, 'FD');

        let cellX = chunkX;

        // Q.No
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${qOverallIdx}`, cellX + (keySubCols[0] / 2), chunkY + 11, { align: 'center' });
        cellX += keySubCols[0];

        // Type
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(qType, cellX + (keySubCols[1] / 2), chunkY + 11, { align: 'center' });
        cellX += keySubCols[1];

        // Marks
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(qMarks, cellX + (keySubCols[2] / 2), chunkY + 11, { align: 'center' });
        cellX += keySubCols[2];

        // Official Key (Bold)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        const keyCleanTrunc = rawKey.length > 18 ? rawKey.substring(0, 16) + '..' : rawKey;
        doc.text(keyCleanTrunc, cellX + (keySubCols[3] / 2), chunkY + 11, { align: 'center' });

        chunkY += keyRowHeight;
      });

      // Outer border for chunk table
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.8);
      doc.roundedRect(chunkX, curY, singleChunkWidth, chunkY - curY, 3, 3, 'D');

      if (chunkY > maxKeyTableBottomY) maxKeyTableBottomY = chunkY;
    });

    curY = maxKeyTableBottomY + 14;

    // Scoring Methodology Callout Box
    const rubricBoxY = curY;
    const rubricBoxHeight = 100;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.roundedRect(marginX, rubricBoxY, contentWidth, rubricBoxHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SCORING METHODOLOGY & EVALUATION GUIDELINES', marginX + 10, rubricBoxY + 15);

    const rubricPoints = [
      "• Multiple Choice Questions (MCQ): Full marks for correct single choice. Negative marks deducted for each incorrect attempt (-1/3 for 1-mark questions, -2/3 for 2-mark questions). Unattempted questions award zero.",
      "• Multiple Select Questions (MSQ): Full marks if and only if all correct choices are marked and no incorrect choice is selected. Zero marks for partial selection or any incorrect choice. No negative marking.",
      "• Numerical Answer Type (NAT): Any numerical value falling strictly within the specified official range (e.g., [a, b]) receives full credit. No negative marking.",
      "• Marks to All (MTA): Questions officially designated as MTA award full marks to all candidates regardless of attempt."
    ];

    let rubY = rubricBoxY + 28;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    rubricPoints.forEach(pt => {
      const wrappedPt = doc.splitTextToSize(pt, contentWidth - 20);
      doc.text(wrappedPt, marginX + 10, rubY);
      rubY += (wrappedPt.length * 9.5) + 3;
    });

    // -------------------------------------------------------------
    // Apply Header & Footer to all pages
    // -------------------------------------------------------------
    const totalPagesCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPagesCount; p++) {
      doc.setPage(p);
      drawHeaderAndFooter(doc, p, totalPagesCount);
    }

    onProgress(98, "Saving PDF and preparing download...");

    // Generate output filename
    const cleanFileName = paperTitle
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'IIT_JAM_Custom_Mock_Test';
    const finalFilename = `${cleanFileName}_${questions.length}Q.pdf`;

    // Trigger download
    doc.save(finalFilename);

    onProgress(100, `Done! Downloaded ${finalFilename}`);

    return {
      filename: finalFilename,
      questionsCount: questions.length,
      totalPages: totalPagesCount,
      totalMarks: totalMarks,
      duration: durationMins,
      questions: questions
    };
  }

  // Export globally
  window.JAM_CUSTOM_GENERATOR = {
    topics: TOPICS_DATA,
    collectMatchingQuestions: collectMatchingQuestions,
    sampleQuestions: sampleQuestions,
    generateCustomPdf: generateCustomPdf
  };

})();
