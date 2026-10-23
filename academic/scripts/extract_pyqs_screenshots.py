"""
Extract 300 High-Resolution Question Screenshots (JAM 2022–2026)
Source: assets/MA2005-2026_Original_PYQs.pdf
Destination: assets/PYQs_Screenshots/{year}/JAM_{year}_Q{num}.png
"""

import os
import re
import fitz

def get_h_lines(page):
    """Extract horizontal grid lines from vector drawings on a page."""
    h_lines = []
    for d in page.get_drawings():
        for item in d['items']:
            if item[0] == 'l':
                p1, p2 = item[1], item[2]
                if abs(p1.y - p2.y) < 1.0 and abs(p1.x - p2.x) > 100:
                    h_lines.append(p1.y)
            elif item[0] == 're':
                r = item[1]
                if r.height < 3 and r.width > 100:
                    h_lines.append(r.y0)
    return sorted(list(set([round(y, 1) for y in h_lines])))

def is_header_or_footer(b, ph, year='2022'):
    """Determine if a text block belongs to the page header or footer bands."""
    text = b[4].strip()
    if not text:
        return True
    y0, y1 = b[1], b[3]
    if year == '2023':
        if y1 < 100:
            if any(h in text for h in ['SECTION', 'carry', 'Carry', 'MULTIPLE CHOICE', 'MULTIPLE SELECT', 'NUMERICAL ANSWER', 'Question Paper', 'JAM 2023']):
                return True
        if y0 > ph - 45:
            if any(f in text for f in ['Page', 'MA', '/24', '38', '39', '40']):
                return True
        return False
    else:
        if y0 < 72 and ('JAM' in text or 'Question Paper' in text or 'MATHEMATICS' in text or 'Mathematics' in text or 'Confidential' in text):
            return True
        if y1 > ph - 65 and ('Page' in text or 'MA' in text or '/42' in text or '/43' in text or '/49' in text or '38' in text):
            return True
        return False

