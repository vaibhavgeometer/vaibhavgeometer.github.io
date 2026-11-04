/**
 * IIT JAM Mathematics (MA) — 6-Digit Cloud Sync Engine
 * Fast, privacy-first, zero-login progress synchronization across mobile & desktop.
 * 
 * Key Features:
 * 1. 6-Digit Alphanumeric Code (e.g. JAM-842-195)
 * 2. Instant QR Code generation for seamless 2-second mobile camera sync
 * 3. 1-Click shareable URL auto-sync (?sync=JAM-842-195)
 * 4. Conflict-free Smart Merge algorithm (never loses solved questions across devices)
 * 5. Real-time debounced auto-sync on every question click
 * 6. Cross-tab BroadcastChannel sync for multi-window desktop study
 */

(function() {
  'use strict';

  // Storage Keys
  const STORAGE_SYNC_CODE = 'jam_cloud_sync_code';
  const STORAGE_API_URL = 'jam_cloud_sync_api_url';
  const STORAGE_LAST_SYNC = 'jam_cloud_sync_last_time';
  const STORAGE_AUTO_SYNC = 'jam_cloud_sync_auto_enabled';
  const STORAGE_LOCAL_SIM_DB = 'jam_cloud_sync_sim_db';

  // Default API Endpoint (points to Vaibhav's live Cloudflare Worker)
  const DEFAULT_API_URL = window.JAM_CLOUD_SYNC_API_URL || 'https://jam-cloud-sync.vaibhav27182.workers.dev/api/sync';

  // Cross-tab broadcast channel
  let broadcast = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcast = new BroadcastChannel('jam_cloud_sync_channel');
    }
  } catch (e) {}

  // Resolve API URL (purge old non-existent placeholder if present in localStorage)
  let initialApiUrl = localStorage.getItem(STORAGE_API_URL);
  if (!initialApiUrl || initialApiUrl.includes('vaibhavgeometer.workers.dev')) {
    initialApiUrl = DEFAULT_API_URL;
    localStorage.removeItem(STORAGE_API_URL);
  }

  // Engine State
  const state = {
    syncCode: localStorage.getItem(STORAGE_SYNC_CODE) || null,
    apiUrl: initialApiUrl,
    lastSyncTime: localStorage.getItem(STORAGE_LAST_SYNC) || null,
    autoSyncEnabled: localStorage.getItem(STORAGE_AUTO_SYNC) !== 'false',
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error' | 'unlinked'
    statusMessage: '',
    debounceTimer: null,
    activeTab: 'my-code', // 'my-code' | 'link-device' | 'settings'
    lastSyncedSolvedCount: 0
  };

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  // Generate 6-character high-entropy code: JAM-XXX-XXX
  function generateRandomCode() {
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // Removed 0, O, 1, I, L to avoid typos
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 3; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `JAM-${part1}-${part2}`;
  }

  // Normalize user input to canonical JAM-XXX-XXX format
  function normalizeCode(raw) {
    if (!raw) return '';
    let cleaned = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.startsWith('JAM') && cleaned.length > 3) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.length === 6) {
      return `JAM-${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    return cleaned ? `JAM-${cleaned}` : '';
  }

  function getCleanCodeKey(code) {
    const c = code || state.syncCode;
    return c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  }

  function getShareableUrl(code) {
    const c = code || state.syncCode;
    if (!c) return window.location.href;
    const base = window.location.origin + window.location.pathname;
    return `${base}?sync=${encodeURIComponent(c)}`;
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 15) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return 'Recently';
    }
  }

  function formatFullDateTime(isoString) {
    if (!isoString) return 'Never';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoString;
    }
  }

  function showToast(msg) {
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
      window.JAM_TRACKER.showToast(msg);
    } else {
      console.log('[Cloud Sync]', msg);
    }
  }

  // ==========================================================================
  // Tracker Payload & Smart Merge Engine
  // ==========================================================================

  function getTrackerPayload() {
    let userData = { questions: {}, oosMarkedUnnecessary: false };
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function') {
      userData = window.JAM_TRACKER.getUserData();
    } else {
      try {
        const raw = localStorage.getItem('jam_pyq_user_tracker_v1');
        if (raw) userData = JSON.parse(raw);
      } catch (e) {}
    }

    const questions = userData.questions || {};
    let solvedCount = 0;
    Object.values(questions).forEach(q => {
      if (q && q.solved) solvedCount++;
    });

    return {
      app: 'IIT_JAM_Mathematics_MA_PYQ_Tracker',
      version: '1.2',
      syncCode: state.syncCode,
      lastUpdated: userData.lastUpdated || new Date().toISOString(),
      stats: {
        totalOfficialPYQs: 885,
        solvedCount: solvedCount,
        oosMarkedUnnecessary: !!userData.oosMarkedUnnecessary
      },
      oosMarkedUnnecessary: !!userData.oosMarkedUnnecessary,
      questions: questions
    };
  }

  // Smart Merge: Combines cloud progress with local progress without losing questions
  function mergeUserData(localData, cloudData) {
    const lQuestions = (localData && localData.questions) || {};
    const cQuestions = (cloudData && cloudData.questions) || {};
    const mergedQuestions = { ...lQuestions };

    Object.entries(cQuestions).forEach(([qId, cQ]) => {
      const lQ = mergedQuestions[qId];
      if (!lQ) {
        mergedQuestions[qId] = cQ;
      } else {
        // Both exist: if either is solved, it stays solved!
        const isSolved = !!(lQ.solved || cQ.solved);
        let solvedAt = null;
        if (lQ.solved && cQ.solved) {
          // Keep earliest timestamp
          try {
            solvedAt = (new Date(lQ.solvedAt) < new Date(cQ.solvedAt)) ? lQ.solvedAt : cQ.solvedAt;
          } catch (e) {
            solvedAt = lQ.solvedAt || cQ.solvedAt;
          }
        } else {
          solvedAt = lQ.solved ? lQ.solvedAt : cQ.solvedAt;
        }

        mergedQuestions[qId] = {
          solved: isSolved,
          solvedAt: solvedAt,
          difficulty: lQ.difficulty || cQ.difficulty || null,
          unnecessary: !!(lQ.unnecessary || cQ.unnecessary)
        };
      }
    });

    return {
      questions: mergedQuestions,
      oosMarkedUnnecessary: !!(localData?.oosMarkedUnnecessary || cloudData?.oosMarkedUnnecessary),
      lastUpdated: new Date().toISOString()
    };
  }

  function applyDataToTracker(targetData) {
    if (!targetData || typeof targetData.questions !== 'object') {
      throw new Error('Corrupted data structure');
    }

    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
      window.JAM_TRACKER.loadUserDataFromBackup(targetData);
    } else {
      localStorage.setItem('jam_pyq_user_tracker_v1', JSON.stringify({
        questions: targetData.questions,
        oosMarkedUnnecessary: !!targetData.oosMarkedUnnecessary,
        lastUpdated: targetData.lastUpdated || new Date().toISOString()
      }));
      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.init === 'function') {
        window.JAM_TRACKER.init();
      }
    }
  }

  // ==========================================================================
  // Network REST API Client (Cloudflare Worker KV with Local Fallback)
  // ==========================================================================

  // Save to local simulation DB as fallback if worker endpoint is not reachable
  function saveToLocalSimDb(codeKey, payload) {
    try {
      const raw = localStorage.getItem(STORAGE_LOCAL_SIM_DB);
      const db = raw ? JSON.parse(raw) : {};
      db[codeKey] = {
        data: payload,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_LOCAL_SIM_DB, JSON.stringify(db));
    } catch (e) {}
  }

  function getFromLocalSimDb(codeKey) {
    try {
      const raw = localStorage.getItem(STORAGE_LOCAL_SIM_DB);
      if (!raw) return null;
      const db = JSON.parse(raw);
      return db[codeKey]?.data || null;
    } catch (e) {
      return null;
    }
  }

  async function apiFetchCloudData(code) {
    const rawCode = getCleanCodeKey(code);
    const apiUrl = state.apiUrl.replace(/\/+$/, '');
    const endpoint = `${apiUrl}/${rawCode}`;

    try {
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (resp.status === 404) {
        return { found: false, data: null };
      }

      if (!resp.ok) {
        throw new Error(`Cloud API responded with status ${resp.status}`);
      }

      const json = await resp.json();
      return { found: true, data: json };
    } catch (err) {
      console.warn('[Cloud Sync] Remote fetch failed, trying local fallback:', err.message);
      const fallback = getFromLocalSimDb(rawCode);
      if (fallback) {
        return { found: true, data: fallback, isLocalFallback: true };
      }
      throw err;
    }
  }

  async function apiPushCloudData(code, payload) {
    const rawCode = getCleanCodeKey(code);
    const apiUrl = state.apiUrl.replace(/\/+$/, '');
    const endpoint = `${apiUrl}/${rawCode}`;

    // Always cache locally first
    saveToLocalSimDb(rawCode, payload);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Cloud API push error (${resp.status}): ${errText}`);
      }

      return await resp.json();
    } catch (err) {
      console.warn('[Cloud Sync] Remote push failed, cached in local sim storage:', err.message);
      // If network fails or custom worker isn't deployed yet, return gracefully with fallback
      return { success: true, isLocalFallback: true, error: err.message };
    }
  }

  // ==========================================================================
  // Core Sync Controller
  // ==========================================================================

  async function performSync(isManual = false) {
    if (!state.syncCode) return;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing to cloud...';
    updateUI();

    try {
      const payload = getTrackerPayload();
      const result = await apiPushCloudData(state.syncCode, payload);

      state.lastSyncTime = new Date().toISOString();
      state.lastSyncedSolvedCount = payload.stats?.solvedCount || 0;
      localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);

      state.syncStatus = 'synced';
      if (result.isLocalFallback) {
        state.statusMessage = `Saved locally (Cloudflare Worker not reachable)`;
      } else {
        state.statusMessage = `Synced to cloud (${formatRelativeTime(state.lastSyncTime)})`;
      }
      updateUI();

      // Broadcast to other open tabs
      if (broadcast) {
        try {
          broadcast.postMessage({
            type: 'SYNC_UPDATE',
            syncCode: state.syncCode,
            payload: payload
          });
        } catch (e) {}
      }

      if (isManual) {
        if (result.isLocalFallback) {
          showToast(`✓ Progress saved to code ${state.syncCode} (Stored locally until Worker is connected)`);
        } else {
          showToast(`✓ Cloud sync successful! Code: ${state.syncCode}`);
        }
      }
    } catch (err) {
      console.error('[Cloud Sync Error]:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Sync error: ' + err.message;
      updateUI();
      if (isManual) {
        alert('Could not sync to cloud: ' + err.message);
      }
    }
  }

  function triggerAutoSync() {
    if (!state.syncCode || !state.autoSyncEnabled) return;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing changes...';
    updateHeaderButtonUI();

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    // 400ms debounce batches rapid consecutive clicks
    state.debounceTimer = setTimeout(() => {
      performSync(false);
    }, 400);
  }

  // Link device using a 6-digit sync code
  async function linkWithCode(inputCode, mergeMode = 'merge', isAutoFromUrl = false) {
    const code = normalizeCode(inputCode);
    if (!code || code.length < 7) {
      alert('Please enter a valid 6-digit Sync Code (e.g. JAM-842-195 or 842195).');
      return;
    }

    state.syncStatus = 'syncing';
    state.statusMessage = `Connecting to ${code}...`;
    updateUI();

    try {
      const res = await apiFetchCloudData(code);

      if (res.found && res.data) {
        const cloudData = res.data;
        const localData = getTrackerPayload();

        let finalData;
        if (mergeMode === 'merge') {
          finalData = mergeUserData(localData, cloudData);
        } else {
          finalData = cloudData;
        }

        applyDataToTracker(finalData);

        state.syncCode = code;
        localStorage.setItem(STORAGE_SYNC_CODE, code);
        state.lastSyncTime = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
        state.syncStatus = 'synced';
        state.statusMessage = `Connected to ${code}`;
        updateUI();

        // Push merged state back to cloud so both sides are aligned
        await apiPushCloudData(code, finalData);

        showToast(`✓ Successfully linked with Code: ${code}!`);
        if (!isAutoFromUrl) closeModal();
      } else {
        // Code does not exist yet on cloud: create it now using local progress!
        state.syncCode = code;
        localStorage.setItem(STORAGE_SYNC_CODE, code);
        const payload = getTrackerPayload();
        await apiPushCloudData(code, payload);

        state.lastSyncTime = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
        state.syncStatus = 'synced';
        state.statusMessage = `Created new cloud session: ${code}`;
        updateUI();

        showToast(`✓ New Cloud Sync session initialized: ${code}`);
        if (!isAutoFromUrl) closeModal();
      }
    } catch (err) {
      console.error('[Link Error]:', err);
      // If network fails, link locally anyway
      state.syncCode = code;
      localStorage.setItem(STORAGE_SYNC_CODE, code);
      state.syncStatus = 'synced';
      state.statusMessage = `Linked locally: ${code}`;
      updateUI();
      showToast(`✓ Linked to Code ${code} (Local mode)`);
      if (!isAutoFromUrl) closeModal();
    }
  }

  // Generate and activate a brand-new sync code
  async function createNewCode() {
    const newCode = generateRandomCode();
    state.syncCode = newCode;
    localStorage.setItem(STORAGE_SYNC_CODE, newCode);

    state.syncStatus = 'syncing';
    state.statusMessage = 'Creating cloud session...';
    updateUI();

    const payload = getTrackerPayload();
    await apiPushCloudData(newCode, payload);

    state.lastSyncTime = new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
    state.syncStatus = 'synced';
    state.statusMessage = `Active: ${newCode}`;
    updateUI();

    showToast(`✓ New Sync Code generated: ${newCode}`);
  }

  // Pull down latest from cloud and apply to device
  async function pullFromCloud() {
    if (!state.syncCode) return;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Pulling from cloud...';
    updateUI();

    try {
      const res = await apiFetchCloudData(state.syncCode);
      if (res.found && res.data) {
        applyDataToTracker(res.data);
        state.lastSyncTime = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
        state.syncStatus = 'synced';
        state.statusMessage = `Updated from cloud (${formatRelativeTime(state.lastSyncTime)})`;
        updateUI();
        showToast('✓ Latest progress downloaded and applied from cloud!');
      } else {
        alert(`No backup found in cloud for code ${state.syncCode}. Try "Sync Now" to push.`);
        state.syncStatus = 'idle';
        updateUI();
      }
    } catch (err) {
      alert('Could not pull from cloud: ' + err.message);
      state.syncStatus = 'error';
      updateUI();
    }
  }

  function unlinkDevice() {
    const confirmUnlink = confirm(
      'Are you sure you want to unlink this device?\n\n' +
      `• Your cloud progress for code "${state.syncCode}" will NOT be deleted.\n` +
      '• Your local progress on this device will remain saved.\n' +
      '• This device will stop auto-syncing to this code.'
    );
    if (!confirmUnlink) return;

    localStorage.removeItem(STORAGE_SYNC_CODE);
    localStorage.removeItem(STORAGE_LAST_SYNC);
    state.syncCode = null;
    state.lastSyncTime = null;
    state.syncStatus = 'idle';
    state.statusMessage = 'Device unlinked';
    updateUI();
    showToast('Device unlinked from cloud sync.');
  }

  function toggleAutoSync(enabled) {
    state.autoSyncEnabled = !!enabled;
    localStorage.setItem(STORAGE_AUTO_SYNC, String(state.autoSyncEnabled));
    updateUI();
    showToast(state.autoSyncEnabled ? 'Real-time cloud sync enabled' : 'Auto-sync paused');
  }

  function setApiUrl(newUrl) {
    const val = (newUrl || '').trim();
    state.apiUrl = val || DEFAULT_API_URL;
    if (val) {
      localStorage.setItem(STORAGE_API_URL, val);
      showToast('Custom Cloudflare Worker API URL saved!');
    } else {
      localStorage.removeItem(STORAGE_API_URL);
      showToast('Reset to default Cloudflare Worker API URL.');
    }
    updateUI();
  }

  // ==========================================================================
  // Cross-Tab Multi-Window Sync Listener
  // ==========================================================================
  if (broadcast) {
    broadcast.onmessage = (e) => {
      if (e.data && e.data.type === 'SYNC_UPDATE' && e.data.syncCode === state.syncCode) {
        if (e.data.payload && e.data.payload.questions) {
          try {
            // Apply silently without re-triggering another broadcast
            if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
              window.JAM_TRACKER.loadUserDataFromBackup(e.data.payload);
            }
            state.lastSyncTime = new Date().toISOString();
            updateHeaderButtonUI();
          } catch (err) {}
        }
      }
    };
  }

  // ==========================================================================
  // UI Rendering & Modal Manager
  // ==========================================================================

  function updateHeaderButtonUI() {
    const btn = document.getElementById('btn-cloud-sync');
    const label = document.getElementById('btn-cloud-sync-text');
    const dot = document.getElementById('cloud-sync-quick-dot');

    if (!btn) return;

    if (state.syncCode) {
      btn.classList.add('linked');
      if (state.syncStatus === 'syncing') {
        if (label) label.textContent = 'Syncing...';
        if (dot) dot.className = 'cloud-status-indicator syncing';
        btn.setAttribute('title', `Syncing to cloud code "${state.syncCode}"...`);
      } else if (state.syncStatus === 'error') {
        if (label) label.textContent = 'Sync: Error';
        if (dot) dot.className = 'cloud-status-indicator error';
        btn.setAttribute('title', 'Cloud sync error. Click to view details.');
      } else {
        const timeStr = formatRelativeTime(state.lastSyncTime);
        if (label) label.textContent = `Sync: ${state.syncCode}`;
        if (dot) dot.className = 'cloud-status-indicator synced';
        btn.setAttribute('title', `Cloud Sync Active • Code: "${state.syncCode}". Last: ${formatFullDateTime(state.lastSyncTime)}.`);
      }
    } else {
      btn.classList.remove('linked');
      if (label) label.textContent = 'Cloud Sync';
      if (dot) dot.className = 'cloud-status-indicator';
      btn.setAttribute('title', 'Instant 6-Digit Cloud Sync across devices — zero login required');
    }
  }

  function renderModalContent() {
    const modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;

    const isLinked = !!state.syncCode;
    const currentCode = state.syncCode || '';
    const shareUrl = getShareableUrl(currentCode);
    // Dynamic QR Code URL via reliable public QR server with theme matching
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}&margin=8&bgcolor=141825&color=818cf8`;

    modal.innerHTML = `
      <div class="modal-card cloud-sync-modal-card">
        <div class="modal-header">
          <div class="modal-title">
            <span style="font-size: 1.3rem;">☁️</span>
            <span>6-Digit Cloud Sync & Cross-Device Hub</span>
          </div>
          <button class="modal-close-btn" onclick="window.JAM_CLOUD_SYNC.closeModal()" title="Close (Esc)">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="cloud-modal-tabs">
          <button class="cloud-tab-btn ${state.activeTab === 'my-code' ? 'active' : ''}" onclick="window.JAM_CLOUD_SYNC.switchTab('my-code')">
            <span>🔑</span> <span>${isLinked ? 'My Sync Code' : 'Generate Code'}</span>
          </button>
          <button class="cloud-tab-btn ${state.activeTab === 'link-device' ? 'active' : ''}" onclick="window.JAM_CLOUD_SYNC.switchTab('link-device')">
            <span>📱</span> <span>Link Another Device</span>
          </button>
          <button class="cloud-tab-btn ${state.activeTab === 'settings' ? 'active' : ''}" onclick="window.JAM_CLOUD_SYNC.switchTab('settings')">
            <span>⚙️</span> <span>Worker / Backend</span>
          </button>
        </div>

        <div class="modal-body" style="padding-top: 16px;">
          ${renderActiveTabBody(isLinked, currentCode, shareUrl, qrUrl)}
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; border-top: 1px solid var(--border);">
          <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
            <span>🔒 Zero login required · 100% private · No Google verification needed</span>
          </div>
          <button type="button" class="btn-test secondary" onclick="window.JAM_CLOUD_SYNC.closeModal()">Close</button>
        </div>
      </div>
    `;
  }

  function renderActiveTabBody(isLinked, currentCode, shareUrl, qrUrl) {
    if (state.activeTab === 'my-code') {
      if (isLinked) {
        return `
          <!-- Active Code Display Card -->
          <div class="cloud-code-hero-card">
            <div class="cloud-code-header">
              <span class="cloud-badge-status synced">🟢 Cloud Session Active</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Last synced: ${formatRelativeTime(state.lastSyncTime)}</span>
            </div>

            <div class="cloud-code-large-box">
              <span class="cloud-code-val" id="cloud-sync-display-code">${currentCode}</span>
              <button class="btn-copy-code" onclick="window.JAM_CLOUD_SYNC.copyCode('${currentCode}')" title="Copy 6-digit code">
                📋 Copy Code
              </button>
            </div>

            <!-- Mobile Quick Sync QR Code Section -->
            <div class="cloud-qr-section">
              <div class="cloud-qr-box">
                <img src="${qrUrl}" alt="Scan with phone to sync" class="cloud-qr-img" onerror="this.style.display='none'">
              </div>
              <div class="cloud-qr-instructions">
                <strong>📱 Scan with Phone Camera to Sync Instantly</strong>
                <p>Point your phone's camera at this QR code. It will open this exact page and load all your solved questions automatically in 2 seconds!</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                  <button class="btn-mini-link" onclick="window.JAM_CLOUD_SYNC.copyLink('${shareUrl}')">📋 Copy Direct Link</button>
                  <button class="btn-mini-link" onclick="window.JAM_CLOUD_SYNC.shareLink('${shareUrl}')">📤 Share Link</button>
                </div>
              </div>
            </div>

            <!-- Auto Sync Toggle -->
            <div class="cloud-toggle-row">
              <label class="cloud-toggle-label">
                <input type="checkbox" ${state.autoSyncEnabled ? 'checked' : ''} onchange="window.JAM_CLOUD_SYNC.toggleAutoSync(this.checked)">
                <span>⚡ Real-Time Auto-Sync (Saves automatically on every question click)</span>
              </label>
            </div>

            <!-- Action Buttons Grid -->
            <div class="cloud-action-grid">
              <button class="btn-cloud-action primary" onclick="window.JAM_CLOUD_SYNC.syncNow()">
                <span>🔄</span> <span>Sync to Cloud Now</span>
              </button>
              <button class="btn-cloud-action secondary" onclick="window.JAM_CLOUD_SYNC.pullFromCloud()">
                <span>📥</span> <span>Pull Latest from Cloud</span>
              </button>
              <button class="btn-cloud-action secondary" onclick="window.JAM_CLOUD_SYNC.createNewCode()">
                <span>✨</span> <span>Generate New Code</span>
              </button>
              <button class="btn-cloud-action danger" onclick="window.JAM_CLOUD_SYNC.unlinkDevice()">
                <span>🔌</span> <span>Unlink Device</span>
              </button>
            </div>
          </div>
        `;
      } else {
        return `
          <!-- Unlinked: Prompt to generate code -->
          <div class="cloud-intro-card">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="font-size: 2.8rem; margin-bottom: 8px;">☁️</div>
              <h3 style="color: var(--text-main); font-size: 1.25rem; margin-bottom: 6px;">Zero-Login Cloud Sync</h3>
              <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 480px; margin: 0 auto;">
                Sync your IIT JAM PYQ solving progress between your phone and laptop instantly using a simple 6-digit code. No accounts, no passwords, no Google verification!
              </p>
            </div>

            <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
              <button class="btn-test primary" onclick="window.JAM_CLOUD_SYNC.createNewCode()" style="padding: 12px 24px; font-size: 0.95rem;">
                <span>✨</span> <span>Generate My 6-Digit Sync Code</span>
              </button>
              <button class="btn-test secondary" onclick="window.JAM_CLOUD_SYNC.switchTab('link-device')" style="padding: 12px 24px; font-size: 0.95rem;">
                <span>📱</span> <span>I Have an Existing Code</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    if (state.activeTab === 'link-device') {
      return `
        <div class="cloud-link-device-card">
          <h4 style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 6px;">Link This Device with a Sync Code</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 18px;">
            Have a 6-digit Sync Code from your phone, laptop, or study partner? Enter it below to link this device.
          </p>

          <div class="cloud-input-code-group">
            <label for="cloud-code-input" style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px;">
              Enter 6-Digit Sync Code:
            </label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="cloud-code-input" class="cloud-code-input-field" placeholder="e.g. JAM-842-195 or 842195" autofocus>
              <button class="btn-test primary" onclick="window.JAM_CLOUD_SYNC.submitLinkCode()">
                ⚡ Connect & Sync
              </button>
            </div>
          </div>

          <div class="cloud-merge-preference">
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 8px;">
              Merge Preference:
            </span>
            <label class="cloud-radio-label">
              <input type="radio" name="cloud-merge-choice" value="merge" checked>
              <div>
                <strong>🟢 Smart Merge (Recommended)</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Combines solved questions from both devices so you never lose any progress.</div>
              </div>
            </label>
            <label class="cloud-radio-label" style="margin-top: 8px;">
              <input type="radio" name="cloud-merge-choice" value="replace">
              <div>
                <strong>🔵 Overwrite Local Progress</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Replaces this device's progress completely with whatever is in the cloud.</div>
              </div>
            </label>
          </div>
        </div>
      `;
    }

    if (state.activeTab === 'settings') {
      const isCustom = localStorage.getItem(STORAGE_API_URL);
      return `
        <div class="cloud-settings-card">
          <h4 style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 6px;">⚙️ Cloudflare Worker & Backend Settings</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
            Cloud Sync runs on a lightweight Cloudflare Worker with KV storage (100% free forever up to 100,000 requests/day).
          </p>

          <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;">
            <label for="cloud-api-url-input" style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px;">
              Cloudflare Worker REST Endpoint URL:
            </label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="cloud-api-url-input" class="cloud-code-input-field" style="font-family: monospace; font-size: 0.85rem; text-align: left;" value="${state.apiUrl}" placeholder="https://<your-worker>.workers.dev/api/sync">
              <button class="btn-test secondary" onclick="window.JAM_CLOUD_SYNC.saveApiUrlInput()">Save</button>
              ${isCustom ? '<button class="btn-test secondary" onclick="window.JAM_CLOUD_SYNC.resetApiUrl()">Reset</button>' : ''}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
              Default: <code>${DEFAULT_API_URL}</code>
            </div>
          </div>

          <div style="background: rgba(129, 140, 248, 0.06); border: 1px solid var(--accent-dim); border-radius: var(--radius-sm); padding: 12px 14px; font-size: 0.82rem; color: var(--text-secondary);">
            <strong style="color: var(--accent);">🚀 Self-Hosting Your Own Worker:</strong>
            <p style="margin: 4px 0 0 0;">
              The worker code is located inside the repository at <code>academic/JAM/cloudflare-worker/worker.js</code>. You can deploy it to Cloudflare in under 2 minutes with 0 credit cards required!
            </p>
          </div>
        </div>
      `;
    }

    return '';
  }

  function updateUI() {
    updateHeaderButtonUI();
    const modal = document.getElementById('cloud-sync-modal');
    if (modal && !modal.classList.contains('hidden')) {
      renderModalContent();
    }
  }

  function openModal() {
    const modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;
    renderModalContent();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('cloud-sync-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    renderModalContent();
  }

  function submitLinkCode() {
    const input = document.getElementById('cloud-code-input');
    const mergeRadio = document.querySelector('input[name="cloud-merge-choice"]:checked');
    const mergeMode = mergeRadio ? mergeRadio.value : 'merge';
    if (input) {
      linkWithCode(input.value, mergeMode, false);
    }
  }

  function copyCode(code) {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      showToast(`✓ Copied Sync Code "${code}" to clipboard!`);
    }).catch(() => {
      showToast(`Code: ${code}`);
    });
  }

  function copyLink(link) {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      showToast('✓ 1-Click Sync Link copied to clipboard!');
    }).catch(() => {
      prompt('Copy your 1-Click Sync Link:', link);
    });
  }

  function shareLink(link) {
    if (navigator.share) {
      navigator.share({
        title: 'IIT JAM Mathematics — PYQ Solving Progress',
        text: `Sync your IIT JAM PYQ solving progress with Sync Code: ${state.syncCode}`,
        url: link
      }).catch(() => {});
    } else {
      copyLink(link);
    }
  }

  function saveApiUrlInput() {
    const input = document.getElementById('cloud-api-url-input');
    if (input) {
      setApiUrl(input.value);
    }
  }

  function resetApiUrl() {
    setApiUrl('');
  }

  // ==========================================================================
  // Public Interface & Initialization
  // ==========================================================================

  window.JAM_CLOUD_SYNC = {
    init: function() {
      // 1. Check if URL has ?sync=JAM-XXX-XXX or #sync=JAM-XXX-XXX
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let paramCode = urlParams.get('sync');
        if (!paramCode && window.location.hash.startsWith('#sync=')) {
          paramCode = window.location.hash.slice(6);
        }

        if (paramCode) {
          console.log('[Cloud Sync] Detected sync param in URL:', paramCode);
          const clean = normalizeCode(paramCode);
          if (clean) {
            // Automatically link with smart merge
            setTimeout(() => {
              linkWithCode(clean, 'merge', true);
            }, 300);

            // Clean up the URL quietly without reloading page
            const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]sync=[^&]*/, '').replace(/^&/, '?');
            window.history.replaceState({}, document.title, cleanUrl || window.location.pathname);
          }
        }
      } catch (err) {}

      updateUI();

      // Keyboard shortcut: Escape to close modal
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('cloud-sync-modal');
          if (modal && !modal.classList.contains('hidden')) {
            closeModal();
          }
        }
      });
    },

    openModal: openModal,
    closeModal: closeModal,
    switchTab: switchTab,
    submitLinkCode: submitLinkCode,
    copyCode: copyCode,
    copyLink: copyLink,
    shareLink: shareLink,
    saveApiUrlInput: saveApiUrlInput,
    resetApiUrl: resetApiUrl,
    toggleAutoSync: toggleAutoSync,
    createNewCode: createNewCode,
    pullFromCloud: pullFromCloud,
    syncNow: () => performSync(true),
    triggerAutoSync: triggerAutoSync,
    unlinkDevice: unlinkDevice,
    linkWithCode: linkWithCode,
    isLinked: () => !!state.syncCode,
    getSyncCode: () => state.syncCode,
    getSyncStatus: () => state.syncStatus
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.JAM_CLOUD_SYNC.init());
  } else {
    window.JAM_CLOUD_SYNC.init();
  }

})();

