/**
 * Vaibhav Priyadarshi — All-in-One Cloud Sync Worker (Hardened)
 * Built for Cloudflare Workers + KV Storage
 *
 * Security & Reliability Features:
 * - Origin-restricted CORS allowlist (with localhost dev support)
 * - Edge rate limiting (supports Cloudflare Rate Limiting binding + per-isolate burst guard)
 * - Cryptographic write-token verification (SHA-256 hash stored in KV metadata)
 *   with seamless one-time upgrade/claim for legacy codes
 * - Minimum 8-char code requirement for new registrations (4-24 chars allowed for legacy reads)
 * - 512 KB payload cap + schema whitelist validation
 * - Optimistic concurrency control via revision numbers (409 Conflict on stale writes)
 * - Protected DELETE endpoint requiring valid write token
 */

const TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB
const MIN_NEW_CODE_LENGTH = 8;
const MIN_LEGACY_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 24;

const ALLOWED_ORIGINS = new Set([
  'https://vaibhavgeometer.github.io'
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'app',
  'version',
  'syncCode',
  'updatedAt',
  'serverSyncedAt',
  'revision',
  'expectedRevision',
  'jam',
  'unpg',
  'preferences',
  // Legacy v1.2 / v2 keys
  'questions',
  'oosMarkedUnnecessary',
  'lastUpdated',
  'portal',
  'tracker',
  'scores',
  'data'
]);

// Lightweight per-isolate sliding-window guard (complements Cloudflare WAF / Rate Limiting binding)
const isolateRateBuckets = new Map();
const isolateFailureBuckets = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQ_PER_MIN = 60;
const MAX_FAIL_PER_MIN = 15;

function checkSlidingBucket(map, key, limit) {
  const now = Date.now();
  // Prune stale entries occasionally to keep memory bounded
  if (map.size > 2000) {
    for (const [k, entry] of map.entries()) {
      if (now - entry.start > WINDOW_MS) map.delete(k);
    }
  }
  const existing = map.get(key);
  if (!existing || now - existing.start > WINDOW_MS) {
    map.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count)
  };
}

function isOriginAllowed(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (env && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
}

function buildCorsHeaders(origin, env) {
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Token, X-Expected-Revision, If-Match',
    'Access-Control-Expose-Headers': 'X-Sync-Revision, X-Sync-Protected',
    'Access-Control-Max-Age': '86400'
  };
  if (isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders
    }
  });
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractWriteToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token.length >= 16 && token.length <= 128) return token;
  }
  const headerToken = (request.headers.get('X-Sync-Token') || '').trim();
  if (headerToken.length >= 16 && headerToken.length <= 128) return headerToken;
  return null;
}

function parseExpectedRevision(request, payload) {
  const ifMatch = request.headers.get('If-Match') || request.headers.get('X-Expected-Revision');
  if (ifMatch !== null && ifMatch !== '') {
    const cleaned = String(ifMatch).replace(/^"|"$/g, '').trim();
    const parsed = Number(cleaned);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  if (payload && Number.isInteger(payload.expectedRevision) && payload.expectedRevision >= 0) {
    return payload.expectedRevision;
  }
  return null;
}

function validatePayloadSchema(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload must be a JSON object.';
  }
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    return 'Payload cannot be empty.';
  }
  for (const key of keys) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return `Unsupported payload key: ${key}`;
    }
  }
  if (payload.jam !== undefined && (typeof payload.jam !== 'object' || payload.jam === null || Array.isArray(payload.jam))) {
    return 'Invalid jam section.';
  }
  if (payload.unpg !== undefined && (typeof payload.unpg !== 'object' || payload.unpg === null || Array.isArray(payload.unpg))) {
    return 'Invalid unpg section.';
  }
  if (payload.preferences !== undefined && (typeof payload.preferences !== 'object' || payload.preferences === null || Array.isArray(payload.preferences))) {
    return 'Invalid preferences section.';
  }
  return null;
}

