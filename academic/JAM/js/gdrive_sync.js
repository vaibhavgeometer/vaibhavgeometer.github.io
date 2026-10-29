/**
 * IIT JAM Mathematics (MA) — Google Drive Cloud Backup & Real-Time Sync Engine
 * Allows users to optionally link their Google Drive account.
 * Automatically creates & maintains 'IIT_JAM_MA_PYQ_Tracker_Backup.json' in user's Drive.
 * Instantly synchronizes every relevant tracker interaction (solved toggle, tags, bulk actions, resets).
 * Privacy-first: Uses 'drive.file' scope — only touches files created by this application.
 */

(function() {
  'use strict';

  // Constants & Storage Keys
  const BACKUP_FILE_NAME = 'IIT_JAM_MA_PYQ_Tracker_Backup.json';
  const STORAGE_CLIENT_ID = 'jam_gdrive_client_id';
  const STORAGE_ACCESS_TOKEN = 'jam_gdrive_access_token';
  const STORAGE_TOKEN_EXPIRY = 'jam_gdrive_token_expiry';
  const STORAGE_USER_INFO = 'jam_gdrive_user_info';
  const STORAGE_FILE_ID = 'jam_gdrive_file_id';
  const STORAGE_LAST_SYNC = 'jam_gdrive_last_sync';
  const STORAGE_AUTO_SYNC_ENABLED = 'jam_gdrive_auto_sync_enabled';

  // Optional Default Client ID (configured for https://vaibhavgeometer.github.io)
  // Users can also enter their own Google OAuth Client ID directly in the UI modal.
  const DEFAULT_CLIENT_ID = window.JAM_GDRIVE_DEFAULT_CLIENT_ID || '';

  // Internal State
  const state = {
    clientId: localStorage.getItem(STORAGE_CLIENT_ID) || DEFAULT_CLIENT_ID,
    accessToken: localStorage.getItem(STORAGE_ACCESS_TOKEN) || null,
    tokenExpiry: parseInt(localStorage.getItem(STORAGE_TOKEN_EXPIRY) || '0', 10),
    userInfo: null,
    fileId: localStorage.getItem(STORAGE_FILE_ID) || null,
    lastSyncTime: localStorage.getItem(STORAGE_LAST_SYNC) || null,
    autoSyncEnabled: localStorage.getItem(STORAGE_AUTO_SYNC_ENABLED) !== 'false',
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error' | 'expired'
    statusMessage: '',
    tokenClient: null,
    debounceTimer: null,
    isInitialSyncInProgress: false
  };

  // Parse saved user info if available
  try {
    const rawUser = localStorage.getItem(STORAGE_USER_INFO);
    if (rawUser) state.userInfo = JSON.parse(rawUser);
  } catch (e) {
    state.userInfo = null;
  }

  // --- Helper Functions ---
  function isLinked() {
    return !!(state.accessToken && state.fileId);
  }

  function isTokenExpired() {
    if (!state.accessToken || !state.tokenExpiry) return true;
    // Consider token expired 60 seconds before actual expiration
    return Date.now() >= (state.tokenExpiry - 60000);
  }

  function getClientId() {
    return state.clientId || localStorage.getItem(STORAGE_CLIENT_ID) || DEFAULT_CLIENT_ID;
  }

  function formatRelativeSyncTime(isoString) {
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
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
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

  // --- Prepare Progress Payload for Google Drive ---
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
      version: '1.1',
      backupSource: 'Google Drive Instant Auto-Sync',
      exportedAt: new Date().toISOString(),
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

  // --- Google Drive REST API Methods ---

  /**
   * Fetch current user profile info from Google OAuth2 userinfo endpoint
   */
  async function fetchUserInfo(token) {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        state.userInfo = await resp.json();
        localStorage.setItem(STORAGE_USER_INFO, JSON.stringify(state.userInfo));
      }
    } catch (e) {
      console.warn('Could not fetch user profile info:', e);
    }
  }

  /**
   * Search for existing backup file in Google Drive root
   */
  async function findBackupFile(token) {
    const q = `name = '${BACKUP_FILE_NAME}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&spaces=drive`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Failed to query Google Drive: ${resp.status} ${errBody}`);
    }
    const data = await resp.json();
    return (data.files && data.files.length > 0) ? data.files[0] : null;
  }

  /**
   * Create a new backup file in user's Google Drive using multipart upload
   */
  async function createBackupFile(token, payload) {
    const boundary = '-------JAM_DRIVE_SYNC_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: BACKUP_FILE_NAME,
      mimeType: 'application/json',
      description: 'Automated real-time cloud backup for IIT JAM Mathematics (MA) PYQ Tracker'
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload, null, 2) +
      closeDelimiter;

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Failed to create file in Google Drive: ${resp.status} ${errBody}`);
    }

    const data = await resp.json();
    return data.id;
  }

  /**
   * Update existing backup file content via media patch
   */
  async function updateBackupFile(fileId, token, payload) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload, null, 2)
    });

    if (resp.status === 401) {
      throw new Error('UNAUTHORIZED_TOKEN_EXPIRED');
    }
    if (resp.status === 404) {
      throw new Error('FILE_NOT_FOUND_MAYBE_TRASHED');
    }
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Google Drive sync error: ${resp.status} ${errBody}`);
    }

    return await resp.json();
  }

  /**
   * Read raw JSON content from existing Google Drive backup file
   */
  async function readBackupFile(fileId, token) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Failed to read backup from Google Drive: ${resp.status} ${errBody}`);
    }
    return await resp.json();
  }

  // --- Core Sync Logic ---

  /**
   * Executes the actual sync to Google Drive
   */
  async function performSync(isManual = false) {
    if (!isLinked()) return;

    if (isTokenExpired()) {
      state.syncStatus = 'expired';
      state.statusMessage = 'Google Drive session expired. Click to re-link.';
      updateUI();
      if (isManual) {
        showToast('Google Drive session expired. Re-authorizing...');
        authorize();
      }
      return;
    }

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing backup to Google Drive...';
    updateUI();

    try {
      const payload = getTrackerPayload();
      try {
        await updateBackupFile(state.fileId, state.accessToken, payload);
      } catch (updateErr) {
        if (updateErr.message === 'FILE_NOT_FOUND_MAYBE_TRASHED') {
          // File was deleted or moved to trash in Drive; recreate it
          const newFileId = await createBackupFile(state.accessToken, payload);
          state.fileId = newFileId;
          localStorage.setItem(STORAGE_FILE_ID, newFileId);
        } else if (updateErr.message === 'UNAUTHORIZED_TOKEN_EXPIRED') {
          state.syncStatus = 'expired';
          state.statusMessage = 'Session expired. Click to re-link.';
          updateUI();
          return;
        } else {
          throw updateErr;
        }
      }

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
      state.syncStatus = 'synced';
      state.statusMessage = `Synced to Google Drive (${formatRelativeSyncTime(state.lastSyncTime)})`;
      updateUI();

      if (isManual) {
        showToast('✓ Successfully synced to Google Drive!');
      }
    } catch (err) {
      console.error('Google Drive Sync Error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Sync failed (Offline / Network error)';
      updateUI();
      if (isManual) {
        alert('Could not sync to Google Drive: ' + err.message);
      }
    }
  }

  /**
   * Debounced Instant Auto-Sync trigger called on EVERY relevant click in PYQ tracker
   */
  function triggerAutoSync() {
    if (!isLinked() || !state.autoSyncEnabled) return;

    // Show immediate visual indicator that sync is queued/active
    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing to Drive...';
    updateHeaderButtonUI();

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    // 350ms debounce: feels completely instant to user while cleanly bundling rapid multi-clicks
    state.debounceTimer = setTimeout(() => {
      performSync(false);
    }, 350);
  }

  // --- Google OAuth2 Authorization ---

  function initTokenClient() {
    const clientId = getClientId();
    if (!clientId) return null;

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      console.warn('Google Identity Services library not yet loaded.');
      return null;
    }

    try {
      state.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (resp) => {
          if (resp.error) {
            console.error('Google Auth Error:', resp);
            state.syncStatus = 'error';
            state.statusMessage = 'Authentication failed: ' + (resp.error_description || resp.error);
            updateUI();
            alert('Google Drive authorization failed: ' + (resp.error_description || resp.error));
            return;
          }

          await handleAuthSuccess(resp);
        }
      });
      return state.tokenClient;
    } catch (e) {
      console.error('Failed to init Google token client:', e);
      return null;
    }
  }

  async function handleAuthSuccess(tokenResponse) {
    state.accessToken = tokenResponse.access_token;
    const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3600;
    state.tokenExpiry = Date.now() + (expiresIn * 1000);

    localStorage.setItem(STORAGE_ACCESS_TOKEN, state.accessToken);
    localStorage.setItem(STORAGE_TOKEN_EXPIRY, String(state.tokenExpiry));

    state.syncStatus = 'syncing';
    state.statusMessage = 'Connecting to Google Drive...';
    updateUI();

    try {
      // 1. Fetch user info
      await fetchUserInfo(state.accessToken);

      // 2. Check if backup file already exists in user's Drive
      const existingFile = await findBackupFile(state.accessToken);
      const payload = getTrackerPayload();

      if (existingFile) {
        state.fileId = existingFile.id;
        localStorage.setItem(STORAGE_FILE_ID, existingFile.id);

        // Fetch existing file to see if it has solved questions
        try {
          const driveData = await readBackupFile(existingFile.id, state.accessToken);
          const driveQuestions = driveData.questions || {};
          let driveSolvedCount = 0;
          Object.values(driveQuestions).forEach(q => { if (q && q.solved) driveSolvedCount++; });

          const localSolvedCount = payload.stats.solvedCount;

          if (driveSolvedCount > 0 && localSolvedCount === 0) {
            // Local tracker is empty but cloud has progress! Prompt user to restore
            const restoreConfirm = confirm(
              `Found an existing backup in your Google Drive with ${driveSolvedCount} solved questions!\n\n` +
              `Would you like to RESTORE these ${driveSolvedCount} questions to your tracker now?\n\n` +
              `Click "OK" to restore your saved cloud progress, or "Cancel" to overwrite with your current browser state.`
            );
            if (restoreConfirm) {
              if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
                window.JAM_TRACKER.loadUserDataFromBackup(driveData);
              }
              state.lastSyncTime = new Date().toISOString();
              localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
              state.syncStatus = 'synced';
              state.statusMessage = `Restored & Synced (${formatRelativeSyncTime(state.lastSyncTime)})`;
              updateUI();
              showToast(`✓ Restored ${driveSolvedCount} solved questions from Google Drive!`);
              return;
            }
          }
        } catch (readErr) {
          console.warn('Could not inspect existing Drive file content:', readErr);
        }

        // Update existing file with current tracker data
        await updateBackupFile(existingFile.id, state.accessToken, payload);
      } else {
        // Create brand new file in user's Drive
        const newFileId = await createBackupFile(state.accessToken, payload);
        state.fileId = newFileId;
        localStorage.setItem(STORAGE_FILE_ID, newFileId);
      }

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNC, state.lastSyncTime);
      state.syncStatus = 'synced';
      state.statusMessage = `Linked & Synced (${formatRelativeSyncTime(state.lastSyncTime)})`;
      updateUI();
      showToast('✓ Google Drive linked! Instant cloud auto-sync active.');
    } catch (err) {
      console.error('Error during Google Drive initial sync:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Link error: ' + err.message;
      updateUI();
      alert('Could not complete Google Drive setup: ' + err.message);
    }
  }

  function authorize() {
    const clientId = getClientId();
    if (!clientId) {
      openModal();
      setTimeout(() => {
        const input = document.getElementById('gdrive-client-id-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      alert('Google Identity Services is still loading. Please check your internet connection or try again in a few seconds.');
      return;
    }

    const client = initTokenClient();
    if (client) {
      client.requestAccessToken({ prompt: isTokenExpired() ? 'consent' : '' });
    }
  }

  function disconnect() {
    const confirmDisconnect = confirm(
      'Are you sure you want to disconnect Google Drive?\n\n' +
      '• Your existing backup file in Google Drive will NOT be deleted.\n' +
      '• Changes in PYQ tracker will no longer auto-sync to your Google Drive.'
    );
    if (!confirmDisconnect) return;

    if (state.accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(state.accessToken, () => {});
      } catch (e) {}
    }

    localStorage.removeItem(STORAGE_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_USER_INFO);
    localStorage.removeItem(STORAGE_FILE_ID);
    localStorage.removeItem(STORAGE_LAST_SYNC);

    state.accessToken = null;
    state.tokenExpiry = 0;
    state.userInfo = null;
    state.fileId = null;
    state.lastSyncTime = null;
    state.syncStatus = 'idle';
    state.statusMessage = 'Google Drive unlinked';

    updateUI();
    showToast('Google Drive account unlinked.');
  }

  async function restoreFromDrive() {
    if (!isLinked()) return;

    if (isTokenExpired()) {
      showToast('Google Drive session expired. Re-authorizing...');
      authorize();
      return;
    }

    const confirmRestore = confirm(
      '⚠️ RESTORE FROM GOOGLE DRIVE\n\n' +
      'This will replace your current browser PYQ tracker progress with the backup file from your Google Drive.\n\n' +
      'Are you sure you want to continue?'
    );
    if (!confirmRestore) return;

    try {
      state.syncStatus = 'syncing';
      state.statusMessage = 'Downloading backup from Google Drive...';
      updateUI();

      const driveData = await readBackupFile(state.fileId, state.accessToken);

      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
        window.JAM_TRACKER.loadUserDataFromBackup(driveData);
      } else {
        localStorage.setItem('jam_pyq_user_tracker_v1', JSON.stringify({
          questions: driveData.questions || {},
          oosMarkedUnnecessary: !!driveData.oosMarkedUnnecessary
        }));
        if (window.JAM_TRACKER && typeof window.JAM_TRACKER.init === 'function') {
          window.JAM_TRACKER.init();
        }
      }

      state.syncStatus = 'synced';
      state.statusMessage = 'Restored from Google Drive ✓';
      updateUI();
      closeModal();
      showToast('✓ Progress restored successfully from Google Drive!');
    } catch (err) {
      console.error('Restore Error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Restore failed: ' + err.message;
      updateUI();
      alert('Failed to restore from Google Drive: ' + err.message);
    }
  }

  function openFileInDrive() {
    if (state.fileId) {
      window.open(`https://drive.google.com/file/d/${state.fileId}/view`, '_blank');
    } else {
      window.open('https://drive.google.com/', '_blank');
    }
  }

  function setCustomClientId(newClientId) {
    const val = (newClientId || '').trim();
    state.clientId = val;
    if (val) {
      localStorage.setItem(STORAGE_CLIENT_ID, val);
      showToast('Google Client ID saved!');
    } else {
      localStorage.removeItem(STORAGE_CLIENT_ID);
      showToast('Custom Client ID cleared.');
    }
    state.tokenClient = null; // reset client to re-init
    updateUI();
  }

  function toggleAutoSync(enabled) {
    state.autoSyncEnabled = !!enabled;
    localStorage.setItem(STORAGE_AUTO_SYNC_ENABLED, String(state.autoSyncEnabled));
    updateUI();
    showToast(state.autoSyncEnabled ? 'Real-time Google Drive sync enabled' : 'Auto-sync paused');
  }

  // --- UI Rendering ---

  function updateHeaderButtonUI() {
    const btn = document.getElementById('btn-gdrive-sync');
    const label = document.getElementById('btn-gdrive-text');
    const dot = document.getElementById('gdrive-quick-dot');

    if (!btn) return;

    if (isLinked()) {
      btn.classList.add('linked');
      if (state.syncStatus === 'syncing') {
        if (label) label.textContent = 'Syncing...';
        if (dot) dot.className = 'gdrive-status-indicator syncing';
        btn.setAttribute('title', 'Syncing latest changes to Google Drive in real-time...');
      } else if (state.syncStatus === 'expired') {
        if (label) label.textContent = 'Drive: Re-link';
        if (dot) dot.className = 'gdrive-status-indicator expired';
        btn.setAttribute('title', 'Google Drive session expired. Click to re-link.');
      } else if (state.syncStatus === 'error') {
        if (label) label.textContent = 'Drive: Error';
        if (dot) dot.className = 'gdrive-status-indicator error';
        btn.setAttribute('title', 'Google Drive sync error. Click to view details.');
      } else {
        const timeStr = formatRelativeSyncTime(state.lastSyncTime);
        if (label) label.textContent = `Drive: Synced (${timeStr})`;
        if (dot) dot.className = 'gdrive-status-indicator synced';
        btn.setAttribute('title', `Google Drive Auto-Sync Active • Last synced: ${formatFullDateTime(state.lastSyncTime)}. Click to manage.`);
      }
    } else {
      btn.classList.remove('linked');
      if (label) label.textContent = 'Link Google Drive';
      if (dot) dot.className = 'gdrive-status-indicator';
      btn.setAttribute('title', 'Link your Google Drive account for instant real-time cloud backup');
    }
  }

  function renderModalContent() {
    const modal = document.getElementById('gdrive-sync-modal');
    if (!modal) return;

    const linked = isLinked();
    const expired = isTokenExpired();
    const clientId = getClientId();
    const currentOrigin = window.location.origin;

    let statusPillHtml = '';
    if (linked) {
      if (expired) {
        statusPillHtml = '<span class="gdrive-badge-status expired">⚠️ Session Expired — Re-link Required</span>';
      } else if (state.syncStatus === 'syncing') {
        statusPillHtml = '<span class="gdrive-badge-status syncing">🔄 Syncing to Drive...</span>';
      } else {
        statusPillHtml = '<span class="gdrive-badge-status synced">🟢 Connected & Auto-Syncing</span>';
      }
    } else {
      statusPillHtml = '<span class="gdrive-badge-status unlinked">⚪ Not Connected</span>';
    }

    const userName = state.userInfo?.name || 'Google User';
    const userEmail = state.userInfo?.email || 'Connected Account';
    const userPicture = state.userInfo?.picture || '';

    modal.innerHTML = `
      <div class="modal-card gdrive-modal-card">
        <div class="modal-header">
          <div class="modal-title">
            <svg class="gdrive-icon-svg" viewBox="0 0 87.3 78" width="22" height="22">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
            <span>Google Drive Cloud Sync & Backup</span>
          </div>
          <button class="modal-close-btn" onclick="window.JAM_GDRIVE_SYNC.closeModal()" title="Close (Esc)">✕</button>
        </div>

        <div class="modal-body">
          <!-- Connection Status Card -->
          <div class="gdrive-status-card ${linked ? 'active' : ''}">
            <div class="gdrive-status-header">
              <div class="gdrive-user-meta">
                ${userPicture ? `<img src="${userPicture}" alt="${userName}" class="gdrive-user-avatar">` : '<div class="gdrive-user-avatar-placeholder">👤</div>'}
                <div>
                  <div class="gdrive-user-name">${linked ? userName : 'No Account Linked'}</div>
                  <div class="gdrive-user-email">${linked ? userEmail : 'Link your Google Drive for real-time backup'}</div>
                </div>
              </div>
              <div>${statusPillHtml}</div>
            </div>

            ${linked ? `
              <div class="gdrive-file-info-box">
                <div class="gdrive-info-row">
                  <span class="gdrive-info-label">📁 Backup File:</span>
                  <span class="gdrive-info-val"><code>${BACKUP_FILE_NAME}</code></span>
                </div>
                <div class="gdrive-info-row">
                  <span class="gdrive-info-label">⏱️ Last Synced:</span>
                  <span class="gdrive-info-val">${formatFullDateTime(state.lastSyncTime)} (${formatRelativeSyncTime(state.lastSyncTime)})</span>
                </div>
                <div class="gdrive-info-row">
                  <span class="gdrive-info-label">⚡ Instant Sync:</span>
                  <label class="gdrive-toggle-label">
                    <input type="checkbox" id="gdrive-auto-sync-checkbox" ${state.autoSyncEnabled ? 'checked' : ''} onchange="window.JAM_GDRIVE_SYNC.toggleAutoSync(this.checked)">
                    <span>Sync automatically on every click</span>
                  </label>
                </div>
              </div>

              <!-- Action Controls for Linked Account -->
              <div class="gdrive-action-buttons-grid">
                <button class="btn-gdrive-action primary" onclick="window.JAM_GDRIVE_SYNC.syncNow()">
                  <span>🔄</span> <span>Sync to Drive Now</span>
                </button>
                <button class="btn-gdrive-action secondary" onclick="window.JAM_GDRIVE_SYNC.restoreFromDrive()">
                  <span>📥</span> <span>Restore from Drive</span>
                </button>
                <button class="btn-gdrive-action secondary" onclick="window.JAM_GDRIVE_SYNC.openFileInDrive()">
                  <span>🔗</span> <span>Open File in Drive</span>
                </button>
                <button class="btn-gdrive-action danger" onclick="window.JAM_GDRIVE_SYNC.disconnect()">
                  <span>🔌</span> <span>Disconnect Drive</span>
                </button>
              </div>
            ` : `
              <div class="gdrive-features-list">
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">⚡</span>
                  <div>
                    <strong>Instant Real-Time Backup</strong>
                    <p>Every time you mark a question solved, tag difficulty, or bulk mark topics, your progress is backed up immediately to your personal Google Drive.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">🔒</span>
                  <div>
                    <strong>Zero-Risk Privacy Guarantee</strong>
                    <p>Uses the official Google <code>drive.file</code> scope. The app can ONLY access the single backup file it creates — it has zero access to any other files in your Google Drive.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">💻</span>
                  <div>
                    <strong>Seamless Multi-Device Continuity</strong>
                    <p>Open this portal on your laptop, tablet, or phone, click "Restore from Drive", and continue right where you left off.</p>
                  </div>
                </div>
              </div>

              <div style="margin-top: 18px; text-align: center;">
                <button class="btn-test primary gdrive-connect-hero-btn" onclick="window.JAM_GDRIVE_SYNC.authorize()">
                  <svg class="gdrive-icon-svg" viewBox="0 0 87.3 78" width="18" height="18">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span>Link Google Drive Account</span>
                </button>
              </div>
            `}
          </div>

          <!-- Google Cloud Client ID Configuration (Collapsible / Configurable) -->
          <div class="gdrive-config-accordion">
            <details class="gdrive-details" ${!clientId ? 'open' : ''}>
              <summary class="gdrive-summary">
                <span>⚙️ Google OAuth Client ID Settings</span>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">${clientId ? '(Configured ✓)' : '(Required for setup)'}</span>
              </summary>
              <div class="gdrive-details-content">
                <p class="gdrive-config-hint">
                  Google Drive API uses Google Identity Services. An OAuth 2.0 Client ID (Web Application) authorized for <code>${currentOrigin}</code> connects your Google account.
                </p>
                <div class="gdrive-input-group">
                  <label for="gdrive-client-id-input" class="gdrive-input-label">OAuth 2.0 Web Client ID:</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="text" id="gdrive-client-id-input" class="gdrive-input-field" placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com" value="${clientId}">
                    <button class="btn-test secondary" onclick="window.JAM_GDRIVE_SYNC.saveInputClientId()">Save</button>
                  </div>
                </div>

                <div class="gdrive-instructions-card">
                  <div class="gdrive-instructions-title">📋 2-Minute Google Client ID Setup Guide:</div>
                  <ol class="gdrive-instructions-list">
                    <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:700;">Google Cloud Console Credentials Page</a>.</li>
                    <li>Create or select any project, then click <strong>Library</strong> and enable <strong>Google Drive API</strong>.</li>
                    <li>Under <strong>Credentials</strong>, click <strong>Create Credentials</strong> → <strong>OAuth client ID</strong>.</li>
                    <li>Select Application type: <strong>Web application</strong>.</li>
                    <li>Under <strong>Authorized JavaScript origins</strong>, click <em>+ ADD URI</em> and paste: <code>${currentOrigin}</code></li>
                    <li>Click <strong>Create</strong>, copy the Client ID string, paste it in the box above, and click <strong>Save & Link</strong>!</li>
                  </ol>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; border-top: 1px solid var(--border);">
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            🔒 Stored safely in your private Google Drive · Zero data saved on external servers
          </span>
          <button type="button" class="btn-test secondary" onclick="window.JAM_GDRIVE_SYNC.closeModal()">Close</button>
        </div>
      </div>
    `;
  }

  function updateUI() {
    updateHeaderButtonUI();
    const modal = document.getElementById('gdrive-sync-modal');
    if (modal && !modal.classList.contains('hidden')) {
      renderModalContent();
    }
  }

  function openModal() {
    const modal = document.getElementById('gdrive-sync-modal');
    if (!modal) return;
    renderModalContent();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('gdrive-sync-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function saveInputClientId() {
    const input = document.getElementById('gdrive-client-id-input');
    if (input) {
      setCustomClientId(input.value);
    }
  }

  function showToast(msg) {
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
      window.JAM_TRACKER.showToast(msg);
    } else {
      console.log('[Google Drive Sync]', msg);
    }
  }

  // --- Public API ---
  window.JAM_GDRIVE_SYNC = {
    init: function() {
      // Auto-initialize GIS client if Google library ready
      if (window.google?.accounts?.oauth2) {
        initTokenClient();
      } else {
        // Poll briefly until gsi script loads
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.google?.accounts?.oauth2) {
            initTokenClient();
            clearInterval(interval);
          } else if (attempts > 30) {
            clearInterval(interval);
          }
        }, 200);
      }

      updateUI();

      // Listen for Escape key to close modal
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('gdrive-sync-modal');
          if (modal && !modal.classList.contains('hidden')) {
            closeModal();
          }
        }
      });
    },

    openModal: openModal,
    closeModal: closeModal,
    authorize: authorize,
    disconnect: disconnect,
    syncNow: () => performSync(true),
    triggerAutoSync: triggerAutoSync,
    restoreFromDrive: restoreFromDrive,
    openFileInDrive: openFileInDrive,
    toggleAutoSync: toggleAutoSync,
    saveInputClientId: saveInputClientId,
    setCustomClientId: setCustomClientId,
    isLinked: isLinked,
    getSyncStatus: () => state.syncStatus
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.JAM_GDRIVE_SYNC.init());
  } else {
    window.JAM_GDRIVE_SYNC.init();
  }

})();
