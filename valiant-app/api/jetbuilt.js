export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = '256e1837483dedcf3e993dbef92b9846';
  const BASE = 'https://app.jetbuilt.com/api';

  const endpoint = req.query.endpoint || '/projects';
  const url = `${BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
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
