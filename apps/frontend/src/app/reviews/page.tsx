'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, MessageSquare } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { reviewApi } from '@/lib/api';
import { sanitizeText } from '@/lib/sanitize';

interface Review {
  _id: string;
  rating?: number;
  comment?: string;
  targetType?: 'seller' | 'rider' | 'market' | 'product' | string;
  targetId?: string;
  targetName?: string;
  productName?: string;
  orderId?: string;
  createdAt?: string;
}

const Stars = ({ value = 0 }: { value?: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        size={15}
        className={i <= Math.round(value) ? 'fill-[#ffd700] text-[#ffd700]' : 'text-[#d9e0db]'}
      />
    ))}
  </div>
);

export default function MyReviewsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login?redirect=/reviews');
    }
  }, [isLoading, user, router]);

  const { data: reviews, loading } = useApi<Review[]>(reviewApi, 'get', user?.id ? '/reviews/me' : '');

  const list = useMemo(() => (Array.isArray(reviews) ? reviews : []), [reviews]);

  const avg = useMemo(() => {
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    return sum / list.length;
  }, [list]);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 animate-reveal pb-20">
        {/* Header */}
        <section className="overflow-hidden rounded-lg border border-[#d8ded9] bg-[#e05300] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffedd5]">
                <MessageSquare size={14} />
                Feedback
              </div>
              <h1 className="text-3xl font-black tracking-normal md:text-4xl">My Reviews</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">
                Ratings and feedback connected to your account.
              </p>
            </div>
            {list.length > 0 && (
              <div className="rounded-md border border-white/15 bg-white/10 px-5 py-3 text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Average rating</p>
                <p className="mt-1 text-2xl font-sans text-[#ffedd5]">{avg.toFixed(1)} <span className="text-sm">/ 5</span></p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">{list.length} review{list.length === 1 ? '' : 's'}</p>
              </div>
            )}
          </div>
        </section>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-lg border border-[#e0e0e0] bg-white" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white px-4 py-20 text-center">
            <Star className="mb-4 text-[#ff6b00]/50" size={44} />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">No reviews yet</p>
            <p className="mt-2 max-w-md text-xs font-semibold text-[#8b938d]">
              Once you complete an order, you can rate the seller, product, and rider from the order tracking page.
            </p>
            <Link href="/orders" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#e05300] px-6 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00]">
              View my orders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map(review => (
              <article key={review._id} className="rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-sm transition hover:border-[#ff6b00]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-[#1b1c1c]">
                      {sanitizeText(review.productName || review.targetName || review.targetType || 'Reviewed item')}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#5f7569]">
                      {review.targetType || 'item'}
                      {review.orderId ? ` · Order #${String(review.orderId).substring(0, 8).toUpperCase()}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <Stars value={Number(review.rating || 0)} />
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#717973]">
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-4 rounded-md bg-[#fcf9f8] p-4 text-sm leading-6 text-[#414844]">
                    “{sanitizeText(review.comment)}”
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
