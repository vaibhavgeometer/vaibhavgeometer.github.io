# -*- coding: utf-8 -*-
"""
IIT JAM Mathematics (MA) — Complete Mock Test PDF Generator
Generates publication-quality LaTeX-formatted PDFs for all 56 mock tests existing on the website.
Each PDF includes:
1. LaTeX Typeset Cover / Summary Page (Stats cards, Test structure table, Examination instructions).
2. High-Resolution Question Screenshot Cards with Question #, Section, Type, Marks, and Penalties.
3. Official Master Answer Key Table & Evaluation Rubrics on the final page(s).
"""

import os
import re
import json
import time
import typst
import fitz

OUTPUT_DIR = os.path.abspath('assets/Mock Tests_PDF')
SCRATCH_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scratch'))

def load_all_tests():
    with open('mock-test/js/questions_data.js', 'r', encoding='utf-8') as f:
        code = f.read()
    m = re.search(r'window\.MOCK_TESTS_DATA\s*=\s*({[\s\S]*});?\s*$', code)
    if not m:
        raise ValueError("Could not find window.MOCK_TESTS_DATA in questions_data.js")
    return json.loads(m.group(1))

def clean_str(text):
    if text is None:
        return ""
    s = str(text)
    # Strip HTML tags
    s = re.sub(r'<[^>]+>', '', s)
    # Clean characters that trigger syntax in Typst
    s = s.replace('#', '')
    s = s.replace('$', '')
    s = s.replace('`', '')
    return s.strip()

def get_pdf_filename(test_id, test_data):
    if re.match(r'^\d{4}$', test_id):
        return f"IIT_JAM_{test_id}_Mock_Test.pdf"
    elif re.match(r'^(2022-2026|2015-2021|2005-2014)_', test_id):
        era, topic_id = test_id.split('_', 1)
        topic_name = test_data['name'].split('(')[0].strip()
        topic_clean = re.sub(r'[^a-zA-Z0-9]+', '_', topic_name).strip('_')
        return f"{era}_Topic_{topic_id}_{topic_clean}.pdf"
    elif re.match(r'^\d+\.\d+$', test_id):
        topic_name = test_data['name'].split('(')[0].strip()
        topic_clean = re.sub(r'[^a-zA-Z0-9]+', '_', topic_name).strip('_')
        return f"Archive_2005-2026_Topic_{test_id}_{topic_clean}.pdf"
    else:
        topic_clean = re.sub(r'[^a-zA-Z0-9]+', '_', test_data['name']).strip('_')
        return f"{topic_clean}.pdf"

