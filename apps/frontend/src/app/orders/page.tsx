'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { ReceiptView } from '@/components/ui/ReceiptView';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

function OrderHistoryContent() {
  const { user } = useAuth();
  const { data: orders, loading, execute: fetchOrders } = useApi(orderApi, 'get', user?.id ? `/orders?buyerId=${user?.id}` : '');
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});
  const searchParams = useSearchParams();
  const openOrderId = searchParams.get('open');

  useEffect(() => {
    if (user?.id) fetchOrders();
  }, [user?.id, fetchOrders]);

  useEffect(() => {
    if (!orders) return;
    orders.forEach((order: any) => {
      if (order.deliveryId && !deliveryCache[order.deliveryId]) {
        deliveryApi.get(`/deliveries/${order.deliveryId}`)
          .then(res => setDeliveryCache(prev => ({ ...prev, [order.deliveryId]: res.data?.data })))
          .catch(() => {});
      }
    });

    // Auto-open receipt if 'open' param is present
    if (openOrderId && !receiptOrder) {
      const orderToOpen = orders.find((o: any) => o._id === openOrderId);
      if (orderToOpen) {
        setReceiptOrder(orderToOpen);
      }
    }
  }, [orders, openOrderId]);

  const statusColors: Record<string, string> = {
    awaiting_quote: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    quote_sent: 'bg-blue-100 text-blue-800 border-blue-300',
    placed: 'bg-purple-100 text-purple-800 border-purple-300',
    confirmed: 'bg-green-100 text-green-800 border-green-300',
    preparing: 'bg-orange-100 text-orange-800 border-orange-300',
    ready_for_pickup: 'bg-teal-100 text-teal-800 border-teal-300',
    delivered: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <Layout>
      {receiptOrder && (
        <ReceiptView order={receiptOrder} role="buyer" onClose={() => setReceiptOrder(null)} />
      )}
      
      <div className="max-w-6xl mx-auto space-y-12 animate-reveal pb-24 pt-10 px-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-[#e0e0e0] pb-6 gap-6">
          <div>
            <p className="text-[10px] font-black text-[#1b4332] uppercase tracking-[0.5em] mb-2">My Account</p>
            <h1 className="text-3xl md:text-5xl font-sans text-[#1b1c1c] tracking-normal leading-none">Order History</h1>
          </div>
          <Link href="/markets" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c] hover:text-[#1b4332] border-b-2 border-transparent hover:border-[#1b4332] pb-1 transition-all">
            Continue Shopping →
          </Link>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-[#f0eded] animate-pulse border border-[#e0e0e0]" />
            ))
          ) : !orders || orders.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-[#e0e0e0] p-24 text-center">
              <div className="text-6xl mb-6 opacity-80">🛍️</div>
              <h3 className="text-2xl font-sans text-[#1b1c1c] mb-2">No orders yet</h3>
              <p className="text-[11px] font-black text-[#414844] uppercase tracking-widest opacity-60 mb-8">Your recent purchases will appear here</p>
              <Link href="/markets" className="bg-[#012d1d] text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#1b4332] transition-all inline-block shadow-lg">
                Explore Markets
              </Link>
            </div>
          ) : (
            orders.map((order: any) => (
              <div key={order._id} className="bg-white border border-[#e0e0e0] hover:border-[#1b4332] transition-colors p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 group">
                
                {/* Left: Product Info & Meta */}
                <div className="flex items-center gap-6 flex-1 min-w-0">
                  <div className="w-24 h-24 bg-[#fcf9f8] border border-[#e0e0e0] flex-shrink-0 overflow-hidden hidden sm:block">
                    {order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0] ? (
                      <img 
                        src={order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0]} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        alt="" 
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase tracking-widest text-[#414844]">
                        Item
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xl font-sans text-[#1b1c1c] tracking-normal leading-none">
                        #{order._id.substring(0,8).toUpperCase()}
                      </span>
                      <span className={`text-[9px] font-black px-2.5 py-1 uppercase tracking-widest border ${statusColors[order.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-sans text-[#1b1c1c] leading-snug">
                        {order.products?.[0]?.name || 'Market Item'} 
                        {order.products?.length > 1 && <span className="text-[#414844]"> +{order.products.length - 1} more</span>}
                      </p>
                      <p className="text-[10px] font-black text-[#414844] uppercase tracking-widest mt-1 opacity-70">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {order.sellerName || 'Verified Seller'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Financials & Actions */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 lg:gap-10 w-full lg:w-auto pt-6 lg:pt-0 border-t lg:border-t-0 border-[#f0eded]">
                  <div className="text-left lg:text-right flex-1 sm:flex-none">
                    <p className="text-[9px] font-black text-[#414844] uppercase tracking-widest mb-1">Total Paid</p>
                    <p className="text-2xl font-sans text-[#1b1c1c] tracking-normal">
                      {(order.financials?.totalAmount || 0).toLocaleString()} <span className="text-sm font-sans not-italic text-[#1b4332] tracking-widest uppercase font-bold">RWF</span>
                    </p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Link 
                      href={`/orders/${order._id}/tracking`} 
                      className="flex-1 sm:flex-none text-center bg-[#012d1d] text-white px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[#1b4332] transition-all shadow-md"
                    >
                      Track
                    </Link>
                    <button 
                      onClick={() => setReceiptOrder(order)} 
                      className="flex-1 sm:flex-none text-center border border-[#e0e0e0] rounded-lg text-[#1b1c1c] px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:border-[#1b4332] transition-colors"
                    >
                      Receipt
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function OrderHistoryPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#fdfaf7] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
      </div>
    }>
      <OrderHistoryContent />
    </React.Suspense>
  );
}
