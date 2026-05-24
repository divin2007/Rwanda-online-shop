'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Send, Store, ThumbsDown, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { productApi } from '@/lib/api';
import { getMarketUrl, getProductUrl } from '@/lib/urls';
import { resolveUploadUrl } from '@/lib/uploadUrls';

type SellerVideo = {
  _id: string;
  title: string;
  caption?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  placement?: 'PRODUCT_AD' | 'SHOP_AD' | 'STORY';
  tags?: string[];
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  viewCount?: number;
  viewerReaction?: 'like' | 'dislike' | null;
  sellerId?: {
    _id?: string;
    stallName?: string;
    shopDetails?: {
      name?: string;
      slug?: string;
      logoUrl?: string;
    };
  };
  marketId?: {
    _id?: string;
    name?: string;
    slug?: string;
  };
  productId?: {
    _id?: string;
    name?: string;
    price?: number;
    unit?: string;
    images?: string[];
  };
  comments?: Array<{
    _id?: string;
    fullName?: string;
    text?: string;
    createdAt?: string;
  }>;
};

export function SellerVideoFeed({
  marketId,
  sellerId,
  title = 'Market videos',
  description = 'Scroll seller videos, product demos, and shop adverts from live RMF sellers.',
  compact = false,
  placement,
  search,
  onTagClick,
}: {
  marketId?: string;
  sellerId?: string;
  title?: string;
  description?: string;
  compact?: boolean;
  placement?: 'PRODUCT_AD' | 'SHOP_AD' | 'STORY';
  search?: string;
  onTagClick?: (tag: string) => void;
}) {
  const { user } = useAuth();
  const [videos, setVideos] = React.useState<SellerVideo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({});

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    } else {
      window.location.href = `/videos?search=${encodeURIComponent(tag)}`;
    }
  };

  const fetchVideos = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: compact ? '8' : '24' });
      if (marketId) params.set('marketId', marketId);
      if (sellerId) params.set('sellerId', sellerId);
      if (placement) params.set('placement', placement);
      if (search?.trim()) params.set('search', search.trim());
      const res = await productApi.get(`/seller-videos?${params.toString()}`);
      setVideos(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error('Failed to load seller videos', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [compact, marketId, placement, search, sellerId]);

  React.useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const reactToVideo = async (video: SellerVideo, reaction: 'like' | 'dislike') => {
    if (!user) {
      toast.error('Sign in to react to seller videos.');
      return;
    }
    const nextReaction = video.viewerReaction === reaction ? 'none' : reaction;
    try {
      const res = await productApi.post(`/seller-videos/${video._id}/reaction`, { reaction: nextReaction });
      const updated = res.data?.data;
      setVideos(current => current.map(item => item._id === video._id ? updated : item));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not update reaction.');
    }
  };

  const comment = async (video: SellerVideo) => {
    if (!user) {
      toast.error('Sign in to comment on seller videos.');
      return;
    }
    const text = (commentDrafts[video._id] || '').trim();
    if (!text) return;
    try {
      const res = await productApi.post(`/seller-videos/${video._id}/comments`, { text, fullName: user.fullName });
      const updated = res.data?.data;
      setVideos(current => current.map(item => item._id === video._id ? updated : item));
      setCommentDrafts(current => ({ ...current, [video._id]: '' }));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not post comment.');
    }
  };

  return (
    <section className={compact ? 'space-y-4' : 'mx-auto max-w-[1440px] px-4 py-8 md:px-8'}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6b00]">
            <Video size={16} /> Seller video ads
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[#1b1c1c] md:text-4xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#63736a]">{description}</p>
        </div>
        {!compact && <Link href="/videos" className="hidden text-sm font-black uppercase tracking-widest text-[#ff6b00] hover:underline md:inline-flex">Open feed</Link>}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-[32rem] animate-pulse rounded-2xl bg-[#fff0e4]" />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#eaded4] bg-white p-10 text-center">
          <p className="text-sm font-bold text-[#63736a]">No seller videos are published for this view yet.</p>
        </div>
      ) : (
        <div className={compact ? 'flex snap-x gap-4 overflow-x-auto pb-3' : 'mx-auto flex max-w-[520px] snap-y snap-mandatory flex-col gap-8'}>
          {videos.map(video => {
            const shopName = video.sellerId?.shopDetails?.name || video.sellerId?.stallName || 'Verified seller';
            const marketSlug = video.marketId?.slug;
            const productImage = video.productId?.images?.find(Boolean);
            const videoSrc = resolveUploadUrl(video.videoUrl, 'product', '/seller-videos/upload');
            const posterSrc = video.thumbnailUrl
              ? resolveUploadUrl(video.thumbnailUrl, 'product')
              : productImage
                ? resolveUploadUrl(productImage, 'product')
                : undefined;
            return (
              <article key={video._id} className={`${compact ? 'w-[18rem] shrink-0 snap-start' : 'snap-start'} overflow-hidden rounded-2xl border border-[#eaded4] bg-white shadow-sm`}>
                <div className="relative aspect-[9/16] bg-[#1b1c1c]">
                  <video
                    src={videoSrc}
                    poster={posterSrc}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  {/* Floating Market Account Badge */}
                  {video.marketId?.slug && (
                    <Link 
                      href={getMarketUrl(video.marketId.slug)}
                      className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-[#ff6b00] transition-all duration-300 border border-white/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md cursor-pointer hover:scale-[1.05]"
                    >
                      <Store size={12} className="text-[#ffb26b]" />
                      <span>{video.marketId.name || 'Shop'}</span>
                    </Link>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                    <p className="line-clamp-1 text-sm font-black">{shopName}</p>
                    <p className="line-clamp-2 text-xs font-semibold text-white/75">
                      {video.placement === 'SHOP_AD' ? 'Shop advert: ' : video.placement === 'STORY' ? 'Story: ' : ''}{video.caption || video.title}
                    </p>
                    <p className="mt-2 line-clamp-1 text-[11px] font-black uppercase tracking-widest text-[#ffb26b]">
                      {video.marketId?.name || 'RMF market'}{video.productId?.name ? ` · ${video.productId.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <span className="mb-2 inline-flex rounded-full bg-[#ffedd5] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#c2410c]">
                      {video.placement === 'SHOP_AD' ? 'Shop advert' : video.placement === 'STORY' ? '24h story' : 'Product demo'}
                    </span>
                    <h3 className="line-clamp-2 text-lg font-black leading-tight text-[#1b1c1c]">{video.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {video.tags?.slice(0, 4).map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#c2410c] hover:bg-[#ff6b00] hover:text-white transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {video.productId?._id ? (
                    <Link href={getProductUrl(video.productId._id)} className="flex items-center gap-3 rounded-xl border border-[#eaded4] p-3 hover:border-[#ff6b00]/40">
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-[#fff7ed]">
                        {productImage ? <img src={resolveUploadUrl(productImage, 'product')} alt="" className="h-full w-full object-cover" /> : <Store size={18} className="text-[#ff6b00]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-black text-[#1b1c1c]">{video.productId.name}</p>
                        <p className="text-xs font-bold text-[#63736a]">{Number(video.productId.price || 0).toLocaleString()} RWF {video.productId.unit ? `/ ${video.productId.unit}` : ''}</p>
                      </div>
                    </Link>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <button onClick={() => reactToVideo(video, 'like')} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black uppercase ${video.viewerReaction === 'like' ? 'bg-[#ff6b00] text-white' : 'bg-[#fff7ed] text-[#7c2d12]'}`}>
                      <Heart size={15} /> {video.likeCount || 0}
                    </button>
                    <button onClick={() => reactToVideo(video, 'dislike')} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black uppercase ${video.viewerReaction === 'dislike' ? 'bg-[#1b1c1c] text-white' : 'bg-[#fff7ed] text-[#7c2d12]'}`}>
                      <ThumbsDown size={15} /> {video.dislikeCount || 0}
                    </button>
                    <div className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#fdfaf7] text-xs font-black uppercase text-[#63736a]">
                      <MessageCircle size={15} /> {video.commentCount || 0}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {video.comments?.slice(-2).map((item, index) => (
                      <p key={item._id || index} className="rounded-lg bg-[#fdfaf7] px-3 py-2 text-xs font-semibold text-[#414844]">
                        <span className="font-black text-[#1b1c1c]">{item.fullName || 'RMF user'}:</span> {item.text}
                      </p>
                    ))}
                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[video._id] || ''}
                        onChange={event => setCommentDrafts(current => ({ ...current, [video._id]: event.target.value }))}
                        placeholder="Comment..."
                        className="min-w-0 flex-1 rounded-xl border border-[#eaded4] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ff6b00]"
                      />
                      <button onClick={() => comment(video)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b00] text-white">
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
