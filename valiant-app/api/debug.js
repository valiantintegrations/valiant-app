export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = '256e1837483dedcf3e993dbef92b9846';
  const BASE = 'https://app.jetbuilt.com/api';

  try {
    // Fetch first 3 pages to get a sample
    const response = await fetch(`${BASE}/projects?page=1`, {
      headers: {
        'Authorization': `Token token=${API_KEY}`,
        'Accept': 'application/vnd.jetbuilt.v1',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    // Show stage distribution
    const stageCounts = {};
    if (Array.isArray(data)) {
      data.forEach(p => {
        const s = p.stage || 'null';
        stageCounts[s] = (stageCounts[s] || 0) + 1;
      });
    }
    
    res.status(200).json({
      total: response.headers.get('x-total-count'),
      stage_distribution_page1: stageCounts,
      sample_stages: Array.isArray(data) ? data.slice(0,10).map(p => ({ id: p.custom_id, name: p.name, stage: p.stage })) : data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
