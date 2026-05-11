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
  const [agreement, setAgreement] = useState('');
  
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
    marketApi.get('/markets/agreement').then(res => setAgreement(res.data?.data || ''));
  }, [fetchMarkets]);

  const handleNext = () => {
    if (step === 1 && !marketId) {
      if (!shopName || !slug || !marketImage) return toast.error('Shop name, slug, and Hub Image are required for a new shop');
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
          categories: selectedCategories
        },
        documents,
        stallLocation: location,
        address: `${district}, ${landmark}`, // Combine for backend address
        city,
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
      <div className="min-h-screen bg-[#F8F6F1] pb-32 pt-16 px-6 animate-reveal">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Institutional Header */}
          <div className="text-center space-y-6">
             <div className="flex items-center justify-center gap-6">
                <div className="w-12 h-px bg-[#F59E0B]"></div>
                <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.6em]">Registry Protocol: v4.2-STABLE</p>
                <div className="w-12 h-px bg-[#F59E0B]"></div>
             </div>
             <h1 className="text-7xl font-serif tracking-tighter italic leading-none text-[#121212]">
                Merchant Mandate Registry
             </h1>
             <p className="text-sm text-[#6B665E] italic max-w-xl mx-auto leading-relaxed opacity-70">
                Provide your institutional credentials to facilitate commercial deployment within the Rwanda Market Facilitator network.
             </p>
          </div>

          {/* Tactical Phase Indicator */}
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-[#121212]/10 -translate-y-1/2"></div>
            <div className="relative flex justify-between gap-4">
               {[
                 { id: 1, label: 'Selection' },
                 { id: 2, label: 'Credentials' },
                 { id: 3, label: 'Deployment' },
                 { id: 4, label: 'Mandate' }
               ].map((s) => (
                 <div key={s.id} className="flex flex-col items-center gap-4 group">
                    <div className={`w-12 h-12 flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                      step >= s.id ? 'bg-[#121212] border-[#121212] text-white shadow-lg' : 'bg-white border-[#121212]/10 text-[#121212]/20'
                    }`}>
                       <span className="text-xs font-black tracking-tighter">0{s.id}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-[0.3em] transition-colors ${
                      step >= s.id ? 'text-[#121212]' : 'text-[#121212]/20'
                    }`}>{s.label}</span>
                 </div>
               ))}
            </div>
          </div>

          <div className="bg-white border-2 border-[#121212] shadow-[0_40px_100px_-20px_rgba(18,18,18,0.15)] relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-[#F59E0B]"></div>
             
             <div className="p-12 md:p-20 space-y-16">
                {step === 1 && (
                  <div className="space-y-16 animate-reveal">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.4em]">Phase 01</p>
                       <h2 className="text-4xl font-serif italic tracking-tighter text-[#121212]">Visual Identity & Hub Selection</h2>
                    </div>

                    <div className="p-10 border-2 border-[#121212] bg-[#F8F6F1] space-y-8">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.3em]">Visual Identity Protocol</p>
                          <p className="text-xs text-[#6B665E] italic">Establish your storefront's aesthetic presence.</p>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                             <label className="text-[9px] font-bold uppercase tracking-widest text-[#121212]/60">Institutional Logo</label>
                             <ImageUpload 
                                label=""
                                service="seller"
                                endpoint="/sellers/upload-document"
                                value={shopLogo}
                                onChange={setShopLogo}
                             />
                          </div>
                          <div className="space-y-4">
                             <label className="text-[9px] font-bold uppercase tracking-widest text-[#121212]/60">Storefront Banner</label>
                             <ImageUpload 
                                label=""
                                service="seller"
                                endpoint="/sellers/upload-document"
                                value={shopBanner}
                                onChange={setShopBanner}
                             />
                          </div>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div 
                         className={`p-10 border-2 transition-all cursor-pointer group relative ${marketId ? 'border-[#F59E0B] bg-[#F8F6F1]' : 'border-[#121212]/10 hover:border-[#121212]'}`}
                         onClick={() => { setMarketId(markets?.[0]?._id || ''); setShopName(''); }}
                       >
                          <div className="space-y-4">
                             <div className="w-8 h-8 bg-[#121212] text-white flex items-center justify-center text-xs">A</div>
                             <h3 className="text-2xl font-serif italic tracking-tighter">Join Established Hub</h3>
                             <p className="text-[10px] text-[#6B665E] uppercase tracking-widest leading-relaxed opacity-60">Deploy within an existing regional marketplace node.</p>
                          </div>
                          {marketId && <div className="absolute top-6 right-6 text-[#F59E0B]">✓</div>}
                          
                          <div className="mt-8">
                             <select 
                               className="w-full bg-white border border-[#121212]/20 p-4 text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#121212]"
                               value={marketId}
                               onChange={e => { setMarketId(e.target.value); setShopName(''); }}
                             >
                               <option value="">Select Protocol Hub...</option>
                               {markets?.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                             </select>
                          </div>
                       </div>

                       <div 
                         className={`p-10 border-2 transition-all cursor-pointer group relative ${!marketId && shopName ? 'border-[#F59E0B] bg-[#F8F6F1]' : 'border-[#121212]/10 hover:border-[#121212]'}`}
                         onClick={() => setMarketId('')}
                       >
                          <div className="space-y-4">
                             <div className="w-8 h-8 border-2 border-[#121212] text-[#121212] flex items-center justify-center text-xs">B</div>
                             <h3 className="text-2xl font-serif italic tracking-tighter">Initialize Private Hub</h3>
                             <p className="text-[10px] text-[#6B665E] uppercase tracking-widest leading-relaxed opacity-60">Architect a unique facility with individual branding.</p>
                          </div>
                          {!marketId && shopName && <div className="absolute top-6 right-6 text-[#F59E0B]">✓</div>}

                          <div className="mt-8 space-y-6">
                             <input type="text" placeholder="Institutional Name" className="w-full border-b border-[#121212]/20 p-3 text-sm italic outline-none focus:border-[#121212] bg-transparent" value={shopName} onChange={e => setShopName(e.target.value)} disabled={!!marketId} />
                             <input type="text" placeholder="Unique Access Slug (e.g. jado-shop)" className="w-full border-b border-[#121212]/20 p-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#121212] bg-transparent" value={slug} onChange={e => setSlug(e.target.value)} disabled={!!marketId} />
                             <textarea placeholder="Facility Description" className="w-full border border-[#121212]/20 p-4 text-xs italic outline-none focus:border-[#121212] bg-transparent min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} disabled={!!marketId} />
                          </div>
                       </div>
                    </div>

                    {/* Operational Checklists (Persistent Architecture) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-[#F8F6F1] p-10 border-2 border-[#121212]">
                       <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#121212] italic">Operational Parameters</p>
                          <div className="grid grid-cols-4 gap-2">
                             {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                               <div 
                                 key={day} 
                                 onClick={() => setDaysOpen(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                 className={`p-3 border-2 text-[10px] font-black text-center cursor-pointer transition-all ${daysOpen.includes(day) ? 'bg-[#121212] text-white border-[#121212]' : 'bg-white text-[#121212]/40 border-[#121212]/10'}`}
                               >
                                  {day}
                               </div>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#121212] italic">Institutional Classification</p>
                          <div className="grid grid-cols-2 gap-3">
                             {['Produce', 'Textiles', 'Handcrafts', 'Meat', 'Electronics', 'Essentials'].map(cat => (
                               <label key={cat} className="flex items-center gap-3 p-4 bg-white border-2 border-[#121212]/10 cursor-pointer group hover:border-[#121212] transition-colors">
                                  <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${selectedCategories.includes(cat) ? 'bg-[#121212] border-[#121212] text-white' : 'border-[#121212]/20'}`}>
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
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#121212]/40 mb-4 italic">Hub Imagery Architecture</p>
                          <ImageUpload 
                            label="Facilitation Photography" 
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
                       <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.4em]">Phase 02</p>
                       <h2 className="text-4xl font-serif italic tracking-tighter text-[#121212]">Institutional Credentials</h2>
                       <p className="text-xs text-[#6B665E] italic">Verified artifacts required for network participation.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                       {[
                         { id: 'rdb', label: 'RDB Certificate', sub: 'Registry Authority' },
                         { id: 'rra', label: 'RRA Tax Clearance', sub: 'Fiscal Compliance' },
                         { id: 'id', label: 'National Identity', sub: 'Biometric Link' },
                         { id: 'photo', label: 'Stall Artifact', sub: 'Visual Verification' }
                       ].map(doc => (
                         <div key={doc.id} className="p-8 border border-[#121212]/10 bg-[#FBFBFA] space-y-6 group hover:border-[#121212] transition-colors">
                            <div className="flex justify-between items-start">
                               <div className="space-y-1">
                                  <h4 className="text-[11px] font-black uppercase tracking-widest">{doc.label}</h4>
                                  <p className="text-[9px] text-[#6B665E] italic opacity-60">{doc.sub}</p>
                               </div>
                               {documents[doc.id as key_of_docs] && <span className="text-[#F59E0B] text-xs">UPLOADED</span>}
                            </div>
                            <ImageUpload 
                               label="" 
                               service="seller" 
                               endpoint="/sellers/upload-document" 
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
                        <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.4em]">Phase 03</p>
                        <h2 className="text-4xl font-serif italic tracking-tighter text-[#121212]">Logistics Deployment</h2>
                        <p className="text-xs text-[#6B665E] italic">Establish your tactical geographic node and operational reach.</p>
                     </div>

                     <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]/60">City Protocol</label>
                              <input type="text" className="w-full border-b-2 border-[#121212]/10 p-3 text-sm italic focus:border-[#121212] outline-none" value={city} onChange={e => setCity(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]/60">District Node</label>
                              <input type="text" className="w-full border-b-2 border-[#121212]/10 p-3 text-sm italic focus:border-[#121212] outline-none" value={district} onChange={e => setDistrict(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#121212]/60">Tactical Landmark</label>
                              <input type="text" className="w-full border-b-2 border-[#121212]/10 p-3 text-sm italic focus:border-[#121212] outline-none" value={landmark} onChange={e => setLandmark(e.target.value)} />
                           </div>
                        </div>

                        <div className="space-y-6 bg-[#121212] p-10 text-white">
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#F59E0B] italic">Capability Registry</p>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              {[
                                { id: 'delivery', label: 'Home Delivery' },
                                { id: 'bulk', label: 'Bulk Orders' },
                                { id: 'custom', label: 'Custom Works' },
                                { id: 'returns', label: 'Returns Accepted' }
                              ].map(cap => (
                                <label key={cap.id} className="flex items-center gap-4 cursor-pointer group">
                                   <div className={`w-5 h-5 border-2 flex items-center justify-center transition-all ${capabilities[cap.id as keyof typeof capabilities] ? 'bg-[#F59E0B] border-[#F59E0B] text-white' : 'border-white/20'}`}>
                                      {capabilities[cap.id as keyof typeof capabilities] && <span className="text-[8px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={capabilities[cap.id as keyof typeof capabilities]} onChange={() => setCapabilities(prev => ({...prev, [cap.id]: !prev[cap.id as keyof typeof capabilities]}))} />
                                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">{cap.label}</span>
                                </label>
                              ))}
                           </div>
                        </div>

                        <div className="h-[400px] border-2 border-[#121212] relative group">
                           <div className="absolute top-6 left-6 z-10 bg-[#121212] text-white text-[9px] font-black px-4 py-2 uppercase tracking-widest">Interactive Geopoint Selector</div>
                           <MapPinPicker onLocationSelected={setLocation} />
                        </div>
                     </div>
                  </div>
                 )}

                 {step === 4 && (
                   <div className="space-y-16 animate-reveal">
                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.4em]">Phase 04</p>
                        <h2 className="text-4xl font-serif italic tracking-tighter text-[#121212]">Institutional Mandate Terminal</h2>
                        <p className="text-xs text-[#6B665E] italic">Exhaustive verification of commercial and ethical conduct protocols.</p>
                     </div>

                     <div className="space-y-12">
                        {/* Mandate Category: Platform Ethics */}
                        <div className="space-y-6">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#A34D15] border-b border-[#121212]/10 pb-4">Category 01: Platform Ethics & Conduct</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'e1', label: 'General Terms Compliance', sub: 'Acceptance of all RMF network protocols.' },
                                { id: 'e2', label: 'Anti-Fraud Handshake', sub: 'Commitment to transparent financial reporting.' },
                                { id: 'e3', label: 'Data Privacy Protocol', sub: 'Secure handling of buyer identity markers.' },
                                { id: 'e4', label: 'Dispute Resolution Mandate', sub: 'Acceptance of RMF mediation in conflict.' },
                                { id: 'e5', label: 'Institutional Decorum', sub: 'Professional conduct within the facilitator hub.' }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border border-[#121212]/5 hover:border-[#A34D15] transition-all bg-white">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-[#121212] border-[#121212] text-white' : 'border-[#121212]/20'}`}>
                                      {mandatePoints[p.id as keyof typeof mandatePoints] && <span className="text-[10px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={mandatePoints[p.id as keyof typeof mandatePoints]} onChange={() => setMandatePoints(prev => ({...prev, [p.id]: !prev[p.id as keyof typeof mandatePoints]}))} />
                                   <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest block">{p.label}</span>
                                      <span className="text-[8px] text-[#6B665E] italic opacity-60">{p.sub}</span>
                                   </div>
                                </label>
                              ))}
                           </div>
                        </div>

                        {/* Mandate Category: Operational Readiness */}
                        <div className="space-y-6">
                           <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[#A34D15] border-b border-[#121212]/10 pb-4">Category 02: Operational Readiness</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                { id: 'o1', label: '30-Minute Handover Window', sub: 'Guaranteed prep time for authorized riders.' },
                                { id: 'o2', label: 'Digital Scale Compliance', sub: 'Verified measurement for weight-based assets.' },
                                { id: 'o3', label: 'Real-time Stock Sync', sub: 'Zero-latency inventory status maintenance.' },
                                { id: 'o4', label: 'Packaging Standards', sub: 'Use of RMF-certified or sustainable wrapping.' },
                                { id: 'o5', label: '2% Facilitation Fee', sub: 'Automatic commission deduction acknowledgment.' }
                              ].map(p => (
                                <label key={p.id} className="flex items-center gap-6 cursor-pointer group p-5 border border-[#121212]/5 hover:border-[#A34D15] transition-all bg-white">
                                   <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${mandatePoints[p.id as keyof typeof mandatePoints] ? 'bg-[#121212] border-[#121212] text-white' : 'border-[#121212]/20'}`}>
                                      {mandatePoints[p.id as keyof typeof mandatePoints] && <span className="text-[10px]">✓</span>}
                                   </div>
                                   <input type="checkbox" className="sr-only" checked={mandatePoints[p.id as keyof typeof mandatePoints]} onChange={() => setMandatePoints(prev => ({...prev, [p.id]: !prev[p.id as keyof typeof mandatePoints]}))} />
                                   <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest block">{p.label}</span>
                                      <span className="text-[8px] text-[#6B665E] italic opacity-60">{p.sub}</span>
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
                                      <span className="text-[8px] text-red-700/60 italic opacity-60">{p.sub}</span>
                                   </div>
                                </label>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                 )}

                {/* Navigation Terminal */}
                <div className="pt-16 border-t border-[#121212]/10 flex justify-between items-center">
                   {step > 1 ? (
                     <button 
                       onClick={() => setStep(s => s - 1)}
                       className="text-[10px] font-black uppercase tracking-[0.4em] text-[#121212]/40 hover:text-[#121212] transition-colors"
                     >
                       ← Previous Phase
                     </button>
                   ) : <div />}
                   
                   {step < 4 ? (
                     <button 
                       onClick={handleNext}
                       className="rmf-btn-primary px-16 py-5 bg-[#121212] text-white shadow-2xl hover:bg-[#F59E0B] transition-all"
                     >
                       Analyze & Continue
                     </button>
                   ) : (
                     <button 
                       onClick={handleSubmit}
                       disabled={isSubmitting}
                       className="rmf-btn-primary px-16 py-5 bg-[#F59E0B] text-white shadow-[0_20px_50px_-15px_rgba(245,158,11,0.4)] hover:bg-[#C25D1D] transition-all border-none"
                     >
                       {isSubmitting ? 'Syncing...' : 'Submit Registry'}
                     </button>
                   )}
                </div>
             </div>
          </div>
          
          <div className="text-center">
             <p className="text-[8px] font-black text-[#6B665E] uppercase tracking-[0.5em] opacity-30 italic">Rwanda Market Facilitator Institutional Registry Node v4.2</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

type key_of_docs = 'rdb' | 'rra' | 'id' | 'photo';
