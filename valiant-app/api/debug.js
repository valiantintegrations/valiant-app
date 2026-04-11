export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  const API_KEY = '256e1837483dedcf3e993dbef92b9846';
  const BASE = 'https://app.jetbuilt.com/api';
 
  try {
    // Fetch first page and return raw data so we can see the structure
    const response = await fetch(`${BASE}/projects?page=1`, {
      headers: {
        'Authorization': `Token token=${API_KEY}`,
        'Accept': 'application/vnd.jetbuilt.v1',
        'Content-Type': 'application/json'
      }
    });
 
    const data = await response.json();
    
    // Return first 3 projects with ALL fields so we can see the structure
    const sample = Array.isArray(data) ? data.slice(0, 3) : data;
    
    res.status(200).json({
      total_returned: Array.isArray(data) ? data.length : 0,
      response_headers: {
        'x-total-count': response.headers.get('x-total-count'),
        'link': response.headers.get('link')
      },
      sample_projects: sample
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
 
