export default function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email } = req.body;
  res.json({ success: true, email });
}
