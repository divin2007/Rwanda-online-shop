'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { deliveryApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { MapPin, Package, CheckCircle2 } from 'lucide-react';

const DELIVERY_SOCKET_URL = process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008';

export default function ErrandTrackingPage({ params }: { params: Promise<{ errandId: string }> }) {
  const { errandId } = React.use(params);
  const [errand, setErrand] = useState<any>(null);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);

  const { data: locationData, emit, isConnected } = useSocket<any>(DELIVERY_SOCKET_URL, 'errand:location');
  const { data: completedData } = useSocket<any>(DELIVERY_SOCKET_URL, 'errand:completed');

  useEffect(() => {
    deliveryApi.get(`/errands/${errandId}`).then((res) => setErrand(res.data?.data)).catch(() => {});
  }, [errandId]);

  useEffect(() => {
    if (isConnected) emit('join:errand', errandId);
  }, [isConnected, errandId, emit]);

  useEffect(() => {
    if (locationData?.lat) setRiderPos({ lat: locationData.lat, lng: locationData.lng });
  }, [locationData]);

  useEffect(() => {
    if (completedData) {
      setErrand((prev: any) => (prev ? { ...prev, status: 'completed' } : prev));
    }
  }, [completedData]);

  if (!errand) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">Loading errand…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Errand Tracking</h1>
        <p className="mb-6 text-sm capitalize text-gray-500">Status: <strong>{errand.status?.replace('_', ' ')}</strong></p>

        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 text-[#e05300]" size={18} />
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Task</p>
              <p className="text-sm text-gray-900">{errand.description}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 text-emerald-600" size={18} />
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Pickup</p>
              <p className="text-sm text-gray-900">{errand.pickupLocation?.address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 text-red-600" size={18} />
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Drop-off</p>
              <p className="text-sm text-gray-900">{errand.dropLocation?.address || '—'}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-900">Agreed fee: <strong>{(errand.agreedFee || errand.budget || 0).toLocaleString()} RWF</strong></p>
            {riderPos && (
              <p className="mt-1 text-xs text-gray-500">Rider location: {riderPos.lat.toFixed(4)}, {riderPos.lng.toFixed(4)}</p>
            )}
          </div>
          {errand.status === 'completed' && (
            <div className="flex items-center gap-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> Errand completed.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
