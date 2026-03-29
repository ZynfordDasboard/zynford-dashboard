export default async function handler(req, res) {
  const shop = 'clara-belle-scottsdale.myshopify.com';
  const clientId = '90cd5d848934c349ce0aa748e86e41e0';
  const redirectUri = 'https://zynford-dashboard.vercel.app/api/shopify-callback';
  const scopes = 'read_orders,read_analytics,read_all_orders';
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_options[]=offline`;
  return res.redirect(authUrl);
}
