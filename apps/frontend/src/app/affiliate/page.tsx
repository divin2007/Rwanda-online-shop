'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Link2, TrendingUp } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { userApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/format';

export default function AffiliateDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>({ items: [], total: 0 });
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refBase = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:3001';

  const load = async () => {
    setLoading(true);
    try {
      const [p, l, e] = await Promise.all([
        userApi.get('/affiliates/me').catch(() => null),
        userApi.get('/affiliates/links').catch(() => null),
        userApi.get('/affiliates/earnings').catch(() => null),
      ]);
      setProfile(p?.data?.data || null);
      setLinks(Array.isArray(l?.data?.data) ? l.data.data : []);
      setEarnings(e?.data?.data || { items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  const handleApply = async () => {
    try {
      await userApi.post('/affiliates/apply', { displayName: user?.fullName });
      toast.success('Application submitted. An admin will review your affiliate profile.');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to apply');
    }
  };

  const handleCreateLink = async () => {
    if (!productId.trim()) return toast.error('Enter a product id');
    setCreating(true);
    try {
      await userApi.post('/affiliates/links', { productId: productId.trim() });
      toast.success('Referral link created');
      setProductId('');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${refBase}/r/${slug}`);
    toast.success('Referral link copied');
  };

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-gray-600">Please log in to access the influencer dashboard.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Influencer Dashboard</h1>

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
        ) : !profile ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <TrendingUp className="mx-auto mb-3 text-[#e05300]" size={32} />
            <h2 className="text-lg font-bold text-gray-900">Become a Market Influencer</h2>
            <p className="mt-1 text-sm text-gray-500">Earn commission promoting Rwandan market products.</p>
            <button onClick={handleApply} className="mt-4 rounded bg-[#e05300] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#c44800]">
              Apply Now
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Status" value={profile.status} />
              <Stat label="Clicks" value={profile.totalClicks ?? 0} />
              <Stat label="Conversions" value={profile.totalConversions ?? 0} />
              <Stat label="Total Earnings" value={formatCurrency(profile.totalEarnings ?? 0)} />
            </div>

            {profile.status === 'approved' && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-2 text-sm font-bold text-gray-900">Create Referral Link</h3>
                <div className="flex gap-2">
                  <input
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="Product ID (must have an approved application)"
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button onClick={handleCreateLink} disabled={creating} className="rounded bg-[#e05300] px-4 py-2 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white">
              <h3 className="border-b border-gray-100 p-4 text-sm font-bold text-gray-900">Your Referral Links</h3>
              {links.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">No links yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {links.map((l) => (
                    <li key={l._id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-mono text-sm text-gray-900">
                          <Link2 size={14} /> /r/{l.slug}
                        </p>
                        <p className="text-xs text-gray-500">
                          {l.commissionRate}% · {l.clickCount || 0} clicks · {l.conversionCount || 0} conversions · {formatCurrency(l.totalEarned || 0)}
                        </p>
                      </div>
                      <button onClick={() => copyLink(l.slug)} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-bold hover:bg-gray-50">
                        <Copy size={12} /> Copy
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
  </div>
);
