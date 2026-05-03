'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, reviewApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const { data: orders, loading, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?buyerId=${user?.id}`);
  
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (user?.id) fetchOrders();
  }, [user?.id, fetchOrders]);

  const openReviewModal = (order: any) => {
    setSelectedOrder(order);
    setRating(0);
    setComment('');
    setReviewModalOpen(true);
  };

  const submitReview = async () => {
    if (rating === 0) return toast.error('Please provide a rating');
    setSubmittingReview(true);
    try {
      await reviewApi.post('/reviews', {
        targetId: selectedOrder.sellerId,
        targetType: 'seller',
        rating,
        comment,
        orderId: selectedOrder._id
      });
      toast.success('Review submitted successfully!');
      setReviewModalOpen(false);
    } catch (e: any) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-10 px-4">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">My Orders</h1>
        <p className="text-text-secondary mb-8">View your order history and track active deliveries.</p>

        <Card noPadding>
          <div className="divide-y divide-border">
            {!orders || orders.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">No orders found. Start shopping!</div>
            ) : (
              orders.map((order: any) => (
                <div key={order._id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-background-surface transition-colors">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">#{order._id.substring(0,8).toUpperCase()}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        order.status === 'delivered' ? 'bg-status-success/10 text-status-success' : 'bg-status-info/10 text-status-info'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mb-2">{new Date(order.createdAt).toLocaleDateString()}</p>
                    <p className="text-sm font-medium">{order.items?.length || 0} items • <span className="font-bold text-primary">{order.total?.toLocaleString() || 0} RWF</span></p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link href={`/orders/${order._id}/tracking`}>
                      <Button variant="outline" size="sm" fullWidth>Track Order</Button>
                    </Link>
                    {order.status === 'delivered' && (
                      <Button variant="primary" size="sm" onClick={() => openReviewModal(order)}>Write Review</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Review Modal */}
        {reviewModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md animate-fade-in">
              <h3 className="text-xl font-bold mb-4">Rate your experience</h3>
              <p className="text-sm text-text-secondary mb-4">Order #{selectedOrder?._id.substring(0,8).toUpperCase()}</p>
              
              <div className="mb-6 flex justify-center">
                <StarRating rating={rating} onRatingChange={setRating} />
              </div>
              
              <textarea 
                className="w-full border border-border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-primary outline-none"
                rows={4}
                placeholder="Share details of your own experience..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              ></textarea>
              
              <div className="flex gap-4">
                <Button variant="outline" fullWidth onClick={() => setReviewModalOpen(false)}>Cancel</Button>
                <Button fullWidth onClick={submitReview} disabled={submittingReview}>
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
