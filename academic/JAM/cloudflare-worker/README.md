# ☁️ IIT JAM PYQ Tracker — 6-Digit Cloud Sync Worker

This Cloudflare Worker provides zero-login, instant 6-digit cloud sync for the IIT JAM Mathematics PYQ Tracker.

### Features
* **Zero Authentication**: No Google login, no cookies, no privacy concerns.
* **Global Edge Performance**: Under 50ms latency worldwide via Cloudflare's CDN.
* **100% Free**: Operates within Cloudflare's free tier (100,000 requests/day, 1 GB storage).
* **Automatic TTL**: Retains progress for 180 days after the last study session, automatically renewed on every click.

---

## 🚀 Quick 2-Minute Deployment

### Method 1: Via Cloudflare Dashboard (No Terminal / Browser Only)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and sign up / log in (Free).
2. On the left sidebar, click **Workers & Pages** $\rightarrow$ **Create Application** $\rightarrow$ **Create Worker**.
3. Name it `jam-cloud-sync` and click **Deploy**.
4. Click **Edit Code**, delete everything, paste the contents of `worker.js`, and click **Deploy**.
5. Back on your Worker dashboard, go to **Settings** $\rightarrow$ **Variables & Bindings** $\rightarrow$ **KV Namespace Bindings**:
   * Click **Add binding**.
   * Variable name: `JAM_SYNC_KV`
   * Select or create a new KV namespace named `JAM_SYNC_KV`.
6. Copy your Worker URL (e.g. `https://jam-cloud-sync.<your-subdomain>.workers.dev`).
7. Paste this URL into the PYQ Tracker under **Cloud Sync $\rightarrow$ ⚙️ Backend Settings**!

---

### Method 2: Via Wrangler CLI
1. Open terminal in this directory:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. Create the KV namespace:
   ```bash
   wrangler kv:namespace create JAM_SYNC_KV
   ```
3. Copy the returned `id` and paste it into `wrangler.toml`.
4. Deploy:
   ```bash
   wrangler deploy
   ```
5. Your worker is live at `https://jam-cloud-sync.<your-subdomain>.workers.dev`.

