'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import Link from 'next/link';
import { Mail, Phone, MapPin, ShieldAlert, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ContactPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    setFormData((current) => ({
      ...current,
      name: current.name || user.fullName || '',
      email: current.email || user.email || '',
    }));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/users/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          userId: user?.id,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.error || 'Failed to send message');
      }

      setSuccessMessage('Your message has been sent successfully. We will get back to you shortly.');
      setFormData({
        name: user?.fullName || formData.name,
        email: user?.email || formData.email,
        subject: '',
        message: '',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-lg animate-reveal">
        
        {/* Solaris Ivory Premium Header Banner with custom radial glow */}
        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-[#1b1c1b] p-md text-white shadow-sm md:p-xl custom-shadow">
          <div className="absolute inset-0 hero-glow pointer-events-none z-10" />
          <div className="absolute inset-0 bg-black/20 z-0" />
          
          <div className="relative z-20 space-y-xs">
            <div className="inline-flex items-center gap-xs rounded-full bg-white/10 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-container border border-white/10 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-primary-container animate-pulse" />
              Help & Support
            </div>
            <h1 className="font-display-lg text-headline-lg text-white sm:text-[36px] md:text-[44px] leading-tight">
              How can we help <span className="text-primary-container">you</span> today?
            </h1>
            <p className="max-w-xl text-xs sm:text-sm text-white/80 leading-relaxed font-body-md">
              Have a question, technical issue, or feedback about the Rwanda Online Marketplace? Get in touch with our operations team.
            </p>
          </div>
        </section>

        {/* 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md items-start">
          
          {/* Support Channels (Left Side) */}
          <div className="lg:col-span-1 space-y-md">
            
            {/* Email Channel */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-sm">
              <div className="inline-flex p-3 rounded-lg bg-primary-container/10 text-primary border border-outline-variant/60 self-start">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Email Support</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed mt-1">For general inquiries, account issues, or partnerships.</p>
              </div>
              <a href="mailto:support@rmf.rw" className="inline-block font-data-mono text-sm font-bold text-primary hover:text-primary-container transition-colors">
                support@rmf.rw
              </a>
            </div>

            {/* Phone Channel */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-sm">
              <div className="inline-flex p-3 rounded-lg bg-primary-container/10 text-primary border border-outline-variant/60 self-start">
                <Phone size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Phone & WhatsApp</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed mt-1">Call or text us on WhatsApp during business hours (8am - 6pm EAT).</p>
              </div>
              <a href="https://wa.me/250780000000" target="_blank" rel="noopener noreferrer" className="inline-block font-data-mono text-sm font-bold text-primary hover:text-primary-container transition-colors">
                +250 780 000 000
              </a>
            </div>

            {/* Office Location */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-sm">
              <div className="inline-flex p-3 rounded-lg bg-primary-container/10 text-primary border border-outline-variant/60 self-start">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Headquarters</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed mt-1">Visit us for seller onboarding or in-person support.</p>
              </div>
              <p className="text-sm font-semibold text-on-surface font-sans">
                Kigali Heights, 4th Floor, Kigali, Rwanda
              </p>
            </div>

            {/* Dispute resolution Premium Dark Card */}
            <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-[#1b1c1b] p-md text-white shadow-lg space-y-sm custom-shadow">
              <div className="absolute inset-0 hero-glow pointer-events-none z-10 opacity-70" />
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.04] pointer-events-none z-0">
                <ShieldAlert size={140} />
              </div>
              
              <div className="relative z-20 inline-flex p-3 rounded-lg bg-white/10 text-white border border-white/10 self-start">
                <ShieldAlert size={24} className="text-primary-container animate-pulse" />
              </div>
              
              <div className="relative z-20 space-y-xs">
                <h3 className="text-lg font-bold">Dispute Resolution</h3>
                <p className="text-xs text-white/80 leading-relaxed font-medium">
                  If you have an order issue or delivery dispute, raise it through your orders tab within 24 hours of delivery.
                </p>
              </div>
              
              <div className="relative z-20 pt-xs">
                <Link href="/orders" className="inline-flex items-center justify-center w-full py-2.5 bg-primary-container text-on-primary rounded-full text-xs font-bold uppercase tracking-wider hover:bg-primary transition-all shadow-sm font-label-caps">
                  Go to My Orders
                </Link>
              </div>
            </div>

          </div>

          {/* Contact Form (Right Side) */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md sm:p-lg custom-shadow space-y-md">
              <div className="pb-sm border-b border-outline-variant/60">
                <h2 className="font-headline-md text-headline-md text-on-surface">Send us a Message</h2>
                <p className="mt-xs text-xs text-on-surface-variant font-medium">
                  Fill in the form below and our operations desk will verify your request and respond within 24 hours.
                </p>
              </div>

              {successMessage && (
                <div className="flex items-center gap-xs bg-emerald-50 border border-emerald-200 text-emerald-800 p-md rounded-lg animate-reveal text-sm font-medium">
                  <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                  <p>{successMessage}</p>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-xs bg-rose-50 border border-rose-200 text-rose-800 p-md rounded-lg animate-reveal text-sm font-medium">
                  <ShieldAlert size={20} className="text-rose-600 flex-shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  
                  {/* Name Input */}
                  <label className="block space-y-xs">
                    <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">Full Name</span>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                      placeholder="e.g. Divine Keza"
                    />
                  </label>

                  {/* Email Input */}
                  <label className="block space-y-xs">
                    <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">Email Address</span>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all font-data-mono"
                      placeholder="you@domain.rw"
                    />
                  </label>

                </div>

                {/* Subject Input */}
                <label className="block space-y-xs">
                  <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">Subject</span>
                  <input 
                    type="text" 
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="Brief summary of your inquiry"
                  />
                </label>

                {/* Message Input */}
                <label className="block space-y-xs">
                  <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">Message Description</span>
                  <textarea 
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="min-h-[140px] w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-md text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all resize-none"
                    placeholder="Provide as much detail as possible..."
                  />
                </label>

                {/* Submit Button */}
                <div className="pt-sm">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary-container text-on-primary font-label-caps text-label-caps px-6 py-3 rounded-full hover:bg-primary transition-colors disabled:opacity-60 shadow-sm flex items-center justify-center gap-xs w-full md:w-auto min-w-[12rem]"
                  >
                    <Send size={16} />
                    {loading ? 'Sending Request...' : 'Submit Message'}
                  </button>
                </div>

              </form>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
