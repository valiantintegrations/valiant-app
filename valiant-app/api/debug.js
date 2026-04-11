export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = '256e1837483dedcf3e993dbef92b9846';
  const BASE = 'https://app.jetbuilt.com/api';

  try {
    // Fetch first 3 pages to get a good sample of stage values
    const pages = await Promise.all([1,2,3,4,5].map(page =>
      fetch(`${BASE}/projects?page=${page}`, {
        headers: {
          'Authorization': `Token token=${API_KEY}`,
          'Accept': 'application/vnd.jetbuilt.v1',
          'Content-Type': 'application/json'
        }
      }).then(r => r.json())
    ));

    const allProjects = pages.flat().filter(Array.isArray(pages[0]) ? p => p : () => false);
    const projects = pages.filter(p => Array.isArray(p)).flat();

    // Count stage distribution
    const stageCounts = {};
    projects.forEach(p => {
      const s = p.stage || 'unknown';
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    });

    // Sample one project from each stage
    const stageSamples = {};
    projects.forEach(p => {
      if (!stageSamples[p.stage]) {
        stageSamples[p.stage] = { name: p.name, custom_id: p.custom_id, stage: p.stage, total: p.total };
      }
    });

    res.status(200).json({
      total_projects_sampled: projects.length,
      stage_distribution: stageCounts,
      one_sample_per_stage: stageSamples
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
