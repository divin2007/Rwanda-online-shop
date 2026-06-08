'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi, deliveryApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { ReceiptView } from '@/components/ui/ReceiptView';
import { useLanguage } from '@/context/LanguageContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import toast from 'react-hot-toast';
import { ShoppingBag } from 'lucide-react';

const ORDER_LIST_AUTO_REFRESH_MS = 10000;

function OrderHistoryContent() {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const { data: orders, loading, execute: fetchOrders } = useApi(orderApi, 'get', user?.id ? `/orders?buyerId=${user?.id}` : '', { refreshInterval: ORDER_LIST_AUTO_REFRESH_MS });
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});
  const searchParams = useSearchParams();
  const openOrderId = searchParams.get('open');

  const getReceiptRole = (order: any): 'buyer' | 'seller' | 'rider' | 'admin' => {
    if (user?.role === 'ADMIN') return 'admin';
    if (user?.role === 'RIDER') return 'rider';

    const userId = String(user?.id || '');
    if (userId && String(order?.seller?.userId || '') === userId) return 'seller';
    if (userId && String(order?.buyer?.userId || '') === userId) return 'buyer';

    return user?.role === 'SELLER' ? 'seller' : 'buyer';
  };

  const refreshOrders = async () => {
    const refreshed = await fetchOrders();
    const currentOpenId = receiptOrder?._id || openOrderId;
    if (currentOpenId && Array.isArray(refreshed)) {
      const updatedReceiptOrder = refreshed.find((order: any) => order._id === currentOpenId);
      if (updatedReceiptOrder) setReceiptOrder(updatedReceiptOrder);
    }
  };

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
    awaiting_quote: 'bg-amber-50 text-amber-700 border-amber-200',
    quote_sent: 'bg-[#fff7ed] text-[#a63b00] border-[#ffdbce]',
    placed: 'bg-[#fff7ed] text-[#9a3412] border-[#ffedd5]',
    confirmed: 'bg-[#e8f5ed] text-[#12805c] border-[#bfe3cb]',
    preparing: 'bg-[#fff7ed] text-[#a63b00] border-[#ffdbce]',
    ready_for_pickup: 'bg-[#eef4ff] text-[#005ac2] border-[#d8e2ff]',
    delivered: 'bg-[#e8f5ed] text-[#12805c] border-[#bfe3cb]',
    disputed: 'bg-red-50 text-red-700 border-red-200',
    resolved: 'bg-[#e8f5ed] text-[#12805c] border-[#bfe3cb]',
    cancelled: 'bg-[#f8eeee] text-[#ba1a1a] border-[#f2c8c8]',
  };

  if (isLoading || !user) {
    return (
      <Layout>
        <div className="flex justify-center p-20">
          <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {receiptOrder && (
        <ReceiptView
          order={receiptOrder}
          role={getReceiptRole(receiptOrder)}
          onClose={() => setReceiptOrder(null)}
          onOrderUpdated={refreshOrders}
        />
      )}
      
      <div className="w-full p-6 md:p-8 pt-10 md:pt-12 space-y-lg animate-reveal pb-24">
        <section className="relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-md md:p-lg custom-shadow">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-container/10 blur-3xl" />

          <div className="relative space-y-xs">
            <p className="flex items-center gap-xs font-label-caps text-[10px] text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span> {t('my_account') || 'My Account'}
            </p>
            <h1 className="max-w-xl font-display-lg text-headline-lg text-on-surface leading-tight">
              {t('order_history') || 'Order History'}
            </h1>
            <p className="max-w-xl text-xs text-on-surface-variant leading-relaxed font-body-md">
              Review escrow negotiations, live tracking telemetry feeds, and transaction records.
            </p>
          </div>
        </section>

        {/* Orders list */}
        <div className="space-y-sm">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-surface-container-low animate-pulse rounded-lg border border-outline-variant" />
            ))
          ) : !orders || orders.length === 0 ? (
            <div className="border border-dashed border-outline-variant rounded-lg bg-surface-container-low/30 py-20 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="w-14 h-14 bg-surface-container-lowest border border-outline-variant rounded-full flex items-center justify-center mb-6 text-on-surface-variant shadow-sm">
                <ShoppingBag size={22} className="text-primary-container" />
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{t('no_orders_yet') || 'No orders yet'}</h3>
              <p className="font-data-mono-sm text-[9px] text-on-surface-variant uppercase tracking-wider mb-8">{t('recent_purchases_appear_here') || 'Your purchase telemetries will appear here.'}</p>
              <Link 
                href="/markets" 
                className="rounded-md bg-primary-container text-white px-6 py-3 text-xs font-black uppercase tracking-wider hover:bg-primary transition-all duration-300 shadow-sm active:scale-[0.99]"
              >
                {t('explore_markets') || 'Explore Markets'}
              </Link>
            </div>
          ) : (
            orders.map((order: any, idx: number) => (
              <div key={`${order._id || 'order'}-${idx}`} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-md table-row-hover transition-colors custom-shadow">
                
                {/* Left: Product Info & Meta */}
                <div className="flex items-center gap-md flex-1 min-w-0">
                  <div className="w-16 h-16 bg-surface-container-low border border-outline-variant rounded overflow-hidden flex-shrink-0 hidden sm:block">
                    {order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0] ? (
                      <img 
                        src={resolveUploadUrl(order.products?.[0]?.imageUrl || order.products?.[0]?.images?.[0], 'product')} 
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                        alt="" 
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-data-mono text-[9px] text-on-surface-variant uppercase">
                        {t('item') || 'Item'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-xs min-w-0 flex-1">
                    <div className="flex items-center gap-sm flex-wrap">
                      <span className="font-data-mono text-sm font-bold text-on-surface">
                        #{order._id.substring(0,8).toUpperCase()}
                      </span>
                      <span className={`font-data-mono-sm text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border ${statusColors[order.status] || 'bg-surface-container-high/60 text-on-surface border-outline-variant'}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-on-surface leading-tight truncate">
                        {order.products?.[0]?.name || t('market_item') || 'Market Item'} 
                        {order.products?.length > 1 && <span className="text-on-surface-variant font-medium"> +{order.products.length - 1} {t('more') || 'more'}</span>}
                      </p>
                      <p className="font-data-mono-sm text-[9px] text-on-surface-variant uppercase mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString()} / {order.sellerName || t('verified_seller') || 'Verified Seller'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Financials & Actions */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-md lg:gap-lg w-full lg:w-auto pt-sm lg:pt-0 border-t lg:border-t-0 border-outline-variant/40">
                  <div className="text-left lg:text-right flex-grow sm:flex-grow-0">
                    <p className="font-label-caps text-[8px] text-on-surface-variant mb-0.5">{t('total_paid') || 'Total Amount'}</p>
                    <p className="font-data-mono text-sm font-bold text-on-surface">
                      {(order.financials?.totalAmount || 0).toLocaleString()} <span className="font-label-caps text-[9px] text-primary-container font-bold">RWF</span>
                    </p>
                  </div>
                  <div className="flex gap-xs w-full sm:w-auto">
                    <Link 
                      href={`/orders/${order._id}/tracking`} 
                      className="rounded-md bg-primary-container text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-primary transition-all duration-300 shadow-sm active:scale-[0.99] text-center flex-grow sm:flex-grow-0"
                    >
                      Open Order
                    </Link>
                    <button 
                      type="button"
                      onClick={() => setReceiptOrder(order)} 
                      className="rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface px-4 py-2.5 text-xs font-black uppercase tracking-wider hover:border-primary hover:text-primary transition-all duration-300 text-center flex-grow sm:flex-grow-0"
                    >
                      {t('receipt') || 'Receipt'}
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
      </div>
    }>
      <OrderHistoryContent />
    </React.Suspense>
  );
}
