'use client';
import React, { useState, useEffect } from 'react';
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
import toast from 'react-hot-toast';

export default function SellerOnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data state
  const { data: markets, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets?type=public&isActive=true');
  const profileUrl = user?.id ? `/sellers/me?userId=${user.id}` : null;
  const { data: profile, loading: profileLoading } = useApi(sellerApi, 'get', profileUrl || '');
  const [activeContract, setActiveContract] = useState<any>(null);
  
  // 1. Redirection Logic: If profile already exists, go to dashboard
  useEffect(() => {
    // ONLY redirect if we have a user and we are CERTAIN a profile exists for them
    if (user?.id && !profileLoading && profile && user.role === 'SELLER') {
      console.log('[Onboarding] Profile detected for active session. Redirecting to dashboard.');
      router.push('/seller/dashboard');
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
      if (!shopName) return toast.error('Shop name is required for a new shop');
      if (daysOpen.length === 0) return toast.error('Please select at least one operational day');
      if (selectedCategories.length === 0) return toast.error('Please select at least one hub category');
    }
    if (step === 1 && !shopLogo) return toast.error('Institutional Logo is required for storefront identity');
    
    if (step === 2 && (!documents.rdb || !documents.rra || !documents.id || !documents.photo)) return toast.error('All documents are required');
    if (step === 3 && (!location || !landmark || !district || !city)) return toast.error('Please pin your location and provide City, District, and Landmark');
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    const allAgreed = Object.values(mandatePoints).every(v => v === true);
    if (!allAgreed) return toast.error('You must verify and accept all institutional mandate points');
    setIsSubmitting(true);
    
    try {
      if (!isAuthenticated || !user?.id) {
        toast.error('You must be logged in to onboard. Please log in first.');
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
      toast.success('Application submitted successfully!');
      router.push('/seller/dashboard');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Submission failed');
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
                <p className="text-[11px] font-black text-[#1b4332] uppercase tracking-[0.6em]">Registry Protocol: v4.2-STABLE</p>
                <div className="w-12 h-px bg-[#ffd700]"></div>
             </div>
             <h1 className="text-7xl font-sans tracking-normal leading-none text-[#1b1c1c]">
                Merchant Mandate Registry
             </h1>
             <p className="text-sm text-[#414844] max-w-xl mx-auto leading-relaxed opacity-70">
                Provide your institutional credentials to facilitate commercial deployment within the Rwanda Market Facilitator network.
             </p>
          </div>

          {/* Tactical Phase Indicator */}
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-[#012d1d]/10 -translate-y-1/2"></div>
            <div className="relative flex justify-between gap-4">
               {[
                 { id: 1, label: 'Selection' },
                 { id: 2, label: 'Credentials' },
                 { id: 3, label: 'Deployment' },
                 { id: 4, label: 'Mandate' }
               ].map((s) => (
                 <div key={s.id} className="flex flex-col items-center gap-4 group">
                    <div className={`w-12 h-12 flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                      step >= s.id ? 'bg-[#012d1d] border-[#e0e0e0] text-white shadow-lg' : 'bg-white border-[#e0e0e0]/10 text-[#1b1c1c]/20'
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
                       <p className="text-[10px] font-black text-[#1b4332] uppercase tracking-[0.4em]">Phase 01</p>
                       <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Visual Identity & Hub Selection</h2>
                    </div>

                    <div className="p-10 border border-[#e0e0e0] rounded-lg bg-[#fcf9f8] space-y-8">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-[#1b1c1c] uppercase tracking-[0.3em]">Visual Identity Protocol</p>
                          <p className="text-xs text-[#414844]">Establish your storefront's aesthetic presence.</p>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                             <label className="text-[9px] font-bold uppercase tracking-widest text-[#1b1c1c]/60">Institutional Logo</label>
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
                             <label className="text-[9px] font-bold uppercase tracking-widest text-[#1b1c1c]/60">Storefront Banner</label>
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
                         className={`p-10 border-2 transition-all cursor-pointer group relative ${marketId ? 'border-[#ffd700] bg-[#fcf9f8]' : 'border-[#e0e0e0]/10 hover:border-[#1b4332]'}`}
                         onClick={() => { setMarketId(markets?.[0]?._id || ''); setShopName(''); }}
                       >
                          <div className="space-y-4">
                             <div className="w-8 h-8 bg-[#012d1d] text-white flex items-center justify-center text-xs">A</div>
                             <h3 className="text-2xl font-sans tracking-normal">Join Established Hub</h3>
                             <p className="text-[10px] text-[#414844] uppercase tracking-widest leading-relaxed opacity-60">Deploy within an existing regional marketplace node.</p>
                          </div>
                          {marketId && <div className="absolute top-6 right-6 text-[#1b4332]">✓</div>}
                          
                          <div className="mt-8">
                             <select 
                               className="w-full bg-white border border-[#e0e0e0]/20 p-4 text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#1b4332]"
                               value={marketId}
                               onChange={e => { setMarketId(e.target.value); setShopName(''); }}
                             >
                               <option value="">Select Protocol Hub...</option>
                               {markets?.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                             </select>
                          </div>
                       </div>

                       <div 
                         className={`p-10 border-2 transition-all cursor-pointer group relative ${!marketId && shopName ? 'border-[#ffd700] bg-[#fcf9f8]' : 'border-[#e0e0e0]/10 hover:border-[#1b4332]'}`}
                         onClick={() => setMarketId('')}
                       >
                          <div className="space-y-4">
                             <div className="w-8 h-8 border border-[#e0e0e0] rounded-lg text-[#1b1c1c] flex items-center justify-center text-xs">B</div>
                             <h3 className="text-2xl font-sans tracking-normal">Initialize Private Hub</h3>
                             <p className="text-[10px] text-[#414844] uppercase tracking-widest leading-relaxed opacity-60">Architect a unique facility with individual branding.</p>
                          </div>
                          {!marketId && shopName && <div className="absolute top-6 right-6 text-[#1b4332]">✓</div>}

                          <div className="mt-8 space-y-6">
                             <input type="text" placeholder="Institutional Name" className="w-full border-b border-[#e0e0e0]/20 p-3 text-sm outline-none focus:border-[#1b4332] bg-transparent" value={shopName} onChange={e => { setShopName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')); }} disabled={!!marketId} />
                             <input type="text" placeholder="Unique Access Slug (Auto-generated)" className="w-full border-b border-[#e0e0e0]/20 p-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#1b4332] bg-transparent" value={slug} onChange={e => setSlug(e.target.value)} disabled={!!marketId} />
                             <textarea placeholder="Facility Description" className="w-full border border-[#e0e0e0]/20 p-4 text-xs outline-none focus:border-[#1b4332] bg-transparent min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} disabled={!!marketId} />
                          </div>
                       </div>
                    </div>

                    {/* Operational Checklists (Persistent Architecture) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-[#fcf9f8] p-10 border border-[#e0e0e0] rounded-lg">
                       <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]">Operational Parameters</p>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">Opening time</span>
                              <input
                                type="time"
                                value={openTime}
                                onChange={e => setOpenTime(e.target.value)}
                                className="w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-3 text-sm font-bold text-[#1b1c1c] outline-none focus:border-[#1b4332]"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">Closing time</span>
                              <input
                                type="time"
                                value={closeTime}
                                onChange={e => setCloseTime(e.target.value)}
                                className="w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-3 text-sm font-bold text-[#1b1c1c] outline-none focus:border-[#1b4332]"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                             {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                               <div 
                                 key={day} 
                                 onClick={() => setDaysOpen(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                 className={`p-3 border-2 text-[10px] font-black text-center cursor-pointer transition-all ${daysOpen.includes(day) ? 'bg-[#012d1d] text-white border-[#e0e0e0]' : 'bg-white text-[#1b1c1c]/40 border-[#e0e0e0]/10'}`}
                               >
                                  {day}
                               </div>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]">Institutional Classification</p>
                          <div className="grid grid-cols-2 gap-3">
                             {['Produce', 'Textiles', 'Handcrafts', 'Meat', 'Electronics', 'Essentials'].map(cat => (
                               <label key={cat} className="flex items-center gap-3 p-4 bg-white border border-[#e0e0e0] rounded-lg/10 cursor-pointer group hover:border-[#1b4332] transition-colors">
                                  <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${selectedCategories.includes(cat) ? 'bg-[#012d1d] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
                                     {selectedCategories.includes(cat) && <span className="text-[10px]">✓</span>}
                                  </div>
                                  <input type="checkbox" className="sr-only" checked={selectedCategories.includes(cat)} onChange={() => setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])} />
                                  <span className="text-[11px] font-black uppercase tracking-widest">{cat}</span>
                                </label>
                             ))}
                          </div>
                       </div>
                    </div>

                    {!marketId && (
                       <div className="pt-4 animate-reveal">
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40 mb-4">Hub Imagery Architecture</p>
                          <ImageUpload 
                            label="Facilitation Photography (Optional)" 
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
                       <p className="text-[10px] font-black text-[#1b4332] uppercase tracking-[0.4em]">Phase 02</p>
                       <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Institutional Credentials</h2>
                       <p className="text-xs text-[#414844]">Verified artifacts required for network participation.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                       {[
                         { id: 'rdb', label: 'RDB Certificate', sub: 'Registry Authority' },
                         { id: 'rra', label: 'RRA Tax Clearance', sub: 'Fiscal Compliance' },
                         { id: 'id', label: 'National Identity', sub: 'Biometric Link' },
                         { id: 'photo', label: 'Stall Artifact', sub: 'Visual Verification' }
                       ].map(doc => (
                         <div key={doc.id} className="p-8 border border-[#e0e0e0]/10 bg-[#FBFBFA] space-y-6 group hover:border-[#1b4332] transition-colors">
                            <div className="flex justify-between items-start">
                               <div className="space-y-1">
                                  <h4 className="text-[11px] font-black uppercase tracking-widest">{doc.label}</h4>
                                  <p className="text-[9px] text-[#414844] opacity-60">{doc.sub}</p>
                               </div>
                               {documents[doc.id as key_of_docs] && <span className="text-[#1b4332] text-xs">UPLOADED</span>}
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
                        <p className="text-[10px] font-black text-[#1b4332] uppercase tracking-[0.4em]">Phase 03</p>
                        <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Logistics Deployment</h2>
                        <p className="text-xs text-[#414844]">Establish your tactical geographic node and operational reach.</p>
                     </div>

                     <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">City Protocol</label>
                              <input type="text" className="w-full border-b-2 border-[#e0e0e0]/10 p-3 text-sm focus:border-[#1b4332] outline-none" value={city} onChange={e => setCity(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">District Node</label>
                              <input type="text" className="w-full border-b-2 border-[#e0e0e0]/10 p-3 text-sm focus:border-[#1b4332] outline-none" value={district} onChange={e => setDistrict(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]/60">Tactical Landmark</label>
                              <input type="text" className="w-full border-b-2 border-[#e0e0e0]/10 p-3 text-sm focus:border-[#1b4332] outline-none" value={landmark} onChange={e => setLandmark(e.target.value)} />
                           </div>
                        </div>

                        <div className="space-y-6 bg-[#012d1d] p-10 text-white">
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1b4332]">Capability Registry</p>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              {[
                                { id: 'delivery', label: 'Home Delivery' },
                                { id: 'bulk', label: 'Bulk Orders' },
                                { id: 'custom', label: 'Custom Works' },
                                { id: 'returns', label: 'Returns Accepted' }
                              ].map(cap => (
                                <label key={cap.id} className="flex items-center gap-4 cursor-pointer group">
                                   <div className={`w-5 h-5 border-2 flex items-center justify-center transition-all ${capabilities[cap.id as keyof typeof capabilities] ? 'bg-[#ffd700] border-[#ffd700] text-white' : 'border-white/20'}`}>
                                      {capabilities[cap.id as keyof typeof capabilities] && <span className="text-[8px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={capabilities[cap.id as keyof typeof capabilities]} onChange={() => setCapabilities(prev => ({...prev, [cap.id]: !prev[cap.id as keyof typeof capabilities]}))} />
                                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">{cap.label}</span>
                                </label>
                              ))}
                           </div>
                        </div>

                        <div className="h-[400px] border border-[#e0e0e0] rounded-lg relative group">
                           <div className="absolute top-6 left-6 z-10 bg-[#012d1d] text-white text-[9px] font-black px-4 py-2 uppercase tracking-widest">Interactive Geopoint Selector</div>
                           <MapPinPicker onLocationSelected={setLocation} />
                        </div>
                     </div>
                  </div>
                 )}

                 {step === 4 && (
                   <div className="space-y-16 animate-reveal">
                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-[#1b4332] uppercase tracking-[0.4em]">Phase 04</p>
                        <h2 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Institutional Mandate Terminal</h2>
                        <p className="text-xs text-[#414844]">Exhaustive verification of commercial and ethical conduct protocols.</p>
                     </div>

                     <div className="rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-6">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1b4332]">Active seller agreement</p>
                            <h3 className="mt-2 text-2xl font-black text-[#1b1c1c]">
                              RMF Partner Agreement {activeContract?.version ? `v${activeContract.version}` : ''}
                            </h3>
                          </div>
                          {activeContract?.publishedAt && (
                            <p className="text-xs font-semibold text-[#414844]">
                              Published {new Date(activeContract.publishedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[#414844]">
                          {activeContract?.content || 'The latest seller agreement could not be loaded. You can continue, but the version will be recorded when the contract service is reachable.'}
                        </p>
                        {Array.isArray(activeContract?.changelog) && activeContract.changelog.length > 0 && (
                          <ul className="mt-4 grid gap-2 text-sm font-semibold text-[#405046]">
                            {activeContract.changelog.map((item: string) => (
                              <li key={item} className="flex gap-2">
                                <span className="text-[#1b4332]">✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                     </div>

                     <div className="space-y-12">
                        {/* Mandate Category: Platform Ethics */}
                        <div className="space-y-6">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#1b4332] border-b border-[#e0e0e0]/10 pb-4">Category 01: Platform Ethics & Conduct</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'e1', label: 'General Terms Compliance', sub: 'Acceptance of all RMF network protocols.' },
                                { id: 'e2', label: 'Anti-Fraud Handshake', sub: 'Commitment to transparent financial reporting.' },
                                { id: 'e3', label: 'Data Privacy Protocol', sub: 'Secure handling of buyer identity markers.' },
                                { id: 'e4', label: 'Dispute Resolution Mandate', sub: 'Acceptance of RMF mediation in conflict.' },
                                { id: 'e5', label: 'Institutional Decorum', sub: 'Professional conduct within the facilitator hub.' }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border border-[#e0e0e0]/5 hover:border-[#1b4332] transition-all bg-white">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-[#012d1d] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
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
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#1b4332] border-b border-[#e0e0e0]/10 pb-4">Category 02: Operational Readiness</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'o1', label: '30-Minute Handover Window', sub: 'Guaranteed prep time for authorized riders.' },
                                { id: 'o2', label: 'Digital Scale Compliance', sub: 'Verified measurement for weight-based assets.' },
                                { id: 'o3', label: 'Real-time Stock Sync', sub: 'Zero-latency inventory status maintenance.' },
                                { id: 'o4', label: 'Packaging Standards', sub: 'Use of RMF-certified or sustainable wrapping.' },
                                { id: 'o5', label: '2% Facilitation Fee', sub: 'Automatic commission deduction acknowledgment.' }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border border-[#e0e0e0]/5 hover:border-[#1b4332] transition-all bg-white">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-[#012d1d] border-[#e0e0e0] text-white' : 'border-[#e0e0e0]/20'}`}>
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
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-red-600 border-b border-red-600/10 pb-4">Category 03: Prohibited Items Protocol</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'x1', label: 'Zero Narcotics Policy', sub: 'Strict ban on illegal substances and paraphernalia.' },
                                { id: 'x2', label: 'Arms & Weapons Mandate', sub: 'Zero tolerance for weaponry or explosives.' },
                                { id: 'x3', label: 'Counterfeit Asset Ban', sub: 'Prohibition of forged or unverified brand replicas.' },
                                { id: 'x4', label: 'Regulated Medical Supplies', sub: 'Ban on non-certified pharmaceuticals.' },
                                { id: 'x5', label: 'Unauthorized Intellectual Property', sub: 'Commitment to original or licensed artifacts only.' }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border-2 border-red-600/5 hover:border-red-600 transition-all bg-red-50/10">
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
                       ← Previous Phase
                     </button>
                   ) : <div />}
                   
                   {step < 4 ? (
                     <button 
                       onClick={handleNext}
                       className="rmf-btn-primary px-16 py-5 bg-[#012d1d] text-white shadow-2xl hover:bg-[#012d1d] transition-all"
                     >
                       Analyze & Continue
                     </button>
                   ) : (
                     <button 
                       onClick={handleSubmit}
                       disabled={isSubmitting}
                       className="rmf-btn-primary px-16 py-5 bg-[#ffd700] text-white shadow-[0_20px_50px_-15px_rgba(246,195,67,0.4)] hover:bg-[#116c4a] transition-all border-none"
                     >
                       {isSubmitting ? 'Syncing...' : 'Submit Registry'}
                     </button>
                   )}
                </div>
             </div>
          </div>
          
          <div className="text-center">
             <p className="text-[8px] font-black text-[#414844] uppercase tracking-[0.5em] opacity-30">Rwanda Market Facilitator Institutional Registry Node v4.2</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

type key_of_docs = 'rdb' | 'rra' | 'id' | 'photo';
