'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { notificationApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

export const NotificationBell = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: socketData } = useSocket(
    process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:3009',
    'notification:new',
    undefined,
    user?.id ? { query: { userId: user.id } } : undefined
  );

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    if (socketData) {
      setNotifications(prev => [socketData, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Browser Native Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Rwanda Marketplace', {
          body: socketData.content,
          icon: '/favicon.ico',
        });
      }

      // Mobile Vibration
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      toast(t('notif_new'), { icon: '🔔' });
    }
  }, [socketData, t]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await notificationApi.get(`/notifications/user/${user.id}`);
      if (res.data?.success) {
        const logs = res.data.data;
        setNotifications(logs.filter((l: any) => l.channel === 'IN_APP'));
        setUnreadCount(logs.filter((l: any) => l.channel === 'IN_APP' && !l.isRead).length);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.put(`/notifications/read/${id}`, { userId: user?.id });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.put('/notifications/read-all', { userId: user?.id });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-12 h-12 border-2 border-[#121212] flex flex-col items-center justify-center text-[#121212] hover:bg-[#121212] hover:text-white transition-all bg-white shadow-sm group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        </svg>
        <span className="text-[7px] font-black tracking-tighter uppercase">Alerts</span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-[#F59E0B] text-white text-[9px] font-black px-2 py-0.5 border-2 border-white shadow-lg">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-96 bg-white border border-[#E5E1D8] shadow-2xl z-[100] animate-fade-in">
          <div className="p-6 border-b border-[#E5E1D8] flex justify-between items-center bg-[#F9F7F2]">
            <div>
              <h3 className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.3em]">{t('notif_title')}</h3>
              <p className="text-[8px] font-bold text-[#6B665E] uppercase tracking-widest mt-1 italic">{unreadCount} Pending Briefs</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="text-[9px] text-[#F59E0B] font-bold uppercase tracking-widest hover:border-b border-[#F59E0B]/20"
              >
                {t('notif_mark_all_read')}
              </button>
            )}
          </div>
          <div className="max-h-[450px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-20 text-center text-[#6B665E] text-[10px] uppercase tracking-widest italic opacity-40">
                {t('notif_empty')}
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif._id} 
                  className={`p-6 border-b border-[#E5E1D8] flex gap-4 hover:bg-[#F9F7F2] transition-colors cursor-pointer relative ${!notif.isRead ? 'bg-[#F59E0B]/5' : ''}`}
                  onClick={() => !notif.isRead && handleMarkRead(notif._id)}
                >
                  <div className="w-8 h-8 border border-[#E5E1D8] flex items-center justify-center text-sm bg-white flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs leading-relaxed italic ${!notif.isRead ? 'font-bold text-[#1A1A1A]' : 'text-[#6B665E]'}`}>
                      {notif.content}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-[8px] font-bold text-[#F59E0B] uppercase tracking-widest">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • FACILITATION
                      </p>
                      {!notif.isRead && (
                        <div className="w-1 h-1 bg-[#F59E0B]"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="p-4 bg-[#F9F7F2] text-center">
               <button className="text-[9px] font-bold text-[#1A1A1A] uppercase tracking-widest hover:text-[#F59E0B] transition-colors">{t('notif_view_all')} →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
