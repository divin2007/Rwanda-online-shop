'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ReceiptView, type ReceiptOrder } from '@/components/ui/ReceiptView';
import { useApi } from '@/hooks/useApi';
import { adminApi, sellerApi, orderApi, riderApi, deliveryApi, walletApi, marketApi, productApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { AnalyticsCharts } from '@/components/ui/AnalyticsCharts';
import { ImageUpload } from '@/components/ui/ImageUpload';

const RiderMap = dynamic(
  () => import('@/components/ui/RiderMap').then((mod) => mod.RiderMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#F8F6F1] animate-pulse flex items-center justify-center text-[#6B665E]">Loading Map...</div> }
);

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptOrder | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [deliveryCache, setDeliveryCache] = useState<Record<string, any>>({});
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAddingMarket, setIsAddingMarket] = useState(false);
  const [newMarket, setNewMarket] = useState({
    name: '',
    code: '',
    type: 'public',
    description: '',
    imageUrl: '',
    lat: -1.9441,
    lng: 30.0619,
    address: ''
  });

  const { data: analytics, execute: fetchAnalytics } = useApi(adminApi, 'get', '/admin/analytics');
  const { data: dashboardAnalytics, execute: fetchDashboardAnalytics } = useApi(adminApi, 'get', '/admin/dashboard/analytics');
  const { data: fraudAlerts, execute: fetchFraud } = useApi(adminApi, 'get', '/admin/fraud-alerts');
  const { data: pendingSellers, execute: fetchSellers } = useApi(sellerApi, 'get', '/sellers?isApproved=false');
  const { data: pendingProducts, execute: fetchPendingProducts } = useApi(productApi, 'get', '/products?isApproved=false');
  const { data: pendingRiders, execute: fetchRiders } = useApi(riderApi, 'get', '/riders?isApproved=false');
  const { data: disputes, execute: fetchDisputes } = useApi(orderApi, 'get', '/orders?isDisputed=true&dispute.resolvedAt=null');
  const { data: ordersData, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?sellerId=all`, { refreshInterval: 30000 });
  const { data: markets, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets');

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      fetchDashboardAnalytics();
    }
    if (activeTab === 'fraud') fetchFraud();
    if (activeTab === 'sellers') fetchSellers();
    if (activeTab === 'products') fetchPendingProducts();
    if (activeTab === 'riders') fetchRiders();
    if (activeTab === 'disputes') fetchDisputes();
    if (activeTab === 'markets') fetchMarkets();
    if (activeTab === 'accounting') {
      setFetchError(null);
      fetchOrders().catch(() => setFetchError('Failed to load orders. Please try again.'));
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics, fetchDashboardAnalytics, fetchFraud, fetchSellers, fetchPendingProducts, fetchRiders, fetchDisputes, fetchOrders]);

  useEffect(() => { setPage(1); }, [dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (ordersData && Array.isArray(ordersData)) {
      setAllOrders(ordersData);
      ordersData.forEach((order: any) => {
        if (order.deliveryId && !deliveryCache[order.deliveryId]) {
          deliveryApi.get(`/deliveries/${order.deliveryId}`)
            .then(res => setDeliveryCache(prev => ({ ...prev, [order.deliveryId]: res.data?.data })))
            .catch(() => {});
        }
      });
    }
  }, [ordersData, deliveryCache]);

  const filteredOrders = allOrders.filter((o: any) => {
    if (dateRange === 'all') return true;
    const now = Date.now();
    const created = new Date(o.createdAt).getTime();
    if (dateRange === 'today') return now - created < 86400000;
    if (dateRange === 'week') return now - created < 604800000;
    if (dateRange === 'month') return now - created < 2592000000;
    return true;
  });

  const openReceipt = (order: any) => {
    const delivery = order.deliveryId ? deliveryCache[order.deliveryId] : null;
    setSelectedReceipt({
      ...order,
      delivery: delivery ? { rider: delivery.rider, status: delivery.status, route: delivery.route } : undefined,
    });
  };

  const totalGMV = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.totalAmount || 0), 0);
  const totalCommission = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.platformCommission || 0), 0);
  const totalGateway = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.gatewayFee || 0), 0);
  const totalSellerPayout = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.sellerPayout || 0), 0);
  const totalRiderPayout = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.riderPayout || 0), 0);
  const platformRevenue = totalCommission + totalGateway;
  const deliveredOrders = filteredOrders.filter((o: any) => o.status === 'delivered' || o.status === 'resolved');

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    const headers = ['Order #', 'Date', 'Buyer', 'Seller', 'GMV (RWF)', 'Commission (RWF)', 'Seller Payout (RWF)', 'Rider Payout (RWF)', 'Status'];
    const rows = filteredOrders.map((o: any) => [
      o._id.substring(0, 6).toUpperCase(),
      new Date(o.createdAt).toLocaleDateString(),
      o.buyer?.fullName || 'N/A',
      o.seller?.fullName || 'N/A',
      o.financials?.totalAmount || 0,
      o.financials?.platformCommission || 0,
      o.financials?.sellerPayout || 0,
      o.financials?.riderPayout || 0,
      o.status === 'delivered' ? 'SETTLED' : o.status === 'resolved' ? 'RESOLVED' : o.status === 'cancelled' ? 'CANCELLED' : o.status === 'disputed' ? 'DISPUTED' : 'PENDING'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approveSeller = async (id: string) => {
    try {
      await sellerApi.post(`/sellers/${id}/approve`);
      toast.success('Seller approved successfully');
      fetchSellers();
    } catch (e) {
      toast.error('Failed to approve seller');
    }
  };

  const approveRider = async (id: string) => {
    try {
      await riderApi.post(`/riders/${id}/approve`);
      toast.success('Rider approved successfully');
      fetchRiders();
    } catch (e) {
      toast.error('Failed to approve rider');
    }
  };

  const approveProduct = async (id: string) => {
    try {
      await productApi.patch(`/products/${id}`, { isApproved: true });
      toast.success('Product approved and is now live');
      fetchPendingProducts();
    } catch (e) {
      toast.error('Failed to approve product');
    }
  };

  const declineProduct = async (id: string) => {
    if (!confirm('Are you sure you want to decline and delete this product?')) return;
    try {
      await productApi.delete(`/products/${id}`);
      toast.success('Product declined and removed');
      fetchPendingProducts();
    } catch (e) {
      toast.error('Failed to decline product');
    }
  };

  const declineSeller = async (id: string) => {
    if (!confirm('Are you sure you want to decline this application? This will permanently reject the request.')) return;
    try {
      await sellerApi.post(`/sellers/${id}/decline`);
      toast.success('Application declined');
      fetchSellers();
    } catch (e) {
      toast.error('Failed to decline application');
    }
  };

  const resolveDispute = async (id: string, amount: number) => {
    if (amount > 10000) {
      return toast.error('Disputes over 10,000 RWF require manual resolution via external portal.');
    }
    try {
      await orderApi.post(`/orders/${id}/dispute/resolve`, { resolution: 'REFUND' });
      toast.success('Dispute resolved. Instant refund issued.');
      fetchDisputes();
    } catch (e) {
      toast.error('Failed to resolve dispute');
    }
  };

  const [editingMarket, setEditingMarket] = useState<any>(null);

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newMarket,
        slug: newMarket.name.toLowerCase().replace(/ /g, '-'),
        location: {
          type: 'Point',
          coordinates: [newMarket.lng, newMarket.lat],
          address: newMarket.address || `${newMarket.name}, Rwanda`
        },
        operatingHours: {
          open: '07:00',
          close: '19:00',
          daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        }
      };
      await marketApi.post('/markets', payload);
      toast.success('Market created successfully');
      setIsAddingMarket(false);
      fetchMarkets();
      setNewMarket({
        name: '',
        code: '',
        type: 'public',
        description: '',
        imageUrl: '',
        lat: -1.9441,
        lng: 30.0619,
        address: ''
      });
    } catch (e) {
      toast.error('Failed to create market');
    }
  };

  const handleUpdateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMarket) return;
    try {
      const payload = {
        ...editingMarket,
        location: {
          ...editingMarket.location,
          coordinates: [editingMarket.lng || editingMarket.location?.coordinates?.[0], editingMarket.lat || editingMarket.location?.coordinates?.[1]]
        }
      };
      await marketApi.put(`/markets/${editingMarket._id}`, payload);
      toast.success('Market updated successfully');
      setEditingMarket(null);
      fetchMarkets();
    } catch (e) {
      toast.error('Failed to update market');
    }
  };

  const handleSyncImagery = async () => {
    try {
      await marketApi.post('/markets/sync-imagery');
      toast.success('Market imagery synchronized');
      fetchMarkets();
    } catch (e) {
      toast.error('Sync failed');
    }
  };

  return (
    <Layout>
      {selectedReceipt && (
        <ReceiptView order={selectedReceipt} role="admin" onClose={() => setSelectedReceipt(null)} />
      )}

      <div className="flex flex-col md:flex-row min-h-screen bg-[#F8F6F1]">
        {/* Verification Document Modal */}
        {selectedSeller && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121212]/80 backdrop-blur-sm p-4 animate-reveal">
             <div className="bg-white w-full max-w-4xl border border-[#E5E1D8] shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-[#E5E1D8] flex justify-between items-center bg-[#F8F6F1]">
                   <h2 className="text-xl font-serif italic text-[#121212]">Verification Documents: {selectedSeller.shopDetails?.name || selectedSeller.stallName || selectedSeller.plateNumber}</h2>
                   <button onClick={() => setSelectedSeller(null)} className="text-2xl text-[#121212] hover:text-[#F59E0B]">&times;</button>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[70vh]">
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">{selectedSeller.plateNumber ? 'Driving License' : 'Business Permit'}</p>
                      <div className="border border-[#E5E1D8] bg-[#F8F6F1] p-2">
                        <img src={selectedSeller.licenseUrl || selectedSeller.businessPermitUrl || 'https://placehold.co/400x300/F8F6F1/121212/png?text=No+Document'} className="w-full object-cover" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">National ID</p>
                      <div className="border border-[#E5E1D8] bg-[#F8F6F1] p-2">
                        <img src={selectedSeller.idCardUrl || 'https://placehold.co/400x300/F8F6F1/121212/png?text=No+ID'} className="w-full object-cover" />
                      </div>
                   </div>
                   <div className="md:col-span-2 space-y-2">
                      <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">{selectedSeller.plateNumber ? 'Vehicle Photo' : 'Stall / Shop Photo'}</p>
                      <div className="border border-[#E5E1D8] bg-[#F8F6F1] p-2">
                        <img src={selectedSeller.vehiclePhotoUrl || selectedSeller.stallPhotoUrl || 'https://placehold.co/800x400/F8F6F1/121212/png?text=No+Photo'} className="w-full h-64 object-cover" />
                      </div>
                   </div>
                </div>
                <div className="p-6 border-t border-[#E5E1D8] flex justify-end gap-4 bg-[#F8F6F1]">
                   <button onClick={() => setSelectedSeller(null)} className="px-6 py-3 border border-[#121212] text-[#121212] text-[10px] font-black uppercase tracking-widest hover:bg-[#121212] hover:text-white transition-all">Cancel</button>
                   <button onClick={() => {
                      if (selectedSeller.plateNumber) {
                        approveRider(selectedSeller._id);
                      } else {
                        approveSeller(selectedSeller._id);
                      }
                      setSelectedSeller(null);
                   }} className="px-6 py-3 bg-[#121212] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#F59E0B] transition-all">Approve Application</button>
                </div>
             </div>
          </div>
        )}

        {/* ── Sidebar ── */}
        <aside className="w-full md:w-64 bg-[#121212] p-8 hidden md:block">
          <div className="mb-12">
            <h2 className="text-[12px] font-black text-white uppercase tracking-[0.4em] flex items-center gap-3">
              <span className="w-2 h-2 bg-[#F59E0B] rounded-full" />
              Admin Portal
            </h2>
          </div>
          <nav className="space-y-2">
            {[
              { id: 'analytics', label: 'Platform Analytics' },
              { id: 'accounting', label: 'Accounting' },
              { id: 'live-map', label: 'Live Operations' },
              { id: 'sellers', label: 'Seller Approvals' },
              { id: 'markets', label: 'Markets Directory' },
              { id: 'products', label: 'Product Approvals' },
              { id: 'riders', label: 'Rider Approvals' },
              { id: 'disputes', label: 'Disputes & Refunds' },
              { id: 'fraud', label: 'Fraud Alerts' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-l-4 ${activeTab === tab.id ? 'bg-white/10 text-white border-[#F59E0B]' : 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 p-6 md:p-12">
          <div className="border-b border-[#E5E1D8] pb-6 mb-10 flex justify-between items-end">
            <h1 className="text-4xl font-serif italic text-[#121212] capitalize tracking-tighter">
               {activeTab.replace('-', ' ')}
            </h1>
          </div>

          {activeTab === 'live-map' && (
            <div className="space-y-6 animate-reveal h-[calc(100vh-200px)]">
               <div className="h-full border border-[#E5E1D8] bg-white flex flex-col shadow-sm relative overflow-hidden group">
                  <div className="p-6 border-b border-[#E5E1D8] bg-[#F8F6F1] flex justify-between items-center z-10">
                     <div>
                        <h3 className="text-xl font-serif italic text-[#121212] flex items-center gap-3">
                           <div className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                           </div>
                           Live Map
                        </h3>
                        <p className="text-[10px] font-medium text-[#6B665E] uppercase tracking-widest mt-1">Real-time rider locations across Rwanda</p>
                     </div>
                  </div>
                  <div className="flex-grow relative z-0">
                     <RiderMap marketId="all-admin" />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-10 animate-reveal">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Monthly GMV</p>
                  <p className="text-3xl font-serif italic text-[#121212]">{analytics?.monthlyGMV?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm border-l-4 border-l-[#F59E0B]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Platform Revenue</p>
                  <p className="text-3xl font-serif italic text-[#121212]">{analytics?.monthlyCommission?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Active Sellers</p>
                  <p className="text-3xl font-serif italic text-[#121212]">{analytics?.activeSellers || 0}</p>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Active Riders</p>
                  <p className="text-3xl font-serif italic text-[#121212]">{analytics?.activeRiders || 0}</p>
                </div>
              </div>

              {/* Growth Charts */}
              <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                 <AnalyticsCharts orders={allOrders} data={dashboardAnalytics} type="admin" />
              </div>
            </div>
          )}

          {activeTab === 'accounting' && (
            <div className="space-y-8 animate-reveal">
              {/* Date Range Filter */}
              <div className="flex flex-wrap gap-3">
                {(['today', 'week', 'month', 'all'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${
                      dateRange === range ? 'bg-[#121212] text-white border-[#121212]' : 'bg-white text-[#121212] border-[#E5E1D8] hover:border-[#121212]'
                    }`}
                  >
                    {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>

              {/* Revenue Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#121212] text-white p-8 shadow-lg">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Total GMV</p>
                  <p className="text-3xl font-serif italic">{totalGMV.toLocaleString()}</p>
                  <p className="text-[9px] text-white/40 mt-2 uppercase tracking-widest">{filteredOrders.length} orders</p>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Platform Revenue</p>
                  <p className="text-3xl font-serif italic text-[#F59E0B]">{platformRevenue.toLocaleString()}</p>
                  <p className="text-[9px] text-[#6B665E] mt-2 uppercase tracking-widest opacity-60">Comm: {totalCommission.toLocaleString()} | Gate: {totalGateway.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Seller Payouts</p>
                  <p className="text-3xl font-serif italic text-green-600">{totalSellerPayout.toLocaleString()}</p>
                  <p className="text-[9px] text-[#6B665E] mt-2 uppercase tracking-widest opacity-60">{(totalGMV > 0 ? (totalSellerPayout / totalGMV * 100) : 0).toFixed(1)}% of GMV</p>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-2">Rider Payouts</p>
                  <p className="text-3xl font-serif italic text-[#121212]">{totalRiderPayout.toLocaleString()}</p>
                  <p className="text-[9px] text-[#6B665E] mt-2 uppercase tracking-widest opacity-60">{deliveredOrders.length} delivered</p>
                </div>
              </div>

              {/* Settlement Summary */}
              <div className="bg-white border border-[#E5E1D8] shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#E5E1D8] bg-[#F8F6F1] flex justify-between items-center">
                  <h2 className="text-lg font-serif italic text-[#121212]">Settlement Report</h2>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#6B665E]">{filteredOrders.length} records</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                      <tr>
                        <th className="p-4">Order #</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Buyer</th>
                        <th className="p-4">Seller</th>
                        <th className="p-4 text-right">GMV</th>
                        <th className="p-4 text-right">Commission</th>
                        <th className="p-4 text-right">Seller Payout</th>
                        <th className="p-4 text-right">Rider Payout</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8] text-sm bg-[#F8F6F1]/30">
                      {filteredOrders.length === 0 ? (
                        <tr><td colSpan={10} className="p-12 text-center text-[#6B665E] italic">No transactions in this period.</td></tr>
                      ) : (
                        paginatedOrders.map((order: any) => (
                          <tr key={order._id} className="hover:bg-white transition-colors">
                            <td className="p-4 font-mono text-[10px] font-bold">#{order._id.substring(0, 6).toUpperCase()}</td>
                            <td className="p-4 text-[11px] text-[#6B665E]">{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td className="p-4 text-xs font-medium">{order.buyer?.fullName || 'N/A'}</td>
                            <td className="p-4 text-xs font-medium">{order.seller?.fullName || 'N/A'}</td>
                            <td className="p-4 text-right text-xs font-bold">{(order.financials?.totalAmount || 0).toLocaleString()}</td>
                            <td className="p-4 text-right text-xs font-bold text-[#F59E0B]">{(order.financials?.platformCommission || 0).toLocaleString()}</td>
                            <td className="p-4 text-right text-xs font-bold text-green-700">+{(order.financials?.sellerPayout || 0).toLocaleString()}</td>
                            <td className="p-4 text-right text-xs font-bold text-[#121212]">+{(order.financials?.riderPayout || 0).toLocaleString()}</td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 border text-[8px] font-black uppercase tracking-widest ${
                                order.status === 'delivered' || order.status === 'resolved'
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : order.status === 'cancelled'
                                    ? 'bg-red-50 border-red-200 text-red-700'
                                    : 'bg-white border-[#E5E1D8] text-[#6B665E]'
                              }`}>
                                {order.status === 'delivered' ? 'SETTLED' :
                                 order.status === 'resolved' ? 'RESOLVED' :
                                 order.status === 'cancelled' ? 'CANCELLED' :
                                 order.status === 'disputed' ? 'DISPUTED' : 'PENDING'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button onClick={() => openReceipt(order)} className="text-[10px] border border-[#E5E1D8] px-3 py-1 hover:border-[#121212]">View</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                   <div className="p-4 border-t border-[#E5E1D8] flex justify-between items-center bg-white">
                      <button 
                         disabled={page === 1} 
                         onClick={() => setPage(p => p - 1)}
                         className="px-4 py-2 border border-[#E5E1D8] text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                      >Prev</button>
                      <span className="text-[10px] font-bold text-[#6B665E]">Page {page} of {totalPages}</span>
                      <button 
                         disabled={page === totalPages} 
                         onClick={() => setPage(p => p + 1)}
                         className="px-4 py-2 border border-[#E5E1D8] text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                      >Next</button>
                   </div>
                )}
              </div>

              {/* Platform P&L Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border-2 border-[#121212] p-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#121212] mb-4 border-b border-[#E5E1D8] pb-2">Platform Revenue</p>
                  <p className="text-3xl font-serif italic text-[#121212]">{platformRevenue.toLocaleString()}</p>
                  <div className="text-[10px] font-bold text-[#6B665E] mt-4 space-y-1">
                    <p>Commission: +{totalCommission.toLocaleString()}</p>
                    <p>Gateway: +{totalGateway.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-white border border-[#E5E1D8] p-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B665E] mb-4 border-b border-[#E5E1D8] pb-2">Total Payouts</p>
                  <p className="text-3xl font-serif italic text-[#6B665E]">{(totalSellerPayout + totalRiderPayout).toLocaleString()}</p>
                  <div className="text-[10px] font-bold text-[#6B665E] mt-4 space-y-1">
                    <p>Sellers: {totalSellerPayout.toLocaleString()}</p>
                    <p>Riders: {totalRiderPayout.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-[#121212] text-white border-2 border-[#121212] p-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-4 border-b border-white/20 pb-2">Net Position</p>
                  <p className="text-3xl font-serif italic text-[#F59E0B]">{(platformRevenue - (totalSellerPayout + totalRiderPayout)).toLocaleString()}</p>
                  <div className="text-[10px] font-bold text-white/40 mt-4 space-y-1">
                    <p>Revenue: {platformRevenue.toLocaleString()}</p>
                    <p>Payouts: {(totalSellerPayout + totalRiderPayout).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sellers' && (
            <div className="bg-white border border-[#E5E1D8] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8F6F1] text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                  <tr>
                    <th className="p-6">Seller Details</th>
                    <th className="p-6">Category</th>
                    <th className="p-6">Applied On</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D8]">
                  {!pendingSellers || pendingSellers.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-[#6B665E] italic">No pending seller applications.</td></tr>
                  ) : (
                    pendingSellers.map((s: any) => (
                      <tr key={s._id} className="hover:bg-[#F8F6F1]/50 transition-colors">
                        <td className="p-6">
                          <p className="font-serif italic text-lg text-[#121212]">{s.shopDetails?.name || s.stallName || s.marketId}</p>
                          <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest mt-1">{s.sellerName || 'Pending'}</p>
                        </td>
                        <td className="p-6 text-xs font-medium text-[#121212]">{s.marketId && s.marketId.length > 5 ? 'Market Vendor' : 'Independent'}</td>
                        <td className="p-6 text-xs text-[#6B665E]">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td className="p-6 text-right flex justify-end gap-3">
                          <button className="px-4 py-2 border border-[#E5E1D8] text-[9px] font-black uppercase tracking-widest text-[#121212] hover:border-[#121212]" onClick={() => setSelectedSeller(s)}>View Docs</button>
                          <button className="px-4 py-2 border border-red-200 bg-red-50 text-[9px] font-black uppercase tracking-widest text-red-600 hover:border-red-500" onClick={() => declineSeller(s._id)}>Decline</button>
                          <button className="px-4 py-2 bg-[#121212] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#F59E0B]" onClick={() => approveSeller(s._id)}>Approve</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'riders' && (
            <div className="bg-white border border-[#E5E1D8] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8F6F1] text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                  <tr>
                    <th className="p-6">Rider ID</th>
                    <th className="p-6">Plate Number</th>
                    <th className="p-6">Applied On</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D8]">
                  {!pendingRiders || pendingRiders.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-[#6B665E] italic">No pending rider applications.</td></tr>
                  ) : (
                    pendingRiders.map((r: any) => (
                      <tr key={r._id} className="hover:bg-[#F8F6F1]/50 transition-colors">
                        <td className="p-6">
                          <p className="font-mono text-sm font-bold text-[#121212]">{r.userId.substring(0,8)}</p>
                        </td>
                        <td className="p-6 font-mono text-sm font-medium">{r.plateNumber}</td>
                        <td className="p-6 text-xs text-[#6B665E]">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="p-6 text-right flex justify-end gap-3">
                          <button className="px-4 py-2 border border-[#E5E1D8] text-[9px] font-black uppercase tracking-widest text-[#121212] hover:border-[#121212]" onClick={() => setSelectedSeller(r)}>View Docs</button>
                          <button className="px-4 py-2 bg-[#121212] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#F59E0B]" onClick={() => approveRider(r._id)}>Approve</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-white border border-[#E5E1D8] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8F6F1] text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                  <tr>
                    <th className="p-6">Product Item</th>
                    <th className="p-6">Price & Stock</th>
                    <th className="p-6">Date</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D8]">
                  {!pendingProducts || pendingProducts.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-[#6B665E] italic">No pending product approvals.</td></tr>
                  ) : (
                    pendingProducts.map((p: any) => (
                      <tr key={p._id} className="hover:bg-[#F8F6F1]/50 transition-colors">
                        <td className="p-6 flex items-center gap-4">
                          <div className="w-16 h-16 border border-[#E5E1D8] bg-[#F8F6F1] overflow-hidden p-1">
                            {p.images?.[0] && <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="font-serif italic text-lg text-[#121212]">{p.name}</p>
                            <p className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest mt-1">Cat: {p.category}</p>
                          </div>
                        </td>
                        <td className="p-6">
                          <p className="text-lg font-serif italic text-[#A34D15]">{p.price.toLocaleString()} RWF</p>
                          <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest mt-1">{p.stockType === 'finite' ? `${p.stockQuantity} ${p.unit}` : p.stockType === 'infinite' ? 'Unlimited' : 'Made to Order'}</p>
                        </td>
                        <td className="p-6 text-xs text-[#6B665E]">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="p-6 text-right flex justify-end gap-3">
                          <button className="px-4 py-2 border border-red-200 bg-red-50 text-[9px] font-black uppercase tracking-widest text-red-600 hover:border-red-500" onClick={() => declineProduct(p._id)}>Reject</button>
                          <button className="px-4 py-2 bg-[#121212] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#F59E0B]" onClick={() => approveProduct(p._id)}>Approve</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="space-y-6 animate-reveal">
              <div className="bg-[#121212] text-white p-8 flex justify-between items-center border-l-4 border-l-[#F59E0B]">
                <div>
                  <h3 className="text-xl font-serif italic text-white mb-2">Buyer Protection Reserve</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Funds for instant dispute resolutions</p>
                </div>
                <p className="text-4xl font-serif italic text-[#F59E0B]">1,250,000 RWF</p>
              </div>

              <div className="bg-white border border-[#E5E1D8] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#F8F6F1] text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                    <tr>
                      <th className="p-6">Order ID</th>
                      <th className="p-6">Amount</th>
                      <th className="p-6">Reason</th>
                      <th className="p-6 text-right">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D8]">
                    {!disputes || disputes.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-[#6B665E] italic">No open disputes.</td></tr>
                    ) : (
                      disputes.map((d: any) => (
                        <tr key={d._id} className="hover:bg-[#F8F6F1]/50">
                          <td className="p-6 font-mono text-[10px] font-bold text-[#121212]">#{d._id.substring(0,8).toUpperCase()}</td>
                          <td className="p-6 text-lg font-serif italic text-[#A34D15]">{d.financials?.totalAmount || d.total} RWF</td>
                          <td className="p-6 text-xs text-[#6B665E]">{d.dispute?.reason || 'Undelivered'}</td>
                          <td className="p-6 text-right">
                            <button className="px-4 py-2 bg-[#121212] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#F59E0B]" onClick={() => resolveDispute(d._id, d.financials?.totalAmount || d.total)}>
                              {(d.financials?.totalAmount || d.total) <= 10000 ? 'Instant Refund' : 'Manual Review'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'markets' && (
            <div className="space-y-8 animate-reveal">
              <div className="flex justify-between items-center border-b border-[#E5E1D8] pb-6">
                 <div>
                   <h2 className="text-3xl font-serif italic text-[#121212]">Markets Directory</h2>
                   <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.2em] mt-2">Manage physical market locations</p>
                 </div>
                 <div className="flex gap-4">
                   <button className="px-6 py-3 border border-[#121212] text-[#121212] text-[10px] font-black uppercase tracking-widest hover:bg-[#121212] hover:text-white transition-all" onClick={handleSyncImagery}>Sync Images</button>
                   <button className="px-6 py-3 bg-[#121212] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#F59E0B] transition-all" onClick={() => setIsAddingMarket(true)}>Create Market</button>
                 </div>
              </div>

              {isAddingMarket && (
                <div className="bg-white border-2 border-[#121212] p-8 shadow-xl">
                  <form onSubmit={handleCreateMarket} className="space-y-6">
                    <h3 className="text-xl font-serif italic border-b border-[#E5E1D8] pb-4 mb-6">New Market Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Market Name</label>
                        <input required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={newMarket.name} onChange={e => setNewMarket(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Kimironko Market" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Market Code</label>
                        <input required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={newMarket.code} onChange={e => setNewMarket(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="e.g. KIM" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Market Cover Photo</label>
                      <ImageUpload service="market" endpoint="/markets/upload-image" value={newMarket.imageUrl} onChange={(url) => setNewMarket(prev => ({ ...prev, imageUrl: url }))} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Description</label>
                      <textarea className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212] h-24" value={newMarket.description} onChange={e => setNewMarket(prev => ({ ...prev, description: e.target.value }))} placeholder="Market overview..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Latitude</label>
                          <input type="number" step="any" className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={newMarket.lat} onChange={e => setNewMarket(prev => ({ ...prev, lat: parseFloat(e.target.value) }))} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Longitude</label>
                          <input type="number" step="any" className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={newMarket.lng} onChange={e => setNewMarket(prev => ({ ...prev, lng: parseFloat(e.target.value) }))} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Type</label>
                          <select className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={newMarket.type} onChange={e => setNewMarket(prev => ({ ...prev, type: e.target.value }))}>
                             <option value="public">Public Market</option>
                             <option value="individual">Independent Area</option>
                          </select>
                       </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-6 border-t border-[#E5E1D8]">
                       <button type="button" className="px-6 py-3 border border-[#E5E1D8] text-[#121212] text-[10px] font-black uppercase tracking-widest hover:border-[#121212]" onClick={() => setIsAddingMarket(false)}>Cancel</button>
                       <button type="submit" className="px-6 py-3 bg-[#121212] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#F59E0B]">Create Market</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white border border-[#E5E1D8] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#F8F6F1] text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                    <tr>
                      <th className="p-6">Market Info</th>
                      <th className="p-6">Code</th>
                      <th className="p-6">Status</th>
                      <th className="p-6 text-right">Metrics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D8]">
                    {!markets || markets.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-[#6B665E] italic">No markets created yet.</td></tr>
                    ) : (
                      markets.map((m: any) => (
                        <tr key={m._id} className="hover:bg-[#F8F6F1]/50">
                          <td className="p-6">
                            <div className="flex items-center gap-6">
                               <div className="w-16 h-16 border border-[#E5E1D8] bg-[#F8F6F1] p-1 overflow-hidden">
                                  {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />}
                               </div>
                               <div>
                                  <p className="font-serif italic text-lg text-[#121212]">{m.name}</p>
                                  <p className="text-[10px] text-[#6B665E] truncate max-w-xs mt-1">{m.description || 'No description available'}</p>
                               </div>
                            </div>
                          </td>
                          <td className="p-6 font-mono font-bold text-[#121212] text-sm">{m.code}</td>
                          <td className="p-6">
                            <span className="px-3 py-1 border border-green-200 bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest">Active</span>
                          </td>
                          <td className="p-6 text-right">
                             <div className="flex items-center justify-end gap-6">
                               <div className="text-right">
                                 <p className="text-xl font-serif italic text-[#A34D15]">{m.totalSellers || 0}</p>
                                 <p className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest mt-1">Sellers</p>
                               </div>
                               <button className="px-4 py-2 border border-[#E5E1D8] text-[9px] font-black uppercase tracking-widest text-[#121212] hover:border-[#121212]" onClick={() => setEditingMarket({
                                 ...m,
                                 lat: m.location?.coordinates?.[1],
                                 lng: m.location?.coordinates?.[0]
                               })}>Edit</button>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {editingMarket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121212]/80 backdrop-blur-sm p-4 animate-reveal">
                  <div className="bg-white w-full max-w-2xl border border-[#E5E1D8] shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-[#E5E1D8] flex justify-between items-center bg-[#F8F6F1]">
                      <h2 className="text-xl font-serif italic text-[#121212]">Edit Market: {editingMarket.name}</h2>
                      <button onClick={() => setEditingMarket(null)} className="text-2xl text-[#121212] hover:text-[#F59E0B]">&times;</button>
                    </div>
                    <form onSubmit={handleUpdateMarket} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Market Name</label>
                          <input required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={editingMarket.name} onChange={e => setEditingMarket((prev: any) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Market Code</label>
                          <input required className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212]" value={editingMarket.code} onChange={e => setEditingMarket((prev: any) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Market Photo</label>
                        <ImageUpload service="market" endpoint="/markets/upload-image" value={editingMarket.imageUrl} onChange={(url) => setEditingMarket((prev: any) => ({ ...prev, imageUrl: url }))} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]">Description</label>
                        <textarea className="w-full bg-[#F8F6F1] border border-[#E5E1D8] p-4 text-sm outline-none focus:border-[#121212] h-24" value={editingMarket.description} onChange={e => setEditingMarket((prev: any) => ({ ...prev, description: e.target.value }))} />
                      </div>

                      <div className="flex justify-end gap-4 pt-6 border-t border-[#E5E1D8]">
                        <button type="button" className="px-6 py-3 border border-[#E5E1D8] text-[#121212] text-[10px] font-black uppercase tracking-widest hover:border-[#121212]" onClick={() => setEditingMarket(null)}>Cancel</button>
                        <button type="submit" className="px-6 py-3 bg-[#121212] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#F59E0B]">Save Changes</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fraud' && (
            <div className="bg-white border border-[#E5E1D8] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8F6F1] text-[#6B665E] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#E5E1D8]">
                  <tr>
                    <th className="p-6">Severity</th>
                    <th className="p-6">Transaction ID</th>
                    <th className="p-6">Flag Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D8]">
                  {!fraudAlerts || fraudAlerts.length === 0 ? (
                    <tr><td colSpan={3} className="p-12 text-center text-[#6B665E] italic">No active fraud alerts. System secure.</td></tr>
                  ) : (
                    fraudAlerts.map((f: any) => (
                      <tr key={f._id} className="hover:bg-[#F8F6F1]/50">
                        <td className="p-6">
                           <span className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 text-[9px] font-black uppercase tracking-widest">{f.security?.flagReason?.split(':')[0] || 'FLAG'}</span>
                        </td>
                        <td className="p-6 text-sm font-mono font-bold text-[#121212]">{f._id}</td>
                        <td className="p-6 text-sm text-[#6B665E]">{f.security?.flagReason || f.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </main>
      </div>
    </Layout>
  );
}
