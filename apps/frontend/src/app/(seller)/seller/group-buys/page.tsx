'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { orderApi, productApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function SellerGroupBuysPage() {
  const { user } = useAuth();
  const [groupBuys, setGroupBuys] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ productId: '', targetQty: '', discountPercent: '', deadline: '' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const [gb, prod] = await Promise.all([
        orderApi.get('/group-buys', { params: { status: 'open' } }).catch(() => null),
        user?.id ? productApi.get(`/products?sellerId=${user.id}`).catch(() => null) : Promise.resolve(null),
      ]);
      setGroupBuys(Array.isArray(gb?.data?.data) ? gb.data.data : []);
      const list = prod?.data?.data;
      const arr = Array.isArray(list) ? list : list?.products || [];
      setProducts(arr.filter((p: any) => p.groupBuyEligible));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const create = async () => {
    if (!form.productId || !form.targetQty || !form.discountPercent || !form.deadline) {
      return toast.error('All fields are required');
    }
    setCreating(true);
    try {
      await orderApi.post('/group-buys', {
        productId: form.productId,
        targetQty: Number(form.targetQty),
        discountPercent: Number(form.discountPercent),
        deadline: new Date(form.deadline).toISOString(),
      });
      toast.success('Group buy created');
      setForm({ productId: '', targetQty: '', discountPercent: '', deadline: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create group buy');
    } finally {
      setCreating(false);
    }
  };

  const lock = async (id: string) => {
    try {
      await orderApi.post(`/group-buys/${id}/lock`, {});
      toast.success('Group buy locked');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not lock');
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Group Buys</h1>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Create Group Buy</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select eligible product…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Target qty" value={form.targetQty} onChange={(e) => setForm({ ...form, targetQty: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" placeholder="Discount %" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          {products.length === 0 && <p className="mt-2 text-xs text-gray-400">Mark a product as group-buy eligible to create campaigns.</p>}
          <button onClick={create} disabled={creating} className="mt-3 rounded bg-[#e05300] px-5 py-2 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 p-4 text-sm font-bold text-gray-900">Active Group Buys</h2>
          {groupBuys.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">No active group buys.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {groupBuys.map((gb) => (
                <li key={gb._id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{gb.discountPercent}% off</p>
                    <p className="text-xs text-gray-500">{gb.currentQty}/{gb.targetQty} units · ends {new Date(gb.deadline).toLocaleDateString()}</p>
                  </div>
                  {gb.currentQty >= gb.targetQty && gb.status === 'open' && (
                    <button onClick={() => lock(gb._id)} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Lock</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
