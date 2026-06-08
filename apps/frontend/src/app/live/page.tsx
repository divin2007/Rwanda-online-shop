'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Eye } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { sellerApi } from '@/lib/api';

export default function LiveBrowsePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sellerApi.get('/live-sessions/active')
      .then((r) => setSessions(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center gap-2">
          <Radio className="text-red-600" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">Live Now</h1>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-16 text-center text-gray-500">No live sessions right now. Check back soon!</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {sessions.map((s) => (
              <Link key={s._id} href={`/live/${s._id}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-[#e05300]">
                <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    <Radio size={10} /> Live
                  </span>
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    <Eye size={10} /> {s.viewerCount || 0}
                  </span>
                  <Radio className="text-white/40" size={32} />
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-gray-900">Live Selling Session</p>
                  <p className="text-xs text-gray-500">{(s.totalOrders || 0)} orders so far</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
