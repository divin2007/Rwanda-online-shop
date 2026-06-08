'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { orderApi } from '@/lib/api';
import { GroupBuyCard } from '@/components/ui/GroupBuyCard';

export default function GroupBuysPage() {
  const [groupBuys, setGroupBuys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApi
      .get('/group-buys', { params: { status: 'open' } })
      .then((res) => setGroupBuys(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setGroupBuys([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Group Buys</h1>
          <p className="mt-1 text-sm text-gray-500">Team up with other buyers to unlock bulk discounts.</p>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : groupBuys.length === 0 ? (
          <p className="py-16 text-center text-gray-500">No active group buys right now. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {groupBuys.map((gb) => (
              <GroupBuyCard key={gb._id} groupBuy={gb} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
