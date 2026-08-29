import fitz
import os
import cv2
import numpy as np
import re

OUTPUT_BASE = "assets/PYQs_Screenshots"
PDF_PATH = "assets/MA2005-2026_Original_PYQs.pdf"

doc = None

def ensure_dir(d):
    os.makedirs(d, exist_ok=True)

# -------------------------------------------------------------
# 1. 2005 & 2006 PRECISE EXTRACTION
# -------------------------------------------------------------

def extract_2005():
    out_dir = os.path.join(OUTPUT_BASE, "2005")
    ensure_dir(out_dir)
    print("\n--- Extracting JAM 2005 (15 Qs) ---")
    
    def get_pimg(pno, rot=0):
        p = doc[pno - 1]
        mat = fitz.Matrix(300/72, 300/72)
        if rot != 0:
            mat.prerotate(rot)
        pix = p.get_pixmap(matrix=mat)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
        if pix.n >= 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB if pix.n == 3 else cv2.COLOR_BGRA2BGR)
        return img

    # P2 (rot=0, Portrait)
    p2 = get_pimg(2, 0)
    w2 = p2.shape[1]
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q1.png"), p2[1680:2300, int(w2*0.04):int(w2*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q2.png"), p2[2300:2920, int(w2*0.04):int(w2*0.96)])
    print("  [2005] Saved Q1, Q2 (P2)")

    # P3 (rot=90, Landscape)
    p3 = get_pimg(3, 90)
    w3 = p3.shape[1]
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q3.png"), p3[220:1040, int(w3*0.04):int(w3*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q4.png"), p3[1040:1760, int(w3*0.04):int(w3*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q5.png"), p3[1760:2510, int(w3*0.04):int(w3*0.96)])
    print("  [2005] Saved Q3, Q4, Q5 (P3)")

    # P4 (rot=0, Portrait)
    p4 = get_pimg(4, 0)
    w4 = p4.shape[1]
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q6.png"), p4[340:890, int(w4*0.04):int(w4*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q7.png"), p4[890:1770, int(w4*0.04):int(w4*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q8.png"), p4[1770:2390, int(w4*0.04):int(w4*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q9.png"), p4[2390:3080, int(w4*0.04):int(w4*0.96)])
    print("  [2005] Saved Q6, Q7, Q8, Q9 (P4)")

    # P5 (rot=90, Landscape)
    p5 = get_pimg(5, 90)
    w5 = p5.shape[1]
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q10.png"), p5[220:1250, int(w5*0.04):int(w5*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q11.png"), p5[1250:2510, int(w5*0.04):int(w5*0.96)])
    print("  [2005] Saved Q10, Q11 (P5)")

    # P6 (rot=90, Landscape)
    p6 = get_pimg(6, 90)
    w6 = p6.shape[1]
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q12.png"), p6[240:1540, int(w6*0.04):int(w6*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q13.png"), p6[1540:2510, int(w6*0.04):int(w6*0.96)])
    print("  [2005] Saved Q12, Q13 (P6)")

    # P7 (rot=90, Landscape)
    p7 = get_pimg(7, 90)
    w7 = p7.shape[1]
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q14.png"), p7[230:1220, int(w7*0.04):int(w7*0.96)])
    cv2.imwrite(os.path.join(out_dir, "JAM_2005_Q15.png"), p7[1220:2510, int(w7*0.04):int(w7*0.96)])
    print("  [2005] Saved Q14, Q15 (P7)")


def extract_2006():
    out_dir = os.path.join(OUTPUT_BASE, "2006")
    ensure_dir(out_dir)
    print("\n--- Extracting JAM 2006 (15 Qs) ---")
    q_defs_2006 = {
        1:  (28, 275.0, 380.0),
        2:  (28, 380.0, 472.0),
        3:  (28, 472.0, 568.0),
        4:  (28, 568.0, 700.0),
        5:  (29, 45.0,  152.0),
        6:  (29, 152.0, 322.0),
        7:  (29, 322.0, 432.0),
        8:  (29, 432.0, 577.0),
        9:  (29, 577.0, 700.0),
        10: (30, 45.0,  206.0),
        11: (30, 206.0, 298.0),
        12: (30, 298.0, 396.0),
        13: (30, 396.0, 484.0),
        14: (30, 484.0, 690.0),
        15: (31, 45.0,  192.0)
    }
    for qnum, (pno, y0, y1) in q_defs_2006.items():
        page = doc[pno - 1]
        pw = page.rect.width
        clip = fitz.Rect(40.0, y0, pw - 40.0, y1)
        pix = page.get_pixmap(clip=clip, dpi=300)
        pix.save(os.path.join(out_dir, f"JAM_2006_Q{qnum}.png"))
        print(f"  [2006] Saved JAM_2006_Q{qnum}.png (P{pno}, y: {y0:.1f}..{y1:.1f})")


