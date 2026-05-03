'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { userApi } from '@/lib/api';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number is too short"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(['BUYER', 'SELLER', 'RIDER'])
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'BUYER' }
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      // Exclude confirmPassword before sending
      const { confirmPassword, ...payload } = data;
      const res = await userApi.post('/auth/register', payload);
      
      if (res.data?.success) {
        toast.success('Registration successful! Please log in.');
        router.push('/login');
      } else {
        toast.error(res.data?.error || 'Registration failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to connect to authentication service');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
        <div className="w-full max-w-lg">
          <Card className="shadow-xl border-t-4 border-t-secondary animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-heading font-bold text-text-primary">Create an Account</h1>
              <p className="text-text-secondary">Join Rwanda's premier digital marketplace</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1">I want to be a:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['BUYER', 'SELLER', 'RIDER'].map(role => (
                    <label key={role} className="flex flex-col items-center justify-center border border-border p-3 rounded-lg cursor-pointer hover:bg-background-surface has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" value={role} {...register('role')} className="sr-only" />
                      <span className="font-bold text-sm capitalize">{role.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
                {errors.role && <p className="text-status-error text-xs mt-1">{errors.role.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input type="text" {...register('fullName')} className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-primary" placeholder="Jean Claude" />
                {errors.fullName && <p className="text-status-error text-xs mt-1">{errors.fullName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" {...register('email')} className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-primary" placeholder="name@example.com" />
                  {errors.email && <p className="text-status-error text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input type="tel" {...register('phone')} className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-primary" placeholder="078..." />
                  {errors.phone && <p className="text-status-error text-xs mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input type="password" {...register('password')} className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-primary" placeholder="••••••••" />
                  {errors.password && <p className="text-status-error text-xs mt-1">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm Password</label>
                  <input type="password" {...register('confirmPassword')} className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-primary" placeholder="••••••••" />
                  {errors.confirmPassword && <p className="text-status-error text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <Button type="submit" fullWidth size="lg" disabled={isLoading} className="mt-6">
                {isLoading ? 'Creating Account...' : 'Register'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-sm text-text-secondary">
                Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Sign In</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