def generate_typst_code(test_id, test_data):
    name = clean_str(test_data.get('name', f"IIT JAM Mock Test - {test_id}"))
    category = clean_str(test_data.get('category', 'Mathematics (MA)'))
    era = clean_str(test_data.get('era', 'CBT Era'))
    total_q = test_data.get('total_questions', len(test_data.get('questions', [])))
    total_marks = test_data.get('total_marks', 100)
    duration = test_data.get('duration_minutes', 180)
    pattern = clean_str(test_data.get('pattern', 'MCQ • MSQ • NAT'))
    questions = test_data.get('questions', [])
    
    # Question type counts
    mcq_count = sum(1 for q in questions if q.get('type') == 'MCQ')
    msq_count = sum(1 for q in questions if q.get('type') == 'MSQ')
    nat_count = sum(1 for q in questions if q.get('type') == 'NAT')
    
    lines = []
    
    # Page setup & Master styling
    lines.append(f"""
#set page(
  paper: "a4",
  margin: (x: 1.6cm, top: 2.2cm, bottom: 2.2cm),
  header: context if counter(page).get().first() > 1 [
    #grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      text(size: 8.5pt, fill: rgb("#1e293b"), weight: "bold")[IIT JAM Mathematics (MA) • Official Mock Test Series],
      text(size: 8.5pt, fill: rgb("#475569"), style: "italic")[{name}]
    )
    #v(2pt)
    #line(length: 100%, stroke: 0.6pt + rgb("#cbd5e1"))
  ] else [],
  footer: context [
    #line(length: 100%, stroke: 0.6pt + rgb("#cbd5e1"))
    #v(2pt)
    #grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      text(size: 8pt, fill: rgb("#64748b"))[IIT JAM MA CBT Portal • #link("https://vaibhavgeometer.github.io")[vaibhavgeometer.github.io]],
      text(size: 8pt, fill: rgb("#1e293b"), weight: "bold")[Page #counter(page).display() of #counter(page).final().first()]
    )
  ]
)
#set text(font: ("New Computer Modern", "DejaVu Serif", "Times New Roman"), size: 10pt, fill: rgb("#0f172a"))
#set par(justify: true, leading: 0.65em)
""")
    
    # COVER / SUMMARY PAGE
    lines.append(f"""
// -------------------------------------------------------------
// COVER / SUMMARY PAGE (LaTeX Formatted Overview)
// -------------------------------------------------------------

#align(center)[
  #block(
    fill: rgb("#f1f5f9"),
    inset: (x: 16pt, y: 12pt),
    radius: 6pt,
    stroke: 1pt + rgb("#cbd5e1"),
    width: 100%
  )[
    #text(size: 9pt, weight: "bold", tracking: 0.15em, fill: rgb("#1e3a8a"))[JOINT ADMISSION TEST FOR MASTERS • IIT JAM MATHEMATICS (MA)] #linebreak()
    #v(3pt)
    #text(size: 16pt, weight: "bold", fill: rgb("#0f172a"))[{name}] #linebreak()
    #v(3pt)
    #text(size: 9.5pt, fill: rgb("#475569"), weight: "medium")[Category: {category} • Official Mock Test Series]
  ]
]

#v(8pt)

// METADATA STATS GRID
#grid(
  columns: (1fr, 1fr, 1fr, 1fr),
  gutter: 8pt,
  block(width: 100%, fill: rgb("#f8fafc"), stroke: 0.8pt + rgb("#e2e8f0"), radius: 4pt, inset: 8pt)[
    #align(center)[
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[TOTAL QUESTIONS]
      #v(2pt)
      #text(size: 13pt, fill: rgb("#0f766e"), weight: "bold")[{total_q}]
    ]
  ],
  block(width: 100%, fill: rgb("#f8fafc"), stroke: 0.8pt + rgb("#e2e8f0"), radius: 4pt, inset: 8pt)[
    #align(center)[
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[TOTAL MARKS]
      #v(2pt)
      #text(size: 13pt, fill: rgb("#1d4ed8"), weight: "bold")[{total_marks} M]
    ]
  ],
  block(width: 100%, fill: rgb("#f8fafc"), stroke: 0.8pt + rgb("#e2e8f0"), radius: 4pt, inset: 8pt)[
    #align(center)[
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[TEST DURATION]
      #v(2pt)
      #text(size: 13pt, fill: rgb("#b45309"), weight: "bold")[{duration} Min]
    ]
  ],
  block(width: 100%, fill: rgb("#f8fafc"), stroke: 0.8pt + rgb("#e2e8f0"), radius: 4pt, inset: 8pt)[
    #align(center)[
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[PAPER PATTERN]
      #v(2pt)
      #text(size: 8.5pt, fill: rgb("#334155"), weight: "bold")[{pattern[:24]}]
    ]
  ]
)

#v(6pt)
""")

    # SECTION STRUCTURE TABLE
    lines.append("""
#block(
  width: 100%,
  stroke: 0.8pt + rgb("#cbd5e1"),
  radius: 4pt,
  inset: 0pt,
  clip: true
)[
  #table(
    columns: (1.5fr, 1fr, 1.2fr, 1.3fr, 1.5fr),
    fill: (col, row) => if row == 0 { rgb("#1e293b") } else if calc.even(row) { rgb("#f8fafc") } else { rgb("#ffffff") },
    stroke: 0.4pt + rgb("#e2e8f0"),
    inset: (x: 7pt, y: 5.5pt),
    align: (left + horizon, center + horizon, center + horizon, center + horizon, left + horizon),
    table.header(
      text(fill: white, weight: "bold", size: 8.5pt)[Section / Type],
      text(fill: white, weight: "bold", size: 8.5pt)[Questions],
      text(fill: white, weight: "bold", size: 8.5pt)[Marking Scheme],
      text(fill: white, weight: "bold", size: 8.5pt)[Negative Marking],
      text(fill: white, weight: "bold", size: 8.5pt)[Format / Details]
    ),
""")
    if mcq_count > 0:
        lines.append(f"""    [ *Multiple Choice (MCQ)* ], [{mcq_count}], [ +1 / +2 Marks ], [ -1/3 / -2/3 Marks ], [ 4 Options (1 Correct) ],\n""")
    if msq_count > 0:
        lines.append(f"""    [ *Multiple Select (MSQ)* ], [{msq_count}], [ +2 Marks ], [ Nil (0) ], [ 4 Options (1+ Correct) ],\n""")
    if nat_count > 0:
        lines.append(f"""    [ *Numerical Answer (NAT)* ], [{nat_count}], [ +1 / +2 Marks ], [ Nil (0) ], [ Real Decimal Value ],\n""")
    if mcq_count == 0 and msq_count == 0 and nat_count == 0:
        lines.append(f"""    [ *Classic Paper Pattern* ], [{total_q}], [ Subjective / Objective ], [ Per Question Scheme ], [ Original Exam Pattern ],\n""")

    lines.append("""  )
]

#v(8pt)

// INSTRUCTIONS & GUIDELINES
#block(
  fill: rgb("#fafafa"),
  stroke: 0.8pt + rgb("#e5e7eb"),
  inset: 10pt,
  radius: 4pt,
  width: 100%
)[
  #text(weight: "bold", size: 9.5pt, fill: rgb("#1e3a8a"))[IMPORTANT INSTRUCTIONS FOR CANDIDATES]
  #v(4pt)
  #enum(
    [ *Authentic Examination PYQs:* This mock paper contains verified official IIT JAM Mathematics questions and high-resolution problem statements. ],
    [ *Section A (MCQ):* Each question has four choices (A), (B), (C), (D), out of which *only one* is correct. Wrong answers carry negative penalty (1/3 of positive marks). ],
    [ *Section B (MSQ):* Each question has four choices (A), (B), (C), (D), out of which *one or more than one* choice(s) may be correct. Full marks are awarded only if all correct choices and zero incorrect choices are chosen. No partial marks and no negative marks. ],
    [ *Section C (NAT):* Numerical answers are real numbers entered via virtual keyboard. Full credit is awarded if the numerical answer falls within the official accepted interval. No negative marking. ],
    [ *Master Answer Key:* Complete official answers and acceptance bounds are provided at the end of this document. ],
    [ *Online Interactive Simulator:* Practice this test with virtual calculator, timers, and instant scoring analytics at #link("https://vaibhavgeometer.github.io")[*vaibhavgeometer.github.io*]. ]
  )
]

#v(8pt)

#align(center)[
  #text(size: 8.5pt, style: "italic", fill: rgb("#64748b"))[
    IIT JAM Mathematics Mock Test Series • Curated by Vaibhav Geometer
  ]
]
""")

    # QUESTIONS SECTION
    lines.append("""
// -------------------------------------------------------------
// QUESTIONS SECTION
// -------------------------------------------------------------
#pagebreak()
""")

    for i, q in enumerate(questions):
        q_num = i + 1
        orig_q_num = q.get('q_num', q_num)
        q_year = clean_str(q.get('year', ''))
        q_type = clean_str(q.get('type', 'MCQ'))
        marks = q.get('marks', 1)
        neg = q.get('negative_marks', 0)
        img_path = q.get('image', '')
        q_id = clean_str(q.get('id', f"Q_{q_num}"))
        
        # Color coding by type
        if q_type == 'MCQ':
            type_bg = 'rgb("#eff6ff")'
            type_stroke = 'rgb("#93c5fd")'
            type_text = 'rgb("#1e40af")'
        elif q_type == 'MSQ':
            type_bg = 'rgb("#f0fdf4")'
            type_stroke = 'rgb("#86efac")'
            type_text = 'rgb("#166534")'
        else: # NAT
            type_bg = 'rgb("#fffbeb")'
            type_stroke = 'rgb("#fde68a")'
            type_text = 'rgb("#92400e")'
            
        neg_str = f"-{neg}" if neg > 0 else "Nil (0)"
        
        lines.append(f"""
#block(
  width: 100%,
  stroke: 0.8pt + rgb("#e2e8f0"),
  radius: 4pt,
  inset: 0pt,
  clip: true,
  breakable: false
)[
  #rect(
    width: 100%,
    fill: rgb("#f8fafc"),
    stroke: (bottom: 0.8pt + rgb("#e2e8f0")),
    inset: (x: 10pt, y: 6pt)
  )[
    #grid(
      columns: (auto, 1fr, auto),
      gutter: 6pt,
      align: (left + horizon, left + horizon, right + horizon),
      [
        #box(fill: rgb("#1e293b"), radius: 3pt, inset: (x: 6pt, y: 3pt))[
          #text(fill: white, weight: "bold", size: 8.5pt)[Question {q_num}]
        ]
      ],
      [
        #text(size: 8pt, fill: rgb("#64748b"), weight: "medium")[
          ({q_year} • Q{orig_q_num} • ID: {q_id})
        ]
      ],
      [
        #box(fill: {type_bg}, stroke: 0.6pt + {type_stroke}, radius: 3pt, inset: (x: 5pt, y: 2.5pt))[
          #text(size: 8pt, fill: {type_text}, weight: "bold")[{q_type}]
        ]
        #h(4pt)
        #box(fill: rgb("#f1f5f9"), stroke: 0.6pt + rgb("#cbd5e1"), radius: 3pt, inset: (x: 5pt, y: 2.5pt))[
          #text(size: 8pt, fill: rgb("#334155"), weight: "bold")[+{marks} M]
        ]
        #h(4pt)
        #box(fill: rgb("#fef2f2"), stroke: 0.6pt + rgb("#fecaca"), radius: 3pt, inset: (x: 5pt, y: 2.5pt))[
          #text(size: 8pt, fill: rgb("#991b1b"), weight: "bold")[Neg: {neg_str}]
        ]
      ]
    )
  ]
  
  #pad(top: 6pt, bottom: 6pt, left: 8pt, right: 8pt)[
    #align(center)[
      #image("{img_path}", width: 100%)
    ]
  ]
]
#v(10pt)
""")

    # ANSWER KEY SECTION
    lines.append(f"""
// -------------------------------------------------------------
// MASTER ANSWER KEY & RUBRIC (LaTeX Typeset)
// -------------------------------------------------------------
#pagebreak()

#align(center)[
  #block(
    fill: rgb("#1e293b"),
    inset: (x: 16pt, y: 10pt),
    radius: 4pt,
    width: 100%
  )[
    #text(size: 13pt, weight: "bold", fill: white)[OFFICIAL MASTER ANSWER KEY & EVALUATION RUBRIC] #linebreak()
    #v(2pt)
    #text(size: 9pt, fill: rgb("#94a3b8"))[{name} • All Official Answers & Acceptance Ranges]
  ]
]

#v(8pt)
""")

    # Build 1-column, 2-column or 3-column table for answer keys
    num_cols = 3 if len(questions) >= 30 else (2 if len(questions) > 10 else 1)
    
    chunk_size = (len(questions) + num_cols - 1) // num_cols
    chunks = [questions[i*chunk_size : (i+1)*chunk_size] for i in range(num_cols)]
    
    lines.append("#grid(columns: (" + ", ".join(["1fr"] * num_cols) + "), gutter: 8pt,\n")
    
    for c_idx, chunk in enumerate(chunks):
        if not chunk:
            continue
        lines.append("""  block(
    stroke: 0.8pt + rgb("#cbd5e1"),
    radius: 4pt,
    clip: true,
    table(
      columns: (0.9fr, 1.1fr, 1fr, 2.2fr),
      fill: (col, row) => if row == 0 { rgb("#334155") } else if calc.even(row) { rgb("#f8fafc") } else { rgb("#ffffff") },
      stroke: 0.4pt + rgb("#e2e8f0"),
      inset: (x: 3.5pt, y: 4.5pt),
      align: (center + horizon, center + horizon, center + horizon, center + horizon),
      table.header(
        text(fill: white, weight: "bold", size: 7.5pt)[Q. No.],
        text(fill: white, weight: "bold", size: 7.5pt)[Type],
        text(fill: white, weight: "bold", size: 7.5pt)[Marks],
        text(fill: white, weight: "bold", size: 7.5pt)[Official Key]
      ),
""")
        for q_in_c in chunk:
            idx = questions.index(q_in_c) + 1
            t_type = clean_str(q_in_c.get('type', 'MCQ'))
            t_marks = f"+{q_in_c.get('marks', 1)}"
            t_key = clean_str(q_in_c.get('answer_key', 'N/A'))
            
            lines.append(f"      [ *{idx}* ], [{t_type}], [{t_marks}], [ #text(weight: \"bold\")[{t_key}] ],\n")
            
        lines.append("    )\n  ),\n")
        
    lines.append(")\n")
    
    lines.append("""
#v(10pt)

#block(
  fill: rgb("#f8fafc"),
  stroke: 0.8pt + rgb("#cbd5e1"),
  inset: 10pt,
  radius: 4pt,
  width: 100%
)[
  #text(weight: "bold", size: 9pt, fill: rgb("#0f172a"))[SCORING METHODOLOGY & EVALUATION GUIDELINES]
  #v(4pt)
  #list(
    [ *Multiple Choice Questions (MCQ):* Full marks for correct single choice. Negative marks deducted for each incorrect attempt (-1/3 for 1-mark questions, -2/3 for 2-mark questions). Unattempted questions award zero. ],
    [ *Multiple Select Questions (MSQ):* Full marks if and only if all correct choices are marked and no incorrect choice is selected. Zero marks for partial selection or any incorrect choice. No negative marking. ],
    [ *Numerical Answer Type (NAT):* Any numerical value falling strictly within the specified official range (e.g., [a, b]) receives full credit. No negative marking. ],
    [ *Marks to All (MTA):* Questions officially designated as MTA award full marks to all candidates regardless of attempt. ]
  )
]
""")
    
    return "".join(lines)

