'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { ReceiptView } from '@/components/ui/ReceiptView';
import toast from 'react-hot-toast';

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const { data: orders, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?buyerId=${user?.id}`);
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});

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
  }, [orders]);

  return (
    <Layout>
      {receiptOrder && (
        <ReceiptView order={receiptOrder} role="buyer" onClose={() => setReceiptOrder(null)} />
      )}
      
      <div className="max-w-5xl mx-auto space-y-12 animate-fade-in pb-20">
        <div className="border-b border-[#E5E1D8] pb-8">
          <p className="text-[10px] font-bold text-[#A34D15] uppercase tracking-[0.4em] mb-2">Member Portal</p>
          <h1 className="text-5xl font-serif text-[#1A1A1A]">Fulfillment Mandates</h1>
        </div>

        <div className="bg-white border border-[#E5E1D8] overflow-hidden">
          {!orders || orders.length === 0 ? (
            <div className="p-24 text-center">
              <p className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest opacity-40 italic">No Active Mandates Found</p>
              <Link href="/" className="inline-block mt-8 text-[10px] font-bold uppercase tracking-widest text-[#A34D15] border-b border-[#A34D15]/20 pb-1">Start Exploring Markets →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E1D8]">
              {orders.map((order: any) => (
                <div key={order._id} className="p-10 flex flex-col md:flex-row md:items-center justify-between gap-10 hover:bg-[#F9F7F2] transition-colors group">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-serif text-[#1A1A1A]">#{order._id.substring(0,8).toUpperCase()}</span>
                      <span className="text-[8px] font-bold text-[#A34D15] border border-[#A34D15]/20 px-3 py-1 uppercase tracking-tighter">
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mb-1">{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-sm font-serif text-[#1A1A1A]">
                        {order.products?.[0]?.name || 'Premium Heritage Item'} {order.products?.length > 1 ? `+${order.products.length - 1} more` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mb-1">Total Valuation</p>
                      <p className="text-xl font-bold text-[#1A1A1A]">{(order.financials?.totalAmount || 0).toLocaleString()} RWF</p>
                    </div>
                    <div className="flex gap-4">
                      <Link href={`/orders/${order._id}/tracking`} className="bg-[#A34D15] text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#823D11] transition-all">Track</Link>
                      <button onClick={() => setReceiptOrder(order)} className="border border-[#E5E1D8] text-[#1A1A1A] px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#1A1A1A]/5 transition-colors">Receipt</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
