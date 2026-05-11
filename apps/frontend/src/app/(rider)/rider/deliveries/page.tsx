'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { deliveryApi, riderApi } from '@/lib/api';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function RiderDeliveriesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: deliveries, loading, execute: fetchDeliveries } = useApi(deliveryApi, 'get', `/deliveries/rider/${user?.id}`);
  const { data: profile } = useApi(riderApi, 'get', `/riders/me?userId=${user?.id}`);

  useEffect(() => {
    if (user?.id) fetchDeliveries();
  }, [user?.id, fetchDeliveries]);

  return (
    <Layout>
      <div className="space-y-8 animate-reveal">
        <div className="flex justify-between items-end border-b-2 border-amber-500 pb-6">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Logistics Station</p>
            <h1 className="text-4xl font-heading font-bold text-gray-900">My Deliveries</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-700">{profile?.plateNumber || 'No Vehicle'}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Plate ID</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-2xl"></div>)}
          </div>
        ) : !deliveries || deliveries.length === 0 ? (
          <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <span className="text-6xl mb-4 block">📦</span>
            <h2 className="text-xl font-bold text-gray-900">No active deliveries</h2>
            <p className="text-gray-500 mt-2">Go to Live Tasks to find new delivery mandates.</p>
            <Link href="/rider/dashboard" className="mt-6 inline-block bg-amber-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-amber-600 transition-colors">
              Find Tasks
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deliveries.map((delivery: any) => (
              <Card key={delivery._id} className="hover:border-amber-500 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    delivery.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {delivery.status.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <div className="flex gap-4 items-start mb-6">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">📦</div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Delivery #{delivery._id.substring(0, 8).toUpperCase()}</h3>
                    <p className="text-xs text-gray-500">{new Date(delivery.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    <p className="text-sm text-gray-700 font-medium truncate">{delivery.pickupAddress}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <p className="text-sm text-gray-700 font-medium truncate">{delivery.deliveryAddress}</p>
                  </div>
                </div>

                <Link 
                  href={`/orders/${delivery.orderId}/tracking`} 
                  className="block w-full text-center py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
                >
                  View Details
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
