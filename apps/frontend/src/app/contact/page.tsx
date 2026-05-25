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
      <div className="rmf-container py-16 md:py-24 animate-reveal">
        {/* Header Block */}
        <div className="max-w-3xl mb-16 border-b border-[var(--rmf-border)] pb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-2 w-2 rounded-full bg-[var(--rmf-green)] animate-pulse"></span>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--rmf-green)]">Help & Support</p>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[var(--rmf-charcoal)] leading-tight">
            How can we help <span className="text-[var(--rmf-green)]">you</span> today?
          </h1>
          <p className="text-base text-[var(--rmf-text-muted)] mt-4 max-w-xl leading-relaxed">
            Have a question, technical issue, or feedback about the Rwanda Online Marketplace? Get in touch with our operations team.
          </p>
        </div>

        {/* 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Support Channels (Left Side) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Email Channel */}
            <div className="glass-card p-6 space-y-4 shadow-sm">
              <div className="inline-flex p-3 rounded-lg bg-[var(--rmf-green-light)] text-[var(--rmf-green)]">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--rmf-charcoal)]">Email Support</h3>
                <p className="text-xs text-[var(--rmf-text-muted)] mt-1">For general inquiries, account issues, or partnerships.</p>
              </div>
              <a href="mailto:support@rmf.rw" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--rmf-green)] hover:underline">
                support@rmf.rw
              </a>
            </div>

            {/* Phone Channel */}
            <div className="glass-card p-6 space-y-4 shadow-sm">
              <div className="inline-flex p-3 rounded-lg bg-[var(--rmf-green-light)] text-[var(--rmf-green)]">
                <Phone size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--rmf-charcoal)]">Phone & WhatsApp</h3>
                <p className="text-xs text-[var(--rmf-text-muted)] mt-1">Call or text us on WhatsApp during business hours (8am - 6pm EAT).</p>
              </div>
              <a href="https://wa.me/250780000000" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--rmf-green)] hover:underline">
                +250 780 000 000
              </a>
            </div>

            {/* Office Location */}
            <div className="glass-card p-6 space-y-4 shadow-sm">
              <div className="inline-flex p-3 rounded-lg bg-[var(--rmf-green-light)] text-[var(--rmf-green)]">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--rmf-charcoal)]">Headquarters</h3>
                <p className="text-xs text-[var(--rmf-text-muted)] mt-1">Visit us for seller onboarding or in-person support.</p>
              </div>
              <p className="text-sm font-medium text-[var(--rmf-charcoal)]">
                Kigali Heights, 4th Floor, Kigali, Rwanda
              </p>
            </div>

            {/* Dispute resolution Premium Gradient Card */}
            <div className="premium-gradient text-white rounded-xl p-6 space-y-4 shadow-lg relative overflow-hidden">
              <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
                <ShieldAlert size={140} />
              </div>
              <div className="inline-flex p-3 rounded-lg bg-white/20 text-white">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Dispute Resolution</h3>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  If you have an order issue or delivery dispute, raise it through your orders tab within 24 hours of delivery.
                </p>
              </div>
              <Link href="/orders" className="inline-flex items-center justify-center w-full py-2.5 bg-white text-[var(--rmf-green)] rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/95 transition-all shadow-sm">
                Go to My Orders
              </Link>
            </div>

          </div>

          {/* Contact Form (Right Side) */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-[var(--rmf-border)] rounded-xl p-8 md:p-10 shadow-sm">
              <h2 className="text-2xl font-bold text-[var(--rmf-charcoal)] mb-2">Send us a Message</h2>
              <p className="text-xs text-[var(--rmf-text-muted)] mb-8">
                Fill in the form below and our operations desk will verify your request and respond within 24 hours.
              </p>

              {successMessage && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-8 animate-reveal">
                  <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium">{successMessage}</p>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-8 animate-reveal">
                  <ShieldAlert size={20} className="text-red-600 flex-shrink-0" />
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Name Input */}
                  <div className="rmf-form-group mb-0">
                    <label className="rmf-label">
                      <span>Full Name</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="rmf-input"
                      placeholder="e.g. Divine Keza"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="rmf-form-group mb-0">
                    <label className="rmf-label">
                      <span>Email Address</span>
                    </label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="rmf-input"
                      placeholder="you@domain.rw"
                    />
                  </div>

                </div>

                {/* Subject Input */}
                <div className="rmf-form-group mb-0">
                  <label className="rmf-label">
                    <span>Subject</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="rmf-input"
                    placeholder="Brief summary of your inquiry"
                  />
                </div>

                {/* Message Input */}
                <div className="rmf-form-group mb-0">
                  <label className="rmf-label">
                    <span>Message</span>
                  </label>
                  <textarea 
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="rmf-input resize-none py-4"
                    placeholder="Provide as much detail as possible..."
                  ></textarea>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="rmf-btn-primary w-full md:w-auto min-w-[12rem] flex items-center justify-center gap-2"
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
