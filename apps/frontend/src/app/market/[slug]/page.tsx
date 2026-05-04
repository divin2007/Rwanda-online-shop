'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
const RiderMap = dynamic(() => import('@/components/ui/RiderMap').then(mod => mod.RiderMap), { ssr: false });
import { useApi } from '@/hooks/useApi';
import { marketApi, productApi } from '@/lib/api';

export default function MarketPage({ params }: { params: { slug: string } }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { data: market, loading: marketLoading, execute: fetchMarket } = useApi(marketApi, 'get', `/markets/slug/${params.slug}`);
  const { data: allProducts, loading: productsLoading, execute: fetchProducts } = useApi(productApi, 'get', `/products?isActive=true&isApproved=true&inStock=true`);
  const { data: promotedProducts, execute: fetchPromoted } = useApi(productApi, 'get', `/products?isActive=true&hasPromotion=true`);

  useEffect(() => {
    fetchMarket();
  }, [params.slug, fetchMarket]);

  useEffect(() => {
    if (market?._id) {
      // Need to append marketId dynamically once we have it
      productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&inStock=true`).then(res => fetchProducts(res.data.data));
      productApi.get(`/products?marketId=${market._id}&isActive=true&hasPromotion=true`).then(res => fetchPromoted(res.data.data));
    }
  }, [market, fetchProducts, fetchPromoted]);

  // If using useApi purely based on url string:
  // Instead of the dynamic effect above, it's better to manage local state for the product fetch if it depends on an async id.
  const [products, setProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [pLoading, setPLoading] = useState(true);

  useEffect(() => {
    if (market?._id) {
      setPLoading(true);
      Promise.all([
        productApi.get(`/products?marketId=${market._id}&isActive=true&isApproved=true&inStock=true`),
        productApi.get(`/products?marketId=${market._id}&isActive=true&hasPromotion=true`)
      ]).then(([prodRes, promRes]) => {
        setProducts(prodRes.data?.data || []);
        setPromotions(promRes.data?.data || []);
      }).finally(() => setPLoading(false));
    }
  }, [market?._id]);

  const [isFullMap, setIsFullMap] = useState(false);
  
  if (marketLoading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  if (!market) return <Layout><div className="p-20 text-center">Market not found</div></Layout>;

  // Extract unique categories
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  
  // Filter out products that are already shown in promotions
  const uniqueProducts = products.filter(p => !promotions.some(promo => promo._id === p._id));
  
  const filteredProducts = selectedCategory === 'all' ? uniqueProducts : uniqueProducts.filter(p => p.category === selectedCategory);

  return (
    <Layout marketName={market.name}>
      {/* Full Map Overlay */}
      {isFullMap && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background-card">
            <h2 className="font-heading font-bold text-xl">{market.name} - Full Marketplace View</h2>
            <Button size="sm" variant="outline" onClick={() => setIsFullMap(false)}>Exit Map View</Button>
          </div>
          <div className="flex-grow relative">
             <RiderMap 
                marketId={market._id} 
                centerLat={market.location?.coordinates[1]} 
                centerLng={market.location?.coordinates[0]} 
                marketName={market.name}
             />
          </div>
        </div>
      )}

      {/* Live Rider Availability Banner with Map */}
      <div className="bg-background-card border border-border rounded-lg p-4 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center relative">
              <span className="absolute w-3 h-3 bg-status-success rounded-full top-0 right-0 border-2 border-white animate-pulse"></span>
              🏍️
            </div>
            <div>
              <h3 className="font-medium text-text-primary">Live Delivery Fleet</h3>
              <p className="text-sm text-text-secondary">Riders currently near {market.name}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsFullMap(true)}>View Full Map</Button>
        </div>
        <div className="h-48 rounded bg-background-surface overflow-hidden border border-border">
          <RiderMap 
            marketId={market._id} 
            centerLat={market.location?.coordinates[1]} 
            centerLng={market.location?.coordinates[0]} 
            marketName={market.name}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-48 flex-shrink-0">
          <h3 className="font-bold mb-4">Categories</h3>
          <ul className="space-y-2">
            {categories.map(cat => (
              <li key={cat}>
                <button 
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded capitalize text-sm font-medium ${selectedCategory === cat ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-background-surface'}`}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-grow">
          {promotions.length > 0 && selectedCategory === 'all' && (
            <div className="mb-10 border-b border-border pb-8">
              <h2 className="text-2xl font-heading font-bold text-text-primary mb-4">🔥 Hot Deals at {market.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {promotions.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-end mb-6">
            <h1 className="text-2xl font-heading font-bold text-text-primary capitalize">{selectedCategory === 'all' ? 'All Products' : selectedCategory}</h1>
          </div>

          {pLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-text-secondary bg-background-surface rounded-xl">
              No products found in this category.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
