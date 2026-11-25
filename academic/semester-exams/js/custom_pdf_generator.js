/* ============================================
   UNPG B.Sc. Semester V — Custom Mock Test & High-Res PDF Generator
   ============================================
   - Filters across Courses (MAT301F-PHY302F), Years, Solved Status, and 5-Tier Difficulty
   - Generates multi-page A4 Exam Paper Booklet PDFs with cover page, stats,
     framed high-res PYQ screenshots, and Multi-Column Master Answer Key
   - Launches Instant Interactive CBT Mode via sessionStorage ('semester_custom_test')
   ============================================ */
(function () {
  'use strict';

  const TRACKER_KEY = 'sem_pyq_user_tracker_v1';

  const COURSE_CATALOG = [
    { id: 'MAT301F', title: 'Ring Theory & Linear Algebra', subject: 'Mathematics' },
    { id: 'MAT302F', title: 'Tensor Analysis', subject: 'Mathematics' },
    { id: 'MAT303F', title: 'Differential Geometry', subject: 'Mathematics' },
    { id: 'PHY301F', title: 'Classical & Statistical Mechanics', subject: 'Physics' },
    { id: 'PHY302F', title: 'Quantum Mechanics & Spectroscopy', subject: 'Physics' }
  ];

  const DIFF_DISPLAY = {
    very_easy: { label: 'Very Easy', rgb: [16, 185, 129] },
    easy: { label: 'Easy', rgb: [6, 182, 212] },
    medium: { label: 'Medium', rgb: [245, 158, 11] },
    hard: { label: 'Hard', rgb: [239, 68, 68] },
    hardest: { label: 'Very Hard', rgb: [168, 85, 247] }
  };

  function getSolvedMap() {
    try {
      const raw = localStorage.getItem(TRACKER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.solved && typeof parsed.solved === 'object') {
          return parsed.solved;
        }
      }
    } catch (e) {}
    return {};
  }

  function collectMatchingQuestions(config) {
    const cfg = config || {};
    const selectedCourses = Array.isArray(cfg.courseIds) ? cfg.courseIds : [];
    if (!selectedCourses.length) return [];

    const yearFilter = cfg.yearFilter || 'ALL';
    const solvedStatus = cfg.solvedStatus || 'ALL';
    const diffList = Array.isArray(cfg.difficulties) ? cfg.difficulties : null;

    const solvedMap = getSolvedMap();
    const tests = window.MOCK_TESTS_DATA || {};
    const matched = [];

    Object.values(tests).forEach((t) => {
      if (!selectedCourses.includes(t.course_code)) return;
      if (yearFilter !== 'ALL' && t.year !== yearFilter) return;

      (t.questions || []).forEach((q) => {
        const isSolved = Boolean(solvedMap[q.id]);
        if (solvedStatus === 'solved' && !isSolved) return;
        if (solvedStatus === 'unsolved' && isSolved) return;

        const diffInfo = window.SEM_DIFFICULTY
          ? window.SEM_DIFFICULTY.getQuestionDifficulty(q, t)
          : { level: 'unrated', isUserTagged: false };

        if (diffList && diffList.length > 0 && diffList.length < 5) {
          if (!diffInfo.isUserTagged || !diffList.includes(diffInfo.level)) return;
        }

        matched.push(Object.assign({}, q, {
          course_code: q.course_code || t.course_code,
          course_title: t.course_title || '',
          subject: t.subject || '',
          year: q.year || t.year,
          marks: Number(q.marks !== undefined ? q.marks : 1.5),
          negative_marks: Number(q.negative_marks !== undefined ? q.negative_marks : 0),
          diffInfo,
          isSolved
        }));
      });
    });

    return matched;
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function sampleQuestions(pool, desiredCount) {
    const list = Array.isArray(pool) ? pool : [];
    const target = Math.max(1, Math.min(list.length, Number(desiredCount) || list.length));
    const sampled = shuffleArray(list).slice(0, target);
    // Organize cleanly by Course Code -> Year desc -> Paper Q#
    sampled.sort((a, b) => {
      if (a.course_code !== b.course_code) return a.course_code.localeCompare(b.course_code);
      if (a.year !== b.year) return String(b.year).localeCompare(String(a.year));
      return Number(a.q_num || 0) - Number(b.q_num || 0);
    });
    return sampled;
  }

  function loadImageAsDataUrl(srcPath) {
    return new Promise((resolve) => {
      if (!srcPath) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height
          });
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = srcPath;
    });
  }

  function slugify(str) {
    return String(str || 'UNPG_Semester_V_Custom_Test')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'UNPG_Semester_V_Custom_Test';
  }

  async function generateCustomPdf(config, progressCb) {
    const notify = typeof progressCb === 'function' ? progressCb : () => {};

    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF library is not loaded.');
    }

    const pool = collectMatchingQuestions(config);
    if (!pool.length) {
      throw new Error('No questions match your selected filters. Try broadening courses, years, or difficulty.');
    }

    const selected = sampleQuestions(pool, config.questionCount || 50);
    const totalQ = selected.length;
    const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks || 1.5), 0);
    const durationMins = Math.max(15, Math.round(totalQ * 1.8));
    const titleText = (config.customTitle && config.customTitle.trim())
      ? config.customTitle.trim()
      : 'UNPG B.Sc. Semester V — Custom Mock Paper';

    notify(5, `Preparing ${totalQ} screenshots...`);

    // Preload images in modest batches so progress bar updates smoothly
    const loadedImgs = new Array(totalQ).fill(null);
    const batchSize = 6;
    for (let i = 0; i < totalQ; i += batchSize) {
      const slice = selected.slice(i, i + batchSize);
      const res = await Promise.all(slice.map((q) => loadImageAsDataUrl(q.image)));
      res.forEach((r, idx) => { loadedImgs[i + idx] = r; });
      const pct = 5 + Math.round(((Math.min(totalQ, i + batchSize)) / totalQ) * 65);
      notify(pct, `Loading question images (${Math.min(totalQ, i + batchSize)} / ${totalQ})...`);
    }

    notify(75, 'Composing cover page and question sheets...');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = 14;
    const contentW = pageW - margin * 2;

    // --- Page 1: Cover Page ---
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 56, 'F');

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 54, pageW, 2.5, 'F');

    doc.setTextColor(165, 180, 252);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('UNPG / DDUGU B.SC. SEMESTER V (NEP) · CUSTOM PRACTICE MOCK TEST', margin, 17);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    const splitTitle = doc.splitTextToSize(titleText, contentW);
    doc.text(splitTitle.slice(0, 2), margin, 28);

    doc.setTextColor(203, 213, 225);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    doc.text(`Generated on ${dateStr}  |  Source Pool: 2023-24, 2024-25 & 2025-26 PYQs`, margin, 46);

    // 4 Stat Metric Cards
    const cardY = 66;
    const cardGap = 4;
    const cardW = (contentW - cardGap * 3) / 4;
    const metrics = [
      { label: 'TOTAL QUESTIONS', val: `${totalQ} MCQs` },
      { label: 'MAX MARKS', val: `${totalMarks.toFixed(1)}` },
      { label: 'RECOMMENDED TIME', val: `${durationMins} Mins` },
      { label: 'NEGATIVE MARKING', val: 'Zero (0)' }
    ];
    metrics.forEach((m, idx) => {
      const cx = margin + idx * (cardW + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, cardY, cardW, 22, 2.5, 2.5, 'FD');

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.text(m.label, cx + cardW / 2, cardY + 7.5, { align: 'center' });

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text(m.val, cx + cardW / 2, cardY + 16.5, { align: 'center' });
    });

    // Course Breakdown Table
    const byCourse = {};
    selected.forEach((q) => {
      if (!byCourse[q.course_code]) {
        byCourse[q.course_code] = {
          code: q.course_code,
          title: q.course_title || q.course_code,
          subject: q.subject || '—',
          count: 0,
          marks: 0
        };
      }
      byCourse[q.course_code].count++;
      byCourse[q.course_code].marks += Number(q.marks || 1.5);
    });
    const tableBody = Object.values(byCourse).map((c) => [
      c.code,
      c.title,
      c.subject,
      `${c.count}`,
      `${c.marks.toFixed(1)}`
    ]);

    let nextY = 98;
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: nextY,
        margin: { left: margin, right: margin },
        head: [['Course Code', 'Paper Title', 'Subject', 'Questions', 'Marks']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      nextY = doc.lastAutoTable.finalY + 10;
    }

    // Instructions Box
    const instY = Math.min(nextY, 210);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin, instY, contentW, 48, 3, 3, 'FD');

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Candidate Instructions (UNPG / DDUGU NEP Marking Scheme)', margin + 5, instY + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.7);
    doc.setTextColor(30, 41, 59);
    const instructions = [
      '1. All questions are Multiple Choice Questions (MCQs) with four options: (A), (B), (C), and (D).',
      '2. Each correct response awards +1.5 marks. There is ZERO negative marking for incorrect answers.',
      '3. Standard university benchmark: 50 MCQs carry 75 Marks in 90 Minutes (~1.8 mins per question).',
      '4. Do not inspect the Master Answer Key at the end until you finish solving all questions.'
    ];
    instructions.forEach((line, i) => {
      doc.text(line, margin + 5, instY + 17 + i * 7);
    });

    // --- Question Pages ---
    doc.addPage();
    let curY = 20;

    selected.forEach((q, idx) => {
      const qNo = idx + 1;
      const imgObj = loadedImgs[idx];
      const maxImgW = contentW - 8;
      let imgDrawW = maxImgW;
      let imgDrawH = 22;

      if (imgObj && imgObj.width && imgObj.height) {
        const aspect = imgObj.height / imgObj.width;
        imgDrawH = imgDrawW * aspect;
        if (imgDrawH > 110) {
          imgDrawH = 110;
          imgDrawW = imgDrawH / aspect;
        }
      }

      const cardH = 12 + imgDrawH + 6;
      if (curY + cardH > pageH - 18) {
        doc.addPage();
        curY = 20;
      }

      // Outer Card Border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, curY, contentW, cardH, 2, 2, 'FD');

      // Header Strip
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, contentW, 8.5, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`Q${qNo}.`, margin + 3.5, curY + 5.8);

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${q.course_code} · ${q.year} · Paper Q${q.q_num || qNo}`, margin + 15, curY + 5.8);

      if (q.diffInfo && q.diffInfo.isUserTagged && DIFF_DISPLAY[q.diffInfo.level]) {
        const dMeta = DIFF_DISPLAY[q.diffInfo.level];
        doc.setTextColor(dMeta.rgb[0], dMeta.rgb[1], dMeta.rgb[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.text(`[${dMeta.label}]  +${q.marks} Marks`, margin + contentW - 3.5, curY + 5.8, { align: 'right' });
      } else {
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.text(`+${q.marks} Marks`, margin + contentW - 3.5, curY + 5.8, { align: 'right' });
      }

      if (imgObj && imgObj.dataUrl) {
        const imgX = margin + (contentW - imgDrawW) / 2;
        doc.addImage(imgObj.dataUrl, 'PNG', imgX, curY + 11, imgDrawW, imgDrawH);
      } else {
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const fallback = doc.splitTextToSize(q.question || 'Official screenshot unavailable.', contentW - 8);
        doc.text(fallback.slice(0, 3), margin + 4, curY + 15);
      }

      curY += cardH + 5;
    });

    notify(90, 'Building Master Answer Key...');

    // --- Final Page: Master Answer Key ---
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('MASTER ANSWER KEY & SCORING SUMMARY', margin, 15.5);

    const keyRows = selected.map((q, idx) => {
      const dLabel = (q.diffInfo && q.diffInfo.isUserTagged && DIFF_DISPLAY[q.diffInfo.level])
        ? DIFF_DISPLAY[q.diffInfo.level].label
        : '—';
      return [
        `Q${idx + 1}`,
        `${q.course_code} (${q.year} Q${q.q_num || idx + 1})`,
        `Option (${q.answer_key || 'A'})`,
        dLabel,
        `+${q.marks}`
      ];
    });

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: 32,
        margin: { left: margin, right: margin },
        head: [['Q. No', 'Paper Reference', 'Answer Key', 'Difficulty', 'Marks']],
        body: keyRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.2, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    }

    // Running Headers & Footers on pages 2..N
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      if (p > 1 && p < pageCount) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(100, 116, 139);
        doc.text(titleText.slice(0, 72), margin, 11);
        doc.line(margin, 13, pageW - margin, 13);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('UNPG B.Sc. Semester V Archive · vaibhavgeometer.github.io/academic/semester-exams', margin, pageH - 8);
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 8, { align: 'right' });
    }

    notify(100, 'Saving PDF file...');
    const fileName = `${slugify(titleText)}.pdf`;
    doc.save(fileName);

    return { fileName, totalQuestions: totalQ, totalMarks };
  }

  window.SEM_CUSTOM_GENERATOR = {
    COURSE_CATALOG,
    collectMatchingQuestions,
    sampleQuestions,
    generateCustomPdf
  };
})();
