/**
 * IIT JAM Mathematics (MA) — Persistent Google Cloud Account Sync Engine
 * Built on Google Cloud Platform / Firebase Authentication & Cloud Firestore.
 * 
 * Key Advantages over Drive OAuth:
 * 1. Persistent Session: Uses LocalStorage/IndexedDB persistence — NEVER logs out automatically.
 * 2. Instant Sync: Real-time saving on Google Cloud servers (Firestore) on every question click.
 * 3. Multi-Device: Automatically loads your latest progress on phone, tablet, and laptop.
 * 4. Zero Hassle: 1-click Google Sign-In with official Google account chooser.
 */

(function() {
  'use strict';

  const STORAGE_FIREBASE_CONFIG = 'jam_firebase_config';
  const STORAGE_LAST_CLOUD_SYNC = 'jam_cloud_last_sync';
  const COLLECTION_USERS = 'users';
  const DOC_TRACKER = 'jam_pyq_tracker';

  // Optional global default config (can be injected via window.JAM_FIREBASE_DEFAULT_CONFIG)
  const DEFAULT_CONFIG = window.JAM_FIREBASE_DEFAULT_CONFIG || null;

  const state = {
    config: null,
    app: null,
    auth: null,
    db: null,
    user: null,
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error'
    statusMessage: '',
    lastSyncTime: localStorage.getItem(STORAGE_LAST_CLOUD_SYNC) || null,
    debounceTimer: null,
    isInitialized: false,
    firestoreUnsubscribe: null
  };

  // Try parsing stored config
  try {
    const raw = localStorage.getItem(STORAGE_FIREBASE_CONFIG);
    if (raw) {
      state.config = JSON.parse(raw);
    } else if (DEFAULT_CONFIG) {
      state.config = DEFAULT_CONFIG;
    }
  } catch (e) {
    state.config = null;
  }

  // Helper: extract config object from user input (supports JSON, JS code, or object text)
  function parseConfigString(input) {
    if (!input || typeof input !== 'string') return null;
    let str = input.trim();

    // Strip "const firebaseConfig =" or "var firebaseConfig =" or "let config ="
    str = str.replace(/^(const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*/i, '');
    // Strip trailing semicolon
    str = str.replace(/;\s*$/, '');

    // Try standard JSON parse
    try {
      const obj = JSON.parse(str);
      if (obj && obj.apiKey && obj.projectId) return obj;
    } catch (e) {}

    // Try relaxed JS object parsing via Function (safe in browser client context)
    try {
      const fn = new Function('return (' + str + ');');
      const obj = fn();
      if (obj && typeof obj === 'object' && obj.apiKey && obj.projectId) {
        return obj;
      }
    } catch (e) {}

    return null;
  }

  // --- Initialize Firebase Engine ---
  function initFirebase() {
    if (!state.config) return false;
    if (typeof firebase === 'undefined' || !firebase.initializeApp || !firebase.auth || !firebase.firestore) {
      console.warn('[Google Cloud Sync] Firebase SDK not yet available.');
      return false;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        state.app = firebase.initializeApp(state.config);
      } else {
        state.app = firebase.apps[0];
      }

      state.auth = firebase.auth();
      state.db = firebase.firestore();

      // Ensure permanent local persistence (never expires until explicit sign out)
      state.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
        console.warn('[Google Cloud Sync] Could not set LOCAL persistence:', err);
      });

      // Listen for persistent auth state changes
      state.auth.onAuthStateChanged(async (user) => {
        if (user) {
          state.user = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || ''
          };
          state.syncStatus = 'synced';
          state.statusMessage = `Logged in as ${state.user.displayName}`;
          updateUI();

          // Listen to real-time changes on Google servers or fetch initial
          setupRealtimeSync(user.uid);
        } else {
          if (state.firestoreUnsubscribe) {
            state.firestoreUnsubscribe();
            state.firestoreUnsubscribe = null;
          }
          state.user = null;
          state.syncStatus = 'idle';
          state.statusMessage = 'Not logged in';
          updateUI();
        }
      });

      state.isInitialized = true;
      return true;
    } catch (err) {
      console.error('[Google Cloud Sync] Init error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Firebase init error: ' + err.message;
      updateUI();
      return false;
    }
  }

  // --- Real-Time Sync & Initial Pull from Google Cloud ---
  function setupRealtimeSync(uid) {
    if (!state.db) return;

    try {
      const docRef = state.db.collection(COLLECTION_USERS).doc(uid).collection('data').doc(DOC_TRACKER);

      // Fetch once on login to compare and load cloud progress
      docRef.get().then((doc) => {
        if (doc.exists) {
          const cloudData = doc.data();
          handleCloudDataReceived(cloudData, false);
        } else {
          // Cloud doc does not exist yet: push current local progress to cloud
          performSync(false);
        }
      }).catch(err => {
        console.warn('[Google Cloud Sync] Error fetching initial cloud doc:', err);
      });
    } catch (e) {
      console.warn('[Google Cloud Sync] setupRealtimeSync error:', e);
    }
  }

  function handleCloudDataReceived(cloudData, isLiveUpdate = false) {
    if (!cloudData || !cloudData.questions) return;

    const localData = window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function'
      ? window.JAM_TRACKER.getUserData()
      : null;

    const cloudSolvedCount = Object.values(cloudData.questions || {}).filter(q => q && q.solved).length;
    const localSolvedCount = localData
      ? Object.values(localData.questions || {}).filter(q => q && q.solved).length
      : 0;

    const cloudTimestamp = cloudData.lastUpdated ? new Date(cloudData.lastUpdated).getTime() : 0;
    const localTimestamp = (localData && localData.lastUpdated) ? new Date(localData.lastUpdated).getTime() : 0;

    // If cloud has more progress or is strictly newer, merge/update local tracker
    if (cloudSolvedCount > localSolvedCount || (cloudSolvedCount === localSolvedCount && cloudTimestamp > localTimestamp)) {
      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
        window.JAM_TRACKER.loadUserDataFromBackup({
          questions: cloudData.questions,
          oosMarkedUnnecessary: !!cloudData.oosMarkedUnnecessary,
          lastUpdated: cloudData.lastUpdated || new Date().toISOString()
        });
        state.lastSyncTime = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_CLOUD_SYNC, state.lastSyncTime);
        updateUI();
        showToast(`☁️ Loaded ${cloudSolvedCount} solved questions from your Google Cloud account.`);
      }
    } else if (localSolvedCount > cloudSolvedCount) {
      // Local has more solved questions, push local to cloud
      performSync(false);
    }
  }

  // --- Sign In with Google ---
  async function signInWithGoogle() {
    if (!state.config) {
      openModal();
      setTimeout(() => {
        const input = document.getElementById('gcloud-config-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return;
    }

    if (!state.isInitialized) {
      const ok = initFirebase();
      if (!ok) {
        alert('Firebase SDK is still loading or configuration is invalid. Please verify your settings.');
        return;
      }
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      state.syncStatus = 'syncing';
      state.statusMessage = 'Signing in with Google...';
      updateUI();

      const result = await state.auth.signInWithPopup(provider);
      const user = result.user;
      showToast(`✓ Welcome, ${user.displayName || user.email}! Connected to Google Cloud.`);
    } catch (err) {
      console.error('[Google Cloud Sync] Sign in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        state.syncStatus = 'idle';
        updateUI();
        return;
      }
      state.syncStatus = 'error';
      state.statusMessage = 'Sign-in error: ' + err.message;
      updateUI();
      alert('Google Sign-In failed:\n' + err.message);
    }
  }

  // --- Sign Out ---
  async function signOut() {
    const confirmLogout = confirm(
      'Are you sure you want to sign out of your Google Cloud account?\n\n' +
      '• Your saved progress on Google servers will NOT be deleted.\n' +
      '• New progress will only be stored locally until you sign back in.'
    );
    if (!confirmLogout) return;

    try {
      if (state.auth) {
        await state.auth.signOut();
      }
      state.user = null;
      state.syncStatus = 'idle';
      state.statusMessage = 'Signed out';
      updateUI();
      showToast('Signed out of Google Cloud.');
    } catch (e) {
      console.error('[Google Cloud Sync] Sign out error:', e);
    }
  }

  // --- Sync to Google Cloud Firestore ---
  async function performSync(isManual = false) {
    if (!state.user || !state.db) return;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing to Google Cloud...';
    updateHeaderButtonUI();

    try {
      const trackerData = window.JAM_TRACKER && typeof window.JAM_TRACKER.getUserData === 'function'
        ? window.JAM_TRACKER.getUserData()
        : null;

      if (!trackerData) return;

      const solvedCount = Object.values(trackerData.questions || {}).filter(q => q && q.solved).length;

      const docRef = state.db.collection(COLLECTION_USERS).doc(state.user.uid).collection('data').doc(DOC_TRACKER);

      const payload = {
        questions: trackerData.questions || {},
        oosMarkedUnnecessary: !!trackerData.oosMarkedUnnecessary,
        lastUpdated: new Date().toISOString(),
        userEmail: state.user.email,
        displayName: state.user.displayName,
        totalSolved: solvedCount,
        clientTimestamp: Date.now()
      };

      await docRef.set(payload, { merge: true });

      state.lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_CLOUD_SYNC, state.lastSyncTime);
      state.syncStatus = 'synced';
      state.statusMessage = `Saved to Google Cloud (${formatRelativeTime(state.lastSyncTime)})`;
      updateUI();

      if (isManual) {
        showToast('✓ Successfully synced progress to Google Cloud servers!');
      }
    } catch (err) {
      console.error('[Google Cloud Sync] Sync error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Cloud sync error: ' + err.message;
      updateUI();
      if (isManual) {
        alert('Could not sync to Google Cloud:\n' + err.message);
      }
    }
  }

  // --- Debounced Auto Sync ---
  function triggerAutoSync() {
    if (!state.user || !state.db) return;

    state.syncStatus = 'syncing';
    state.statusMessage = 'Syncing to Cloud...';
    updateHeaderButtonUI();

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(() => {
      performSync(false);
    }, 400);
  }

  // --- Restore from Google Cloud ---
  async function restoreFromCloud() {
    if (!state.user || !state.db) return;

    const confirmRestore = confirm(
      '⚠️ RESTORE FROM GOOGLE CLOUD\n\n' +
      'This will replace your current browser PYQ tracker progress with the backup stored in your Google Cloud account.\n\n' +
      'Are you sure you want to continue?'
    );
    if (!confirmRestore) return;

    try {
      state.syncStatus = 'syncing';
      state.statusMessage = 'Fetching from Google Cloud...';
      updateUI();

      const docRef = state.db.collection(COLLECTION_USERS).doc(state.user.uid).collection('data').doc(DOC_TRACKER);
      const doc = await docRef.get();

      if (!doc.exists) {
        alert('No saved progress found in your Google Cloud account yet. Solve some questions and click "Sync to Google Cloud Now"!');
        state.syncStatus = 'synced';
        updateUI();
        return;
      }

      const cloudData = doc.data();
      if (window.JAM_TRACKER && typeof window.JAM_TRACKER.loadUserDataFromBackup === 'function') {
        window.JAM_TRACKER.loadUserDataFromBackup({
          questions: cloudData.questions || {},
          oosMarkedUnnecessary: !!cloudData.oosMarkedUnnecessary,
          lastUpdated: cloudData.lastUpdated || new Date().toISOString()
        });
        state.lastSyncTime = new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_CLOUD_SYNC, state.lastSyncTime);
        state.syncStatus = 'synced';
        updateUI();
        showToast('✓ Progress successfully restored from Google Cloud!');
      }
    } catch (err) {
      console.error('[Google Cloud Sync] Restore error:', err);
      state.syncStatus = 'error';
      state.statusMessage = 'Restore failed: ' + err.message;
      updateUI();
      alert('Could not restore from Google Cloud:\n' + err.message);
    }
  }

  // --- Save / Configure Firebase Credentials ---
  function saveInputConfig(rawInput) {
    const parsed = parseConfigString(rawInput);
    if (!parsed) {
      alert('Invalid Firebase configuration format.\n\nPlease copy and paste the `firebaseConfig` object from your Firebase Console.');
      return false;
    }

    state.config = parsed;
    localStorage.setItem(STORAGE_FIREBASE_CONFIG, JSON.stringify(parsed));

    const ok = initFirebase();
    if (ok) {
      showToast('✓ Google Cloud Firebase configuration saved successfully!');
      renderModalContent();
    }
    return ok;
  }

  function clearSavedConfig() {
    const confirmClear = confirm('Are you sure you want to reset your Google Cloud Firebase configuration?');
    if (!confirmClear) return;

    if (state.user && state.auth) {
      state.auth.signOut();
    }
    localStorage.removeItem(STORAGE_FIREBASE_CONFIG);
    state.config = null;
    state.user = null;
    state.isInitialized = false;
    updateUI();
    showToast('Firebase configuration reset.');
  }

  // --- Time Formatters ---
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
        hour12: true
      });
    } catch (e) {
      return 'Never';
    }
  }

  // --- UI Rendering ---
  function updateHeaderButtonUI() {
    const btn = document.getElementById('btn-gcloud-sync');
    const label = document.getElementById('btn-gcloud-text');
    const dot = document.getElementById('gcloud-quick-dot');

    if (!btn) return;

    if (state.user) {
      btn.classList.add('logged-in');
      if (state.syncStatus === 'syncing') {
        if (label) label.textContent = 'Cloud: Syncing...';
        if (dot) dot.className = 'gcloud-status-indicator syncing';
        btn.setAttribute('title', 'Saving progress to Google Cloud servers...');
      } else if (state.syncStatus === 'error') {
        if (label) label.textContent = 'Cloud: Error';
        if (dot) dot.className = 'gcloud-status-indicator error';
        btn.setAttribute('title', 'Google Cloud sync error. Click to view details.');
      } else {
        const timeStr = formatRelativeTime(state.lastSyncTime);
        if (label) label.textContent = `Google: ${state.user.displayName.split(' ')[0]} (${timeStr})`;
        if (dot) dot.className = 'gcloud-status-indicator synced';
        btn.setAttribute('title', `Logged in as ${state.user.email} · Saved on Google Cloud · Last: ${formatFullDateTime(state.lastSyncTime)} (Never expires automatically)`);
      }
    } else {
      btn.classList.remove('logged-in');
      if (label) label.textContent = 'Sign in with Google';
      if (dot) dot.className = 'gcloud-status-indicator';
      btn.setAttribute('title', 'Sign in with your Google account to automatically sync your PYQ progress to Google Cloud servers (never expires)');
    }
  }

  function renderModalContent() {
    const modal = document.getElementById('gcloud-sync-modal');
    if (!modal) return;

    const isLoggedIn = !!state.user;
    const isConfigured = !!state.config;
    const currentOrigin = window.location.origin;

    let statusPillHtml = '';
    if (isLoggedIn) {
      if (state.syncStatus === 'syncing') {
        statusPillHtml = '<span class="gdrive-badge-status syncing">🔄 Syncing to Google Cloud...</span>';
      } else {
        statusPillHtml = '<span class="gdrive-badge-status synced">🟢 Connected · Google Cloud</span>';
      }
    } else {
      statusPillHtml = '<span class="gdrive-badge-status unlinked">⚪ Not Signed In</span>';
    }

    const userName = state.user?.displayName || 'Google User';
    const userEmail = state.user?.email || 'Not connected';
    const userPicture = state.user?.photoURL || '';

    modal.innerHTML = `
      <div class="modal-card gdrive-modal-card gcloud-modal-card">
        <div class="modal-header">
          <div class="modal-title">
            <svg class="google-logo-svg" viewBox="0 0 24 24" width="22" height="22">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Google Account Cloud Sync (Persistent Login)</span>
          </div>
          <button class="modal-close-btn" onclick="window.JAM_CLOUD_SYNC.closeModal()" title="Close (Esc)">✕</button>
        </div>

        <div class="modal-body">
          <!-- Connection Status Card -->
          <div class="gdrive-status-card ${isLoggedIn ? 'active' : ''}">
            <div class="gdrive-status-header">
              <div class="gdrive-user-meta">
                ${userPicture ? `<img src="${userPicture}" alt="${userName}" class="gdrive-user-avatar">` : '<div class="gdrive-user-avatar-placeholder">👤</div>'}
                <div>
                  <div class="gdrive-user-name">${isLoggedIn ? userName : 'Google Account Sync'}</div>
                  <div class="gdrive-user-email">${isLoggedIn ? userEmail : 'Sign in once — stays logged in permanently on Google servers'}</div>
                </div>
              </div>
              <div>${statusPillHtml}</div>
            </div>

            ${isLoggedIn ? `
              <div class="gdrive-file-info-box">
                <div class="gdrive-info-row" style="border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                  <span class="gdrive-info-label">☁️ Storage Engine:</span>
                  <span class="gdrive-info-val">
                    <strong style="color: #4285f4;">Google Cloud Firestore</strong>
                    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(Auto-persists forever)</span>
                  </span>
                </div>

                <div class="gdrive-info-row" style="margin-top: 6px; padding-top: 8px;">
                  <span class="gdrive-info-label">⏱️ Last Synced:</span>
                  <span class="gdrive-info-val">${formatFullDateTime(state.lastSyncTime)} (${formatRelativeTime(state.lastSyncTime)})</span>
                </div>

                <div class="gdrive-info-row">
                  <span class="gdrive-info-label">⚡ Auto-Sync Status:</span>
                  <span class="gdrive-info-val" style="color:#10b981; font-weight:700;">
                    ✓ Active — Real-time cloud sync on every solve
                  </span>
                </div>
              </div>

              <!-- Action Controls for Logged In User -->
              <div class="gdrive-action-buttons-grid">
                <button class="btn-gdrive-action primary" onclick="window.JAM_CLOUD_SYNC.syncNow()" style="background:#4285f4; color:#fff; font-weight:700;">
                  <span>🔄</span> <span>Sync to Google Cloud Now</span>
                </button>
                <button class="btn-gdrive-action secondary" onclick="window.JAM_CLOUD_SYNC.restoreFromCloud()">
                  <span>📥</span> <span>Restore from Google Cloud</span>
                </button>
                <button class="btn-gdrive-action danger" onclick="window.JAM_CLOUD_SYNC.signOut()">
                  <span>🚪</span> <span>Sign Out of Google</span>
                </button>
              </div>
            ` : `
              <div class="gdrive-features-list">
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">🔒</span>
                  <div>
                    <strong>Permanent Login — Never Auto-Expires</strong>
                    <p>Unlike 1-hour Drive OAuth tokens, Google Cloud Firebase sessions persist indefinitely in your browser. You stay signed in until you manually click Sign Out.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">⚡</span>
                  <div>
                    <strong>Real-Time Cloud Synchronization</strong>
                    <p>Every question you solve or note you take is automatically saved into your dedicated Google Cloud database document.</p>
                  </div>
                </div>
                <div class="gdrive-feature-item">
                  <span class="gdrive-feature-icon">📱</span>
                  <div>
                    <strong>Seamless Multi-Device Continuity</strong>
                    <p>Open this portal on your laptop, iPad, or smartphone, sign in with your Google account, and your entire PYQ progress loads instantly.</p>
                  </div>
                </div>
              </div>

              <div style="margin-top: 18px; text-align: center;">
                <button class="btn-test primary gdrive-connect-hero-btn" onclick="window.JAM_CLOUD_SYNC.signIn()" style="background:#4285f4; border-color:#4285f4; color:#fff; font-weight:700; padding:12px 24px; font-size:0.95rem;">
                  <svg class="google-logo-svg" viewBox="0 0 24 24" width="18" height="18" style="background:#fff; border-radius:50%; padding:2px; margin-right:8px;">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            `}
          </div>

          <!-- Firebase Cloud Database Configuration Accordion -->
          <div class="gdrive-config-accordion">
            <details class="gdrive-details" ${!isConfigured ? 'open' : ''}>
              <summary class="gdrive-summary">
                <span>⚙️ Google Cloud / Firebase Project Settings</span>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">${isConfigured ? '(Configured in your browser ✓)' : '(One-time 2-minute setup)'}</span>
              </summary>
              <div class="gdrive-details-content">
                <p class="gdrive-config-hint">
                  Your Firebase client config connects this tracker directly to your private Google Cloud database. It is stored safely in your browser's local storage.
                </p>

                <div class="gdrive-input-group">
                  <label for="gcloud-config-input" class="gdrive-input-label">Paste Firebase Web Configuration (JSON or JavaScript object):</label>
                  <textarea id="gcloud-config-input" class="gdrive-input-field" style="width:100%; min-height:85px; font-family:monospace; font-size:0.78rem; resize:vertical; padding:8px;" placeholder='const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-app.firebaseapp.com",\n  projectId: "my-app",\n  storageBucket: "my-app.appspot.com",\n  messagingSenderId: "...",\n  appId: "..."\n};'>${state.config ? JSON.stringify(state.config, null, 2) : ''}</textarea>
                  <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="btn-test primary" onclick="window.JAM_CLOUD_SYNC.saveConfigFromInput()">Save Configuration</button>
                    ${isConfigured ? '<button class="btn-test secondary" onclick="window.JAM_CLOUD_SYNC.clearConfig()">Reset Config</button>' : ''}
                  </div>
                </div>

                <div class="gdrive-instructions-card">
                  <div class="gdrive-instructions-title">📋 2-Minute Google Cloud / Firebase Setup Guide:</div>
                  <ol class="gdrive-instructions-list">
                    <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:700;">Firebase Console</a> (Google's official app platform).</li>
                    <li>Click <strong>+ Add project</strong>, enter a name (e.g. <code>IIT-JAM-Tracker</code>), and click <strong>Create project</strong> (100% Free Spark plan).</li>
                    <li>In the left sidebar, click <strong>Build → Authentication</strong>, click <em>Get started</em>, select <strong>Google</strong> under Sign-in providers, and click <strong>Enable</strong>.</li>
                    <li>Under <strong>Authentication → Settings → Authorized domains</strong>, ensure <code>${window.location.hostname}</code> is listed.</li>
                    <li>Click <strong>Build → Firestore Database</strong>, click <em>Create database</em>, choose <strong>Start in test mode</strong> (or allow auth users), and click <em>Create</em>.</li>
                    <li>Click the <strong>⚙️ Project settings</strong> gear icon at top left, scroll down to <em>Your apps</em>, click the Web icon (<strong>&lt;/&gt;</strong>), copy the <code>firebaseConfig</code> code snippet, paste it in the box above, and click <strong>Save Configuration</strong>!</li>
                  </ol>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; border-top: 1px solid var(--border);">
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            🔒 Stored securely in your private Google Cloud Firestore · Zero data sold or shared
          </span>
          <button type="button" class="btn-test secondary" onclick="window.JAM_CLOUD_SYNC.closeModal()">Close</button>
        </div>
      </div>
    `;
  }

  function updateUI() {
    updateHeaderButtonUI();
    const modal = document.getElementById('gcloud-sync-modal');
    if (modal && !modal.classList.contains('hidden')) {
      renderModalContent();
    }
  }

  function openModal() {
    const modal = document.getElementById('gcloud-sync-modal');
    if (!modal) return;
    renderModalContent();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('gcloud-sync-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function saveConfigFromInput() {
    const input = document.getElementById('gcloud-config-input');
    if (input) {
      saveInputConfig(input.value);
    }
  }

  function showToast(msg) {
    if (window.JAM_TRACKER && typeof window.JAM_TRACKER.showToast === 'function') {
      window.JAM_TRACKER.showToast(msg);
    } else {
      console.log('[Google Cloud Sync]', msg);
    }
  }

  // --- Public API ---
  window.JAM_CLOUD_SYNC = {
    init: function() {
      if (typeof firebase !== 'undefined') {
        initFirebase();
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (typeof firebase !== 'undefined') {
            initFirebase();
            clearInterval(interval);
          } else if (attempts > 30) {
            clearInterval(interval);
          }
        }, 200);
      }

      updateUI();

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('gcloud-sync-modal');
          if (modal && !modal.classList.contains('hidden')) {
            closeModal();
          }
        }
      });
    },

    openModal: openModal,
    closeModal: closeModal,
    signIn: signInWithGoogle,
    signOut: signOut,
    syncNow: () => performSync(true),
    triggerAutoSync: triggerAutoSync,
    restoreFromCloud: restoreFromCloud,
    saveConfigFromInput: saveConfigFromInput,
    clearConfig: clearSavedConfig,
    isLoggedIn: () => !!state.user,
    getUser: () => state.user,
    getSyncStatus: () => state.syncStatus
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.JAM_CLOUD_SYNC.init());
  } else {
    window.JAM_CLOUD_SYNC.init();
  }

})();

