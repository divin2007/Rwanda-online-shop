'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Layout } from '@/components/layout/Layout';
import { sellerApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { SellerTierBadge } from '@/components/ui/SellerTierBadge';
import { PerishableBadge } from '@/components/ui/PerishableBadge';
import { ExportInquiryModal } from '@/components/ui/ExportInquiryModal';

export default function ExportCatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [minQty, setMinQty] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (category) params.categoryId = category;
      if (minQty) params.minQty = minQty;
      const res = await sellerApi.get('/export/products', { params });
      setProducts(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Export Catalogue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Made-in-Rwanda products from export-ready, certified sellers. Submit an inquiry to start the process.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-3">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category id (optional)"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            placeholder="Min qty"
            className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={load} className="rounded bg-[#e05300] px-4 py-2 text-sm font-bold text-white hover:bg-[#c44800]">
            Filter
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-gray-500">No export-ready products available yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const img = p.images?.[0] ? resolveUploadUrl(p.images[0], 'product') : null;
              return (
                <div key={p._id} className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="relative aspect-[4/3] bg-gray-50">
                    {img && <Image src={img} alt={p.name} fill unoptimized className="object-cover" />}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {p.seller?.certificationTier && <SellerTierBadge tier={p.seller.certificationTier} size="xs" />}
                      {p.perishable && <PerishableBadge maxDeliveryMinutes={p.maxDeliveryMinutes} />}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="line-clamp-2 text-sm font-bold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-500">by {p.seller?.stallName || 'Verified seller'}</p>
                    <p className="font-mono text-sm font-bold text-[#e05300]">{formatCurrency(p.price)} / {p.unit}</p>
                    {(p.exportMinQty || p.seller?.exportMinimumOrderQty) && (
                      <p className="text-[11px] text-gray-500">
                        Min export qty: {p.exportMinQty || p.seller?.exportMinimumOrderQty}
                      </p>
                    )}
                    <button
                      onClick={() => setSelected(p)}
                      className="mt-auto rounded bg-[#e05300] py-2 text-xs font-bold text-white hover:bg-[#c44800]"
                    >
                      Submit Inquiry
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <ExportInquiryModal product={selected} onClose={() => setSelected(null)} />}
    </Layout>
  );
}
