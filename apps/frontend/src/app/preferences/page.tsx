'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Check, MapPin, Sparkles } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { marketApi, productApi, userApi } from '@/lib/api';

type Category = { id: string; label: string; aliases?: string[]; isActive?: boolean; parentId?: string | null };
type Market = { _id: string; name: string; imageUrl?: string; location?: { district?: string; address?: string } };

export default function PreferencesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [markets, setMarkets] = React.useState<Market[]>([]);
  const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
  const [marketIds, setMarketIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, router, user]);

  React.useEffect(() => {
    if (!user) return;
    Promise.all([
      productApi.get('/products/catalog/categories'),
      marketApi.get('/markets?activeOnly=true'),
      userApi.get('/users/preferences/discovery').catch(() => null),
    ]).then(([categoryRes, marketRes, preferenceRes]) => {
      const categoryList = Array.isArray(categoryRes.data?.data) ? categoryRes.data.data : [];
      const marketList = Array.isArray(marketRes.data?.data) ? marketRes.data.data : [];
      const prefs = preferenceRes?.data?.data || {};
      setCategories(categoryList.filter((category: Category) => category.isActive !== false && !category.parentId));
      setMarkets(marketList);
      setCategoryIds(Array.isArray(prefs.categoryIds) ? prefs.categoryIds : []);
      setMarketIds(Array.isArray(prefs.marketIds) ? prefs.marketIds.map(String) : []);
    }).catch(() => {
      toast.error('Could not load preference choices');
    }).finally(() => setLoading(false));
  }, [user]);

  const toggle = (value: string, list: string[], setter: (next: string[]) => void, max = 12) => {
    if (list.includes(value)) setter(list.filter(item => item !== value));
    else setter([...list, value].slice(0, max));
  };

  const save = async () => {
    if (!categoryIds.length && !marketIds.length) {
      toast.error('Choose at least one category or market.');
      return;
    }
    setSaving(true);
    try {
      await userApi.put('/users/preferences/discovery', { categoryIds, marketIds });
      toast.success('Recommendations tuned');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <main className="w-full p-6 md:p-8 space-y-lg animate-reveal">
        {/* Banner with brand hero-glow */}
        <section className="relative overflow-hidden rounded-lg border border-outline-variant bg-[#1b1c1b] p-md text-white shadow-md custom-shadow">
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent z-10"></div>
          <div className="absolute inset-0 hero-glow pointer-events-none z-10"></div>
          
          <div className="relative z-20 space-y-xs">
            <p className="flex items-center gap-xs text-[10px] font-black uppercase tracking-wider text-primary-container">
              <Sparkles size={14} className="animate-pulse" /> Recommendation Setup
            </p>
            <h1 className="max-w-xl font-display-lg text-headline-lg text-white leading-tight">
              Personalize your RMF discovery catalog.
            </h1>
            <p className="max-w-xl text-xs text-white/80 leading-relaxed font-body-md">
              Pick a few categories and public markets now. As you view products, watch seller videos, and add items to your cart, our system tunes recommendations automatically.
            </p>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-md md:grid-cols-3">
            {[0, 1, 2].map(item => <div key={item} className="h-28 animate-pulse rounded-lg bg-surface-container-low" />)}
          </div>
        ) : (
          <>
            {/* Step 1: Categories selector */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
              <div className="flex items-end justify-between gap-sm border-b border-outline-variant pb-sm mb-md">
                <div>
                  <p className="font-label-caps text-[10px] text-primary uppercase tracking-wider">Step 1</p>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Choose Product Categories</h2>
                </div>
                <span className="font-data-mono text-[10px] text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/60">{categoryIds.length} Selected</span>
              </div>
              
              <div className="grid gap-xs sm:grid-cols-2 lg:grid-cols-4">
                {categories.map(category => {
                  const active = categoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggle(category.id, categoryIds, setCategoryIds)}
                      className={`flex min-h-[4.5rem] items-start justify-between rounded border p-md text-left transition-all ${
                        active 
                          ? 'border-primary-container bg-primary/5 shadow-sm' 
                          : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-xs font-black text-on-surface ${active ? 'text-primary' : ''}`}>{category.label}</span>
                        <span className="mt-xs line-clamp-1 block font-data-mono-sm text-[9px] text-on-surface-variant uppercase">{category.aliases?.slice(0, 3).join(', ') || 'RMF Catalog'}</span>
                      </span>
                      {active && <Check size={14} className="text-primary-container shrink-0 mt-0.5 ml-xs" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 2: Markets selector */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow">
              <div className="flex items-end justify-between gap-sm border-b border-outline-variant pb-sm mb-md">
                <div>
                  <p className="font-label-caps text-[10px] text-primary uppercase tracking-wider">Step 2</p>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Choose Favorite Markets</h2>
                </div>
                <span className="font-data-mono text-[10px] text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/60">{marketIds.length} Selected</span>
              </div>
              
              <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
                {markets.map(market => {
                  const active = marketIds.includes(market._id);
                  return (
                    <button
                      key={market._id}
                      type="button"
                      onClick={() => toggle(market._id, marketIds, setMarketIds, 8)}
                      className={`overflow-hidden rounded border text-left transition-all ${
                        active 
                          ? 'border-primary-container bg-primary/5 shadow-sm scale-[0.99]' 
                          : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                      }`}
                    >
                      <div className="relative h-24 bg-surface-container-low">
                        {market.imageUrl ? <img src={market.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                        {active && <div className="absolute right-2 top-2 rounded-full bg-primary-container p-1 text-white shadow"><Check size={12} /></div>}
                      </div>
                      <div className="p-md">
                        <p className={`font-bold text-xs text-on-surface ${active ? 'text-primary' : ''}`}>{market.name}</p>
                        <p className="mt-xs flex items-center gap-xs font-data-mono-sm text-[9px] text-on-surface-variant">
                          <MapPin size={11} /> {market.location?.district || market.location?.address || 'Rwanda'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bottom sticky action row */}
            <div className="sticky bottom-4 rounded-lg border border-outline-variant bg-surface-container-lowest/90 p-md shadow-lg backdrop-blur">
              <button 
                type="button"
                onClick={save} 
                disabled={saving} 
                className="flex min-h-[2.75rem] w-full items-center justify-center rounded bg-primary-container px-4 text-xs font-black uppercase tracking-widest text-white hover:bg-primary transition-all duration-300 shadow active:scale-[0.99] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Recommendation Profile'}
              </button>
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}
