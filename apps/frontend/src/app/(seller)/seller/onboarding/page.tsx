'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import dynamic from 'next/dynamic';
const MapPinPicker = dynamic(() => import('@/components/ui/MapPinPicker').then(mod => mod.MapPinPicker), { ssr: false });
import { useApi } from '@/hooks/useApi';
import { marketApi, sellerApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

const dayKeyMap: Record<string, string> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
};

export default function SellerOnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data state
  const { data: markets, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets?type=public&isActive=true');
  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : null;
  const { data: profile, loading: profileLoading } = useApi(sellerApi, 'get', profileUrl || '');
  const [activeContract, setActiveContract] = useState<any>(null);
  
  // 1. Redirection Logic: If any seller profile already exists, dashboard owns the status UI.
  useEffect(() => {
    if (user?.id && !profileLoading && profile && user.role === 'SELLER') {
      console.log('[Onboarding] Existing seller application detected. Redirecting to dashboard status.');
      router.replace('/seller/dashboard');
    }
  }, [profile, profileLoading, user, router]);
  
  // Form state
  const [marketId, setMarketId] = useState('');
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [marketImage, setMarketImage] = useState('');
  
  const [shopLogo, setShopLogo] = useState('');
  const [shopBanner, setShopBanner] = useState('');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('20:00');
  const [daysOpen, setDaysOpen] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState({ delivery: true, bulk: false, custom: false, returns: true });
  
  const [documents, setDocuments] = useState({ rdb: '', rra: '', id: '', photo: '' });
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [landmark, setLandmark] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('Kigali');
  const [mandatePoints, setMandatePoints] = useState<Record<string, boolean>>({ 
    e1: false, e2: false, e3: false, e4: false, e5: false,
    o1: false, o2: false, o3: false, o4: false, o5: false,
    x1: false, x2: false, x3: false, x4: false, x5: false
  });

  useEffect(() => {
    fetchMarkets();
    marketApi.get('/contracts/active').then(res => setActiveContract(res.data?.data || null)).catch(() => setActiveContract(null));
  }, [fetchMarkets]);

  const handleNext = () => {
    if (step === 1 && !marketId) {
      if (!shopName) return toast.error(t('error_shop_name_req'));
      if (daysOpen.length === 0) return toast.error(t('error_days_open_req'));
      if (selectedCategories.length === 0) return toast.error(t('error_categories_req'));
    }
    if (step === 1 && !shopLogo) return toast.error(t('error_logo_req'));
    
    if (step === 2 && (!documents.rdb || !documents.rra || !documents.id || !documents.photo)) return toast.error(t('error_docs_req'));
    if (step === 3 && (!location || !landmark || !district || !city)) return toast.error(t('error_loc_req'));
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    const allAgreed = Object.values(mandatePoints).every(v => v === true);
    if (!allAgreed) return toast.error(t('error_mandate_req'));
    setIsSubmitting(true);
    
    try {
      if (!isAuthenticated || !user?.id) {
        toast.error(t('error_login_req'));
        router.push('/login');
        return;
      }

      await sellerApi.post('/sellers/onboard', {
        userId: user.id,
        marketId: marketId || null,
        shopDetails: { 
          name: shopName || markets?.find((m: any) => m._id === marketId)?.name, 
          slug: slug || `stall-${Date.now()}`, 
          description, 
          imageUrl: shopLogo,
          logoUrl: shopLogo,
          bannerUrl: shopBanner,
          hubImageUrl: marketImage,
          daysOpen,
          operatingHours: { open: openTime, close: closeTime, daysOpen },
          categories: selectedCategories
        },
        documents,
        capabilities,
        stallLocation: location,
        address: `${district}, ${landmark}`, // Combine for backend address
        city,
        contractVersion: activeContract?.version,
        agreedToTerms: allAgreed
      });
      toast.success(t('app_submitted_success'));
      router.replace('/seller/dashboard');
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('submission_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#fcf9f8] pb-32 pt-16 px-6 animate-reveal">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Institutional Header */}
          <div className="text-center space-y-6">
             <div className="flex items-center justify-center gap-6">
                <div className="w-12 h-px bg-[#ffd700]"></div>
                <p className="text-[11px] font-black text-[#ff6b00] uppercase tracking-[0.6em]">{t('registry_protocol')}</p>
                <div className="w-12 h-px bg-[#ffd700]"></div>
             </div>
             <h1 className="text-7xl font-sans tracking-normal leading-none text-[#1b1c1c]">
                {t('merchant_mandate_registry')}
             </h1>
             <p className="text-sm text-[#414844] max-w-xl mx-auto leading-relaxed opacity-70">
                {t('onboarding_desc')}
             </p>
          </div>

          {/* Tactical Phase Indicator */}
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-[#ff6b00]/10 -translate-y-1/2"></div>
            <div className="relative flex justify-between gap-4">
               {[
                 { id: 1, label: t('phase_selection') },
                 { id: 2, label: t('phase_credentials') },
                 { id: 3, label: t('phase_deployment') },
                 { id: 4, label: t('phase_mandate') }
               ].map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-4 group">
                     <div className={`w-12 h-12 flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                       step >= s.id ? 'bg-[#ff6b00] border-[#ebdcd0] text-white shadow-lg' : 'bg-white border-[#ebdcd0]/10 text-[#1b1c1c]/20'
                     }`}>
                        <span className="text-xs font-black tracking-normal">0{s.id}</span>
                     </div>
                     <span className={`text-[9px] font-black uppercase tracking-[0.3em] transition-colors ${
                       step >= s.id ? 'text-[#1b1c1c]' : 'text-[#1b1c1c]/20'
                     }`}>{s.label}</span>
                  </div>
               ))}
            </div>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-lg shadow-[0_40px_100px_-20px_rgba(18,18,18,0.15)] relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-[#ffd700]"></div>
             
             <div className="p-12 md:p-20 space-y-16">
                {step === 1 && (
                  <div className="space-y-16 animate-reveal">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.4em]">{t('phase_01')}</p>
                       <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">{t('visual_identity_hub_selection')}</h2>
                    </div>

                    <div className="p-10 border border-[#e0e0e0] rounded-lg bg-[#fcf9f8] space-y-8">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-[0.3em]">{t('visual_identity_protocol')}</p>
                          <p className="text-xs text-[#414844]">{t('storefront_aesthetic_desc')}</p>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                             <label className="text-[9px] font-bold uppercase tracking-widest text-[#1b1c1c]/60">{t('institutional_logo')}</label>
                             <ImageUpload 
                                label=""
                                service="seller"
                                endpoint="/sellers/upload-document"
                                kind="image"
                                value={shopLogo}
                                onChange={setShopLogo}
                             />
                          </div>
                          <div className="space-y-4">
                             <label className="text-[9px] font-bold uppercase tracking-widest text-[#1b1c1c]/60">{t('storefront_banner')}</label>
                             <ImageUpload 
                                label=""
                                service="seller"
                                endpoint="/sellers/upload-document"
                                kind="image"
                                value={shopBanner}
                                onChange={setShopBanner}
                             />
                          </div>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div 
                         className={`p-10 border-2 transition-all cursor-pointer group relative ${marketId ? 'border-[#ffd700] bg-[#fcf9f8]' : 'border-[#e0e0e0]/15 hover:border-[#ff6b00]'}`}
                         onClick={() => { setMarketId(markets?.[0]?._id || ''); setShopName(''); }}
                       >
                          <div className="space-y-4">
                             <div className="w-8 h-8 bg-[#ff6b00] text-white flex items-center justify-center text-xs">A</div>
                             <h3 className="text-2xl font-sans tracking-normal">{t('join_established_hub')}</h3>
                             <p className="text-[10px] text-[#414844] uppercase tracking-widest leading-relaxed opacity-60">{t('join_established_hub_desc')}</p>
                          </div>
                          {marketId && <div className="absolute top-6 right-6 text-[#ff6b00]">✓</div>}
                          
                          <div className="mt-8">
                             <select 
                               className="w-full bg-white border border-[#e0e0e0]/20 p-4 text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#ff6b00]"
                               value={marketId}
                               onChange={e => { setMarketId(e.target.value); setShopName(''); }}
                             >
                               <option value="">{t('select_protocol_hub')}</option>
                               {markets?.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                             </select>
                          </div>
                       </div>

                       <div 
                         className={`p-10 border-2 transition-all cursor-pointer group relative ${!marketId && shopName ? 'border-[#ffd700] bg-[#fcf9f8]' : 'border-[#e0e0e0]/15 hover:border-[#ff6b00]'}`}
                         onClick={() => setMarketId('')}
                       >
                          <div className="space-y-4">
                             <div className="w-8 h-8 border border-[#e0e0e0] rounded-lg text-[#1b1c1c] flex items-center justify-center text-xs">B</div>
                             <h3 className="text-2xl font-sans tracking-normal">{t('initialize_private_hub')}</h3>
                             <p className="text-[10px] text-[#414844] uppercase tracking-widest leading-relaxed opacity-60">{t('initialize_private_hub_desc')}</p>
                          </div>
                          {!marketId && shopName && <div className="absolute top-6 right-6 text-[#ff6b00]">✓</div>}

                          <div className="mt-8 space-y-6">
                             <input type="text" placeholder={t('institutional_name')} className="w-full border-b border-[#e0e0e0]/20 p-3 text-sm outline-none focus:border-[#ff6b00] bg-transparent" value={shopName} onChange={e => { setShopName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')); }} disabled={!!marketId} />
                             <input type="text" placeholder={t('unique_access_slug')} className="w-full border-b border-[#e0e0e0]/20 p-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#ff6b00] bg-transparent" value={slug} onChange={e => setSlug(e.target.value)} disabled={!!marketId} />
                             <textarea placeholder={t('facility_description')} className="w-full border border-[#e0e0e0]/20 p-4 text-xs outline-none focus:border-[#ff6b00] bg-transparent min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} disabled={!!marketId} />
                          </div>
                       </div>
                    </div>

                    {/* Operational Checklists (Persistent Architecture) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-[#fcf9f8] p-10 border border-[#e0e0e0] rounded-lg">
                       <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]">{t('operational_parameters')}</p>
                          <div className="grid grid-cols-2 gap-3">
                             <label className="block">
                               <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">{t('opening_time')}</span>
                               <input
                                 type="time"
                                 value={openTime}
                                 onChange={e => setOpenTime(e.target.value)}
                                 className="w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-3 text-sm font-bold text-[#1b1c1c] outline-none focus:border-[#ff6b00]"
                                />
                             </label>
                             <label className="block">
                               <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">{t('closing_time')}</span>
                               <input
                                 type="time"
                                 value={closeTime}
                                 onChange={e => setCloseTime(e.target.value)}
                                 className="w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-3 text-sm font-bold text-[#1b1c1c] outline-none focus:border-[#ff6b00]"
                               />
                             </label>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                             {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                               <div 
                                 key={day} 
                                 onClick={() => setDaysOpen(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                 className={`p-3 border-2 text-[10px] font-black text-center cursor-pointer transition-all ${daysOpen.includes(day) ? 'bg-[#ff6b00] text-white border-[#ebdcd0]' : 'bg-white text-[#1b1c1c]/40 border-[#ebdcd0]/10'}`}
                               >
                                  {t(dayKeyMap[day])}
                               </div>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]">{t('institutional_classification')}</p>
                          <div className="grid grid-cols-2 gap-3">
                              {[
                                { key: 'grocery', translationKey: 'cat_produce' },
                                { key: 'fashion', translationKey: 'cat_textiles' },
                                { key: 'shoes', translationKey: 'cat_shoes' },
                                { key: 'sportswear', translationKey: 'cat_sportswear' },
                                { key: 'bakery', translationKey: 'cat_bakery' },
                                { key: 'hardware', translationKey: 'cat_hardware' },
                                { key: 'handicrafts', translationKey: 'cat_handcrafts' },
                                { key: 'home', translationKey: 'cat_home' },
                                { key: 'electronics', translationKey: 'cat_electronics' },
                                { key: 'cosmetics', translationKey: 'cat_cosmetics' },
                                { key: 'automotive', translationKey: 'cat_automotive' },
                                { key: 'education', translationKey: 'cat_education' },
                                { key: 'other', translationKey: 'cat_other' },
                              ].map(cat => (
                                <label key={cat.key} className="flex items-center gap-3 p-4 bg-white border border-[#e0e0e0] rounded-lg/10 cursor-pointer group hover:border-[#ff6b00] transition-colors">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${selectedCategories.includes(cat.key) ? 'bg-[#ff6b00] border-[#ebdcd0] text-white' : 'border-[#ebdcd0]/20'}`}>
                                      {selectedCategories.includes(cat.key) && <span className="text-[10px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={selectedCategories.includes(cat.key)} onChange={() => setSelectedCategories(prev => prev.includes(cat.key) ? prev.filter(c => c !== cat.key) : [...prev, cat.key])} />
                                   <span className="text-[11px] font-black uppercase tracking-widest">{t(cat.translationKey)}</span>
                                </label>
                              ))}
                          </div>
                       </div>
                    </div>

                    {!marketId && (
                       <div className="pt-4 animate-reveal">
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40 mb-4">{t('hub_imagery_architecture')}</p>
                          <ImageUpload 
                            label={t('facilitation_photography')} 
                            value={marketImage}
                            onChange={setMarketImage}
                            service="market" 
                            endpoint="/markets/upload-image" 
                            onUploadSuccess={url => setMarketImage(url)} 
                          />
                       </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-16 animate-reveal">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.4em]">{t('phase_02')}</p>
                       <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">{t('credentials_title')}</h2>
                       <p className="text-xs text-[#414844]">{t('credentials_desc')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                       {[
                         { id: 'rdb', label: t('rdb_cert'), sub: t('rdb_cert_sub') },
                         { id: 'rra', label: t('rra_tax'), sub: t('rra_tax_sub') },
                         { id: 'id', label: t('nid_title'), sub: t('nid_sub') },
                         { id: 'photo', label: t('stall_artifact'), sub: t('stall_artifact_sub') }
                       ].map(doc => (
                          <div key={doc.id} className="p-8 border border-[#e0e0e0]/10 bg-[#FBFBFA] space-y-6 group hover:border-[#ff6b00] transition-colors">
                             <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                   <h4 className="text-[11px] font-black uppercase tracking-widest">{doc.label}</h4>
                                   <p className="text-[9px] text-[#414844] opacity-60">{doc.sub}</p>
                                </div>
                                {documents[doc.id as key_of_docs] && <span className="text-[#ff6b00] text-xs">{t('document_uploaded')}</span>}
                             </div>
                             <ImageUpload 
                                label="" 
                                service="seller" 
                                endpoint="/sellers/upload-document" 
                                kind="document"
                                onUploadSuccess={url => setDocuments({...documents, [doc.id]: url})} 
                             />
                          </div>
                       ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                   <div className="space-y-16 animate-reveal">
                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.4em]">{t('phase_03')}</p>
                        <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">{t('logistics_deployment')}</h2>
                        <p className="text-xs text-[#414844]">{t('logistics_deployment_desc')}</p>
                     </div>

                     <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">{t('city_protocol')}</label>
                              <input type="text" className="w-full border-b-2 border-[#e0e0e0]/10 p-3 text-sm focus:border-[#ff6b00] outline-none" value={city} onChange={e => setCity(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">{t('district_node')}</label>
                              <input type="text" className="w-full border-b-2 border-[#e0e0e0]/10 p-3 text-sm focus:border-[#ff6b00] outline-none" value={district} onChange={e => setDistrict(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">{t('tactical_landmark')}</label>
                              <input type="text" className="w-full border-b-2 border-[#e0e0e0]/10 p-3 text-sm focus:border-[#ff6b00] outline-none" value={landmark} onChange={e => setLandmark(e.target.value)} />
                           </div>
                        </div>

                        <div className="space-y-6 bg-[#ff6b00] p-10 text-white rounded-lg">
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ffedd5]">{t('capability_registry')}</p>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              {[
                                { id: 'delivery', label: t('home_delivery') },
                                { id: 'bulk', label: t('bulk_orders') },
                                { id: 'custom', label: t('custom_works') },
                                { id: 'returns', label: t('returns_accepted') }
                              ].map(cap => (
                                <label key={cap.id} className="flex items-center gap-4 cursor-pointer group">
                                   <div className={`w-5 h-5 border-2 flex items-center justify-center transition-all ${capabilities[cap.id as keyof typeof capabilities] ? 'bg-[#ffd700] border-[#ffd700] text-[#1b1c1c]' : 'border-white/20'}`}>
                                      {capabilities[cap.id as keyof typeof capabilities] && <span className="text-[8px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={capabilities[cap.id as keyof typeof capabilities]} onChange={() => setCapabilities(prev => ({...prev, [cap.id]: !prev[cap.id as keyof typeof capabilities]}))} />
                                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 group-hover:opacity-100">{cap.label}</span>
                                </label>
                              ))}
                           </div>
                        </div>

                        <div className="h-[400px] border border-[#e0e0e0] rounded-lg relative group overflow-hidden">
                           <div className="absolute top-6 left-6 z-10 bg-[#ff6b00] text-white text-[9px] font-black px-4 py-2 uppercase tracking-widest shadow-md rounded">{t('interactive_geopoint_selector')}</div>
                           <MapPinPicker onLocationSelected={setLocation} />
                        </div>
                     </div>
                  </div>
                 )}

                 {step === 4 && (
                   <div className="space-y-16 animate-reveal">
                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-[#ff6b00] uppercase tracking-[0.4em]">{t('phase_04')}</p>
                        <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">{t('mandate_terminal')}</h2>
                        <p className="text-xs text-[#414844]">{t('mandate_terminal_desc')}</p>
                     </div>

                     <div className="rounded-lg border border-[#ebdcd0] bg-[#fcf9f8] p-6 shadow-sm">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start pb-4 border-b border-[#ebdcd0]/30">
                           <div>
                             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff6b00]">{t('active_seller_agreement')}</p>
                             <h3 className="mt-2 text-2xl font-black text-[#1b1c1c]">
                               {t('partner_agreement')} {activeContract?.version ? `v${activeContract.version}` : ''}
                             </h3>
                           </div>
                           {activeContract?.publishedAt && (
                             <p className="text-xs font-semibold text-[#414844]">
                               {t('published')} {new Date(activeContract.publishedAt).toLocaleDateString()}
                             </p>
                           )}
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[#414844] whitespace-pre-line">
                           {activeContract?.content || t('contract_load_failed')}
                        </p>
                        {Array.isArray(activeContract?.changelog) && activeContract.changelog.length > 0 && (
                          <ul className="mt-4 grid gap-2 text-sm font-semibold text-[#405046]">
                            {activeContract.changelog.map((item: string) => (
                              <li key={item} className="flex gap-2">
                                <span className="text-[#ff6b00]">✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                     </div>

                     <div className="space-y-12">
                        {/* Mandate Category: Platform Ethics */}
                        <div className="space-y-6">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#ff6b00] border-b border-[#ebdcd0]/30 pb-4">{t('category_01_ethics')}</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'e1', label: t('e1_title'), sub: t('e1_sub') },
                                { id: 'e2', label: t('e2_title'), sub: t('e2_sub') },
                                { id: 'e3', label: t('e3_title'), sub: t('e3_sub') },
                                { id: 'e4', label: t('e4_title'), sub: t('e4_sub') },
                                { id: 'e5', label: t('e5_title'), sub: t('e5_sub') }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border border-[#e0e0e0]/5 hover:border-[#ff6b00] transition-all bg-white shadow-sm">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-[#ff6b00] border-[#ebdcd0] text-white shadow-sm' : 'border-[#ebdcd0]/20'}`}>
                                      {mandatePoints[p.id as keyof typeof mandatePoints] && <span className="text-[10px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={mandatePoints[p.id as keyof typeof mandatePoints]} onChange={() => setMandatePoints(prev => ({...prev, [p.id]: !prev[p.id as keyof typeof mandatePoints]}))} />
                                   <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest block">{p.label}</span>
                                      <span className="text-[8px] text-[#414844] opacity-60">{p.sub}</span>
                                   </div>
                                </label>
                              ))}
                           </div>
                        </div>

                        {/* Mandate Category: Operational Readiness */}
                        <div className="space-y-6">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#ff6b00] border-b border-[#ebdcd0]/30 pb-4">{t('category_02_readiness')}</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'o1', label: t('o1_title'), sub: t('o1_sub') },
                                { id: 'o2', label: t('o2_title'), sub: t('o2_sub') },
                                { id: 'o3', label: t('o3_title'), sub: t('o3_sub') },
                                { id: 'o4', label: t('o4_title'), sub: t('o4_sub') },
                                { id: 'o5', label: t('o5_title'), sub: t('o5_sub') }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border border-[#e0e0e0]/5 hover:border-[#ff6b00] transition-all bg-white shadow-sm">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-[#ff6b00] border-[#ebdcd0] text-white shadow-sm' : 'border-[#ebdcd0]/20'}`}>
                                      {mandatePoints[p.id as keyof typeof mandatePoints] && <span className="text-[10px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={mandatePoints[p.id as keyof typeof mandatePoints]} onChange={() => setMandatePoints(prev => ({...prev, [p.id]: !prev[p.id as keyof typeof mandatePoints]}))} />
                                   <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest block">{p.label}</span>
                                      <span className="text-[8px] text-[#414844] opacity-60">{p.sub}</span>
                                   </div>
                                </label>
                              ))}
                           </div>
                        </div>

                        {/* Mandate Category: Prohibited Items */}
                        <div className="space-y-6">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-red-600 border-b border-red-600/10 pb-4">{t('category_03_prohibited')}</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'x1', label: t('x1_title'), sub: t('x1_sub') },
                                { id: 'x2', label: t('x2_title'), sub: t('x2_sub') },
                                { id: 'x3', label: t('x3_title'), sub: t('x3_sub') },
                                { id: 'x4', label: t('x4_title'), sub: t('x4_sub') },
                                { id: 'x5', label: t('x5_title'), sub: t('x5_sub') }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border-2 border-red-600/5 hover:border-red-600 transition-all bg-red-50/10 shadow-sm">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-red-600 border-red-600 text-white' : 'border-red-600/20'}`}>
                                      {mandatePoints[p.id as keyof typeof mandatePoints] && <span className="text-[10px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={mandatePoints[p.id as keyof typeof mandatePoints]} onChange={() => setMandatePoints(prev => ({...prev, [p.id]: !prev[p.id as keyof typeof mandatePoints]}))} />
                                   <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest block text-red-900">{p.label}</span>
                                      <span className="text-[8px] text-red-700/60 opacity-60">{p.sub}</span>
                                   </div>
                                </label>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                 )}

                 {/* Navigation Terminal */}
                 <div className="pt-16 border-t border-[#e0e0e0]/10 flex justify-between items-center">
                    {step > 1 ? (
                      <button 
                        onClick={() => setStep(s => s - 1)}
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b1c1c]/40 hover:text-[#1b1c1c] transition-colors"
                      >
                        {t('previous_phase')}
                      </button>
                    ) : <div />}
                    
                    {step < 4 ? (
                      <button 
                        onClick={handleNext}
                        className="rmf-btn-primary px-16 py-5 bg-[#e05300] text-white shadow-2xl hover:bg-[#ff6b00] transition-all rounded-md font-bold text-xs uppercase tracking-widest"
                      >
                        {t('analyze_continue')}
                      </button>
                    ) : (
                      <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="rmf-btn-primary px-16 py-5 bg-[#e05300] text-white shadow-[0_20px_50px_-15px_rgba(224,83,0,0.3)] hover:bg-[#ff6b00] transition-all border-none rounded-md font-bold text-xs uppercase tracking-widest"
                      >
                        {isSubmitting ? t('syncing') : t('submit_registry')}
                      </button>
                    )}
                 </div>
              </div>
           </div>
           
           <div className="text-center">
              <p className="text-[8px] font-black text-[#414844] uppercase tracking-[0.5em] opacity-30">{t('registry_node_v4')}</p>
           </div>
        </div>
      </div>
    </Layout>
  );
}

type key_of_docs = 'rdb' | 'rra' | 'id' | 'photo';
