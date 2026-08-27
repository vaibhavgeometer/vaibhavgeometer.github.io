# -*- coding: utf-8 -*-
"""
IIT JAM Mathematics (MA) — Custom 30 Random ODE Questions PDF Generator
Analyzes assets/iit_jam_pyqs_categorized.json, samples 30 random Ordinary Differential Equations (ODE) questions,
and compiles a publication-quality LaTeX-formatted mock test PDF saved in assets/Custom_PDFs/.
"""

import os
import re
import json
import random
import time
import argparse
import typst
import fitz

OUTPUT_DIR = os.path.abspath('assets/Custom_PDFs')
SCRATCH_DIR = os.path.abspath('scratch')
CATEGORIZED_JSON = 'assets/iit_jam_pyqs_categorized.json'
QUESTIONS_DATA_JS = 'mock-test/js/questions_data.js'

def clean_str(text):
    if text is None:
        return ""
    s = str(text)
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('#', '')
    s = s.replace('$', '')
    s = s.replace('`', '')
    return s.strip()

def clean_answer_key(k):
    if not k:
        return "N/A"
    k = str(k).strip()
    k = k.replace(';', ', ')
    k = re.sub(r'\s*,\s*', ', ', k)
    k = re.sub(r'\s*(?:to|TO|To|–|—)\s*', ' to ', k)
    k = re.sub(r'\s+', ' ', k)
    return k.strip()

def load_ode_questions():
    """Load and match all ODE questions from categorized JSON with rich metadata in questions_data.js"""
    with open(CATEGORIZED_JSON, 'r', encoding='utf-8') as f:
        categorized_qs = json.load(f)
    
    ode_categorized = [
        q for q in categorized_qs 
        if q.get('sub_topic', '').strip().lower() == 'differential equations'
    ]
    
    with open(QUESTIONS_DATA_JS, 'r', encoding='utf-8') as f:
        code = f.read()
    m = re.search(r'window\.MOCK_TESTS_DATA\s*=\s*({[\s\S]*});?\s*$', code)
    if not m:
        raise ValueError("Could not parse MOCK_TESTS_DATA from questions_data.js")
    master_data = json.loads(m.group(1))
    
    # Check if comprehensive topic 2.3 is present
    ode_archive = master_data.get('2.3', {}).get('questions', [])
    if ode_archive and len(ode_archive) >= len(ode_categorized):
        return ode_archive
        
    # Fallback to year-based lookup
    q_lookup = {}
    for yr_str in range(2005, 2027):
        yr_key = str(yr_str)
        if yr_key in master_data:
            for q in master_data[yr_key].get('questions', []):
                q_lookup[(int(yr_str), q.get('q_num'))] = q
                
    ode_questions = []
    for item in ode_categorized:
        yr = int(item['year'])
        qn = int(item['question_number'])
        base_q = q_lookup.get((yr, qn))
        if base_q:
            q_clone = dict(base_q)
            q_clone['topic'] = item.get('topic', 'Multivariable Calculus and Differential Equations')
            q_clone['sub_topic'] = item.get('sub_topic', 'Differential Equations')
            ode_questions.append(q_clone)
            
    return ode_questions

def sample_30_ode_questions(ode_pool, seed=42):
    """
    Sample 30 questions from the ODE pool.
    Structures a realistic IIT JAM paper:
    - Section A: MCQ (15 Questions: 5 of 1-mark, 10 of 2-mark)
    - Section B: MSQ (5 Questions: 2-mark)
    - Section C: NAT (10 Questions: 5 of 1-mark, 5 of 2-mark)
    """
    rng = random.Random(seed)
    
    mcq_1m = [q for q in ode_pool if q.get('type') == 'MCQ' and q.get('marks') == 1]
    mcq_2m = [q for q in ode_pool if q.get('type') == 'MCQ' and q.get('marks') != 1]
    msq_qs = [q for q in ode_pool if q.get('type') == 'MSQ']
    nat_1m = [q for q in ode_pool if q.get('type') == 'NAT' and q.get('marks') == 1]
    nat_2m = [q for q in ode_pool if q.get('type') == 'NAT' and q.get('marks') != 1]
    
    selected_mcq_1m = rng.sample(mcq_1m, min(5, len(mcq_1m)))
    selected_mcq_2m = rng.sample(mcq_2m, min(10, len(mcq_2m)))
    selected_msq = rng.sample(msq_qs, min(5, len(msq_qs)))
    selected_nat_1m = rng.sample(nat_1m, min(5, len(nat_1m)))
    selected_nat_2m = rng.sample(nat_2m, min(5, len(nat_2m)))
    
    selected = selected_mcq_1m + selected_mcq_2m + selected_msq + selected_nat_1m + selected_nat_2m
    
    # If fewer than 30 due to pool size in specific buckets, fill remaining randomly
    if len(selected) < 30:
        remaining_pool = [q for q in ode_pool if q not in selected]
        needed = 30 - len(selected)
        selected.extend(rng.sample(remaining_pool, min(needed, len(remaining_pool))))
    elif len(selected) > 30:
        selected = selected[:30]
        
    # Sort into standard Section order: MCQ (1M then 2M) -> MSQ (2M) -> NAT (1M then 2M)
    def sort_key(q):
        t = q.get('type', 'MCQ')
        m = q.get('marks', 1)
        type_priority = {'MCQ': 1, 'MSQ': 2, 'NAT': 3}.get(t, 4)
        return (type_priority, m, q.get('year', ''), q.get('q_num', 0))
        
    selected.sort(key=sort_key)
    return selected

