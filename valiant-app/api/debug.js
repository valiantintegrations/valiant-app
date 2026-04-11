export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = '256e1837483dedcf3e993dbef92b9846';
  const BASE = 'https://app.jetbuilt.com/api';

  try {
    const response = await fetch(`${BASE}/projects?page=1`, {
      headers: {
        'Authorization': `Token token=${API_KEY}`,
        'Accept': 'application/vnd.jetbuilt.v1',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    // Show stage breakdown across all returned projects
    const stageCount = {};
    if (Array.isArray(data)) {
      data.forEach(p => {
        const s = p.stage || 'undefined';
        stageCount[s] = (stageCount[s] || 0) + 1;
      });
    }

    res.status(200).json({
      total: Array.isArray(data) ? data.length : 0,
      stage_breakdown: stageCount,
      sample_stages: Array.isArray(data) ? data.slice(0,10).map(p => ({ name: p.name, stage: p.stage, custom_id: p.custom_id })) : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
