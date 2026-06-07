'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Ban, Gavel, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { marketApi } from '@/lib/api';
import { sanitizeText } from '@/lib/sanitize';

type PenaltyType = 'warning' | 'charge' | 'suspension';

interface MarketRecord {
  _id: string;
  name?: string;
  code?: string;
  penalties?: Array<{ type?: string; reason?: string; createdAt?: string; appliedAt?: string }>;
}

const PENALTY_OPTIONS: { type: PenaltyType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'warning', label: 'Warning', desc: 'A formal notice with no financial impact.', icon: <ShieldAlert size={18} /> },
  { type: 'charge', label: 'Charge', desc: 'Apply a financial penalty to the market.', icon: <Gavel size={18} /> },
  { type: 'suspension', label: 'Suspension', desc: 'Suspend the market from operating.', icon: <Ban size={18} /> },
];

export default function MarketPenaltiesPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = String(params?.id || '');

  const [market, setMarket] = useState<MarketRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<PenaltyType>('warning');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!marketId) return;
    marketApi.get(`/markets/${marketId}`)
      .then(res => setMarket(res.data?.data || null))
      .catch(() => setMarket(null))
      .finally(() => setLoading(false));
  }, [marketId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = sanitizeText(reason, 500).trim();
    if (cleanReason.length < 4) {
      toast.error('Please provide a clear reason (at least 4 characters).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await marketApi.post(`/markets/${marketId}/penalties`, { type, reason: cleanReason });
      setMarket(res.data?.data || market);
      toast.success(`${type[0].toUpperCase()}${type.slice(1)} penalty issued`);
      setReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to issue penalty');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ffedd5] border-t-[#ff6b00]" />
        </div>
      </Layout>
    );
  }

  const history = Array.isArray(market?.penalties) ? [...market!.penalties].reverse() : [];

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6 animate-reveal pb-20">
        <div>
          <Link href="/admin?tab=markets" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
            <ArrowLeft size={14} />
            Back to markets
          </Link>
          <div className="mt-4 border-b border-[#e0e0e0] pb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-[#ff6b00]">Admin · Market penalties</p>
            <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">{sanitizeText(market?.name || 'Market')}</h1>
            <p className="mt-2 text-sm font-semibold text-[#414844]">
              {market?.code ? `Code ${market.code} · ` : ''}Issue a penalty against this market.
            </p>
          </div>
        </div>

        {!market ? (
          <div className="rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white px-4 py-16 text-center">
            <AlertTriangle className="mx-auto mb-4 text-[#e05300]" size={40} />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">Market not found</p>
            <button onClick={() => router.push('/admin?tab=markets')} className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#e05300] px-6 text-[10px] font-black uppercase tracking-widest text-white">
              Back to markets
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-6 rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-sm">
              <div>
                <label className="mb-3 block text-xs font-black uppercase tracking-widest text-[#405046]">Penalty type</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PENALTY_OPTIONS.map(opt => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setType(opt.type)}
                      className={`rounded-lg border p-4 text-left transition ${
                        type === opt.type ? 'border-[#e05300] bg-[#fff7f0] ring-2 ring-[#ffedd5]' : 'border-[#d9e0db] bg-white hover:border-[#ff6b00]'
                      }`}
                    >
                      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${type === opt.type ? 'bg-[#e05300] text-white' : 'bg-[#fcf9f8] text-[#ff6b00]'}`}>
                        {opt.icon}
                      </span>
                      <p className="mt-3 text-sm font-black text-[#1b1c1c]">{opt.label}</p>
                      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#5f7569]">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-[#405046]">Reason</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Describe the reason for this penalty…"
                  className="w-full rounded-md border border-[#d9e0db] bg-[#fcf9f8] p-4 text-sm leading-6 outline-none focus:border-[#ff6b00]"
                />
                <p className="mt-1 text-right text-[10px] font-bold uppercase tracking-widest text-[#8b938d]">{reason.length}/500</p>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e0e0e0] pt-5">
                <Link href="/admin?tab=markets" className="inline-flex h-11 items-center justify-center rounded-md border border-[#d9e0db] px-5 text-[10px] font-black uppercase tracking-widest text-[#405046] transition hover:border-[#ff6b00]">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#e05300] px-6 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
                >
                  <Gavel size={15} />
                  {submitting ? 'Issuing…' : 'Issue penalty'}
                </button>
              </div>
            </form>

            {/* Penalty history */}
            <section className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
              <div className="border-b border-[#e0e0e0] bg-[#fcf9f8] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]">Penalty history</p>
              </div>
              {history.length === 0 ? (
                <div className="px-4 py-10 text-center text-[10px] font-black uppercase tracking-[0.3em] text-[#414844]/40">
                  No penalties on record
                </div>
              ) : (
                <div className="divide-y divide-[#f0eded]">
                  {history.map((p, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 p-5">
                      <div>
                        <span className={`inline-block rounded-sm px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white ${
                          p.type === 'suspension' ? 'bg-[#7b3f3f]' : p.type === 'charge' ? 'bg-amber-600' : 'bg-[#e05300]'
                        }`}>
                          {p.type || 'penalty'}
                        </span>
                        <p className="mt-2 text-sm font-semibold text-[#1b1c1c]">{sanitizeText(p.reason || '—')}</p>
                      </div>
                      <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-[#717973]">
                        {(p.createdAt || p.appliedAt) ? new Date(p.createdAt || p.appliedAt || '').toLocaleDateString() : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
