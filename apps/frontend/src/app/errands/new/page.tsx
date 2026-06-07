'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { deliveryApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const MapPinPicker = dynamic(() => import('@/components/ui/MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });

export default function NewErrandPage() {
  return (
    <Suspense fallback={<Layout><div className="p-12 text-center text-sm text-gray-500">Loading errand form...</div></Layout>}>
      <NewErrandPageContent />
    </Suspense>
  );
}

function NewErrandPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [form, setForm] = useState({
    description: '',
    errandType: 'goods_pickup',
    paymentMethod: 'platform',
    pickupAddress: '',
    pickupLat: '',
    pickupLng: '',
    dropAddress: '',
    dropLat: '',
    dropLng: '',
    budget: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'person_pickup' || type === 'goods_pickup') {
      setForm(prev => ({ ...prev, errandType: type }));
    }
  }, [searchParams]);

  const distanceKm = (() => {
    const a = { lat: Number(form.pickupLat), lng: Number(form.pickupLng) };
    const b = { lat: Number(form.dropLat), lng: Number(form.dropLng) };
    if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  })();

  const estimatedFee = distanceKm != null ? Math.max(1, Math.ceil(distanceKm / 5)) * 500 : null;

  const submit = async () => {
    if (!user) return toast.error('Please log in to request an errand');
    if (!form.description.trim()) return toast.error('Describe the errand');
    if (!form.pickupLat || !form.dropLat) return toast.error('Enter pickup and drop coordinates');
    setSubmitting(true);
    try {
      const res = await deliveryApi.post('/errands', {
        description: form.description.trim(),
        pickupLocation: {
          address: form.pickupAddress,
          coordinates: { lat: Number(form.pickupLat), lng: Number(form.pickupLng) },
        },
        dropLocation: {
          address: form.dropAddress,
          coordinates: { lat: Number(form.dropLat), lng: Number(form.dropLng) },
        },
        budget: form.budget ? Number(form.budget) : undefined,
        errandType: form.errandType,
        paymentMethod: form.paymentMethod,
      });
      const errand = res.data?.data;
      toast.success('Errand posted. Finding an eligible rider...');
      router.push(`/errands/${errand._id}/tracking`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create errand');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Request an Errand</h1>
        <p className="mb-6 text-sm text-gray-500">Hire a rider for goods delivery or a premium rider pickup.</p>

        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Request Type</label>
              <select
                value={form.errandType}
                onChange={(e) => setForm({ ...form, errandType: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="goods_pickup">Goods pickup</option>
                <option value="person_pickup">Person pickup - premium riders only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Payment</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="platform">Pay through RMF</option>
                <option value="external">Pay rider directly by mobile money</option>
              </select>
            </div>
          </div>
          {form.errandType === 'person_pickup' && (
            <p className="rounded bg-[#f7faf8] px-3 py-2 text-sm text-[#405046]">
              Person pickup requests are broadcast only to approved riders with an active premium plan.
            </p>
          )}
          {form.paymentMethod === 'external' && (
            <p className="rounded bg-[#fff8e6] px-3 py-2 text-sm text-[#7A3E00]">
              Direct mobile-money payment is recorded as external. RMF will not collect payment or credit the rider wallet for this errand.
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Pick up documents from KN 5 Ave and deliver to Kimironko"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Pickup pin</p>
              <div className="h-72 overflow-hidden rounded-lg border border-gray-200">
                <MapPinPicker
                  selectedLocation={
                    form.pickupLat && form.pickupLng
                      ? { lat: Number(form.pickupLat), lng: Number(form.pickupLng) }
                      : null
                  }
                  onLocationSelected={(coords) => setForm(prev => ({
                    ...prev,
                    pickupLat: String(coords.lat),
                    pickupLng: String(coords.lng),
                    pickupAddress: prev.pickupAddress || 'Pinned pickup location',
                  }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Dropoff pin</p>
              <div className="h-72 overflow-hidden rounded-lg border border-gray-200">
                <MapPinPicker
                  selectedLocation={
                    form.dropLat && form.dropLng
                      ? { lat: Number(form.dropLat), lng: Number(form.dropLng) }
                      : null
                  }
                  onLocationSelected={(coords) => setForm(prev => ({
                    ...prev,
                    dropLat: String(coords.lat),
                    dropLng: String(coords.lng),
                    dropAddress: prev.dropAddress || 'Pinned dropoff location',
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Pickup Address', 'pickupAddress')}
            {field('Drop Address', 'dropAddress')}
            {field('Pickup Lat', 'pickupLat', 'number')}
            {field('Pickup Lng', 'pickupLng', 'number')}
            {field('Drop Lat', 'dropLat', 'number')}
            {field('Drop Lng', 'dropLng', 'number')}
          </div>
          {field('Budget (RWF, optional)', 'budget', 'number', estimatedFee ? `Suggested: ${estimatedFee}` : '')}

          {estimatedFee != null && (
            <p className="rounded bg-[#FFF3E6] px-3 py-2 text-sm text-[#7A3E00]">
              Estimated fee: <strong>{estimatedFee.toLocaleString()} RWF</strong> ({distanceKm?.toFixed(1)} km)
            </p>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded bg-[#e05300] py-2.5 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post Errand'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
