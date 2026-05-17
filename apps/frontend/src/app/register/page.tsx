'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Bike, ShieldCheck, ShoppingCart, Store, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { userApi } from '@/lib/api';

type ApiError = { response?: { data?: { error?: string; message?: string } } };

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
type Role = 'BUYER' | 'SELLER' | 'RIDER';

const roles = [
  {
    key: 'BUYER' as const,
    icon: ShoppingCart,
    label: 'Buyer',
    desc: 'Shop from local markets and get orders delivered to your door.',
  },
  {
    key: 'SELLER' as const,
    icon: Store,
    label: 'Seller',
    desc: 'List products, receive orders, and manage your verified stall.',
  },
  {
    key: 'RIDER' as const,
    icon: Bike,
    label: 'Rider',
    desc: 'Accept delivery jobs and track handovers across Kigali.',
  },
];

const getRoleFromQuery = (value: string | null): Role => (
  value === 'SELLER' || value === 'RIDER' || value === 'BUYER' ? value : 'BUYER'
);

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const preRole = getRoleFromQuery(searchParams.get('role'));
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>(preRole);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: preRole, referredBy: refCode },
  });

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setValue('role', role);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const payload = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        referredBy: data.referredBy,
      };
      const res = await userApi.post('/users/register', payload);
      if (res.data?.success) {
        toast.success('Account created. Please sign in.');
        router.push('/login');
      } else {
        toast.error(res.data?.error || 'Registration failed');
      }
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.error || apiError.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full rounded-md border bg-white px-5 py-4 text-sm outline-none transition-colors focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ffedd5]';
  const fieldClass = (hasError?: boolean) => `${inputClass} ${hasError ? 'border-[#9a6b5d]' : 'border-[#d9e0db]'}`;
  const errorClass = 'text-[11px] font-bold text-[#7b3f3f]';

  return (
    <div className="flex min-h-screen bg-[#fdfaf7] font-sans selection:bg-[#ff6b00] selection:text-white">
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-5 md:p-12">
        <div className="w-full max-w-2xl space-y-8 py-8 animate-reveal">
          <div className="flex items-baseline gap-2 lg:hidden">
            <span className="text-3xl font-black tracking-normal text-[#1b1c1c]">RMF</span>
            <div className="h-1.5 w-1.5 rounded-full bg-[#ffedd5]" />
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#ffedd5] px-3 py-1.5 text-xs font-black text-[#ff6b00]">
              <ShieldCheck size={15} />
              Verified marketplace onboarding
            </div>
            <h1 className="mb-2 text-4xl font-black tracking-normal text-[#1b1c1c]">Create Account</h1>
            <p className="text-sm text-[#414844]">
              Already have an account?{' '}
              <Link href="/login" className="font-black text-[#ff6b00] hover:underline">Sign in -&gt;</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-lg border border-[#d9e0db] bg-white p-5 shadow-sm md:p-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]">Join as</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const active = selectedRole === role.key;
                  return (
                    <label key={role.key} className="cursor-pointer" onClick={() => handleRoleSelect(role.key)}>
                      <input type="radio" value={role.key} {...register('role')} className="sr-only" />
                      <div className={`h-full rounded-md border p-4 transition-all ${active ? 'border-[#ff6b00] bg-[#ffedd5] text-[#ff6b00]' : 'border-[#d9e0db] bg-white text-[#1b1c1c] hover:border-[#ff6b00]'}`}>
                        <Icon size={22} />
                        <p className="mt-3 text-[11px] font-black uppercase tracking-wider">{role.label}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#574e47]">{role.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]" htmlFor="fullName">
                Full Name
              </label>
              <input id="fullName" type="text" {...register('fullName')} placeholder="e.g. Amina Uwase" className={fieldClass(Boolean(errors.fullName))} />
              {errors.fullName && <p className={errorClass}>{errors.fullName.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]" htmlFor="email">
                  Email
                </label>
                <input id="email" type="email" {...register('email')} placeholder="you@example.com" autoComplete="email" className={fieldClass(Boolean(errors.email))} />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]" htmlFor="phone">
                  Phone
                </label>
                <input id="phone" type="tel" {...register('phone')} placeholder="07XXXXXXXX" className={fieldClass(Boolean(errors.phone))} />
                {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]" htmlFor="password">
                  Password
                </label>
                <input id="password" type="password" {...register('password')} placeholder="Min. 8 characters" autoComplete="new-password" className={fieldClass(Boolean(errors.password))} />
                {errors.password && <p className={errorClass}>{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input id="confirmPassword" type="password" {...register('confirmPassword')} placeholder="Re-enter password" autoComplete="new-password" className={fieldClass(Boolean(errors.confirmPassword))} />
                {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-[#1b1c1c]">
                Referral Code <span className="font-semibold tracking-normal text-[#574e47]">(optional)</span>
              </label>
              <input type="text" {...register('referredBy')} placeholder="RMF-XXXX" className="w-full rounded-md border border-dashed border-[#d9e0db] bg-[#fdfaf7] px-5 py-4 text-sm outline-none transition-colors focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ffedd5]" />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-md bg-[#e05300] py-5 text-[11px] font-black uppercase tracking-[0.28em] text-white transition-all hover:bg-[#ff6b00] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account...
                </>
              ) : `Create ${selectedRole.charAt(0) + selectedRole.slice(1).toLowerCase()} Account ->`}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-[#574e47]">
              By registering you agree to our{' '}
              <Link href="/terms" className="font-bold text-[#ff6b00] hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="font-bold text-[#ff6b00] hover:underline">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </div>

      <div
        className="relative hidden w-[38%] flex-col justify-between overflow-hidden bg-[#e05300] p-16 text-white lg:flex"
        style={{
          backgroundImage: 'linear-gradient(90deg, rgba(224,83,0,0.94), rgba(255,107,0,0.72)), url("https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&q=80&w=1400")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute -bottom-4 -left-4 select-none text-[200px] font-black leading-none text-white/5">RMF</div>

        <div className="relative z-10">
          <Link href="/" className="group inline-flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-normal text-white transition-colors group-hover:text-[#ffedd5]">RMF</span>
            <div className="h-2 w-2 rounded-full bg-[#ffedd5]" />
          </Link>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.5em] text-white/50">Rwanda Market Facilitator</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="h-px w-8 bg-[#ffedd5]" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ffedd5]">Join the Community</p>
          </div>
          <h2 className="text-5xl font-black leading-[0.95] tracking-normal text-white">
            Built for<br />
            Rwanda&apos;s local<br />
            commerce.
          </h2>
          <p className="border-l-2 border-white/15 pl-6 text-base leading-relaxed text-white/75">
            Buyers, sellers, and riders all share one verified operating system for market orders, handovers, and delivery.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-10">
          {[
            { icon: Store, label: 'Markets' },
            { icon: ShieldCheck, label: 'Verified' },
            { icon: Truck, label: 'Delivery' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="text-center">
              <Icon className="mx-auto text-[#ffedd5]" size={22} />
              <p className="mt-2 text-[8px] font-black uppercase tracking-widest text-white/65">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#fdfaf7] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
      </div>
    }>
      <RegisterContent />
    </React.Suspense>
  );
}
