'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Minus, Plus, PackageSearch, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { productApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';

const LOW_STOCK_THRESHOLD = 5;

type Product = {
  _id: string;
  name?: string;
  category?: string;
  categoryLabel?: string;
  unit?: string;
  stockType?: 'finite' | 'infinite' | 'on_demand';
  stockQuantity?: number;
  inStock?: boolean;
  images?: string[];
};

type ApiError = { response?: { data?: { message?: string; error?: string } } };

export default function SellerInventoryPage() {
  const { user } = useAuth();
  const productPath = user?.id ? `/products?sellerId=${user.id}` : '';
  const { data: products, loading, execute: fetchProducts } = useApi<Product[]>(productApi, 'get', productPath);

  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  // Local optimistic stock overrides keyed by product id.
  const [stockOverrides, setStockOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user?.id) fetchProducts();
  }, [user?.id, fetchProducts]);

  const list = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  const stockFor = (p: Product) =>
    stockOverrides[p._id] !== undefined ? stockOverrides[p._id] : Number(p.stockQuantity || 0);

  const isLow = (p: Product) => p.stockType === 'finite' && stockFor(p) < LOW_STOCK_THRESHOLD;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(p => {
      const matchesSearch = !q || p.name?.toLowerCase().includes(q);
      const matchesLow = !onlyLow || isLow(p);
      return matchesSearch && matchesLow;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, search, onlyLow, stockOverrides]);

  const lowCount = useMemo(() => list.filter(isLow).length, [list, stockOverrides]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustStock = async (product: Product, change: number) => {
    if (product.stockType !== 'finite') {
      toast('Stock can only be adjusted for limited-stock products.');
      return;
    }
    const current = stockFor(product);
    if (current + change < 0) {
      toast.error('Stock cannot go below zero.');
      return;
    }
    setAdjustingId(product._id);
    const previous = current;
    setStockOverrides(prev => ({ ...prev, [product._id]: current + change }));
    try {
      const res = await productApi.post(`/products/${product._id}/stock`, { change });
      const updated = res.data?.data;
      const serverQty = Number(updated?.stockQuantity);
      setStockOverrides(prev => ({
        ...prev,
        [product._id]: Number.isFinite(serverQty) ? serverQty : current + change,
      }));
      toast.success(`Stock ${change > 0 ? 'increased' : 'reduced'} for ${product.name || 'product'}`);
    } catch (error: unknown) {
      // Rollback optimistic value on failure.
      setStockOverrides(prev => ({ ...prev, [product._id]: previous }));
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || apiError.response?.data?.error || 'Stock update failed.');
    } finally {
      setAdjustingId(null);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 animate-reveal pb-20">
        <div>
          <Link href="/seller/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
          <div className="mt-4 flex flex-col items-start justify-between gap-4 border-b-2 border-[#e0e0e0] pb-6 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-[#ff6b00]">Seller · Stock</p>
              <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Inventory</h1>
              <p className="mt-2 text-sm font-semibold text-[#414844]">Adjust stock levels and keep an eye on low-stock products.</p>
            </div>
            <div className="flex gap-4">
              <div className="rounded-lg border border-[#e0e0e0] bg-white px-5 py-3 text-center shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#414844]/60">Products</p>
                <p className="text-2xl font-sans text-[#1b1c1c]">{list.length}</p>
              </div>
              <div className={`rounded-lg border px-5 py-3 text-center shadow-sm ${lowCount > 0 ? 'border-[#e05300]/40 bg-[#fff5f0]' : 'border-[#e0e0e0] bg-white'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#e05300]">Low stock</p>
                <p className="text-2xl font-sans text-[#e05300]">{lowCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 rounded-lg border border-[#e0e0e0] bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b938d]" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="h-11 w-full rounded-md border border-[#d9e0db] bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-[#ff6b00]"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyLow(v => !v)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 text-[10px] font-black uppercase tracking-widest transition ${
              onlyLow ? 'border-[#e05300] bg-[#e05300] text-white' : 'border-[#d9e0db] bg-white text-[#414844] hover:border-[#ff6b00]'
            }`}
          >
            <AlertTriangle size={14} />
            Low stock only
          </button>
        </div>

        {/* Table */}
        <section className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-[#e05300] text-white">
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Product</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Stock type</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-[0.26em]">Current stock</th>
                  <th className="p-5 text-right text-[9px] font-black uppercase tracking-[0.26em]">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ee]">
                {loading ? (
                  [1, 2, 3, 4].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="p-5"><div className="h-14 rounded-md bg-[#f0eded]" /></td>
                    </tr>
                  ))
                ) : filtered.length > 0 ? (
                  filtered.map(product => {
                    const qty = stockFor(product);
                    const low = isLow(product);
                    const finite = product.stockType === 'finite';
                    return (
                      <tr key={product._id} className={`transition-colors hover:bg-[#fcf9f8] ${low ? 'bg-[#fff7f2]' : ''}`}>
                        <td className="flex items-center gap-4 p-5">
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-[#e0e0e0] bg-[#fcf9f8]">
                            <img
                              src={product.images?.[0] ? resolveUploadUrl(product.images[0], 'product') : 'https://images.unsplash.com/photo-1590073844006-33379778ae09?auto=format&fit=crop&q=80&w=200'}
                              alt={product.name || 'Product'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-[#1b1c1c]">{product.name || 'Untitled product'}</h4>
                            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-[#5f7569]">{product.categoryLabel || product.category || 'other'}</p>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">
                            {product.stockType === 'infinite' ? 'Always available' : product.stockType === 'on_demand' ? 'Made to order' : 'Limited'}
                          </span>
                        </td>
                        <td className="p-5">
                          {finite ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-2xl font-sans ${low ? 'text-[#e05300]' : 'text-[#1b1c1c]'}`}>{qty}</span>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#5f7569]">{product.unit || 'pcs'}</span>
                              {low && (
                                <span className="inline-flex items-center gap-1 rounded-sm border border-[#e05300]/40 bg-[#fff0e8] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-[#e05300]">
                                  <AlertTriangle size={10} /> Low
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#5f7569]">N/A</span>
                          )}
                        </td>
                        <td className="p-5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!finite || adjustingId === product._id || qty <= 0}
                              onClick={() => adjustStock(product, -1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d9e0db] text-[#7b3f3f] transition hover:border-[#7b3f3f] disabled:opacity-40"
                              aria-label="Decrease stock"
                            >
                              <Minus size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={!finite || adjustingId === product._id}
                              onClick={() => adjustStock(product, 5)}
                              className="inline-flex h-9 items-center justify-center rounded-md border border-[#d9e0db] px-3 text-[9px] font-black uppercase tracking-widest text-[#405046] transition hover:border-[#ff6b00] disabled:opacity-40"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              disabled={!finite || adjustingId === product._id}
                              onClick={() => adjustStock(product, 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#e05300] text-white transition hover:bg-[#ff6b00] disabled:opacity-40"
                              aria-label="Increase stock"
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-16 text-center">
                      <PackageSearch className="mx-auto mb-4 text-[#ff6b00]/50" size={40} />
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#5f7569]">
                        {onlyLow ? 'No low-stock products' : 'No products found'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}
