'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { sellerApi } from '@/lib/api';
import { SellerTierBadge } from '@/components/ui/SellerTierBadge';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';

interface TierData {
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  tierCalculatedAt: string | null;
  tierMetrics: { disputeRate: number; avgRating: number; totalOrders: number };
  nextTierRequirements: { tier: string; ordersNeeded: number; ratingNeeded: number; maxDisputeRate: number } | null;
}

interface FreshnessData {
  isCheckedIn: boolean;
  checkedInAt: string | null;
  expiresAt: string | null;
  confirmedByRider?: boolean;
}

/**
 * Seller dashboard panels for Features 11 (tier), 12 (freshness check-in) and 9 (export settings).
 * Self-contained: fetches its own data so the dashboard page edit stays minimal.
 */
export const SellerDashboardPanels = ({ sellerId }: { sellerId?: string }) => {
  const [tier, setTier] = useState<TierData | null>(null);
  const [freshness, setFreshness] = useState<FreshnessData | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [exportMinQty, setExportMinQty] = useState('');
  const [savingExport, setSavingExport] = useState(false);
  const [affiliateApps, setAffiliateApps] = useState<any[]>([]);

  const loadAll = async () => {
    try {
      const [tierRes, meRes] = await Promise.all([
        sellerApi.get('/sellers/me/tier').catch(() => null),
        sellerApi.get('/sellers/me').catch(() => null),
      ]);
      if (tierRes?.data?.data) setTier(tierRes.data.data);
      const me = meRes?.data?.data;
      if (me) {
        setExportReady(Boolean(me.exportReady));
        setExportMinQty(me.exportMinimumOrderQty ? String(me.exportMinimumOrderQty) : '');
        if (me._id) {
          const fr = await sellerApi.get(`/sellers/${me._id}/freshness`).catch(() => null);
          if (fr?.data?.data) setFreshness(fr.data.data);
        }
      }
      const apps = await sellerApi.get('/sellers/affiliates/applications', { params: { status: 'pending' } }).catch(() => null);
      if (Array.isArray(apps?.data?.data)) setAffiliateApps(apps.data.data);
    } catch {
      /* non-blocking */
    }
  };

  const reviewApplication = async (id: string, action: 'approve' | 'reject') => {
    try {
      await sellerApi.patch(`/sellers/affiliates/applications/${id}/${action}`, {});
      toast.success(`Application ${action === 'approve' ? 'approved' : 'rejected'}`);
      setAffiliateApps((prev) => prev.filter((a) => a._id !== id));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Action failed');
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await sellerApi.post('/seller/freshness-checkin', {});
      if (res?.data?.data) setFreshness({ ...res.data.data });
      toast.success('Checked in for today — buyers can see your stall is fresh and open.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSaveExport = async () => {
    setSavingExport(true);
    try {
      await sellerApi.patch('/seller/me/export-settings', {
        exportReady,
        exportMinimumOrderQty: exportMinQty ? Number(exportMinQty) : undefined,
      });
      toast.success('Export settings saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save export settings');
    } finally {
      setSavingExport(false);
    }
  };

  // Show the freshness CTA prominently in the morning window (5am–10am local).
  const hour = new Date().getHours();
  const isMorningWindow = hour >= 5 && hour < 10;
  const isCheckedIn = Boolean(freshness?.isCheckedIn);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-lg">
      {/* Freshness check-in (Feature 12) */}
      <div className={`rounded-lg border p-md shadow-sm ${isMorningWindow && !isCheckedIn ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest'}`}>
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-sm">Daily Freshness</p>
        {isCheckedIn ? (
          <FreshnessBadge isCheckedIn checkedInAt={freshness?.checkedInAt} confirmedByRider={freshness?.confirmedByRider} />
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="w-full rounded bg-primary-container text-on-primary font-label-caps text-label-caps py-sm px-md hover:bg-primary transition-colors disabled:opacity-50"
          >
            {checkingIn ? 'Checking in…' : 'Check in for today'}
          </button>
        )}
        <p className="font-body-md text-[11px] text-on-surface-variant mt-sm">
          Check in each morning so buyers know your produce is fresh and your stall is open.
        </p>
      </div>

      {/* Certification tier (Feature 11) */}
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-sm">Certification Tier</p>
        <div className="flex items-center gap-sm mb-sm">
          <SellerTierBadge tier={tier?.tier || 'BRONZE'} size="md" />
        </div>
        {tier?.nextTierRequirements ? (
          <p className="font-body-md text-[11px] text-on-surface-variant">
            To reach <strong>{tier.nextTierRequirements.tier}</strong>:{' '}
            {tier.nextTierRequirements.ordersNeeded > 0
              ? `${tier.nextTierRequirements.ordersNeeded} more delivered orders, `
              : ''}
            rating ≥ {tier.nextTierRequirements.ratingNeeded}, disputes ≤ {(tier.nextTierRequirements.maxDisputeRate * 100).toFixed(0)}%.
          </p>
        ) : (
          <p className="font-body-md text-[11px] text-on-surface-variant">You are at the highest tier. Keep it up!</p>
        )}
      </div>

      {/* Export settings (Feature 9) */}
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-sm">Export Settings</p>
        <label className="flex items-center gap-sm cursor-pointer mb-sm">
          <input type="checkbox" checked={exportReady} onChange={(e) => setExportReady(e.target.checked)} />
          <span className="font-body-md text-[12px] text-on-surface">Available for export buyers</span>
        </label>
        <input
          type="number"
          min="1"
          placeholder="Min. export order qty"
          value={exportMinQty}
          onChange={(e) => setExportMinQty(e.target.value)}
          className="w-full rounded border border-outline-variant bg-transparent px-2 py-1.5 text-[12px] mb-sm"
        />
        <button
          onClick={handleSaveExport}
          disabled={savingExport}
          className="w-full rounded border border-outline font-label-caps text-label-caps py-sm px-md hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          {savingExport ? 'Saving…' : 'Save export settings'}
        </button>
      </div>

      {/* Affiliate applications (Feature 3, seller side) */}
      {affiliateApps.length > 0 && (
        <div className="md:col-span-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-sm">Affiliate Applications</p>
          <ul className="divide-y divide-outline-variant/40">
            {affiliateApps.map((app) => (
              <li key={app._id} className="flex items-center justify-between gap-3 py-sm">
                <div className="min-w-0">
                  <p className="font-body-md text-[13px] text-on-surface">Product: {String(app.productId).slice(-8)}</p>
                  <p className="text-[11px] text-on-surface-variant">Proposed rate: {app.proposedCommissionRate ?? 5}%</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewApplication(app._id, 'approve')} className="rounded bg-primary-container text-on-primary px-3 py-1.5 text-[11px] font-bold hover:bg-primary">Approve</button>
                  <button onClick={() => reviewApplication(app._id, 'reject')} className="rounded border border-outline px-3 py-1.5 text-[11px] font-bold hover:bg-surface-container">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SellerDashboardPanels;
