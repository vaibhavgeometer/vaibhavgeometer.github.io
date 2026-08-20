"""
Extract 300 High-Resolution Question Screenshots (JAM 2022–2026)
Source: resources/PYQs/2022-2026 PYQs+Keys.pdf
Destination: resources/PYQs_Screenshots/{year}/JAM_{year}_Q{num}.png
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

def is_header_or_footer(b, ph):
    """Determine if a text block belongs to the page header or footer bands."""
    text = b[4].strip()
    if not text:
        return True
    if b[1] < 72 and ('JAM' in text or 'Question Paper' in text or 'MATHEMATICS' in text or 'Mathematics' in text or 'Confidential' in text):
        return True
    if b[3] > ph - 65 and ('Page' in text or 'MA' in text or '/42' in text or '/43' in text or '/49' in text or '38' in text):
        return True
    return False

def extract_questions_for_page(page, year, pno):
    """Detect all questions on a given page and compute their precise bounding crop boxes."""
    ph = page.rect.height
    pw = page.rect.width
    blocks = page.get_text('blocks')
    
    q_items = []
    for b in blocks:
        text = b[4]
        if is_header_or_footer(b, ph):
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
    
    # Filter non-empty content blocks (ignore headers, footers, whitespace)
    content_blocks = [b for b in blocks if not is_header_or_footer(b, ph)]
    
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
        # Freeform text layouts (2023, 2024, 2025)
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
    pdf_path = os.path.join('resources', 'PYQs', '2022-2026 PYQs+Keys.pdf')
    out_base = os.path.join('resources', 'PYQs_Screenshots')
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
