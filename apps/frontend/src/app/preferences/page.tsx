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
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl bg-[#e05300] p-8 text-white shadow-xl md:p-10">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#ffedd5]">
            <Sparkles size={16} /> Recommendation setup
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
            Tell RMF what you want to see more often.
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/80">
            Pick a few categories and markets now. As you view products, save items, watch seller videos, and add to cart, RMF keeps learning from those signals.
          </p>
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[#fff0e4]" />)}
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-[#eaded4] bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6b00]">Step 1</p>
                  <h2 className="mt-1 text-2xl font-black text-[#1b1c1c]">Choose product categories</h2>
                </div>
                <span className="text-xs font-black uppercase text-[#63736a]">{categoryIds.length} selected</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {categories.map(category => {
                  const active = categoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggle(category.id, categoryIds, setCategoryIds)}
                      className={`flex min-h-20 items-start justify-between rounded-xl border p-4 text-left transition ${active ? 'border-[#ff6b00] bg-[#fff7ed]' : 'border-[#eaded4] bg-white hover:border-[#ff6b00]/50'}`}
                    >
                      <span>
                        <span className="block text-sm font-black text-[#1b1c1c]">{category.label}</span>
                        <span className="mt-1 line-clamp-1 block text-xs font-semibold text-[#63736a]">{category.aliases?.slice(0, 3).join(', ') || 'Live RMF catalog'}</span>
                      </span>
                      {active ? <Check size={17} className="text-[#ff6b00]" /> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#eaded4] bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6b00]">Step 2</p>
                  <h2 className="mt-1 text-2xl font-black text-[#1b1c1c]">Choose favorite markets</h2>
                </div>
                <span className="text-xs font-black uppercase text-[#63736a]">{marketIds.length} selected</span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {markets.map(market => {
                  const active = marketIds.includes(market._id);
                  return (
                    <button
                      key={market._id}
                      type="button"
                      onClick={() => toggle(market._id, marketIds, setMarketIds, 8)}
                      className={`overflow-hidden rounded-2xl border text-left transition ${active ? 'border-[#ff6b00] bg-[#fff7ed]' : 'border-[#eaded4] bg-white hover:border-[#ff6b00]/50'}`}
                    >
                      <div className="relative h-32 bg-[#fff7ed]">
                        {market.imageUrl ? <img src={market.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                        {active ? <div className="absolute right-3 top-3 rounded-full bg-[#ff6b00] p-2 text-white"><Check size={15} /></div> : null}
                      </div>
                      <div className="p-4">
                        <p className="font-black text-[#1b1c1c]">{market.name}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#63736a]">
                          <MapPin size={13} /> {market.location?.district || market.location?.address || 'Rwanda'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="sticky bottom-4 rounded-2xl border border-[#eaded4] bg-white/95 p-4 shadow-2xl backdrop-blur">
              <button onClick={save} disabled={saving} className="min-h-12 w-full rounded-xl bg-[#ff6b00] px-5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Save recommendation profile'}
              </button>
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}
