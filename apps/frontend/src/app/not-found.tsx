import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';

export default function NotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center animate-reveal">
        <p className="text-[11px] font-black text-[#1b4332] uppercase tracking-[0.5em] mb-8">Error 404</p>
        <h1 className="text-[10rem] font-sans font-black text-[#1b1c1c] leading-none tracking-normal mb-0">
          404
        </h1>
        <div className="w-24 h-0.5 bg-[#ffd700] mx-auto my-10"></div>
        <h2 className="text-3xl font-sans text-[#1b1c1c] tracking-normal mb-6">Page Not Found</h2>
        <p className="text-[#414844] max-w-md mx-auto mb-12 leading-relaxed">
          We looked everywhere in the marketplace, but couldn't find what you're looking for. It may have been moved or removed.
        </p>
        <div className="flex gap-6">
          <Link 
            href="/" 
            className="rmf-btn-primary bg-[#012d1d] text-white border-none px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#012d1d] transition-all"
          >
            Back to Home
          </Link>
          <Link 
            href="/markets" 
            className="rmf-btn-outline border-[#e0e0e0] text-[#1b1c1c] px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#012d1d] hover:text-white transition-all"
          >
            Browse Markets
          </Link>
        </div>
      </div>
    </Layout>
  );
}
