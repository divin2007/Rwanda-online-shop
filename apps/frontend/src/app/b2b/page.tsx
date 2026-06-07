'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Building2, Repeat, FileText, Truck } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { userApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const ORG_TYPES = ['HOTEL', 'RESTAURANT', 'CATERER', 'SCHOOL', 'OFFICE', 'NGO'];

export default function B2bHubPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ organizationName: '', organizationType: 'RESTAURANT', contactPhone: '', taxId: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    userApi.get('/b2b/accounts/me').then((res) => setAccount(res.data?.data)).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const create = async () => {
    if (!form.organizationName) return toast.error('Organization name is required');
    setCreating(true);
    try {
      const res = await userApi.post('/b2b/accounts', form);
      setAccount(res.data?.data);
      toast.success('B2B account created. An admin will verify it shortly.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <Building2 className="text-[#e05300]" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RMF for Business</h1>
            <p className="text-sm text-gray-500">Recurring orders, monthly invoicing, and same-day bulk delivery for institutions.</p>
          </div>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature icon={<Repeat size={18} />} title="Recurring Orders" desc="Schedule standing daily/weekly orders from your suppliers." />
          <Feature icon={<FileText size={18} />} title="Monthly Invoices" desc="Consolidated PDF invoices on credit terms." />
          <Feature icon={<Truck size={18} />} title="Bulk Delivery" desc="One pickup, many drop-offs, same day." />
        </div>

        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ) : account ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-900">
              Account: <strong>{account.organizationName}</strong>{' '}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${account.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {account.isVerified ? 'Verified' : 'Pending verification'}
              </span>
            </p>
            <Link href="/b2b/dashboard" className="mt-4 inline-block rounded bg-[#e05300] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#c44800]">
              Go to B2B Dashboard
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-bold text-gray-900">Create your B2B account</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input placeholder="Organization name" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <select value={form.organizationType} onChange={(e) => setForm({ ...form, organizationType: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm">
                {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Contact phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Tax ID (optional)" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button onClick={create} disabled={creating} className="mt-3 rounded bg-[#e05300] px-5 py-2 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

const Feature = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="mb-2 text-[#e05300]">{icon}</div>
    <h3 className="text-sm font-bold text-gray-900">{title}</h3>
    <p className="mt-1 text-xs text-gray-500">{desc}</p>
  </div>
);
