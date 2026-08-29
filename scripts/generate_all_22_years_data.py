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

ERAS = [
    {
        "id": "2022-2026",
        "start": 2022,
        "end": 2026,
        "label": "2022–2026",
        "era_name": "Recent CBT Era (2022–2026)",
        "tag_class": "tag-cbt",
        "default_pattern": "MCQ • MSQ • NAT"
    },
    {
        "id": "2015-2021",
        "start": 2015,
        "end": 2021,
        "label": "2015–2021",
        "era_name": "CBT Era (2015–2021)",
        "tag_class": "tag-cbt",
        "default_pattern": "MCQ • MSQ • NAT"
    },
    {
        "id": "2005-2014",
        "start": 2005,
        "end": 2014,
        "label": "2005–2014",
        "era_name": "Classic Era (2005–2014)",
        "tag_class": "tag-classic",
        "default_pattern": "Classic Paper Pattern"
    }
]

def clean_key(k):
    if not k:
        return ""
    k = str(k).strip()
    k = k.replace('–', 'to').replace('—', 'to').replace('TO', 'to').replace('To', 'to').replace('‐', '-')
    k = re.sub(r'\s+', ' ', k)
    return k

def generate_all_data():
    # 1. Load Year-wise Tests from existing questions_data.js
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

    # Load mock tests manifest if available to attach pre-compiled mock PDFs
    manifest_map = {}
    manifest_path = 'assets/Mock Tests_PDF/mock_tests_manifest.json'
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as mf:
            manifest_list = json.load(mf)
            for item in manifest_list:
                manifest_map[item['id']] = item['filename']

    # 3. Generate 27 Era-based Subtopic Mock Tests (3 Eras x 9 Subtopics)
    era_subtopic_tests = {}
    for era in ERAS:
        era_id = era["id"]
        for k, info in SUBTOPIC_MAP.items():
            test_id = f"{era_id}_{k}"
            matched_qs = []
            for item in sorted_cat:
                yr = item['year']
                qn = item['question_number']
                st_name = item['sub_topic']
                if era["start"] <= yr <= era["end"] and st_name.lower() == info['sub_topic_name'].lower():
                    base_q = q_lookup.get((yr, qn))
                    if base_q:
                        q_clone = dict(base_q)
                        q_clone['topic_id'] = k
                        q_clone['topic_name'] = info['name']
                        q_clone['era'] = era_id
                        matched_qs.append(q_clone)

            total_q = len(matched_qs)
            total_m = sum(q['marks'] for q in matched_qs)
            dur_mins = max(15, round(total_q * 3.0)) if total_q > 0 else 15

            pattern_text = f"{era['default_pattern']} ({era['label']} • {total_q} Qs)" if total_q > 0 else "0 Qs (Not in Era Syllabus)"

            test_obj = {
                "id": test_id,
                "file_id": f"{era_id.replace('-', '_')}_{info['file_id']}",
                "topic_id": k,
                "name": f"{info['name']} ({era['label']})",
                "category": info["category"],
                "era": era_id,
                "era_label": era["label"],
                "era_name": era["era_name"],
                "pattern": pattern_text,
                "cheat_sheet": info["cheat_sheet"],
                "total_questions": total_q,
                "total_marks": total_m,
                "duration_minutes": dur_mins,
                "questions": matched_qs
            }
            if test_id in manifest_map:
                test_obj["mock_pdf"] = f"assets/Mock Tests_PDF/{manifest_map[test_id]}"

            era_subtopic_tests[test_id] = test_obj
            print(f"Generated [{test_id}] {info['name']} ({era['label']}): {total_q} Qs, {total_m} Marks, {dur_mins} Mins")

    # 4. Generate 9 Comprehensive Full-Archive Subtopic Tests (2005-2026)
    comprehensive_topic_tests = {}
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

        comp_test_obj = {
            "id": k,
            "file_id": info["file_id"],
            "topic_id": k,
            "name": f"{info['name']} (2005–2026 Archive)",
            "category": info["category"],
            "era": "comprehensive",
            "era_label": "2005–2026",
            "era_name": "Full Archive (2005–2026)",
            "pattern": f"MCQ • MSQ • NAT (2005–2026 Archive • {total_q} Qs)",
            "cheat_sheet": info["cheat_sheet"],
            "total_questions": total_q,
            "total_marks": total_m,
            "duration_minutes": dur_mins,
            "questions": matched_qs
        }
        if k in manifest_map:
            comp_test_obj["mock_pdf"] = f"assets/Mock Tests_PDF/{manifest_map[k]}"

        comprehensive_topic_tests[k] = comp_test_obj
        print(f"Generated Comprehensive [{k}] {info['name']}: {total_q} Qs, {total_m} Marks, {dur_mins} Mins")

    # 5. Combine Master Dataset
    final_mock_data = {}
    # 22 Year Tests (2026 down to 2005)
    for yr in sorted([int(k) for k in all_year_tests.keys()], reverse=True):
        yr_str = str(yr)
        year_obj = dict(all_year_tests[yr_str])
        year_obj["paper_pdf"] = "assets/MA2005-2026_Original_PYQs.pdf"
        if yr_str in manifest_map:
            year_obj["mock_pdf"] = f"assets/Mock Tests_PDF/{manifest_map[yr_str]}"
        final_mock_data[yr_str] = year_obj

    # 27 Era-based Subtopic Tests (2022-2026, 2015-2021, 2005-2014)
    for era in ERAS:
        era_id = era["id"]
        for k in sorted(SUBTOPIC_MAP.keys()):
            test_id = f"{era_id}_{k}"
            final_mock_data[test_id] = era_subtopic_tests[test_id]

    # 9 Comprehensive Full-Archive Tests (1.1 down to 3.4)
    for k in sorted(comprehensive_topic_tests.keys()):
        final_mock_data[k] = comprehensive_topic_tests[k]

    # Write JS file with standardized LF line endings
    js_content = "// IIT JAM Mathematics (MA) Complete 22-Year (2005-2026) Official Mock Test Series\n"
    js_content += f"// Master Dataset with 885 Official Questions across 22 Year Papers, 27 Era-Based Subtopic Tests & 9 Full-Archive Topic Tests\n\n"
    js_content += "window.MOCK_TESTS_DATA = " + json.dumps(final_mock_data, indent=2, ensure_ascii=False) + ";\n"

    with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js_content)

    print(f"\nSUCCESS: Successfully generated {OUTPUT_FILE}!")
    print(f"- {len(all_year_tests)} Year Tests (2005-2026)")
    print(f"- {len(era_subtopic_tests)} Era-Based Subtopic Tests (3 Eras x 9 Subtopics = 27 Tests)")
    print(f"- {len(comprehensive_topic_tests)} Comprehensive Topic Tests (2005-2026 Archive)")
    print(f"- Total Test Suites Available: {len(final_mock_data)}")

if __name__ == '__main__':
    generate_all_data()
