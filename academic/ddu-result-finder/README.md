# DDU Result Finder — Web Portal & Automation Suite

A modern, high-speed Date of Birth (DOB) discovery and examination result saver for **Deen Dayal Upadhyaya Gorakhpur University (DDUGU)**.

Built directly into the **Vaibhav Geometer Academic Section**, completely independent of IIT JAM and CUET-PG.

---

## 🌟 Key Features

1. **Dual Search Modes**:
   - **Sequential Range Search**: Enter starting and ending roll numbers (e.g. `2515075160001` to `2515075160050`) to automatically scan an entire class or batch. Uses 64-bit integer handling to preserve full 13-digit roll number precision with leading zeros.
   - **Custom Roll List Search**: Input custom roll numbers separated by commas, spaces, or newlines. Includes a 1-click **Load Sample Rolls** button for testing.

2. **Target Operations**:
   - **Find DOB Only**: Efficiently brute-forces and validates student birth dates using interleaved priority years (2003–2008 primary, 1999–2010 extended).
   - **Find DOB & Fetch Result**: Discovers the correct DOB and immediately downloads full semester marksheet details (Student Name, Father's Name, Mother's Name, Enrollment Number, College, Course, SGPA, CGPA, Result Status, and Subject-wise theory & practical marks).

3. **Real-time Live Progress & Metrics**:
   - Dynamic animated gradient progress bar with completion percentage.
   - Real-time sub-progress tracking showing active candidate dates being tested for the current roll number.
   - Stat counters: Total Enqueued, Processed, DOBs Found, Results Saved, Not Found, and Elapsed Timer.
   - Live activity log console.

4. **Authentic Digital Marksheet Viewer**:
   - View an authentic reproduction of the official DDU Grade Sheet.
   - 1-click **Print / Save as PDF** with custom print stylesheets.

5. **Data Export Options**:
   - **Export to Excel (.xlsx)**: Structured spreadsheet containing roll numbers, student names, DOBs, SGPA, CGPA, and results.
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

