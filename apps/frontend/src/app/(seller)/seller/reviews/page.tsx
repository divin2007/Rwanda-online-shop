'use client';
import React, { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { reviewApi, sellerApi } from '@/lib/api';
import Link from 'next/link';
import { Star } from 'lucide-react';

export default function SellerReviewsPage() {
  const { user } = useAuth();
  const { data: profile } = useApi(sellerApi, 'get', user?.id ? `/sellers/me?userId=${user?.id}` : '');
  const { data: reviews, loading, execute: fetchReviews } = useApi(reviewApi, 'get', user?.id ? `/reviews/target/seller/${user?.id}` : '');


  useEffect(() => {
    if (profile?._id) fetchReviews(`/reviews/target/seller/${profile._id}`);
  }, [profile?._id, fetchReviews]);

  if (loading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-xl">{profile?.shopDetails?.name || 'My Shop'}</h2>
            <p className="text-sm text-text-secondary">Stall: {profile?.stallId}</p>
          </div>
          <nav className="space-y-2">
            <Link href="/seller/dashboard" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Dashboard</Link>
            <Link href="/seller/products" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Products</Link>
            <Link href="/seller/reviews" className="block px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg">Reviews</Link>
            <Link href="/seller/earnings" className="block px-4 py-2 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg">Earnings</Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl">
            <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Shop Reviews</h1>
            <p className="text-text-secondary mb-8">What customers are saying about your service and products.</p>

            {!reviews || reviews.length === 0 ? (
              <Card className="text-center py-20 flex flex-col items-center justify-center">
                <Star size={64} className="text-primary mb-4 fill-primary animate-pulse" />
                <h3 className="text-xl font-bold mb-2">No reviews yet</h3>
                <p className="text-text-secondary">Keep providing great service to earn your first rating!</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {reviews.map((review: any) => (
                  <Card key={review._id} className="hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                          {review.buyerName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-text-primary">{review.buyerName || 'Verified Buyer'}</p>
                          <p className="text-xs text-text-secondary">{new Date(review.createdAt).toLocaleDateString()} • Order: #{review.orderId?.substring(0,8).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-status-warning">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < review.rating ? 'fill-status-warning text-status-warning' : 'text-border'}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-text-secondary leading-relaxed bg-background-surface p-4 rounded-xl">
                      "{review.comment || 'The buyer didn\'t leave a comment but gave a high rating!'}"
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}
