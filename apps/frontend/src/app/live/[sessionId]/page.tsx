'use client';

import React, { useEffect, useState } from 'react';
import { Radio, Eye, Send, Heart } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useSocket } from '@/hooks/useSocket';

const LIVE_SOCKET_URL = process.env.NEXT_PUBLIC_SELLER_SERVICE_URL || 'http://localhost:3004';

export default function LiveViewerPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params);
  const [comments, setComments] = useState<any[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [input, setInput] = useState('');
  const [playbackUrl] = useState<string | null>(null);

  const { data: commentData, emit, isConnected } = useSocket<any>(LIVE_SOCKET_URL, 'live:comment');
  const { data: viewerData } = useSocket<any>(LIVE_SOCKET_URL, 'live:viewer_join');
  const { data: newOrder } = useSocket<any>(LIVE_SOCKET_URL, 'live:new_order');

  useEffect(() => {
    if (isConnected) emit('live:join', sessionId);
    return () => { if (isConnected) emit('live:leave', sessionId); };
  }, [isConnected, sessionId, emit]);

  useEffect(() => { if (commentData) setComments((p) => [...p.slice(-50), commentData]); }, [commentData]);
  useEffect(() => { if (viewerData?.viewerCount != null) setViewerCount(viewerData.viewerCount); }, [viewerData]);

  const sendComment = () => {
    if (!input.trim()) return;
    emit('live:comment', { sessionId, text: input.trim() });
    setInput('');
  };

  const react = () => emit('live:reaction', { sessionId, reaction: '❤️' });

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-gray-800 to-gray-900">
          {playbackUrl ? (
            <video src={playbackUrl} controls autoPlay className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-white/70">
              <Radio size={40} className="mb-2" />
              <p className="text-sm">Live stream coming soon</p>
            </div>
          )}
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase text-white">
            <Radio size={11} /> Live
          </span>
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
            <Eye size={11} /> {viewerCount}
          </span>
        </div>

        {newOrder && (
          <div className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">New order just placed in this session!</div>
        )}

        <div className="mt-4 rounded-lg border border-gray-200 bg-white">
          <div className="max-h-56 space-y-1 overflow-y-auto p-3">
            {comments.length === 0 ? <p className="text-center text-xs text-gray-400">Be the first to comment.</p> :
              comments.map((c, i) => (
                <p key={i} className="text-sm text-gray-800"><span className="font-bold">{c.name || 'Viewer'}:</span> {c.text}</p>
              ))}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 p-2">
            <input
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendComment()}
              placeholder="Say something…" className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button onClick={react} className="rounded p-2 text-red-500 hover:bg-red-50"><Heart size={18} /></button>
            <button onClick={sendComment} className="rounded bg-[#e05300] p-2 text-white hover:bg-[#c44800]"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