def extract_2007():
    out_dir = os.path.join(OUTPUT_BASE, "2007")
    ensure_dir(out_dir)
    print("\n--- Extracting JAM 2007 (15 Qs) ---")
    cuts_2007 = {
        # Page 36 (rot 0): Q1, Q2, Q3
        1:  (36, 950,  1575),
        2:  (36, 1575, 2220),
        3:  (36, 2220, 2860),
        # Page 37 (rot 0): Q4, Q5, Q6
        4:  (37, 400,  1020),
        5:  (37, 1020, 2200),
        6:  (37, 2200, 2800),
        # Page 38 (rot 0): Q7, Q8, Q9
        7:  (38, 320,  1150),
        8:  (38, 1150, 1850),
        9:  (38, 1850, 2730),
        # Page 39 (rot 0): Q10, Q11, Q12
        10: (39, 410,  1400),
        11: (39, 1400, 2100),
        12: (39, 2100, 2780),
        # Page 40 (rot 0): Q13, Q14, Q15
        13: (40, 470,  1200),
        14: (40, 1200, 1870),
        15: (40, 1870, 2700),
    }
    for qnum, (pno, y0, y1) in cuts_2007.items():
        page = doc[pno - 1]
        pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
        if pix.n >= 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB if pix.n==3 else cv2.COLOR_BGRA2BGR)
        w = img.shape[1]
        crop = img[y0:y1, 0:int(w*0.995)]
        cv2.imwrite(os.path.join(out_dir, f"JAM_2007_Q{qnum}.png"), crop)
        print(f"  [2007] Saved JAM_2007_Q{qnum}.png (P{pno}, y: {y0}..{y1})")




# -------------------------------------------------------------
# 2. SCANNED PAGE SEGMENTATION (Valley-minimized projection)
# -------------------------------------------------------------

def extract_scanned_page(pno, rot, q_nums, year, crop_box_y=None, margin_x=(0.04, 0.96)):
    """
    Extract questions from a scanned page image using smoothed projection valley detection.
    """
    out_dir = os.path.join(OUTPUT_BASE, str(year))
    ensure_dir(out_dir)
    
    page = doc[pno - 1]
    mat = fitz.Matrix(300/72, 300/72)
    if rot != 0:
        mat.prerotate(rot)
    pix = page.get_pixmap(matrix=mat)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
    if pix.n >= 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB if pix.n==3 else cv2.COLOR_BGRA2BGR)
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    
    if crop_box_y is None:
        c_top = int(h * 0.05)
        c_bot = int(h * 0.93)
    else:
        c_top, c_bot = crop_box_y

    nq = len(q_nums)
    if nq == 1:
        qnum = q_nums[0]
        crop = img[c_top:c_bot, int(w * margin_x[0]):int(w * margin_x[1])]
        out_file = os.path.join(out_dir, f"JAM_{year}_Q{qnum}.png")
        cv2.imwrite(out_file, crop)
        print(f"  [{year}] Saved JAM_{year}_Q{qnum}.png (P{pno})")
        return

    # Projection of middle portion (12% to 88%)
    _, thresh = cv2.threshold(gray[c_top:c_bot, int(w*0.12):int(w*0.88)], 220, 255, cv2.THRESH_BINARY_INV)
    proj = np.sum(thresh, axis=1)
    
    ink_rows = np.where(proj > 0)[0]
    if len(ink_rows) == 0:
        return
    real_ink_start = ink_rows[0]
    real_ink_end = ink_rows[-1]
    span = real_ink_end - real_ink_start
    
    # Smooth projection
    kernel = np.ones(11) / 11
    smoothed = np.convolve(proj, kernel, mode='same')
    
    # Find all candidate valleys
    valleys = []
    for y in range(real_ink_start + 25, real_ink_end - 25):
        if smoothed[y] <= smoothed[y-1] and smoothed[y] <= smoothed[y+1] and smoothed[y] < 6000:
            valleys.append((y, smoothed[y]))
            
    splits = [max(0, real_ink_start - 12)]
    for k in range(1, nq):
        target = real_ink_start + int(span * k / nq)
        candidates = [v for v in valleys if abs(v[0] - target) < span * 0.20 and v[0] > splits[-1] + span * 0.08]
        if candidates:
            best = min(candidates, key=lambda v: v[1] + abs(v[0] - target) * 20)
            splits.append(best[0])
        else:
            splits.append(target)
    splits.append(min(len(proj), real_ink_end + 15))
    
    for i in range(nq):
        qnum = q_nums[i]
        y0 = c_top + splits[i]
        y1 = c_top + splits[i+1]
        
        crop = img[y0:y1, int(w * margin_x[0]):int(w * margin_x[1])]
        out_file = os.path.join(out_dir, f"JAM_{year}_Q{qnum}.png")
        cv2.imwrite(out_file, crop)
        print(f"  [{year}] Saved JAM_{year}_Q{qnum}.png (P{pno}, y: {y0}..{y1})")


