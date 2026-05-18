'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { riderApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';

const setupSchema = z.object({
  plateNumber: z.string().min(5, "Plate number must be at least 5 characters (e.g. RAE 123A)"),
  vehicleType: z.enum(['BICYCLE', 'MOTORCYCLE', 'CAR', 'TRUCK']),
  licenseNumber: z.string().min(8, "Valid license number required"),
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function RiderSetupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { vehicleType: 'MOTORCYCLE' }
  });

  const onSubmit = async (data: SetupFormValues) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await riderApi.post('/riders/register', {
        userId: user.id,
        ...data,
        isApproved: true, // Auto-approve for dev/demo purposes
        isActive: true,
        currentLocation: { lat: -1.9441, lng: 30.0619, updatedAt: new Date() }
      });

      if (res.data?.success) {
        toast.success("Logistics station activated");
        router.push('/rider/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Activation failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-20 animate-reveal">
        <div className="border-b-2 border-[#e0e0e0] pb-10 mb-16">
          <div className="flex items-center gap-6 mb-6">
             <div className="w-12 h-px bg-[#ff6b00]"></div>
             <p className="text-[11px] font-black text-[#ff6b00] uppercase tracking-[0.5em]">Network Onboarding</p>
          </div>
          <h1 className="text-7xl font-sans tracking-normal">Activate Station</h1>
          <p className="text-[10px] font-bold text-[#414844] uppercase tracking-[0.3em] mt-6 opacity-60">
            Logistics Facilitator Registry: REG-{user?.id?.substring(0,6).toUpperCase()}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">Vehicle Plate ID</label>
              <input 
                {...register('plateNumber')}
                className="w-full bg-[#f0eded] border-b-2 border-[#e0e0e0] p-6 text-xl font-sans outline-none focus:bg-white transition-colors"
                placeholder="RAE 123A"
              />
              {errors.plateNumber && <p className="text-[10px] text-red-500 font-bold uppercase">{errors.plateNumber.message}</p>}
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">Facilitation Type</label>
              <select 
                {...register('vehicleType')}
                className="w-full bg-[#f0eded] border-b-2 border-[#e0e0e0] p-6 text-xl font-sans outline-none focus:bg-white transition-colors appearance-none"
              >
                <option value="MOTORCYCLE">Motorcycle (Express)</option>
                <option value="CAR">Car (Standard)</option>
                <option value="TRUCK">Truck (Bulk)</option>
                <option value="BICYCLE">Bicycle (Eco)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#1b1c1c]">Operator License Number</label>
            <input 
              {...register('licenseNumber')}
              className="w-full bg-[#f0eded] border-b-2 border-[#e0e0e0] p-6 text-xl font-sans outline-none focus:bg-white transition-colors"
              placeholder="RWA-XXXX-XXXX-XXXX"
            />
            {errors.licenseNumber && <p className="text-[10px] text-red-500 font-bold uppercase">{errors.licenseNumber.message}</p>}
          </div>

          <div className="pt-10">
            <button 
              type="submit" 
              disabled={isLoading}
              className="rmf-btn-primary w-full py-8 text-lg group relative overflow-hidden"
            >
              <span className="relative z-10">{isLoading ? 'Synchronizing Network...' : 'Confirm Activation →'}</span>
              <div className="absolute inset-0 bg-[#ff6b00] group-hover:bg-[#ea580c] transition-colors"></div>
            </button>
            <p className="text-[9px] text-center mt-6 text-[#414844] uppercase tracking-widest opacity-40">
              By activating, you agree to the RMF Logistics Facilitation Protocol and Audit Standards.
            </p>
          </div>
        </form>
      </div>
    </Layout>
  );
}
