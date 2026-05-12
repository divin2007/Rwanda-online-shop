'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is too short'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['BUYER', 'SELLER', 'RIDER']),
  referredBy: z.string().optional(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const roles = [
  {
    key: 'BUYER' as const,
    icon: '🛒',
    label: 'Buyer',
    desc: 'Shop from local markets & get delivered to your door',
  },
  {
    key: 'SELLER' as const,
    icon: '🏪',
    label: 'Seller',
    desc: 'List your products and grow your local business online',
  },
  {
    key: 'RIDER' as const,
    icon: '🛵',
    label: 'Rider',
    desc: 'Earn money delivering orders across Kigali',
  },
];

export default function RegisterPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const preRole = (searchParams.get('role') as 'BUYER' | 'SELLER' | 'RIDER') || 'BUYER';
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'BUYER' | 'SELLER' | 'RIDER'>(preRole);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: preRole, referredBy: refCode },
  });

  const handleRoleSelect = (role: 'BUYER' | 'SELLER' | 'RIDER') => {
    setSelectedRole(role);
    setValue('role', role);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const res = await userApi.post('/users/register', payload);
      if (res.data?.success) {
        toast.success('Account created! Please sign in.');
        router.push('/login');
      } else {
        toast.error(res.data?.error || 'Registration failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans selection:bg-[#F59E0B] selection:text-white">

      {/* ── Left: Form Panel ── */}
      <div className="flex-1 bg-white flex items-center justify-center p-8 md:p-16 overflow-y-auto">
        <div className="w-full max-w-lg space-y-8 animate-reveal py-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black tracking-tighter text-[#121212]">RMF</span>
            <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" />
          </div>

          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif text-[#121212] italic tracking-tighter mb-2">Create Account</h1>
            <p className="text-sm text-[#6B665E]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#A34D15] font-black hover:underline">Sign in →</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Role Selection */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em]">I want to join as a...</p>
              <div className="grid grid-cols-3 gap-3">
                {roles.map(r => (
                  <label key={r.key} className="cursor-pointer" onClick={() => handleRoleSelect(r.key)}>
                    <input type="radio" value={r.key} {...register('role')} className="sr-only" />
                    <div className={`p-4 border-2 text-center transition-all ${selectedRole === r.key ? 'border-[#121212] bg-[#121212] text-white' : 'border-[#E5E1D8] text-[#121212] hover:border-[#F59E0B]'}`}>
                      <div className="text-2xl mb-2">{r.icon}</div>
                      <p className="text-[10px] font-black uppercase tracking-wider">{r.label}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedRole && (
                <p className="text-[10px] text-[#6B665E] italic pl-1">
                  {roles.find(r => r.key === selectedRole)?.desc}
                </p>
              )}
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                {...register('fullName')}
                placeholder="e.g. Amina Uwase"
                className={`w-full bg-[#F8F6F1] border-2 px-5 py-4 text-sm outline-none rounded-none transition-colors ${errors.fullName ? 'border-red-400 focus:border-red-500' : 'border-[#E5E1D8] focus:border-[#121212]'}`}
              />
              {errors.fullName && <p className="text-[10px] text-red-500 font-bold">⚠ {errors.fullName.message}</p>}
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full bg-[#F8F6F1] border-2 px-5 py-4 text-sm outline-none rounded-none transition-colors ${errors.email ? 'border-red-400' : 'border-[#E5E1D8] focus:border-[#121212]'}`}
                />
                {errors.email && <p className="text-[10px] text-red-500 font-bold">⚠ {errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="phone">
                  Phone (MTN/Airtel)
                </label>
                <input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  placeholder="07XXXXXXXX"
                  className={`w-full bg-[#F8F6F1] border-2 px-5 py-4 text-sm outline-none rounded-none transition-colors ${errors.phone ? 'border-red-400' : 'border-[#E5E1D8] focus:border-[#121212]'}`}
                />
                {errors.phone && <p className="text-[10px] text-red-500 font-bold">⚠ {errors.phone.message}</p>}
              </div>
            </div>

            {/* Password + Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className={`w-full bg-[#F8F6F1] border-2 px-5 py-4 text-sm outline-none rounded-none transition-colors ${errors.password ? 'border-red-400' : 'border-[#E5E1D8] focus:border-[#121212]'}`}
                />
                {errors.password && <p className="text-[10px] text-red-500 font-bold">⚠ {errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className={`w-full bg-[#F8F6F1] border-2 px-5 py-4 text-sm outline-none rounded-none transition-colors ${errors.confirmPassword ? 'border-red-400' : 'border-[#E5E1D8] focus:border-[#121212]'}`}
                />
                {errors.confirmPassword && <p className="text-[10px] text-red-500 font-bold">⚠ {errors.confirmPassword.message}</p>}
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block">
                Referral Code <span className="font-normal opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                {...register('referredBy')}
                placeholder="RMF-XXXX"
                className="w-full bg-[#F8F6F1] border-2 border-dashed border-[#E5E1D8] focus:border-[#121212] px-5 py-4 text-sm outline-none rounded-none transition-colors"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#121212] text-white py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#A34D15] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : `Create ${selectedRole.charAt(0) + selectedRole.slice(1).toLowerCase()} Account →`}
            </button>

            <p className="text-[9px] text-center text-[#6B665E] opacity-60 leading-relaxed">
              By registering you agree to our{' '}
              <Link href="/terms" className="underline hover:text-[#121212]">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-[#121212]">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </div>

      {/* ── Right: Brand Panel ── */}
      <div className="hidden lg:flex w-[38%] bg-[#121212] flex-col justify-between p-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_100%,rgba(245,158,11,0.08),transparent_60%)]" />
          <div className="absolute -bottom-4 -left-4 text-[200px] font-serif italic leading-none select-none opacity-[0.04] text-white">RMF</div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-baseline gap-2 group">
            <span className="text-4xl font-serif font-black tracking-tighter text-white group-hover:text-[#F59E0B] transition-colors">RMF</span>
            <div className="w-2 h-2 bg-[#F59E0B] rounded-full" />
          </Link>
          <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">Rwanda Market Facilitator</p>
        </div>

        {/* Copy */}
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-8 h-px bg-[#F59E0B]" />
            <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Join the Community</p>
          </div>
          <h2 className="text-5xl font-serif italic tracking-tighter leading-[0.95] text-white">
            Rwanda's<br />
            <span className="text-[#F59E0B]">marketplace</span><br />
            is growing.
          </h2>
          <p className="text-base text-white/50 font-light italic leading-relaxed border-l-2 border-white/10 pl-6">
            Join 120+ verified sellers, thousands of buyers, and a growing network of riders delivering across Kigali.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-10 border-t border-white/10">
          {[
            { val: '120+', label: 'Sellers' },
            { val: '10+', label: 'Markets' },
            { val: '500+', label: 'Orders' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-serif italic text-white">{s.val}</p>
              <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
