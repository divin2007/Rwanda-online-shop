'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { riderApi } from '@/lib/api';
import { Bike, MapPin, Star, ShieldCheck } from 'lucide-react';

const isPremiumActive = (rider: any) =>
  rider?.plan === 'premium' && (!rider?.premiumUntil || new Date(rider.premiumUntil) > new Date());

export default function RidersPage() {
  const { data: riders, loading } = useApi<any[]>(riderApi, 'get', '/riders?isApproved=true');

  const visibleRiders = useMemo(() => {
    const rows = Array.isArray(riders) ? riders : [];
    return rows
      .filter((rider: any) => rider.deletedAt == null)
      .sort((a: any, b: any) => {
        const premiumDelta = Number(isPremiumActive(b)) - Number(isPremiumActive(a));
        if (premiumDelta !== 0) return premiumDelta;
        return Number(b.rating || 0) - Number(a.rating || 0);
      });
  }, [riders]);

  return (
    <Layout>
      <main className="min-h-screen bg-[#fdfaf7] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-4 border-b border-[#ebdcd0] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6b00]">Rider network</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#1b1c1c]">Choose a rider</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#574e47]">
                Review approved riders before requesting a goods pickup or premium person pickup.
              </p>
            </div>
            <Link
              href="/errands/new?type=person_pickup"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#e05300] px-5 text-xs font-black uppercase tracking-widest text-white hover:bg-[#ff6b00]"
            >
              Request pickup
            </Link>
          </div>

          {loading && visibleRiders.length === 0 ? (
            <div className="rounded-lg border border-[#ebdcd0] bg-white p-12 text-center text-sm font-semibold text-[#574e47]">
              Loading approved riders...
            </div>
          ) : visibleRiders.length === 0 ? (
            <div className="rounded-lg border border-[#ebdcd0] bg-white p-12 text-center">
              <Bike className="mx-auto mb-3 text-[#80756c]" size={40} />
              <p className="font-bold text-[#1b1c1c]">No approved riders are visible yet.</p>
              <p className="mt-1 text-sm text-[#574e47]">When riders are approved by admin, they will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleRiders.map((rider: any) => {
                const premium = isPremiumActive(rider);
                const rating = Number(rider.rating || 0);
                const reviews = Number(rider.totalReviewCount || rider.totalDeliveries || 0);
                return (
                  <article key={rider._id} className="rounded-lg border border-[#ebdcd0] bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#ffedd5] text-[#e05300]">
                          <Bike size={22} />
                        </span>
                        <div>
                          <h2 className="font-black text-[#1b1c1c]">Rider {String(rider.plateNumber || '').slice(-4) || String(rider._id).slice(-4)}</h2>
                          <p className="mt-0.5 text-xs font-semibold text-[#574e47]">{rider.plateNumber || 'Plate pending'}</p>
                        </div>
                      </div>
                      {premium && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#ffb86b] bg-[#fff7ed] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#a63b00]">
                          <ShieldCheck size={12} />
                          Premium
                        </span>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-md bg-[#f7faf8] p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#80756c]">Rating</p>
                        <p className="mt-1 flex items-center justify-center gap-1 font-black text-[#1b1c1c]">
                          <Star size={13} className="fill-[#f59e0b] text-[#f59e0b]" />
                          {rating ? rating.toFixed(1) : 'New'}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7faf8] p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#80756c]">Reviews</p>
                        <p className="mt-1 font-black text-[#1b1c1c]">{reviews}</p>
                      </div>
                      <div className="rounded-md bg-[#f7faf8] p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#80756c]">Reliability</p>
                        <p className="mt-1 font-black text-[#1b1c1c]">{Math.round(Number(rider.reliabilityScore ?? 1) * 100)}%</p>
                      </div>
                    </div>

                    {rider.currentLocation?.lat && rider.currentLocation?.lng && (
                      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#574e47]">
                        <MapPin size={14} className="text-[#ff6b00]" />
                        Last active near {Number(rider.currentLocation.lat).toFixed(3)}, {Number(rider.currentLocation.lng).toFixed(3)}
                      </p>
                    )}

                    <Link
                      href={`/errands/new?type=${premium ? 'person_pickup' : 'goods_pickup'}&rider=${rider._id}`}
                      className="mt-5 inline-flex w-full min-h-10 items-center justify-center rounded-md border border-[#ff6b00] text-xs font-black uppercase tracking-widest text-[#ff6b00] hover:bg-[#fff7ed]"
                    >
                      {premium ? 'Request premium pickup' : 'Request goods pickup'}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}
