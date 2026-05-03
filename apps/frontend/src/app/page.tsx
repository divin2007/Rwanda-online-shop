'use client';
import { useEffect } from "react";
import Link from "next/link";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/ui/ProductCard";
import { useApi } from "@/hooks/useApi";
import { marketApi, productApi } from "@/lib/api";

export default function Home() {
  const { data: markets, loading: marketsLoading, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets?isActive=true&limit=6');
  const { data: products, loading: productsLoading, execute: fetchProducts } = useApi(productApi, 'get', '/products?isActive=true&limit=8&sortBy=totalOrders');

  useEffect(() => {
    fetchMarkets();
    fetchProducts();
  }, [fetchMarkets, fetchProducts]);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-gradient-to-br from-primary/10 via-background-main to-secondary/10 rounded-2xl mb-16 mt-4">
        <h1 className="text-5xl md:text-6xl font-heading font-extrabold text-text-primary mb-6 tracking-tight">
          Rwanda's Markets, <br className="hidden md:block" />
          <span className="text-primary text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Delivered to You.</span>
        </h1>
        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10">
          Shop directly from thousands of verified sellers across Kigali's public markets. Fresh produce, electronics, and daily essentials delivered in under an hour.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/markets" className="w-full sm:w-auto">
            <Button size="lg" fullWidth>Start Shopping</Button>
          </Link>
          <Link href="/seller/onboarding" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" fullWidth>Become a Seller</Button>
          </Link>
        </div>
      </section>

      {/* Featured Markets */}
      <section className="mb-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-heading font-bold text-text-primary mb-2">Explore Markets</h2>
            <p className="text-text-secondary">Shop from your favorite local markets</p>
          </div>
          <Link href="/markets" className="text-primary font-bold hover:underline hidden sm:block">
            View All Markets →
          </Link>
        </div>
        
        {marketsLoading ? (
          <div className="flex justify-center items-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(markets || []).map((market: any) => (
              <Link href={`/market/${market.slug}`} key={market._id} className="group">
                <div className="bg-background-card border border-border rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-lg hover:border-primary/30 flex flex-col">
                  <div className={`w-16 h-16 rounded-2xl overflow-hidden mb-6 bg-primary/10 flex items-center justify-center`}>
                    {market.imageUrl ? (
                       <img src={market.imageUrl} alt={market.name} className="w-full h-full object-cover" />
                    ) : (
                       <span className="text-2xl">🏪</span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">{market.name}</h3>
                  <p className="text-text-secondary flex-grow">{market.location?.address || market.description}</p>
                  <p className="text-xs text-text-muted mt-2">{market.sellerCount || 0} active sellers</p>
                  <div className="mt-6 flex items-center text-sm font-bold text-primary">
                    Shop Now <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-6 text-center sm:hidden">
          <Link href="/markets" className="text-primary font-bold hover:underline">
            View All Markets →
          </Link>
        </div>
      </section>

      {/* Trending Products Grid */}
      <section className="mb-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-heading font-bold text-text-primary mb-2">Trending Products</h2>
            <p className="text-text-secondary">Most ordered items right now</p>
          </div>
        </div>

        {productsLoading ? (
          <div className="flex justify-center items-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(products || []).map((product: any) => (
              <ProductCard 
                key={product._id} 
                product={product} 
              />
            ))}
          </div>
        )}
      </section>

      {/* How it Works */}
      <section className="bg-background-surface -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-20 mb-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-heading font-bold text-text-primary mb-4">How RMF Works</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">A seamless ecosystem connecting buyers, sellers, and riders.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                🛍️
              </div>
              <h3 className="text-xl font-bold mb-3">1. You Order</h3>
              <p className="text-text-secondary">Browse products from local markets and checkout securely using Mobile Money.</p>
            </div>
            <div>
              <div className="w-20 h-20 mx-auto bg-secondary/10 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                🏪
              </div>
              <h3 className="text-xl font-bold mb-3">2. Sellers Prepare</h3>
              <p className="text-text-secondary">Verified sellers receive instant notifications and pack your items fresh.</p>
            </div>
            <div>
              <div className="w-20 h-20 mx-auto bg-status-success/10 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                🛵
              </div>
              <h3 className="text-xl font-bold mb-3">3. Riders Deliver</h3>
              <p className="text-text-secondary">Our network of riders pick up the order and deliver it straight to your door.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-3xl p-8 aspect-square max-h-[400px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="text-9xl relative z-10 drop-shadow-xl">🛡️</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-heading font-bold text-text-primary mb-6">Guaranteed Quality & Security</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">✓</div>
              <div>
                <h4 className="font-bold text-lg mb-1">Buyer Protection Fund</h4>
                <p className="text-text-secondary">Not satisfied with your order? Get instant refunds for disputes under 10,000 RWF directly from our reserve fund.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">✓</div>
              <div>
                <h4 className="font-bold text-lg mb-1">Verified Sellers Only</h4>
                <p className="text-text-secondary">Every seller on our platform is physically verified and tied to an established market stall or shop.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">✓</div>
              <div>
                <h4 className="font-bold text-lg mb-1">Secure Mobile Payments</h4>
                <p className="text-text-secondary">Seamlessly integrated with MTN MoMo and Airtel Money for fast, secure, and familiar transactions.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </Layout>
  );
}
