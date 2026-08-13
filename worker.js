export default {
  async fetch(request) {
    addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let targetUrl = url.searchParams.get('url');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*'
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (!targetUrl) return new Response('Proxy Ready. Usage: /?url=URL_HERE', { status: 200 });

  try {
    targetUrl = decodeURIComponent(targetUrl).trim();
    const forwardHeaders = new Headers();
    
    // Default Browser Emulation
    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    forwardHeaders.set('Accept', '*/*');
    forwardHeaders.set('Accept-Language', 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7');

    const lowerUrl = targetUrl.toLowerCase();

    
    // 1. Logic for PLANETA / SMOTRIM / VGTRK / CDNVIDEO
    if (lowerUrl.includes('planeta') || lowerUrl.includes('vgtrk') || lowerUrl.includes('cdnvideo') || lowerUrl.includes('smotrim')) {
      const russiaIp = `185.120.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      
      // Имитация версии для iOS
      forwardHeaders.set('User-Agent', 'VTRKPlayer/3.4.0 (iPhone; iOS 17.4.1; Scale/3.00)');
      
      // Улаляем все стандартные заголовки Cloudflare
      forwardHeaders.delete('cf-connecting-ip');
      forwardHeaders.delete('cf-ipcountry');
      forwardHeaders.delete('cf-ray');
      forwardHeaders.delete('cf-visitor');
      
      // Заголовок реального IP (Ростелеком)
      forwardHeaders.set('X-Forwarded-For', russiaIp);
      forwardHeaders.set('X-Real-IP', russiaIp);
      forwardHeaders.set('Client-IP', russiaIp);
      forwardHeaders.set('True-Client-IP', russiaIp);
      
      forwardHeaders.set('Origin', 'https://smotrim.ru');
      forwardHeaders.set('Referer', 'https://smotrim.ru');
      forwardHeaders.set('Accept', '*/*');
      forwardHeaders.set('Connection', 'keep-alive');
      forwardHeaders.set('Sec-Fetch-Dest', 'empty');
      forwardHeaders.set('Sec-Fetch-Mode', 'cors');
      forwardHeaders.set('Sec-Fetch-Site', 'cross-site');
    }

    // 2. Logic for NTV (New)
    else if (lowerUrl.includes('ntv.ru') || lowerUrl.includes('ntv-cdn') || lowerUrl.includes('sync-ntv')) {
      forwardHeaders.set('Referer', 'https://www.ntv.ru');
      forwardHeaders.set('Origin', 'https://www.ntv.ru');
      const ntvIp = `176.192.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      forwardHeaders.set('X-Forwarded-For', ntvIp);
      forwardHeaders.set('X-Real-IP', ntvIp);
      forwardHeaders.set('Sec-Fetch-Dest', 'empty');
      forwardHeaders.set('Sec-Fetch-Mode', 'cors');
      forwardHeaders.set('Sec-Fetch-Site', 'cross-site');
    }
    // 3. Logic for Televizor24
    else if (lowerUrl.includes('televizor-24') || lowerUrl.includes('televizor24')) {
      forwardHeaders.set('Referer', 'https://televizor24tochka.ru');
      forwardHeaders.set('Origin', 'https://televizor24tochka.ru');
    } 
    // Default Fallback
    else {
      forwardHeaders.set('Referer', 'https://smotrim.ru');
      const defaultIp = `31.173.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      forwardHeaders.set('X-Forwarded-For', defaultIp);
    }

    const response = await fetch(targetUrl, { 
      headers: forwardHeaders, 
      redirect: 'follow' 
    });

    if (response.status === 403) {
      return new Response('CDN Error: 403 (Forbidden). Link expired or Cloudflare IP blocked.', { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // M3U8 Playlist Rewriting
    if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('apple.mpegurl')) {
      let text = await response.text();
      
      const modifiedText = text.split('\n').map(line => {
        line = line.trim();
        if (!line) return '';
        
        // Fix Encryption Keys (URI)
        if (line.includes('URI=')) {
          return line.replace(/URI=["']([^"']+)["']/, (match, p1) => {
            const abs = new URL(p1, targetUrl).href;
            return `URI="${url.origin}/?url=${encodeURIComponent(abs)}"`;
          });
        }
        
        // Fix Segments (.ts / .m4s)
        if (!line.startsWith('#')) {
          const abs = new URL(line, targetUrl).href;
          return `${url.origin}/?url=${encodeURIComponent(abs)}`;
        }
        
        return line;
      }).join('\n');

      return new Response(modifiedText, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Binary Data (Segments)
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('content-security-policy');
    newHeaders.delete('x-frame-options');
    Object.keys(corsHeaders).forEach(k => newHeaders.set(k, corsHeaders[k]));

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });

  } catch (e) {
    return new Response('Worker Error: ' + e.message, { status: 500, headers: corsHeaders });
  }
}
  }
}

