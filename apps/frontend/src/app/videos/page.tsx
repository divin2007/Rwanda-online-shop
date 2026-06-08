'use client';

import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { SellerStoriesShelf } from '@/components/ui/SellerStoriesShelf';
import { SellerVideoFeed } from '@/components/ui/SellerVideoFeed';
import { Search } from 'lucide-react';

export default function VideosPage() {
  const [search, setSearch] = React.useState('');

  return (
    <Layout>
      <div className="bg-[#fdfaf7]">
        <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-8 md:px-8 md:pt-12">
          <div className="rounded-3xl bg-[#1b1c1c] p-8 text-white shadow-2xl md:p-12">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ff6b00]">RMF video market</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">Watch sellers show the products before you order.</h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-white/70">
              Scroll adverts, demos, and shop stories from verified sellers across RMF markets.
            </p>
            <label className="mt-8 flex max-w-2xl items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[#1b1c1c] shadow-xl">
              <Search size={18} className="text-[#ff6b00]" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search videos by product, seller, market, category..."
                className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[#8a958e]"
              />
            </label>
          </div>
        </section>
        <SellerStoriesShelf />
        <SellerVideoFeed
          title={search.trim() ? `Videos matching "${search.trim()}"` : 'All market videos'}
          description="Browse fresh seller videos across every connected RMF market."
          search={search}
          onTagClick={(tag) => setSearch(tag)}
        />
      </div>
    </Layout>
  );
}
