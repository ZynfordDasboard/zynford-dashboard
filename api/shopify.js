export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { shopDomain, accessToken, period } = req.body;
  if (!shopDomain || !accessToken) return res.status(400).json({ error: 'Missing credentials' });

  // Calculate date range
  const now = new Date();
  let startDate;
  switch(period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case '365d':
      startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    // Fetch orders
    let allOrders = [];
    let url = `https://${shopDomain}/admin/api/2026-01/orders.json?status=any&created_at_min=${startDate.toISOString()}&limit=250`;
    
    while (url) {
      const r = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (!r.ok) {
        const rawText = await r.text();
        return res.status(r.status).json({ error: 'Shopify API fout: ' + r.status + ' - ' + rawText.substring(0, 200) });
      }
      
      const rawText = await r.text();
      let data;
      try { data = JSON.parse(rawText); } catch(e) { return res.status(500).json({ error: 'Geen geldige JSON van Shopify: ' + rawText.substring(0, 300) }); }
      allOrders = [...allOrders, ...(data.orders || [])];
      
      // Check for next page
      const linkHeader = r.headers.get('Link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>; rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }
    }

    // Filter for period if yesterday
    let orders = allOrders;
    if (period === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      orders = allOrders.filter(o => {
        const d = new Date(o.created_at);
        return d >= start && d < end;
      });
    }

    // Calculate metrics
    const paidOrders = orders.filter(o => o.financial_status !== 'refunded' && o.financial_status !== 'voided');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
    const totalOrders = paidOrders.length;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const fulfilledOrders = paidOrders.filter(o => o.fulfillment_status === 'fulfilled').length;
    const unfulfilledOrders = paidOrders.filter(o => !o.fulfillment_status || o.fulfillment_status === 'partial').length;
    const currency = 'USD';

    // Top products
    const productSales = {};
    paidOrders.forEach(order => {
      (order.line_items || []).forEach(item => {
        const key = item.title;
        if (!productSales[key]) productSales[key] = { name: key, revenue: 0, quantity: 0 };
        productSales[key].revenue += parseFloat(item.price) * item.quantity;
        productSales[key].quantity += item.quantity;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Daily revenue for chart (last 7 or 30 days)
    const dailyRevenue = {};
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyRevenue[key] = 0;
    }
    paidOrders.forEach(order => {
      const key = order.created_at.split('T')[0];
      if (dailyRevenue[key] !== undefined) {
        dailyRevenue[key] += parseFloat(order.total_price || 0);
      }
    });

    return res.status(200).json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      aov: Math.round(aov * 100) / 100,
      fulfilledOrders,
      unfulfilledOrders,
      currency,
      topProducts,
      dailyRevenue,
      period
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
