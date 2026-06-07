'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { orderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function CateringBriefDetailPage({ params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = React.use(params);
  const { user } = useAuth();
  const [brief, setBrief] = useState<any>(null);
  const [bid, setBid] = useState({ pricePerMeal: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => orderApi.get(`/catering/briefs/${briefId}`).then((r) => setBrief(r.data?.data)).catch(() => {});
  useEffect(() => { if (user) load(); }, [user, briefId]);

  const submitBid = async () => {
    if (!bid.pricePerMeal) return toast.error('Enter a price per meal');
    setSubmitting(true);
    try {
      await orderApi.post(`/catering/briefs/${briefId}/bids`, { pricePerMeal: Number(bid.pricePerMeal), notes: bid.notes });
      toast.success('Bid submitted');
      setBid({ pricePerMeal: '', notes: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  const award = async (bidId: string) => {
    try {
      await orderApi.patch(`/catering/briefs/${briefId}/award/${bidId}`, {});
      toast.success('Bid awarded — a weekly contract has been set up');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to award');
    }
  };

  if (!brief) {
    return <Layout><div className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">Loading…</div></Layout>;
  }

  const isSeller = user?.role === 'SELLER';
  const isOwner = brief.buyerUserId && user?.id && String(brief.buyerUserId) === String(user.id);

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{brief.title}</h1>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">{brief.status}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">{brief.description}</p>
          <p className="mt-2 text-sm text-gray-500">{brief.mealsPerWeek} meals/week · {(brief.budgetPerMeal || 0).toLocaleString()} RWF/meal</p>
        </div>

        {isSeller && (brief.status === 'open' || brief.status === 'bidding') && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900">Submit a Bid</h2>
            <input type="number" placeholder="Price per meal (RWF)" value={bid.pricePerMeal} onChange={(e) => setBid({ ...bid, pricePerMeal: e.target.value })} className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            <textarea placeholder="Notes / proposed menu summary" value={bid.notes} onChange={(e) => setBid({ ...bid, notes: e.target.value })} rows={2} className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            <button onClick={submitBid} disabled={submitting} className="rounded bg-[#e05300] px-5 py-2 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Bid'}
            </button>
          </div>
        )}

        {isOwner && Array.isArray(brief.bids) && (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-bold text-gray-900">Bids ({brief.bids.length})</h2>
            <div className="space-y-3">
              {brief.bids.length === 0 ? <p className="text-sm text-gray-500">No bids yet.</p> :
                brief.bids.map((b: any) => (
                  <div key={b._id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{(b.pricePerMeal || 0).toLocaleString()} RWF/meal</p>
                      <p className="text-xs text-gray-500">{b.notes || ''} · {b.status}</p>
                    </div>
                    {brief.status !== 'awarded' && b.status === 'pending' && (
                      <button onClick={() => award(b._id)} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Award</button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
