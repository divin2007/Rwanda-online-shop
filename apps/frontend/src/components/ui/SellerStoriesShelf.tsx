'use client';

import React from 'react';
import { productApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Sparkles, Store, X } from 'lucide-react';
import toast from 'react-hot-toast';

type Story = {
  _id: string;
  title: string;
  caption?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  categoryId?: string;
  likeCount?: number;
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
  };
};

export function SellerStoriesShelf() {
  const { user } = useAuth();
  const [stories, setStories] = React.useState<Story[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeStoryIndex, setActiveStoryIndex] = React.useState<number | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [commentText, setCommentText] = React.useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    async function loadStories() {
      try {
        const res = await productApi.get('/seller-videos/stories/personalized');
        setStories(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error('Failed to load stories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStories();
  }, []);

  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;
  const visibleStoryIndex = activeStoryIndex ?? 0;

  // Calculate remaining time for the 24-hour story window.
  const getExpirationText = (createdAt: string) => {
    const createdTime = new Date(createdAt).getTime();
    const expiryTime = createdTime + 24 * 60 * 60 * 1000;
    const remainingMs = expiryTime - Date.now();
    if (remainingMs <= 0) return 'Expired';
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Expires in ${hours}h ${minutes}m`;
  };

  const handleNext = () => {
    if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
      setIsPlaying(true);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const handlePrev = () => {
    if (activeStoryIndex !== null && activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleLike = async () => {
    if (!activeStory) return;
    if (!user) {
      toast.error('Please sign in to react to stories.');
      return;
    }
    try {
      const nextReaction = activeStory.viewerReaction === 'like' ? 'none' : 'like';
      const res = await productApi.post(`/seller-videos/${activeStory._id}/reaction`, { reaction: nextReaction });
      const updated = res.data?.data;
      if (updated) {
        setStories(current => current.map((item, idx) => idx === activeStoryIndex ? { ...item, likeCount: updated.likeCount, viewerReaction: updated.viewerReaction } : item));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update reaction.');
    }
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto py-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <div className="h-16 w-16 animate-pulse rounded-full bg-[#eaded4]" />
            <div className="h-3 w-12 animate-pulse rounded bg-[#eaded4]" />
          </div>
        ))}
      </div>
    );
  }

  if (stories.length === 0) {
    return null; // Don't show shelf if there are no stories
  }

  return (
    <div className="relative border-b border-[#eaded4] bg-[#fdfaf7] py-6 px-4 md:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#ff6b00] animate-bounce" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[#1b1c1c]">Live Seller Stories</h2>
          <span className="rounded-full bg-[#ffedd5] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff6b00]">24h Fresh</span>
        </div>

        <div className="flex snap-x gap-6 overflow-x-auto pb-2 scrollbar-none">
          {stories.map((story, index) => {
            const shopName = story.sellerId?.shopDetails?.name || story.sellerId?.stallName || 'Verified Merchant';
            const logo = story.sellerId?.shopDetails?.logoUrl
              ? resolveUploadUrl(story.sellerId.shopDetails.logoUrl, 'seller')
              : story.thumbnailUrl
                ? resolveUploadUrl(story.thumbnailUrl, 'product')
                : 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e';
            const isUserFavorite = story.categoryId && user?.preferences?.discovery?.categoryIds?.includes(story.categoryId.toLowerCase());

            return (
              <button
                key={story._id}
                onClick={() => {
                  setActiveStoryIndex(index);
                  setIsPlaying(true);
                }}
                className="group flex flex-col items-center gap-2 shrink-0 snap-start text-center focus:outline-none"
              >
                <div className="relative">
                  {/* Glowing active story border */}
                  <div className={`flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full p-[3px] transition-transform duration-300 group-hover:scale-105 ${
                    isUserFavorite 
                      ? 'bg-gradient-to-tr from-[#ff6b00] via-[#ffedd5] to-[#ffb26b] shadow-lg shadow-[#ff6b00]/20'
                      : 'bg-gradient-to-tr from-[#eaded4] via-[#ff6b00]/60 to-[#eaded4]'
                  }`}>
                    <div className="h-full w-full overflow-hidden rounded-full border border-white bg-white">
                      <img src={logo} alt="" className="h-full w-full object-cover" />
                    </div>
                  </div>

                  {/* Favorite Category badge */}
                  {isUserFavorite && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6b00] text-white shadow">
                      <Sparkles size={10} className="fill-white" />
                    </span>
                  )}
                </div>
                
                <span className="max-w-[76px] truncate text-[10px] font-black text-[#63736a] group-hover:text-[#ff6b00] transition-colors">
                  {shopName.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setActiveStoryIndex(null)} />
          
          <div className="relative z-10 flex h-full max-h-[820px] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl bg-[#1b1c1c] text-white shadow-2xl">
            {/* Header info */}
            <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent p-4">
              {/* Progress Bar indicator */}
              <div className="mb-3 flex gap-1">
                {stories.map((s, idx) => (
                  <div 
                    key={s._id} 
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      idx < visibleStoryIndex 
                        ? 'bg-white' 
                        : idx === visibleStoryIndex 
                          ? 'bg-[#ff6b00]' 
                          : 'bg-white/30'
                    }`} 
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 overflow-hidden rounded-full border border-white/40">
                    <img 
                      src={activeStory.sellerId?.shopDetails?.logoUrl ? resolveUploadUrl(activeStory.sellerId.shopDetails.logoUrl, 'seller') : activeStory.thumbnailUrl ? resolveUploadUrl(activeStory.thumbnailUrl, 'product') : 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e'} 
                      alt="" 
                      className="h-full w-full object-cover" 
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-black">{activeStory.sellerId?.shopDetails?.name || activeStory.sellerId?.stallName || 'Merchant'}</h3>
                    <p className="text-[9px] font-black tracking-wide text-[#ffb26b]">
                      {activeStory.marketId?.name || 'RMF Market'} · {getExpirationText(activeStory.createdAt)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveStoryIndex(null)}
                  className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Video Screen */}
            <div className="relative flex-1 cursor-pointer bg-[#1b1c1c]" onClick={togglePlay}>
              <video
                ref={videoRef}
                src={resolveUploadUrl(activeStory.videoUrl, 'product', '/seller-videos/upload')}
                autoPlay={isPlaying}
                playsInline
                onEnded={handleNext}
                className="h-full w-full object-cover"
              />

              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="rounded-full bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur-md">Paused</span>
                </div>
              )}
            </div>

            {/* Bottom Actions Overlay */}
            <div className="bg-gradient-to-t from-[#1b1c1c] via-[#1b1c1c]/95 to-transparent p-4">
              <h2 className="text-sm font-black tracking-tight leading-tight">{activeStory.title}</h2>
              {activeStory.caption && (
                <p className="mt-1 text-xs font-medium text-white/70 line-clamp-2">{activeStory.caption}</p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <div className="flex gap-4">
                  <button 
                    onClick={handleLike}
                    className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                      activeStory.viewerReaction === 'like' ? 'text-[#ff6b00]' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <Heart size={20} className={activeStory.viewerReaction === 'like' ? 'fill-[#ff6b00]' : ''} />
                    <span>{activeStory.likeCount || 0}</span>
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <button 
                    onClick={handlePrev}
                    disabled={activeStoryIndex === 0}
                    className="rounded-full bg-white/5 p-2 text-white disabled:opacity-30 hover:bg-white/10 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={handleNext}
                    className="rounded-full bg-white/5 p-2 text-white hover:bg-white/10 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
