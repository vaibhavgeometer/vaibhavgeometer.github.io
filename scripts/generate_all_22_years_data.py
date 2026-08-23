import fitz
import os
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

KEY_DIR = 'assets/PYQs_Answer Keys'
SCREENSHOT_BASE = 'assets/PYQs_Screenshots'
OUTPUT_FILE = 'mock-test/js/questions_data.js'
CATEGORIZED_JSON = 'assets/iit_jam_pyqs_categorized.json'

SUBTOPIC_MAP = {
    "1.1": {
        "id": "1.1",
        "file_id": "1_1",
        "name": "Sequences and Series of Real Numbers",
        "category": "Real Analysis",
        "sub_topic_name": "Sequences and Series of Real Numbers",
        "cheat_sheet": "assets/cheat-sheets/Sequence_of_Real_Numbers_Cheat_Sheet.pdf"
    },
    "1.2": {
        "id": "1.2",
        "file_id": "1_2",
        "name": "Functions of One Real Variable",
        "category": "Real Analysis",
        "sub_topic_name": "Functions of One Real Variable",
        "cheat_sheet": "assets/cheat-sheets/Continuity_and_Differentiability_Cheat_Sheet.pdf"
    },
    "2.1": {
        "id": "2.1",
        "file_id": "2_1",
        "name": "Functions of Two or Three Real Variables",
        "category": "Multivariable Calculus and Differential Equations",
        "sub_topic_name": "Functions of Two or Three Real Variables",
        "cheat_sheet": "assets/cheat-sheets/Functions_of_Several_Variables_Cheat_Sheet.pdf"
    },
    "2.2": {
        "id": "2.2",
        "file_id": "2_2",
        "name": "Integral Calculus",
        "category": "Multivariable Calculus and Differential Equations",
        "sub_topic_name": "Integral Calculus",
        "cheat_sheet": "assets/cheat-sheets/Integral_Calculus_Cheat_Sheet.pdf"
    },
    "2.3": {
        "id": "2.3",
        "file_id": "2_3",
        "name": "Differential Equations",
        "category": "Multivariable Calculus and Differential Equations",
        "sub_topic_name": "Differential Equations",
        "cheat_sheet": "assets/cheat-sheets/Differential_Equations_Cheat_Sheet.pdf"
    },
    "3.1": {
        "id": "3.1",
        "file_id": "3_1",
        "name": "Basic Algebra",
        "category": "Linear Algebra and Algebra",
        "sub_topic_name": "Basic algebra",
        "cheat_sheet": "assets/cheat-sheets/Basic_Algebra_Cheat_Sheet.pdf"
    },
    "3.2": {
        "id": "3.2",
        "file_id": "3_2",
        "name": "Matrices and Systems of Linear Equations",
        "category": "Linear Algebra and Algebra",
        "sub_topic_name": "Matrices",
        "cheat_sheet": "assets/cheat-sheets/Linear_Algebra_Master_Cheat_Sheet.pdf"
    },
    "3.3": {
        "id": "3.3",
        "file_id": "3_3",
        "name": "Finite Dimensional Vector Spaces",
        "category": "Linear Algebra and Algebra",
        "sub_topic_name": "Finite Dimensional Vector Spaces",
        "cheat_sheet": "assets/cheat-sheets/Linear_Algebra_Vector_Spaces_Cheat_Sheet.pdf"
    },
    "3.4": {
        "id": "3.4",
        "file_id": "3_4",
        "name": "Groups",
        "category": "Linear Algebra and Algebra",
        "sub_topic_name": "Groups",
        "cheat_sheet": "assets/cheat-sheets/Group_Theory_Master_Cheat_Sheet.pdf"
    }
}

def clean_key(k):
    if not k:
        return ""
    k = str(k).strip()
    k = k.replace('–', 'to').replace('—', 'to').replace('TO', 'to').replace('To', 'to').replace('‐', '-')
    k = re.sub(r'\s+', ' ', k)
    return k

def generate_all_data():
    # 1. Load Year-wise Tests from questions_data.js or rebuild
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'window\.MOCK_TESTS_DATA\s*=\s*(\{.*\});', content, re.DOTALL)
    existing_data = json.loads(m.group(1))

    all_year_tests = {}
    for yr in range(2005, 2027):
        yr_str = str(yr)
        if yr_str in existing_data:
            all_year_tests[yr_str] = existing_data[yr_str]

    # Build question lookup by (year, q_num)
    q_lookup = {}
    for yr_str, test_obj in all_year_tests.items():
        yr_num = int(yr_str)
        for q in test_obj['questions']:
            q_lookup[(yr_num, q['q_num'])] = q

    # 2. Load Categorized Questions
    with open(CATEGORIZED_JSON, 'r', encoding='utf-8') as f:
        categorized_qs = json.load(f)

    # Sort categorized questions in reverse chronological order (2026 down to 2005)
    sorted_cat = sorted(categorized_qs, key=lambda x: (x['year'], x['question_number']), reverse=True)

    # Group into 9 Sub-Topic Tests
    topic_tests = {}
    for k, info in SUBTOPIC_MAP.items():
        matched_qs = []
        for item in sorted_cat:
            yr = item['year']
            qn = item['question_number']
            st_name = item['sub_topic']
            if st_name.lower() == info['sub_topic_name'].lower():
                base_q = q_lookup.get((yr, qn))
                if base_q:
                    q_clone = dict(base_q)
                    q_clone['topic_id'] = k
                    q_clone['topic_name'] = info['name']
                    matched_qs.append(q_clone)

        total_q = len(matched_qs)
        total_m = sum(q['marks'] for q in matched_qs)
        dur_mins = max(15, round(total_q * 3.0))

        topic_tests[k] = {
            "id": k,
            "file_id": info["file_id"],
            "name": info["name"],
            "category": info["category"],
            "era": "comprehensive",
            "pattern": f"MCQ • MSQ • NAT (2005–2026 Archive • {total_q} Qs)",
            "cheat_sheet": info["cheat_sheet"],
            "total_questions": total_q,
            "total_marks": total_m,
            "duration_minutes": dur_mins,
            "questions": matched_qs
        }
        print(f"Generated Topic Test [{k}] {info['name']}: {total_q} Questions, {total_m} Marks, {dur_mins} Mins")

    # 3. Combine Final Dataset
    final_mock_data = {}
    # Year Tests (2026 down to 2005)
    for yr in sorted([int(k) for k in all_year_tests.keys()], reverse=True):
        final_mock_data[str(yr)] = all_year_tests[str(yr)]

    # 9 Topic Tests (1.1 down to 3.4)
    for k in sorted(topic_tests.keys()):
        final_mock_data[k] = topic_tests[k]

    # Write JS file
    js_content = "// IIT JAM Mathematics (MA) Complete 22-Year (2005-2026) Official Mock Test Series\n"
    js_content += "// Master Dataset with 885 Official Questions across 22 Year Papers & 9 Full-Archive Topic Mock Tests (794 In-Syllabus PYQs)\n\n"
    js_content += "window.MOCK_TESTS_DATA = " + json.dumps(final_mock_data, indent=2, ensure_ascii=False) + ";\n"

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"\nSUCCESS: Generated {OUTPUT_FILE} with {len(all_year_tests)} Year Tests and {len(topic_tests)} Comprehensive Topic Tests!")

if __name__ == '__main__':
    generate_all_data()
