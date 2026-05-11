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
  { ssr: false, loading: () => <div className="w-full h-full bg-background-surface animate-pulse flex items-center justify-center text-text-secondary">Initializing Satellite View...</div> }
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

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (ordersData && Array.isArray(ordersData)) {
      setAllOrders(ordersData);
      // Fetch delivery data for orders with deliveryId
      ordersData.forEach((order: any) => {
        if (order.deliveryId && !deliveryCache[order.deliveryId]) {
          deliveryApi.get(`/deliveries/${order.deliveryId}`)
            .then(res => setDeliveryCache(prev => ({ ...prev, [order.deliveryId]: res.data?.data })))
            .catch(() => {});
        }
      });
    }
  }, [ordersData, deliveryCache]);

  // Filter orders by date range
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

  // Accounting calculations
  const totalGMV = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.totalAmount || 0), 0);
  const totalCommission = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.platformCommission || 0), 0);
  const totalGateway = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.gatewayFee || 0), 0);
  const totalSellerPayout = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.sellerPayout || 0), 0);
  const totalRiderPayout = filteredOrders.reduce((s: number, o: any) => s + (o.financials?.riderPayout || 0), 0);
  const platformRevenue = totalCommission + totalGateway;
  const deliveredOrders = filteredOrders.filter((o: any) => o.status === 'delivered' || o.status === 'resolved');

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  // CSV Export
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

  // Per-seller breakdown (client-side grouping)
  const sellerBreakdown = Object.entries(
    filteredOrders.reduce((acc: Record<string, any>, o: any) => {
      const name = o.seller?.fullName || 'Unknown';
      if (!acc[name]) acc[name] = { sellerName: name, orderCount: 0, totalGMV: 0, totalCommission: 0, totalSellerPayout: 0 };
      acc[name].orderCount++;
      acc[name].totalGMV += o.financials?.totalAmount || 0;
      acc[name].totalCommission += o.financials?.platformCommission || 0;
      acc[name].totalSellerPayout += o.financials?.sellerPayout || 0;
      return acc;
    }, {})
  ).map(([_, v]) => v as any).sort((a, b) => b.totalGMV - a.totalGMV);

  const approveSeller = async (id: string) => {
    try {
      await sellerApi.post(`/sellers/${id}/approve`);
      toast.success('Seller approved');
      fetchSellers();
    } catch (e) {
      toast.error('Failed to approve seller');
    }
  };

  const approveRider = async (id: string) => {
    try {
      await riderApi.post(`/riders/${id}/approve`);
      toast.success('Rider approved');
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
      toast.success('Market Hub Deployed Successfully');
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
      toast.error('Failed to deploy market hub');
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
      toast.success('Market Hub Updated');
      setEditingMarket(null);
      fetchMarkets();
    } catch (e) {
      toast.error('Failed to update hub');
    }
  };

  const handleSyncImagery = async () => {
    try {
      await marketApi.post('/markets/sync-imagery');
      toast.success('Institutional Imagery Synchronized');
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

      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        {/* Modal for View Docs */}
        {selectedSeller && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-background-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="p-6 border-b border-border flex justify-between items-center bg-background-surface">
                   <h2 className="text-xl font-bold">Verification Documents: {selectedSeller.shopDetails?.name || selectedSeller.stallName || selectedSeller.plateNumber}</h2>
                   <button onClick={() => setSelectedSeller(null)} className="text-2xl hover:text-primary">&times;</button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]">
                   <div>
                      <p className="text-sm font-bold mb-2">{selectedSeller.plateNumber ? 'Driving License' : 'RDB / Business Permit'}</p>
                      <img src={selectedSeller.licenseUrl || selectedSeller.businessPermitUrl || 'https://placehold.co/400x300/000000/FFFFFF/png?text=No+Document'} className="w-full rounded-lg border border-border" />
                   </div>
                   <div>
                      <p className="text-sm font-bold mb-2">National ID</p>
                      <img src={selectedSeller.idCardUrl || 'https://placehold.co/400x300/000000/FFFFFF/png?text=No+ID'} className="w-full rounded-lg border border-border" />
                   </div>
                   <div className="md:col-span-2">
                      <p className="text-sm font-bold mb-2">{selectedSeller.plateNumber ? 'Vehicle Photo' : 'Stall / Shop Photo'}</p>
                      <img src={selectedSeller.vehiclePhotoUrl || selectedSeller.stallPhotoUrl || 'https://placehold.co/800x400/000000/FFFFFF/png?text=No+Photo'} className="w-full rounded-lg border border-border object-cover h-64" />
                   </div>
                </div>
                <div className="p-6 border-t border-border flex justify-end gap-3 bg-background-surface">
                   <Button variant="outline" onClick={() => setSelectedSeller(null)}>Close</Button>
                   <Button onClick={() => {
                      if (selectedSeller.plateNumber) {
                        approveRider(selectedSeller._id);
                      } else {
                        approveSeller(selectedSeller._id);
                      }
                      setSelectedSeller(null);
                   }}>Approve Now</Button>
                </div>
             </div>
          </div>
        )}

        <aside className="w-full md:w-64 bg-[#0a0a0a] border-r border-white/5 p-6 hidden md:block">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-xl text-white tracking-wider uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Coordination
            </h2>
          </div>
          <nav className="space-y-1">
            {[
              { id: 'analytics', label: 'Analytics & Revenue📊' },
              { id: 'accounting', label: 'Accounting🛰️' },
              { id: 'live-map', label: 'Live Operations' },
              { id: 'sellers', label: 'Seller Approvals🏛️' },
              { id: 'markets', label: 'Manage Markets' },
              { id: 'products', label: '📦 Product Approvals' },
              { id: 'riders', label: 'Rider Approvals' },
              { id: 'disputes', label: 'Disputes & Refunds' },
              { id: 'fraud', label: 'Fraud Alerts' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab.id ? 'bg-white/10 text-white font-bold border-l-2 border-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-8 capitalize">{activeTab.replace('-', ' ')}</h1>

          {activeTab === 'live-map' && (
            <div className="space-y-6 animate-fade-in h-[calc(100vh-180px)]">
               <Card noPadding className="h-full overflow-hidden border-2 border-primary/20">
                  <div className="p-4 border-b border-border bg-background-surface flex justify-between items-center">
                     <div>
                        <h3 className="font-bold text-primary flex items-center gap-2">
                           <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                           </span>
                           Real-Time Logistics Monitor
                        </h3>
                        <p className="text-xs text-text-secondary">Tracking all active riders and marketplace density across Rwanda.</p>
                     </div>
                     <div className="flex gap-4 text-xs font-bold">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded-full"></span> Active Riders</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded-full"></span> Market Hubs</span>
                     </div>
                  </div>
                  <div className="flex-grow h-full relative">
                     <RiderMap marketId="all-admin" />
                  </div>
               </Card>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <p className="text-sm text-text-secondary">Monthly GMV</p>
                  <p className="text-2xl font-bold">{analytics?.monthlyGMV?.toLocaleString() || 0} RWF</p>
                </Card>
                <Card>
                  <p className="text-sm text-text-secondary">Company Revenue</p>
                  <p className="text-2xl font-bold text-primary">{analytics?.monthlyCommission?.toLocaleString() || 0} RWF</p>
                </Card>
                <Card>
                  <p className="text-sm text-text-secondary">Active Sellers</p>
                  <p className="text-2xl font-bold">{analytics?.activeSellers || 0}</p>
                </Card>
                <Card>
                  <p className="text-sm text-text-secondary">Active Riders</p>
                  <p className="text-2xl font-bold">{analytics?.activeRiders || 0}</p>
                </Card>
              </div>

              {/* Growth Charts */}
              <AnalyticsCharts orders={allOrders} data={dashboardAnalytics} type="admin" />
            </div>
          )}

          {activeTab === 'accounting' && (
            <div className="space-y-6 animate-fade-in">
              {/* Date Range Filter */}
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      dateRange === range ? 'bg-primary text-white' : 'bg-background-surface text-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>

              {/* Revenue Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
                  <p className="text-white/70 text-sm font-medium">Total GMV</p>
                  <p className="text-3xl font-bold mt-1">{totalGMV.toLocaleString()} RWF</p>
                  <p className="text-white/60 text-xs mt-1">{filteredOrders.length} orders</p>
                </Card>
                <Card>
                  <p className="text-text-secondary text-sm font-medium">Platform Revenue</p>
                  <p className="text-2xl font-bold text-primary mt-1">{platformRevenue.toLocaleString()} RWF</p>
                  <p className="text-xs text-text-secondary mt-1">Commission: {totalCommission.toLocaleString()} + Gateway: {totalGateway.toLocaleString()}</p>
                </Card>
                <Card>
                  <p className="text-text-secondary text-sm font-medium">Seller Payouts</p>
                  <p className="text-2xl font-bold text-status-success mt-1">{totalSellerPayout.toLocaleString()} RWF</p>
                  <p className="text-xs text-text-secondary mt-1">{(totalGMV > 0 ? (totalSellerPayout / totalGMV * 100) : 0).toFixed(1)}% of GMV</p>
                </Card>
                <Card>
                  <p className="text-text-secondary text-sm font-medium">Rider Payouts</p>
                  <p className="text-2xl font-bold text-status-info mt-1">{totalRiderPayout.toLocaleString()} RWF</p>
                  <p className="text-xs text-text-secondary mt-1">{deliveredOrders.length} deliveries completed</p>
                </Card>
              </div>

              {/* Settlement Summary */}
              <Card noPadding>
                <div className="p-6 border-b border-border flex justify-between items-center">
                  <h2 className="text-lg font-bold">Settlement Report</h2>
                  <span className="text-xs text-text-secondary">{filteredOrders.length} orders in period</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-surface text-text-secondary text-xs uppercase">
                      <tr>
                        <th className="p-3 font-medium">Order #</th>
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">Buyer</th>
                        <th className="p-3 font-medium">Seller</th>
                        <th className="p-3 font-medium text-right">GMV</th>
                        <th className="p-3 font-medium text-right">Commission</th>
                        <th className="p-3 font-medium text-right">Seller Payout</th>
                        <th className="p-3 font-medium text-right">Rider Payout</th>
                        <th className="p-3 font-medium text-center">Status</th>
                        <th className="p-3 font-medium text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {filteredOrders.length === 0 ? (
                        <tr><td colSpan={10} className="p-8 text-center text-text-secondary">No orders in this period.</td></tr>
                      ) : (
                        filteredOrders.map((order: any) => (
                          <tr key={order._id} className="hover:bg-background-surface/50">
                            <td className="p-3 font-mono font-medium">#{order._id.substring(0, 6).toUpperCase()}</td>
                            <td className="p-3 text-text-secondary">{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td className="p-3">{order.buyer?.fullName || 'N/A'}</td>
                            <td className="p-3">{order.seller?.fullName || 'N/A'}</td>
                            <td className="p-3 text-right font-medium">{(order.financials?.totalAmount || 0).toLocaleString()}</td>
                            <td className="p-3 text-right text-primary font-medium">{(order.financials?.platformCommission || 0).toLocaleString()}</td>
                            <td className="p-3 text-right text-status-success">+{(order.financials?.sellerPayout || 0).toLocaleString()}</td>
                            <td className="p-3 text-right text-status-info">+{(order.financials?.riderPayout || 0).toLocaleString()}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                order.status === 'delivered' || order.status === 'resolved'
                                  ? 'bg-status-success/10 text-status-success'
                                  : order.status === 'cancelled'
                                    ? 'bg-status-error/10 text-status-error'
                                    : 'bg-status-warning/10 text-status-warning'
                              }`}>
                                {order.status === 'delivered' ? 'SETTLED' :
                                 order.status === 'resolved' ? 'RESOLVED' :
                                 order.status === 'cancelled' ? 'CANCELLED' :
                                 order.status === 'disputed' ? 'DISPUTED' : 'PENDING'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <Button size="sm" variant="outline" onClick={() => openReceipt(order)}>🧾</Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold text-sm">
                      <tr>
                        <td colSpan={4} className="p-3 text-right">Totals ({filteredOrders.length} orders)</td>
                        <td className="p-3 text-right">{totalGMV.toLocaleString()} RWF</td>
                        <td className="p-3 text-right text-primary">{totalCommission.toLocaleString()} RWF</td>
                        <td className="p-3 text-right text-status-success">{totalSellerPayout.toLocaleString()} RWF</td>
                        <td className="p-3 text-right text-status-info">{totalRiderPayout.toLocaleString()} RWF</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {/* Platform P&L Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50 border border-green-200">
                  <p className="text-sm font-bold text-green-700 mb-2">📈 Platform Revenue</p>
                  <p className="text-3xl font-bold text-green-700">{platformRevenue.toLocaleString()} RWF</p>
                  <div className="text-xs text-green-600 mt-2 space-y-1">
                    <p>Commission Income: +{totalCommission.toLocaleString()} RWF</p>
                    <p>Gateway Fees: +{totalGateway.toLocaleString()} RWF</p>
                  </div>
                </Card>
                <Card className="bg-blue-50 border border-blue-200">
                  <p className="text-sm font-bold text-blue-700 mb-2">💸 Total Payouts</p>
                  <p className="text-3xl font-bold text-blue-700">{(totalSellerPayout + totalRiderPayout).toLocaleString()} RWF</p>
                  <div className="text-xs text-blue-600 mt-2 space-y-1">
                    <p>To Sellers: {totalSellerPayout.toLocaleString()} RWF</p>
                    <p>To Riders: {totalRiderPayout.toLocaleString()} RWF</p>
                  </div>
                </Card>
                <Card className="bg-amber-50 border border-amber-200">
                  <p className="text-sm font-bold text-amber-700 mb-2">📊 Net Position</p>
                  <p className="text-3xl font-bold text-amber-700">{(platformRevenue - (totalSellerPayout + totalRiderPayout)).toLocaleString()} RWF</p>
                  <div className="text-xs text-amber-600 mt-2 space-y-1">
                    <p>Revenue: {platformRevenue.toLocaleString()} RWF</p>
                    <p>Payouts: {(totalSellerPayout + totalRiderPayout).toLocaleString()} RWF</p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'sellers' && (
            <Card noPadding className="animate-fade-in">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">Shop Details</th>
                    <th className="p-4 font-medium">Type</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!pendingSellers || pendingSellers.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No pending seller approvals.</td></tr>
                  ) : (
                    pendingSellers.map((s: any) => (
                      <tr key={s._id}>
                        <td className="p-4">
                          <p className="font-bold">{s.shopDetails?.name || s.stallName || s.marketId}</p>
                          <p className="text-sm text-text-secondary">{s.sellerName || 'Pending Verification'}</p>
                        </td>
                        <td className="p-4">{s.marketId && s.marketId.length > 5 ? 'Public Market' : 'Independent'}</td>
                        <td className="p-4 text-sm">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedSeller(s)}>View Docs</Button>
                          <Button size="sm" variant="outline" className="text-status-error border-status-error hover:bg-status-error/10" onClick={() => declineSeller(s._id)}>Decline</Button>
                          <Button size="sm" onClick={() => approveSeller(s._id)}>Approve</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {activeTab === 'riders' && (
            <Card noPadding className="animate-fade-in">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">Rider Details</th>
                    <th className="p-4 font-medium">Plate Number</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!pendingRiders || pendingRiders.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No pending rider approvals.</td></tr>
                  ) : (
                    pendingRiders.map((r: any) => (
                      <tr key={r._id}>
                        <td className="p-4">
                          <p className="font-bold">User: {r.userId.substring(0,8)}</p>
                          <p className="text-sm text-text-secondary">Pending Verification</p>
                        </td>
                        <td className="p-4 font-mono">{r.plateNumber}</td>
                        <td className="p-4 text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedSeller(r)}>View Docs</Button>
                          <Button size="sm" onClick={() => approveRider(r._id)}>Approve</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {activeTab === 'products' && (
            <Card noPadding className="animate-fade-in">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Price & Stock</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!pendingProducts || pendingProducts.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No pending product approvals.</td></tr>
                  ) : (
                    pendingProducts.map((p: any) => (
                      <tr key={p._id}>
                        <td className="p-4 flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-border overflow-hidden">
                            {p.images?.[0] && <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="font-bold">{p.name}</p>
                            <p className="text-xs text-text-secondary">Category: {p.category}</p>
                            {p.isMadeInRwanda && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block">🇷🇼 RW</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-bold">{p.price.toLocaleString()} RWF</p>
                          <p className="text-sm text-text-secondary">{p.stockType === 'finite' ? `${p.stockQuantity} ${p.unit}` : p.stockType === 'infinite' ? '∞ Unlimited' : '🎨 By Command'}</p>
                        </td>
                        <td className="p-4 text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-status-error border-status-error hover:bg-status-error/10" onClick={() => declineProduct(p._id)}>Reject & Delete</Button>
                          <Button size="sm" onClick={() => approveProduct(p._id)}>Approve</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {activeTab === 'disputes' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-status-info/10 border border-status-info/20 rounded p-4 flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-status-info">Buyer Protection Reserve Fund</h3>
                  <p className="text-sm">Available balance for instant refunds</p>
                </div>
                <p className="text-xl font-bold">1,250,000 RWF</p>
              </div>

              <Card noPadding>
                <table className="w-full text-left">
                  <thead className="bg-background-surface text-text-secondary text-sm">
                    <tr>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Reason</th>
                      <th className="p-4 text-right">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!disputes || disputes.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No open disputes.</td></tr>
                    ) : (
                      disputes.map((d: any) => (
                        <tr key={d._id}>
                          <td className="p-4 font-medium">#{d._id.substring(0,8).toUpperCase()}</td>
                          <td className="p-4 font-bold">{d.financials?.totalAmount || d.total} RWF</td>
                          <td className="p-4 text-sm text-text-secondary">{d.dispute?.reason || 'Undelivered'}</td>
                          <td className="p-4 text-right">
                            <Button size="sm" onClick={() => resolveDispute(d._id, d.financials?.totalAmount || d.total)}>
                              {(d.financials?.totalAmount || d.total) <= 10000 ? 'Instant Refund' : 'Resolve Manually'}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {activeTab === 'markets' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                 <div>
                   <h2 className="text-xl font-bold">Marketplace Hubs</h2>
                   <p className="text-sm text-text-secondary">Managing active regional terminals and facilitator centers.</p>
                 </div>
                 <div className="flex gap-3">
                   <Button variant="outline" onClick={handleSyncImagery}>Sync Institutional Imagery</Button>
                   <Button onClick={() => setIsAddingMarket(true)}>Deploy New Hub</Button>
                 </div>
              </div>

              {isAddingMarket && (
                <Card className="border-2 border-primary/30">
                  <form onSubmit={handleCreateMarket} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Hub Name</label>
                        <input 
                          required
                          className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg"
                          value={newMarket.name}
                          onChange={e => setNewMarket(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Kimironko Elite Hub"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Hub Code</label>
                        <input 
                          required
                          className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg"
                          value={newMarket.code}
                          onChange={e => setNewMarket(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          placeholder="e.g. KIM"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Market Hub Photography</label>
                      <ImageUpload 
                        service="market"
                        endpoint="/markets/upload-image"
                        value={newMarket.imageUrl}
                        onChange={(url) => setNewMarket(prev => ({ ...prev, imageUrl: url }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Description</label>
                      <textarea 
                        className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg h-24"
                        value={newMarket.description}
                        onChange={e => setNewMarket(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Strategic terminal overview..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Latitude</label>
                          <input type="number" step="any" className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg" value={newMarket.lat} onChange={e => setNewMarket(prev => ({ ...prev, lat: parseFloat(e.target.value) }))} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Longitude</label>
                          <input type="number" step="any" className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg" value={newMarket.lng} onChange={e => setNewMarket(prev => ({ ...prev, lng: parseFloat(e.target.value) }))} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Type</label>
                          <select className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg" value={newMarket.type} onChange={e => setNewMarket(prev => ({ ...prev, type: e.target.value }))}>
                             <option value="public">Public (HUB)</option>
                             <option value="individual">Individual</option>
                          </select>
                       </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                       <Button variant="outline" type="button" onClick={() => setIsAddingMarket(false)}>Cancel</Button>
                       <Button type="submit">Deploy Hub</Button>
                    </div>
                  </form>
                </Card>
              )}

              <Card noPadding>
                <table className="w-full text-left">
                  <thead className="bg-background-surface text-text-secondary text-sm">
                    <tr>
                      <th className="p-4 font-medium">Hub Information</th>
                      <th className="p-4 font-medium">Code</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium text-right">Scale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!markets || markets.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No market hubs deployed.</td></tr>
                    ) : (
                      markets.map((m: any) => (
                        <tr key={m._id} className="hover:bg-background-surface/50">
                          <td className="p-4">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-border rounded overflow-hidden">
                                  {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />}
                               </div>
                               <div>
                                  <p className="font-bold">{m.name}</p>
                                  <p className="text-xs text-text-secondary truncate max-w-xs">{m.description || 'No description'}</p>
                               </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-primary">{m.code}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Active Hub</span>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2 items-center">
                             <div className="text-right mr-4">
                               <p className="font-bold">{m.totalSellers || 0}</p>
                               <p className="text-[10px] text-text-secondary uppercase">Vendors</p>
                             </div>
                             <Button size="sm" variant="outline" onClick={() => setEditingMarket({
                               ...m,
                               lat: m.location?.coordinates?.[1],
                               lng: m.location?.coordinates?.[0]
                             })}>Edit</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>

              {editingMarket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-background-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="p-6 border-b border-border flex justify-between items-center bg-background-surface">
                      <h2 className="text-xl font-bold">Modify Hub: {editingMarket.name}</h2>
                      <button onClick={() => setEditingMarket(null)} className="text-2xl hover:text-primary">&times;</button>
                    </div>
                    <form onSubmit={handleUpdateMarket} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Hub Name</label>
                          <input required className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg" value={editingMarket.name} onChange={e => setEditingMarket((prev: any) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Hub Code</label>
                          <input required className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg" value={editingMarket.code} onChange={e => setEditingMarket((prev: any) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Hub Photography</label>
                        <ImageUpload 
                          service="market"
                          endpoint="/markets/upload-image"
                          value={editingMarket.imageUrl}
                          onChange={(url) => setEditingMarket((prev: any) => ({ ...prev, imageUrl: url }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">Description</label>
                        <textarea className="rmf-input w-full p-3 bg-background-surface border border-border rounded-lg h-24" value={editingMarket.description} onChange={e => setEditingMarket((prev: any) => ({ ...prev, description: e.target.value }))} />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setEditingMarket(null)}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fraud' && (
            <Card noPadding className="animate-fade-in">
              <table className="w-full text-left">
                <thead className="bg-background-surface text-text-secondary text-sm">
                  <tr>
                    <th className="p-4 font-medium">Rule</th>
                    <th className="p-4 font-medium">Transaction ID</th>
                    <th className="p-4 font-medium">Flag Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!fraudAlerts || fraudAlerts.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-text-secondary">No active fraud alerts.</td></tr>
                  ) : (
                    fraudAlerts.map((f: any) => (
                      <tr key={f._id}>
                        <td className="p-4"><span className="bg-status-error text-white px-2 py-1 rounded text-xs">{f.security?.flagReason?.split(':')[0] || 'FLAG'}</span></td>
                        <td className="p-4 text-sm font-mono">{f._id}</td>
                        <td className="p-4 text-sm">{f.security?.flagReason || f.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}

        </main>
      </div>
    </Layout>
  );
}
