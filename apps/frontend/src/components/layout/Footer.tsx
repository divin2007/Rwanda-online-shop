import React from 'react';
import Link from 'next/link';

const footerSections = [
  {
    title: 'Marketplace',
    items: [
      { name: 'Browse Markets', href: '/markets' },
      { name: 'Verified Sellers', href: '/markets' },
      { name: 'Made in Rwanda', href: '/markets?search=Made+In+Rwanda' },
      { name: 'Market Maps', href: '/markets' },
    ],
  },
  {
    title: 'Support',
    items: [
      { name: 'Help Center', href: '/contact' },
      { name: 'MoMo Payments', href: '/contact' },
      { name: 'Delivery Tracking', href: '/orders' },
      { name: 'Refund Policy', href: '/terms' },
    ],
  },
  {
    title: 'Sell With Us',
    items: [
      { name: 'Seller Portal', href: '/seller/onboarding' },
      { name: 'Market Logistics', href: '/markets' },
      { name: 'Success Stories', href: '/contact' },
      { name: 'Pricing', href: '/contact' },
    ],
  },
  {
    title: 'RMF',
    items: [
      { name: 'Privacy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Contact', href: '/contact' },
      { name: 'About', href: '/contact' },
    ],
  },
];

export const Footer = () => (
  <footer className="mt-auto w-full border-t border-[#ebdcd0] bg-[#e9e8e7] py-10 text-[#1b1c1c] md:py-12">
    <div className="rmf-container">
      <div className="grid grid-cols-1 gap-8 text-sm sm:grid-cols-[1.1fr_repeat(4,1fr)]">
        <div>
          <h2 className="text-xl font-black text-[#ff6b00]">RMF</h2>
          <p className="mt-4 max-w-xs text-sm leading-6 text-[#574e47]">
            Connecting Rwandan producers to local and international buyers with efficiency and transparency.
          </p>
        </div>
        {footerSections.map(section => (
          <div key={section.title}>
            <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#ff6b00]">
              {section.title}
            </h3>
            <div className="space-y-2.5">
              {section.items.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block font-medium text-[#574e47] transition-colors hover:text-[#ff6b00]"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#d2bca8] pt-6 text-[11px] font-medium text-[#574e47] md:flex-row">
        <p>(c) {new Date().getFullYear()} Rwanda Market Facilitator (RMF). All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="transition-colors hover:text-[#ff6b00]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[#ff6b00]">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  </footer>
);
