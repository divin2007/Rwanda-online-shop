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

  const stallUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${profile?.shopDetails?.slug || 'market'}.${window.location.host}`
    : '';

  // Generate a mock QR URL using a service like qrcode.monkey or similar
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(stallUrl)}`;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-16 pb-20 animate-reveal">
        {/* Institutional Header */}
        <div className="flex justify-between items-end border-b border-[#E5E1D8] pb-10">
          <div>
            <p className="text-[10px] font-bold text-[#A34D15] uppercase tracking-[0.5em] mb-3">Facility Identity</p>
            <h1 className="text-5xl font-serif text-[#1A1A1A] italic">Stall QR Credential</h1>
            <p className="text-[9px] font-bold text-[#6B665E] uppercase tracking-widest mt-2 opacity-60">Authorized Commercial Point of Presence</p>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-[#121212] text-white text-[10px] px-12 py-5 font-bold uppercase tracking-[0.3em] hover:bg-[#A34D15] transition-all shadow-xl flex items-center gap-4"
          >
            <span>🖨</span> {t('print') || 'Export for Display'}
          </button>
        </div>

        {/* Print Content Area */}
        <div className="bg-white border-2 border-[#121212] p-20 flex flex-col items-center justify-center space-y-12 shadow-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0">
          {/* Decorative Corner Accents */}
          <div className="absolute top-0 left-0 w-24 h-24 border-t-8 border-l-8 border-[#A34D15]"></div>
          <div className="absolute top-0 right-0 w-24 h-24 border-t-8 border-r-8 border-[#A34D15]"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 border-b-8 border-l-8 border-[#A34D15]"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 border-b-8 border-r-8 border-[#A34D15]"></div>

          <div className="text-center space-y-4">
             <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-serif font-black tracking-tighter text-[#121212]">RMF</span>
                <div className="w-2 h-2 bg-[#A34D15] rounded-full"></div>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.6em] text-[#6B665E]">Verified Network Merchant</p>
          </div>

          {/* QR Container */}
          <div className="p-10 border-4 border-[#121212] bg-white shadow-sm">
             {profile ? (
               <img 
                 src={qrUrl} 
                 alt="Stall QR Code" 
                 className="w-64 h-64 md:w-80 md:h-80 object-contain"
               />
             ) : (
               <div className="w-80 h-80 bg-[#F8F6F1] animate-pulse flex items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-20">Encrypting Identity...</span>
               </div>
             )}
          </div>

          <div className="text-center max-w-sm">
            <h2 className="text-3xl font-serif text-[#121212] mb-4 italic leading-tight">
               {profile?.shopDetails?.name || ''}
            </h2>
            <p className="text-[11px] font-bold text-[#A34D15] uppercase tracking-[0.4em] mb-8">STALL ID: {profile?.stallId || ''}</p>
            
            <div className="h-px w-full bg-[#E5E1D8] mb-8"></div>
            
            <p className="text-[9px] text-[#6B665E] leading-relaxed uppercase tracking-widest italic opacity-60">
              Scan this code to initialize a secure MoMo transaction directly with this authorized RMF station.
            </p>
          </div>

          {/* Footer Branding */}
          <div className="pt-10 border-t border-[#F0EDE4] w-full text-center">
             <p className="text-[8px] font-black text-[#121212] uppercase tracking-[0.8em]">Rwanda Marketplace Facilitator</p>
          </div>
        </div>

        {/* Tactical Guidance */}
        <div className="bg-[#F2F0EB]/50 border border-[#E5E1D8] p-10">
           <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#121212] mb-6 flex items-center gap-4">
              <span className="text-[#A34D15]">ℹ</span> Deployment Instructions
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="text-[11px] text-[#6B665E] leading-relaxed italic">
                 1. Print this credential on high-quality cardstock (A4 or A5). <br />
                 2. Place it prominently at your physical stall location. <br />
                 3. Ensure the QR code remains clean and unobstructed for optical scanning.
              </div>
              <div className="text-[11px] text-[#6B665E] leading-relaxed italic">
                 4. Customers will scan this to land directly on your digital storefront. <br />
                 5. All transactions are routed through the RMF secure facilitation layer. <br />
                 6. Digital receipts are issued instantly upon successful payment.
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
