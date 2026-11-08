/**
 * DDU Result Finder — Cloudflare Worker Proxy
 * Enables high-speed CORS-free access to result.ddugu.ac.in for the static web portal.
 */

const TARGET_PORTAL = 'https://result.ddugu.ac.in/result2023/searchresult_new.aspx';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/api/status') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'DDU Result Finder Cloudflare Worker',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Direct proxy endpoint
    if (url.pathname === '/api/proxy') {
      const targetUrl = url.searchParams.get('url') || TARGET_PORTAL;
      
      const forwardReq = new Request(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': TARGET_PORTAL,
          ...(request.headers.get('content-type') ? { 'Content-Type': request.headers.get('content-type') } : {})
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual'
      });

      const response = await fetch(forwardReq);
      
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

