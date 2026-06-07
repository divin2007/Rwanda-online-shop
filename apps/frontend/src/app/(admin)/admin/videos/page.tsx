'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Film, Play, ShieldX, Video as VideoIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { productApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { sanitizeText } from '@/lib/sanitize';

type ModStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

interface SellerRef {
  stallName?: string;
  shopDetails?: { name?: string };
}

interface SellerVideo {
  _id: string;
  title?: string;
  caption?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  moderationStatus?: ModStatus;
  createdAt?: string;
  sellerId?: SellerRef | string;
}

const STATUS_TABS: { key: ModStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'FLAGGED', label: 'Flagged' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];

const sellerName = (s?: SellerRef | string) =>
  s && typeof s === 'object' ? s.shopDetails?.name || s.stallName || 'Seller' : 'Seller';

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<SellerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ModStatus | 'ALL'>('PENDING');
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productApi.get('/seller-videos/admin/moderation');
      setVideos(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const moderate = async (id: string, moderationStatus: ModStatus) => {
    setActingId(id);
    try {
      await productApi.patch(`/seller-videos/${id}/moderation`, { moderationStatus });
      setVideos(prev => prev.map(v => (v._id === id ? { ...v, moderationStatus } : v)));
      toast.success(`Video ${moderationStatus.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Moderation action failed');
    } finally {
      setActingId(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, FLAGGED: 0, APPROVED: 0, REJECTED: 0 };
    videos.forEach(v => {
      const s = v.moderationStatus || 'PENDING';
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [videos]);

  const filtered = useMemo(
    () => (tab === 'ALL' ? videos : videos.filter(v => (v.moderationStatus || 'PENDING') === tab)),
    [videos, tab],
  );

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 animate-reveal pb-20">
        <div className="border-b border-[#e0e0e0] pb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff6b00]">Admin · Videos</p>
            <Link href="/admin?tab=analytics" className="text-[10px] font-black uppercase tracking-widest text-[#5f7569] hover:text-[#ff6b00]">
              ← Admin portal
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-4xl font-sans tracking-normal text-[#1b1c1c]">
            <Film className="text-[#ff6b00]" size={32} />
            Video Moderation
          </h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#414844]">
            Review seller story videos and approve or reject them for the marketplace.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 rounded-lg border border-[#e0e0e0] bg-white p-3 shadow-sm">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                tab === t.key ? 'bg-[#e05300] text-white' : 'bg-[#fcf9f8] text-[#405046] hover:text-[#ff6b00]'
              }`}
            >
              {t.label}
              {t.key !== 'ALL' && counts[t.key] > 0 ? ` (${counts[t.key]})` : ''}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-72 animate-pulse rounded-lg border border-[#e0e0e0] bg-white" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white px-4 py-20 text-center">
            <VideoIcon className="mb-4 text-[#ff6b00]/50" size={44} />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">No {tab === 'ALL' ? '' : tab.toLowerCase()} videos</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {filtered.map(video => {
              const status = video.moderationStatus || 'PENDING';
              const thumb = video.thumbnailUrl || video.videoUrl;
              return (
                <article key={video._id} className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm transition hover:border-[#ff6b00]">
                  <a href={video.videoUrl ? resolveUploadUrl(video.videoUrl, 'product') : '#'} target="_blank" rel="noreferrer" className="relative block aspect-video overflow-hidden bg-[#1b1c1c]">
                    {thumb ? (
                      <img src={resolveUploadUrl(thumb, 'product')} alt={video.title || 'Video'} className="h-full w-full object-cover opacity-90" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/40">
                        <VideoIcon size={40} />
                      </div>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#e05300] shadow-lg">
                        <Play size={20} className="ml-0.5" />
                      </span>
                    </span>
                    <span className={`absolute left-3 top-3 rounded-sm px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white ${
                      status === 'APPROVED' ? 'bg-green-600' : status === 'REJECTED' ? 'bg-[#7b3f3f]' : status === 'FLAGGED' ? 'bg-amber-600' : 'bg-[#e05300]'
                    }`}>
                      {status}
                    </span>
                  </a>
                  <div className="space-y-3 p-5">
                    <div>
                      <h3 className="line-clamp-1 text-base font-black text-[#1b1c1c]">{sanitizeText(video.title || 'Untitled video')}</h3>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#5f7569]">
                        by {sanitizeText(sellerName(video.sellerId))}
                        {video.createdAt ? ` · ${new Date(video.createdAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    {video.caption && <p className="line-clamp-2 text-xs font-semibold leading-5 text-[#414844]">{sanitizeText(video.caption)}</p>}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => moderate(video._id, 'APPROVED')}
                        disabled={actingId === video._id || status === 'APPROVED'}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#e05300] py-2.5 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00] disabled:opacity-40"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => moderate(video._id, 'REJECTED')}
                        disabled={actingId === video._id || status === 'REJECTED'}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#d9b8ad] py-2.5 text-[9px] font-black uppercase tracking-widest text-[#7b3f3f] transition hover:bg-[#fff5f3] disabled:opacity-40"
                      >
                        <ShieldX size={14} /> Reject
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
