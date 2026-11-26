/* ============================================
   UNPG B.Sc. Semester V — Zero-Login 6-Digit Cloud Sync Engine
   ============================================
   - Generates unique 6-character Sync Codes (e.g. SEM-A7K-9M2)
   - Uses Cloudflare Worker KV backend (zero collisions with JAM keys)
   - Falls back gracefully to local cross-tab Sync DB when offline
   - Smart bi-directional merge (solved history, difficulty tags, CBT scores)
   ============================================ */
(function () {
  'use strict';

  // Delegate to site-wide All-in-One Cloud Sync when loaded
  if (window.VAIBHAV_CLOUD_SYNC && window.VAIBHAV_CLOUD_SYNC.__initialized) {
    window.SEM_CLOUD_SYNC = window.VAIBHAV_CLOUD_SYNC;
    return;
  }

  const STORAGE_KEYS = {
    TRACKER: 'sem_pyq_user_tracker_v1',
    SYNC_CODE: 'sem_cloud_sync_code',
    API_URL: 'sem_cloud_sync_api_url',
    LAST_SYNC: 'sem_cloud_sync_last_time',
    AUTO_SYNC: 'sem_cloud_sync_auto_enabled',
    LOCAL_SIM_DB: 'sem_cloud_sync_sim_db',
    SCORE_PREFIX: 'sem_score_'
  };

  const DEFAULT_WORKER_URL = 'https://jam-cloud-sync.vaibhav27182.workers.dev/api/sync';
  const SYNC_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('sem_cloud_sync_channel') : null;

  let currentCode = null;
  let syncState = 'idle'; // idle | syncing | synced | offline | error
  let autoPushTimer = null;
  let activeModalTab = 'overview';

  function generateSyncCode() {
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 3; i++) {
      p1 += SYNC_CHARS.charAt(Math.floor(Math.random() * SYNC_CHARS.length));
      p2 += SYNC_CHARS.charAt(Math.floor(Math.random() * SYNC_CHARS.length));
    }
    return `SEM-${p1}-${p2}`;
  }

  function normalizeCode(input) {
    const clean = String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 4 || clean.length > 24) return null;
    if (clean.length === 9 && clean.startsWith('SEM')) {
      return `SEM-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
    }
    if (clean.length === 6) {
      return `SEM-${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
    }
    return clean;
  }

  function getApiBaseUrl() {
    const custom = localStorage.getItem(STORAGE_KEYS.API_URL);
    if (custom && custom.trim()) return custom.trim().replace(/\/+$/, '');
    return DEFAULT_WORKER_URL;
  }

  function formatRelativeTime(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Recently';
    const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function collectAllScores() {
    const scores = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEYS.SCORE_PREFIX)) {
          const testId = k.slice(STORAGE_KEYS.SCORE_PREFIX.length);
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              scores[testId] = JSON.parse(raw);
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return scores;
  }

  function getLocalPayload() {
    let tracker = { solved: {}, difficulty: {}, lastUpdated: new Date().toISOString() };
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRACKER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const rawSolved = (parsed.solved && typeof parsed.solved === 'object') ? parsed.solved : {};
          const rawDiff = (parsed.difficulty && typeof parsed.difficulty === 'object') ? parsed.difficulty : {};
          const cleanSolved = {};
          const cleanDiff = {};
          const unpgRe = /^(MAT|PHY)\d{3}F_20\d{2}-\d{2}_Q\d+$/;
          Object.entries(rawSolved).forEach(([qId, v]) => {
            if (unpgRe.test(qId) && v && (typeof v !== 'object' || v.solved !== false)) cleanSolved[qId] = v;
          });
          Object.entries(rawDiff).forEach(([qId, v]) => {
            if (unpgRe.test(qId) && typeof v === 'string' && v) cleanDiff[qId] = v;
          });
          tracker = {
            solved: cleanSolved,
            difficulty: cleanDiff,
            lastUpdated: parsed.lastUpdated || new Date().toISOString()
          };
        }
      }
    } catch (e) {}

    return {
      version: 2,
      portal: 'UNPG_SEM_5',
      totalPYQs: 750,
      syncCode: currentCode,
      updatedAt: new Date().toISOString(),
      tracker,
      scores: collectAllScores()
    };
  }

  function smartMergePayloads(localData, remoteData) {
    if (!remoteData || typeof remoteData !== 'object') return localData;

    const mergedSolved = Object.assign({}, (remoteData.tracker && remoteData.tracker.solved) || {});
    const localSolved = (localData.tracker && localData.tracker.solved) || {};

    Object.entries(localSolved).forEach(([qId, val]) => {
      if (!mergedSolved[qId]) {
        mergedSolved[qId] = val;
      } else {
        const tLocal = val && val.solvedAt ? new Date(val.solvedAt).getTime() : 0;
        const tRemote = mergedSolved[qId] && mergedSolved[qId].solvedAt ? new Date(mergedSolved[qId].solvedAt).getTime() : 0;
        if (tLocal >= tRemote) {
          mergedSolved[qId] = val;
        }
      }
    });

    const mergedDifficulty = Object.assign(
      {},
      (remoteData.tracker && remoteData.tracker.difficulty) || {},
      (localData.tracker && localData.tracker.difficulty) || {}
    );

    const mergedScores = Object.assign({}, remoteData.scores || {});
    Object.entries(localData.scores || {}).forEach(([testId, lScore]) => {
      const rScore = mergedScores[testId];
      if (!rScore || (lScore && Number(lScore.percentage) > Number(rScore.percentage))) {
        mergedScores[testId] = lScore;
      }
    });

    return {
      version: 2,
      portal: 'UNPG_SEM_5',
      totalPYQs: 750,
      syncCode: currentCode,
      updatedAt: new Date().toISOString(),
      tracker: {
        solved: mergedSolved,
        difficulty: mergedDifficulty,
        lastUpdated: new Date().toISOString()
      },
      scores: mergedScores
    };
  }

  function applyPayloadLocally(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.tracker) {
      try {
        localStorage.setItem(STORAGE_KEYS.TRACKER, JSON.stringify({
          solved: payload.tracker.solved || {},
          difficulty: payload.tracker.difficulty || {},
          lastUpdated: payload.tracker.lastUpdated || new Date().toISOString()
        }));
      } catch (e) {}
    }

    if (payload.scores && typeof payload.scores === 'object') {
      Object.entries(payload.scores).forEach(([testId, sObj]) => {
        try {
          localStorage.setItem(STORAGE_KEYS.SCORE_PREFIX + testId, JSON.stringify(sObj));
        } catch (e) {}
      });
    }

    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.refreshFromStorage === 'function') {
      window.SEM_TRACKER.refreshFromStorage();
    }
    if (window.SEM_STATS && typeof window.SEM_STATS.updateQuickStatsStrip === 'function') {
      window.SEM_STATS.updateQuickStatsStrip();
    }
    if (typeof window.refreshSemMockTestCards === 'function') {
      window.refreshSemMockTestCards();
    }
    if (typeof window.updateCustomGeneratorSummary === 'function') {
      window.updateCustomGeneratorSummary();
    }
  }

  async function remoteFetch(code) {
    const cleanCode = normalizeCode(code);
    if (!cleanCode) return null;
    const rawKey = cleanCode.replace(/[^A-Z0-9]/g, '');
    const apiUrl = `${getApiBaseUrl()}/${encodeURIComponent(rawKey)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(apiUrl, { method: 'GET', cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        return json && json.data ? json.data : json;
      }
      if (res.status === 404) return null;
    } catch (e) {}

    try {
      const db = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_SIM_DB) || '{}');
      return db[cleanCode] || null;
    } catch (e) {
      return null;
    }
  }

  async function remoteSave(code, payload) {
    const cleanCode = normalizeCode(code);
    if (!cleanCode) return false;
    const rawKey = cleanCode.replace(/[^A-Z0-9]/g, '');
    const apiUrl = `${getApiBaseUrl()}/${encodeURIComponent(rawKey)}`;

    try {
      const db = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_SIM_DB) || '{}');
      db[cleanCode] = payload;
      localStorage.setItem(STORAGE_KEYS.LOCAL_SIM_DB, JSON.stringify(db));
    } catch (e) {}

    if (channel) {
      try {
        channel.postMessage({ type: 'SYNC_UPDATE', code: cleanCode, payload });
      } catch (e) {}
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: rawKey, data: payload }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch (e) {
      return false;
    }
    return false;
  }

  function updateStatusUI() {
    const btn = document.getElementById('btn-cloud-sync');
    const txt = document.getElementById('btn-cloud-sync-text');
    const dot = document.getElementById('cloud-sync-quick-dot');

    if (btn) {
      btn.classList.toggle('linked', Boolean(currentCode));
    }

    if (txt) {
      if (!currentCode) txt.textContent = 'Cloud Sync';
      else if (syncState === 'syncing') txt.textContent = 'Syncing...';
      else if (syncState === 'offline') txt.textContent = `${currentCode} (Local)`;
      else txt.textContent = currentCode;
    }

    if (dot) {
      dot.className = 'cloud-status-indicator';
      if (currentCode) {
        if (syncState === 'syncing') dot.classList.add('syncing');
        else if (syncState === 'offline' || syncState === 'error') dot.classList.add('error');
        else dot.classList.add('synced');
      }
    }

    if (isModalOpen()) renderModalContent();
  }

  function isModalOpen() {
    const modal = document.getElementById('cloud-sync-modal');
    return modal && !modal.classList.contains('hidden');
  }

  function showToast(msg, durationMs) {
    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.showToast === 'function') {
      window.SEM_TRACKER.showToast(msg, durationMs || 3000);
      return;
    }
    console.info('[SEM Cloud Sync]', msg);
  }

  async function syncNow(mode) {
    const opMode = mode || 'merge';
    if (!currentCode) return false;
    syncState = 'syncing';
    updateStatusUI();

    const localData = getLocalPayload();
    const remoteData = await remoteFetch(currentCode);

    let finalPayload = localData;
    if (opMode === 'merge' && remoteData) {
      finalPayload = smartMergePayloads(localData, remoteData);
      applyPayloadLocally(finalPayload);
    } else if (opMode === 'pull' && remoteData) {
      finalPayload = remoteData;
      applyPayloadLocally(finalPayload);
    }

    const pushed = await remoteSave(currentCode, finalPayload);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    syncState = pushed ? 'synced' : 'offline';
    updateStatusUI();
    return pushed;
  }

  function scheduleAutoPush() {
    if (!currentCode) return;
    if (localStorage.getItem(STORAGE_KEYS.AUTO_SYNC) === 'false') return;
    clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(() => {
      syncNow('merge');
    }, 1100);
  }

  async function enableNewSyncCode() {
    currentCode = generateSyncCode();
    localStorage.setItem(STORAGE_KEYS.SYNC_CODE, currentCode);
    await syncNow('push');
    showToast(`Cloud Sync enabled! Code: ${currentCode}`);
    renderModalContent();
  }

  async function linkWithCode(rawInput) {
    const code = normalizeCode(rawInput);
    if (!code) {
      showToast('Enter a valid 6-character code (e.g. SEM-A7K-9M2)');
      return;
    }
    const modeRadio = document.querySelector('input[name="sem_sync_merge_mode"]:checked');
    const opMode = modeRadio ? modeRadio.value : 'merge';
    currentCode = code;
    localStorage.setItem(STORAGE_KEYS.SYNC_CODE, currentCode);
    const ok = await syncNow(opMode);
    showToast(ok ? `Linked & synced with ${currentCode}` : `Linked to ${currentCode} (local cache synced)`);
    switchTab('overview');
  }

  function unlinkSync() {
    currentCode = null;
    syncState = 'idle';
    localStorage.removeItem(STORAGE_KEYS.SYNC_CODE);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    updateStatusUI();
    showToast('Cloud Sync unlinked from this browser. Local progress preserved.');
    renderModalContent();
  }

  function copySyncCode() {
    if (!currentCode) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentCode).then(() => showToast(`Copied code ${currentCode}`));
    } else {
      showToast(`Your Sync Code: ${currentCode}`);
    }
  }

  function getShareableUrl() {
    if (!currentCode) return window.location.href.split('#')[0].split('?')[0];
    const base = window.location.href.split('#')[0].split('?')[0];
    return `${base}?sync=${encodeURIComponent(currentCode)}#pyq-tracker`;
  }

  function copyShareableUrl() {
    const url = getShareableUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast('Magic Sync Link copied to clipboard!'));
    } else {
      showToast(url);
    }
  }

  function openModal(tab) {
    const modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;
    if (tab) activeModalTab = tab;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderModalContent();
  }

  function closeModal() {
    const modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function switchTab(tabName) {
    activeModalTab = tabName || 'overview';
    renderModalContent();
  }

  function saveApiEndpoint() {
    const inp = document.getElementById('cloud-api-url-input');
    if (!inp) return;
    const val = inp.value.trim();
    if (val) localStorage.setItem(STORAGE_KEYS.API_URL, val);
    else localStorage.removeItem(STORAGE_KEYS.API_URL);
    showToast('Cloud Sync endpoint saved.');
    if (currentCode) syncNow('merge');
    else renderModalContent();
  }

  function toggleAutoSyncSetting(checked) {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, checked ? 'true' : 'false');
    showToast(checked ? 'Auto-Sync enabled' : 'Auto-Sync paused (manual sync only)');
  }

  function renderModalContent() {
    const modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;
    const body = modal.querySelector('.cloud-modal-body');
    if (!body) return;

    const tabsHtml = `
      <div class="cloud-modal-tabs">
        <button class="cloud-tab-btn ${activeModalTab === 'overview' ? 'active' : ''}" onclick="SEM_CLOUD_SYNC.switchTab('overview')">☁️ My Sync Pass</button>
        <button class="cloud-tab-btn ${activeModalTab === 'link' ? 'active' : ''}" onclick="SEM_CLOUD_SYNC.switchTab('link')">🔗 Link Another Device</button>
        <button class="cloud-tab-btn ${activeModalTab === 'settings' ? 'active' : ''}" onclick="SEM_CLOUD_SYNC.switchTab('settings')">⚙️ Sync Settings</button>
      </div>
    `;

    const payload = getLocalPayload();
    const solvedCount = Object.entries(payload.tracker.solved || {}).filter(
      ([qId, v]) => /^(MAT|PHY)\d{3}F_20\d{2}-\d{2}_Q\d+$/.test(qId) && v && (typeof v !== 'object' || v.solved !== false)
    ).length;
    const diffCount = Object.entries(payload.tracker.difficulty || {}).filter(
      ([qId, v]) => /^(MAT|PHY)\d{3}F_20\d{2}-\d{2}_Q\d+$/.test(qId) && typeof v === 'string' && v
    ).length;
    const scoresCount = Object.keys(payload.scores || {}).length;
    const lastSyncStr = formatRelativeTime(localStorage.getItem(STORAGE_KEYS.LAST_SYNC));

    let contentHtml = '';

    if (activeModalTab === 'overview') {
      if (!currentCode) {
        contentHtml = `
          <div class="cloud-intro-card">
            <div style="font-size:2.4rem; margin-bottom:10px;">☁️</div>
            <h3>Zero-Login 6-Character Cloud Sync</h3>
            <p>Generate a private 6-character pass (e.g. <code>SEM-A7K-9M2</code>) to sync your 750 Semester PYQs solved progress, custom difficulty tags, and CBT mock scores across devices.</p>
            <div class="cloud-badge-status synced" style="margin-bottom:18px;">
              Ready to backup: ${solvedCount} solved · ${diffCount} tags · ${scoresCount} mock scores
            </div>
            <div class="cloud-action-grid">
              <button class="btn-cloud-action primary" onclick="SEM_CLOUD_SYNC.enableNewSyncCode()">✨ Generate My Sync Code</button>
              <button class="btn-cloud-action secondary" onclick="SEM_CLOUD_SYNC.switchTab('link')">🔗 I already have a code</button>
            </div>
          </div>
        `;
      } else {
        const shareUrl = getShareableUrl();
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(shareUrl)}`;
        const badgeCls = syncState === 'offline' || syncState === 'error'
          ? 'error'
          : (syncState === 'syncing' ? 'syncing' : 'synced');
        const badgeTxt = syncState === 'offline'
          ? 'Local Cache Mode'
          : (syncState === 'syncing' ? 'Syncing...' : 'Cloud Active');

        contentHtml = `
          <div class="cloud-code-hero-card">
            <div class="cloud-code-header">
              <span>YOUR SEMESTER SYNC CODE</span>
              <span class="cloud-badge-status ${badgeCls}">${badgeTxt} · Last: ${escapeHtml(lastSyncStr)}</span>
            </div>
            <div class="cloud-code-large-box">
              <span class="cloud-code-val">${escapeHtml(currentCode)}</span>
              <button class="btn-copy-code" onclick="SEM_CLOUD_SYNC.copySyncCode()">📋 Copy Code</button>
            </div>
            <div style="font-size:0.82rem; color:var(--text-secondary);">
              Synced snapshot: <strong>${solvedCount} / 750</strong> solved · <strong>${diffCount}</strong> difficulty tags · <strong>${scoresCount} / 15</strong> mock scores
            </div>
          </div>

          <div class="cloud-qr-section">
            <div class="cloud-qr-box">
              <img src="${qrSrc}" alt="QR Code for Semester Cloud Sync" class="cloud-qr-img" loading="lazy" />
            </div>
            <div class="cloud-qr-instructions">
              <strong>Scan with Phone / Tablet</strong>
              <p>Open your mobile camera to scan this QR code, or copy the magic link to merge your Semester V tracker and mock scores seamlessly.</p>
              <div class="cloud-action-grid">
                <button class="btn-cloud-action secondary" onclick="SEM_CLOUD_SYNC.copyShareableUrl()">🔗 Copy Magic Link</button>
                <button class="btn-cloud-action primary" onclick="SEM_CLOUD_SYNC.syncNow('merge')">🔄 Sync Now</button>
              </div>
            </div>
          </div>
        `;
      }
    } else if (activeModalTab === 'link') {
      contentHtml = `
        <div class="cloud-link-device-card">
          <h4>🔗 Link Another Device</h4>
          <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:14px;">Enter the 6-character Semester Sync Code from your other device (e.g. <code>SEM-A7K-9M2</code>).</p>
          <input type="text" id="cloud-code-input" class="cloud-code-input-field" placeholder="SEM-XXX-XXX" maxlength="24" value="${currentCode ? escapeHtml(currentCode) : ''}" onkeydown="if(event.key==='Enter') SEM_CLOUD_SYNC.linkWithCode(this.value)" />
          <div class="cloud-merge-preference">
            <label class="cloud-radio-label">
              <input type="radio" name="sem_sync_merge_mode" value="merge" checked />
              <span><strong>Smart Merge (Recommended):</strong> Combine solved questions &amp; keep highest mock scores across both devices.</span>
            </label>
            <label class="cloud-radio-label">
              <input type="radio" name="sem_sync_merge_mode" value="pull" />
              <span><strong>Replace Local from Cloud:</strong> Overwrite this browser with the cloud snapshot.</span>
            </label>
          </div>
          <div class="cloud-action-grid" style="margin-top:16px;">
            <button class="btn-cloud-action primary" onclick="SEM_CLOUD_SYNC.linkWithCode(document.getElementById('cloud-code-input').value)">🔗 Link &amp; Sync</button>
            <button class="btn-cloud-action secondary" onclick="SEM_CLOUD_SYNC.switchTab('overview')">Back</button>
          </div>
        </div>
      `;
    } else {
      const autoEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC) !== 'false';
      const customEndpoint = localStorage.getItem(STORAGE_KEYS.API_URL) || '';
      contentHtml = `
        <div class="cloud-toggle-row">
          <div class="cloud-toggle-label">
            <strong>Auto-Sync on Changes</strong>
            <span>Automatically push updates 1s after marking questions solved, tagging difficulty, or finishing a mock test.</span>
          </div>
          <input type="checkbox" ${autoEnabled ? 'checked' : ''} onchange="SEM_CLOUD_SYNC.toggleAutoSyncSetting(this.checked)" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;" />
        </div>

        <div class="cloud-link-device-card" style="margin-bottom:16px;">
          <h4>Custom Worker Endpoint (Optional)</h4>
          <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:10px;">Default uses the portal Cloudflare Worker KV endpoint. Leave blank unless self-hosting.</p>
          <input type="url" id="cloud-api-url-input" class="cloud-code-input-field" style="font-size:0.86rem;letter-spacing:0;text-transform:none;text-align:left;" placeholder="${escapeHtml(DEFAULT_WORKER_URL)}" value="${escapeHtml(customEndpoint)}" />
          <div class="cloud-action-grid" style="margin-top:12px;">
            <button class="btn-cloud-action secondary" onclick="SEM_CLOUD_SYNC.saveApiEndpoint()">Save Endpoint</button>
            ${currentCode ? '<button class="btn-cloud-action danger" onclick="SEM_CLOUD_SYNC.unlinkSync()">Unlink Current Device</button>' : ''}
          </div>
        </div>
      `;
    }

    body.innerHTML = tabsHtml + contentHtml;
  }

  function init() {
    currentCode = normalizeCode(localStorage.getItem(STORAGE_KEYS.SYNC_CODE));

    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('sync');
      if (urlCode) {
        const clean = normalizeCode(urlCode);
        if (clean) {
          currentCode = clean;
          localStorage.setItem(STORAGE_KEYS.SYNC_CODE, currentCode);
          params.delete('sync');
          const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash;
          window.history.replaceState({}, '', newUrl);
          setTimeout(() => {
            syncNow('merge').then(() => showToast(`Cloud Sync linked automatically: ${currentCode}`));
          }, 300);
        }
      } else if (currentCode) {
        syncState = 'synced';
        setTimeout(() => syncNow('merge'), 700);
      }
    } catch (e) {}

    if (channel) {
      channel.onmessage = (ev) => {
        if (ev && ev.data && ev.data.type === 'SYNC_UPDATE' && ev.data.code === currentCode && ev.data.payload) {
          applyPayloadLocally(ev.data.payload);
          syncState = 'synced';
          updateStatusUI();
        }
      };
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalOpen()) closeModal();
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateStatusUI);
    } else {
      updateStatusUI();
    }
  }

  window.SEM_CLOUD_SYNC = {
    STORAGE_KEYS,
    init,
    openModal,
    closeModal,
    switchTab,
    syncNow,
    scheduleAutoPush,
    enableNewSyncCode,
    linkWithCode,
    unlinkSync,
    copySyncCode,
    copyShareableUrl,
    saveApiEndpoint,
    toggleAutoSyncSetting,
    getCurrentCode: () => currentCode,
    updateStatusUI
  };

  init();
})();