def generate_typst_code(test_title, questions, duration=90):
    mcq_count = sum(1 for q in questions if q.get('type') == 'MCQ')
    msq_count = sum(1 for q in questions if q.get('type') == 'MSQ')
    nat_count = sum(1 for q in questions if q.get('type') == 'NAT')
    total_q = len(questions)
    actual_marks = sum(q.get('marks', 1) for q in questions)
    
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
      text(size: 8.5pt, fill: rgb("#1e293b"), weight: "bold")[IIT JAM Mathematics (MA) • Custom ODE Mock Test],
      text(size: 8.5pt, fill: rgb("#475569"), style: "italic")[{test_title}]
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
    #text(size: 16pt, weight: "bold", fill: rgb("#0f172a"))[{test_title}] #linebreak()
    #v(3pt)
    #text(size: 9.5pt, fill: rgb("#475569"), weight: "medium")[Topic 2.3: Ordinary Differential Equations (ODE) • 30 Selected PYQs]
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
      #text(size: 13pt, fill: rgb("#1d4ed8"), weight: "bold")[{actual_marks} M]
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
      #text(size: 8.5pt, fill: rgb("#334155"), weight: "bold")[MCQ • MSQ • NAT]
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
        lines.append(f"""    [ *Section A: MCQ* ], [{mcq_count}], [ +1 / +2 Marks ], [ -1/3 / -2/3 Marks ], [ 4 Options (1 Correct) ],\n""")
    if msq_count > 0:
        lines.append(f"""    [ *Section B: MSQ* ], [{msq_count}], [ +2 Marks ], [ Nil (0) ], [ 4 Options (1+ Correct) ],\n""")
    if nat_count > 0:
        lines.append(f"""    [ *Section C: NAT* ], [{nat_count}], [ +1 / +2 Marks ], [ Nil (0) ], [ Real Decimal Value ],\n""")

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
    [ *Authentic Examination PYQs:* This custom question paper comprises 30 verified official IIT JAM Mathematics (MA) questions on Ordinary Differential Equations. ],
    [ *Section A (Multiple Choice Questions - MCQ):* Each question has four options, with *only one* correct choice. Wrong answers carry negative penalty: 1/3 deduction for 1-mark questions, and 2/3 deduction for 2-mark questions. ],
    [ *Section B (Multiple Select Questions - MSQ):* Each question has four options, where *one or more than one* option(s) may be correct. Full marks are awarded only if all correct choices and zero incorrect choices are chosen. No partial or negative marking. ],
    [ *Section C (Numerical Answer Type - NAT):* Numerical answers are real numbers entered via keyboard. Full credit is awarded if the numerical answer falls within the official accepted interval. No negative marking. ],
    [ *Master Answer Key & Solutions:* Complete official answers, acceptance ranges, and evaluation rubrics are provided at the end of this document. ],
    [ *Online Interactive Simulator:* Practice full tests with virtual calculator, timers, and instant scoring analytics at #link("https://vaibhavgeometer.github.io")[*vaibhavgeometer.github.io*]. ]
  )
]

#v(8pt)

