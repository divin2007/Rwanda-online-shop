'use client';
import React from 'react';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-20 px-6 animate-reveal">
        <div className="mb-20 border-b-2 border-[#e0e0e0] pb-12">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-12 h-px bg-[#ffd700]"></div>
            <p className="text-[11px] font-black text-[#1b4332] uppercase tracking-[0.5em]">Support</p>
          </div>
          <h1 className="text-7xl font-sans tracking-normal leading-none text-[#1b1c1c]">
            Contact Us
          </h1>
          <p className="text-sm text-[#414844] mt-6 max-w-xl leading-relaxed opacity-70">
            Have a question, issue, or feedback? We're here to help. Reach out through any of the channels below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-white border border-[#e0e0e0] rounded-lg p-12 space-y-8 shadow-xl">
            <div className="text-4xl">📧</div>
            <h3 className="text-2xl font-sans text-[#1b1c1c] tracking-normal">Email Support</h3>
            <p className="text-sm text-[#414844] leading-relaxed">
              For general inquiries, account issues, or partnership opportunities.
            </p>
            <a href="mailto:support@rmf.rw" className="block text-[11px] font-black uppercase tracking-widest text-[#1b4332] hover:text-[#1b4332] transition-colors">
              support@rmf.rw →
            </a>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-lg p-12 space-y-8 shadow-xl">
            <div className="text-4xl">📱</div>
            <h3 className="text-2xl font-sans text-[#1b1c1c] tracking-normal">Phone & WhatsApp</h3>
            <p className="text-sm text-[#414844] leading-relaxed">
              Need immediate help? Call or text us on WhatsApp during business hours (8am - 6pm EAT).
            </p>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#1b4332]">
              +250 78X XXX XXX
            </p>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-lg p-12 space-y-8 shadow-xl">
            <div className="text-4xl">🏢</div>
            <h3 className="text-2xl font-sans text-[#1b1c1c] tracking-normal">Office</h3>
            <p className="text-sm text-[#414844] leading-relaxed">
              Visit us at our Kigali office for seller onboarding, partnerships, or in-person support.
            </p>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#1b1c1c]/60">
              Kigali, Rwanda
            </p>
          </div>

          <div className="bg-[#012d1d] border border-[#e0e0e0] rounded-lg p-12 space-y-8 text-white shadow-xl">
            <div className="text-4xl">🛡️</div>
            <h3 className="text-2xl font-sans tracking-normal">Dispute Resolution</h3>
            <p className="text-sm leading-relaxed opacity-70">
              If you have a dispute about an order, please raise it through your order tracking page within 24 hours of delivery. Our team will investigate and resolve it within 48 hours.
            </p>
            <Link href="/orders" className="block text-[11px] font-black uppercase tracking-widest text-[#1b4332] hover:text-white transition-colors">
              Go to My Orders →
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
