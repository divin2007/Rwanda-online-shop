'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { adminApi, sellerApi, orderApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('analytics');

  const { data: analytics, execute: fetchAnalytics } = useApi(adminApi, 'get', '/admin/analytics');
  const { data: fraudAlerts, execute: fetchFraud } = useApi(adminApi, 'get', '/admin/fraud-alerts');
  const { data: pendingSellers, execute: fetchSellers } = useApi(sellerApi, 'get', '/sellers?isApproved=false');
  const { data: disputes, execute: fetchDisputes } = useApi(orderApi, 'get', '/orders?isDisputed=true&dispute.resolvedAt=null');

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'fraud') fetchFraud();
    if (activeTab === 'sellers') fetchSellers();
    if (activeTab === 'disputes') fetchDisputes();
  }, [activeTab, fetchAnalytics, fetchFraud, fetchSellers, fetchDisputes]);

  const approveSeller = async (id: string) => {
    try {
      await sellerApi.patch(`/sellers/${id}/approve`);
      toast.success('Seller approved');
      fetchSellers();
    } catch (e) {
      toast.error('Failed to approve seller');
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

  return (
    <Layout>
      <div className="flex flex-col md:flex-row min-h-screen bg-background-main">
        <aside className="w-full md:w-64 bg-background-card border-r border-border p-6 hidden md:block">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-xl text-primary">Platform Admin</h2>
          </div>
          <nav className="space-y-2">
            {[
              { id: 'analytics', label: 'Analytics & Revenue' },
              { id: 'sellers', label: 'Seller Approvals' },
              { id: 'disputes', label: 'Disputes & Refunds' },
              { id: 'fraud', label: 'Fraud Alerts' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2 font-medium rounded-lg ${activeTab === tab.id ? 'bg-primary/10 text-primary font-bold' : 'text-text-secondary hover:bg-background-surface hover:text-text-primary'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-8 capitalize">{activeTab.replace('-', ' ')}</h1>

          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <p className="text-sm text-text-secondary">Monthly GMV</p>
                  <p className="text-2xl font-bold">{analytics?.gmv?.toLocaleString() || 0} RWF</p>
                </Card>
                <Card>
                  <p className="text-sm text-text-secondary">Company Revenue</p>
                  <p className="text-2xl font-bold text-primary">{analytics?.revenue?.toLocaleString() || 0} RWF</p>
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
                    <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No pending approvals.</td></tr>
                  ) : (
                    pendingSellers.map((s: any) => (
                      <tr key={s._id}>
                        <td className="p-4">
                          <p className="font-bold">{s.shopDetails?.name || s.marketId}</p>
                          <p className="text-sm text-text-secondary">{s.sellerName}</p>
                        </td>
                        <td className="p-4">{s.marketId ? 'Public Market' : 'Independent'}</td>
                        <td className="p-4 text-sm">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                          <Button size="sm" variant="outline" className="mr-2">View Docs</Button>
                          <Button size="sm" onClick={() => approveSeller(s._id)}>Approve</Button>
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
                          <td className="p-4 font-bold">{d.total} RWF</td>
                          <td className="p-4 text-sm text-text-secondary">{d.dispute?.reason || 'Undelivered'}</td>
                          <td className="p-4 text-right">
                            <Button size="sm" onClick={() => resolveDispute(d._id, d.total)}>
                              {d.total <= 10000 ? 'Instant Refund' : 'Resolve Manually'}
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
                        <td className="p-4"><span className="bg-status-error text-white px-2 py-1 rounded text-xs">{f.ruleCode}</span></td>
                        <td className="p-4 text-sm font-mono">{f.transactionId}</td>
                        <td className="p-4 text-sm">{f.reason}</td>
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