async function verifyTokenAgainstMeta(request, meta) {
  if (!meta || !meta.tokenHash) {
    return { protected: false, authorized: true };
  }
  const token = extractWriteToken(request);
  if (!token) {
    return { protected: true, authorized: false, reason: 'Missing write token.' };
  }
  const candidateHash = await sha256Hex(token);
  const ok = constantTimeEqual(candidateHash, meta.tokenHash);
  return {
    protected: true,
    authorized: ok,
    reason: ok ? null : 'Invalid write token.'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin, env);

    // Preflight OPTIONS response
    if (request.method === 'OPTIONS') {
      if (origin && !isOriginAllowed(origin, env)) {
        return new Response(null, { status: 403, headers: corsHeaders });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check root
    if (url.pathname === '/' || url.pathname === '/api') {
      return jsonResponse({
        status: 'online',
        service: 'Vaibhav Portal Cloud Sync Engine',
        version: '2.0.0',
        docs: 'Use GET/POST /api/sync/:code'
      }, 200, corsHeaders);
    }

    // Reject disallowed browser origins on API routes
    if (origin && !isOriginAllowed(origin, env)) {
      return jsonResponse({ error: 'Origin not allowed.' }, 403, corsHeaders);
    }

    // Match /api/sync/:code or /sync/:code
    const match = url.pathname.match(/^\/(?:api\/)?sync\/([A-Za-z0-9_-]+)$/);
    if (!match) {
      return jsonResponse({ error: 'Endpoint not found. Use /api/sync/:code' }, 404, corsHeaders);
    }

    // Edge Rate Limiting (Cloudflare binding if configured + per-isolate burst guard)
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env && env.SYNC_LIMITER && typeof env.SYNC_LIMITER.limit === 'function') {
      const limitRes = await env.SYNC_LIMITER.limit({ key: clientIp });
      if (!limitRes.success) {
        return jsonResponse(
          { error: 'Rate limit exceeded. Please wait a moment before syncing again.' },
          429,
          corsHeaders,
          { 'Retry-After': '60' }
        );
      }
    }
    const reqBucket = checkSlidingBucket(isolateRateBuckets, clientIp, MAX_REQ_PER_MIN);
    if (!reqBucket.allowed) {
      return jsonResponse(
        { error: 'Too many requests. Please slow down.' },
        429,
        corsHeaders,
        { 'Retry-After': '60' }
      );
    }

    // Normalize code: uppercase, strip punctuation except alphanumeric
    const rawCode = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (rawCode.length < MIN_LEGACY_CODE_LENGTH || rawCode.length > MAX_CODE_LENGTH) {
      return jsonResponse({ error: 'Invalid sync code format. Must be 4-24 alphanumeric characters.' }, 400, corsHeaders);
    }

    if (!env || !env.JAM_SYNC_KV) {
      return jsonResponse({
        error: 'JAM_SYNC_KV binding is missing. Please bind a KV namespace named JAM_SYNC_KV in wrangler.toml or Cloudflare dashboard.'
      }, 500, corsHeaders);
    }

    const kvKey = `jam_sync_${rawCode}`;

    // 1. GET /api/sync/:code -> Fetch backup payload
    if (request.method === 'GET') {
      try {
        const result = await env.JAM_SYNC_KV.getWithMetadata(kvKey);
        const stored = result ? result.value : null;
        const meta = (result && result.metadata) || {};

        if (!stored) {
          const failBucket = checkSlidingBucket(isolateFailureBuckets, clientIp, MAX_FAIL_PER_MIN);
          if (!failBucket.allowed) {
            return jsonResponse(
              { error: 'Too many failed lookups. Please wait before retrying.' },
              429,
              corsHeaders,
              { 'Retry-After': '60' }
            );
          }
          return jsonResponse({
            found: false,
            error: 'Sync code not found or expired',
            code: rawCode
          }, 404, corsHeaders);
        }

        const revision = Number.isInteger(meta.revision) ? meta.revision : 1;
        return new Response(stored, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Sync-Revision': String(revision),
            'X-Sync-Protected': meta.tokenHash ? 'true' : 'false'
          }
        });
      } catch (err) {
        return jsonResponse({ error: 'KV retrieval failed: ' + err.message }, 500, corsHeaders);
      }
    }

    // 2. POST or PUT /api/sync/:code -> Store/Update backup payload
    if (request.method === 'POST' || request.method === 'PUT') {
      try {
        const contentLengthHeader = request.headers.get('Content-Length');
        if (contentLengthHeader) {
          const declaredBytes = Number(contentLengthHeader);
          if (!Number.isNaN(declaredBytes) && declaredBytes > MAX_PAYLOAD_BYTES) {
            return jsonResponse(
              { error: `Payload too large. Maximum allowed size is ${MAX_PAYLOAD_BYTES} bytes.` },
              413,
              corsHeaders
            );
          }
        }

        const rawBody = await request.text();
        const byteLength = new TextEncoder().encode(rawBody).length;
        if (byteLength > MAX_PAYLOAD_BYTES) {
          return jsonResponse(
            { error: `Payload too large (${byteLength} bytes). Maximum allowed size is ${MAX_PAYLOAD_BYTES} bytes.` },
            413,
            corsHeaders
          );
        }

        let payload;
        try {
          payload = JSON.parse(rawBody);
        } catch (parseErr) {
          return jsonResponse({ error: 'Invalid JSON payload' }, 400, corsHeaders);
        }

        const schemaErr = validatePayloadSchema(payload);
        if (schemaErr) {
          return jsonResponse({ error: schemaErr }, 400, corsHeaders);
        }

        const existing = await env.JAM_SYNC_KV.getWithMetadata(kvKey);
        const existingValue = existing ? existing.value : null;
        const existingMeta = (existing && existing.metadata) || {};

        // Require higher entropy for newly created sync keys
        if (!existingValue && rawCode.length < MIN_NEW_CODE_LENGTH) {
          return jsonResponse({
            error: `New sync codes must be at least ${MIN_NEW_CODE_LENGTH} alphanumeric characters.`
          }, 400, corsHeaders);
        }

        // Verify write token if record is already protected
        const authCheck = await verifyTokenAgainstMeta(request, existingMeta);
        if (!authCheck.authorized) {
          checkSlidingBucket(isolateFailureBuckets, clientIp, MAX_FAIL_PER_MIN);
          return jsonResponse({
            error: authCheck.reason,
            code: rawCode,
            protected: true
          }, 403, corsHeaders);
        }

        // Optimistic concurrency check
        const currentRevision = Number.isInteger(existingMeta.revision)
          ? existingMeta.revision
          : (existingValue ? 1 : 0);
        const expectedRevision = parseExpectedRevision(request, payload);
        if (existingValue && expectedRevision !== null && expectedRevision !== currentRevision) {
          return jsonResponse({
            error: 'Revision conflict: newer cloud state exists.',
            code: rawCode,
            currentRevision
          }, 409, corsHeaders, { 'X-Sync-Revision': String(currentRevision) });
        }

        // Attach or preserve tokenHash (one-time upgrade for legacy records when client supplies token)
        const suppliedToken = extractWriteToken(request);
        let tokenHash = existingMeta.tokenHash || null;
        if (!tokenHash && suppliedToken) {
          tokenHash = await sha256Hex(suppliedToken);
        }

        const nextRevision = currentRevision + 1;
        const serverSyncedAt = new Date().toISOString();

        // Strip transient request-only fields before persisting
        const cleanPayload = { ...payload };
        delete cleanPayload.expectedRevision;
        cleanPayload.serverSyncedAt = serverSyncedAt;
        cleanPayload.syncCode = rawCode;
        cleanPayload.revision = nextRevision;

        const serialized = JSON.stringify(cleanPayload);
        if (new TextEncoder().encode(serialized).length > MAX_PAYLOAD_BYTES) {
          return jsonResponse(
            { error: `Serialized payload exceeds ${MAX_PAYLOAD_BYTES} bytes.` },
            413,
            corsHeaders
          );
        }

        await env.JAM_SYNC_KV.put(kvKey, serialized, {
          expirationTtl: TTL_SECONDS,
          metadata: {
            tokenHash,
            revision: nextRevision,
            updatedAt: serverSyncedAt
          }
        });

        return jsonResponse({
          success: true,
          code: rawCode,
          syncedAt: serverSyncedAt,
          revision: nextRevision,
          protected: !!tokenHash,
          sizeBytes: serialized.length
        }, 200, corsHeaders, {
          'X-Sync-Revision': String(nextRevision),
          'X-Sync-Protected': tokenHash ? 'true' : 'false'
        });
      } catch (err) {
        return jsonResponse({ error: 'Failed to save progress: ' + err.message }, 500, corsHeaders);
      }
    }

    // 3. DELETE /api/sync/:code -> Protected delete requiring valid write token
    if (request.method === 'DELETE') {
      try {
        const existing = await env.JAM_SYNC_KV.getWithMetadata(kvKey);
        if (!existing || !existing.value) {
          return jsonResponse({ found: false, error: 'Sync code not found' }, 404, corsHeaders);
        }
        const meta = existing.metadata || {};
        if (!meta.tokenHash) {
          return jsonResponse({
            error: 'Unprotected legacy sync codes cannot be deleted remotely without claiming a write token first.'
          }, 403, corsHeaders);
        }
        const authCheck = await verifyTokenAgainstMeta(request, meta);
        if (!authCheck.authorized) {
          checkSlidingBucket(isolateFailureBuckets, clientIp, MAX_FAIL_PER_MIN);
          return jsonResponse({ error: authCheck.reason, protected: true }, 403, corsHeaders);
        }

        await env.JAM_SYNC_KV.delete(kvKey);
        return jsonResponse({ success: true, deleted: true, code: rawCode }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ error: 'Failed to delete: ' + err.message }, 500, corsHeaders);
      }
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }
};
