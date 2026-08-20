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

### 📥 3. Question Bank PDF & LaTeX Source
- **Official PDF**: Formatted, publication-ready topic-wise question bank with comprehensive answer keys ([Download PDF](docs/Topic-Wise-Question-Bank-2022-2026.pdf)).
- **LaTeX Source**: Clean modular TeX source file ([View TeX Source](latex/question_bank_2022_2026.tex)).

---

## 📊 Syllabus Coverage & Modules Breakdown

The 300 PYQs are organized across 9 comprehensive syllabus modules:

| Module ID | Topic / Module Name | Questions | Total Marks | Duration | Subject Area |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1.1** | Sequences and Series of Real Numbers | 34 | 58 | 102 min | Real Analysis |
| **1.2** | Functions of One Real Variable | 54 | 90 | 162 min | Real Analysis |
| **2.1** | Functions of Two or Three Real Variables | 28 | 47 | 84 min | Multivariable Calculus |
| **2.2** | Integral Calculus | 28 | 46 | 84 min | Integral Calculus |
| **2.3** | Differential Equations | 37 | 62 | 111 min | Differential Equations |
| **3.1** | Matrices and Vector Spaces | 33 | 55 | 99 min | Linear Algebra |
| **3.2** | Linear Transformations and Invertibility | 25 | 42 | 75 min | Linear Algebra |
| **3.3** | Eigenvalues, Eigenvectors & Inner Product Spaces | 31 | 52 | 93 min | Linear Algebra |
| **3.4** | Groups and Finite Groups | 30 | 48 | 90 min | Abstract Algebra |
| **TOTAL** | **Full Question Bank (2022–2026)** | **300** | **500** | — | **All Core Areas** |

---

## 📂 Repository Architecture

```text
vaibhavgeometer.github.io/
├── .gitignore                                 # Git rules for LaTeX, OS, IDE, and build artifacts
├── LICENSE                                    # MIT License
├── README.md                                  # Documentation & user guide
├── index.html                                 # Main landing page & topic selector portal
├── css/
│   └── style.css                              # Portal theme & glassmorphic layout styles
├── js/
│   └── main.js                                # Portal controller & dynamic topic loader
├── docs/
│   └── Topic-Wise-Question-Bank-2022-2026.pdf # Master question bank PDF (printable)
├── latex/
│   └── question_bank_2022_2026.tex            # Full LaTeX document source for 300 PYQs
└── mock-test/
    ├── index.html                             # Redirect to root portal
    ├── test.html                              # CBT mock test simulator application
    ├── css/
    │   └── app.css                            # Exam simulator master stylesheet
    └── js/
        ├── calculator.js                      # Virtual scientific calculator engine
        ├── mathjax_config.js                  # MathJax 3 configuration & TeX macros
        ├── questions_data.js                  # 300 PYQ database with options, keys & proofs
        ├── results.js                         # Scorecard generator & sectional analytics
        └── test_engine.js                     # Exam state machine, timer, and palette
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