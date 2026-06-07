'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface PriceIndexRecord {
  categoryId: string;
  categoryLabel: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  trend: 'RISING' | 'STABLE' | 'FALLING';
  week: string;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'RISING') return <TrendingUp size={14} className="text-red-600" />;
  if (trend === 'FALLING') return <TrendingDown size={14} className="text-emerald-600" />;
  return <Minus size={14} className="text-gray-400" />;
};

/**
 * Market Price Index widget (Feature 10). Reads the most recent published week's
 * records. Optionally filtered by market.
 */
export const PriceIndexWidget = ({ marketId, title = 'Market Price Index' }: { marketId?: string; title?: string }) => {
  const [week, setWeek] = useState<string | null>(null);
  const [records, setRecords] = useState<PriceIndexRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    adminApi
      .get('/price-index/latest', { params: marketId ? { marketId } : {} })
      .then((res) => {
        if (!active) return;
        setWeek(res.data?.data?.week || null);
        setRecords(Array.isArray(res.data?.data?.records) ? res.data.data.records : []);
      })
      .catch(() => {
        if (active) setRecords([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [marketId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md animate-pulse h-40" />
    );
  }
  if (!records.length) return null;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
      <div className="flex items-center justify-between mb-sm">
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface">{title}</h3>
        {week && <span className="font-label-caps text-[10px] text-on-surface-variant">Week of {week}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="py-2 font-label-caps text-[10px] text-on-surface-variant uppercase">Category</th>
              <th className="py-2 font-label-caps text-[10px] text-on-surface-variant uppercase text-right">Avg Price (RWF)</th>
              <th className="py-2 font-label-caps text-[10px] text-on-surface-variant uppercase text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.categoryId} className="border-b border-outline-variant/40">
                <td className="py-2 font-body-md text-[13px] text-on-surface">{r.categoryLabel || r.categoryId}</td>
                <td className="py-2 font-data-mono text-[13px] text-on-surface text-right">{formatCurrency(r.avgPrice)}</td>
                <td className="py-2 text-center">
                  <span className="inline-flex justify-center"><TrendIcon trend={r.trend} /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PriceIndexWidget;
