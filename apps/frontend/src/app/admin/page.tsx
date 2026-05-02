'use client';
import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Mock data from Admin Service Analytics
const MOCK_ANALYTICS = {
  monthlyGMV: 1540000,
  monthlyCommission: 45000,
  activeSellers: 142,
  activeRiders: 45,
};

const MOCK_DISPUTES = [
  { id: 'ORD-5544', buyer: 'Sarah K.', amount: 4500, reason: 'Wrong item delivered', status: 'active' },
  { id: 'ORD-5582', buyer: 'Mike R.', amount: 15000, reason: 'Items damaged', status: 'active' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'approvals' | 'disputes'>('analytics');

  return (
    <Layout marketName="RMF Admin Panel">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">System Administrator</h1>
        <p className="text-text-secondary">Overview and control center</p>
      </div>

      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8">
          {['analytics', 'approvals', 'disputes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <p className="text-text-secondary text-sm font-medium">Monthly GMV</p>
              <p className="text-2xl font-bold text-text-primary">{MOCK_ANALYTICS.monthlyGMV.toLocaleString()} RWF</p>
            </Card>
            <Card className="bg-status-success/5 border-status-success/20">
              <p className="text-text-secondary text-sm font-medium">Company Revenue (1.5%)</p>
              <p className="text-2xl font-bold text-status-success">{MOCK_ANALYTICS.monthlyCommission.toLocaleString()} RWF</p>
            </Card>
            <Card>
              <p className="text-text-secondary text-sm font-medium">Active Sellers</p>
              <p className="text-2xl font-bold text-text-primary">{MOCK_ANALYTICS.activeSellers}</p>
            </Card>
            <Card>
              <p className="text-text-secondary text-sm font-medium">Active Riders</p>
              <p className="text-2xl font-bold text-text-primary">{MOCK_ANALYTICS.activeRiders}</p>
            </Card>
          </div>

          {/* Fraud Alerts Box */}
          <Card className="border-status-error/30 bg-status-error/5">
            <h3 className="font-bold text-status-error mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Security / Fraud Alerts
            </h3>
            <p className="text-sm text-text-primary mb-4">The system has flagged 1 suspicious transaction requiring review.</p>
            <div className="bg-white p-3 rounded border border-border flex justify-between items-center">
              <div>
                <p className="font-bold">ORD-9921</p>
                <p className="text-xs text-status-error font-medium">F002: Delivery coordinates > 50km from market</p>
              </div>
              <Button size="sm" variant="outline">Review</Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'approvals' && (
        <Card>
          <div className="text-center py-12 text-text-secondary">
            Pending Market & Seller approvals queue.
          </div>
        </Card>
      )}

      {activeTab === 'disputes' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
            <h3 className="font-bold text-blue-800">Buyer Protection Reserve Fund</h3>
            <p className="text-sm text-blue-600 mb-2">Fund Balance: 42,500 RWF (1% of all delivery commissions)</p>
            <p className="text-xs text-blue-800">Disputes under 10,000 RWF can be instantly refunded from this pool.</p>
          </div>

          {MOCK_DISPUTES.map(dispute => (
            <Card key={dispute.id} className="flex justify-between items-center">
              <div>
                <div className="flex gap-2 items-center mb-1">
                  <h3 className="font-bold text-lg">{dispute.id}</h3>
                  <span className="bg-status-error/10 text-status-error text-xs px-2 py-0.5 rounded font-bold">
                    {dispute.amount.toLocaleString()} RWF
                  </span>
                  {dispute.amount <= 10000 && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">
                      Eligible for Instant Refund
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">Buyer: {dispute.buyer} • Reason: {dispute.reason}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Review Evidence</Button>
                {dispute.amount <= 10000 ? (
                  <Button variant="primary" size="sm" onClick={() => alert('Processing instant refund from Reserve Fund...')}>
                    Instant Refund
                  </Button>
                ) : (
                  <Button variant="primary" size="sm">Resolve Manually</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
