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
import toast from 'react-hot-toast';

export default function SellerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data state
  const { data: markets, execute: fetchMarkets } = useApi(marketApi, 'get', '/markets?type=public&isActive=true');
  const [agreement, setAgreement] = useState('');
  
  // Form state
  const [marketId, setMarketId] = useState('');
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  
  const [documents, setDocuments] = useState({ rdb: '', rra: '', id: '', photo: '' });
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [landmark, setLandmark] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('Kigali');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetchMarkets();
    marketApi.get('/markets/agreement').then(res => setAgreement(res.data?.data || 'Partnership Agreement v3.0...'));
  }, [fetchMarkets]);

  const handleNext = () => {
    if (step === 1 && !marketId && !shopName) return toast.error('Select a market or enter a shop name');
    if (step === 2 && (!documents.rdb || !documents.rra || !documents.id || !documents.photo)) return toast.error('All documents are required');
    if (step === 3 && (!location || !landmark || !district || !city)) return toast.error('Please pin your location and provide City, District, and Landmark');
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!agreed) return toast.error('You must agree to the partnership terms');
    setIsSubmitting(true);
    
    try {
      await sellerApi.post('/sellers/onboard', {
        marketId: marketId || null,
        shopDetails: marketId ? null : { name: shopName, slug, description },
        documents,
        stallLocation: location,
        address: `${district}, ${landmark}`, // Combine for backend address
        city,
        agreedToTerms: agreed
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
      <div className="max-w-3xl mx-auto py-10 px-4">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Seller Onboarding</h1>
        <p className="text-text-secondary mb-8">Complete your profile to start selling on Rwanda Market Facilitator.</p>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1,2,3,4].map(s => (
            <div key={s} className={`h-2 flex-1 rounded ${s <= step ? 'bg-primary' : 'bg-border'}`}></div>
          ))}
        </div>

        <Card>
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold">Step 1: Market Selection</h2>
              
              <div className="border border-border p-4 rounded-lg hover:border-primary cursor-pointer" onClick={() => setMarketId('')}>
                <h3 className="font-bold mb-2">Option A: Join a Public Market</h3>
                <select 
                  className="w-full p-2 border border-border rounded"
                  value={marketId}
                  onChange={e => { setMarketId(e.target.value); setShopName(''); }}
                >
                  <option value="">Select a market...</option>
                  {markets?.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>

              <div className="border border-border p-4 rounded-lg hover:border-primary cursor-pointer" onClick={() => setMarketId('')}>
                <h3 className="font-bold mb-2">Option B: Create My Own Shop</h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Shop Name" className="w-full p-2 border border-border rounded" value={shopName} onChange={e => setShopName(e.target.value)} disabled={!!marketId} />
                  <input type="text" placeholder="URL Slug (e.g., jado-shop)" className="w-full p-2 border border-border rounded" value={slug} onChange={e => setSlug(e.target.value)} disabled={!!marketId} />
                  <textarea placeholder="Description" className="w-full p-2 border border-border rounded" value={description} onChange={e => setDescription(e.target.value)} disabled={!!marketId} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold">Step 2: Document Upload</h2>
              <div className="grid grid-cols-2 gap-4">
                <ImageUpload label="RDB Certificate" service="seller" endpoint="/sellers/upload-document" onUploadSuccess={url => setDocuments({...documents, rdb: url})} />
                <ImageUpload label="RRA Tax Clearance (TIN)" service="seller" endpoint="/sellers/upload-document" onUploadSuccess={url => setDocuments({...documents, rra: url})} />
                <ImageUpload label="National ID (Front & Back)" service="seller" endpoint="/sellers/upload-document" onUploadSuccess={url => setDocuments({...documents, id: url})} />
                <ImageUpload label="Stall/Shop Photo" service="seller" endpoint="/sellers/upload-document" onUploadSuccess={url => setDocuments({...documents, photo: url})} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold">Step 3: Stall Location</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input type="text" className="w-full p-2 border border-border rounded" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kigali" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">District</label>
                  <input type="text" className="w-full p-2 border border-border rounded" value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Gasabo" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Landmark</label>
                  <input type="text" className="w-full p-2 border border-border rounded" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="e.g. Near Kimironko Market" />
                </div>
              </div>
              <p className="text-sm text-text-secondary">Drop a pin exactly where your stall or shop is located on the map.</p>
              <div className="h-80 border border-border rounded overflow-hidden">
                <MapPinPicker onLocationSelected={setLocation} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold">Step 4: Partnership Agreement</h2>
              <div className="h-60 overflow-y-auto bg-background-surface p-4 rounded text-sm whitespace-pre-wrap border border-border">
                {agreement}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 text-primary" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                <span className="font-medium">I agree to Partnership Agreement v3.0</span>
              </label>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            {step > 1 ? <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button> : <div></div>}
            {step < 4 ? <Button onClick={handleNext}>Next Step</Button> : <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Application'}</Button>}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