def generate_all_pdfs():
    start_time = time.time()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    
    data = load_all_tests()
    total_tests = len(data)
    
    print(f"Loaded master dataset: {total_tests} mock tests configured.")
    
    generated_count = 0
    skipped_count = 0
    results_summary = []
    
    for test_id, test_data in data.items():
        q_count = len(test_data.get('questions', []))
        if q_count == 0:
            print(f"[-] Skipping empty mock test: {test_id} ({test_data.get('name')})")
            skipped_count += 1
            continue
            
        filename = get_pdf_filename(test_id, test_data)
        out_pdf_path = os.path.join(OUTPUT_DIR, filename)
        typ_path = os.path.join(SCRATCH_DIR, f"temp_{re.sub(r'[^a-zA-Z0-9]+', '_', test_id)}.typ")
        
        t0 = time.time()
        try:
            typ_code = generate_typst_code(test_id, test_data)
            with open(typ_path, 'w', encoding='utf-8') as f:
                f.write(typ_code)
                
            pdf_bytes = typst.compile(typ_path, root=os.path.abspath('.'))
            with open(out_pdf_path, 'wb') as f:
                f.write(pdf_bytes)
                
            # Verify with PyMuPDF
            doc = fitz.open(out_pdf_path)
            page_count = len(doc)
            doc.close()
            
            elapsed = time.time() - t0
            size_mb = len(pdf_bytes) / (1024 * 1024)
            generated_count += 1
            
            print(f"[{generated_count:02d}/{total_tests - skipped_count}] Generated {filename} | {q_count} Qs | {page_count} Pages | {size_mb:.2f} MB in {elapsed:.2f}s")
            results_summary.append({
                'id': test_id,
                'name': test_data.get('name'),
                'filename': filename,
                'questions': q_count,
                'pages': page_count,
                'size_mb': round(size_mb, 2)
            })
        except Exception as e:
            print(f"[!] Error generating {test_id} ({filename}): {e}")
            raise e
        finally:
            if os.path.exists(typ_path):
                os.remove(typ_path)
                
    total_elapsed = time.time() - start_time
    print(f"\n=======================================================")
    print(f"Successfully generated all {generated_count} Mock Test PDFs!")
    print(f"Skipped {skipped_count} empty placeholder tests.")
    print(f"Total Time Taken: {total_elapsed:.2f}s")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"=======================================================")
    
    # Save a manifest JSON
    manifest_path = os.path.join(OUTPUT_DIR, 'mock_tests_manifest.json')
    with open(manifest_path, 'w', encoding='utf-8', newline='\\n') as f:
        json.dump(results_summary, f, indent=2)
    print(f"Saved manifest to {manifest_path}")

if __name__ == '__main__':
    generate_all_pdfs()
