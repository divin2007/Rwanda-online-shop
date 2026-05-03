import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';

const ALL_MARKETS = [
  { id: "kimironko", name: "Kimironko Market", description: "Fresh produce, clothing, and crafts in Kigali's busiest market.", image: "🥬", color: "bg-green-100 text-green-800" },
  { id: "nyabugogo", name: "Nyabugogo Market", description: "Wholesale goods, electronics, and daily essentials.", image: "📱", color: "bg-blue-100 text-blue-800" },
  { id: "batsinda", name: "Batsinda Market", description: "Local artisans, spices, and household items.", image: "🌶️", color: "bg-orange-100 text-orange-800" },
  { id: "nyarugenge", name: "Nyarugenge City Market", description: "Modern market complex with everything you need.", image: "🏢", color: "bg-purple-100 text-purple-800" },
  { id: "kicukiro", name: "Kicukiro Centre Market", description: "Community market known for fresh fruits and local foods.", image: "🍌", color: "bg-yellow-100 text-yellow-800" },
  { id: "zindiro", name: "Zindiro Market", description: "Neighborhood market for quick grocery shopping.", image: "🛒", color: "bg-teal-100 text-teal-800" },
];

export default function MarketsPage() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-10 px-4">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-heading font-bold text-text-primary mb-4">All Markets</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Browse through Rwanda's vibrant public markets and shop directly from verified local vendors.
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
          <div className="hidden md:flex gap-2">
            <select className="border border-border rounded-full px-4 py-2 text-sm bg-background-surface focus:outline-none focus:ring-2 focus:ring-primary">
              <option>Filter by Region</option>
              <option>Gasabo</option>
              <option>Nyarugenge</option>
              <option>Kicukiro</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALL_MARKETS.map((market) => (
            <Link href={`/market/${market.id}`} key={market.id} className="group">
              <div className="bg-background-card border border-border rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-lg hover:border-primary/30 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${market.color}`}>
                    {market.image}
                  </div>
                  <span className="bg-background-surface border border-border text-text-secondary text-xs px-3 py-1 rounded-full font-medium">
                    120+ Vendors
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">{market.name}</h3>
                <p className="text-text-secondary flex-grow mb-6">{market.description}</p>
                <div className="w-full bg-primary/10 text-primary font-bold text-center py-3 rounded-xl group-hover:bg-primary group-hover:text-text-inverse transition-colors">
                  Explore Market
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
