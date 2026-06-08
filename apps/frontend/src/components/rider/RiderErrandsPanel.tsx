'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin, Package } from 'lucide-react';
import { deliveryApi } from '@/lib/api';

/**
 * Rider Errands panel (Feature 4): lists nearby open errands and lets the rider accept,
 * advance status, and stream completion.
 */
export const RiderErrandsPanel = () => {
  const [errands, setErrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.get('/errands');
      setErrands(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setErrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const accept = async (id: string) => {
    try {
      await deliveryApi.patch(`/errands/${id}/accept`, {});
      toast.success('Errand accepted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not accept errand');
    }
  };

  const advance = async (id: string, status: string) => {
    try {
      await deliveryApi.patch(`/errands/${id}/status`, { status });
      toast.success(`Errand ${status.replace('_', ' ')}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not update errand');
    }
  };

  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#1b1c1c]">Nearby Errands</h3>
        <button onClick={load} className="text-xs font-bold text-[#e05300]">Refresh</button>
      </div>
      {loading ? (
        <div className="h-20 animate-pulse rounded bg-gray-100" />
      ) : errands.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No open errands nearby.</p>
      ) : (
        <ul className="space-y-3">
          {errands.map((e) => (
            <li key={e._id} className="rounded border border-gray-100 p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Package size={14} className="text-[#e05300]" /> {e.description}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={12} /> {e.pickupLocation?.address || 'Pickup'} → {e.dropLocation?.address || 'Drop'}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#e05300]">{(e.agreedFee || e.budget || 0).toLocaleString()} RWF</span>
                {e.status === 'open' ? (
                  <button onClick={() => accept(e._id)} className="rounded bg-[#e05300] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#c44800]">Accept</button>
                ) : e.status === 'accepted' ? (
                  <button onClick={() => advance(e._id, 'in_progress')} className="rounded border border-[#e05300] px-3 py-1.5 text-xs font-bold text-[#e05300]">Start</button>
                ) : e.status === 'in_progress' ? (
                  <button onClick={() => advance(e._id, 'completed')} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Complete</button>
                ) : (
                  <span className="text-xs capitalize text-gray-400">{e.status}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RiderErrandsPanel;
