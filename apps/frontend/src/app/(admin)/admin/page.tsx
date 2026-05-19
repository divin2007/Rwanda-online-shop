'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
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
import { useSearchParams } from 'next/navigation';

const RiderMap = dynamic(
  () => import('@/components/ui/RiderMap').then((mod) => mod.RiderMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#fcf9f8] animate-pulse flex items-center justify-center text-[#414844]">Loading Map...</div> }
);

const isPdfUrl = (url?: string) => Boolean(url && /\.pdf($|\?)/i.test(url));

const VerificationDocumentPanel = ({ title, url }: { title: string; url?: string }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-widest">{title}</p>
    <div className="flex min-h-48 items-center justify-center overflow-hidden border border-[#e0e0e0] bg-[#fcf9f8] p-3">
      {!url ? (
        <div className="text-center">
          <p className="text-sm font-black text-[#1b1c1c]">Not uploaded</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#414844]">Document missing</p>
        </div>
      ) : isPdfUrl(url) ? (
        <a href={url} target="_blank" rel="noreferrer" className="rounded-md border border-[#e0e0e0] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] transition hover:border-[#ff6b00]">
          Open PDF
        </a>
      ) : (
        <img src={url} className="h-full max-h-72 w-full object-contain" alt={title} />
      )}
    </div>
  </div>
);

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'analytics');
  
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

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
  const [selectedBulkSellerId, setSelectedBulkSellerId] = useState('');
  const [visibleMarketsCount, setVisibleMarketsCount] = useState(20);
  const [visibleProductsCount, setVisibleProductsCount] = useState(20);
  const [loadingMoreMarkets, setLoadingMoreMarkets] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const marketLoadRef = useRef<HTMLDivElement | null>(null);
  const productLoadRef = useRef<HTMLDivElement | null>(null);
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
  const [taxonomyCategories, setTaxonomyCategories] = useState<any[]>([]);
  const [governanceReport, setGovernanceReport] = useState<any>(null);
  const [taxonomyForm, setTaxonomyForm] = useState<any>({
    id: '',
    label: '',
    productType: '',
    defaultUnit: 'pcs',
    aliases: '',
    synonyms: '',
    attributesJson: '[]',
    variantAxesJson: '[]',
  });

  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [sellerChangeRequests, setSellerChangeRequests] = useState<any[]>([]);
  const [riderChangeRequests, setRiderChangeRequests] = useState<any[]>([]);
  const [profileChangesLoading, setProfileChangesLoading] = useState(false);

  const fetchProfileChangeRequests = async () => {
    setProfileChangesLoading(true);
    try {
      const [sellerRes, riderRes] = await Promise.all([
        sellerApi.get('/sellers/settings/change-requests?status=PENDING'),
        riderApi.get('/riders/settings/change-requests?status=PENDING'),
      ]);
      setSellerChangeRequests(sellerRes.data?.data || []);
      setRiderChangeRequests(riderRes.data?.data || []);
    } catch (e) {
      toast.error('Failed to load profile change requests');
    } finally {
      setProfileChangesLoading(false);
    }
  };

  const reviewProfileChange = async (type: 'seller' | 'rider', id: string, action: 'approve' | 'reject') => {
    try {
      const api = type === 'seller' ? sellerApi : riderApi;
      const root = type === 'seller' ? '/sellers' : '/riders';
      await api.post(`${root}/settings/change-requests/${id}/${action}`, { notes: action === 'approve' ? 'Approved from admin portal' : 'Rejected from admin portal' });
      toast.success(`Change request ${action}d`);
      fetchProfileChangeRequests();
    } catch (e: any) {
      toast.error(e.response?.data?.message || `Failed to ${action} change request`);
    }
  };

  const fetchPayoutRequests = async () => {
    setPayoutsLoading(true);
    try {
      const res = await walletApi.get('/wallets/payouts/all');
      if (res.data?.data) {
        setPayoutRequests(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to load payout requests');
    } finally {
      setPayoutsLoading(false);
    }
  };

  const handleApprovePayout = async (payoutId: string) => {
    try {
      await walletApi.post(`/wallets/payout/${payoutId}/complete`);
      toast.success('Payout approved and settled successfully.');
      fetchPayoutRequests();
    } catch (e) {
      toast.error('Failed to complete payout');
    }
  };

  const handleRejectPayout = async (payoutId: string) => {
    const reason = prompt('Please enter a rejection reason:');
    if (reason === null) return;
    try {
      await walletApi.post(`/wallets/payout/${payoutId}/fail`, { reason: reason || 'Admin rejected request' });
      toast.success('Payout request declined and updated.');
      fetchPayoutRequests();
    } catch (e) {
      toast.error('Failed to reject payout');
    }
  };

  const { data: analytics, execute: fetchAnalytics } = useApi(adminApi, 'get', '/admin/analytics');
  const { data: dashboardAnalytics, execute: fetchDashboardAnalytics } = useApi(adminApi, 'get', '/admin/dashboard/analytics');
  const { data: fraudAlerts, execute: fetchFraud } = useApi(adminApi, 'get', '/admin/fraud-alerts');
  const { data: pendingSellers, execute: fetchSellers } = useApi(sellerApi, 'get', '/sellers?isApproved=false');
  const { data: approvedSellers, execute: fetchApprovedSellers } = useApi(sellerApi, 'get', '/sellers?isApproved=true');
  const { data: pendingProducts, execute: fetchPendingProducts } = useApi(productApi, 'get', '/products?isApproved=false');
  const { data: pendingRiders, execute: fetchRiders } = useApi(riderApi, 'get', '/riders?isApproved=false');
  const { data: disputes, execute: fetchDisputes } = useApi(orderApi, 'get', '/orders?isDisputed=true&dispute.resolvedAt=null');
  const { data: ordersData, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?sellerId=all`, { refreshInterval: 30000 });
  const { data: markets, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets');
  const marketList = Array.isArray(markets) ? markets : [];
  const pendingProductList = Array.isArray(pendingProducts) ? pendingProducts : [];
  const visibleMarkets = marketList.slice(0, visibleMarketsCount);
  const visiblePendingProducts = pendingProductList.slice(0, visibleProductsCount);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      fetchDashboardAnalytics();
    }
    if (activeTab === 'fraud') fetchFraud();
    if (activeTab === 'sellers') fetchSellers();
    if (activeTab === 'products') {
      fetchPendingProducts();
      fetchApprovedSellers();
    }
    if (activeTab === 'riders') fetchRiders();
    if (activeTab === 'disputes') fetchDisputes();
    if (activeTab === 'markets') fetchMarkets();
    if (activeTab === 'payouts') fetchPayoutRequests();
    if (activeTab === 'profile-changes') fetchProfileChangeRequests();
    if (activeTab === 'taxonomy') {
      fetchTaxonomy();
      fetchGovernance();
    }
    if (activeTab === 'accounting') {
      setFetchError(null);
      fetchOrders().catch(() => setFetchError('Failed to load orders. Please try again.'));
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics, fetchDashboardAnalytics, fetchFraud, fetchSellers, fetchApprovedSellers, fetchPendingProducts, fetchRiders, fetchDisputes, fetchOrders]);

  useEffect(() => {
    if (!selectedBulkSellerId && Array.isArray(approvedSellers) && approvedSellers.length > 0) {
      setSelectedBulkSellerId(approvedSellers[0]._id);
    }
  }, [approvedSellers, selectedBulkSellerId]);

  useEffect(() => { setPage(1); }, [dateRange, customStartDate, customEndDate]);
  useEffect(() => { setVisibleMarketsCount(20); }, [marketList.length]);
  useEffect(() => { setVisibleProductsCount(20); }, [pendingProductList.length]);

  useEffect(() => {
    const target = marketLoadRef.current;
    if (activeTab !== 'markets' || !target || visibleMarketsCount >= marketList.length || loadingMoreMarkets) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setLoadingMoreMarkets(true);
      window.setTimeout(() => {
        setVisibleMarketsCount(count => Math.min(count + 20, marketList.length));
        setLoadingMoreMarkets(false);
      }, 250);
    }, { rootMargin: '260px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, loadingMoreMarkets, marketList.length, visibleMarketsCount]);

  useEffect(() => {
    const target = productLoadRef.current;
    if (activeTab !== 'products' || !target || visibleProductsCount >= pendingProductList.length || loadingMoreProducts) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setLoadingMoreProducts(true);
      window.setTimeout(() => {
        setVisibleProductsCount(count => Math.min(count + 20, pendingProductList.length));
        setLoadingMoreProducts(false);
      }, 250);
    }, { rootMargin: '260px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, loadingMoreProducts, pendingProductList.length, visibleProductsCount]);

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
  const openDisputeExposure = Array.isArray(disputes)
    ? disputes.reduce((sum: number, dispute: any) => sum + Number(dispute.financials?.totalAmount || dispute.total || 0), 0)
    : 0;

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
      await productApi.post(`/products/${id}/approve`);
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

  // 7C fix: resolveDispute now supports all 3 resolution types
  const resolveDispute = async (id: string, resolution: string) => {
    const confirmMsg = resolution === 'REFUND' 
      ? 'Issue a full refund to the buyer?' 
      : resolution === 'PARTIAL' 
        ? 'Issue a 50% partial refund?' 
        : 'Deny this dispute with no refund?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await orderApi.post(`/orders/${id}/dispute/resolve`, { resolution });
      const messages: Record<string, string> = {
        REFUND: 'Dispute resolved — full refund issued.',
        PARTIAL: 'Dispute resolved — 50% partial refund issued.',
        NO_REFUND: 'Dispute denied — no refund issued.'
      };
      toast.success(messages[resolution] || 'Dispute resolved.');
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

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedBulkSellerId) {
      toast.error('Select an approved seller before uploading products.');
      e.target.value = '';
      return;
    }

    const toastId = toast.loading(`Uploading ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', selectedBulkSellerId);

    try {
      const res = await productApi.post('/products/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { total, success, failed, errors } = res.data.data;
      toast.success(`Processed ${total} items: ${success} successful, ${failed} failed.`, { id: toastId, duration: 5000 });
      
      if (failed > 0) {
        console.error('Bulk Upload Errors:', errors);
        toast.error(`Check console for ${failed} error(s).`, { duration: 5000 });
      }
      
      fetchPendingProducts();
      fetchMarkets();
    } catch (err: any) {
      toast.error('Bulk upload failed: ' + (err.response?.data?.message || err.message), { id: toastId });
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  const downloadSample = () => {
    const headers = ['Name', 'Description', 'Category', 'Price', 'Unit', 'Stock', 'StockType', 'MadeInRwanda', 'Images'];
    const sample = ['Rwandan Specialty Coffee', 'High-altitude Arabica beans from Gisenyi.', 'Beverages', '12000', 'kg', '100', 'infinite', 'yes', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e'];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), sample.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rmf_product_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchTaxonomy = async () => {
    const res = await productApi.get('/products/catalog/categories?includeInactive=true');
    setTaxonomyCategories(res.data?.data || []);
  };

  const fetchGovernance = async () => {
    const res = await productApi.get('/products/catalog/governance');
    setGovernanceReport(res.data?.data || null);
  };

  const editTaxonomyCategory = (category: any) => {
    setTaxonomyForm({
      id: category.id || '',
      label: category.label || '',
      productType: category.productType || '',
      defaultUnit: category.defaultUnit || 'pcs',
      aliases: (category.aliases || []).join(', '),
      synonyms: (category.synonyms || []).join(', '),
      attributesJson: JSON.stringify(category.attributes || [], null, 2),
      variantAxesJson: JSON.stringify(category.variantAxes || [], null, 2),
    });
  };

  const saveTaxonomyCategory = async () => {
    try {
      const payload = {
        id: taxonomyForm.id,
        label: taxonomyForm.label,
        productType: taxonomyForm.productType,
        defaultUnit: taxonomyForm.defaultUnit,
        aliases: taxonomyForm.aliases.split(',').map((item: string) => item.trim()).filter(Boolean),
        synonyms: taxonomyForm.synonyms.split(',').map((item: string) => item.trim()).filter(Boolean),
        attributes: JSON.parse(taxonomyForm.attributesJson || '[]'),
        variantAxes: JSON.parse(taxonomyForm.variantAxesJson || '[]'),
      };
      await productApi.post('/products/catalog/categories', payload);
      toast.success('Taxonomy category saved');
      setTaxonomyForm({ id: '', label: '', productType: '', defaultUnit: 'pcs', aliases: '', synonyms: '', attributesJson: '[]', variantAxesJson: '[]' });
      fetchTaxonomy();
      fetchGovernance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save taxonomy');
    }
  };

  const retireTaxonomyCategory = async (categoryId: string) => {
    if (!confirm(`Retire ${categoryId}? Categories already used by products cannot be deleted.`)) return;
    try {
      await productApi.delete(`/products/catalog/categories/${categoryId}`);
      toast.success('Category retired');
      fetchTaxonomy();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Category could not be retired');
    }
  };

  const runBackfill = async (dryRun: boolean) => {
    const res = await productApi.post('/products/catalog/migrate-backfill', { dryRun, limit: 5000 });
    toast.success(dryRun ? `Dry run scanned ${res.data?.data?.scanned || 0}` : `Backfilled ${res.data?.data?.updated || 0} products`);
    fetchGovernance();
  };

  return (
    <Layout>
      {selectedReceipt && (
        <ReceiptView order={selectedReceipt} role="admin" onClose={() => setSelectedReceipt(null)} />
      )}

      {/* Verification Document Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#e05300]/80 backdrop-blur-sm p-4 animate-reveal">
           <div className="bg-white w-full max-w-4xl border border-[#e0e0e0] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-[#e0e0e0] flex justify-between items-center bg-[#fcf9f8]">
                 <h2 className="text-xl font-sans text-[#1b1c1c]">Verification Documents: {selectedSeller.shopDetails?.name || selectedSeller.stallName || selectedSeller.plateNumber}</h2>
                 <button onClick={() => setSelectedSeller(null)} className="text-2xl text-[#1b1c1c] hover:text-[#ff6b00]">&times;</button>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[70vh]">
                 <VerificationDocumentPanel
                   title={selectedSeller.plateNumber ? 'Driving License' : 'Business Permit'}
                   url={selectedSeller.licenseUrl || selectedSeller.businessPermitUrl}
                 />
                 {!selectedSeller.plateNumber && (
                   <VerificationDocumentPanel title="RRA Certificate" url={selectedSeller.rraCertificateUrl} />
                 )}
                 <VerificationDocumentPanel title="National ID" url={selectedSeller.idCardUrl} />
                 <div className={!selectedSeller.plateNumber ? '' : 'md:col-span-2'}>
                   <VerificationDocumentPanel
                     title={selectedSeller.plateNumber ? 'Vehicle Photo' : 'Stall / Shop Photo'}
                     url={selectedSeller.vehiclePhotoUrl || selectedSeller.stallPhotoUrl}
                   />
                 </div>
              </div>
              <div className="p-6 border-t border-[#e0e0e0] flex justify-end gap-4 bg-[#fcf9f8]">
                 <button onClick={() => setSelectedSeller(null)} className="px-6 py-3 border border-[#e0e0e0] text-[#1b1c1c] text-[10px] font-black uppercase tracking-widest hover:bg-[#e05300] hover:text-white transition-all">Cancel</button>
                 <button onClick={() => {
                    if (selectedSeller.plateNumber) {
                      approveRider(selectedSeller._id);
                    } else {
                      approveSeller(selectedSeller._id);
                    }
                    setSelectedSeller(null);
                 }} className="px-6 py-3 bg-[#e05300] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#e05300] transition-all">Approve Application</button>
              </div>
           </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 p-4 md:p-12">
        <div className="border-b border-[#e0e0e0] pb-6 mb-8 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-0">
          <h1 className="text-2xl md:text-4xl font-sans text-[#1b1c1c] capitalize tracking-normal">
             {activeTab.replace('-', ' ')}
          </h1>
          
          {activeTab === 'products' && (
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
               <select
                  value={selectedBulkSellerId}
                  onChange={(event) => setSelectedBulkSellerId(event.target.value)}
                  className="min-w-[15rem] rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-sm font-bold text-[#1b1c1c] outline-none transition focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/10"
               >
                  <option value="">Choose approved seller</option>
                  {Array.isArray(approvedSellers) && approvedSellers.map((seller: any) => (
                    <option key={seller._id} value={seller._id}>
                      {seller.shopDetails?.name || seller.stallName || seller.stallId || seller._id}
                    </option>
                  ))}
               </select>
               <button
                  onClick={downloadSample}
                  className="rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-[9px] font-black uppercase tracking-widest text-[#414844] transition hover:bg-[#fcf9f8]"
               >
                  Template
               </button>
               <input
                  type="file"
                  id="bulk-upload-input"
                  className="hidden"
                  accept=".csv, .xlsx"
                  onChange={handleBulkUpload}
               />
               <label
                  htmlFor="bulk-upload-input"
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#ff6b00] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#e05300]"
               >
                  <span className="h-2 w-2 rounded-full bg-[#ffedd5]"></span>
                  Bulk upload
               </label>
            </div>
          )}
        </div>

          {activeTab === 'live-map' && (
            <div className="space-y-6 animate-reveal h-[calc(100vh-200px)]">
               <div className="h-full border border-[#e0e0e0] bg-white flex flex-col shadow-sm relative overflow-hidden group">
                  <div className="p-6 border-b border-[#e0e0e0] bg-[#fcf9f8] flex justify-between items-center z-10">
                     <div>
                        <h3 className="text-xl font-sans text-[#1b1c1c] flex items-center gap-3">
                           <div className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                           </div>
                           Live Map
                        </h3>
                        <p className="text-[10px] font-medium text-[#414844] uppercase tracking-widest mt-1">Real-time rider locations across Rwanda</p>
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
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Monthly GMV</p>
                  <p className="text-3xl font-sans text-[#1b1c1c]">{analytics?.monthlyGMV?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm border-l-4 border-l-[#ea580c]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Platform Revenue</p>
                  <p className="text-3xl font-sans text-[#1b1c1c]">{analytics?.monthlyCommission?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Active Sellers</p>
                  <p className="text-3xl font-sans text-[#1b1c1c]">{analytics?.activeSellers || 0}</p>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Active Riders</p>
                  <p className="text-3xl font-sans text-[#1b1c1c]">{analytics?.activeRiders || 0}</p>
                </div>
              </div>

              {/* Growth Charts */}
              <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
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
                      dateRange === range ? 'bg-[#e05300] text-white border-[#e0e0e0]' : 'bg-white text-[#1b1c1c] border-[#e0e0e0] hover:border-[#ff6b00]'
                    }`}
                  >
                    {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>

              {/* Revenue Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#e05300] text-white p-8 shadow-lg">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Total GMV</p>
                  <p className="text-3xl font-sans">{totalGMV.toLocaleString()}</p>
                  <p className="text-[9px] text-white/40 mt-2 uppercase tracking-widest">{filteredOrders.length} orders</p>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Platform Revenue</p>
                  <p className="text-3xl font-sans text-[#ff6b00]">{platformRevenue.toLocaleString()}</p>
                  <p className="text-[9px] text-[#414844] mt-2 uppercase tracking-widest opacity-60">Comm: {totalCommission.toLocaleString()} | Gate: {totalGateway.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Seller Payouts</p>
                  <p className="text-3xl font-sans text-green-600">{totalSellerPayout.toLocaleString()}</p>
                  <p className="text-[9px] text-[#414844] mt-2 uppercase tracking-widest opacity-60">{(totalGMV > 0 ? (totalSellerPayout / totalGMV * 100) : 0).toFixed(1)}% of GMV</p>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-2">Rider Payouts</p>
                  <p className="text-3xl font-sans text-[#1b1c1c]">{totalRiderPayout.toLocaleString()}</p>
                  <p className="text-[9px] text-[#414844] mt-2 uppercase tracking-widest opacity-60">{deliveredOrders.length} delivered</p>
                </div>
              </div>

              {/* Settlement Summary */}
              <div className="bg-white border border-[#e0e0e0] shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#e0e0e0] bg-[#fcf9f8] flex justify-between items-center">
                  <h2 className="text-lg font-sans text-[#1b1c1c]">Settlement Report</h2>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#414844]">{filteredOrders.length} records</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
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
                    <tbody className="divide-y divide-[#e0e0e0] text-sm bg-[#fcf9f8]/30">
                      {filteredOrders.length === 0 ? (
                        <tr><td colSpan={10} className="p-12 text-center text-[#414844]">No transactions in this period.</td></tr>
                      ) : (
                        paginatedOrders.map((order: any) => (
                          <tr key={order._id} className="hover:bg-white transition-colors">
                            <td className="p-4 font-mono text-[10px] font-bold">#{order._id.substring(0, 6).toUpperCase()}</td>
                            <td className="p-4 text-[11px] text-[#414844]">{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td className="p-4 text-xs font-medium">{order.buyer?.fullName || 'N/A'}</td>
                            <td className="p-4 text-xs font-medium">{order.seller?.fullName || 'N/A'}</td>
                            <td className="p-4 text-right text-xs font-bold">{(order.financials?.totalAmount || 0).toLocaleString()}</td>
                            <td className="p-4 text-right text-xs font-bold text-[#ff6b00]">{(order.financials?.platformCommission || 0).toLocaleString()}</td>
                            <td className="p-4 text-right text-xs font-bold text-green-700">+{(order.financials?.sellerPayout || 0).toLocaleString()}</td>
                            <td className="p-4 text-right text-xs font-bold text-[#1b1c1c]">+{(order.financials?.riderPayout || 0).toLocaleString()}</td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 border text-[8px] font-black uppercase tracking-widest ${
                                order.status === 'delivered' || order.status === 'resolved'
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : order.status === 'cancelled'
                                    ? 'bg-red-50 border-red-200 text-red-700'
                                    : 'bg-white border-[#e0e0e0] text-[#414844]'
                              }`}>
                                {order.status === 'delivered' ? 'SETTLED' :
                                 order.status === 'resolved' ? 'RESOLVED' :
                                 order.status === 'cancelled' ? 'CANCELLED' :
                                 order.status === 'disputed' ? 'DISPUTED' : 'PENDING'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button onClick={() => openReceipt(order)} className="text-[10px] border border-[#e0e0e0] px-3 py-1 hover:border-[#ff6b00]">View</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                   <div className="p-4 border-t border-[#e0e0e0] flex justify-between items-center bg-white">
                      <button 
                         disabled={page === 1} 
                         onClick={() => setPage(p => p - 1)}
                         className="px-4 py-2 border border-[#e0e0e0] text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                      >Prev</button>
                      <span className="text-[10px] font-bold text-[#414844]">Page {page} of {totalPages}</span>
                      <button 
                         disabled={page === totalPages} 
                         onClick={() => setPage(p => p + 1)}
                         className="px-4 py-2 border border-[#e0e0e0] text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                      >Next</button>
                   </div>
                )}
              </div>

              {/* Platform P&L Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#e0e0e0] rounded-lg p-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1b1c1c] mb-4 border-b border-[#e0e0e0] pb-2">Platform Revenue</p>
                  <p className="text-3xl font-sans text-[#1b1c1c]">{platformRevenue.toLocaleString()}</p>
                  <div className="text-[10px] font-bold text-[#414844] mt-4 space-y-1">
                    <p>Commission: +{totalCommission.toLocaleString()}</p>
                    <p>Gateway: +{totalGateway.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#414844] mb-4 border-b border-[#e0e0e0] pb-2">Total Payouts</p>
                  <p className="text-3xl font-sans text-[#414844]">{(totalSellerPayout + totalRiderPayout).toLocaleString()}</p>
                  <div className="text-[10px] font-bold text-[#414844] mt-4 space-y-1">
                    <p>Sellers: {totalSellerPayout.toLocaleString()}</p>
                    <p>Riders: {totalRiderPayout.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-[#e05300] text-white border border-[#e0e0e0] rounded-lg p-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-4 border-b border-white/20 pb-2">Net Position</p>
                  <p className="text-3xl font-sans text-[#ff6b00]">{(platformRevenue - (totalSellerPayout + totalRiderPayout)).toLocaleString()}</p>
                  <div className="text-[10px] font-bold text-white/40 mt-4 space-y-1">
                    <p>Revenue: {platformRevenue.toLocaleString()}</p>
                    <p>Payouts: {(totalSellerPayout + totalRiderPayout).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sellers' && (
            <div className="bg-white border border-[#e0e0e0] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                  <tr>
                    <th className="p-6">Seller Details</th>
                    <th className="p-6">Category</th>
                    <th className="p-6">Applied On</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]">
                  {!pendingSellers || pendingSellers.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-[#414844]">No pending seller applications.</td></tr>
                  ) : (
                    pendingSellers.map((s: any) => (
                      <tr key={s._id} className="hover:bg-[#fcf9f8]/50 transition-colors">
                        <td className="p-6">
                          <p className="font-sans text-lg text-[#1b1c1c]">{s.shopDetails?.name || s.stallName || s.marketId}</p>
                          <p className="text-[10px] font-black text-[#414844] uppercase tracking-widest mt-1">{s.sellerName || 'Pending'}</p>
                        </td>
                        <td className="p-6 text-xs font-medium text-[#1b1c1c]">{s.marketId && s.marketId.length > 5 ? 'Market Vendor' : 'Independent'}</td>
                        <td className="p-6 text-xs text-[#414844]">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td className="p-6 text-right flex justify-end gap-3">
                          <button className="px-4 py-2 border border-[#e0e0e0] text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] hover:border-[#ff6b00]" onClick={() => setSelectedSeller(s)}>View Docs</button>
                          <button className="px-4 py-2 border border-red-200 bg-red-50 text-[9px] font-black uppercase tracking-widest text-red-600 hover:border-red-500" onClick={() => declineSeller(s._id)}>Decline</button>
                          <button className="px-4 py-2 bg-[#e05300] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#e05300]" onClick={() => approveSeller(s._id)}>Approve</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'riders' && (
            <div className="bg-white border border-[#e0e0e0] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                  <tr>
                    <th className="p-6">Rider ID</th>
                    <th className="p-6">Plate Number</th>
                    <th className="p-6">Applied On</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]">
                  {!pendingRiders || pendingRiders.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-[#414844]">No pending rider applications.</td></tr>
                  ) : (
                    pendingRiders.map((r: any) => (
                      <tr key={r._id} className="hover:bg-[#fcf9f8]/50 transition-colors">
                        <td className="p-6">
                          <p className="font-mono text-sm font-bold text-[#1b1c1c]">{r.userId.substring(0,8)}</p>
                        </td>
                        <td className="p-6 font-mono text-sm font-medium">{r.plateNumber}</td>
                        <td className="p-6 text-xs text-[#414844]">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="p-6 text-right flex justify-end gap-3">
                          <button className="px-4 py-2 border border-[#e0e0e0] text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] hover:border-[#ff6b00]" onClick={() => setSelectedSeller(r)}>View Docs</button>
                          <button className="px-4 py-2 bg-[#e05300] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#e05300]" onClick={() => approveRider(r._id)}>Approve</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'profile-changes' && (
            <div className="space-y-6 animate-reveal">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { title: 'Seller market changes', type: 'seller' as const, items: sellerChangeRequests },
                  { title: 'Rider profile changes', type: 'rider' as const, items: riderChangeRequests },
                ].map(group => (
                  <section key={group.type} className="rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between border-b border-[#e0e0e0] pb-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Admin review</p>
                        <h2 className="mt-1 text-xl font-black text-[#1b1c1c]">{group.title}</h2>
                      </div>
                      <span className="rounded-full bg-[#ffedd5] px-3 py-1 text-xs font-black text-[#9a3412]">{group.items.length}</span>
                    </div>
                    {profileChangesLoading ? (
                      <div className="h-40 animate-pulse rounded-md bg-[#fcf9f8]" />
                    ) : group.items.length === 0 ? (
                      <p className="rounded-md border border-dashed border-[#e0e0e0] p-8 text-center text-sm font-semibold text-[#5f7569]">No pending requests.</p>
                    ) : (
                      <div className="space-y-4">
                        {group.items.map((request: any) => (
                          <article key={request._id} className="rounded-md border border-[#e0e0e0] bg-[#fcf9f8] p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-xs font-black uppercase tracking-widest text-[#1b1c1c]">{request.targetId}</p>
                              <p className="text-[10px] font-bold text-[#5f7569]">{new Date(request.createdAt).toLocaleString()}</p>
                            </div>
                            <pre className="max-h-56 overflow-auto rounded-md bg-white p-3 text-xs text-[#1b1c1c]">{JSON.stringify(request.requestedChanges, null, 2)}</pre>
                            <div className="mt-4 flex justify-end gap-2">
                              <button onClick={() => reviewProfileChange(group.type, request._id, 'reject')} className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600">Reject</button>
                              <button onClick={() => reviewProfileChange(group.type, request._id, 'approve')} className="rounded-md bg-[#ff6b00] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Approve</button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-white border border-[#e0e0e0] shadow-sm animate-reveal overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                  <tr>
                    <th className="p-6">Product Item</th>
                    <th className="p-6">Price & Stock</th>
                    <th className="p-6">Date</th>
                    <th className="p-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]">
                  {!pendingProducts || pendingProducts.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-[#414844]">No pending product approvals.</td></tr>
                  ) : (
                    visiblePendingProducts.map((p: any) => (
                      <tr key={p._id} className="hover:bg-[#fcf9f8]/50 transition-colors">
                        <td className="p-6 flex items-center gap-4">
                          <div className="w-16 h-16 border border-[#e0e0e0] bg-[#fcf9f8] overflow-hidden p-1">
                            {p.images?.[0] && <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="font-sans text-lg text-[#1b1c1c]">{p.name}</p>
                            <p className="text-[9px] font-black text-[#414844] uppercase tracking-widest mt-1">Cat: {p.category}</p>
                          </div>
                        </td>
                        <td className="p-6">
                          <p className="text-lg font-sans text-[#ff6b00]">{p.price.toLocaleString()} RWF</p>
                          <p className="text-[10px] font-black text-[#414844] uppercase tracking-widest mt-1">{p.stockType === 'finite' ? `${p.stockQuantity} ${p.unit}` : p.stockType === 'infinite' ? 'Unlimited' : 'Made to Order'}</p>
                        </td>
                        <td className="p-6 text-xs text-[#414844]">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="p-6 text-right flex justify-end gap-3">
                          <button className="px-4 py-2 border border-red-200 bg-red-50 text-[9px] font-black uppercase tracking-widest text-red-600 hover:border-red-500" onClick={() => declineProduct(p._id)}>Reject</button>
                          <button className="px-4 py-2 bg-[#e05300] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#e05300]" onClick={() => approveProduct(p._id)}>Approve</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div ref={productLoadRef} className="min-h-1" />
              {loadingMoreProducts && (
                <div className="border-t border-[#e0e0e0] p-4">
                  {[1, 2, 3].map(i => <div key={i} className="mb-3 h-16 animate-pulse rounded-md bg-[#f0eded]" />)}
                </div>
              )}
              {!loadingMoreProducts && visibleProductsCount < pendingProductList.length && (
                <div className="border-t border-[#e0e0e0] p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#414844]">
                  Scroll to load more product approvals
                </div>
              )}
            </div>
          )}

          {activeTab === 'taxonomy' && (
            <div className="space-y-6 animate-reveal">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: 'Categories', value: taxonomyCategories.length },
                  { label: 'Products audited', value: governanceReport?.totals?.products || 0 },
                  { label: 'Missing required', value: governanceReport?.totals?.missingRequired || 0 },
                  { label: 'Uncategorized', value: governanceReport?.totals?.uncategorized || 0 },
                ].map(card => (
                  <div key={card.label} className="rounded-lg border border-[#dfe7e2] bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5f7569]">{card.label}</p>
                    <p className="mt-2 text-3xl font-sans text-[#ff6b00]">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Taxonomy editor</p>
                      <h3 className="mt-2 text-2xl font-sans text-[#1b1c1c]">Category intelligence</h3>
                    </div>
                    <button onClick={() => setTaxonomyForm({ id: '', label: '', productType: '', defaultUnit: 'pcs', aliases: '', synonyms: '', attributesJson: '[]', variantAxesJson: '[]' })} className="rounded-md border border-[#dfe7e2] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">
                      New
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['id', 'Category ID'],
                      ['label', 'Display label'],
                      ['productType', 'Product type'],
                      ['defaultUnit', 'Default unit'],
                      ['aliases', 'Aliases'],
                      ['synonyms', 'Search synonyms'],
                    ].map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[#405046]">{label}</span>
                        <input value={taxonomyForm[key]} onChange={e => setTaxonomyForm((prev: any) => ({ ...prev, [key]: e.target.value }))} className="h-10 w-full rounded-md border border-[#dfe7e2] px-3 text-sm font-semibold outline-none focus:border-[#ff6b00]" />
                      </label>
                    ))}
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[#405046]">Attributes JSON</span>
                    <textarea value={taxonomyForm.attributesJson} onChange={e => setTaxonomyForm((prev: any) => ({ ...prev, attributesJson: e.target.value }))} className="min-h-40 w-full rounded-md border border-[#dfe7e2] bg-[#fcf9f8] p-3 font-mono text-xs outline-none focus:border-[#ff6b00]" />
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[#405046]">Variant axes JSON</span>
                    <textarea value={taxonomyForm.variantAxesJson} onChange={e => setTaxonomyForm((prev: any) => ({ ...prev, variantAxesJson: e.target.value }))} className="min-h-28 w-full rounded-md border border-[#dfe7e2] bg-[#fcf9f8] p-3 font-mono text-xs outline-none focus:border-[#ff6b00]" />
                  </label>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button onClick={saveTaxonomyCategory} className="rounded-md bg-[#ff6b00] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">Save category</button>
                    <button onClick={() => runBackfill(true)} className="rounded-md border border-[#dfe7e2] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Dry-run backfill</button>
                    <button onClick={() => runBackfill(false)} className="rounded-md border border-[#ff6b00] bg-[#e8f5ed] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Run backfill</button>
                  </div>
                </section>

                <section className="rounded-lg border border-[#dfe7e2] bg-white shadow-sm">
                  <div className="border-b border-[#dfe7e2] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Live taxonomy</p>
                    <h3 className="mt-2 text-2xl font-sans text-[#1b1c1c]">Managed product categories</h3>
                  </div>
                  <div className="divide-y divide-[#edf1ee]">
                    {taxonomyCategories.map(category => (
                      <div key={category.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                        <div>
                          <p className="text-lg font-black text-[#1b1c1c]">{category.label}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#5f7569]">{category.id} · {category.productType} · {category.defaultUnit}</p>
                          <p className="mt-2 text-sm font-semibold text-[#405046]">{category.attributes?.length || 0} attributes · {category.variantAxes?.length || 0} variant axes · v{category.version || 1}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => editTaxonomyCategory(category)} className="rounded-md border border-[#dfe7e2] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">Edit</button>
                          <button onClick={() => retireTaxonomyCategory(category.id)} className="rounded-md border border-[#ead2d2] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#8a3c3c]">Retire</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Attribute governance</p>
                  <h3 className="mt-2 text-2xl font-sans text-[#1b1c1c]">Data cleanup queue</h3>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    ['Missing required fields', governanceReport?.missingRequired || []],
                    ['Unknown attributes', governanceReport?.unknownAttributes || []],
                    ['Needs category backfill', governanceReport?.uncategorized || []],
                  ].map(([title, rows]: any) => (
                    <div key={title} className="rounded-lg border border-[#edf1ee] bg-[#fcf9f8] p-4">
                      <p className="text-sm font-black text-[#1b1c1c]">{title}</p>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                        {rows.length === 0 ? (
                          <p className="text-sm font-semibold text-[#5f7569]">No issues found.</p>
                        ) : rows.slice(0, 20).map((row: any, index: number) => (
                          <div key={`${row.productId}-${row.field || index}`} className="rounded-md bg-white p-3 text-xs font-semibold text-[#405046]">
                            <p className="font-black text-[#1b1c1c]">{row.name}</p>
                            <p>{row.field || row.category} {row.suggestedCategoryId ? `→ ${row.suggestedCategoryId}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="space-y-6 animate-reveal">
              <div className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Buyer protection queue</p>
                  <h3 className="mt-2 text-2xl font-sans text-[#1b1c1c]">Open Dispute Exposure</h3>
                  <p className="mt-2 text-sm font-semibold text-[#5f7569]">Refunds under 10,000 RWF can be resolved instantly. Larger cases stay in manual review with the order, seller, rider, and payment evidence visible.</p>
                </div>
                <p className="mt-4 text-3xl font-sans text-[#ff6b00]">{openDisputeExposure.toLocaleString()} RWF</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: 'Evidence', value: 'Receipt, delivery route, chat, payment ledger', tone: 'bg-[#e8f5ed]' },
                  { label: 'Decision', value: 'Instant refund, seller rebuttal, rider investigation', tone: 'bg-white' },
                  { label: 'Audit', value: 'Every admin action is retained with order history', tone: 'bg-white' },
                ].map(card => (
                  <div key={card.label} className={`rounded-lg border border-[#dfe7e2] ${card.tone} p-5`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">{card.label}</p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#405046]">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#e0e0e0] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                    <tr>
                      <th className="p-6">Order ID</th>
                      <th className="p-6">Amount</th>
                      <th className="p-6">Reason</th>
                      <th className="p-6">Investigation Basis</th>
                      <th className="p-6 text-right">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e0e0]">
                    {!disputes || disputes.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-[#414844]">No open disputes.</td></tr>
                    ) : (
                      disputes.map((d: any) => (
                        <tr key={d._id} className="hover:bg-[#fcf9f8]/50">
                          <td className="p-6 font-mono text-[10px] font-bold text-[#1b1c1c]">#{d._id.substring(0,8).toUpperCase()}</td>
                          <td className="p-6 text-lg font-sans text-[#ff6b00]">{d.financials?.totalAmount || d.total} RWF</td>
                          <td className="p-6 text-xs text-[#414844]">{d.dispute?.reason || 'Undelivered'}</td>
                          <td className="p-6">
                            <div className="flex flex-wrap gap-2">
                              {['receipt', 'payment', d.deliveryId ? 'route' : 'no route', d.messages?.length ? 'chat' : 'no chat'].map(item => (
                                <span key={item} className="rounded border border-[#dfe7e2] bg-[#f7faf8] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-[#405046]">{item}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex gap-2 justify-end flex-wrap">
                              <button className="px-3 py-2 bg-[#e05300] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#ff6b00] transition-colors" onClick={() => resolveDispute(d._id, 'REFUND')}>
                                Full Refund
                              </button>
                              <button className="px-3 py-2 border border-[#e0e0e0] text-[#1b1c1c] text-[9px] font-black uppercase tracking-widest hover:bg-[#f7faf8] transition-colors" onClick={() => resolveDispute(d._id, 'PARTIAL')}>
                                50% Refund
                              </button>
                              <button className="px-3 py-2 border border-[#e0e0e0] text-[#7b3f3f] text-[9px] font-black uppercase tracking-widest hover:bg-[#fff5f3] transition-colors" onClick={() => resolveDispute(d._id, 'NO_REFUND')}>
                                Deny
                              </button>
                            </div>
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
              <div className="flex justify-between items-center border-b border-[#e0e0e0] pb-6">
                 <div>
                   <h2 className="text-3xl font-sans text-[#1b1c1c]">Markets Directory</h2>
                   <p className="text-[10px] font-black text-[#414844] uppercase tracking-[0.2em] mt-2">Manage physical market locations</p>
                 </div>
                 <div className="flex gap-4">
                   <button className="px-6 py-3 border border-[#e0e0e0] text-[#1b1c1c] text-[10px] font-black uppercase tracking-widest hover:bg-[#e05300] hover:text-white transition-all" onClick={handleSyncImagery}>Sync Images</button>
                   <button className="px-6 py-3 bg-[#e05300] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#e05300] transition-all" onClick={() => setIsAddingMarket(true)}>Create Market</button>
                 </div>
              </div>

              {isAddingMarket && (
                <div className="bg-white border border-[#e0e0e0] rounded-lg p-8 shadow-xl">
                  <form onSubmit={handleCreateMarket} className="space-y-6">
                    <h3 className="text-xl font-sans border-b border-[#e0e0e0] pb-4 mb-6">New Market Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Market Name</label>
                        <input required className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={newMarket.name} onChange={e => setNewMarket(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Kimironko Market" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Market Code</label>
                        <input required className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={newMarket.code} onChange={e => setNewMarket(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="e.g. KIM" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Market Cover Photo</label>
                      <ImageUpload service="market" endpoint="/markets/upload-image" value={newMarket.imageUrl} onChange={(url) => setNewMarket(prev => ({ ...prev, imageUrl: url }))} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Description</label>
                      <textarea className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] h-24" value={newMarket.description} onChange={e => setNewMarket(prev => ({ ...prev, description: e.target.value }))} placeholder="Market overview..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Latitude</label>
                          <input type="number" step="any" className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={newMarket.lat} onChange={e => setNewMarket(prev => ({ ...prev, lat: parseFloat(e.target.value) }))} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Longitude</label>
                          <input type="number" step="any" className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={newMarket.lng} onChange={e => setNewMarket(prev => ({ ...prev, lng: parseFloat(e.target.value) }))} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Type</label>
                          <select className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={newMarket.type} onChange={e => setNewMarket(prev => ({ ...prev, type: e.target.value }))}>
                             <option value="public">Public Market</option>
                             <option value="individual">Independent Area</option>
                          </select>
                       </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-6 border-t border-[#e0e0e0]">
                       <button type="button" className="px-6 py-3 border border-[#e0e0e0] text-[#1b1c1c] text-[10px] font-black uppercase tracking-widest hover:border-[#ff6b00]" onClick={() => setIsAddingMarket(false)}>Cancel</button>
                       <button type="submit" className="px-6 py-3 bg-[#e05300] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#e05300]">Create Market</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white border border-[#e0e0e0] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                    <tr>
                      <th className="p-6">Market Info</th>
                      <th className="p-6">Code</th>
                      <th className="p-6">Status</th>
                      <th className="p-6 text-right">Metrics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e0e0]">
                    {!markets || markets.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-[#414844]">No markets created yet.</td></tr>
                    ) : (
                      visibleMarkets.map((m: any) => (
                        <tr key={m._id} className="hover:bg-[#fcf9f8]/50">
                          <td className="p-6">
                            <div className="flex items-center gap-6">
                               <div className="w-16 h-16 border border-[#e0e0e0] bg-[#fcf9f8] p-1 overflow-hidden">
                                  {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />}
                               </div>
                               <div>
                                  <p className="font-sans text-lg text-[#1b1c1c]">{m.name}</p>
                                  <p className="text-[10px] text-[#414844] truncate max-w-xs mt-1">{m.description || 'No description available'}</p>
                               </div>
                            </div>
                          </td>
                          <td className="p-6 font-mono font-bold text-[#1b1c1c] text-sm">{m.code}</td>
                          <td className="p-6">
                            <span className="px-3 py-1 border border-green-200 bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-widest">Active</span>
                          </td>
                          <td className="p-6 text-right">
                             <div className="flex items-center justify-end gap-6">
                               <div className="text-right">
                                 <p className="text-xl font-sans text-[#ff6b00]">{m.totalSellers || 0}</p>
                                 <p className="text-[8px] font-black text-[#414844] uppercase tracking-widest mt-1">Sellers</p>
                               </div>
                               <button className="px-4 py-2 border border-[#e0e0e0] text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] hover:border-[#ff6b00]" onClick={() => setEditingMarket({
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
                <div ref={marketLoadRef} className="min-h-1" />
                {loadingMoreMarkets && (
                  <div className="border-t border-[#e0e0e0] p-4">
                    {[1, 2, 3].map(i => <div key={i} className="mb-3 h-16 animate-pulse rounded-md bg-[#f0eded]" />)}
                  </div>
                )}
                {!loadingMoreMarkets && visibleMarketsCount < marketList.length && (
                  <div className="border-t border-[#e0e0e0] p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#414844]">
                    Scroll to load more markets
                  </div>
                )}
              </div>

              {editingMarket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#e05300]/80 backdrop-blur-sm p-4 animate-reveal">
                  <div className="bg-white w-full max-w-2xl border border-[#e0e0e0] shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-[#e0e0e0] flex justify-between items-center bg-[#fcf9f8]">
                      <h2 className="text-xl font-sans text-[#1b1c1c]">Edit Market: {editingMarket.name}</h2>
                      <button onClick={() => setEditingMarket(null)} className="text-2xl text-[#1b1c1c] hover:text-[#ff6b00]">&times;</button>
                    </div>
                    <form onSubmit={handleUpdateMarket} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Market Name</label>
                          <input required className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={editingMarket.name} onChange={e => setEditingMarket((prev: any) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Market Code</label>
                          <input required className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00]" value={editingMarket.code} onChange={e => setEditingMarket((prev: any) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Market Photo</label>
                        <ImageUpload service="market" endpoint="/markets/upload-image" value={editingMarket.imageUrl} onChange={(url) => setEditingMarket((prev: any) => ({ ...prev, imageUrl: url }))} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">Description</label>
                        <textarea className="w-full bg-[#fcf9f8] border border-[#e0e0e0] p-4 text-sm outline-none focus:border-[#ff6b00] h-24" value={editingMarket.description} onChange={e => setEditingMarket((prev: any) => ({ ...prev, description: e.target.value }))} />
                      </div>

                      <div className="flex justify-end gap-4 pt-6 border-t border-[#e0e0e0]">
                        <button type="button" className="px-6 py-3 border border-[#e0e0e0] text-[#1b1c1c] text-[10px] font-black uppercase tracking-widest hover:border-[#ff6b00]" onClick={() => setEditingMarket(null)}>Cancel</button>
                        <button type="submit" className="px-6 py-3 bg-[#e05300] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#e05300]">Save Changes</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fraud' && (
            <div className="space-y-5 animate-reveal">
              <div className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Security operations</p>
                <h2 className="mt-2 text-2xl font-sans text-[#1b1c1c]">Fraud Alerts</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f7569]">
                  Alerts are triaged against related orders, payment entries, rider movement, and dispute history before refunds or account restrictions are applied.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { label: 'Active alerts', value: Array.isArray(fraudAlerts) ? fraudAlerts.length : 0 },
                  { label: 'Critical', value: Array.isArray(fraudAlerts) ? fraudAlerts.filter((f: any) => f.severity === 'CRITICAL').length : 0 },
                  { label: 'Linked orders', value: Array.isArray(fraudAlerts) ? fraudAlerts.reduce((sum: number, f: any) => sum + (f.relatedOrders?.length || 0), 0) : 0 },
                  { label: 'Refund route', value: 'Disputes tab' },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border border-[#dfe7e2] bg-white p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5f7569]">{item.label}</p>
                    <p className="mt-3 text-2xl font-sans text-[#1b1c1c]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#e0e0e0] shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                  <tr>
                    <th className="p-6 w-32">Type / Severity</th>
                    <th className="p-6 w-48">Actor / Entity</th>
                    <th className="p-6">Alert Details & Reason</th>
                    <th className="p-6 w-40">Detected At</th>
                    <th className="p-6 w-48 text-right">Next Step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]">
                  {!fraudAlerts || fraudAlerts.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-[#414844]">No active fraud alerts. System secure.</td></tr>
                  ) : (
                    fraudAlerts.map((f: any) => (
                      <tr key={f._id} className="hover:bg-[#fcf9f8]/50 group transition-all">
                        <td className="p-6">
                           <div className="flex flex-col gap-1">
                             <span className={`text-[8px] font-black uppercase tracking-normal ${f.type === 'SECURITY_FLAG' ? 'text-blue-600' : 'text-[#ff6b00]'}`}>{f.type?.replace('_', ' ') || 'FLAG'}</span>
                             <span className={`w-fit px-2 py-0.5 text-[7px] font-black uppercase tracking-widest border ${
                               f.severity === 'CRITICAL' ? 'bg-red-600 text-white border-red-700' : 
                               f.severity === 'HIGH' ? 'bg-red-50 text-red-600 border-red-200' : 
                               'bg-blue-50 text-blue-600 border-blue-200'
                             }`}>{f.severity || 'MEDIUM'}</span>
                           </div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#1b1c1c]">{f.actor || 'System Auto-Flag'}</span>
                            <span className="text-[9px] font-mono text-[#414844] uppercase tracking-normal">{f.actorId || f._id}</span>
                          </div>
                        </td>
                        <td className="p-6">
                           <p className="text-sm text-[#1b1c1c] font-medium leading-relaxed">{f.reason}</p>
                           {f.relatedOrders && f.relatedOrders.length > 0 && (
                             <div className="mt-2 flex flex-wrap gap-1">
                               {f.relatedOrders.slice(0, 5).map((order: string) => (
                                 <span key={order} className="bg-[#fcf9f8] border border-[#e0e0e0] px-2 py-0.5 text-[8px] font-mono font-bold text-[#414844]">{order}</span>
                               ))}
                               {f.relatedOrders.length > 5 && <span className="text-[8px] text-[#414844] font-black">+{f.relatedOrders.length - 5} more</span>}
                             </div>
                           )}
                        </td>
                        <td className="p-6">
                           <span className="text-[10px] font-bold text-[#414844]">{new Date(f.createdAt).toLocaleString()}</span>
                        </td>
                        <td className="p-6 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveTab('disputes')}
                            className="rounded-md border border-[#dfe7e2] bg-[#f7faf8] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[#ff6b00] hover:border-[#ff6b00]"
                          >
                            Investigate Refund
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

          {activeTab === 'payouts' && (
            <div className="space-y-6 animate-reveal">
              <div className="rounded-lg border border-[#dfe7e2] bg-white p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6b00]">Liquidity Terminal</p>
                <h2 className="mt-2 text-2xl font-sans text-[#1b1c1c]">Payout Approvals</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f7569]">
                  Review, approve, or reject Mobile Money liquidation requests submitted by sellers and riders. Approving a request instantly deducts funds from the user's wallet.
                </p>
              </div>

              <div className="bg-white border border-[#e0e0e0] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#fcf9f8] text-[#414844] text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#e0e0e0]">
                    <tr>
                      <th className="p-6">Transaction ID</th>
                      <th className="p-6">User Reference</th>
                      <th className="p-6">Recipient Phone</th>
                      <th className="p-6">Amount</th>
                      <th className="p-6">Status</th>
                      <th className="p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e0e0]">
                    {payoutsLoading ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-[#414844] animate-pulse">
                          Synchronizing with Liquidity Gateway...
                        </td>
                      </tr>
                    ) : !payoutRequests || payoutRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-[#414844]">
                          No payout requests recorded in ledger.
                        </td>
                      </tr>
                    ) : (
                      payoutRequests.map((p: any) => (
                        <tr key={p._id} className="hover:bg-[#fcf9f8]/50 group transition-all">
                          <td className="p-6">
                            <span className="font-mono text-xs font-bold uppercase">#PAY-{p._id.substring(0,8).toUpperCase()}</span>
                            <span className="block text-[8px] text-[#414844] font-bold uppercase mt-1 opacity-60">
                              {p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A'}
                            </span>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#1b1c1c]">User Account</span>
                              <span className="text-[9px] font-mono text-[#414844]">{p.userId}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <span className="text-sm font-bold text-[#1b1c1c]">{p.recipientPhone || p.momoNumber || 'N/A'}</span>
                            <span className="block text-[8px] text-[#414844] font-bold uppercase mt-1 opacity-60">MTN MoMo Gateway</span>
                          </td>
                          <td className="p-6">
                            <span className="text-sm font-black text-[#ff6b00]">{p.amount?.toLocaleString()} RWF</span>
                          </td>
                          <td className="p-6">
                            <span className={`w-fit px-2.5 py-1 text-[8px] font-black uppercase tracking-widest border rounded-full ${
                              p.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                              p.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                            }`}>
                              {p.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            {p.status === 'pending' || p.status === 'processing' ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRejectPayout(p._id)}
                                  className="rounded-md border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-red-700 transition"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprovePayout(p._id)}
                                  className="rounded-md border border-green-200 bg-[#ff6b00] hover:bg-[#e05300] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white transition"
                                >
                                  Approve & Pay
                                </button>
                              </div>
                            ) : (
                              <span className="text-[9px] font-black text-[#414844] uppercase tracking-widest opacity-40">Processed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
    </Layout>
  );
}

export default function AdminDashboardPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#fdfaf7] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
      </div>
    }>
      <AdminDashboardContent />
    </React.Suspense>
  );
}
