export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const targetUrl = 'https://api.anthropic.com/v1/messages';

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
      } catch {
        // client disconnected
      } finally {
        res.end();
      }
    } else {
      const body = await response.text();
      res.setHeader('Content-Type', 'application/json');
      res.status(response.status);
      res.end(body);
    }
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Proxy error' } });
  }
}
