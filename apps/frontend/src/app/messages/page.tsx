'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { orderApi } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { MessageSquare } from 'lucide-react';

const MESSAGES_REFRESH_MS = 12000;
// The order schema has no per-message read receipt, so we track "last seen"
// locally to drive the unread dot. This is a UI affordance, not a server fact.
const LAST_SEEN_KEY = 'rmf_messages_last_seen';

type Conversation = {
  key: string;
  counterparty: string;
  orderId: string;
  orderNumber: string;
  channel: string;
  lastContent: string;
  lastAt: number;
  unread: boolean;
};

const readLastSeen = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || '{}');
  } catch {
    return {};
  }
};

export default function MessagesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    setLastSeen(readLastSeen());
  }, []);

  const { data: orders, loading } = useApi(
    orderApi,
    'get',
    user?.id
      ? user.role === 'SELLER'
        ? `/orders?sellerUserId=${user.id}`
        : user.role === 'RIDER'
          ? `/orders?riderUserId=${user.id}`
          : user.role === 'ADMIN'
            ? '/orders'
            : `/orders?buyerId=${user.id}`
      : '',
    { refreshInterval: MESSAGES_REFRESH_MS },
  );

  // Group orders that carry messages by counterparty and channel. We keep the
  // most recently active order per thread as the conversation anchor.
  const conversations = useMemo<Conversation[]>(() => {
    if (!Array.isArray(orders)) return [];
    const byCounterparty = new Map<string, Conversation>();
    const myRole = String(user?.role || 'BUYER').toUpperCase();

    const resolveCounterparty = (order: any, message: any) => {
      const senderRole = String(message?.senderRole || '').toUpperCase();
      const recipientRole = String(message?.recipientRole || '').toUpperCase();
      const otherRole = senderRole && senderRole !== myRole ? senderRole : recipientRole && recipientRole !== myRole ? recipientRole : '';
      if (otherRole === 'BUYER') return { label: order.buyer?.fullName || 'Buyer', id: order.buyer?.userId || 'buyer' };
      if (otherRole === 'RIDER') return { label: order.rider?.fullName || 'Rider', id: order.rider?.userId || order.rider?.riderId || 'rider' };
      if (otherRole === 'ADMIN') return { label: 'RMF Admin', id: 'admin' };
      return {
        label: order.seller?.shopName || order.seller?.fullName || 'Seller',
        id: order.seller?.userId || order.seller?.sellerId || 'seller',
      };
    };

    for (const order of orders) {
      const messages = Array.isArray(order?.messages) ? order.messages : [];
      if (messages.length === 0) continue;

      const last = messages[messages.length - 1];
      const channel = String(last?.channel || 'ORDER').toUpperCase();
      const counterpartyInfo = resolveCounterparty(order, last);
      const counterparty = counterpartyInfo.label;
      const key = `${channel}:${String(counterpartyInfo.id)}:${String(order._id)}`;
      const lastAt = new Date(last?.timestamp || order.updatedAt || 0).getTime();

      // A message is "unread" if the latest message came from someone else and
      // is newer than the last time this user opened the conversation.
      const fromCounterparty = String(last?.senderRole || '').toUpperCase() !== myRole;
      const unread = fromCounterparty && lastAt > (lastSeen[key] || 0);

      const existing = byCounterparty.get(key);
      if (!existing || lastAt > existing.lastAt) {
        byCounterparty.set(key, {
          key,
          counterparty,
          orderId: String(order._id),
          orderNumber: order.orderNumber || String(order._id).slice(-6),
          channel,
          lastContent: last?.content || '',
          lastAt,
          unread: unread || (existing?.unread ?? false),
        });
      } else if (unread) {
        existing.unread = true;
      }
    }

    return Array.from(byCounterparty.values()).sort((a, b) => b.lastAt - a.lastAt);
  }, [orders, lastSeen, user?.role]);

  const openConversation = (conv: Conversation) => {
    const next = { ...readLastSeen(), [conv.key]: Date.now() };
    try {
      localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
    setLastSeen(next);
    router.push(`/orders?open=${conv.orderId}`);
  };

  if (isLoading || !user) {
    return (
      <Layout>
        <div className="flex min-h-[40vh] items-center justify-center text-on-surface-variant">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-3 border-b border-outline-variant pb-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container/20 text-primary">
            <MessageSquare size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Messages</h1>
            <p className="text-sm text-on-surface-variant">Your conversations grouped by person, order, and channel.</p>
          </div>
        </div>

        {loading && conversations.length === 0 && (
          <div className="py-16 text-center text-on-surface-variant">Loading your conversations…</div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low py-20 text-center">
            <MessageSquare size={40} className="mx-auto mb-4 text-on-surface-variant/50" />
            <p className="font-semibold text-on-surface">No messages yet</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              When you message a seller about an order, the conversation will appear here.
            </p>
          </div>
        )}

        <div className="divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
          {conversations.map((conv) => (
            <button
              key={conv.key}
              type="button"
              onClick={() => openConversation(conv)}
              className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-surface-container-highest"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-highest font-bold text-on-surface">
                {conv.counterparty.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-on-surface">{conv.counterparty}</p>
                  {conv.lastAt > 0 && (
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {new Date(conv.lastAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-on-surface-variant">
                  {conv.lastContent || 'Open conversation'}
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant/70">Order #{conv.orderNumber}</p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">{conv.channel.toLowerCase()} message</p>
              </div>
              {conv.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
