export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract the subpath after /api/anthropic/
  // e.g., /api/anthropic/v1/messages → /v1/messages
  const subpath = req.url.replace(/^\/api\/anthropic/, '');
  const targetUrl = `https://api.anthropic.com${subpath}`;

  // Forward relevant headers
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': req.headers['x-api-key'] || '',
    'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
  };

  try {
    const isStreaming = req.body?.stream === true;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      res.status(response.status);
      res.setHeader('Content-Type', 'application/json');
      return res.end(errorBody);
    }

    if (isStreaming) {
      // Stream the response back
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (streamErr) {
        // Client may have disconnected
      } finally {
        res.end();
      }
    } else {
      // Non-streaming: forward the full response
      const body = await response.text();
      res.setHeader('Content-Type', 'application/json');
      res.status(response.status);
      res.end(body);
    }
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Proxy error' } });
  }
}
