/**
 * Vaibhav Priyadarshi — All-in-One Website Cloud Login & Cross-Device Sync Engine
 * Unified zero-password 6-character pass across the entire website:
 *   - Home, Academic Hub, Art, Contact
 *   - IIT JAM Mathematics (MA): 885 PYQs Tracker + Mock Test Scores
 *   - UNPG B.Sc. Semester V: 750 PYQs Tracker + Difficulty Tags + CBT Mock Scores
 *   - Site-wide Theme & Preferences
 *
 * 100% Backwards-Compatible:
 *   - Automatically migrates existing `jam_cloud_sync_code` (e.g. JAM-JHT-WRW)
 *     and `sem_cloud_sync_code` without deleting any progress.
 *   - Reads legacy JAM v1.2 and UNPG v2 cloud payloads seamlessly and upgrades
 *     them via conflict-free Smart Merge.
 */

(function () {
  'use strict';

  if (window.VAIBHAV_CLOUD_SYNC && window.VAIBHAV_CLOUD_SYNC.__initialized) {
    return;
  }

  // Unified Storage Keys
  const KEYS = {
    SYNC_CODE: 'site_cloud_sync_code',
    API_URL: 'site_cloud_sync_api_url',
    LAST_SYNC: 'site_cloud_sync_last_time',
    AUTO_SYNC: 'site_cloud_sync_auto_enabled',
    LOCAL_SIM_DB: 'site_cloud_sync_sim_db',
    // Legacy & Portal Data Keys
    LEGACY_JAM_CODE: 'jam_cloud_sync_code',
    LEGACY_JAM_API: 'jam_cloud_sync_api_url',
    LEGACY_JAM_LAST: 'jam_cloud_sync_last_time',
    LEGACY_JAM_AUTO: 'jam_cloud_sync_auto_enabled',
    LEGACY_SEM_CODE: 'sem_cloud_sync_code',
    LEGACY_SEM_API: 'sem_cloud_sync_api_url',
    LEGACY_SEM_LAST: 'sem_cloud_sync_last_time',
    LEGACY_SEM_AUTO: 'sem_cloud_sync_auto_enabled',
    JAM_TRACKER: 'jam_pyq_user_tracker_v1',
    JAM_SCORE_PREFIX: 'jam_score_',
    SEM_TRACKER: 'sem_pyq_user_tracker_v1',
    SEM_SCORE_PREFIX: 'sem_score_',
    THEME: 'jam_theme'
  };

  const DEFAULT_API_URL =
    window.VAIBHAV_CLOUD_SYNC_API_URL ||
    window.JAM_CLOUD_SYNC_API_URL ||
    'https://jam-cloud-sync.vaibhav27182.workers.dev/api/sync';

  const SYNC_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  // Cross-tab broadcast channel
  let broadcast = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcast = new BroadcastChannel('vaibhav_unified_sync_channel');
    }
  } catch (e) {}

  // ==========================================================================
  // One-time Seamless Migration (Preserves existing JAM & UNPG login codes)
  // ==========================================================================
  function migrateLegacyKeys() {
    try {
      let unifiedCode = localStorage.getItem(KEYS.SYNC_CODE);
      if (!unifiedCode) {
        const jamCode = localStorage.getItem(KEYS.LEGACY_JAM_CODE);
        const semCode = localStorage.getItem(KEYS.LEGACY_SEM_CODE);
        unifiedCode = jamCode || semCode || null;
        if (unifiedCode) {
          localStorage.setItem(KEYS.SYNC_CODE, unifiedCode);
        }
      }

      if (unifiedCode) {
        localStorage.setItem(KEYS.LEGACY_JAM_CODE, unifiedCode);
        localStorage.setItem(KEYS.LEGACY_SEM_CODE, unifiedCode);
      }

      let apiUrl = localStorage.getItem(KEYS.API_URL);
      if (!apiUrl) {
        const jamApi = localStorage.getItem(KEYS.LEGACY_JAM_API);
        const semApi = localStorage.getItem(KEYS.LEGACY_SEM_API);
        apiUrl = jamApi || semApi || '';
        if (apiUrl && !apiUrl.includes('vaibhavgeometer.workers.dev')) {
          localStorage.setItem(KEYS.API_URL, apiUrl);
        }
      }
      if (apiUrl && apiUrl.includes('vaibhavgeometer.workers.dev')) {
        localStorage.removeItem(KEYS.API_URL);
        localStorage.removeItem(KEYS.LEGACY_JAM_API);
      }

      if (!localStorage.getItem(KEYS.LAST_SYNC)) {
        const last = localStorage.getItem(KEYS.LEGACY_JAM_LAST) || localStorage.getItem(KEYS.LEGACY_SEM_LAST);
        if (last) localStorage.setItem(KEYS.LAST_SYNC, last);
      }
    } catch (e) {}
  }

  migrateLegacyKeys();

  const state = {
    syncCode: localStorage.getItem(KEYS.SYNC_CODE) || null,
    apiUrl: localStorage.getItem(KEYS.API_URL) || DEFAULT_API_URL,
    lastSyncTime: localStorage.getItem(KEYS.LAST_SYNC) || null,
    autoSyncEnabled: localStorage.getItem(KEYS.AUTO_SYNC) !== 'false',
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
    statusMessage: '',
    debounceTimer: null,
    isApplyingRemote: false,
    activeTab: 'my-code' // 'my-code' | 'link-device' | 'settings'
  };

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  function generateRandomCode() {
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 3; i++) {
      p1 += SYNC_CHARS.charAt(Math.floor(Math.random() * SYNC_CHARS.length));
      p2 += SYNC_CHARS.charAt(Math.floor(Math.random() * SYNC_CHARS.length));
    }
    return `VP-${p1}-${p2}`;
  }

  function normalizeCode(raw) {
    if (!raw) return '';
    const cleaned = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 4 || cleaned.length > 24) return '';

    // Preserve known prefixes JAM-, SEM-, VP-
    for (const prefix of ['JAM', 'SEM', 'VP']) {
      if (cleaned.startsWith(prefix) && cleaned.length === prefix.length + 6) {
        const body = cleaned.slice(prefix.length);
        return `${prefix}-${body.slice(0, 3)}-${body.slice(3, 6)}`;
      }
    }
    if (cleaned.length === 6) {
      return `VP-${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
    }
    return cleaned;
  }

  function getCleanCodeKey(code) {
    const c = code || state.syncCode;
    return c ? String(c).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  }

  function getShareableUrl(code) {
    const c = code || state.syncCode;
    const base = window.location.origin + window.location.pathname;
    if (!c) return base;
    return `${base}?sync=${encodeURIComponent(c)}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Recently';
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
      return;
    }
    if (window.SEM_TRACKER && typeof window.SEM_TRACKER.showToast === 'function') {
      window.SEM_TRACKER.showToast(msg);
      return;
    }

    let toast = document.getElementById('vaibhav-sync-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vaibhav-sync-toast';
      toast.className = 'vp-sync-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3200);
  }

  // ==========================================================================
  // Unified Payload Collector, Normalizer & Conflict-Free Smart Merge
  // ==========================================================================

  function collectPrefixedScores(prefix, parseJson) {
    const scores = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const id = k.slice(prefix.length);
          const raw = localStorage.getItem(k);
          if (raw !== null && raw !== '') {
            if (parseJson) {
              try {
                scores[id] = JSON.parse(raw);
              } catch (e) {
                const n = Number(raw);
                if (!isNaN(n)) scores[id] = n;
              }
            } else {
              scores[id] = raw;
            }
          }
        }
      }
    } catch (e) {}
    return scores;
  }

  function getLocalUnifiedPayload() {
    // 1. JAM Tracker
    let jamTracker = { questions: {}, oosMarkedUnnecessary: false, lastUpdated: null };
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function') {
      const ud = window.JAM_TRACKER.getUserData();
      if (ud && typeof ud === 'object') {
        jamTracker = {
          questions: ud.questions || {},
          oosMarkedUnnecessary: !!ud.oosMarkedUnnecessary,
          lastUpdated: ud.lastUpdated || null
        };
      }
    } else {
      try {
        const raw = localStorage.getItem(KEYS.JAM_TRACKER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            jamTracker = {
              questions: parsed.questions || {},
              oosMarkedUnnecessary: !!parsed.oosMarkedUnnecessary,
              lastUpdated: parsed.lastUpdated || null
            };
          }
        }
      } catch (e) {}
    }

    // 2. JAM Mock Scores
    const jamScores = collectPrefixedScores(KEYS.JAM_SCORE_PREFIX, false);

    // 3. UNPG Tracker
    let unpgTracker = { solved: {}, difficulty: {}, lastUpdated: null };
    try {
      const raw = localStorage.getItem(KEYS.SEM_TRACKER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          unpgTracker = {
            solved: parsed.solved || {},
            difficulty: parsed.difficulty || {},
            lastUpdated: parsed.lastUpdated || null
          };
        }
      }
    } catch (e) {}

    // 4. UNPG Mock Scores
    const unpgScores = collectPrefixedScores(KEYS.SEM_SCORE_PREFIX, true);

    return {
      app: 'VAIBHAV_PORTAL_UNIFIED_SYNC',
      version: '3.0',
      syncCode: state.syncCode,
      updatedAt: new Date().toISOString(),
      jam: {
        tracker: jamTracker,
        scores: jamScores
      },
      unpg: {
        tracker: unpgTracker,
        scores: unpgScores
      },
      preferences: {
        theme: localStorage.getItem(KEYS.THEME) || 'dark'
      }
    };
  }

  // Normalizes v3 unified, legacy JAM v1.2, and legacy UNPG v2 cloud payloads
  function normalizeCloudPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // Unwrap if wrapped in { code, data } (legacy UNPG POST format)
    let src = raw;
    if (raw.data && typeof raw.data === 'object' && (raw.data.portal === 'UNPG_SEM_5' || raw.data.tracker || raw.data.jam || raw.data.questions)) {
      src = raw.data;
    }

    // Case A: Already Unified v3
    if (src.app === 'VAIBHAV_PORTAL_UNIFIED_SYNC' || src.jam || src.unpg) {
      return {
        app: 'VAIBHAV_PORTAL_UNIFIED_SYNC',
        version: '3.0',
        syncCode: src.syncCode || state.syncCode,
        updatedAt: src.updatedAt || src.serverSyncedAt || new Date().toISOString(),
        jam: {
          tracker: {
            questions: (src.jam && src.jam.tracker && src.jam.tracker.questions) || {},
            oosMarkedUnnecessary: !!(src.jam && src.jam.tracker && src.jam.tracker.oosMarkedUnnecessary),
            lastUpdated: (src.jam && src.jam.tracker && src.jam.tracker.lastUpdated) || null
          },
          scores: (src.jam && src.jam.scores) || {}
        },
        unpg: {
          tracker: {
            solved: (src.unpg && src.unpg.tracker && src.unpg.tracker.solved) || {},
            difficulty: (src.unpg && src.unpg.tracker && src.unpg.tracker.difficulty) || {},
            lastUpdated: (src.unpg && src.unpg.tracker && src.unpg.tracker.lastUpdated) || null
          },
          scores: (src.unpg && src.unpg.scores) || {}
        },
        preferences: {
          theme: (src.preferences && src.preferences.theme) || null
        }
      };
    }

    // Case B: Legacy JAM v1.2 payload
    if (src.questions && typeof src.questions === 'object') {
      return {
        app: 'VAIBHAV_PORTAL_UNIFIED_SYNC',
        version: '3.0',
        syncCode: src.syncCode || state.syncCode,
        updatedAt: src.lastUpdated || src.serverSyncedAt || new Date().toISOString(),
        jam: {
          tracker: {
            questions: src.questions || {},
            oosMarkedUnnecessary: !!src.oosMarkedUnnecessary,
            lastUpdated: src.lastUpdated || null
          },
          scores: {}
        },
        unpg: {
          tracker: { solved: {}, difficulty: {}, lastUpdated: null },
          scores: {}
        },
        preferences: { theme: null }
      };
    }

    // Case C: Legacy UNPG v2 payload
    if (src.portal === 'UNPG_SEM_5' || (src.tracker && typeof src.tracker === 'object')) {
      return {
        app: 'VAIBHAV_PORTAL_UNIFIED_SYNC',
        version: '3.0',
        syncCode: src.syncCode || state.syncCode,
        updatedAt: src.updatedAt || src.serverSyncedAt || new Date().toISOString(),
        jam: {
          tracker: { questions: {}, oosMarkedUnnecessary: false, lastUpdated: null },
          scores: {}
        },
        unpg: {
          tracker: {
            solved: (src.tracker && src.tracker.solved) || {},
            difficulty: (src.tracker && src.tracker.difficulty) || {},
            lastUpdated: (src.tracker && src.tracker.lastUpdated) || null
          },
          scores: src.scores || {}
        },
        preferences: { theme: null }
      };
    }

    return null;
  }

  function mergeJamTrackers(localT, cloudT) {
    const lQMap = (localT && localT.questions) || {};
    const cQMap = (cloudT && cloudT.questions) || {};
    const mergedQ = { ...lQMap };

    Object.entries(cQMap).forEach(([qId, cQ]) => {
      if (!cQ || typeof cQ !== 'object') return;
      const lQ = mergedQ[qId];
      if (!lQ) {
        mergedQ[qId] = { ...cQ };
      } else {
        const isSolved = !!(lQ.solved || cQ.solved);
        let solvedAt = null;
        if (lQ.solved && cQ.solved) {
          if (lQ.solvedAt && cQ.solvedAt) {
            const dL = new Date(lQ.solvedAt).getTime();
            const dC = new Date(cQ.solvedAt).getTime();
            if (!isNaN(dL) && !isNaN(dC)) {
              solvedAt = dL < dC ? lQ.solvedAt : cQ.solvedAt;
            } else {
              solvedAt = !isNaN(dL) ? lQ.solvedAt : (!isNaN(dC) ? cQ.solvedAt : null);
            }
          } else {
            solvedAt = lQ.solvedAt || cQ.solvedAt || null;
          }
        } else {
          solvedAt = (lQ.solved ? lQ.solvedAt : cQ.solvedAt) || null;
        }

        mergedQ[qId] = {
          solved: isSolved,
          solvedAt: solvedAt,
          difficulty: lQ.difficulty || cQ.difficulty || null,
          unnecessary: !!(lQ.unnecessary || cQ.unnecessary)
        };
      }
    });

    return {
      questions: mergedQ,
      oosMarkedUnnecessary: !!(localT?.oosMarkedUnnecessary || cloudT?.oosMarkedUnnecessary),
      lastUpdated: new Date().toISOString()
    };
  }

  function mergeUnpgTrackers(localT, cloudT) {
    const mergedSolved = { ...((cloudT && cloudT.solved) || {}) };
    const localSolved = (localT && localT.solved) || {};

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

    const mergedDiff = {
      ...((cloudT && cloudT.difficulty) || {}),
      ...((localT && localT.difficulty) || {})
    };

    return {
      solved: mergedSolved,
      difficulty: mergedDiff,
      lastUpdated: new Date().toISOString()
    };
  }

  function mergeUnifiedPayloads(localData, cloudData) {
    if (!cloudData) return localData;

    // JAM Scores: keep highest numeric score
    const mergedJamScores = { ...(cloudData.jam?.scores || {}) };
    Object.entries(localData.jam?.scores || {}).forEach(([id, lVal]) => {
      const cVal = mergedJamScores[id];
      if (cVal === undefined || Number(lVal) > Number(cVal)) {
        mergedJamScores[id] = lVal;
      }
    });

    // UNPG Scores: keep highest percentage
    const mergedUnpgScores = { ...(cloudData.unpg?.scores || {}) };
    Object.entries(localData.unpg?.scores || {}).forEach(([id, lScore]) => {
      const cScore = mergedUnpgScores[id];
      if (!cScore || (lScore && Number(lScore.percentage) > Number(cScore.percentage))) {
        mergedUnpgScores[id] = lScore;
      }
    });

    return {
      app: 'VAIBHAV_PORTAL_UNIFIED_SYNC',
      version: '3.0',
      syncCode: state.syncCode,
      updatedAt: new Date().toISOString(),
      jam: {
        tracker: mergeJamTrackers(localData.jam?.tracker, cloudData.jam?.tracker),
        scores: mergedJamScores
      },
      unpg: {
        tracker: mergeUnpgTrackers(localData.unpg?.tracker, cloudData.unpg?.tracker),
        scores: mergedUnpgScores
      },
      preferences: {
        theme: localData.preferences?.theme || cloudData.preferences?.theme || 'dark'
      }
    };
  }

  function applyUnifiedPayloadLocally(payload, silent = false) {
    if (!payload || typeof payload !== 'object') return;

    state.isApplyingRemote = true;
    try {
      // 1. Apply JAM Tracker
      if (payload.jam && payload.jam.tracker) {
        const jt = payload.jam.tracker;
        const jamPayload = {
          questions: jt.questions || {},
          oosMarkedUnnecessary: !!jt.oosMarkedUnnecessary,
          lastUpdated: jt.lastUpdated || new Date().toISOString()
        };
        if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
          window.JAM_TRACKER.loadUserDataFromBackup(jamPayload, { silent: !!silent, skipSync: true });
        } else {
          try {
            localStorage.setItem(KEYS.JAM_TRACKER, JSON.stringify(jamPayload));
          } catch (e) {}
        }
      }

    // 2. Apply JAM Mock Scores
    if (payload.jam && payload.jam.scores) {
      Object.entries(payload.jam.scores).forEach(([id, val]) => {
        try {
          localStorage.setItem(KEYS.JAM_SCORE_PREFIX + id, String(val));
        } catch (e) {}
      });
    }

    // 3. Apply UNPG Tracker
    if (payload.unpg && payload.unpg.tracker) {
      try {
        localStorage.setItem(KEYS.SEM_TRACKER, JSON.stringify({
          solved: payload.unpg.tracker.solved || {},
          difficulty: payload.unpg.tracker.difficulty || {},
          lastUpdated: payload.unpg.tracker.lastUpdated || new Date().toISOString()
        }));
      } catch (e) {}
    }

    // 4. Apply UNPG Mock Scores
    if (payload.unpg && payload.unpg.scores) {
      Object.entries(payload.unpg.scores).forEach(([id, sObj]) => {
        try {
          localStorage.setItem(KEYS.SEM_SCORE_PREFIX + id, JSON.stringify(sObj));
        } catch (e) {}
      });
    }

    // 5. Refresh active portal UIs if present
    try {
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
    } catch (e) {}
    } finally {
      state.isApplyingRemote = false;
    }
  }

  // ==========================================================================
  // Network REST API Client (Cloudflare Worker KV + Local Sim Fallback)
  // ==========================================================================

  function saveToLocalSimDb(codeKey, payload) {
    try {
      const raw = localStorage.getItem(KEYS.LOCAL_SIM_DB);
      const db = raw ? JSON.parse(raw) : {};
      db[codeKey] = { data: payload, savedAt: new Date().toISOString() };
      localStorage.setItem(KEYS.LOCAL_SIM_DB, JSON.stringify(db));
    } catch (e) {}
  }

  function getFromLocalSimDb(codeKey) {
    try {
      const raw = localStorage.getItem(KEYS.LOCAL_SIM_DB);
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
    const endpoint = `${apiUrl}/${encodeURIComponent(rawCode)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);

      if (resp.status === 404) {
        return { found: false, data: null };
      }
      if (!resp.ok) {
        throw new Error(`Cloud API responded with status ${resp.status}`);
      }
      const json = await resp.json();
      const normalized = normalizeCloudPayload(json);
      return { found: !!normalized, data: normalized };
    } catch (err) {
      const fallback = getFromLocalSimDb(rawCode);
      if (fallback) {
        return { found: true, data: normalizeCloudPayload(fallback), isLocalFallback: true };
      }
      throw err;
    }
  }

  async function apiPushCloudData(code, payload) {
    const rawCode = getCleanCodeKey(code);
    const apiUrl = state.apiUrl.replace(/\/+$/, '');
    const endpoint = `${apiUrl}/${encodeURIComponent(rawCode)}`;

    saveToLocalSimDb(rawCode, payload);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Cloud API push error (${resp.status}): ${errText}`);
      }
      return await resp.json();
    } catch (err) {
      return { success: true, isLocalFallback: true, error: err.message };
    }
  }

  // ==========================================================================
  // Core Sync Controller
  // ==========================================================================

  function setStoredSyncCode(code) {
    state.syncCode = code || null;
    if (code) {
      localStorage.setItem(KEYS.SYNC_CODE, code);
      localStorage.setItem(KEYS.LEGACY_JAM_CODE, code);
      localStorage.setItem(KEYS.LEGACY_SEM_CODE, code);
    } else {
      localStorage.removeItem(KEYS.SYNC_CODE);
      localStorage.removeItem(KEYS.LEGACY_JAM_CODE);
      localStorage.removeItem(KEYS.LEGACY_SEM_CODE);
    }
  }

  // Safe bi-directional sync: always fetches & merges before pushing so no progress is ever lost
  async function performSync(isManual = false, mode = 'merge') {
    if (!state.syncCode) return false;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing across portals...';
    updateUI();

    try {
      const localPayload = getLocalUnifiedPayload();
      let finalPayload = localPayload;

      if (mode === 'merge') {
        try {
          const remote = await apiFetchCloudData(state.syncCode);
          if (remote.found && remote.data) {
            finalPayload = mergeUnifiedPayloads(localPayload, remote.data);
            applyUnifiedPayloadLocally(finalPayload, true);
          }
        } catch (fetchErr) {
          // Offline or worker unreachable: still save locally
        }
      }

      const result = await apiPushCloudData(state.syncCode, finalPayload);

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(KEYS.LAST_SYNC, state.lastSyncTime);
      localStorage.setItem(KEYS.LEGACY_JAM_LAST, state.lastSyncTime);
      localStorage.setItem(KEYS.LEGACY_SEM_LAST, state.lastSyncTime);

      state.syncStatus = result.isLocalFallback ? 'offline' : 'synced';
      state.statusMessage = result.isLocalFallback
        ? 'Saved locally (Worker unreachable)'
        : `Synced (${formatRelativeTime(state.lastSyncTime)})`;
      updateUI();

      if (broadcast) {
        try {
          broadcast.postMessage({
            type: 'UNIFIED_SYNC_UPDATE',
            syncCode: state.syncCode,
            payload: finalPayload
          });
        } catch (e) {}
      }

      if (isManual) {
        if (result.isLocalFallback) {
          showToast(`✓ Saved locally for ${state.syncCode} (Cloudflare Worker offline)`);
        } else {
          showToast(`✓ All-in-One Cloud Sync complete! Pass: ${state.syncCode}`);
        }
      }
      return !result.isLocalFallback;
    } catch (err) {
      state.syncStatus = 'error';
      state.statusMessage = 'Sync error: ' + err.message;
      updateUI();
      if (isManual) showToast('Sync error: ' + err.message);
      return false;
    }
  }

  function triggerAutoSync() {
    if (!state.syncCode || !state.autoSyncEnabled || state.isApplyingRemote) return;
    state.syncStatus = 'syncing';
    updateNavButtonsUI();

    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      performSync(false, 'merge');
    }, 550);
  }

  async function linkWithCode(inputCode, mergeMode = 'merge', isAutoFromUrl = false) {
    const code = normalizeCode(inputCode);
    if (!code) {
      showToast('Please enter a valid 6-character Sync Code (e.g. JAM-JHT-WRW or VP-842-195).');
      return;
    }

    state.syncStatus = 'syncing';
    state.statusMessage = `Connecting to ${code}...`;
    updateUI();

    try {
      const res = await apiFetchCloudData(code);
      setStoredSyncCode(code);

      if (res.found && res.data) {
        const localData = getLocalUnifiedPayload();
        const finalData = mergeMode === 'merge' ? mergeUnifiedPayloads(localData, res.data) : res.data;
        applyUnifiedPayloadLocally(finalData);
        await apiPushCloudData(code, finalData);
      } else {
        const localData = getLocalUnifiedPayload();
        await apiPushCloudData(code, localData);
      }

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(KEYS.LAST_SYNC, state.lastSyncTime);
      state.syncStatus = 'synced';
      state.statusMessage = `Connected: ${code}`;
      state.activeTab = 'my-code';
      updateUI();

      showToast(`✓ Logged in across whole website with Pass: ${code}`);
      if (!isAutoFromUrl) closeModal();
    } catch (err) {
      setStoredSyncCode(code);
      state.syncStatus = 'offline';
      state.statusMessage = `Linked locally: ${code}`;
      state.activeTab = 'my-code';
      updateUI();
      showToast(`✓ Linked to ${code} (Local mode)`);
      if (!isAutoFromUrl) closeModal();
    }
  }

  async function createNewCode() {
    const newCode = generateRandomCode();
    setStoredSyncCode(newCode);
    state.activeTab = 'my-code';
    await performSync(false, 'push');
    showToast(`✓ New All-in-One Sync Pass created: ${newCode}`);
  }

  async function pullFromCloud() {
    if (!state.syncCode) return;
    state.syncStatus = 'syncing';
    updateUI();

    try {
      const res = await apiFetchCloudData(state.syncCode);
      if (res.found && res.data) {
        const localData = getLocalUnifiedPayload();
        const merged = mergeUnifiedPayloads(localData, res.data);
        applyUnifiedPayloadLocally(merged);
        state.lastSyncTime = new Date().toISOString();
        localStorage.setItem(KEYS.LAST_SYNC, state.lastSyncTime);
        state.syncStatus = 'synced';
        updateUI();
        showToast('✓ Latest progress pulled & merged from cloud!');
      } else {
        state.syncStatus = 'idle';
        updateUI();
        showToast(`No cloud backup found yet for ${state.syncCode}. Click "Sync Now" to upload.`);
      }
    } catch (err) {
      state.syncStatus = 'error';
      updateUI();
      showToast('Could not reach cloud server.');
    }
  }

  function unlinkDevice() {
    const ok = confirm(
      `Log out / unlink "${state.syncCode}" from this browser?\n\n` +
        '• Your cloud progress will NOT be deleted.\n' +
        '• Your local JAM & UNPG progress on this device will remain saved.\n' +
        '• Auto-sync will pause until you log in again.'
    );
    if (!ok) return;

    setStoredSyncCode(null);
    localStorage.removeItem(KEYS.LAST_SYNC);
    state.lastSyncTime = null;
    state.syncStatus = 'idle';
    state.statusMessage = 'Logged out';
    updateUI();
    showToast('Logged out of Cloud Sync. Local progress preserved.');
  }

  function toggleAutoSync(enabled) {
    state.autoSyncEnabled = !!enabled;
    localStorage.setItem(KEYS.AUTO_SYNC, String(state.autoSyncEnabled));
    updateUI();
    showToast(state.autoSyncEnabled ? 'Real-time auto-sync enabled' : 'Auto-sync paused');
  }

  function setApiUrl(newUrl) {
    const val = (newUrl || '').trim();
    state.apiUrl = val || DEFAULT_API_URL;
    if (val) {
      localStorage.setItem(KEYS.API_URL, val);
      showToast('Custom Cloudflare Worker URL saved.');
    } else {
      localStorage.removeItem(KEYS.API_URL);
      showToast('Reset to default Cloudflare Worker URL.');
    }
    updateUI();
  }

  // ==========================================================================
  // Cross-Tab Multi-Window Listener
  // ==========================================================================
  if (broadcast) {
    broadcast.onmessage = (e) => {
      if (e.data && e.data.type === 'UNIFIED_SYNC_UPDATE' && e.data.syncCode === state.syncCode && e.data.payload) {
        try {
          applyUnifiedPayloadLocally(e.data.payload, true);
          state.lastSyncTime = new Date().toISOString();
          state.syncStatus = 'synced';
          updateNavButtonsUI();
        } catch (err) {}
      }
    };
  }

  // ==========================================================================
  // Scoped Styles & Auto-Injected Header Button / Modal
  // ==========================================================================

  function injectStyles() {
    if (document.getElementById('vaibhav-unified-sync-styles')) return;
    const style = document.createElement('style');
    style.id = 'vaibhav-unified-sync-styles';
    style.textContent = `
      .vp-nav-sync-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 9999px;
        border: 1px solid rgba(129, 140, 248, 0.35);
        background: rgba(129, 140, 248, 0.12);
        color: #c7d2fe;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .vp-nav-sync-btn:hover {
        background: rgba(129, 140, 248, 0.24);
        border-color: rgba(129, 140, 248, 0.65);
        transform: translateY(-1px);
      }
      .vp-nav-sync-btn.linked {
        border-color: rgba(52, 211, 153, 0.45);
        background: rgba(16, 185, 129, 0.12);
        color: #6ee7b7;
      }
      [data-theme="light"] .vp-nav-sync-btn {
        color: #4338ca;
        background: rgba(99, 102, 241, 0.1);
        border-color: rgba(99, 102, 241, 0.3);
      }
      [data-theme="light"] .vp-nav-sync-btn.linked {
        color: #047857;
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.4);
      }
      .vp-sync-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #94a3b8;
        display: inline-block;
      }
      .vp-sync-dot.synced { background: #34d399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.7); }
      .vp-sync-dot.syncing { background: #fbbf24; animation: vpPulse 1s infinite; }
      .vp-sync-dot.error, .vp-sync-dot.offline { background: #f87171; }
      @keyframes vpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

      .vp-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(5, 8, 18, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .vp-modal-backdrop.hidden { display: none !important; }
      .vp-modal-card {
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        background: #111827;
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.75);
        overflow: hidden;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      [data-theme="light"] .vp-modal-card {
        background: #ffffff;
        color: #0f172a;
        border-color: rgba(15, 23, 42, 0.12);
      }
      .vp-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      [data-theme="light"] .vp-modal-header { border-bottom-color: rgba(15, 23, 42, 0.08); }
      .vp-modal-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 1.05rem;
      }
      .vp-modal-close {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: inherit;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
      }
      .vp-modal-tabs {
        display: flex;
        gap: 6px;
        padding: 10px 20px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      [data-theme="light"] .vp-modal-tabs { border-bottom-color: rgba(15, 23, 42, 0.08); }
      .vp-tab-btn {
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: #94a3b8;
        padding: 8px 12px;
        font-size: 0.86rem;
        font-weight: 600;
        cursor: pointer;
      }
      .vp-tab-btn.active {
        color: #818cf8;
        border-bottom-color: #818cf8;
      }
      .vp-modal-body {
        padding: 18px 20px;
        overflow-y: auto;
        flex: 1;
      }
      .vp-modal-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.78rem;
        color: #94a3b8;
      }
      [data-theme="light"] .vp-modal-footer { border-top-color: rgba(15, 23, 42, 0.08); }
      .vp-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 14px;
      }
      [data-theme="light"] .vp-card {
        background: #f8fafc;
        border-color: rgba(15, 23, 42, 0.1);
      }
      .vp-code-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(129, 140, 248, 0.35);
        border-radius: 12px;
        padding: 12px 16px;
        margin: 12px 0;
      }
      [data-theme="light"] .vp-code-box { background: #eef2ff; }
      .vp-code-val {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: 0.16em;
      }
      .vp-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
      }
      .vp-btn:hover { background: rgba(255, 255, 255, 0.12); }
      .vp-btn.primary {
        background: linear-gradient(135deg, #6366f1, #38bdf8);
        border-color: transparent;
        color: #ffffff;
      }
      .vp-btn.danger {
        color: #fca5a5;
        border-color: rgba(239, 68, 68, 0.35);
        background: rgba(239, 68, 68, 0.1);
      }
      [data-theme="light"] .vp-btn { border-color: rgba(15, 23, 42, 0.15); background: #f1f5f9; }
      [data-theme="light"] .vp-btn.primary { background: linear-gradient(135deg, #4f46e5, #0284c7); color: #fff; }
      [data-theme="light"] .vp-btn.danger { color: #dc2626; background: #fef2f2; }
      .vp-portal-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 10px;
        margin: 12px 0;
      }
      .vp-stat-pill {
        background: rgba(56, 189, 248, 0.07);
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 0.8rem;
      }
      .vp-qr-row {
        display: flex;
        gap: 14px;
        align-items: center;
        flex-wrap: wrap;
        margin: 12px 0;
        padding: 12px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      [data-theme="light"] .vp-qr-row { background: #f8fafc; border-color: rgba(15, 23, 42, 0.08); }
      .vp-qr-img { width: 108px; height: 108px; border-radius: 10px; }
      .vp-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .vp-input {
        width: 100%;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(15, 23, 42, 0.7);
        color: inherit;
        font-family: ui-monospace, monospace;
        font-size: 1rem;
        letter-spacing: 0.08em;
      }
      [data-theme="light"] .vp-input { background: #ffffff; border-color: rgba(15, 23, 42, 0.2); }
      .vp-sync-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10001;
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid rgba(129, 140, 248, 0.4);
        padding: 11px 16px;
        border-radius: 12px;
        font-size: 0.88rem;
        font-weight: 500;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: all 0.22s ease;
      }
      .vp-sync-toast.visible { opacity: 1; transform: translateY(0); }
    `;
    document.head.appendChild(style);
  }

  function ensureModalElement() {
    let modal = document.getElementById('vaibhav-unified-sync-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'vaibhav-unified-sync-modal';
      modal.className = 'vp-modal-backdrop hidden';
      modal.onclick = (e) => {
        if (e.target === modal) closeModal();
      };
      document.body.appendChild(modal);
    }
    return modal;
  }

  function injectNavbarButtonIfMissing() {
    if (document.getElementById('vp-global-sync-btn')) return;

    // Do not inject into CBT timed exam test pages to keep test UI distraction-free
    if (document.querySelector('.exam-navbar')) return;

    const btn = document.createElement('button');
    btn.id = 'vp-global-sync-btn';
    btn.type = 'button';
    btn.className = 'vp-nav-sync-btn';
    btn.onclick = () => openModal();
    btn.innerHTML = `<span>☁️</span><span id="vp-global-sync-label">Login / Sync</span><span id="vp-global-sync-dot" class="vp-sync-dot"></span>`;

    // Target 1: Portfolio / Academic / Art / Contact (.nav-controls)
    const navControls = document.querySelector('.nav-controls');
    if (navControls) {
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) navControls.insertBefore(btn, themeBtn);
      else navControls.appendChild(btn);
      return;
    }

    // Target 2: JAM / UNPG / Analytics (.nav-actions)
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
      const themeBtn = document.getElementById('theme-btn') || navActions.querySelector('.theme-toggle');
      if (themeBtn) navActions.insertBefore(btn, themeBtn);
      else navActions.appendChild(btn);
      return;
    }

    // Target 3: Countdown (.top-nav .nav-inner)
    const countdownNav = document.querySelector('.top-nav .nav-inner > div:last-child');
    if (countdownNav) {
      countdownNav.prepend(btn);
    }
  }

  function updateNavButtonsUI() {
    // 1. Update global navbar button
    const globalBtn = document.getElementById('vp-global-sync-btn');
    const globalLabel = document.getElementById('vp-global-sync-label');
    const globalDot = document.getElementById('vp-global-sync-dot');
    if (globalBtn) {
      globalBtn.classList.toggle('linked', !!state.syncCode);
      if (state.syncCode) {
        if (globalLabel) {
          globalLabel.textContent = state.syncStatus === 'syncing' ? 'Syncing...' : state.syncCode;
        }
        if (globalDot) {
          globalDot.className = `vp-sync-dot ${state.syncStatus === 'syncing' ? 'syncing' : state.syncStatus === 'error' || state.syncStatus === 'offline' ? 'error' : 'synced'}`;
        }
        globalBtn.title = `All-in-One Cloud Login Active (${state.syncCode}) • Last: ${formatFullDateTime(state.lastSyncTime)}`;
      } else {
        if (globalLabel) globalLabel.textContent = 'Login / Sync';
        if (globalDot) globalDot.className = 'vp-sync-dot';
        globalBtn.title = 'All-in-One Cloud Login & Cross-Device Sync';
      }
    }

    // 2. Update portal tracker bar button (#btn-cloud-sync) if present
    const portalBtn = document.getElementById('btn-cloud-sync');
    const portalLabel = document.getElementById('btn-cloud-sync-text');
    const portalDot = document.getElementById('cloud-sync-quick-dot');
    if (portalBtn) {
      portalBtn.classList.toggle('linked', !!state.syncCode);
      if (state.syncCode) {
        if (portalLabel) portalLabel.textContent = state.syncStatus === 'syncing' ? 'Syncing...' : `Sync: ${state.syncCode}`;
        if (portalDot) {
          portalDot.className = `cloud-status-indicator ${state.syncStatus === 'syncing' ? 'syncing' : state.syncStatus === 'error' || state.syncStatus === 'offline' ? 'error' : 'synced'}`;
        }
        portalBtn.title = `All-in-One Cloud Sync Active • Pass: ${state.syncCode} • Last: ${formatFullDateTime(state.lastSyncTime)}`;
      } else {
        if (portalLabel) portalLabel.textContent = 'Cloud Sync';
        if (portalDot) portalDot.className = 'cloud-status-indicator';
        portalBtn.title = 'All-in-One Cloud Login & Cross-Device Sync';
      }
    }
  }

  function renderModalContent() {
    const modal = ensureModalElement();
    const isLinked = !!state.syncCode;
    const currentCode = state.syncCode || '';
    const shareUrl = getShareableUrl(currentCode);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}&margin=6&bgcolor=141825&color=818cf8`;

    const payload = getLocalUnifiedPayload();
    const jamSolved = Object.values(payload.jam.tracker.questions || {}).filter((q) => q && q.solved).length;
    const jamScores = Object.keys(payload.jam.scores || {}).length;
    const unpgSolved = Object.keys(payload.unpg.tracker.solved || {}).length;
    const unpgScores = Object.keys(payload.unpg.scores || {}).length;

    let bodyHtml = '';
    if (state.activeTab === 'my-code') {
      if (isLinked) {
        bodyHtml = `
          <div class="vp-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <span style="color:#34d399;font-weight:700;font-size:0.86rem;">🟢 All-in-One Session Active</span>
              <span style="font-size:0.78rem;color:#94a3b8;">Last synced: ${escapeHtml(formatRelativeTime(state.lastSyncTime))}</span>
            </div>

            <div class="vp-code-box">
              <span class="vp-code-val">${escapeHtml(currentCode)}</span>
              <button type="button" class="vp-btn primary" onclick="window.VAIBHAV_CLOUD_SYNC.copyCode('${escapeHtml(currentCode)}')">📋 Copy Pass</button>
            </div>

            <div class="vp-portal-stats">
              <div class="vp-stat-pill">
                <strong>🎯 IIT JAM Mathematics</strong><br>
                <span>${jamSolved} / 885 PYQs solved · ${jamScores} mock scores</span>
              </div>
              <div class="vp-stat-pill">
                <strong>📚 UNPG B.Sc. Sem V</strong><br>
                <span>${unpgSolved} / 750 PYQs solved · ${unpgScores} mock scores</span>
              </div>
            </div>

            <div class="vp-qr-row">
              <img src="${qrUrl}" alt="QR Code" class="vp-qr-img" onerror="this.style.display='none'">
              <div style="flex:1;min-width:200px;font-size:0.82rem;">
                <strong>📱 Instant Phone / Device Sync</strong>
                <p style="margin:4px 0 8px;color:#94a3b8;">Scan with your camera or share the magic link to log in across the entire website in one click.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.copyLink('${escapeHtml(shareUrl)}')">🔗 Copy Link</button>
                  <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.shareLink('${escapeHtml(shareUrl)}')">📤 Share</button>
                </div>
              </div>
            </div>

            <label style="display:flex;align-items:center;gap:8px;font-size:0.84rem;cursor:pointer;margin-top:8px;">
              <input type="checkbox" ${state.autoSyncEnabled ? 'checked' : ''} onchange="window.VAIBHAV_CLOUD_SYNC.toggleAutoSync(this.checked)">
              <span>⚡ Real-Time Auto-Sync across all portals (JAM + UNPG + Preferences)</span>
            </label>

            <div class="vp-actions-grid">
              <button type="button" class="vp-btn primary" onclick="window.VAIBHAV_CLOUD_SYNC.syncNow()">🔄 Sync Now</button>
              <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.pullFromCloud()">📥 Pull Latest</button>
              <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.createNewCode()">✨ New Pass</button>
              <button type="button" class="vp-btn danger" onclick="window.VAIBHAV_CLOUD_SYNC.unlinkDevice()">🔌 Log Out</button>
            </div>
          </div>
        `;
      } else {
        bodyHtml = `
          <div class="vp-card" style="text-align:center;padding:24px 18px;">
            <div style="font-size:2.4rem;margin-bottom:8px;">☁️</div>
            <h3 style="margin-bottom:8px;">All-in-One Website Login</h3>
            <p style="font-size:0.88rem;color:#94a3b8;max-width:440px;margin:0 auto 16px;">
              One 6-character pass syncs your IIT JAM PYQs, UNPG Semester V tracker, and mock test scores across every page and device — no password needed.
            </p>
            <div class="vp-portal-stats" style="text-align:left;margin-bottom:18px;">
              <div class="vp-stat-pill"><strong>🎯 Local JAM:</strong> ${jamSolved} solved · ${jamScores} scores</div>
              <div class="vp-stat-pill"><strong>📚 Local UNPG:</strong> ${unpgSolved} solved · ${unpgScores} scores</div>
            </div>
            <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
              <button type="button" class="vp-btn primary" onclick="window.VAIBHAV_CLOUD_SYNC.createNewCode()">✨ Generate All-in-One Pass</button>
              <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.switchTab('link-device')">📱 I Already Have a Code</button>
            </div>
          </div>
        `;
      }
    } else if (state.activeTab === 'link-device') {
      bodyHtml = `
        <div class="vp-card">
          <h4 style="margin-bottom:6px;">Log In with Your 6-Character Pass</h4>
          <p style="font-size:0.84rem;color:#94a3b8;margin-bottom:14px;">
            Enter your existing JAM code (e.g. <code>JAM-JHT-WRW</code>), UNPG code (<code>SEM-...</code>), or unified pass (<code>VP-...</code>).
          </p>
          <div style="display:flex;gap:8px;margin-bottom:14px;">
            <input type="text" id="vp-cloud-code-input" class="vp-input" placeholder="e.g. JAM-JHT-WRW or VP-842-195" value="${escapeHtml(currentCode)}" onkeydown="if(event.key==='Enter') window.VAIBHAV_CLOUD_SYNC.submitLinkCode()">
            <button type="button" class="vp-btn primary" onclick="window.VAIBHAV_CLOUD_SYNC.submitLinkCode()">⚡ Connect</button>
          </div>
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;margin-bottom:8px;cursor:pointer;">
            <input type="radio" name="vp-merge-choice" value="merge" checked>
            <span><strong>🟢 Smart Merge (Recommended):</strong> Combines progress from both devices so nothing is ever lost.</span>
          </label>
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;cursor:pointer;">
            <input type="radio" name="vp-merge-choice" value="replace">
            <span><strong>🔵 Overwrite Local:</strong> Replaces this browser's data with the cloud snapshot.</span>
          </label>
        </div>
      `;
    } else {
      const isCustom = !!localStorage.getItem(KEYS.API_URL);
      bodyHtml = `
        <div class="vp-card">
          <h4 style="margin-bottom:6px;">⚙️ Cloudflare Worker Backend</h4>
          <p style="font-size:0.82rem;color:#94a3b8;margin-bottom:12px;">
            Powered by Cloudflare Workers + KV storage. Leave default unless self-hosting.
          </p>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input type="text" id="vp-cloud-api-input" class="vp-input" style="font-size:0.82rem;letter-spacing:0;" value="${escapeHtml(state.apiUrl)}">
            <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.saveApiUrlInput()">Save</button>
            ${isCustom ? '<button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.resetApiUrl()">Reset</button>' : ''}
          </div>
          <div style="font-size:0.74rem;color:#94a3b8;">Default: <code>${escapeHtml(DEFAULT_API_URL)}</code></div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="vp-modal-card">
        <div class="vp-modal-header">
          <div class="vp-modal-title"><span>☁️</span><span>All-in-One Cloud Login &amp; Sync Hub</span></div>
          <button type="button" class="vp-modal-close" onclick="window.VAIBHAV_CLOUD_SYNC.closeModal()" title="Close (Esc)">✕</button>
        </div>
        <div class="vp-modal-tabs">
          <button type="button" class="vp-tab-btn ${state.activeTab === 'my-code' ? 'active' : ''}" onclick="window.VAIBHAV_CLOUD_SYNC.switchTab('my-code')">🔑 ${isLinked ? 'My Sync Pass' : 'Get Pass'}</button>
          <button type="button" class="vp-tab-btn ${state.activeTab === 'link-device' ? 'active' : ''}" onclick="window.VAIBHAV_CLOUD_SYNC.switchTab('link-device')">📱 Link Device</button>
          <button type="button" class="vp-tab-btn ${state.activeTab === 'settings' ? 'active' : ''}" onclick="window.VAIBHAV_CLOUD_SYNC.switchTab('settings')">⚙️ Backend</button>
        </div>
        <div class="vp-modal-body">${bodyHtml}</div>
        <div class="vp-modal-footer">
          <span>🔒 One pass for entire site · Zero password required</span>
          <button type="button" class="vp-btn" onclick="window.VAIBHAV_CLOUD_SYNC.closeModal()">Close</button>
        </div>
      </div>
    `;
  }

  function updateUI() {
    updateNavButtonsUI();
    const modal = document.getElementById('vaibhav-unified-sync-modal');
    if (modal && !modal.classList.contains('hidden')) {
      renderModalContent();
    }
  }

  function openModal(tab) {
    injectStyles();
    if (tab) {
      state.activeTab = tab === 'overview' ? 'my-code' : tab === 'link' ? 'link-device' : tab;
    }
    const modal = ensureModalElement();
    renderModalContent();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('vaibhav-unified-sync-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchTab(tabName) {
    state.activeTab = tabName === 'overview' ? 'my-code' : tabName === 'link' ? 'link-device' : tabName;
    renderModalContent();
  }

  function submitLinkCode() {
    const inp = document.getElementById('vp-cloud-code-input');
    const radio = document.querySelector('input[name="vp-merge-choice"]:checked');
    const mode = radio ? radio.value : 'merge';
    if (inp) linkWithCode(inp.value, mode, false);
  }

  function copyCode(code) {
    const c = code || state.syncCode;
    if (!c) return;
    navigator.clipboard?.writeText(c).then(
      () => showToast(`✓ Copied Pass "${c}"`),
      () => showToast(`Pass: ${c}`)
    );
  }

  function copyLink(link) {
    const u = link || getShareableUrl();
    navigator.clipboard?.writeText(u).then(
      () => showToast('✓ Magic Login Link copied!'),
      () => prompt('Copy your Magic Login Link:', u)
    );
  }

  function shareLink(link) {
    const u = link || getShareableUrl();
    if (navigator.share) {
      navigator.share({
        title: 'Vaibhav Priyadarshi — All-in-One Portal Sync',
        text: `Sync your progress across all portals with Pass: ${state.syncCode}`,
        url: u
      }).catch(() => {});
    } else {
      copyLink(u);
    }
  }

  function saveApiUrlInput() {
    const inp = document.getElementById('vp-cloud-api-input');
    if (inp) setApiUrl(inp.value);
  }

  function resetApiUrl() {
    setApiUrl('');
  }

  // ==========================================================================
  // Initialization & Public Unified API (+ Legacy Portal Aliases)
  // ==========================================================================

  function init() {
    injectStyles();
    injectNavbarButtonIfMissing();

    try {
      const urlParams = new URLSearchParams(window.location.search);
      let paramCode = urlParams.get('sync');
      if (!paramCode && window.location.hash.startsWith('#sync=')) {
        paramCode = window.location.hash.slice(6);
      }
      if (paramCode) {
        const clean = normalizeCode(paramCode);
        if (clean) {
          setTimeout(() => linkWithCode(clean, 'merge', true), 250);
          urlParams.delete('sync');
          const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '') + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        }
      } else if (state.syncCode) {
        // Background merge-sync on page load so all pages stay up to date
        setTimeout(() => performSync(false, 'merge'), 600);
      }
    } catch (e) {}

    updateNavButtonsUI();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  const publicApi = {
    __initialized: true,
    init,
    openModal,
    closeModal,
    switchTab,
    submitLinkCode,
    copyCode,
    copySyncCode: () => copyCode(state.syncCode),
    copyLink,
    copyShareableUrl: () => copyLink(getShareableUrl()),
    shareLink,
    saveApiUrlInput,
    resetApiUrl,
    toggleAutoSync,
    toggleAutoSyncSetting: toggleAutoSync,
    createNewCode,
    enableNewSyncCode: createNewCode,
    pullFromCloud,
    syncNow: () => performSync(true, 'merge'),
    triggerAutoSync,
    scheduleAutoPush: triggerAutoSync,
    unlinkDevice,
    unlinkSync: unlinkDevice,
    linkWithCode,
    isLinked: () => !!state.syncCode,
    getSyncCode: () => state.syncCode,
    getCurrentCode: () => state.syncCode,
    getSyncStatus: () => state.syncStatus,
    updateStatusUI: updateNavButtonsUI
  };

  window.VAIBHAV_CLOUD_SYNC = publicApi;
  // Backwards-compatible aliases for JAM & UNPG portals
  window.JAM_CLOUD_SYNC = publicApi;
  window.SEM_CLOUD_SYNC = publicApi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
