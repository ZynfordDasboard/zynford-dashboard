export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Geen code ontvangen');

  const shop = 'clara-belle-scottsdale.myshopify.com';
  const clientId = '90cd5d848934c349ce0aa748e86e41e0';
  const clientSecret = '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';

  try {
    const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const data = await r.json();
    const token = data.access_token;
    if (!token) return res.status(400).send('Token ophalen mislukt: ' + JSON.stringify(data));
    return res.redirect(`https://zynford-dashboard.vercel.app/?shopify_token=${token}&shop=${shop}`);
  } catch(e) {
    return res.status(500).send('Fout: ' + e.message);
  }
}
