'use client';
import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { MarketCard } from '@/components/ui/MarketCard';
import { useApi } from '@/hooks/useApi';
import { marketApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

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

export default function MarketsPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [valuationRange, setValuationRange] = useState({ min: '', max: '' });
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  const { data: marketsData, loading, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets?activeOnly=false');

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const allMarkets = marketsData || [];

  const filteredMarkets = useMemo(() => {
    let results = allMarkets;
    
    // 1. Search Query (Fuzzy)
    if (searchQuery.trim()) {
      results = results.filter((market: any) => {
        const nameSim = getSimilarity(market.name, searchQuery);
        const descSim = market.description ? getSimilarity(market.description, searchQuery) : 0;
        const addrSim = market.location?.address ? getSimilarity(market.location.address, searchQuery) : 0;
        return (nameSim > 0.3 || descSim > 0.3 || addrSim > 0.3);
      });
    }

    // 2. Valuation Range (Mapped to Total Sellers for Markets)
    if (valuationRange.min) {
      results = results.filter((m: any) => (m.totalSellers || 0) >= Number(valuationRange.min));
    }
    if (valuationRange.max) {
      results = results.filter((m: any) => (m.totalSellers || 0) <= Number(valuationRange.max));
    }

    // 3. Hub Classification
    if (selectedCategory !== 'ALL') {
      // Map Hub Classification to Backend Types
      // HUB/COOPERATIVE -> public, INDIVIDUAL -> individual
      const typeMap: Record<string, string> = {
        'INDIVIDUAL': 'individual',
        'HUB': 'public',
        'COOPERATIVE': 'public' // Assuming cooperatives are public markets in this context
      };
      const targetType = typeMap[selectedCategory];
      results = results.filter((m: any) => m.type === targetType);
    }

    return results;
  }, [allMarkets, searchQuery, selectedCategory, valuationRange]);

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-20 pb-32">
        {/* Discovery Matrix Sidebar */}
        <aside className="w-full lg:w-80 space-y-20">
          <div className="space-y-10">
            <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.4em] border-b-2 border-[#121212] pb-6 italic">Discovery Matrix</p>
            
            <div className="space-y-12">
              <div className="space-y-4">
                <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-50">Authorized Search</label>
                <div className="relative group">
                  <input 
                    placeholder="Search collection..." 
                    className="rmf-input w-full px-6 py-4 border-2 border-[#E5E1D8] focus:border-[#121212] bg-white text-[11px] font-black uppercase tracking-widest" 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-[#A34D15] animate-pulse">MATCHING</span>}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-50">Merchant Capacity</label>
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    placeholder="Min" 
                    className="rmf-input w-full px-4 py-4 border-2 border-[#E5E1D8] focus:border-[#121212] bg-white text-[10px] font-black uppercase" 
                    type="number" 
                    value={valuationRange.min}
                    onChange={(e) => setValuationRange(prev => ({ ...prev, min: e.target.value }))}
                  />
                  <input 
                    placeholder="Max" 
                    className="rmf-input w-full px-4 py-4 border-2 border-[#E5E1D8] focus:border-[#121212] bg-white text-[10px] font-black uppercase" 
                    type="number" 
                    value={valuationRange.max}
                    onChange={(e) => setValuationRange(prev => ({ ...prev, max: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black text-[#6B665E] uppercase tracking-widest opacity-50">Hub Classification</label>
                <div className="space-y-3">
                  {['ALL', 'INDIVIDUAL', 'COOPERATIVE', 'HUB'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                        selectedCategory === cat ? 'bg-[#121212] text-white border-[#121212]' : 'bg-white border-[#E5E1D8] text-[#6B665E] hover:border-[#121212]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-10 bg-[#121212] text-white space-y-6 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-20 h-20 bg-[#A34D15]/20 rounded-full -mr-10 -mt-10"></div>
             <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#A34D15]">Facilitator Mandate</p>
             <p className="text-[10px] leading-relaxed italic opacity-70">
               "System-wide verification ensures every regional hub maintains the highest standards of artisanal excellence."
             </p>
          </div>
        </aside>

        {/* Main Hub Content */}
        <main className="flex-grow space-y-24">
          <div className="flex justify-between items-end border-b-2 border-[#121212] pb-12">
            <div>
              <p className="text-[10px] font-black text-[#A34D15] uppercase tracking-[0.5em] mb-4">{t('official_infrastructure')}</p>
              <h1 className="text-7xl font-serif text-[#121212] tracking-tighter leading-none italic">{t('regional_hubs')}</h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-[#121212] uppercase tracking-widest">{filteredMarkets.length} Hubs Found</p>
               <p className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest opacity-40">Synchronization Active</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-10">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-[4/5] bg-[#F2F0EB] animate-pulse border-2 border-[#E5E1D8]"></div>
              ))}
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="py-48 text-center border-4 border-dashed border-[#F0EDE4] bg-white">
              <p className="text-[12px] font-black text-[#6B665E] uppercase tracking-[0.6em] italic opacity-40">{t('no_hubs_deployed')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-10">
              {filteredMarkets.map((market: any, idx: number) => (
                <MarketCard 
                  key={market._id} 
                  market={market} 
                  index={idx} 
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
