'use client';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { sellerApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';

export default function SellerQRPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: profile } = useApi(sellerApi, 'get', `/sellers/me?userId=${user?.id}`);

  const handlePrint = () => {
    window.print();
  };

  const stallSlug = profile?.shopDetails?.slug || profile?.stallId?.toLowerCase() || 'market';
  const stallUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${stallSlug}.${window.location.host}`
    : '';

  // Generate the scannable pickup credential from the seller's persisted stall ID.
  const pickupQrPayload = `marketrwanda:stall:${profile?.stallId || ''}`;
  const pickupQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pickupQrPayload)}`;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-16 pb-20 animate-reveal">
        {/* Institutional Header */}
        <div className="flex justify-between items-end border-b border-[#e0e0e0] pb-10">
          <div>
            <p className="text-[10px] font-bold text-[#ff6b00] uppercase tracking-[0.5em] mb-3">Facility Identity</p>
            <h1 className="text-5xl font-sans text-[#1b1c1c]">Stall QR Credential</h1>
            <p className="text-[9px] font-bold text-[#414844] uppercase tracking-widest mt-2 opacity-60">Authorized Commercial Point of Presence</p>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-[#e05300] text-white text-[10px] px-12 py-5 font-bold uppercase tracking-[0.3em] hover:bg-[#ff6b00] transition-all shadow-xl flex items-center gap-4 rounded-md"
          >
            <span>🖨</span> {t('print') || 'Export for Display'}
          </button>
        </div>

        {/* Print Content Area */}
        <div className="bg-white border border-[#e0e0e0] rounded-lg p-20 flex flex-col items-center justify-center space-y-12 shadow-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0">
          {/* Decorative Corner Accents */}
          <div className="absolute top-0 left-0 w-24 h-24 border-t-8 border-l-8 border-[#ff6b00]"></div>
          <div className="absolute top-0 right-0 w-24 h-24 border-t-8 border-r-8 border-[#ff6b00]"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 border-b-8 border-l-8 border-[#ff6b00]"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 border-b-8 border-r-8 border-[#ff6b00]"></div>

          <div className="text-center space-y-4">
             <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-sans font-black tracking-normal text-[#1b1c1c]">RMF</span>
                <div className="w-2 h-2 bg-[#ff6b00] rounded-full"></div>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.6em] text-[#414844]">Verified Network Merchant</p>
          </div>

          {/* QR Container */}
          <div className="p-10 border-4 border-[#e0e0e0] bg-white shadow-sm">
             {profile ? (
               <img 
                 src={pickupQrUrl} 
                 alt="Pickup verification QR Code" 
                 className="w-64 h-64 md:w-80 md:h-80 object-contain"
               />
             ) : (
               <div className="w-80 h-80 bg-[#fcf9f8] animate-pulse flex items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-20">Encrypting Identity...</span>
               </div>
             )}
          </div>

          <div className="text-center max-w-sm">
            <h2 className="text-3xl font-sans text-[#1b1c1c] mb-4 leading-tight">
               {profile?.shopDetails?.name || ''}
            </h2>
            <p className="text-[11px] font-bold text-[#ff6b00] uppercase tracking-[0.4em] mb-8">STALL ID: {profile?.stallId || ''}</p>
            
            <div className="h-px w-full bg-[#e0e0e0] mb-8"></div>
            
            <p className="text-[9px] text-[#414844] leading-relaxed uppercase tracking-widest opacity-60">
               Riders scan this code during pickup to verify they are collecting from the authorized stall.
            </p>
          </div>

          {/* Footer Branding */}
          <div className="pt-10 border-t border-[#f0eded] w-full text-center">
             <p className="text-[8px] font-black text-[#1b1c1c] uppercase tracking-[0.8em]">Rwanda Marketplace Facilitator</p>
          </div>
        </div>

        {/* Tactical Guidance */}
        <div className="bg-[#ffedd5]/40 border border-[#ebdcd0] p-10 rounded-lg">
           <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1b1c1c] mb-6 flex items-center gap-4">
              <span className="text-[#ff6b00]">ℹ</span> Deployment Instructions
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="text-[11px] text-[#414844] leading-relaxed">
                 1. Print this credential on high-quality cardstock (A4 or A5). <br />
                 2. Place it prominently at your physical stall location. <br />
                 3. Ensure the QR code remains clean and unobstructed for optical scanning.
              </div>
              <div className="text-[11px] text-[#414844] leading-relaxed">
                 4. Riders must scan this exact code before pickup can move to handover. <br />
                 5. Keep your storefront link separately available: {stallUrl || 'loading'} <br />
                 6. Pickup photo proof and QR verification are stored on the delivery record.
              </div>
           </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          nav, aside, header, footer, button, .rmf-container > *:not(.print-target) {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .rmf-container {
             width: 100% !important;
             max-width: none !important;
             padding: 0 !important;
          }
        }
      `}</style>
    </Layout>
  );
}
