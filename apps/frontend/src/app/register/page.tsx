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
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number is too short"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(['BUYER', 'SELLER', 'RIDER']),
  referredBy: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'BUYER', referredBy: refCode }
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const res = await userApi.post('/users/register', payload);

      if (res.data?.success) {
        toast.success(t('success'));
        router.push('/login');
      } else {
        toast.error(res.data?.error || t('error'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F1] font-sans selection:bg-[#F59E0B] selection:text-white flex items-center justify-center p-6 md:p-12">
      <div className="max-w-7xl w-full flex flex-col lg:flex-row-reverse items-stretch justify-center animate-reveal">
        {/* Institutional Mission Panel */}
        <div className="hidden lg:flex w-5/12 bg-[#121212] text-white p-20 flex-col justify-between border-2 border-[#121212] relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_0%_100%,rgba(163,77,21,0.2),transparent_70%)]"></div>
          </div>
          
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-baseline gap-1 mb-20 group/logo">
              <span className="text-5xl font-serif font-black tracking-tighter text-white group-hover/logo:text-[#F59E0B] transition-colors">RMF</span>
              <div className="w-2 h-2 bg-[#F59E0B] rounded-full"></div>
            </Link>

            <div className="flex items-center gap-6 mb-12">
               <div className="w-12 h-px bg-[#F59E0B]"></div>
               <p className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">{t('auth_network_registry')}</p>
            </div>
            <h2 className="text-7xl font-serif tracking-tighter italic leading-none mb-12 text-white">
              {t('auth_join_infrastructure').split('<br/>').map((line, i) => (
                <React.Fragment key={i}>{line}{i === 0 && <br/>}</React.Fragment>
              ))}
            </h2>
            <p className="text-xl text-white/70 font-light italic leading-relaxed max-w-sm border-l-2 border-white/20 pl-10">
               {t('auth_infrastructure_desc')}
            </p>
          </div>

          <div className="relative z-10 space-y-12">
             <div className="p-10 bg-white/5 border border-white/20 space-y-6">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#F59E0B]">{t('auth_compliance_protocol')}</p>
                <p className="text-[10px] text-white/80 leading-relaxed italic">{t('auth_compliance_desc')}</p>
             </div>
             <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.6em]">{t('auth_registry_id')}: REG-HUB-RW-2026</p>
          </div>
        </div>

        {/* Elite Registration Workstation */}
        <div className="w-full lg:w-7/12 bg-white border-2 border-[#121212] lg:border-r-0 p-12 md:p-24 flex flex-col justify-center shadow-2xl">
          <div className="mb-16">
            <h1 className="text-5xl font-serif text-[#121212] tracking-tighter italic mb-4">{t('register_title')}</h1>
            <p className="text-[11px] font-black text-[#6B665E] uppercase tracking-[0.4em] opacity-60">{t('register_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
            {/* Role Selection: Tactical Hub Type */}
            <div className="rmf-form-group">
              <label className="rmf-label mb-6">{t('i_want_to_be')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {['BUYER', 'SELLER', 'RIDER'].map(role => (
                  <label key={role} className="relative cursor-pointer group">
                    <input type="radio" value={role} {...register('role')} className="sr-only peer" />
                    <div className="p-8 border-2 border-[#E5E1D8] text-center transition-all peer-checked:border-[#121212] peer-checked:bg-[#121212] peer-checked:text-white hover:border-[#F59E0B]">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em]">{role}</p>
                       <p className="text-[8px] mt-2 opacity-60 italic uppercase tracking-widest">{role === 'BUYER' ? t('auth_acquisitions') : role === 'SELLER' ? t('auth_merchant') : t('auth_logistics')}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.role && <p className="rmf-error-text">⚠ {errors.role.message}</p>}
            </div>

            <div className="rmf-form-group">
              <label className="rmf-label">{t('full_name')}</label>
              <input type="text" {...register('fullName')} className={`rmf-input ${errors.fullName ? 'rmf-input-error' : ''}`} placeholder={t('auth_official_name')} />
              {errors.fullName && <p className="rmf-error-text">⚠ {errors.fullName.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="rmf-form-group">
                <label className="rmf-label">{t('email_label')}</label>
                <input type="email" {...register('email')} className={`rmf-input ${errors.email ? 'rmf-input-error' : ''}`} placeholder={t('auth_secure_email')} />
                {errors.email && <p className="rmf-error-text">⚠ {errors.email.message}</p>}
              </div>
              <div className="rmf-form-group">
                <label className="rmf-label">{t('phone_number')}</label>
                <input type="tel" {...register('phone')} className={`rmf-input ${errors.phone ? 'rmf-input-error' : ''}`} placeholder="07XXXXXXXX" />
                {errors.phone && <p className="rmf-error-text">⚠ {errors.phone.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="rmf-form-group">
                <label className="rmf-label">{t('password_label')}</label>
                <input type="password" {...register('password')} className={`rmf-input ${errors.password ? 'rmf-input-error' : ''}`} placeholder="••••••••" />
                {errors.password && <p className="rmf-error-text">⚠ {errors.password.message}</p>}
              </div>
              <div className="rmf-form-group">
                <label className="rmf-label">{t('confirm_password')}</label>
                <input type="password" {...register('confirmPassword')} className={`rmf-input ${errors.confirmPassword ? 'rmf-input-error' : ''}`} placeholder="••••••••" />
                {errors.confirmPassword && <p className="rmf-error-text">⚠ {errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="rmf-form-group">
              <label className="rmf-label">{t('referral_code')} <span className="opacity-40">{t('auth_optional')}</span></label>
              <input type="text" {...register('referredBy')} className="rmf-input border-dashed" placeholder="RMF-XXXX-XXXX" />
            </div>

            <div className="pt-10">
              <button 
                type="submit" 
                disabled={isLoading}
                className="rmf-btn-primary w-full group relative"
              >
                <span className="relative z-10">{isLoading ? t('creating_account') : t('create_account')}</span>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-40 group-hover:translate-x-2 transition-transform">→</div>
              </button>
            </div>
          </form>

          <div className="mt-20 pt-10 border-t border-[#F0EDE4] text-center">
            <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.3em]">
              {t('already_have_account')} 
              <Link href="/login" className="text-[#F59E0B] ml-4 border-b-2 border-[#F59E0B]/40 hover:border-[#F59E0B] transition-all">
                {t('sign_in')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
