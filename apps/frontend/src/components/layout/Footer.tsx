import React from 'react';
import Link from 'next/link';

const footerSections = [
  {
    title: 'Marketplace',
    items: [
      { name: 'Browse Markets', href: '/markets' },
      { name: 'Verified Sellers', href: '/markets' },
      { name: 'Made in Rwanda', href: '/markets?search=Made+In+Rwanda' },
      { name: 'Market Maps', href: '/markets' }
    ]
  },
  {
    title: 'Support',
    items: [
      { name: 'Help Center', href: '/contact' },
      { name: 'MoMo Payments', href: '/contact' },
      { name: 'Delivery Tracking', href: '/orders' },
      { name: 'Refund Policy', href: '/terms' }
    ]
  },
  {
    title: 'Sell With Us',
    items: [
      { name: 'Seller Portal', href: '/seller/onboarding' },
      { name: 'Market Logistics', href: '/markets' },
      { name: 'Success Stories', href: '/contact' },
      { name: 'Pricing', href: '/contact' }
    ]
  },
  {
    title: 'RMF',
    items: [
      { name: 'Privacy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Contact', href: '/contact' },
      { name: 'About', href: '/contact' }
    ]
  }
];

export const Footer = () => (
  <footer className="w-full premium-gradient py-12 md:py-16 text-white border-t border-black/10 mt-auto">
    <div className="rmf-container">
      <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4">
        {footerSections.map(section => (
          <div key={section.title}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-white/50">{section.title}</h3>
            <div className="space-y-2.5">
              {section.items.map(item => (
                <Link key={item.name} href={item.href} className="block font-medium text-white/80 transition-colors hover:text-white">
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-white/50">
        <p>© {new Date().getFullYear()} Rwanda Market Facilitator (RMF). All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  </footer>
);
