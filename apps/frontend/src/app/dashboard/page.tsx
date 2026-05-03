'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi } from '@/lib/api';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { data: orders, loading, execute: fetchOrders } = useApi(orderApi, 'get', `/orders?buyerId=${user?.id}`);

  useEffect(() => {
    if (user?.id) fetchOrders();
  }, [user?.id, fetchOrders]);

  const activeOrder = orders?.find((o: any) => ['placed', 'confirmed', 'assigned', 'in_transit'].includes(o.status));

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-10 px-4">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <Card className="sticky top-24" noPadding>
              <div className="p-6 border-b border-border bg-primary/5 rounded-t-xl">
                <div className="w-16 h-16 bg-primary text-secondary rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                  {user?.fullName?.substring(0, 2).toUpperCase() || '👤'}
                </div>
                <h2 className="font-heading font-bold text-xl text-text-primary">{user?.fullName || 'My Account'}</h2>
                <p className="text-text-secondary text-sm">{user?.email}</p>
                <p className="text-text-secondary text-sm mt-1">{user?.role?.toUpperCase()}</p>
              </div>
              <nav className="p-2 flex flex-col">
                <Link href="/dashboard" className="px-4 py-3 bg-primary/10 text-primary font-bold rounded-lg transition-colors">
                  Order History
                </Link>
                <Link href="/dashboard/settings" className="px-4 py-3 text-text-secondary hover:bg-background-surface hover:text-text-primary font-medium rounded-lg transition-colors">
                  Account Settings
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
            {activeOrder && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg animate-bounce">
                    🛵
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg">Order Status: {activeOrder.status.toUpperCase()}</h3>
                    <p className="text-blue-700">Order ID: #{activeOrder._id.substring(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-blue-600 mt-1">Our rider is currently processing your request.</p>
                  </div>
                </div>
                <Link href={`/orders/${activeOrder._id}/tracking`}>
                  <Button variant="primary">Track Order</Button>
                </Link>
              </div>
            )}

            {/* Past Orders List */}
            {loading ? (
               <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
            ) : !orders || orders.length === 0 ? (
               <Card className="text-center py-20">
                  <p className="text-text-secondary mb-4">You haven't placed any orders yet.</p>
                  <Link href="/markets"><Button>Go Shopping</Button></Link>
               </Card>
            ) : (
              <Card noPadding>
                <div className="divide-y divide-border">
                  {orders.map((order: any) => (
                    <div key={order._id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-background-surface transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-lg">#{order._id.substring(0, 8).toUpperCase()}</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            order.status === 'delivered' ? 'bg-status-success/10 text-status-success' : 
                            order.status === 'cancelled' ? 'bg-status-error/10 text-status-error' : 
                            'bg-status-warning/10 text-status-warning'
                          }`}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary mb-2">{new Date(order.createdAt).toLocaleDateString()} • {order.paymentMethod?.replace('_', ' ')}</p>
                        <p className="text-sm font-medium">Quantity: {order.quantity} • <span className="font-bold text-primary">{order.totalAmount?.toLocaleString()} RWF</span></p>
                      </div>
                      <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                        <Link href={`/orders/${order._id}/tracking`} className="flex-1 sm:flex-none">
                           <Button variant="outline" size="sm" className="w-full">View Details</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}
