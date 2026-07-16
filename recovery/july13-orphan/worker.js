export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 1. BASELINE SECURITY HARDENING
    const securityHeaders = {
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Access-Control-Allow-Origin": "https://forge-atlas.io"
    };

    // 2. AI ECOSYSTEM API ROUTE
    if (url.pathname === '/api/ai-health') {
      // Endpoint for the Synthetic Monitor to hit and warm up the edge
      return new Response(JSON.stringify({ status: "AI Ecosystem Online", timestamp: Date.now() }), {
        headers: { "Content-Type": "application/json", ...securityHeaders }
      });
    }

    if (url.pathname.startsWith('/api/ask-ai')) {
      // Secure endpoint utilizing Cloudflare Workers AI natively
      if (request.method !== 'POST') return new Response("POST required", { status: 405 });
      
      try {
        const body = await request.json();
        const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: body.prompt || "Hello Atlas." }]
        });
        return new Response(JSON.stringify(aiResponse), {
            headers: { "Content-Type": "application/json", ...securityHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: securityHeaders });
      }
    }

    // 3. FALLBACK FOR DYNAMIC/STATIC FRONTEND
    // If it's not an API call, it passes the request through normally but injects security headers
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    
    return newResponse;
  }
};