def extract_questions_for_page(page, year, pno):
    """Detect all questions on a given page and compute their precise bounding crop boxes."""
    ph = page.rect.height
    pw = page.rect.width
    blocks = page.get_text('blocks')
    
    if year == '2023':
        # Freeform text layouts with multiple questions per page (JAM 2023)
        q_markers = []
        for b in sorted(blocks, key=lambda x: (x[1], x[0])):
            text = b[4].strip()
            for line in text.split('\n'):
                line_str = line.strip()
                m = re.match(r'^Q\.?\s*(\d+)\b', line_str)
                if m:
                    qnum = int(m.group(1))
                    if 1 <= qnum <= 60:
                        if 'carry' in line_str.lower() or 'section' in line_str.lower():
                            continue
                        if not any(item['qnum'] == qnum for item in q_markers):
                            q_markers.append({'qnum': qnum, 'block': b, 'y0': b[1], 'y1': b[3]})
                            break
                            
        q_markers.sort(key=lambda x: x['y0'])
        content_blocks = [b for b in blocks if not is_header_or_footer(b, ph, year='2023')]
        
        q_blocks_map = {q['qnum']: [] for q in q_markers}
        for b in content_blocks:
            by0 = b[1]
            assigned = None
            for i in range(len(q_markers) - 1, -1, -1):
                if by0 >= q_markers[i]['y0'] - 18:
                    assigned = q_markers[i]['qnum']
                    break
            if assigned is None:
                assigned = q_markers[0]['qnum']
            q_blocks_map[assigned].append(b)
            
        results = []
        for i, q in enumerate(q_markers):
            qnum = q['qnum']
            q_blist = q_blocks_map[qnum]
            if not q_blist:
                q_blist = [q['block']]
                
            q_min_y = min(b[1] for b in q_blist)
            q_max_y = max(b[3] for b in q_blist)
            
            if i == 0:
                sec_blocks = [b for b in blocks if is_header_or_footer(b, ph, year='2023') and b[3] <= q_min_y]
                if sec_blocks:
                    sec_bot = max(b[3] for b in sec_blocks)
                    top_y = (sec_bot + q_min_y) / 2.0
                else:
                    top_y = max(8.0, q_min_y - 8.0)
            else:
                prev_qnum = q_markers[i-1]['qnum']
                prev_blist = q_blocks_map[prev_qnum]
                prev_max_y = max(b[3] for b in prev_blist) if prev_blist else q_markers[i-1]['y1']
                top_y = (prev_max_y + q_min_y) / 2.0
                
            if i + 1 < len(q_markers):
                next_qnum = q_markers[i+1]['qnum']
                next_blist = q_blocks_map[next_qnum]
                next_min_y = min(b[1] for b in next_blist) if next_blist else q_markers[i+1]['y0']
                bot_y = (q_max_y + next_min_y) / 2.0
            else:
                bot_y = min(ph - 20.0, q_max_y + 12.0)
                
            x0 = 45.0
            x1 = pw - 45.0
            rect = fitz.Rect(x0, top_y, x1, bot_y)
            results.append((qnum, rect))
            
        return results

    # For other years
    q_items = []
    for b in blocks:
        text = b[4]
        if is_header_or_footer(b, ph, year=year):
            continue
        
        for line in text.split('\n'):
            line_str = line.strip()
            m = re.match(r'^Q\.?\s*(\d+)\b', line_str)
            if m:
                qnum = int(m.group(1))
                if 1 <= qnum <= 60:
                    if 'carry' in line_str or 'Carry' in line_str or 'Section' in line_str or 'belong' in line_str:
                        continue
                    if not any(item['qnum'] == qnum for item in q_items):
                        q_items.append({'qnum': qnum, 'y0': b[1], 'y1': b[3], 'block': b})
    
    q_items.sort(key=lambda x: x['y0'])
    results = []
    content_blocks = [b for b in blocks if not is_header_or_footer(b, ph, year=year)]
    
    if year in ['2022', '2026']:
        # Table / Grid boxed layouts
        h_lines = get_h_lines(page)
        x0 = 53.5 if year == '2022' else 74.0
        x1 = 541.5 if year == '2022' else 522.0
        
        for i, q in enumerate(q_items):
            qnum = q['qnum']
            qy0 = q['y0']
            top_candidates = [y for y in h_lines if y <= qy0 + 2.5]
            top_y = top_candidates[-1] if top_candidates else qy0 - 5
            
            if i + 1 < len(q_items):
                next_qy0 = q_items[i+1]['y0']
                next_top_candidates = [y for y in h_lines if y <= next_qy0 + 2.5]
                next_top = next_top_candidates[-1] if next_top_candidates else next_qy0
                
                q_blocks = [b for b in content_blocks if top_y <= b[1] < next_top]
                max_by1 = max([b[3] for b in q_blocks]) if q_blocks else top_y + 50
                cand = [y for y in h_lines if top_y < y <= next_top and y >= max_by1 - 2.5]
                bot_y = cand[0] if cand else next_top - 5
            else:
                q_blocks = [b for b in content_blocks if top_y <= b[1] < ph - 60]
                max_by1 = max([b[3] for b in q_blocks]) if q_blocks else top_y + 50
                cand = [y for y in h_lines if y >= max_by1 - 2.5 and y < ph - 60]
                bot_y = cand[0] if cand else max_by1 + 10
            
            rect = fitz.Rect(x0, top_y - 0.5, x1, bot_y + 0.5)
            results.append((qnum, rect))
    else:
        # Freeform text layouts (2024, 2025)
        for i, q in enumerate(q_items):
            qnum = q['qnum']
            qy0 = q['y0']
            if i == 0:
                top_y = max(45, qy0 - 12)
            else:
                prev_bot = results[i-1][1].y1
                top_y = (prev_bot + qy0) / 2.0
            
            if i + 1 < len(q_items):
                next_qy0 = q_items[i+1]['y0']
                q_blocks = [b for b in content_blocks if qy0 <= b[1] < next_qy0]
                max_by1 = max([b[3] for b in q_blocks]) if q_blocks else qy0 + 50
                bot_y = min((max_by1 + next_qy0) / 2.0, next_qy0 - 5)
            else:
                q_blocks = [b for b in content_blocks if qy0 <= b[1] < ph - 60]
                max_by1 = max([b[3] for b in q_blocks]) if q_blocks else qy0 + 50
                bot_y = min(ph - 50, max_by1 + 15)
            
            x0 = 40.0
            x1 = pw - 40.0
            rect = fitz.Rect(x0, top_y, x1, bot_y)
            results.append((qnum, rect))
            
    return results

def main():
    pdf_path = os.path.join('assets', 'MA2005-2026_Original_PYQs.pdf')
    if not os.path.exists(pdf_path):
        pdf_path = os.path.join('assets', '2022-2026-PYQs-with-Keys.pdf')
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Original PYQ archive not found at {pdf_path}")

    out_base = os.path.join('assets', 'PYQs_Screenshots')
    os.makedirs(out_base, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    
    years_config = [
        ('2022', 2, 42),
        ('2023', 46, 69),
        ('2024', 72, 113),
        ('2025', 118, 160),
        ('2026', 165, 196)
    ]
    
    total_extracted = 0
    for year, start_p, end_p in years_config:
        year_dir = os.path.join(out_base, year)
        os.makedirs(year_dir, exist_ok=True)
        
        extracted_for_year = 0
        for pno in range(start_p, end_p + 1):
            page = doc[pno - 1]
            res = extract_questions_for_page(page, year, pno)
            for qnum, rect in res:
                # Render at 300 DPI for high fidelity
                pix = page.get_pixmap(clip=rect, dpi=300)
                
                # Save standard version: JAM_YYYY_Q1.png ... JAM_YYYY_Q60.png
                fn = f'JAM_{year}_Q{qnum}.png'
                path = os.path.join(year_dir, fn)
                pix.save(path)
                
                extracted_for_year += 1
                total_extracted += 1
                
        print(f'[{year}] Successfully extracted {extracted_for_year}/60 questions.')
    
    print(f'Done! Total {total_extracted} questions processed and saved in {out_base}')

if __name__ == '__main__':
    main()