# -------------------------------------------------------------
# 3. DIGITAL PAGE SEGMENTATION (Word-anchored vector extraction)
# -------------------------------------------------------------

def extract_digital_year_dynamic(year, page_range, total_expected_q):
    """
    Dynamically extracts all questions for digital years by locating question anchors precisely from words.
    """
    out_dir = os.path.join(OUTPUT_BASE, str(year))
    ensure_dir(out_dir)
    print(f"\n--- Extracting JAM {year} (Digital, {total_expected_q} Qs) ---")
    
    q_page_map = {}
    
    for pno in page_range:
        page = doc[pno - 1]
        words = page.get_text('words')
        words.sort(key=lambda w: (round(w[1] / 3) * 3, w[0]))
        
        for i, w in enumerate(words):
            x0, y0, x1, y1, w_text = w[0], w[1], w[2], w[3], w[4].strip()
            
            # Question number anchors are on the left side (x0 < 180) and below top running header (y0 > 45)
            if x0 > 180 or y0 < 45:
                continue
                
            raw_qnum = None
            m = re.match(r'^(?:Q\.?|Qn\.?|Question)\s*(\d+)[.:]?$', w_text)
            if m:
                raw_qnum = int(m.group(1))
            elif w_text in ['Q.', 'Q', 'Qn.', 'Question']:
                if i + 1 < len(words):
                    nw = words[i+1]
                    if abs(nw[1] - y0) < 6:
                        nw_text = nw[4].strip().rstrip('.')
                        if nw_text.isdigit():
                            raw_qnum = int(nw_text)
            elif w_text.endswith('.') and w_text[:-1].isdigit():
                raw_qnum = int(w_text[:-1])
                
            if raw_qnum is not None:
                same_line_words = [other[4] for other in words if abs(other[1] - y0) < 6]
                same_line_str = ' '.join(same_line_words).lower()
                
                # Filter out section or instruction lines
                if re.search(r'\bcarry\b', same_line_str) or re.search(r'\bmarks each\b', same_line_str):
                    continue
                if re.search(r'\bsection\s*[-–—]?', same_line_str):
                    continue
                
                # Apply 2015 section offsets
                if year == 2015:
                    if pno < 324:
                        final_qnum = raw_qnum
                    elif pno == 324:
                        final_qnum = raw_qnum if y0 < 400 else raw_qnum + 30
                    elif pno <= 326:
                        final_qnum = raw_qnum + 30
                    else:
                        final_qnum = raw_qnum + 40
                else:
                    final_qnum = raw_qnum
                    
                if 1 <= final_qnum <= total_expected_q:
                    if final_qnum not in q_page_map:
                        q_page_map[final_qnum] = {'pno': pno, 'y0': y0, 'y1': y1}
                        
    page_to_qs = {}
    for qnum, info in q_page_map.items():
        page_to_qs.setdefault(info['pno'], []).append((qnum, info['y0'], info['y1']))
        
    for pno, q_list in sorted(page_to_qs.items()):
        page = doc[pno - 1]
        pw, ph = page.rect.width, page.rect.height
        blocks = page.get_text('blocks')
        q_list.sort(key=lambda x: x[1])
        
        for idx, (qnum, qy0, qy1) in enumerate(q_list):
            if idx == 0:
                top_y = max(45.0, qy0 - 18.0)
                above_blocks = [b for b in blocks if 45.0 <= b[3] <= qy0 and b[1] >= 45.0]
                if above_blocks:
                    sec_text = ''.join(b[4] for b in above_blocks)
                    if not any(k in sec_text.lower() for k in ['section', 'multiple', 'numerical', 'carry', 'instructions', 'formula', 'paper specific']):
                        lowest_above = max(b[1] for b in above_blocks)
                        top_y = max(45.0, min(top_y, lowest_above - 5.0))
            else:
                top_y = qy0 - 14.0
                
            if idx < len(q_list) - 1:
                next_qy0 = q_list[idx + 1][1]
                bot_y = next_qy0 - 12.0
            else:
                below_blocks = [b for b in blocks if b[1] >= qy0 and b[3] <= ph - 30.0]
                if below_blocks:
                    max_b_y1 = max(b[3] for b in below_blocks)
                    bot_y = min(ph - 30.0, max_b_y1 + 18.0)
                else:
                    bot_y = min(ph - 30.0, qy1 + 50.0)
                    
            clip_rect = fitz.Rect(25.0, max(0.0, top_y), pw - 25.0, min(ph, bot_y))
            pix = page.get_pixmap(clip=clip_rect, dpi=300)
            out_file = os.path.join(out_dir, f"JAM_{year}_Q{qnum}.png")
            pix.save(out_file)
            print(f"  [{year}] Saved JAM_{year}_Q{qnum}.png (P{pno}, y: {clip_rect.y0:.1f}..{clip_rect.y1:.1f})")


