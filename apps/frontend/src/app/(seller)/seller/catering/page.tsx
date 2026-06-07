'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { orderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function SellerCateringPage() {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    orderApi.get('/catering/briefs', { params: { status: 'open' } })
      .then((r) => setBriefs(r.data?.data || []))
      .catch(() => setBriefs([]))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Catering Opportunities</h1>
        <p className="mb-6 text-sm text-gray-500">Open briefs from institutions. Submit a bid to win a recurring contract.</p>

        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        ) : briefs.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No open catering briefs right now.</p>
        ) : (
          <div className="space-y-3">
            {briefs.map((b) => (
              <Link key={b._id} href={`/catering/${b._id}`} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-[#e05300]">
                <p className="text-sm font-bold text-gray-900">{b.title}</p>
                <p className="mt-1 text-xs text-gray-500">{b.mealsPerWeek} meals/week · budget {(b.budgetPerMeal || 0).toLocaleString()} RWF/meal</p>
                <p className="mt-1 text-xs text-gray-400">Submit bid →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
