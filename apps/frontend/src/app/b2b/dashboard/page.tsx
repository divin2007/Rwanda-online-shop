'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { userApi, orderApi, deliveryApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { InvoiceCard } from '@/components/ui/InvoiceCard';

export default function B2bDashboardPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bulk, setBulk] = useState<any[]>([]);
  const [tab, setTab] = useState<'templates' | 'invoices' | 'bulk'>('templates');

  useEffect(() => {
    if (!user) return;
    userApi.get('/b2b/accounts/me').then((r) => setAccount(r.data?.data)).catch(() => {});
    orderApi.get('/b2b/order-templates').then((r) => setTemplates(r.data?.data || [])).catch(() => {});
    orderApi.get('/b2b/invoices').then((r) => setInvoices(r.data?.data || [])).catch(() => {});
    deliveryApi.get('/bulk-deliveries/mine').then((r) => setBulk(r.data?.data?.items || [])).catch(() => {});
  }, [user]);

  const toggleTemplate = async (id: string, isActive: boolean) => {
    try {
      await orderApi.patch(`/b2b/order-templates/${id}`, { isActive: !isActive });
      setTemplates((prev) => prev.map((t) => (t._id === id ? { ...t, isActive: !isActive } : t)));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update');
    }
  };

  const creditUsed = Number(account?.currentMonthCredit || 0);
  const creditLimit = Number(account?.creditLimit || 0);
  const creditPct = creditLimit > 0 ? Math.min(100, Math.round((creditUsed / creditLimit) * 100)) : 0;

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">B2B Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/b2b/templates/new" className="rounded bg-[#e05300] px-4 py-2 text-sm font-bold text-white hover:bg-[#c44800]">New Template</Link>
            <Link href="/b2b/bulk-delivery/new" className="rounded border border-[#e05300] px-4 py-2 text-sm font-bold text-[#e05300]">Bulk Delivery</Link>
          </div>
        </div>

        {creditLimit > 0 && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between text-sm text-gray-500">
              <span>Credit used this month</span>
              <span>{creditUsed.toLocaleString()} / {creditLimit.toLocaleString()} RWF</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${creditPct > 85 ? 'bg-red-500' : 'bg-[#e05300]'}`} style={{ width: `${creditPct}%` }} />
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2 border-b border-gray-200">
          {(['templates', 'invoices', 'bulk'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-bold capitalize ${tab === t ? 'border-b-2 border-[#e05300] text-[#e05300]' : 'text-gray-500'}`}>
              {t === 'bulk' ? 'Bulk Deliveries' : t}
            </button>
          ))}
        </div>

        {tab === 'templates' && (
          <div className="space-y-3">
            {templates.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No recurring templates yet.</p> :
              templates.map((t) => (
                <div key={t._id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{t.frequency} order</p>
                    <p className="text-xs text-gray-500">{(t.items || []).length} items · next run {t.nextRunAt ? new Date(t.nextRunAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <button onClick={() => toggleTemplate(t._id, t.isActive)} className={`rounded px-3 py-1.5 text-xs font-bold ${t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="space-y-3">
            {invoices.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No invoices yet.</p> :
              invoices.map((inv) => <InvoiceCard key={inv._id} invoice={inv} />)}
          </div>
        )}

        {tab === 'bulk' && (
          <div className="space-y-3">
            {bulk.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No bulk deliveries yet.</p> :
              bulk.map((b) => (
                <div key={b._id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{b.status?.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500">{(b.dropoffPoints || []).length} drop-offs · {(b.totalFee || 0).toLocaleString()} RWF</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
