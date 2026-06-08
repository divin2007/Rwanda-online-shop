'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { productApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Search, Filter, RefreshCw, ShoppingBag, Grid, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  { label: 'All Products', value: 'all' },
  { label: 'Made in Rwanda', value: 'Made in Rwanda' },
  { label: 'Groceries & Produce', value: 'grocery' },
  { label: 'Food & Beverage', value: 'food' },
  { label: 'Fashion & Apparel', value: 'fashion' },
  { label: 'Shoes & Footwear', value: 'shoes' },
  { label: 'Sportswear & Fitness', value: 'sportswear' },
  { label: 'Bakery & Patisserie', value: 'bakery' },
  { label: 'Hardware & Materials', value: 'hardware' },
  { label: 'Handicrafts & Art', value: 'handicrafts' },
  { label: 'Home & Furnishings', value: 'home' },
  { label: 'Electronics & Tech', value: 'electronics' },
  { label: 'Cosmetics & Care', value: 'cosmetics' },
  { label: 'Automotive & Moto', value: 'automotive' },
  { label: 'Stationery & Books', value: 'education' },
  { label: 'Agriculture & Farming', value: 'agriculture' },
  { label: 'Services', value: 'services' },
  { label: 'Events & Rentals', value: 'events' },
  { label: 'Real Estate', value: 'property' },
  { label: 'Pets & Animal Care', value: 'pets' },
  { label: 'Solar & Clean Water', value: 'solar-energy' },
  { label: 'Office & Business', value: 'office-business' },
  { label: 'Finance & Insurance', value: 'finance' },
  { label: 'Other Goods', value: 'other' },
];

