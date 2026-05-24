import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/markets`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  if (baseUrl.includes('localhost')) {
    return baseEntries;
  }

  try {
    // 1. Fetch Markets
    const marketsRes = await fetch(`${process.env.NEXT_PUBLIC_MARKET_SERVICE_URL || 'http://localhost:3002'}/api/v1/markets`, { next: { revalidate: 3600 } });
    const marketsData = await marketsRes.json();
    const markets = marketsData.data || [];

    const marketEntries = markets.map((m: any) => ({
      url: baseUrl.includes('localhost') ? `http://${m.slug}.localhost:3000` : `https://${m.slug}.rwshop.org`,
      lastModified: new Date(m.updatedAt || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    // 2. Fetch Products
    const productsRes = await fetch(`${process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || 'http://127.0.0.1:3003'}/api/v1/products?isActive=true`, { next: { revalidate: 3600 } });
    const productsData = await productsRes.json();
    const products = productsData.data || [];

    const productEntries = products.map((p: any) => ({
      url: `${baseUrl}/product/${p._id}`,
      lastModified: new Date(p.updatedAt || new Date()),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }));

    return [
      ...baseEntries,
      ...marketEntries,
      ...productEntries,
    ];
  } catch {
    if (!baseUrl.includes('localhost')) {
      console.warn('Sitemap generation fell back to base URL entries.');
    }

    return baseEntries;
  }
}
