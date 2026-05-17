import React from 'react';
import Link from 'next/link';

export const Footer = () => (
  <footer className="rounded-2xl bg-primary-cinematic p-8 text-white shadow-lg cinematic-shadow">
    <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4">
      {[
        ['Marketplace', 'Browse Markets', 'Verified Sellers', 'Made in Rwanda', 'Market Maps'],
        ['Support', 'Help Center', 'MoMo Payments', 'Delivery Tracking', 'Refund Policy'],
        ['Sell With Us', 'Seller Portal', 'Market Logistics', 'Success Stories', 'Pricing'],
        ['RMF', 'Privacy', 'Terms of Service', 'Contact', 'About'],
      ].map(([title, ...items]) => (
        <div key={title}>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-accent-premium">{title}</h3>
          <div className="space-y-2.5">
            {items.map(item => (
              <Link key={item} href="/markets" className="block font-medium text-white/50 transition-colors hover:text-white">
                {item}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="mt-10 border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-white/30">
      <p>© {new Date().getFullYear()} Rwanda Market Facilitator (RMF). All rights reserved.</p>
      <div className="flex gap-6">
        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
      </div>
    </div>
  </footer>
);
