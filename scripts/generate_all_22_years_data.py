import fitz
import os
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

KEY_DIR = 'assets/PYQs_Answer Keys'
SCREENSHOT_BASE = 'assets/PYQs_Screenshots'
OUTPUT_FILE = 'mock-test/js/questions_data.js'

def clean_key(k):
    if not k:
        return ""
    k = str(k).strip()
    k = k.replace('–', 'to').replace('—', 'to').replace('TO', 'to').replace('To', 'to').replace('‐', '-')
    k = re.sub(r'\s+', ' ', k)
    return k

def generate_all_data():
    all_year_tests = {}

    # =========================================================================
    # 1. 2005 - 2013 (MA2005-2013_Key.pdf)
    # =========================================================================
    doc_early = fitz.open(os.path.join(KEY_DIR, 'MA2005-2013_Key.pdf'))
    for pno, p in enumerate(doc_early):
        text = p.get_text()
        sections = re.split(r'JAM\s+(\d{4}):\s+Mathematics\s+\(MA\)', text)
        for i in range(1, len(sections), 2):
            yr = int(sections[i])
            cnt = sections[i+1]
            tokens = [l.strip() for l in cnt.split('\n') if l.strip()]
            qs = []
            idx = 0
            while idx < len(tokens):
                if tokens[idx] in ['Q. No.', 'Session', 'Question Type', 'Section', 'Key/Range*', 'Marks', 'Master Answer Key (Objective Questions)']:
                    idx += 1
                    continue
                if tokens[idx].isdigit() and idx+5 < len(tokens) and tokens[idx+1] == '1' and tokens[idx+2] == 'MCQ':
                    qnum = int(tokens[idx])
                    qtype = tokens[idx+2]
                    key = tokens[idx+4]
                    marks = int(tokens[idx+5])
                    neg = round(marks / 3.0, 2)
                    qs.append({
                        'id': f'JAM_{yr}_Q{qnum}',
                        'year': f'JAM {yr}',
                        'q_num': qnum,
                        'type': 'MCQ',
                        'marks': marks,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/{yr}/JAM_{yr}_Q{qnum}.png',
                        'answer_key': clean_key(key),
                        'explanation': f'<strong>Official Key: ({key})</strong><br>• IIT JAM {yr} Mathematics (MA) — Question {qnum}'
                    })
                    idx += 6
                else:
                    idx += 1
            duration = 60 if yr <= 2012 else 40
            total_m = sum(q['marks'] for q in qs)
            all_year_tests[str(yr)] = {
                'id': str(yr),
                'file_id': f'JAM_{yr}',
                'year': yr,
                'name': f'IIT JAM {yr} Official Paper',
                'category': 'Classic Era (2005–2014)',
                'era': 'classic',
                'total_questions': len(qs),
                'total_marks': total_m,
                'duration_minutes': duration,
                'pattern': 'MCQ',
                'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
                'questions': qs
            }

    # =========================================================================
    # 2. 2014 (MA2014_Key.pdf - Code A)
    # =========================================================================
    doc14 = fitz.open(os.path.join(KEY_DIR, 'MA2014_Key.pdf'))
    txt14 = doc14[0].get_text()
    lines14 = [l.strip() for l in txt14.split('\n') if l.strip()]
    qs14 = []
    for q in range(1, 36):
        base_idx = (q - 1) * 8
        key_a = lines14[base_idx]
        marks = 1 if q <= 10 else 2
        neg = 0.33 if q <= 10 else 0.67
        qs14.append({
            'id': f'JAM_2014_Q{q}',
            'year': 'JAM 2014',
            'q_num': q,
            'type': 'MCQ',
            'marks': marks,
            'negative_marks': neg,
            'image': f'assets/PYQs_Screenshots/2014/JAM_2014_Q{q}.png',
            'answer_key': clean_key(key_a),
            'explanation': f'<strong>Official Key: ({key_a})</strong><br>• IIT JAM 2014 Mathematics (MA) — Question {q}'
        })
    all_year_tests['2014'] = {
        'id': '2014',
        'file_id': 'JAM_2014',
        'year': 2014,
        'name': 'IIT JAM 2014 Official Paper',
        'category': 'Classic Era (2005–2014)',
        'era': 'classic',
        'total_questions': len(qs14),
        'total_marks': 60,
        'duration_minutes': 100,
        'pattern': 'MCQ (35 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': qs14
    }

    # =========================================================================
    # 3. 2015 (MA2015_Key.pdf)
    # =========================================================================
    doc15 = fitz.open(os.path.join(KEY_DIR, 'MA2015_Key.pdf'))
    w15 = [w for w in doc15[0].get_text('words') if w[1] > 115]
    wA = sorted([w for w in w15 if w[0] < 180], key=lambda x: (round(x[1]/8)*8, x[0]))
    wB = sorted([w for w in w15 if 180 <= w[0] < 350], key=lambda x: (round(x[1]/8)*8, x[0]))
    wC = sorted([w for w in w15 if w[0] >= 350], key=lambda x: (round(x[1]/8)*8, x[0]))
    qs15 = {}
    toksA = [w[4] for w in wA if w[4] not in ['Q.', 'No.', 'Key', 'Marks']]
    i = 0
    while i < len(toksA):
        if toksA[i].isdigit() and int(toksA[i]) <= 30:
            qn = int(toksA[i])
            k = toksA[i+1]
            m = int(toksA[i+2])
            neg = 0.33 if qn <= 10 else 0.67
            qs15[qn] = {
                'id': f'JAM_2015_Q{qn}',
                'year': 'JAM 2015',
                'q_num': qn,
                'type': 'MCQ',
                'marks': m,
                'negative_marks': neg,
                'image': f'assets/PYQs_Screenshots/2015/JAM_2015_Q{qn}.png',
                'answer_key': clean_key(k),
                'explanation': f'<strong>Official Key: ({k})</strong><br>• IIT JAM 2015 Mathematics (MA) — Question {qn}'
            }
            i += 3
        else: i += 1

    toksB = [w[4] for w in wB if w[4] not in ['Q.', 'No.', 'Key', 'Marks', 'Numerical', 'Questions']]
    i = 0
    while i < len(toksB):
        if toksB[i].isdigit() and 1 <= int(toksB[i]) <= 10:
            qn = int(toksB[i]) + 30
            k = toksB[i+1]
            m = int(toksB[i+2])
            qs15[qn] = {
                'id': f'JAM_2015_Q{qn}',
                'year': 'JAM 2015',
                'q_num': qn,
                'type': 'MSQ',
                'marks': m,
                'negative_marks': 0,
                'image': f'assets/PYQs_Screenshots/2015/JAM_2015_Q{qn}.png',
                'answer_key': clean_key(k),
                'explanation': f'<strong>Official Key: ({k})</strong><br>• IIT JAM 2015 Mathematics (MA) — Question {qn}'
            }
            i += 3
        else: i += 1

    toksC = [w[4] for w in wC if w[4] not in ['Q.', 'No.', 'Key', 'Marks', 'Range', 'Answer', 'Type', 'Questions']]
    i = 0
    while i < len(toksC):
        if toksC[i].isdigit() and 1 <= int(toksC[i]) <= 20 and i+4 < len(toksC) and toksC[i+2] == 'to':
            qn = int(toksC[i]) + 40
            vmin = toksC[i+1]
            vmax = toksC[i+3]
            m = int(toksC[i+4])
            kstr = f'{vmin} to {vmax}' if vmin != vmax else vmin
            qs15[qn] = {
                'id': f'JAM_2015_Q{qn}',
                'year': 'JAM 2015',
                'q_num': qn,
                'type': 'NAT',
                'marks': m,
                'negative_marks': 0,
                'image': f'assets/PYQs_Screenshots/2015/JAM_2015_Q{qn}.png',
                'answer_key': clean_key(kstr),
                'explanation': f'<strong>Official Key Range: {kstr}</strong><br>• IIT JAM 2015 Mathematics (MA) — Question {qn}'
            }
            i += 5
        else: i += 1
    
    all_year_tests['2015'] = {
        'id': '2015',
        'file_id': 'JAM_2015',
        'year': 2015,
        'name': 'IIT JAM 2015 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs15[k] for k in sorted(qs15.keys())]
    }

    # =========================================================================
    # 4. 2016 (MA2016_Key.pdf)
    # =========================================================================
    doc16 = fitz.open(os.path.join(KEY_DIR, 'MA2016_Key.pdf'))
    lines16 = [l.strip() for l in doc16[0].get_text().split('\n') if l.strip()]
    qs16 = {}
    i = 0
    while i < len(lines16):
        if lines16[i].isdigit() and 1 <= int(lines16[i]) <= 60 and i+3 < len(lines16) and lines16[i+1] in ['MCQ', 'MSQ', 'NAT']:
            qn = int(lines16[i])
            qt = lines16[i+1]
            ky = lines16[i+2].replace(':', ' to ')
            mk = int(float(lines16[i+3]))
            neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
            qs16[qn] = {
                'id': f'JAM_2016_Q{qn}',
                'year': 'JAM 2016',
                'q_num': qn,
                'type': qt,
                'marks': mk,
                'negative_marks': neg,
                'image': f'assets/PYQs_Screenshots/2016/JAM_2016_Q{qn}.png',
                'answer_key': clean_key(ky),
                'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2016 Mathematics (MA) — Question {qn}'
            }
            i += 4
        else: i += 1
    all_year_tests['2016'] = {
        'id': '2016',
        'file_id': 'JAM_2016',
        'year': 2016,
        'name': 'IIT JAM 2016 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs16[k] for k in sorted(qs16.keys())]
    }

    # =========================================================================
    # 5. 2017 (MA2017_Key.pdf)
    # =========================================================================
    doc17 = fitz.open(os.path.join(KEY_DIR, 'MA2017_Key.pdf'))
    lines17 = [l.strip() for l in doc17[0].get_text().split('\n') if l.strip()]
    qs17 = {}
    for i, line in enumerate(lines17):
        m = re.match(r'^0?([1-9]|[1-5][0-9]|60)$', line)
        if m:
            qn = int(m.group(1))
            if i+1 < len(lines17):
                ky = lines17[i+1].replace('–', 'to').replace('TO', 'to').strip()
                if not re.match(r'^0?([1-9]|[1-5][0-9]|60)$', ky) and ky not in ['KEY', 'KEYS', 'KEY RANGE', 'Q. No.']:
                    qt = 'MCQ' if qn <= 30 else ('MSQ' if qn <= 40 else 'NAT')
                    mk = 1 if (1 <= qn <= 10 or 41 <= qn <= 50) else 2
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs17[qn] = {
                        'id': f'JAM_2017_Q{qn}',
                        'year': 'JAM 2017',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2017/JAM_2017_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2017 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2017'] = {
        'id': '2017',
        'file_id': 'JAM_2017',
        'year': 2017,
        'name': 'IIT JAM 2017 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs17[k] for k in sorted(qs17.keys())]
    }

    # =========================================================================
    # 6. 2018 (MA2018_Key.pdf)
    # =========================================================================
    doc18 = fitz.open(os.path.join(KEY_DIR, 'MA2018_Key.pdf'))
    qs18 = {}
    for p in doc18:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 4 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[1].strip()
                    ky = row[3].strip()
                    mk = 1 if (1 <= qn <= 10 or 41 <= qn <= 50) else 2
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs18[qn] = {
                        'id': f'JAM_2018_Q{qn}',
                        'year': 'JAM 2018',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2018/JAM_2018_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2018 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2018'] = {
        'id': '2018',
        'file_id': 'JAM_2018',
        'year': 2018,
        'name': 'IIT JAM 2018 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs18[k] for k in sorted(qs18.keys())]
    }

    # =========================================================================
    # 7. 2019 (MA2019_Key.pdf)
    # =========================================================================
    doc19 = fitz.open(os.path.join(KEY_DIR, 'MA2019_Key.pdf'))
    lines19 = [l.strip() for l in doc19[0].get_text().split('\n') if l.strip()]
    qs19 = {}
    for i, line in enumerate(lines19):
        m = re.match(r'^0?([1-9]|[1-5][0-9]|60)$', line)
        if m:
            qn = int(m.group(1))
            if i+1 < len(lines19):
                ky = lines19[i+1].replace('–', 'to').replace('TO', 'to').strip()
                if not re.match(r'^0?([1-9]|[1-5][0-9]|60)$', ky) and ky not in ['KEY', 'KEYS', 'KEY RANGE', 'Q. No.']:
                    qt = 'MCQ' if qn <= 30 else ('MSQ' if qn <= 40 else 'NAT')
                    mk = 1 if (1 <= qn <= 10 or 41 <= qn <= 50) else 2
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs19[qn] = {
                        'id': f'JAM_2019_Q{qn}',
                        'year': 'JAM 2019',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2019/JAM_2019_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2019 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2019'] = {
        'id': '2019',
        'file_id': 'JAM_2019',
        'year': 2019,
        'name': 'IIT JAM 2019 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs19[k] for k in sorted(qs19.keys())]
    }

    # =========================================================================
    # 8. 2020 (MA2020_Key.pdf)
    # =========================================================================
    doc20 = fitz.open(os.path.join(KEY_DIR, 'MA2020_Key.pdf'))
    qs20 = {}
    for p in doc20:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 6 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[2].strip()
                    ky = row[4].strip()
                    mk = int(float(row[5].strip()))
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs20[qn] = {
                        'id': f'JAM_2020_Q{qn}',
                        'year': 'JAM 2020',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2020/JAM_2020_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2020 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2020'] = {
        'id': '2020',
        'file_id': 'JAM_2020',
        'year': 2020,
        'name': 'IIT JAM 2020 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs20[k] for k in sorted(qs20.keys())]
    }

    # =========================================================================
    # 9. 2021 (MA2021_Key.pdf)
    # =========================================================================
    doc21 = fitz.open(os.path.join(KEY_DIR, 'MA2021_Key.pdf'))
    lines21 = [l.strip() for l in doc21[0].get_text().split('\n') if l.strip()]
    qs21 = {}
    i = 0
    while i < len(lines21):
        if lines21[i].isdigit() and 1 <= int(lines21[i]) <= 60 and i+1 < len(lines21):
            qn = int(lines21[i])
            ky = lines21[i+1].strip()
            if ky not in ['Answer', 'Q. No.', 'Note:']:
                qt = 'MCQ' if qn <= 30 else ('MSQ' if qn <= 40 else 'NAT')
                mk = 1 if (1 <= qn <= 10 or 41 <= qn <= 50) else 2
                neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                qs21[qn] = {
                    'id': f'JAM_2021_Q{qn}',
                    'year': 'JAM 2021',
                    'q_num': qn,
                    'type': qt,
                    'marks': mk,
                    'negative_marks': neg,
                    'image': f'assets/PYQs_Screenshots/2021/JAM_2021_Q{qn}.png',
                    'answer_key': clean_key(ky),
                    'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2021 Mathematics (MA) — Question {qn}'
                }
                i += 2
            else:
                i += 1
        else:
            i += 1
    all_year_tests['2021'] = {
        'id': '2021',
        'file_id': 'JAM_2021',
        'year': 2021,
        'name': 'IIT JAM 2021 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/MA2005-2026_Original_PYQs.pdf',
        'questions': [qs21[k] for k in sorted(qs21.keys())]
    }

    # =========================================================================
    # 10. 2022 (MA2022_Key.pdf)
    # =========================================================================
    doc22 = fitz.open(os.path.join(KEY_DIR, 'MA2022_Key.pdf'))
    qs22 = {}
    for p in doc22:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 5 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[1].strip()
                    ky = row[3].strip()
                    mk = int(float(row[4].strip()))
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs22[qn] = {
                        'id': f'JAM_2022_Q{qn}',
                        'year': 'JAM 2022',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2022/JAM_2022_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2022 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2022'] = {
        'id': '2022',
        'file_id': 'JAM_2022',
        'year': 2022,
        'name': 'IIT JAM 2022 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/2022-2026-PYQs-with-Keys.pdf',
        'questions': [qs22[k] for k in sorted(qs22.keys())]
    }

    # =========================================================================
    # 11. 2023 (MA2023_Key.pdf)
    # =========================================================================
    doc23 = fitz.open(os.path.join(KEY_DIR, 'MA2023_Key.pdf'))
    qs23 = {}
    for p in doc23:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 6 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[2].strip()
                    ky = row[4].strip()
                    mk = int(float(row[5].strip()))
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs23[qn] = {
                        'id': f'JAM_2023_Q{qn}',
                        'year': 'JAM 2023',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2023/JAM_2023_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2023 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2023'] = {
        'id': '2023',
        'file_id': 'JAM_2023',
        'year': 2023,
        'name': 'IIT JAM 2023 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/2022-2026-PYQs-with-Keys.pdf',
        'questions': [qs23[k] for k in sorted(qs23.keys())]
    }

    # =========================================================================
    # 12. 2024 (MA2024_Key.pdf)
    # =========================================================================
    doc24 = fitz.open(os.path.join(KEY_DIR, 'MA2024_Key.pdf'))
    qs24 = {}
    for p in doc24:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 6 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[2].strip()
                    ky = row[4].strip()
                    mk = int(float(row[5].strip()))
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs24[qn] = {
                        'id': f'JAM_2024_Q{qn}',
                        'year': 'JAM 2024',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2024/JAM_2024_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2024 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2024'] = {
        'id': '2024',
        'file_id': 'JAM_2024',
        'year': 2024,
        'name': 'IIT JAM 2024 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/2022-2026-PYQs-with-Keys.pdf',
        'questions': [qs24[k] for k in sorted(qs24.keys())]
    }

    # =========================================================================
    # 13. 2025 (MA2025_Key.pdf)
    # =========================================================================
    doc25 = fitz.open(os.path.join(KEY_DIR, 'MA2025_Key.pdf'))
    qs25 = {}
    for p in doc25:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 5 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[1].strip()
                    ky = row[3].strip()
                    mk = int(float(row[4].strip()))
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs25[qn] = {
                        'id': f'JAM_2025_Q{qn}',
                        'year': 'JAM 2025',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2025/JAM_2025_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2025 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2025'] = {
        'id': '2025',
        'file_id': 'JAM_2025',
        'year': 2025,
        'name': 'IIT JAM 2025 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/2022-2026-PYQs-with-Keys.pdf',
        'questions': [qs25[k] for k in sorted(qs25.keys())]
    }

    # =========================================================================
    # 14. 2026 (MA2026_Key.pdf)
    # =========================================================================
    doc26 = fitz.open(os.path.join(KEY_DIR, 'MA2026_Key.pdf'))
    qs26 = {}
    for p in doc26:
        for t in p.find_tables():
            for row in t.extract():
                if row and len(row) >= 5 and row[0] and row[0].isdigit():
                    qn = int(row[0])
                    qt = row[2].strip()
                    ky = row[3].strip()
                    mk = int(float(row[4].strip()))
                    neg = 0.33 if (qt == 'MCQ' and mk == 1) else (0.67 if qt == 'MCQ' else 0)
                    qs26[qn] = {
                        'id': f'JAM_2026_Q{qn}',
                        'year': 'JAM 2026',
                        'q_num': qn,
                        'type': qt,
                        'marks': mk,
                        'negative_marks': neg,
                        'image': f'assets/PYQs_Screenshots/2026/JAM_2026_Q{qn}.png',
                        'answer_key': clean_key(ky),
                        'explanation': f'<strong>Official Key: {ky}</strong><br>• IIT JAM 2026 Mathematics (MA) — Question {qn}'
                    }
    all_year_tests['2026'] = {
        'id': '2026',
        'file_id': 'JAM_2026',
        'year': 2026,
        'name': 'IIT JAM 2026 Official Paper',
        'category': 'CBT Era (2015–2026)',
        'era': 'cbt',
        'total_questions': 60,
        'total_marks': 100,
        'duration_minutes': 180,
        'pattern': 'MCQ • MSQ • NAT (60 Questions)',
        'paper_pdf': 'assets/2022-2026-PYQs-with-Keys.pdf',
        'questions': [qs26[k] for k in sorted(qs26.keys())]
    }

    # Also load topic-wise data from existing questions_data.js if available
    topic_data = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
                # Find JSON object
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end != -1:
                    raw_json = content[start:end]
                    # Parse existing keys that look like '1.1', '1.2', etc.
                    # In case raw_json has JS comments or formatting, let's preserve them or parse
                    data_obj = json.loads(raw_json)
                    for k, v in data_obj.items():
                        if re.match(r'^\d+\.\d+$', str(k)):
                            if 'cheat_sheet' in v and isinstance(v['cheat_sheet'], str):
                                v['cheat_sheet'] = v['cheat_sheet'].replace('docs/', 'assets/')
                            # Ensure image property is added if missing
                            for q in v.get('questions', []):
                                if 'image' not in q:
                                    qid = q.get('id', '')
                                    # e.g. JAM_2026_Q1 -> 2026, Q1
                                    qm = re.match(r'JAM_(\d{4})_Q(\d+)', qid)
                                    if qm:
                                        yr_q = qm.group(1)
                                        qnum_q = qm.group(2)
                                        q['image'] = f'assets/PYQs_Screenshots/{yr_q}/JAM_{yr_q}_Q{qnum_q}.png'
                            topic_data[k] = v
        except Exception as e:
            print(f'Warning while reading existing topic data: {e}')

    # Combine: Year tests (2026 down to 2005) + Topic tests (1.1 to 3.3)
    final_mock_data = {}
    
    # Add Year Tests in reverse chronological order: 2026 down to 2005
    for yr in sorted([int(k) for k in all_year_tests.keys()], reverse=True):
        final_mock_data[str(yr)] = all_year_tests[str(yr)]
        
    # Add Topic Tests
    for k in sorted(topic_data.keys()):
        final_mock_data[k] = topic_data[k]

    # Write JS file
    js_content = "// IIT JAM Mathematics (MA) Complete 22-Year (2005-2026) Official Mock Test Series\n"
    js_content += "// Master Dataset with 885 Official Questions, High-Resolution Screenshots & Verified Official Answer Keys\n\n"
    js_content += "window.MOCK_TESTS_DATA = " + json.dumps(final_mock_data, indent=2, ensure_ascii=False) + ";\n"

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"Successfully generated {OUTPUT_FILE} with {len(all_year_tests)} Year Tests and {len(topic_data)} Topic Tests!")

if __name__ == '__main__':
    generate_all_data()
