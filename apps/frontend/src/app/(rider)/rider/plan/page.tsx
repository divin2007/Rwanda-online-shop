'use client';

import React, { useState } from 'react';
import { riderApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Layout } from '@/components/layout/Layout';
import toast from 'react-hot-toast';
import { Check, Crown, Zap, Users, TrendingUp } from 'lucide-react';

const PREMIUM_BENEFITS = [
  { icon: Users, label: 'Accept person-pickup requests', desc: 'Premium-only ride/escort errands.' },
  { icon: Zap, label: 'Priority dispatch', desc: 'Get matched to nearby orders first.' },
  { icon: TrendingUp, label: 'Higher split when top-rated', desc: 'Up to 93% of the delivery fee.' },
];

export default function RiderPlanPage() {
  const { data: rider, loading, execute: refetch } = useApi<any>(riderApi, 'get', '/riders/me');
  const [upgrading, setUpgrading] = useState(false);

  const plan = rider?.plan === 'premium' ? 'premium' : 'standard';
  const premiumUntil = rider?.premiumUntil ? new Date(rider.premiumUntil) : null;
  const isActivePremium = plan === 'premium' && (!premiumUntil || premiumUntil > new Date());

  const upgrade = async () => {
    setUpgrading(true);
    try {
      await riderApi.patch('/riders/me/plan', { plan: 'premium' });
      toast.success('You are now on the Premium plan.');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to upgrade. Make sure your rider account is approved.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Layout>
      <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-3 border-b border-outline-variant pb-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container/15 text-primary-container">
            <Crown size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Rider Plan</h1>
            <p className="text-sm text-on-surface-variant">Upgrade to Premium to unlock person pickups and priority dispatch.</p>
          </div>
        </div>

        {loading && !rider ? (
          <div className="py-16 text-center text-on-surface-variant">Loading your plan…</div>
        ) : (
          <>
            <div className={`rounded-xl border p-5 ${isActivePremium ? 'border-primary-container/40 bg-primary-container/5' : 'border-outline-variant bg-surface-container-low'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant">Current plan</p>
                  <p className="text-xl font-bold text-on-surface flex items-center gap-2">
                    {isActivePremium ? <Crown size={18} className="text-primary-container" /> : null}
                    {isActivePremium ? 'Premium' : 'Standard'}
                  </p>
                  {isActivePremium && premiumUntil && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Renews / expires on {premiumUntil.toLocaleDateString()}
                    </p>
                  )}
                </div>
                {!isActivePremium && (
                  <button
                    type="button"
                    onClick={upgrade}
                    disabled={upgrading}
                    className="rounded-lg bg-primary-container px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary disabled:opacity-50"
                  >
                    {upgrading ? 'Upgrading…' : 'Upgrade to Premium'}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
              <p className="font-semibold text-on-surface">Premium benefits</p>
              <ul className="space-y-3">
                {PREMIUM_BENEFITS.map((b) => (
                  <li key={b.label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                      <b.icon size={15} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
                        {isActivePremium && <Check size={14} className="text-primary-container" />}
                        {b.label}
                      </p>
                      <p className="text-xs text-on-surface-variant">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="pt-2 text-[11px] text-on-surface-variant border-t border-outline-variant">
                Premium is granted for 30 days. Subscription billing is coming soon.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
