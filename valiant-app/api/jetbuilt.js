export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.JETBUILT_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'JETBUILT_API_KEY env var not set on server' });
  }

  const BASE = 'https://app.jetbuilt.com/api';
  const endpoint = req.query.endpoint || '/projects';

  // Safety: only allow relative paths starting with '/' — blocks SSRF via full URLs
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid endpoint — must start with /' });
  }

  try {
    const response = await fetch(`${BASE}${endpoint}`, {
      headers: {
        'Authorization': `Token token=${API_KEY}`,
        'Accept': 'application/vnd.jetbuilt.v1',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
