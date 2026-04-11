export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = '256e1837483dedcf3e993dbef92b9846';
  const BASE = 'https://app.jetbuilt.com/api';

  try {
    const stageCounts = {};
    let totalFetched = 0;
    let totalInJetbuilt = 0;

    for (let page = 1; page <= 4; page++) {
      const response = await fetch(BASE + '/projects?page=' + page, {
        headers: {
          'Authorization': 'Token token=' + API_KEY,
          'Accept': 'application/vnd.jetbuilt.v1',
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;
      if (page === 1) totalInJetbuilt = parseInt(response.headers.get('x-total-count')) || 0;
      data.forEach(function(p) {
        const s = p.stage || 'unknown';
        stageCounts[s] = (stageCounts[s] || 0) + 1;
      });
      totalFetched += data.length;
    }

    res.status(200).json({
      total_in_jetbuilt: totalInJetbuilt,
      pages_sampled: 4,
      projects_sampled: totalFetched,
      stage_breakdown: stageCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
