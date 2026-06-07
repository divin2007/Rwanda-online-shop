'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Radio, Copy, Eye, StopCircle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { sellerApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

const LIVE_SOCKET_URL = process.env.NEXT_PUBLIC_SELLER_SERVICE_URL || 'http://localhost:3004';

export default function SellerLiveStudioPage() {
  const [session, setSession] = useState<any>(null);
  const [productId, setProductId] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [viewerCount, setViewerCount] = useState(0);

  const { data: newOrder, emit, isConnected } = useSocket<any>(LIVE_SOCKET_URL, 'live:new_order');
  const { data: viewerData } = useSocket<any>(LIVE_SOCKET_URL, 'live:viewer_join');

  useEffect(() => {
    if (session?.sessionId && isConnected) emit('live:join', session.sessionId);
  }, [session, isConnected, emit]);
  useEffect(() => { if (newOrder) setOrders((p) => [newOrder, ...p].slice(0, 50)); }, [newOrder]);
  useEffect(() => { if (viewerData?.viewerCount != null) setViewerCount(viewerData.viewerCount); }, [viewerData]);

  const start = async () => {
    try {
      const res = await sellerApi.post('/live-sessions/start', {});
      setSession(res.data?.data);
      toast.success('You are live!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to start session');
    }
  };

  const end = async () => {
    if (!session?.sessionId) return;
    try {
      await sellerApi.post(`/live-sessions/${session.sessionId}/end`, {});
      setSession(null);
      toast.success('Session ended');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to end session');
    }
  };

  const featureProduct = async () => {
    if (!session?.sessionId || !productId.trim()) return;
    try {
      await sellerApi.post(`/live-sessions/${session.sessionId}/feature-product`, { productId: productId.trim() });
      toast.success('Product featured');
      setProductId('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to feature product');
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900"><Radio className="text-red-600" /> Live Studio</h1>

        {!session ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="mb-4 text-sm text-gray-500">Start a live session to showcase products in real time.</p>
            <button onClick={start} className="rounded bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700">Go Live</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
              <span className="flex items-center gap-2 text-sm font-bold text-red-600"><Radio size={16} /> You are live</span>
              <span className="flex items-center gap-1 text-sm text-gray-500"><Eye size={14} /> {viewerCount} viewers</span>
              <button onClick={end} className="flex items-center gap-1 rounded bg-gray-800 px-3 py-1.5 text-xs font-bold text-white"><StopCircle size={14} /> End</button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase text-gray-500">Stream Key (keep private)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-gray-100 px-3 py-2 text-xs">{session.streamKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(session.streamKey); toast.success('Copied'); }} className="rounded border border-gray-300 p-2"><Copy size={14} /></button>
              </div>
              {session.playbackUrl && <p className="mt-2 text-xs text-gray-500">Playback URL: {session.playbackUrl}</p>}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase text-gray-500">Feature a Product</p>
              <div className="flex gap-2">
                <input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Product ID" className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" />
                <button onClick={featureProduct} className="rounded bg-[#e05300] px-4 py-2 text-sm font-bold text-white hover:bg-[#c44800]">Pin</button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-bold uppercase text-gray-500">Live Orders</p>
              {orders.length === 0 ? <p className="text-sm text-gray-400">No orders yet.</p> :
                <ul className="space-y-1">{orders.map((o, i) => <li key={i} className="text-sm text-gray-800">Order {o.orderNumber || ''} placed</li>)}</ul>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
