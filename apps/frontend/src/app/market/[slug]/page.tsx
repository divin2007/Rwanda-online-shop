'use client';
import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import dynamic from 'next/dynamic';
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi, reviewApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

// Simple Fuzzy Search Logic
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
  Array.from(b1).forEach(b => {
    if (b2.has(b)) intersection++;
  });
  return (2 * intersection) / (b1.size + b2.size);
};

export default function MarketPage({ params }: { params: { slug: string } }) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isFullMap, setIsFullMap] = useState(false);
  
  const { data: market, loading: marketLoading, execute: fetchMarket } = useApi(marketApi, 'get', `/markets/slug/${params.slug}`);
  const { data: marketReviewsData } = useApi(reviewApi, 'get', market?._id ? `/reviews/target/market/${market._id}` : '');
  
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarket();
  }, [params.slug, fetchMarket]);

  useEffect(() => {
    if (market?._id) {
      setLoading(true);
      Promise.all([
        productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&limit=1000`),
        productApi.get(`/products?marketId=${market._id}&isActive=true&hasPromotion=true`)
      ]).then(([prodRes, promRes]) => {
        setAllProducts(prodRes.data?.data || []);
        setPromotions(promRes.data?.data || []);
      }).finally(() => setLoading(false));
    }
  }, [market?._id]);

  const categories = useMemo(() => {
    const cats = new Set(allProducts.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(cats)].sort();
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;
      const price = product.price;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      if (searchQuery.trim()) {
        const nameSimilarity = getSimilarity(product.name, searchQuery);
        const categorySimilarity = product.category ? getSimilarity(product.category, searchQuery) : 0;
        const descriptionSimilarity = product.description ? getSimilarity(product.description, searchQuery) : 0;
        const threshold = 0.35; 
        return (nameSimilarity > threshold || categorySimilarity > threshold || descriptionSimilarity > 0.5);
      }
      return true;
    });
  }, [allProducts, selectedCategory, searchQuery, minPrice, maxPrice]);

  const marketReviews = marketReviewsData || [];

  if (marketLoading) {
    return (
      <Layout>
        <div className="rmf-container py-40 flex flex-col items-center gap-8">
          <div className="w-16 h-16 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-[#6B665E] uppercase tracking-widest">Loading Market...</p>
        </div>
      </Layout>
    );
  }

  if (!market) {
    return (
      <Layout>
        <div className="rmf-container py-40 text-center">
          <p className="text-5xl mb-6">🏪</p>
          <h2 className="text-3xl font-serif italic text-[#121212] mb-4">Market Not Found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-24 pb-40 animate-reveal">
        
        {/* ── Market Hero Header ── */}
        <div className="relative h-[65vh] overflow-hidden group border-b border-[#121212]">
          <img 
            src={market.imageUrl || 'https://images.unsplash.com/photo-1542223175-75bc9dd5b4b0'} 
            className="w-full h-full object-cover grayscale transition-transform duration-[10000ms] group-hover:scale-105 group-hover:grayscale-[50%]" 
            alt={market.name} 
          />
          <div className="absolute inset-0 bg-[#121212]/70 flex flex-col justify-center px-8 md:px-20">
            <div className="max-w-4xl">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-px bg-[#F59E0B]" />
                 <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Verified Market</p>
              </div>
              <h1 className="text-6xl md:text-[100px] font-serif text-white leading-[0.9] tracking-tighter italic mb-8">
                {market.name}
              </h1>
              <p className="text-lg md:text-xl text-white/70 font-light italic leading-relaxed max-w-2xl border-l-2 border-white/20 pl-8">
                {market.description || 'Shop fresh produce, authentic crafts, and everyday essentials straight from local sellers.'}
              </p>
            </div>
          </div>
          
          <div className="absolute bottom-10 right-10 hidden lg:flex flex-col items-end">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white">Open Now</span>
             </div>
             <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.6em]">ID: {market._id.substring(0,8).toUpperCase()}</p>
          </div>
        </div>

        <div className="px-8 md:px-20 max-w-[1600px] mx-auto space-y-24">
          
          {/* ── Map Overview ── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-center">
             <div className="lg:col-span-1 space-y-6">
                <div className="w-16 h-16 bg-[#F8F6F1] border border-[#E5E1D8] flex items-center justify-center text-2xl shadow-sm">
                   📍
                </div>
                <div>
                  <h3 className="text-3xl font-serif text-[#121212] italic tracking-tighter leading-tight mb-3">Live Delivery Map</h3>
                  <p className="text-sm text-[#6B665E] font-medium leading-relaxed mb-6">
                    See active riders near {market.name} ready to deliver your order instantly.
                  </p>
                  <button 
                    onClick={() => setIsFullMap(true)}
                    className="border-2 border-[#121212] text-[#121212] px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[#121212] hover:text-white transition-all w-full md:w-auto"
                  >
                    Expand Map
                  </button>
                </div>
             </div>
             
             <div className="lg:col-span-3 h-[350px] border border-[#E5E1D8] shadow-md group relative">
                <RiderMap 
                  marketId={market._id} 
                  centerLat={market.location?.coordinates[1]} 
                  centerLng={market.location?.coordinates[0]} 
                  marketName={market.name}
                />
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#121212] transition-colors pointer-events-none" />
             </div>
          </div>

          {/* ── Products & Filters ── */}
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Sidebar */}
            <aside className="w-full lg:w-72 space-y-12">
              <div>
                <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] border-b border-[#F0EDE4] pb-4 mb-6">Search & Filter</p>
                <div className="space-y-6">
                   <div className="space-y-2">
                     <label className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest">Search Products</label>
                     <input 
                       type="text" 
                       placeholder="Find an item..."
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       className="w-full px-5 py-4 bg-[#F8F6F1] border border-[#E5E1D8] focus:border-[#121212] text-sm outline-none transition-colors"
                     />
                   </div>

                   <div className="space-y-2">
                     <label className="text-[8px] font-black text-[#6B665E] uppercase tracking-widest">Price Range (RWF)</label>
                     <div className="grid grid-cols-2 gap-3">
                       <input 
                         type="number" 
                         placeholder="Min" 
                         value={minPrice}
                         onChange={e => setMinPrice(e.target.value)}
                         className="w-full px-4 py-3 bg-[#F8F6F1] border border-[#E5E1D8] focus:border-[#121212] text-xs outline-none transition-colors"
                       />
                       <input 
                         type="number" 
                         placeholder="Max" 
                         value={maxPrice}
                         onChange={e => setMaxPrice(e.target.value)}
                         className="w-full px-4 py-3 bg-[#F8F6F1] border border-[#E5E1D8] focus:border-[#121212] text-xs outline-none transition-colors"
                       />
                     </div>
                   </div>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] border-b border-[#F0EDE4] pb-4 mb-6">Categories</p>
                <nav className="flex flex-col gap-2">
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                        selectedCategory === cat 
                          ? 'border-[#121212] bg-[#121212] text-white' 
                          : 'border-transparent text-[#6B665E] hover:bg-[#F8F6F1]'
                      }`}
                    >
                      {cat === 'all' ? 'All Products' : cat}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Trust Badge */}
              <div className="p-6 border border-[#E5E1D8] bg-[#F8F6F1] space-y-4">
                 <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-widest">Buyer Protection</p>
                 <p className="text-xs text-[#121212] leading-relaxed italic">Your payments are held in escrow. Money is only released to the seller when your order is delivered safely.</p>
              </div>
            </aside>

            {/* Main Products Grid */}
            <main className="flex-1">
              {promotions.length > 0 && selectedCategory === 'all' && !searchQuery && (
                <section className="mb-20 bg-[#121212] p-10 md:p-12">
                  <div className="flex items-center gap-6 mb-10">
                     <h2 className="text-4xl font-serif text-white italic tracking-tighter">Featured Items</h2>
                     <div className="h-px flex-1 bg-white/20" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promotions.map(product => (
                      <ProductCard key={product._id} product={product} />
                    ))}
                  </div>
                </section>
              )}

              <div className="flex justify-between items-end mb-10 border-b border-[#F0EDE4] pb-6">
                <h2 className="text-4xl font-serif text-[#121212] tracking-tighter italic capitalize">
                  {selectedCategory === 'all' ? 'All Products' : selectedCategory}
                </h2>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.3em]">{filteredProducts.length} items</p>
                  {searchQuery && <p className="text-[8px] font-bold text-[#A34D15] uppercase tracking-widest">Search active</p>}
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-[3/4] bg-[#F8F6F1] animate-pulse border border-[#E5E1D8]" />)}
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map(product => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="py-32 text-center bg-white border-2 border-dashed border-[#E5E1D8]">
                  <div className="text-5xl mb-4">🔍</div>
                  <p className="text-xl font-serif italic text-[#121212] mb-2">No items found</p>
                  <p className="text-sm font-medium text-[#6B665E]">Try adjusting your search or filters.</p>
                </div>
              )}

              {/* ── Reviews Section ── */}
              <section className="mt-32 pt-20 border-t-2 border-[#121212]">
                <div className="mb-16">
                  <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-3">Community Voice</p>
                  <h2 className="text-5xl font-serif text-[#121212] tracking-tighter italic">Market Reviews</h2>
                </div>
                
                {marketReviews.length === 0 ? (
                  <div className="py-20 text-center border border-[#E5E1D8] bg-[#F8F6F1]">
                     <p className="text-lg italic text-[#6B665E]">No reviews yet. Be the first to shop and leave a review!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {marketReviews.map((review: any) => (
                      <div key={review._id} className="bg-white border border-[#E5E1D8] p-8 space-y-6 hover:border-[#121212] transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#121212] text-white flex items-center justify-center text-xl font-serif italic">
                              {review.buyerName?.[0] || 'U'}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.2em]">{review.buyerName || 'Verified Buyer'}</p>
                              <p className="text-[8px] text-[#6B665E] uppercase tracking-widest mt-1 opacity-60">{new Date(review.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                             {[1,2,3,4,5].map(star => (
                               <span key={star} className={`text-xs ${star <= review.rating ? 'text-[#F59E0B]' : 'text-[#E5E1D8]'}`}>★</span>
                             ))}
                          </div>
                        </div>
                        <p className="text-sm text-[#121212] leading-relaxed italic">
                          "{review.comment || 'Great marketplace with fast delivery.'}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>
      </div>

      {isFullMap && (
        <div className="fixed inset-0 z-[100] bg-white animate-reveal flex flex-col">
          <div className="px-8 py-6 border-b-2 border-[#121212] flex justify-between items-center bg-white shadow-md z-10">
            <div>
              <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-1">{market.name}</p>
              <h2 className="text-3xl font-serif text-[#121212] tracking-tighter italic">Live Delivery Map</h2>
            </div>
            <button 
              onClick={() => setIsFullMap(false)}
              className="bg-[#121212] text-white px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[#F59E0B] transition-all"
            >
              Close Map
            </button>
          </div>
          <div className="flex-1 relative bg-[#F8F6F1]">
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
