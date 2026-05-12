import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';

export default function NotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center animate-reveal">
        <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em] mb-8">Error 404</p>
        <h1 className="text-[10rem] font-serif font-black text-[#121212] leading-none tracking-tighter italic mb-0">
          404
        </h1>
        <div className="w-24 h-0.5 bg-[#F59E0B] mx-auto my-10"></div>
        <h2 className="text-3xl font-serif text-[#121212] italic tracking-tighter mb-6">Page Not Found</h2>
        <p className="text-[#6B665E] max-w-md mx-auto mb-12 italic leading-relaxed">
          We looked everywhere in the marketplace, but couldn't find what you're looking for. It may have been moved or removed.
        </p>
        <div className="flex gap-6">
          <Link 
            href="/" 
            className="rmf-btn-primary bg-[#121212] text-white border-none px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#F59E0B] transition-all"
          >
            Back to Home
          </Link>
          <Link 
            href="/markets" 
            className="rmf-btn-outline border-[#121212] text-[#121212] px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#121212] hover:text-white transition-all"
          >
            Browse Markets
          </Link>
        </div>
      </div>
    </Layout>
  );
}
