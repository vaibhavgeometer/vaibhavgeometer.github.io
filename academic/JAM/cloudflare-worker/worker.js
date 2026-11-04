/**
 * IIT JAM Mathematics (MA) — 6-Digit Cloud Sync Worker
 * Built for Cloudflare Workers + KV Storage
 * 
 * Free Tier Limits:
 * - 100,000 requests per day (100% Free)
 * - 1 GB total KV storage
 * - No credit card required on Cloudflare
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Standard CORS headers for static site access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight OPTIONS response
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check root
    if (url.pathname === '/' || url.pathname === '/api') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'IIT JAM MA PYQ Cloud Sync Engine',
        version: '1.2.0',
        docs: 'Use GET/POST /api/sync/:code'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Match /api/sync/:code or /sync/:code
    const match = url.pathname.match(/^\/(?:api\/)?sync\/([A-Za-z0-9_-]+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Endpoint not found. Use /api/sync/:code' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize code: uppercase, strip punctuation except alphanumeric
    const rawCode = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (rawCode.length < 4 || rawCode.length > 24) {
      return new Response(JSON.stringify({ error: 'Invalid sync code format. Must be 4-24 characters.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ensure KV namespace is bound
    if (!env.JAM_SYNC_KV) {
      return new Response(JSON.stringify({
        error: 'JAM_SYNC_KV binding is missing. Please bind a KV namespace named JAM_SYNC_KV in wrangler.toml or Cloudflare dashboard.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const kvKey = `jam_sync_${rawCode}`;

    // 1. GET /api/sync/:code -> Fetch backup payload
    if (request.method === 'GET') {
      try {
        const stored = await env.JAM_SYNC_KV.get(kvKey);
        if (!stored) {
          return new Response(JSON.stringify({
            found: false,
            error: 'Sync code not found or expired',
            code: rawCode
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(stored, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'KV retrieval failed: ' + err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. POST or PUT /api/sync/:code -> Store/Update backup payload
    if (request.method === 'POST' || request.method === 'PUT') {
      try {
        const payload = await request.json();
        if (!payload || typeof payload !== 'object') {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Attach server sync metadata
        payload.serverSyncedAt = new Date().toISOString();
        payload.syncCode = rawCode;

        // 180 days TTL (6 months of inactivity before pruning; auto-refreshed on every sync)
        const TTL_SECONDS = 180 * 24 * 60 * 60;

        await env.JAM_SYNC_KV.put(kvKey, JSON.stringify(payload), {
          expirationTtl: TTL_SECONDS
        });

        return new Response(JSON.stringify({
          success: true,
          code: rawCode,
          syncedAt: payload.serverSyncedAt,
          sizeBytes: JSON.stringify(payload).length
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to save progress: ' + err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 3. DELETE /api/sync/:code -> Unlink / clear cloud data
    if (request.method === 'DELETE') {
      try {
        await env.JAM_SYNC_KV.delete(kvKey);
        return new Response(JSON.stringify({ success: true, deleted: true, code: rawCode }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to delete: ' + err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

