'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Globe2, LockKeyhole, Mail, MessageSquareText, RotateCcw, Send, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { notificationApi, riderApi, sellerApi, userApi } from '@/lib/api';

type SettingsState = {
  language: 'en' | 'fr' | 'kin';
  currency: string;
  notifications: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    securityAlerts: boolean;
    customMessagesEmailOnly: boolean;
  };
  privacy: {
    showProfilePhoto: boolean;
    sharePhoneWithOrderParties: boolean;
  };
  seller: {
    autoReplyEnabled: boolean;
    autoReplyMessage: string;
    quoteExpiryHours: number;
  };
  rider: {
    autoAcceptNearby: boolean;
    maxPickupDistanceKm: number;
  };
};

const defaults: SettingsState = {
  language: 'en',
  currency: 'RWF',
  notifications: {
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
    orderUpdates: true,
    promotions: false,
    securityAlerts: true,
    customMessagesEmailOnly: false,
  },
  privacy: {
    showProfilePhoto: true,
    sharePhoneWithOrderParties: true,
  },
  seller: {
    autoReplyEnabled: false,
    autoReplyMessage: '',
    quoteExpiryHours: 24,
  },
  rider: {
    autoAcceptNearby: false,
    maxPickupDistanceKm: 8,
  },
};

const mergeSettings = (incoming: Partial<SettingsState> | null): SettingsState => ({
  ...defaults,
  ...(incoming || {}),
  notifications: { ...defaults.notifications, ...(incoming?.notifications || {}) },
  privacy: { ...defaults.privacy, ...(incoming?.privacy || {}) },
  seller: { ...defaults.seller, ...(incoming?.seller || {}) },
  rider: { ...defaults.rider, ...(incoming?.rider || {}) },
});

const persistClientPreferences = (settings: SettingsState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('rmf_preferences', JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('rmf:preferences-updated', { detail: settings }));
};

