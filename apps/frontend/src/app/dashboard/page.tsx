import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const MOCK_ORDERS = [
  { id: 'ORD-9982', date: 'Oct 24, 2024', total: 12500, status: 'Delivered', market: 'Kimironko Market', items: 4 },
  { id: 'ORD-9945', date: 'Oct 20, 2024', total: 8200, status: 'Delivered', market: 'Nyabugogo Market', items: 2 },
  { id: 'ORD-9812', date: 'Oct 12, 2024', total: 24000, status: 'Cancelled', market: 'Batsinda Market', items: 6 },
];

export default function BuyerDashboard() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-10 px-4">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <Card className="sticky top-24" noPadding>
              <div className="p-6 border-b border-border bg-primary/5 rounded-t-xl">
                <div className="w-16 h-16 bg-primary text-secondary rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                  JD
                </div>
                <h2 className="font-heading font-bold text-xl text-text-primary">John Doe</h2>
                <p className="text-text-secondary text-sm">john.doe@example.com</p>
                <p className="text-text-secondary text-sm mt-1">+250 788 123 456</p>
              </div>
              <nav className="p-2 flex flex-col">
                <Link href="/dashboard" className="px-4 py-3 bg-primary/10 text-primary font-bold rounded-lg transition-colors">
                  Order History
                </Link>
                <Link href="/dashboard/settings" className="px-4 py-3 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg transition-colors">
                  Account Settings
                </Link>
                <Link href="/dashboard/addresses" className="px-4 py-3 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg transition-colors">
                  Saved Addresses
                </Link>
                <Link href="/help" className="px-4 py-3 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg transition-colors">
                  Help & Support
                </Link>
                <div className="mt-4 pt-4 border-t border-border">
                  <button className="w-full text-left px-4 py-3 text-status-error hover:bg-status-error/10 font-medium rounded-lg transition-colors">
                    Log Out
                  </button>
                </div>
              </nav>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-grow space-y-6">
            <div>
              <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Order History</h1>
              <p className="text-text-secondary">Track your recent purchases and manage past orders.</p>
            </div>

            {/* Active Order Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg animate-bounce">
                  🛵
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 text-lg">Order Out for Delivery!</h3>
                  <p className="text-blue-700">ORD-10042 • Kimironko Market</p>
                  <p className="text-sm text-blue-600 mt-1">Rider is 5 minutes away.</p>
                </div>
              </div>
              <Button variant="primary">Track Order</Button>
            </div>

            {/* Past Orders List */}
            <Card noPadding>
              <div className="divide-y divide-border">
                {MOCK_ORDERS.map((order) => (
                  <div key={order.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-background-surface transition-colors">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-lg">{order.id}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          order.status === 'Delivered' ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary mb-2">{order.date} • {order.market}</p>
                      <p className="text-sm font-medium">{order.items} items • <span className="font-bold text-primary">{order.total.toLocaleString()} RWF</span></p>
                    </div>
                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none">View Details</Button>
                      <Button variant="primary" size="sm" className="flex-1 sm:flex-none text-xs">Reorder</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </Layout>
  );
}
