'use client';
import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Mock data based on Analytics section 12.6
const MOCK_METRICS = {
  salesToday: 45000,
  ordersToday: 12,
  avgPrepTime: '18 mins',
  rating: 4.8,
  pendingOrders: 3,
};

const MOCK_ORDERS = [
  { id: 'ORD-1234', buyer: 'Mugisha K.', items: 2, total: 8500, status: 'placed', time: '10:45 AM' },
  { id: 'ORD-1235', buyer: 'Alice U.', items: 1, total: 1500, status: 'confirmed', time: '10:50 AM' },
  { id: 'ORD-1236', buyer: 'Jean B.', items: 5, total: 12500, status: 'placed', time: '11:05 AM' },
];

export default function SellerDashboard() {
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'promotions'>('orders');

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Seller Dashboard</h1>
          <p className="text-text-secondary">Stall: KIM-047 (Kimironko Market)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Print QR Code</Button>
          <Button variant="primary">Add Product</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-primary/5 border-primary/20">
          <p className="text-text-secondary text-sm font-medium">Sales Today</p>
          <p className="text-2xl font-bold text-text-primary">{MOCK_METRICS.salesToday.toLocaleString()} RWF</p>
        </Card>
        <Card>
          <p className="text-text-secondary text-sm font-medium">Pending Orders</p>
          <p className="text-2xl font-bold text-status-warning">{MOCK_METRICS.pendingOrders}</p>
        </Card>
        <Card>
          <p className="text-text-secondary text-sm font-medium">Avg Prep Time</p>
          <p className="text-2xl font-bold text-text-primary">{MOCK_METRICS.avgPrepTime}</p>
        </Card>
        <Card>
          <p className="text-text-secondary text-sm font-medium">Customer Rating</p>
          <div className="flex items-center gap-1">
            <p className="text-2xl font-bold text-text-primary">{MOCK_METRICS.rating}</p>
            <span className="text-[#F8C811]">★</span>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8">
          {['orders', 'inventory', 'promotions'].map((tab) => (
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

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'orders' && (
          <Card noPadding>
            <div className="px-6 py-4 border-b border-border bg-background-surface">
              <h3 className="font-heading font-bold text-lg text-text-primary">Active Orders</h3>
            </div>
            <div className="divide-y divide-border">
              {MOCK_ORDERS.map(order => (
                <div key={order.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-text-primary">{order.id}</span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-sm ${
                        order.status === 'placed' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-info/20 text-status-info'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {order.items} items • {order.total} RWF • Ordered at {order.time}
                    </p>
                    <p className="text-sm font-medium mt-1 text-text-primary">Buyer: {order.buyer}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'placed' && (
                      <Button size="sm" variant="primary">Confirm Order</Button>
                    )}
                    {order.status === 'confirmed' && (
                      <div className="text-sm text-status-info font-medium flex items-center gap-2">
                        <span className="animate-pulse">Waiting for Rider pickup</span>
                        <div className="w-8 h-8 rounded border-2 border-dashed border-status-info flex items-center justify-center">
                          QR
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {activeTab === 'inventory' && (
          <Card>
            <div className="text-center py-12 text-text-secondary">
              Inventory management interface goes here.
            </div>
          </Card>
        )}

        {activeTab === 'promotions' && (
          <Card>
            <div className="text-center py-12 text-text-secondary">
              Promotions management interface goes here.
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
