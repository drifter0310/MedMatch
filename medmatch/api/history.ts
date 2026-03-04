// History stored in-memory (resets on redeploy)
// Frontend localStorage handles persistence
const scans: any[] = [];

export default function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const userId = req.query.userId;
    return res.json(scans.filter(s => s.userId === userId));
  }

  if (req.method === 'POST') {
    const scan = { ...req.body, id: Date.now() };
    scans.push(scan);
    return res.json(scan);
  }

  res.status(405).end();
}