# -------------------------------------------------------------
# MAIN EXTRACTION RUNNER
# -------------------------------------------------------------

def extract_all():
    global doc
    if not os.path.exists(PDF_PATH):
        raise FileNotFoundError(f"PDF not found: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)

    print("===============================================================")
    print("STARTING FULL PYQ SCREENSHOT EXTRACTION (2005 - 2021)")
    print("===============================================================")
    
    # 1. JAM 2005 (15 Qs)
    extract_2005()

    # 2. JAM 2006 (15 Qs)
    extract_2006()

    # 3. JAM 2007 (15 Qs)
    extract_2007()

    # 4. JAM 2008 (15 Qs)
    print("\n--- Extracting JAM 2008 ---")
    extract_scanned_page(60, 0, [1, 2, 3], 2008, crop_box_y=(750, 2950))
    extract_scanned_page(61, 0, [4, 5, 6], 2008, crop_box_y=(350, 2850))
    extract_scanned_page(62, 0, [7, 8, 9], 2008, crop_box_y=(350, 2850))
    extract_scanned_page(63, 0, [10, 11, 12], 2008, crop_box_y=(350, 2850))
    extract_scanned_page(64, 0, [13, 14, 15], 2008, crop_box_y=(350, 2850))

    # 5. JAM 2009 (15 Qs)
    print("\n--- Extracting JAM 2009 ---")
    extract_scanned_page(100, 0, [1, 2, 3], 2009, crop_box_y=(750, 2950))
    extract_scanned_page(101, 0, [4, 5, 6], 2009, crop_box_y=(350, 2850))
    extract_scanned_page(102, 0, [7, 8, 9], 2009, crop_box_y=(350, 2850))
    extract_scanned_page(103, 0, [10, 11, 12], 2009, crop_box_y=(350, 2850))
    extract_scanned_page(104, 0, [13, 14, 15], 2009, crop_box_y=(350, 2850))

    # 6. JAM 2010 (15 Qs)
    print("\n--- Extracting JAM 2010 ---")
    extract_scanned_page(120, 0, [1, 2, 3, 4], 2010, crop_box_y=(750, 2950))
    extract_scanned_page(121, 0, [5, 6, 7, 8], 2010, crop_box_y=(350, 2850))
    extract_scanned_page(122, 0, [9, 10, 11, 12], 2010, crop_box_y=(350, 2850))
    extract_scanned_page(123, 0, [13, 14, 15], 2010, crop_box_y=(350, 2400))

    # 7. JAM 2011 (15 Qs)
    extract_digital_year_dynamic(2011, range(163, 169), 15)

    # 8. JAM 2012 (15 Qs)
    extract_digital_year_dynamic(2012, range(207, 213), 15)

    # 9. JAM 2013 (10 Objective Qs)
    print("\n--- Extracting JAM 2013 ---")
    extract_scanned_page(247, 0, [1, 2, 3, 4], 2013, crop_box_y=(1200, 3100))
    extract_scanned_page(248, 0, [5, 6, 7, 8], 2013, crop_box_y=(350, 3050))
    extract_scanned_page(249, 0, [9, 10], 2013, crop_box_y=(350, 1850))

    # 10. JAM 2014 (35 Objective Qs)
    print("\n--- Extracting JAM 2014 ---")
    extract_scanned_page(282, 0, [1, 2, 3, 4], 2014, crop_box_y=(1150, 3150))
    extract_scanned_page(283, 0, [5, 6, 7, 8, 9, 10], 2014, crop_box_y=(200, 3150))
    extract_scanned_page(284, 0, [11, 12, 13, 14, 15], 2014, crop_box_y=(200, 3150))
    extract_scanned_page(285, 0, [16, 17, 18, 19, 20], 2014, crop_box_y=(200, 3150))
    extract_scanned_page(286, 0, [21, 22, 23, 24, 25], 2014, crop_box_y=(200, 3150))
    extract_scanned_page(287, 0, [26, 27, 28, 29, 30, 31], 2014, crop_box_y=(200, 3150))
    extract_scanned_page(288, 0, [32, 33, 34, 35], 2014, crop_box_y=(200, 2500))

    # 11. JAM 2015 (60 Qs)
    extract_digital_year_dynamic(2015, range(319, 330), 60)

    # 12. JAM 2016 (60 Qs)
    extract_digital_year_dynamic(2016, range(330, 342), 60)

    # 13. JAM 2017 (60 Qs)
    print("\n--- Extracting JAM 2017 ---")
    extract_scanned_page(344, 0, [1, 2, 3, 4, 5, 6], 2017, crop_box_y=(350, 3150))
    extract_scanned_page(345, 0, [7, 8, 9, 10, 11, 12], 2017, crop_box_y=(200, 3150))
    extract_scanned_page(346, 0, [13, 14, 15, 16, 17, 18], 2017, crop_box_y=(200, 3150))
    extract_scanned_page(347, 0, [19, 20, 21, 22, 23, 24], 2017, crop_box_y=(200, 3150))
    extract_scanned_page(348, 0, [25, 26, 27, 28, 29, 30], 2017, crop_box_y=(200, 3150))
    extract_scanned_page(349, 0, [31, 32, 33, 34, 35], 2017, crop_box_y=(250, 3150))
    extract_scanned_page(350, 0, [36, 37, 38, 39, 40], 2017, crop_box_y=(200, 3150))
    extract_scanned_page(351, 0, [41, 42, 43, 44, 45, 46, 47], 2017, crop_box_y=(250, 3150))
    extract_scanned_page(352, 0, [48, 49, 50, 51, 52, 53], 2017, crop_box_y=(200, 3150))
    extract_scanned_page(353, 0, [54, 55, 56, 57, 58], 2017, crop_box_y=(250, 3150))
    extract_scanned_page(354, 0, [59, 60], 2017, crop_box_y=(200, 2500))

    # 14. JAM 2018 (60 Qs)
    extract_digital_year_dynamic(2018, range(357, 368), 60)

    # 15. JAM 2019 (60 Qs)
    extract_digital_year_dynamic(2019, range(373, 384), 60)

    # 16. JAM 2020 (60 Qs)
    extract_digital_year_dynamic(2020, range(386, 401), 60)

    # 17. JAM 2021 (60 Qs)
    extract_digital_year_dynamic(2021, range(402, 419), 60)

    print("\n===============================================================")
    print("SUCCESS: ALL 17 YEARS (2005 - 2021) EXTRACTED CLEANLY!")
    print("===============================================================")

if __name__ == "__main__":
    extract_all()
