# IIT JAM Mathematics (MA) — Topic-Wise Mock Test Series 📐

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Portal-success?logo=github)](https://vaibhavgeometer.github.io/)
[![MathJax](https://img.shields.io/badge/MathJax-3.x-orange.svg)](https://www.mathjax.org/)
[![Pure Web](https://img.shields.io/badge/Vanilla-HTML5%20%7C%20CSS3%20%7C%20ES6+-informational.svg)](https://developer.mozilla.org/)

> **Official academic and mock test portal by Vaibhav Geometer** — featuring the complete **IIT JAM Mathematics (MA) Topic-Wise Mock Test Series (2022–2026)** with 300 official PYQs, authentic Computer-Based Test (CBT) simulator, step-by-step LaTeX solutions, and downloadable PDF question bank.

---

## 🌟 Key Features

### 🎓 1. Topic-Wise Mock Test Series (300 Official PYQs)
- **Authentic Questions**: Sourced from official IIT JAM Mathematics (MA) examination papers from **2022 through 2026**.
- **Real Exam Pattern**: Covers all three question types:
  - **MCQ** (*Multiple Choice Questions*): 1 Mark ($+1, -1/3$) and 2 Marks ($+2, -2/3$).
  - **MSQ** (*Multiple Select Questions*): 2 Marks ($+2$, no negative marking, no partial credits).
  - **NAT** (*Numerical Answer Type*): 1 Mark ($+1$, no negative) and 2 Marks ($+2$, no negative).

### ⚡ 2. Authentic CBT Exam Simulator
- **Live Countdown Timer**: Sectional time management with visual urgency indicators.
- **Multi-Status Question Palette**:
  - 🟢 **Answered**: Saved responses ready for scoring.
  - 🔴 **Not Answered**: Visited questions left blank.
  - ⚪ **Not Visited**: Unseen questions.
  - 🟣 **Marked for Review**: Questions flagged to revisit.
  - 🟣🟢 **Answered & Marked for Review**: Evaluated during final submission.
- **Virtual Scientific Calculator**: Built-in floating calculator with algebraic operations, trigonometric functions, logarithm, exponentiation, root, and memory registers.
- **Question Paper View**: Full-page scrollable question paper view for rapid overview.
- **Instant Analytics & Scorecard**:
  - Real-time score computation with positive and negative marking breakdown.
  - Accuracy percentage, total time spent, and performance badges.
  - Interactive filterable review (Correct, Incorrect, Unattempted).
  - Complete step-by-step mathematical proofs and LaTeX explanations.

### 📄 3. Question Bank PDF & LaTeX Source
- **Official PDF**: Formatted, publication-ready topic-wise question bank with comprehensive answer keys ([View PDF](docs/Topic-Wise-Question-Bank-2022-2026.pdf)).
- **LaTeX Source**: Clean modular TeX source file ([View TeX Source](latex/question_bank_2022_2026.tex)).

---

## 📊 Syllabus Coverage & Modules Breakdown

The 300 PYQs are organized across 9 comprehensive syllabus modules:

| Module ID | Topic / Module Name | Questions | Total Marks | Duration | Subject Area |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1.1** | Sequences and Series of Real Numbers | 49 | 81 | 146 min | Real Analysis |
| **1.2** | Functions of One Real Variable | 53 | 91 | 164 min | Real Analysis |
| **2.1** | Functions of Two or Three Real Variables | 26 | 44 | 79 min | Multivariable Calculus & ODE |
| **2.2** | Integral Calculus | 26 | 42 | 76 min | Multivariable Calculus & ODE |
| **2.3** | Differential Equations | 44 | 71 | 128 min | Multivariable Calculus & ODE |
| **3.1** | Basic Algebra | 3 | 6 | 11 min | Linear Algebra & Algebra |
| **3.2** | Matrices and Systems of Linear Equations | 33 | 56 | 101 min | Linear Algebra & Algebra |
| **3.3** | Finite Dimensional Vector Spaces | 30 | 50 | 90 min | Linear Algebra & Algebra |
| **3.4** | Groups | 36 | 59 | 106 min | Linear Algebra & Algebra |
| **TOTAL** | **Full Question Bank (2022–2026)** | **300** | **500** | — | **All Core Areas** |

---

## 📂 Repository Architecture

```text
vaibhavgeometer.github.io/
├── .gitignore                                 # Git rules for Python, LaTeX, Node, OS, and IDE files
├── LICENSE                                    # MIT License
├── README.md                                  # Documentation & user guide
├── index.html                                 # Main landing page & topic selector portal
├── css/
│   └── style.css                              # Portal theme & glassmorphic layout styles
├── js/
│   └── main.js                                # Portal controller & dynamic topic loader
├── docs/
│   ├── Topic-Wise-Question-Bank-2022-2026.pdf # Master question bank PDF (52 pages, 300 PYQs)
│   ├── Syllabus.pdf                           # Official IIT JAM Mathematics syllabus document
│   ├── 2022-2026-PYQs-with-Keys.pdf           # Combined official examination papers & answer keys
│   ├── MA2005-2026_Original_PYQs.pdf          # 22-year comprehensive PYQ archive (2005–2026)
│   └── cheat-sheets/                          # 14 high-yield topic-wise formula & concept cheat sheets
│       ├── Sequence_of_Real_Numbers_Cheat_Sheet.pdf
│       ├── Series_of_Real_Numbers_Cheat_Sheet.pdf
│       ├── Series_Convergence_Tests_Cheat_Sheet.pdf
│       ├── Continuity_and_Differentiability_Cheat_Sheet.pdf
│       ├── Riemann_Integration_Cheat_Sheet.pdf
│       ├── Multivariable_and_Power_Series_Supplemental.pdf
│       ├── Functions_of_Several_Variables_Cheat_Sheet.pdf
│       ├── Integral_Calculus_Cheat_Sheet.pdf
│       ├── Differential_Equations_Cheat_Sheet.pdf
│       ├── Basic_Algebra_Cheat_Sheet.pdf
│       ├── Linear_Algebra_Master_Cheat_Sheet.pdf
│       ├── Linear_Algebra_Vector_Spaces_Cheat_Sheet.pdf
│       ├── Group_Theory_Summary.pdf
│       └── Group_Theory_Master_Cheat_Sheet.pdf
├── latex/
│   └── question_bank_2022_2026.tex            # Full LaTeX document source for 300 PYQs
├── mock-test/
│   ├── index.html                             # Redirect to root portal
│   ├── test.html                              # CBT mock test simulator application
│   ├── css/
│   │   └── app.css                            # Exam simulator master stylesheet
│   └── js/
│       ├── calculator.js                      # Virtual scientific calculator engine
│       ├── mathjax_config.js                  # MathJax 3 configuration & TeX macros
│       ├── questions_data.js                  # 300 PYQ database with options, keys & proofs
│       ├── results.js                         # Scorecard generator & sectional analytics
│       └── test_engine.js                     # Exam state machine, timer, and palette
├── resources/
│   └── PYQs_Screenshots/                      # 300 official question paper screenshots (2022–2026)
│       ├── 2022/                              # JAM_2022_Q1.png ... JAM_2022_Q60.png
│       ├── 2023/                              # JAM_2023_Q1.png ... JAM_2023_Q60.png
│       ├── 2024/                              # JAM_2024_Q1.png ... JAM_2024_Q60.png
│       ├── 2025/                              # JAM_2025_Q1.png ... JAM_2025_Q60.png
│       └── 2026/                              # JAM_2026_Q1.png ... JAM_2026_Q60.png
└── scripts/
    └── extract_pyqs_screenshots.py            # High-resolution question crop & extraction utility
```

---

## 🚀 Running Locally

This project requires **no build tools, bundlers, or dependencies**. It runs natively in any modern web browser.

### Option 1: Python 3
```bash
# From the repository root
python -m http.server 8000
```
Open `http://localhost:8000` in your browser.

### Option 2: Node.js / NPX
```bash
npx serve .
```

### Option 3: Direct Browser File
Simply double-click `index.html` to open it in Chrome, Edge, Firefox, or Safari.

---

## 🛠 Technology Stack

- **Frontend**: Pure HTML5, Vanilla CSS3 (Custom Dark/Light Theme System, Grid/Flexbox), Vanilla ES6+ JavaScript.
- **Math Rendering Engine**: [MathJax 3](https://www.mathjax.org/) (TeX to SVG converter).
- **Typesetting**: LaTeX (`article`, `tcolorbox`, `amsmath`, `geometry`).
- **Deployment**: [GitHub Pages](https://pages.github.com/).

---

## 📄 License & Attribution

- Released under the [MIT License](LICENSE).
- All questions, official answer keys, and syllabus categories are based on official IIT JAM Mathematics (MA) examination papers (2022–2026).