const Toggle = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) => (
  <label className="flex cursor-pointer items-start justify-between gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-all duration-300 hover:border-primary custom-shadow">
    <span>
      <span className="block text-body-md font-bold text-on-surface">{label}</span>
      <span className="mt-xs block text-xs font-semibold leading-relaxed text-on-surface-variant">{description}</span>
    </span>
    <input type="checkbox" className="sr-only" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span className={`relative mt-xs h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${checked ? 'bg-primary-container' : 'bg-surface-container-high'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${checked ? 'left-6' : 'left-1'}`} />
    </span>
  </label>
);

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const { t, setLanguage } = useLanguage();
  const [settings, setSettings] = useState<SettingsState>(defaults);
  const [savedSettings, setSavedSettings] = useState<SettingsState>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sellerRequest, setSellerRequest] = useState({ stallName: '', tagline: '', description: '', categories: '' });
  const [riderRequest, setRiderRequest] = useState({ plateNumber: '', licenseUrl: '', vehiclePhotoUrl: '', insuranceUrl: '' });
  const [requestingReview, setRequestingReview] = useState(false);

  useEffect(() => {
    if (!isLoading && !user && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (!user) {
      if (!isLoading) setLoading(false);
      return;
    }
    userApi.get('/users/settings')
      .then(res => {
        const nextSettings = mergeSettings(res.data?.data || null);
        setSettings(nextSettings);
        setSavedSettings(nextSettings);
        setLanguage(nextSettings.language);
        persistClientPreferences(nextSettings);
      })
      .catch((error: any) => {
        if (error?.response?.status !== 401) {
          toast.error('Settings could not be loaded. Showing safe defaults.');
        }
        setSettings(defaults);
        setSavedSettings(defaults);
      })
      .finally(() => setLoading(false));
  }, [isLoading, setLanguage, user]);

  const canUseSellerSettings = user?.role === 'SELLER' || user?.role === 'ADMIN';
  const canUseRiderSettings = user?.role === 'RIDER' || user?.role === 'ADMIN';

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(current => ({ ...current, [key]: value }));
    if (key === 'language') setLanguage(value as SettingsState['language']);
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const notificationRows = useMemo(() => [
    ['inApp', 'In-app notifications', 'Show order, message, delivery, and security alerts in RMF.'],
    ['email', 'Email notifications', 'Send important marketplace updates to your email address.'],
    ['customMessagesEmailOnly', 'Custom messages only by email', 'Route custom buyer or seller messages to email instead of push-style alerts.'],
    ['sms', 'SMS alerts', 'Use phone alerts for urgent order and delivery updates.'],
    ['whatsapp', 'WhatsApp alerts', 'Use WhatsApp for buyer, seller, and delivery coordination.'],
    ['orderUpdates', 'Order updates', 'Notify me when quotes, payments, pickups, or deliveries change.'],
    ['promotions', 'Promotions', 'Receive campaign, flash sale, and marketplace deal updates.'],
    ['securityAlerts', 'Security alerts', 'Always notify me about sign-ins, profile changes, and payment risk.'],
  ] as const, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await userApi.put('/users/settings', settings);
      const nextSettings = mergeSettings(res.data?.data || settings);
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setLanguage(nextSettings.language);
      persistClientPreferences(nextSettings);
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const submitSellerSettingsReview = async () => {
    setRequestingReview(true);
    try {
      await sellerApi.post('/sellers/settings/change-request', {
        stallName: sellerRequest.stallName,
        description: sellerRequest.description,
        shopDetails: {
          name: sellerRequest.stallName,
          tagline: sellerRequest.tagline,
          description: sellerRequest.description,
          categories: sellerRequest.categories.split(',').map(item => item.trim()).filter(Boolean),
        },
        market: {
          name: sellerRequest.stallName,
          description: sellerRequest.description,
        },
      });
      toast.success('Seller settings sent for admin approval');
      setSellerRequest({ stallName: '', tagline: '', description: '', categories: '' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not submit seller settings for review');
    } finally {
      setRequestingReview(false);
    }
  };

  const submitRiderSettingsReview = async () => {
    setRequestingReview(true);
    try {
      await riderApi.post('/riders/settings/change-request', riderRequest);
      toast.success('Rider settings sent for admin approval');
      setRiderRequest({ plateNumber: '', licenseUrl: '', vehiclePhotoUrl: '', insuranceUrl: '' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not submit rider settings for review');
    } finally {
      setRequestingReview(false);
    }
  };

  const resetSettings = () => {
    setSettings(savedSettings);
    setLanguage(savedSettings.language);
    toast('Unsaved changes reset');
  };

  const sendTestNotification = async () => {
    if (!user?.id) {
      toast.error('Sign in to test notifications');
      return;
    }

    setTesting(true);
    try {
      const response = await notificationApi.post('/notifications/in-app', {
        userId: user.id,
        type: 'settings.test',
        params: {
          referenceId: user.id,
          referenceType: 'Settings',
        },
      });
      const data = response.data?.data;
      if (data?.skipped) {
        toast(`Test skipped: ${data.reason}`);
      } else {
        toast.success('Test alert sent');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not send test alert');
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ffedd5] border-t-[#ff6b00]" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#ff6b00] text-white">
            <LockKeyhole size={22} />
          </div>
          <h1 className="text-3xl font-black text-[#1b1c1c]">{t('settings_signin')}</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#5f7569]">
            {t('settings_signin_desc')}
          </p>
          <a href="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#ff6b00] px-6 text-sm font-black text-white">
            {t('sign_in')}
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-lg">
        
        {/* Solaris Ivory Premium Header Banner with custom radial glow */}
        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-[#1b1c1b] p-md text-white shadow-sm md:p-xl custom-shadow">
          <div className="absolute inset-0 hero-glow pointer-events-none z-10" />
          <div className="absolute inset-0 bg-black/20 z-0" />
          
          <div className="relative z-20 flex flex-col justify-between gap-md md:flex-row md:items-end">
            <div className="space-y-xs">
              <div className="inline-flex items-center gap-xs rounded-full bg-white/10 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-container border border-white/10 backdrop-blur-md">
                <SlidersHorizontal size={14} />
                {t('account_controls')}
              </div>
              <h1 className="font-display-lg text-headline-lg text-white sm:text-[32px] md:text-[38px] leading-tight">
                {t('settings_title')}
              </h1>
              <p className="max-w-xl text-xs sm:text-sm text-white/80 leading-relaxed font-body-md">
                {t('settings_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || !isDirty}
              className="bg-primary-container text-on-primary font-label-caps text-label-caps px-6 py-3 rounded-full hover:bg-primary transition-colors disabled:opacity-60 shadow-sm shrink-0"
            >
              {saving ? t('saving') : isDirty ? t('save_settings') : t('saved')}
            </button>
          </div>
        </section>

        <div className="grid gap-md lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-md">
            
            {/* Language & Currency Selection */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md sm:p-lg custom-shadow space-y-md">
              <div className="flex items-center gap-xs pb-sm border-b border-outline-variant/60">
                <Globe2 className="text-primary-container shrink-0" size={20} />
                <h2 className="font-headline-md text-headline-md text-on-surface">{t('language_and_money')}</h2>
              </div>
              <div className="grid gap-md sm:grid-cols-2">
                <label className="block space-y-xs">
                  <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">{t('current_language')}</span>
                  <select
                    value={settings.language}
                    onChange={event => update('language', event.target.value as SettingsState['language'])}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all cursor-pointer"
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="kin">Kinyarwanda</option>
                  </select>
                </label>
                <label className="block space-y-xs">
                  <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">{t('currency')}</span>
                  <select
                    value={settings.currency}
                    onChange={event => update('currency', event.target.value)}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all cursor-pointer"
                  >
                    <option value="RWF">RWF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
            </section>

            {/* Notifications Matrix */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md sm:p-lg custom-shadow space-y-md">
              <div className="flex items-center gap-xs pb-sm border-b border-outline-variant/60">
                <Bell className="text-primary-container shrink-0" size={20} />
                <h2 className="font-headline-md text-headline-md text-on-surface">{t('notifications')}</h2>
              </div>
              <div className="grid gap-md md:grid-cols-2">
                {notificationRows.map(([key, label, description]) => (
                  <Toggle
                    key={key}
                    checked={settings.notifications[key]}
                    label={label}
                    description={description}
                    onChange={value => update('notifications', { ...settings.notifications, [key]: value })}
                  />
                ))}
              </div>
            </section>

            {/* Privacy Section */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md sm:p-lg custom-shadow space-y-md">
              <div className="flex items-center gap-xs pb-sm border-b border-outline-variant/60">
                <LockKeyhole className="text-primary-container shrink-0" size={20} />
                <h2 className="font-headline-md text-headline-md text-on-surface">{t('privacy')}</h2>
              </div>
              <div className="grid gap-md md:grid-cols-2">
                <Toggle
                  checked={settings.privacy.showProfilePhoto}
                  label={t('show_profile_photo')}
                  description={t('show_profile_photo_desc')}
                  onChange={value => update('privacy', { ...settings.privacy, showProfilePhoto: value })}
                />
                <Toggle
                  checked={settings.privacy.sharePhoneWithOrderParties}
                  label={t('share_phone')}
                  description={t('share_phone_desc')}
                  onChange={value => update('privacy', { ...settings.privacy, sharePhoneWithOrderParties: value })}
                />
              </div>
            </section>

            {/* Seller Messaging Automation */}
            {canUseSellerSettings && (
              <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md sm:p-lg custom-shadow space-y-md">
                <div className="flex items-center gap-xs pb-sm border-b border-outline-variant/60">
                  <MessageSquareText className="text-primary-container shrink-0" size={20} />
                  <h2 className="font-headline-md text-headline-md text-on-surface">{t('seller_messaging')}</h2>
                </div>
                <div className="grid gap-md md:grid-cols-2">
                  <Toggle
                    checked={settings.seller.autoReplyEnabled}
                    label="Auto reply while busy"
                    description="Send a saved response when customers message outside your preferred hours."
                    onChange={value => update('seller', { ...settings.seller, autoReplyEnabled: value })}
                  />
                  <label className="block space-y-xs rounded-lg border border-outline-variant bg-surface-container-low p-md">
                    <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">{t('quote_expiry')}</span>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={settings.seller.quoteExpiryHours}
                      onChange={event => update('seller', { ...settings.seller, quoteExpiryHours: Number(event.target.value) })}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all font-data-mono"
                    />
                  </label>
                </div>
                <div className="space-y-xs">
                  <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">Auto reply away message text</span>
                  <textarea
                    value={settings.seller.autoReplyMessage}
                    onChange={event => update('seller', { ...settings.seller, autoReplyMessage: event.target.value })}
                    placeholder="Example: Thanks for your message. I will confirm availability shortly."
                    className="min-h-[100px] w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-md text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                  />
                </div>
              </section>
            )}

            {/* Seller Market Settings Change Request Panel */}
            {canUseSellerSettings && (
              <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md sm:p-lg custom-shadow space-y-md">
                <div className="flex items-center gap-xs pb-sm border-b border-outline-variant/60">
                  <ShieldCheck className="text-primary-container shrink-0" size={20} />
                  <div>
                    <h2 className="font-headline-md text-headline-md text-on-surface">Seller Market Settings Review</h2>
                    <p className="mt-xs text-xs font-semibold text-on-surface-variant">Shop and market changes are reviewed by admins before going live. The public slug stays locked.</p>
                  </div>
                </div>
                <div className="grid gap-md md:grid-cols-2">
                  <input
                    className="h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="Shop / market name"
                    value={sellerRequest.stallName}
                    onChange={event => setSellerRequest(current => ({ ...current, stallName: event.target.value }))}
                  />
                  <input
                    className="h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="Tagline"
                    value={sellerRequest.tagline}
                    onChange={event => setSellerRequest(current => ({ ...current, tagline: event.target.value }))}
                  />
                  <input
                    className="h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all md:col-span-2"
                    placeholder="Categories, comma separated"
                    value={sellerRequest.categories}
                    onChange={event => setSellerRequest(current => ({ ...current, categories: event.target.value }))}
                  />
                  <textarea
                    className="min-h-[100px] rounded-lg border border-outline-variant bg-surface-container-lowest p-md text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all md:col-span-2"
                    placeholder="Updated shop and market description"
                    value={sellerRequest.description}
                    onChange={event => setSellerRequest(current => ({ ...current, description: event.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={submitSellerSettingsReview}
                  disabled={requestingReview}
                  className="bg-primary-container text-on-primary font-label-caps text-label-caps px-6 py-3 rounded-full hover:bg-primary transition-colors disabled:opacity-60 shadow-sm"
                >
                  Submit for Admin Approval
                </button>
              </section>
            )}
          </main>

          <aside className="space-y-md">
            
            {/* Secure By Default Telemetry Panel */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-sm">
              <div className="flex items-center gap-xs pb-xs border-b border-outline-variant/60">
                <ShieldCheck className="text-primary-container shrink-0" size={20} />
                <h2 className="font-label-caps text-label-caps text-on-surface">{t('secure_by_default')}</h2>
              </div>
              <p className="text-body-md text-on-surface-variant font-medium leading-relaxed">
                {t('secure_by_default_desc')}
              </p>
              <div className="mt-md flex flex-wrap gap-xs pt-xs">
                <button
                  type="button"
                  onClick={resetSettings}
                  disabled={!isDirty}
                  className="inline-flex h-10 items-center gap-xs rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-xs font-bold text-on-surface hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={sendTestNotification}
                  disabled={testing || !settings.notifications.inApp}
                  className="inline-flex h-10 items-center gap-xs rounded-full bg-primary-container px-4 text-xs font-bold text-on-primary hover:bg-primary transition-colors disabled:opacity-50"
                >
                  <Send size={15} />
                  {testing ? t('sending') : t('test_alert')}
                </button>
              </div>
              {!settings.notifications.inApp && (
                <p className="mt-xs rounded-lg bg-surface-container-low border border-outline-variant p-sm text-xs font-semibold leading-relaxed text-on-surface-variant">
                  {t('test_alerts_unavailable')}
                </p>
              )}
            </section>

            {/* Message Routing Panel */}
            <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-sm">
              <div className="flex items-center gap-xs pb-xs border-b border-outline-variant/60">
                <Mail className="text-primary-container shrink-0" size={20} />
                <h2 className="font-label-caps text-label-caps text-on-surface">{t('message_routing')}</h2>
              </div>
              <p className="text-body-md text-on-surface-variant font-medium leading-relaxed">
                {t('message_routing_desc')}
              </p>
            </section>

            {/* Rider Preferences Panel */}
            {canUseRiderSettings && (
              <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-md">
                <div className="flex items-center gap-xs pb-xs border-b border-outline-variant/60">
                  <SlidersHorizontal className="text-primary-container shrink-0" size={20} />
                  <h2 className="font-label-caps text-label-caps text-on-surface">{t('rider_preferences')}</h2>
                </div>
                <div className="space-y-md">
                  <Toggle
                    checked={settings.rider.autoAcceptNearby}
                    label="Auto accept nearby"
                    description="Prepare future rider automation for jobs inside your preferred distance."
                    onChange={value => update('rider', { ...settings.rider, autoAcceptNearby: value })}
                  />
                  <label className="block space-y-xs rounded-lg border border-outline-variant bg-surface-container-low p-md">
                    <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant">{t('max_pickup_distance')}</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={settings.rider.maxPickupDistanceKm}
                      onChange={event => update('rider', { ...settings.rider, maxPickupDistanceKm: Number(event.target.value) })}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all font-data-mono"
                    />
                  </label>
                </div>
              </section>
            )}

            {/* Rider profile Review */}
            {canUseRiderSettings && (
              <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md custom-shadow space-y-md">
                <div className="flex items-center gap-xs pb-xs border-b border-outline-variant/60">
                  <ShieldCheck className="text-primary-container shrink-0" size={20} />
                  <h2 className="font-label-caps text-label-caps text-on-surface">Rider Profile Review</h2>
                </div>
                <p className="text-body-md text-on-surface-variant font-medium leading-relaxed">Vehicle and document changes go to admin review before they replace your approved profile.</p>
                <div className="space-y-sm">
                  <input
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="Plate number"
                    value={riderRequest.plateNumber}
                    onChange={event => setRiderRequest(current => ({ ...current, plateNumber: event.target.value }))}
                  />
                  <input
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="License URL"
                    value={riderRequest.licenseUrl}
                    onChange={event => setRiderRequest(current => ({ ...current, licenseUrl: event.target.value }))}
                  />
                  <input
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="Vehicle photo URL"
                    value={riderRequest.vehiclePhotoUrl}
                    onChange={event => setRiderRequest(current => ({ ...current, vehiclePhotoUrl: event.target.value }))}
                  />
                  <input
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary-container/10 transition-all"
                    placeholder="Insurance URL"
                    value={riderRequest.insuranceUrl}
                    onChange={event => setRiderRequest(current => ({ ...current, insuranceUrl: event.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={submitRiderSettingsReview}
                  disabled={requestingReview}
                  className="bg-primary-container text-on-primary font-label-caps text-label-caps px-6 py-3 rounded-full hover:bg-primary transition-colors disabled:opacity-60 shadow-sm w-full"
                >
                  Submit for Review
                </button>
              </section>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}
