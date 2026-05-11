'use client';
import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi, reviewApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

// Simple Fuzzy Search Logic (Dice's Coefficient + Substring)
const getSimilarity = (s1: string, s2: string): number => {
  const n1 = s1.toLowerCase().trim();
  const n2 = s2.toLowerCase().trim();
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) return 0.7;
  
  const getBigrams = (str: string) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(n1);
  const b2 = getBigrams(n2);
  if (b1.size === 0 || b2.size === 0) return 0;
  
  let intersection = 0;
  for (const b of b1) {
    if (b2.has(b)) intersection++;
  }
  return (2 * intersection) / (b1.size + b2.size);
};

export default function MarketPage({ params }: { params: { slug: string } }) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isFullMap, setIsFullMap] = useState(false);
  
  // Real Data Hooks
  const { data: market, loading: marketLoading, execute: fetchMarket } = useApi(marketApi, 'get', `/markets/slug/${params.slug}`);
  const { data: marketReviewsData } = useApi(reviewApi, 'get', market?._id ? `/reviews/target/market/${market._id}` : null);
  
  // Full Catalog for filtering
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarket();
  }, [params.slug, fetchMarket]);

  useEffect(() => {
    if (market?._id) {
      setLoading(true);
      // Fetch all products for this market to allow smart client-side filtering/fuzzy
      Promise.all([
        productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&limit=1000`),
        productApi.get(`/products?marketId=${market._id}&isActive=true&hasPromotion=true`)
      ]).then(([prodRes, promRes]) => {
        setAllProducts(prodRes.data?.data || []);
        setPromotions(promRes.data?.data || []);
      }).finally(() => setLoading(false));
    }
  }, [market?._id]);

  // Exhaustive Categories list from the full catalog
  const categories = useMemo(() => {
    const cats = new Set(allProducts.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(cats)].sort();
  }, [allProducts]);

  // Pattern Analysis & Fuzzy Filtering
  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      // 1. Category Filter
      if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;

      // 2. Price Range Filter
      const price = product.price;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;

      // 3. Smart Pattern Search (Fuzzy)
      if (searchQuery.trim()) {
        const nameSimilarity = getSimilarity(product.name, searchQuery);
        const categorySimilarity = product.category ? getSimilarity(product.category, searchQuery) : 0;
        const descriptionSimilarity = product.description ? getSimilarity(product.description, searchQuery) : 0;
        
        // Threshold for "correctness" even with typos
        const threshold = 0.35; 
        return (nameSimilarity > threshold || categorySimilarity > threshold || descriptionSimilarity > 0.5);
      }

      return true;
    });
  }, [allProducts, selectedCategory, searchQuery, minPrice, maxPrice]);

  const marketReviews = marketReviewsData || [];

  if (marketLoading) return <Layout><div className="rmf-container py-40 text-center font-serif text-3xl italic animate-pulse">{t('accessing_market_hub')}...</div></Layout>;
  if (!market) return <Layout><div className="rmf-container py-40 text-center font-serif text-3xl">{t('market_not_found')}</div></Layout>;

  return (
    <Layout>
      <div className="space-y-32 pb-40 animate-reveal">
        {/* Elite Market Hub Header */}
        <div className="relative h-[65vh] overflow-hidden border-2 border-[#121212] group">
          <img src={market.imageUrl || ''} className="w-full h-full object-cover grayscale transition-transform duration-[10000ms] group-hover:scale-110 group-hover:grayscale-0" alt={market.name} />
          <div className="absolute inset-0 bg-[#121212]/60 backdrop-blur-sm flex flex-col justify-center px-24">
            <div className="max-w-4xl">
              <div className="flex items-center gap-6 mb-12">
                 <div className="w-16 h-px bg-[#A34D15]"></div>
                 <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.6em]">{t('verified_facilitation_hub')}</p>
              </div>
              <h1 className="text-[120px] font-serif text-white leading-[0.85] tracking-tighter italic mb-12">{market.name}</h1>
              <p className="text-2xl text-white/60 font-light italic leading-relaxed max-w-2xl border-l-2 border-white/20 pl-12">
                {market.description || t('markets_subtitle')}
              </p>
            </div>
          </div>
          
          {/* Tactical Hub Status */}
          <div className="absolute bottom-16 right-24 hidden lg:flex flex-col items-end">
             <div className="flex items-center gap-4 mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Hub Active</span>
             </div>
             <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.8em]">Deployment ID: {market._id.substring(0,8).toUpperCase()}</p>
          </div>
        </div>

        {/* Tactical Overview: Logistics Map */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 items-center">
           <div className="lg:col-span-1 space-y-10">
              <div className="w-20 h-20 bg-[#121212] text-white flex items-center justify-center text-3xl shadow-2xl relative overflow-hidden group/icon">
                 <div className="absolute inset-0 bg-[#A34D15] translate-y-full group-hover/icon:translate-y-0 transition-transform"></div>
                 <span className="relative z-10">🏍️</span>
              </div>
              <div>
                <h3 className="text-3xl font-serif text-[#121212] italic tracking-tighter leading-none mb-4">{t('live_fleet_deployment')}</h3>
                <p className="text-sm text-[#6B665E] font-light italic leading-relaxed">
                  Real-time synchronization with active RMF facilitators within the regional hub network.
                </p>
              </div>
              <button 
                onClick={() => setIsFullMap(true)}
                className="rmf-btn-outline w-full py-4 text-[9px] border-[#121212]/10 hover:border-[#121212]"
              >
                {t('expand_logistics_view')}
              </button>
           </div>
           
           <div className="lg:col-span-3 h-[400px] border-2 border-[#121212] grayscale hover:grayscale-0 transition-all duration-1000 shadow-2xl">
              <RiderMap 
                marketId={market._id} 
                centerLat={market.location?.coordinates[1]} 
                centerLng={market.location?.coordinates[0]} 
                marketName={market.name}
              />
           </div>
        </div>

        {/* Discovery Workstation */}
        <div className="flex flex-col lg:flex-row gap-24">
          {/* Sidebar: Tactical Filters */}
          <aside className="w-full lg:w-80 space-y-20">
            <div className="space-y-10">
              <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.4em] border-b-2 border-[#121212] pb-6 italic">Discovery Matrix</p>
              
              <div className="space-y-8">
                 <div className="space-y-3">
                   <label className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest opacity-50">Authorized Search</label>
                   <input 
                     type="text" 
                     placeholder={t('search_collection')}
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="rmf-input w-full px-6 py-4 border-2 border-[#E5E1D8] focus:border-[#121212] bg-white text-[11px] font-black uppercase tracking-widest"
                   />
                 </div>

                 <div className="space-y-3">
                   <label className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest opacity-50">Valuation Range</label>
                   <div className="grid grid-cols-2 gap-4">
                     <input 
                       type="number" 
                       placeholder="Min RWF" 
                       value={minPrice}
                       onChange={e => setMinPrice(e.target.value)}
                       className="rmf-input w-full px-4 py-4 border-2 border-[#E5E1D8] focus:border-[#121212] bg-white text-[10px] font-black uppercase"
                     />
                     <input 
                       type="number" 
                       placeholder="Max RWF" 
                       value={maxPrice}
                       onChange={e => setMaxPrice(e.target.value)}
                       className="rmf-input w-full px-4 py-4 border-2 border-[#E5E1D8] focus:border-[#121212] bg-white text-[10px] font-black uppercase"
                     />
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="space-y-10">
              <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.4em] border-b-2 border-[#121212] pb-6 italic">Categories</p>
              <nav className="flex flex-col gap-6">
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-left text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center gap-4 group ${
                      selectedCategory === cat 
                        ? 'text-[#A34D15] translate-x-4' 
                        : 'text-[#6B665E] hover:text-[#121212] hover:translate-x-2'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full border border-current transition-all ${selectedCategory === cat ? 'bg-[#A34D15] scale-125' : 'bg-transparent'}`}></div>
                    {cat === 'all' ? t('all_artifacts') : cat}
                  </button>
                ))}
              </nav>
            </div>
            
            {/* Trust Certificate */}
            <div className="p-10 border-2 border-[#F0EDE4] bg-white space-y-6">
               <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-[0.4em]">Trust Protocol</p>
               <p className="text-[10px] text-[#6B665E] leading-relaxed italic">All acquisitions within this hub are facilitated via secured RMF channels.</p>
               <div className="flex gap-2">
                  <div className="w-1 h-1 bg-[#121212]"></div>
                  <div className="w-1 h-1 bg-[#121212]"></div>
                  <div className="w-1 h-1 bg-[#121212]"></div>
               </div>
            </div>
          </aside>

          {/* Main Grid: Tactical Artifact Deployment */}
          <main className="flex-grow">
            {promotions.length > 0 && selectedCategory === 'all' && !searchQuery && (
              <section className="mb-32">
                <div className="flex items-center gap-8 mb-12">
                   <h2 className="text-4xl font-serif text-[#121212] italic tracking-tighter">Strategic Opportunities</h2>
                   <div className="h-px flex-grow bg-[#F0EDE4]"></div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-12">
                  {promotions.map(product => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              </section>
            )}

            <div className="flex justify-between items-end mb-16 border-b-2 border-[#121212] pb-8">
              <h2 className="text-5xl font-serif text-[#121212] tracking-tighter italic capitalize">{selectedCategory === 'all' ? t('the_collection') : selectedCategory}</h2>
              <div className="flex flex-col items-end">
                <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.4em] mb-2">{filteredProducts.length} {t('items_found')}</p>
                {searchQuery && <p className="text-[8px] font-bold text-[#A34D15] uppercase tracking-widest italic">Pattern Analysis Active</p>}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-16">
                {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-[3/4] bg-[#F2F0EB] animate-pulse border-2 border-[#E5E1D8]"></div>)}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-12 gap-y-24">
                {filteredProducts.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            ) : (
              <div className="py-40 text-center bg-white border-4 border-dashed border-[#F0EDE4]">
                <p className="text-[12px] font-black text-[#6B665E] uppercase tracking-[0.6em] opacity-40 italic">{t('no_products_found')}</p>
              </div>
            )}

            {/* Institutional Feedback: Community Ledger */}
            <section className="mt-40 pt-24 border-t-2 border-[#121212]">
              <div className="text-center mb-24">
                <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.6em] mb-6">Network Intelligence</p>
                <h2 className="text-7xl font-serif text-[#121212] tracking-tighter italic">Community Ledger</h2>
              </div>
              
              {marketReviews.length === 0 ? (
                <div className="text-center py-24 border-2 border-[#F0EDE4] bg-white italic text-lg text-[#6B665E] font-light">
                  No facilitation feedback recorded for this hub yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  {marketReviews.map((review: any) => (
                    <div key={review._id} className="bg-white border-2 border-[#121212] p-12 space-y-10 group hover:shadow-2xl transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-[#121212] text-white flex items-center justify-center text-2xl font-serif italic border-2 border-transparent group-hover:border-[#A34D15] transition-all">
                            {review.buyerName?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.2em]">{review.buyerName || t('verified_buyer')}</p>
                            <p className="text-[9px] text-[#6B665E] uppercase tracking-widest mt-2 opacity-50">{new Date(review.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                           {[1,2,3,4,5].map(star => (
                             <span key={star} className={`text-sm ${star <= review.rating ? 'text-[#A34D15]' : 'text-[#E5E1D8]'}`}>★</span>
                           ))}
                        </div>
                      </div>
                      <p className="text-lg text-[#121212] leading-relaxed italic font-light">
                        "{review.comment || t('great_marketplace')}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {isFullMap && (
        <div className="fixed inset-0 z-[100] bg-white animate-reveal flex flex-col">
          <div className="p-12 border-b-2 border-[#121212] flex justify-between items-center bg-white">
            <div>
              <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.6em] mb-2">{market.name}</p>
              <h2 className="text-4xl font-serif text-[#121212] tracking-tighter italic">Logistics Deployment Matrix</h2>
            </div>
            <button 
              onClick={() => setIsFullMap(false)}
              className="rmf-btn-primary bg-[#121212]"
            >
              Terminate View
            </button>
          </div>
          <div className="flex-grow relative grayscale hover:grayscale-0 transition-all duration-1000">
             <RiderMap 
                marketId={market._id} 
                centerLat={market.location?.coordinates[1]} 
                centerLng={market.location?.coordinates[0]} 
                marketName={market.name}
             />
          </div>
        </div>
      )}
    </Layout>
  );
}
