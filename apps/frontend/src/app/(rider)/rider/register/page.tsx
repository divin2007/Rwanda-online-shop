'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { riderApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function RiderRegistrationPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [plateNumber, setPlateNumber] = useState('');
  const [documents, setDocuments] = useState({ license: '', vehicle: '', id: '', insurance: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !user?.id) {
      toast.error('You must be logged in to register as a rider');
      router.push('/login');
      return;
    }

    if (!documents.license || !documents.vehicle || !documents.id || !documents.insurance) {
      return toast.error('All documents must be uploaded');
    }

    setIsSubmitting(true);
    try {
      await riderApi.post('/riders/register', { 
        userId: user.id,
        plateNumber, 
        licenseUrl: documents.license,
        vehiclePhotoUrl: documents.vehicle,
        idCardUrl: documents.id,
        insuranceUrl: documents.insurance
      });
      toast.success('Registration submitted for approval!');
      router.push('/rider/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-80px)] animate-reveal">
        {/* Left: Branding & Value Proposition */}
        <div className="hidden lg:flex w-1/2 bg-[#121212] flex-col justify-between p-24 relative overflow-hidden group">
           <img 
              src="https://images.unsplash.com/photo-1558981806-ec527fa84c39" 
              className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale group-hover:scale-105 group-hover:grayscale-[50%] transition-all duration-[10000ms]" 
              alt="Rider Setup" 
           />
           <div className="relative z-10">
              <div className="flex items-center gap-6 mb-12">
                 <div className="w-16 h-px bg-[#F59E0B]" />
                 <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Join the Fleet</p>
              </div>
              <h1 className="text-[100px] font-serif text-white leading-[0.85] tracking-tighter italic mb-8">
                 Deliver &<br />Earn.
              </h1>
              <p className="text-xl text-white/60 font-light italic leading-relaxed max-w-md border-l-2 border-white/20 pl-8">
                 Partner with local markets. Get paid directly to your MoMo account for every successful delivery.
              </p>
           </div>
           
           <div className="relative z-10 flex gap-12">
              <div>
                 <p className="text-3xl font-serif text-white italic tracking-tighter mb-2">500+</p>
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#F59E0B]">Daily Deliveries</p>
              </div>
              <div>
                 <p className="text-3xl font-serif text-white italic tracking-tighter mb-2">Weekly</p>
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#F59E0B]">Payouts</p>
              </div>
           </div>
        </div>

        {/* Right: Registration Form */}
        <div className="w-full lg:w-1/2 bg-[#F8F6F1] flex items-center justify-center p-8 md:p-16 lg:p-24 relative">
           <div className="w-full max-w-xl">
              <div className="mb-12">
                 <h2 className="text-4xl font-serif text-[#121212] tracking-tighter italic mb-4">Rider Registration</h2>
                 <p className="text-sm font-medium text-[#6B665E]">Submit your vehicle and identity documents to get verified.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-10">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#121212]">Plate Number</label>
                    <input 
                      type="text" 
                      required 
                      className="w-full bg-white border border-[#E5E1D8] focus:border-[#121212] p-5 text-sm font-mono font-bold outline-none transition-colors" 
                      placeholder="e.g. RAB 123 C" 
                      value={plateNumber} 
                      onChange={e => setPlateNumber(e.target.value.toUpperCase())} 
                    />
                 </div>

                 <div className="space-y-6 pt-6 border-t border-[#E5E1D8]">
                    <div className="flex items-center gap-4">
                       <h3 className="text-xl font-serif italic text-[#121212]">Required Documents</h3>
                       <div className="flex-1 h-px bg-[#E5E1D8]" />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <div className="bg-white border border-[#E5E1D8] p-4 group hover:border-[#121212] transition-colors">
                          <ImageUpload label="Driving License" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, license: url})} />
                       </div>
                       <div className="bg-white border border-[#E5E1D8] p-4 group hover:border-[#121212] transition-colors">
                          <ImageUpload label="National ID" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, id: url})} />
                       </div>
                       <div className="bg-white border border-[#E5E1D8] p-4 group hover:border-[#121212] transition-colors">
                          <ImageUpload label="Vehicle Photo" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, vehicle: url})} />
                       </div>
                       <div className="bg-white border border-[#E5E1D8] p-4 group hover:border-[#121212] transition-colors">
                          <ImageUpload label="Insurance" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, insurance: url})} />
                       </div>
                    </div>
                 </div>

                 <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-[#121212] text-white mt-12 py-6 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-[#F59E0B] transition-all disabled:opacity-50 disabled:grayscale"
                 >
                    {isSubmitting ? 'Submitting Application...' : 'Submit Registration'}
                 </button>
              </form>
           </div>
        </div>
      </div>
    </Layout>
  );
}