export default function ProductsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [products, setProducts] = useState<any[]>([]);
  const [categoryFilters, setCategoryFilters] = useState(CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    productApi.get('/products/catalog/categories')
      .then((res) => {
        if (!isMounted) return;
        const categoryList = res.data?.data || res.data || [];
        const rootCategories = Array.isArray(categoryList)
          ? categoryList.filter((category: any) => category.isActive !== false && !category.parentId)
          : [];

        if (rootCategories.length > 0) {
          setCategoryFilters([
            CATEGORIES[0],
            CATEGORIES[1],
            ...rootCategories.map((category: any) => ({
              label: category.label,
              value: category.id,
            })),
          ]);
        }
      })
      .catch((err) => {
        console.warn('[ProductsPage] Catalog category fallback in use:', err?.message || err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Core fetch function
  const fetchProducts = async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const currentSkip = reset ? 0 : skip;
    const params = new URLSearchParams({
      limit: '24',
      skip: String(currentSkip),
      isActive: 'true',
    });

    if (debouncedSearchQuery.trim()) {
      params.set('search', debouncedSearchQuery.trim());
    }
    
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'Made in Rwanda') {
        params.set('isMadeInRwanda', 'true');
      } else {
        params.set('categoryId', selectedCategory);
      }
    }

    try {
      const res = await productApi.get(`/products/recommendations/for-me?${params.toString()}`);
      const fetched = res.data?.data || res.data || [];
      
      setProducts((prev) => {
        const next = reset ? fetched : [...prev, ...fetched];
        const unique = next.filter((item: any, idx: number, self: any[]) => 
          self.findIndex((p: any) => p._id === item._id) === idx
        );
        return unique;
      });
      
      setHasMore(fetched.length === 24);
      setSkip(currentSkip + fetched.length);
    } catch (err) {
      console.error('[ProductsPage] Fetch error:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Reset page when filters or search change
  useEffect(() => {
    setSkip(0);
    setProducts([]);
    setHasMore(true);
    fetchProducts(true);
  }, [selectedCategory, debouncedSearchQuery]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingRef.current) {
          fetchProducts(false);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, skip]);

  return (
    <Layout>
      <div className="min-h-screen bg-[#fdfaf7] text-text-primary selection:bg-primary selection:text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10">
          
          <section className="animate-reveal relative mb-8 overflow-hidden rounded-lg border border-[#e2bfb0] bg-[#1b1c1c] p-8 md:p-12">
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative z-10 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-sm bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#a04100]">
                <Sparkles size={13} className="text-[#ff6b00]" />
                Personalized Marketplace
              </div>
              <h1 className="text-3xl font-black tracking-normal text-white md:text-4xl lg:text-5xl">
                Explore <span className="text-primary">All Products</span>
              </h1>
              <p className="mt-4 text-base font-medium leading-relaxed text-white/70 lg:text-lg">
                Discover local agricultural goods, traditional handicrafts, kitenge apparel, and seasonal groceries curated specifically for your tastes and interests.
              </p>
            </div>
          </section>

          {/* Filtering and Search Section */}
          <section className="animate-reveal [animation-delay:100ms] mb-8 grid gap-4 rounded-lg border border-[#e2bfb0] bg-white p-5 md:grid-cols-[1fr_auto]">
            
            {/* Search Input Box */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b938d]" size={18} />
              <input
                type="text"
                placeholder="Search catalog products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full rounded border border-[#e2bfb0] bg-white pl-12 pr-4 text-sm font-medium outline-none transition placeholder:text-[#8e7164] focus:border-primary focus:ring-2 focus:ring-[#ffedd5]"
              />
            </div>

            {/* Filter Info / Reset Action */}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded border border-[#ebdcd0] bg-[#f5f3f3] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#574e47]">
                <Filter size={13} className="text-primary" />
                {products.length} Products Loaded
              </span>
              {(searchQuery || selectedCategory !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="inline-flex h-12 items-center gap-2 rounded border border-[#a04100] px-4 text-sm font-bold text-[#a04100] transition hover:bg-[#ffedd5]"
                >
                  <RefreshCw size={15} />
                  Clear Filters
                </button>
              )}
            </div>
          </section>

          {/* Category selector */}
          <section className="animate-reveal [animation-delay:150ms] mb-10">
            <div className="grid max-h-40 w-full grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {categoryFilters.map((cat) => {
                const isActive = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`inline-flex min-h-9 w-full items-center justify-center rounded border px-2 py-2 text-center font-mono text-[9px] font-bold uppercase leading-tight transition-colors ${
                      isActive
                        ? 'border-primary bg-primary text-white'
                        : 'border-[#e2bfb0] bg-white text-text-secondary hover:border-primary hover:text-primary hover:bg-[#ffedd5]'
                    }`}
                  >
                    {cat.value === 'Made in Rwanda' && (
                      <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Dynamic recommendation alert details */}
          {user && selectedCategory === 'all' && !debouncedSearchQuery && (
            <div className="animate-reveal [animation-delay:200ms] mb-6 flex items-center gap-3 rounded-lg border border-[#e2bfb0] bg-[#ffedd5]/35 p-4 text-[#7c3a00]">
              <Sparkles className="text-primary shrink-0 animate-bounce" size={20} />
              <p className="text-sm font-bold leading-relaxed">
                Tuned by your recommendation profile. Your preferred categories, browsing interests, and verified stores are prioritized at the top of the feed.
              </p>
            </div>
          )}

          {/* Product Grid Catalog */}
          <section className="animate-reveal [animation-delay:250ms]">
            {products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-[#e2bfb0] bg-white p-16 text-center">
                <AlertCircle className="text-primary/40 mb-4" size={48} />
                <h3 className="text-xl font-bold text-text-primary">No products match your criteria</h3>
                <p className="mt-2 text-sm text-text-muted max-w-sm">
                  Try checking your spelling, choosing a different category, or expanding your query options.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark"
                >
                  View All Products
                </button>
              </div>
            ) : null}

            {/* Shimmering Skeleton Loader for next page */}
            {loading && (
              <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col overflow-hidden rounded-lg border border-[#e2bfb0] bg-white p-4 animate-pulse">
                    <div className="aspect-[4/3] rounded bg-[#f0eded]" />
                    <div className="mt-4 h-4 w-1/3 rounded bg-[#f0eded]" />
                    <div className="mt-2 h-6 w-3/4 rounded bg-[#f0eded]" />
                    <div className="mt-4 h-8 w-full rounded bg-[#f0eded]" />
                  </div>
                ))}
              </div>
            )}

            {/* Sentinel element for infinite scroll */}
            <div ref={sentinelRef} className="h-20" />
            
            {/* End of results message */}
            {!hasMore && products.length > 0 && (
              <div className="mt-8 text-center text-sm font-bold text-text-muted border-t border-border-light/40 pt-8">
                You've reached the end of our Rwandan catalog!
              </div>
            )}
          </section>
          
        </div>
      </div>
    </Layout>
  );
}
