'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, reviewApi, deliveryApi } from '@/lib/api';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import toast from 'react-hot-toast';

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const { data: orders, loading, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?buyerId=${user?.id}`);
  
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittingReview, setSubmittingReview] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});

  useEffect(() => {
    if (user?.id) fetchOrders();
  }, [user?.id, fetchOrders]);

  // Fetch delivery data for receipt views
  useEffect(() => {
    if (!orders) return;
    orders.forEach((order: any) => {
      if (order.deliveryId && !deliveryCache[order.deliveryId]) {
        deliveryApi.get(`/deliveries/${order.deliveryId}`)
          .then(res => setDeliveryCache(prev => ({ ...prev, [order.deliveryId]: res.data?.data })))
          .catch(() => {});
      }
    });
  }, [orders, deliveryCache]);

  const openReceipt = (order: any) => {
    const delivery = order.deliveryId ? deliveryCache[order.deliveryId] : null;
    setReceiptOrder({
      ...order,
      delivery: delivery ? { rider: delivery.rider, status: delivery.status, route: delivery.route } : undefined,
    });
  };

  const openReviewModal = (order: any) => {
    setSelectedOrder(order);
    setRating({});
    setComments({});
    setReviewModalOpen(true);
  };

  const submitReview = async () => {
    if (Object.keys(rating).length === 0) return toast.error('Please provide at least one rating');
    setSubmittingReview(true);
    try {
      const reviewPromises = [];

      // Seller Review
      if (rating['seller']) {
        reviewPromises.push(reviewApi.post('/reviews', {
          buyerId: user?.id,
          targetId: selectedOrder.seller.sellerId || selectedOrder.sellerId,
          targetType: 'seller',
          rating: rating['seller'],
          comment: comments['seller'] || '',
          orderId: selectedOrder._id
        }).catch(err => {
          if (err.response?.status === 409) return { success: true }; // Ignore duplicates
          throw err;
        }));
      }

      // Rider Review
      const delivery = selectedOrder.deliveryId ? deliveryCache[selectedOrder.deliveryId] : null;
      if (rating['rider'] && delivery?.rider?._id) {
        reviewPromises.push(reviewApi.post('/reviews', {
          buyerId: user?.id,
          targetId: delivery.rider._id,
          targetType: 'rider',
          rating: rating['rider'],
          comment: comments['rider'] || '',
          orderId: selectedOrder._id
        }).catch(err => {
          if (err.response?.status === 409) return { success: true };
          throw err;
        }));
      }

      // Market Review
      if (rating['market'] && selectedOrder.seller?.marketId) {
        reviewPromises.push(reviewApi.post('/reviews', {
          buyerId: user?.id,
          targetId: selectedOrder.seller.marketId,
          targetType: 'market',
          rating: rating['market'],
          comment: comments['market'] || '',
          orderId: selectedOrder._id
        }).catch(err => {
          if (err.response?.status === 409) return { success: true };
          throw err;
        }));
      }

      // Product Reviews
      if (selectedOrder.products) {
        selectedOrder.products.forEach((p: any) => {
          if (rating[`product:${p.productId}`]) {
            reviewPromises.push(reviewApi.post('/reviews', {
              buyerId: user?.id,
              targetId: p.productId,
              targetType: 'product',
              rating: rating[`product:${p.productId}`],
              comment: comments[`product:${p.productId}`] || '',
              orderId: selectedOrder._id
            }).catch(err => {
              if (err.response?.status === 409) return { success: true };
              throw err;
            }));
          }
        });
      }

      await Promise.all(reviewPromises);
      toast.success('Reviews submitted successfully!');
      setReviewModalOpen(false);
    } catch (e: any) {
      console.error('Review submission error:', e);
      toast.error('Failed to submit reviews. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;

  return (
    <Layout>
      {receiptOrder && (
        <ReceiptView order={receiptOrder} role="buyer" onClose={() => setReceiptOrder(null)} />
      )}
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
                    <p className="text-sm font-medium">
                      {order.products && order.products.length > 1 
                        ? `${order.products.length} items` 
                        : (order.products?.[0]?.name || order.product?.name || 'Item')} • <span className="font-bold text-primary">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link href={`/orders/${order._id}/tracking`}>
                      <Button variant="outline" size="sm" fullWidth>Track Order</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => openReceipt(order)}>🧾 Receipt</Button>
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
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in p-0">
              <div className="p-6 border-b border-border sticky top-0 bg-background-card z-10 flex justify-between items-center">
                <h3 className="text-xl font-bold">Review Your Order</h3>
                <button onClick={() => setReviewModalOpen(false)} className="text-text-secondary hover:text-text-primary">✕</button>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Seller Section */}
                <div className="space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <span className="text-lg">🏪</span> Rate Seller: {selectedOrder?.seller?.fullName}
                  </h4>
                  <div className="flex justify-center">
                    <StarRating rating={rating['seller'] || 0} onRatingChange={(val) => setRating({...rating, seller: val})} />
                  </div>
                  <textarea 
                    className="w-full border border-border rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="How was the service and packaging?"
                    rows={2}
                    value={comments['seller'] || ''}
                    onChange={e => setComments({...comments, seller: e.target.value})}
                  ></textarea>
                </div>

                {/* Rider Section */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <span className="text-lg">🛵</span> Rate Rider
                  </h4>
                  <div className="flex justify-center">
                    <StarRating rating={rating['rider'] || 0} onRatingChange={(val) => setRating({...rating, rider: val})} />
                  </div>
                  <textarea 
                    className="w-full border border-border rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Was the delivery fast and professional?"
                    rows={2}
                    value={comments['rider'] || ''}
                    onChange={e => setComments({...comments, rider: e.target.value})}
                  ></textarea>
                </div>

                {/* Market Section */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <span className="text-lg">📍</span> Rate Marketplace Location
                  </h4>
                  <div className="flex justify-center">
                    <StarRating rating={rating['market'] || 0} onRatingChange={(val) => setRating({...rating, market: val})} />
                  </div>
                  <textarea 
                    className="w-full border border-border rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="How was the market cleanliness and safety?"
                    rows={2}
                    value={comments['market'] || ''}
                    onChange={e => setComments({...comments, market: e.target.value})}
                  ></textarea>
                </div>

                {/* Products Section */}
                {selectedOrder?.products?.map((p: any) => (
                  <div key={p.productId} className="space-y-4 pt-4 border-t border-border">
                    <h4 className="font-bold text-primary flex items-center gap-2">
                      <span className="text-lg">📦</span> Rate Item: {p.name}
                    </h4>
                    <div className="flex justify-center">
                      <StarRating rating={rating[`product:${p.productId}`] || 0} onRatingChange={(val) => setRating({...rating, [`product:${p.productId}`]: val})} />
                    </div>
                    <textarea 
                      className="w-full border border-border rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                      placeholder="How was the quality of this item?"
                      rows={2}
                      value={comments[`product:${p.productId}`] || ''}
                      onChange={e => setComments({...comments, [`product:${p.productId}`]: e.target.value})}
                    ></textarea>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-border sticky bottom-0 bg-background-card flex gap-4">
                <Button variant="outline" fullWidth onClick={() => setReviewModalOpen(false)}>Cancel</Button>
                <Button fullWidth onClick={submitReview} disabled={submittingReview}>
                  {submittingReview ? 'Submitting...' : 'Submit All Reviews'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
