export type UploadService = 'order' | 'delivery' | 'product' | 'market' | 'seller' | 'rider';

const serviceBaseUrls: Record<UploadService, string> = {
  order: process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006',
  delivery: process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008',
  product: process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || 'http://127.0.0.1:3003',
  market: process.env.NEXT_PUBLIC_MARKET_SERVICE_URL || 'http://localhost:3002',
  seller: process.env.NEXT_PUBLIC_SELLER_SERVICE_URL || 'http://localhost:3004',
  rider: process.env.NEXT_PUBLIC_RIDER_SERVICE_URL || 'http://localhost:3005',
};

const defaultUploadFolders: Record<UploadService, string> = {
  order: 'order-images',
  delivery: 'pickup-photos',
  product: 'products',
  market: 'markets',
  seller: 'seller-documents',
  rider: 'rider-documents',
};

function folderFromEndpoint(endpoint?: string, service: UploadService = 'order') {
  if (!endpoint) return defaultUploadFolders[service];
  if (endpoint.includes('seller-videos')) return 'seller-videos';
  if (endpoint.includes('upload-document')) return defaultUploadFolders[service];
  if (endpoint.includes('upload-image')) return defaultUploadFolders[service];
  if (endpoint.includes('upload-pickup-photo')) return 'pickup-photos';
  return defaultUploadFolders[service];
}

export function resolveUploadUrl(url?: string | null, service: UploadService = 'order', endpoint?: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/')) return `${serviceBaseUrls[service]}${url}`;
  if (/^[\w.-]+\.(avif|gif|jpe?g|png|webp|pdf|m4v|mov|mp4|webm)$/i.test(url)) {
    return `${serviceBaseUrls[service]}/uploads/${folderFromEndpoint(endpoint, service)}/${url}`;
  }

  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      parsed.pathname.startsWith('/uploads/')
    ) {
      return `${serviceBaseUrls[service]}${parsed.pathname}`;
    }
  } catch {
    return url;
  }

  return url;
}
