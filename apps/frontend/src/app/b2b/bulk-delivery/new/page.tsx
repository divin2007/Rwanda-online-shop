'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { deliveryApi } from '@/lib/api';

interface Dropoff { address: string; lat: string; lng: string; contactName: string; contactPhone: string }

export default function NewBulkDeliveryPage() {
  const router = useRouter();
  const [marketId, setMarketId] = useState('');
  const [pickupStart, setPickupStart] = useState('');
  const [pickupEnd, setPickupEnd] = useState('');
  const [dropoffs, setDropoffs] = useState<Dropoff[]>([{ address: '', lat: '', lng: '', contactName: '', contactPhone: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const update = (i: number, key: keyof Dropoff, value: string) =>
    setDropoffs((prev) => prev.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)));

  const estimatedFee = 1000 + dropoffs.length * 500;

  const submit = async () => {
    const valid = dropoffs.filter((d) => d.address && d.lat && d.lng);
    if (valid.length === 0) return toast.error('Add at least one dropoff point with coordinates');
    setSubmitting(true);
    try {
      await deliveryApi.post('/bulk-deliveries', {
        marketId: marketId.trim() || undefined,
        scheduledPickupWindow: pickupStart ? { start: new Date(pickupStart), end: pickupEnd ? new Date(pickupEnd) : undefined } : undefined,
        dropoffPoints: valid.map((d) => ({
          address: d.address,
          coordinates: { lat: Number(d.lat), lng: Number(d.lng) },
          contactName: d.contactName,
          contactPhone: d.contactPhone,
        })),
      });
      toast.success('Bulk delivery scheduled');
      router.push('/b2b/dashboard');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to schedule bulk delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Schedule Bulk Delivery</h1>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <input placeholder="Market ID (pickup market)" value={marketId} onChange={(e) => setMarketId(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Pickup From</label>
              <input type="datetime-local" value={pickupStart} onChange={(e) => setPickupStart(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Pickup Until</label>
              <input type="datetime-local" value={pickupEnd} onChange={(e) => setPickupEnd(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500">Drop-off Points</p>
            {dropoffs.map((d, i) => (
              <div key={i} className="rounded border border-gray-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">Stop {i + 1}</span>
                  <button onClick={() => setDropoffs((p) => p.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={14} /></button>
                </div>
                <input placeholder="Address" value={d.address} onChange={(e) => update(i, 'address', e.target.value)} className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Lat" value={d.lat} onChange={(e) => update(i, 'lat', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  <input type="number" placeholder="Lng" value={d.lng} onChange={(e) => update(i, 'lng', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  <input placeholder="Contact name" value={d.contactName} onChange={(e) => update(i, 'contactName', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  <input placeholder="Contact phone" value={d.contactPhone} onChange={(e) => update(i, 'contactPhone', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
            ))}
            <button onClick={() => setDropoffs((p) => [...p, { address: '', lat: '', lng: '', contactName: '', contactPhone: '' }])} className="flex items-center gap-1 text-xs font-bold text-[#e05300]">
              <Plus size={12} /> Add drop-off
            </button>
          </div>

          <p className="rounded bg-[#FFF3E6] px-3 py-2 text-sm text-[#7A3E00]">Estimated fee: <strong>{estimatedFee.toLocaleString()} RWF</strong></p>
          <button onClick={submit} disabled={submitting} className="w-full rounded bg-[#e05300] py-2.5 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50">
            {submitting ? 'Scheduling…' : 'Schedule Bulk Delivery'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
