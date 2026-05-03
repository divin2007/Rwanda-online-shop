'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { marketApi } from '@/lib/api';

const CATEGORY_ICONS: Record<string, string> = {
  'public': '🥬',
  'individual': '🏠',
  'supermarket': '🛒'
};

const CATEGORY_COLORS: Record<string, string> = {
  'public': 'bg-green-100 text-green-800',
  'individual': 'bg-blue-100 text-blue-800',
  'supermarket': 'bg-purple-100 text-purple-800'
};

export default function MarketsPage() {
  const { data: markets, loading, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets?activeOnly=false');

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-10 px-4">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-heading font-bold text-text-primary mb-4 text-gradient">Explore Rwanda's Markets</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Browse through vibrant public markets and verified independent shops. Direct from source to your door.
          </p>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div className="relative w-full max-w-md">
            <input 
              type="text" 
              placeholder="Search markets (e.g. Kimironko)..." 
              className="w-full pl-10 pr-4 py-3 rounded-full border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            <span className="absolute left-4 top-3.5 text-text-muted">🔍</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : !markets || markets.length === 0 ? (
          <div className="text-center py-20 bg-background-surface rounded-2xl border-2 border-dashed border-border">
            <p className="text-text-secondary text-lg">No markets found yet. Be the first to join!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market: any) => (
              <Link href={`/market/${market.slug}`} key={market._id} className="group">
                <div className="bg-background-card border border-border rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-xl hover:border-primary/50 flex flex-col hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${CATEGORY_COLORS[market.type] || 'bg-gray-100'}`}>
                      {CATEGORY_ICONS[market.type] || '🛒'}
                    </div>
                    <span className="bg-background-surface border border-border text-text-secondary text-xs px-3 py-1 rounded-full font-medium">
                      {market.totalSellers || 0} Vendors
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">{market.name}</h3>
                  <p className="text-text-secondary flex-grow mb-6 line-clamp-2">
                    {market.description || `Verified ${market.type} marketplace in ${market.location?.city || 'Rwanda'}.`}
                  </p>
                  <div className="w-full bg-primary/10 text-primary font-bold text-center py-3 rounded-xl group-hover:bg-primary group-hover:text-text-inverse transition-all duration-300">
                    Explore Market
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