#align(center)[
  #text(size: 8.5pt, style: "italic", fill: rgb("#64748b"))[
    IIT JAM Mathematics Custom Practice Series • Curated by Vaibhav Geometer
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

    current_section = None
    for i, q in enumerate(questions):
        q_num = i + 1
        orig_q_num = q.get('q_num', q_num)
        q_year = clean_str(q.get('year', ''))
        q_type = clean_str(q.get('type', 'MCQ'))
        marks = q.get('marks', 1)
        neg = q.get('negative_marks', 0)
        img_path = q.get('image', '')
        q_id = clean_str(q.get('id', f"Q_{q_num}"))
        
        # Section header if changed
        sec_name = "SECTION A: MULTIPLE CHOICE QUESTIONS (MCQ)" if q_type == 'MCQ' else (
            "SECTION B: MULTIPLE SELECT QUESTIONS (MSQ)" if q_type == 'MSQ' else "SECTION C: NUMERICAL ANSWER TYPE (NAT)"
        )
        if sec_name != current_section:
            current_section = sec_name
            lines.append(f"""
#v(6pt)
#block(
  fill: rgb("#1e293b"),
  inset: (x: 10pt, y: 5pt),
  radius: 3pt,
  width: 100%
)[
  #text(fill: white, weight: "bold", size: 9pt)[{sec_name}]
]
#v(6pt)
""")

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
      #image("/{img_path}", width: 100%)
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
    #text(size: 9pt, fill: rgb("#94a3b8"))[{test_title} • All Official Answers & Acceptance Ranges]
  ]
]

#v(8pt)
""")

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
      columns: (0.9fr, 1.1fr, 1fr, 2.4fr),
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
            t_key = clean_answer_key(q_in_c.get('answer_key', 'N/A'))
            
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

def generate_pdf(seed=42, output_filename="IIT_JAM_ODE_30_Random_Questions_Mock_Test.pdf"):
    start_time = time.time()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    
    ode_pool = load_ode_questions()
    print(f"Loaded {len(ode_pool)} Ordinary Differential Equations (ODE) questions from master dataset.")
    
    sampled_qs = sample_30_ode_questions(ode_pool, seed=seed)
    print(f"Sampled {len(sampled_qs)} questions (Seed: {seed}).")
    
    test_title = "Ordinary Differential Equations (ODE) — 30 Selected Questions"
    typ_code = generate_typst_code(test_title, sampled_qs, duration=90)
    
    typ_path = os.path.join(SCRATCH_DIR, "temp_custom_ode.typ")
    out_pdf_path = os.path.join(OUTPUT_DIR, output_filename)
    
    try:
        with open(typ_path, 'w', encoding='utf-8') as f:
            f.write(typ_code)
            
        pdf_bytes = typst.compile(typ_path, root=os.path.abspath('.'))
        with open(out_pdf_path, 'wb') as f:
            f.write(pdf_bytes)
            
        doc = fitz.open(out_pdf_path)
        page_count = len(doc)
        doc.close()
        
        size_mb = len(pdf_bytes) / (1024 * 1024)
        elapsed = time.time() - start_time
        
        print(f"\n=======================================================")
        print(f"SUCCESS: Generated {output_filename}")
        print(f"Path: {out_pdf_path}")
        print(f"Questions: {len(sampled_qs)}")
        print(f"Pages: {page_count}")
        print(f"File Size: {size_mb:.2f} MB")
        print(f"Time Taken: {elapsed:.2f}s")
        print(f"=======================================================")
        
        # Write metadata JSON summary alongside
        meta_filename = os.path.splitext(output_filename)[0] + "_metadata.json"
        meta_path = os.path.join(OUTPUT_DIR, meta_filename)
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump({
                "title": test_title,
                "topic": "Ordinary Differential Equations",
                "topic_id": "2.3",
                "seed": seed,
                "total_questions": len(sampled_qs),
                "total_marks": sum(q.get('marks', 1) for q in sampled_qs),
                "duration_minutes": 90,
                "pages": page_count,
                "pdf_file": output_filename,
                "questions": [
                    {
                        "custom_q_num": idx + 1,
                        "id": q.get('id'),
                        "year": q.get('year'),
                        "orig_q_num": q.get('q_num'),
                        "type": q.get('type'),
                        "marks": q.get('marks'),
                        "negative_marks": q.get('negative_marks'),
                        "answer_key": clean_answer_key(q.get('answer_key')),
                        "image": q.get('image')
                    }
                    for idx, q in enumerate(sampled_qs)
                ]
            }, f, indent=2)
            
        return out_pdf_path
        
    finally:
        if os.path.exists(typ_path):
            os.remove(typ_path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generate 30 Random ODE Questions PDF")
    parser.add_argument('--seed', type=int, default=42, help="Random seed for question sampling")
    parser.add_argument('--output', type=str, default="IIT_JAM_ODE_30_Random_Questions_Mock_Test.pdf", help="Output PDF filename")
    args = parser.parse_args()
    
    generate_pdf(seed=args.seed, output_filename=args.output)
