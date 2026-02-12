// apps/signaling/index.js
// AGPLv3 — OpenMind Collective
// This is the ONLY centralized component. It's just a phonebook.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Store peer offers (expire after 5 minutes)
    if (request.method === 'POST' && url.pathname === '/offer') {
      const { peerId, sdp } = await request.json();
      await env.PEERS.put(peerId, JSON.stringify({
        sdp,
        timestamp: Date.now()
      }), { expirationTtl: 300 });
      
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: corsHeaders
      });
    }

    // Get offer for a specific peer
    if (request.method === 'GET' && url.pathname.startsWith('/offer/')) {
      const peerId = url.pathname.split('/')[2];
      const data = await env.PEERS.get(peerId);
      
      if (!data) {
        return new Response(JSON.stringify({ error: 'peer not found' }), {
          status: 404,
          headers: corsHeaders
        });
      }

      return new Response(data, { headers: corsHeaders });
    }

    // List all active peers
    if (request.method === 'GET' && url.pathname === '/peers') {
      const list = await env.PEERS.list();
      const peers = list.keys.map(k => k.name);
      
      return new Response(JSON.stringify({ peers }), {
        headers: corsHeaders
      });
    }

    return new Response('OpenMind Signaling Server', { headers: corsHeaders });
  }
}
