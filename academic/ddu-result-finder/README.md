# DDU Result Finder — Web Portal & Automation Suite

A modern, high-speed Date of Birth (DOB) discovery and examination result saver for **Deen Dayal Upadhyaya Gorakhpur University (DDUGU)**.

Built directly into the **Vaibhav Geometer Academic Section**, completely independent of IIT JAM and CUET-PG.

---

## 🌟 Key Features

1. **Dedicated Scope Switcher**:
   - **🏫 UNPG College B.Sc. (My Class)**:
     - College: **Udit Narayan Post Graduate College, Padrauna (Kushi Nagar)**.
     - Class: **Bachelor of Science (B.Sc.)**, Batch 2024–2027 (Currently in 5th Semester, started July 2024).
     - **Search by Name or Roll Number**: Instant autocomplete filter matching any student in the 399-student database (e.g. typing `Vaibhav`, `Deepika`, `Aafreen`, or roll number digits).
     - **Subject Group Filters**: Easily target **Mathematics Group only** (70 students), **Biology Group only** (304 students), or **All Groups** (399 students).
     - **Multi-Semester Selection**: Fetch and calculate results for a specific semester (e.g., Sem 1, Sem 2, Sem 3, Sem 4, Sem 5) or **multiple semesters simultaneously** with automatic cumulative CGPA computation.
     - **Interactive Grade Sheet Modal**: Marksheet modal includes dynamic semester tabs (`Sem 1`, `Sem 2`, `Sem 3`, `Sem 4`, `Sem 5`) to seamlessly inspect and print authentic grade sheets for any semester.
   - **🌐 Universal DDU Finder (Other Colleges & Classes)**:
     - Retains full universal scanning for any other DDU college, course (B.A., B.Com, M.Sc., etc.), or roll number sequence.
     - Supports **Sequential Range Search** (BigInt safe for 13-digit roll numbers) and **Custom Roll List Search**.
     - Brute-forces and validates student birth dates using interleaved priority years (2003–2008 primary, 1999–2010 extended).

2. **Target Operations**:
   - **Find DOB Only**: Efficiently discovers and validates student birth dates.
   - **Find DOB & Fetch Result**: Retrieves full marksheet details (Student Name, Father's Name, Mother's Name, Enrollment Number, College, Course, SGPA, CGPA, Result Status, and Subject-wise theory & practical marks).

3. **Real-time Live Progress & Metrics**:
   - Dynamic animated gradient progress bar with completion percentage.
   - Real-time sub-progress tracking showing active candidate dates tested for the current roll number.
   - Stat counters: Total Enqueued, Processed, DOBs Found, Results Saved, Not Found, and Elapsed Timer.
   - Live activity log console.

4. **Authentic Digital Marksheet Viewer**:
   - View an authentic reproduction of the official DDU Grade Sheet (NEP 2020 format).
   - 1-click **Print / Save as PDF** with custom print stylesheets.

5. **Data Export Options**:
   - **Export to Excel (.xlsx)**: Structured spreadsheet containing roll numbers, student names, group, DOBs, semester-wise SGPAs, and cumulative CGPA.
   - **Export to CSV**: Universal comma-separated values format.
   - **Copy All DOBs**: Copies all verified Roll Number & DOB pairs directly to clipboard.
   - **Export JSON**: Raw structured JSON for further script processing.

---

## ⚡ Running with Maximum Speed (Local Bridge)

Browsers restrict cross-origin requests to third-party university domains. For the fastest performance (100+ requests/second, zero CORS restrictions):

```bash
# In the terminal:
cd academic/ddu-result-finder/
python ddu_bridge.py
```

The web portal automatically detects `http://127.0.0.1:8765` and upgrades to **Local Fast Bridge** mode!

---

## 📁 File Structure

```text
academic/ddu-result-finder/
├── index.html                 # Main Web Portal UI
├── css/
│   └── ddu.css                # Stylesheet & Marksheet Print Media styles
├── js/
│   └── ddu_engine.js          # Client-side Search Engine & UI Controller
├── ddu_bridge.py              # Local async bridge server (aiohttp)
├── README.md                  # This documentation
└── cloudflare-worker/         # Optional Cloudflare Worker for public CORS proxy
    ├── worker.js
    └── wrangler.toml
```

