'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { orderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function CateringPage() {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', mealsPerWeek: '', budgetPerMeal: '', startDate: '', endDate: '' });
  const [creating, setCreating] = useState(false);

  const load = () => orderApi.get('/catering/briefs').then((r) => setBriefs(r.data?.data || [])).catch(() => {});
  useEffect(() => { if (user) load(); }, [user]);

  const create = async () => {
    if (!form.title || !form.mealsPerWeek || !form.budgetPerMeal || !form.startDate || !form.endDate) {
      return toast.error('Please fill all required fields');
    }
    setCreating(true);
    try {
      await orderApi.post('/catering/briefs', {
        title: form.title,
        description: form.description,
        mealsPerWeek: Number(form.mealsPerWeek),
        budgetPerMeal: Number(form.budgetPerMeal),
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
      });
      toast.success('Catering brief posted');
      setForm({ title: '', description: '', mealsPerWeek: '', budgetPerMeal: '', startDate: '', endDate: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to post brief');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Catering Contracts</h1>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Post a Catering Brief</h2>
          <div className="space-y-3">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Meals / week" value={form.mealsPerWeek} onChange={(e) => setForm({ ...form, mealsPerWeek: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <input type="number" placeholder="Budget / meal (RWF)" value={form.budgetPerMeal} onChange={(e) => setForm({ ...form, budgetPerMeal: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button onClick={create} disabled={creating} className="rounded bg-[#e05300] px-5 py-2 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
              {creating ? 'Posting…' : 'Post Brief'}
            </button>
          </div>
        </div>

        <h2 className="mb-3 text-sm font-bold text-gray-900">Your Briefs</h2>
        <div className="space-y-3">
          {briefs.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No briefs yet.</p> :
            briefs.map((b) => (
              <Link key={b._id} href={`/catering/${b._id}`} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-[#e05300]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">{b.title}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">{b.status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{b.mealsPerWeek} meals/week · {(b.budgetPerMeal || 0).toLocaleString()} RWF/meal</p>
              </Link>
            ))}
        </div>
      </div>
    </Layout>
  );
}
