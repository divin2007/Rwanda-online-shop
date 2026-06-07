'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { orderApi } from '@/lib/api';

interface Item { name: string; unitPrice: string; quantity: string; unit: string }

export default function NewTemplatePage() {
  const router = useRouter();
  const [sellerId, setSellerId] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [billingMethod, setBillingMethod] = useState<'MOMO' | 'INVOICE'>('MOMO');
  const [items, setItems] = useState<Item[]>([{ name: '', unitPrice: '', quantity: '1', unit: 'kg' }]);
  const [submitting, setSubmitting] = useState(false);

  const updateItem = (i: number, key: keyof Item, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  };

  const submit = async () => {
    if (!sellerId.trim()) return toast.error('Seller ID is required');
    const validItems = items.filter((it) => it.name && it.unitPrice);
    if (validItems.length === 0) return toast.error('Add at least one item');
    setSubmitting(true);
    try {
      await orderApi.post('/b2b/order-templates', {
        sellerId: sellerId.trim(),
        frequency,
        dayOfWeek: frequency === 'weekly' ? Number(dayOfWeek) : undefined,
        billingMethod,
        items: validItems.map((it) => ({ name: it.name, unitPrice: Number(it.unitPrice), quantity: Number(it.quantity) || 1, unit: it.unit })),
      });
      toast.success('Recurring template created');
      router.push('/b2b/dashboard');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">New Recurring Order Template</h1>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <input placeholder="Seller ID (profile id)" value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
            {frequency === 'weekly' && (
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            )}
            <select value={billingMethod} onChange={(e) => setBillingMethod(e.target.value as any)} className="rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="MOMO">MoMo</option>
              <option value="INVOICE">Invoice</option>
            </select>
          </div>

          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input placeholder="Item" value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} className="col-span-5 rounded border border-gray-300 px-2 py-1.5 text-sm" />
                <input type="number" placeholder="Price" value={it.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} className="col-span-3 rounded border border-gray-300 px-2 py-1.5 text-sm" />
                <input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm" />
                <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="col-span-2 flex items-center justify-center text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => setItems((p) => [...p, { name: '', unitPrice: '', quantity: '1', unit: 'kg' }])} className="flex items-center gap-1 text-xs font-bold text-[#e05300]">
              <Plus size={12} /> Add item
            </button>
          </div>

          <button onClick={submit} disabled={submitting} className="w-full rounded bg-[#e05300] py-2.5 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Template'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
