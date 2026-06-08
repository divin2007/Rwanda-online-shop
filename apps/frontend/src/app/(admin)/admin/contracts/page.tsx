'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { marketApi } from '@/lib/api';
import { sanitizeText } from '@/lib/sanitize';

interface Contract {
  _id?: string;
  version?: string;
  active?: boolean;
  publishedAt?: string;
  content?: string;
  changelog?: string[];
}

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contract | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allRes, activeRes] = await Promise.all([
          marketApi.get('/contracts'),
          marketApi.get('/contracts/active').catch(() => null),
        ]);
        if (cancelled) return;
        const all = Array.isArray(allRes.data?.data) ? allRes.data.data : [];
        const active = activeRes?.data?.data || null;
        setContracts(all);
        setActiveContract(active);
        setSelected(active || all[0] || null);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.response?.data?.message || 'Failed to load contracts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(
    () => [...contracts].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()),
    [contracts],
  );

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 animate-reveal pb-20">
        <div className="border-b border-[#e0e0e0] pb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff6b00]">Admin · Contracts</p>
            <Link href="/admin?tab=analytics" className="text-[10px] font-black uppercase tracking-widest text-[#5f7569] hover:text-[#ff6b00]">
              ← Admin portal
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-4xl font-sans tracking-normal text-[#1b1c1c]">
            <ScrollText className="text-[#ff6b00]" size={32} />
            Seller Agreements
          </h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#414844]">
            Read-only view of all contract versions and the currently active agreement.
          </p>
        </div>

        {/* Active banner */}
        {activeContract && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600" size={20} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Active version</p>
                <p className="text-lg font-black text-[#1b1c1c]">v{sanitizeText(activeContract.version || '—')}</p>
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f7569]">
              Published {activeContract.publishedAt ? new Date(activeContract.publishedAt).toLocaleDateString() : '—'}
            </p>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="h-96 animate-pulse rounded-lg border border-[#e0e0e0] bg-white" />
            <div className="h-96 animate-pulse rounded-lg border border-[#e0e0e0] bg-white" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white px-4 py-20 text-center">
            <FileText className="mb-4 text-[#ff6b00]/50" size={44} />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">No contracts published yet</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Version list */}
            <aside className="space-y-2">
              {sorted.map(c => {
                const isSelected = selected?.version === c.version;
                return (
                  <button
                    key={c.version || c._id}
                    type="button"
                    onClick={() => setSelected(c)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      isSelected ? 'border-[#e05300] bg-[#fff7f0] ring-2 ring-[#ffedd5]' : 'border-[#e0e0e0] bg-white hover:border-[#ff6b00]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-[#1b1c1c]">v{sanitizeText(c.version || '—')}</p>
                      {c.active && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-green-700">Active</span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#5f7569]">
                      {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : '—'}
                    </p>
                  </button>
                );
              })}
            </aside>

            {/* Content viewer */}
            <section className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] bg-[#fcf9f8] p-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Version</p>
                      <h2 className="text-xl font-black text-[#1b1c1c]">v{sanitizeText(selected.version || '—')}</h2>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f7569]">
                      {selected.publishedAt ? new Date(selected.publishedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="space-y-6 p-6">
                    {selected.changelog && selected.changelog.length > 0 && (
                      <div className="rounded-md border border-[#e0e0e0] bg-[#fcf9f8] p-4">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Changelog</p>
                        <ul className="list-inside list-disc space-y-1 text-sm font-semibold text-[#414844]">
                          {selected.changelog.map((line, i) => (
                            <li key={i}>{sanitizeText(line)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <article className="whitespace-pre-wrap text-sm leading-7 text-[#1b1c1c]">
                      {sanitizeText(selected.content || 'No content available for this version.')}
                    </article>
                  </div>
                </>
              ) : (
                <div className="px-4 py-16 text-center text-[10px] font-black uppercase tracking-[0.3em] text-[#414844]/40">
                  Select a version to view its content
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
