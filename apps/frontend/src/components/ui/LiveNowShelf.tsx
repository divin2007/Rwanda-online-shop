'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Eye } from 'lucide-react';
import { sellerApi } from '@/lib/api';

/**
 * "Live Now" horizontal shelf (Feature 2). Renders nothing when no sessions are live.
 */
export const LiveNowShelf = ({ marketId }: { marketId?: string }) => {
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    sellerApi.get('/live-sessions/active', { params: marketId ? { marketId } : {} })
      .then((r) => setSessions(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setSessions([]));
  }, [marketId]);

  if (sessions.length === 0) return null;

  return (
    <section className="space-y-md">
      <div className="flex items-center gap-2">
        <Radio className="text-red-600" size={20} />
        <h2 className="font-display-md text-[24px] font-bold text-on-surface">Live Now</h2>
        <Link href="/live" className="ml-auto font-label-caps text-label-caps text-primary hover:text-primary-container">See all</Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sessions.map((s) => (
          <Link key={s._id} href={`/live/${s._id}`} className="w-48 flex-shrink-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
            <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"><Radio size={10} /> Live</span>
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white"><Eye size={10} /> {s.viewerCount || 0}</span>
              <Radio className="text-white/40" size={28} />
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-on-surface">Live Selling</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default LiveNowShelf;
