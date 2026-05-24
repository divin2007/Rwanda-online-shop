'use client';

import React from 'react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { SellerVideoFeed } from '@/components/ui/SellerVideoFeed';
import { useAuth } from '@/context/AuthContext';
import { productApi, sellerApi } from '@/lib/api';
import { UploadCloud, Video } from 'lucide-react';

type ProductOption = {
  _id: string;
  name: string;
  price: number;
  unit?: string;
  variants?: Array<{ sku: string; title: string; price?: number }>;
};

export default function SellerVideosPage() {
  const { user } = useAuth();
  const [seller, setSeller] = React.useState<any>(null);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [title, setTitle] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [productId, setProductId] = React.useState('');
  const [variantSku, setVariantSku] = React.useState('');
  const [placement, setPlacement] = React.useState<'SHOP_AD' | 'PRODUCT_AD' | 'STORY'>('SHOP_AD');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [thumbnailUrl, setThumbnailUrl] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const loadSellerData = React.useCallback(async () => {
    if (!user) return;
    try {
      const [sellerRes, productsRes] = await Promise.all([
        sellerApi.get('/sellers/me'),
        productApi.get(`/products?sellerId=${encodeURIComponent(user.id)}&isActive=true`),
      ]);
      const sellerData = sellerRes.data?.data || null;
      setSeller(sellerData);
      const productList = Array.isArray(productsRes.data?.data) ? productsRes.data.data : [];
      setProducts(productList);
    } catch (error) {
      console.error('Failed to load seller video data', error);
    }
  }, [user]);

  React.useEffect(() => {
    loadSellerData();
  }, [loadSellerData]);

  const uploadVideo = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await productApi.post('/seller-videos/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVideoUrl(res.data?.data?.url || '');
      toast.success('Video uploaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Video upload failed');
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    if (!title.trim() || !videoUrl) {
      toast.error('Add a title and upload a video first.');
      return;
    }
    setSubmitting(true);
    try {
      await productApi.post('/seller-videos', {
        title,
        caption,
        tags,
        placement,
        productId: placement === 'PRODUCT_AD' ? productId || undefined : undefined,
        variantSku: placement === 'PRODUCT_AD' ? variantSku || undefined : undefined,
        videoUrl,
        thumbnailUrl: thumbnailUrl || undefined,
      });
      toast.success(placement === 'STORY' ? 'Story published for 24 hours' : 'Video ad published');
      setTitle('');
      setCaption('');
      setTags('');
      setPlacement('SHOP_AD');
      setProductId('');
      setVariantSku('');
      setVideoUrl('');
      setThumbnailUrl('');
      await loadSellerData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not publish video');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-8 md:px-8">
        <section className="rounded-3xl bg-[#1b1c1c] p-8 text-white shadow-2xl md:p-10">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#ff6b00]">
            <Video size={16} /> Seller video ads
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Publish product demos and shop adverts.</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/70">
            Upload short videos for buyers scrolling all RMF markets or your specific market storefront.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#eaded4] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-[#1b1c1c]">New video</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Video file</span>
                <div className="mt-2 flex min-h-[9rem] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#ff6b00]/50 bg-[#fff7ed] p-5 text-center">
                  <UploadCloud className="text-[#ff6b00]" />
                  <p className="mt-2 text-sm font-black text-[#7c2d12]">{uploading ? 'Uploading...' : videoUrl ? 'Video ready' : 'Choose MP4, WebM, MOV, or M4V'}</p>
                  <input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={event => uploadVideo(event.target.files?.[0])} />
                </div>
              </label>

              {videoUrl ? (
                <video src={videoUrl} controls playsInline className="aspect-video w-full rounded-2xl bg-black object-cover" />
              ) : null}

              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Video type</span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { value: 'SHOP_AD' as const, label: 'Shop advert', help: 'One active advert for your whole shop.' },
                    { value: 'PRODUCT_AD' as const, label: 'Product demo', help: 'Attach the video to one product.' },
                    { value: 'STORY' as const, label: '24h story', help: 'Appears on your market page and disappears after 24 hours.' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPlacement(option.value)}
                      className={`rounded-xl border p-3 text-left transition ${placement === option.value ? 'border-[#ff6b00] bg-[#fff7ed]' : 'border-[#eaded4] bg-white'}`}
                    >
                      <span className="block text-sm font-black text-[#1b1c1c]">{option.label}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-[#63736a]">{option.help}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Title</span>
                <input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-[#eaded4] px-4 py-3 font-semibold outline-none focus:border-[#ff6b00]" />
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Caption</span>
                <textarea value={caption} onChange={event => setCaption(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-[#eaded4] px-4 py-3 font-semibold outline-none focus:border-[#ff6b00]" />
              </label>

              {placement === 'PRODUCT_AD' ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Linked product</span>
                    <select value={productId} onChange={event => { setProductId(event.target.value); setVariantSku(''); }} className="mt-2 w-full rounded-xl border border-[#eaded4] px-4 py-3 font-semibold outline-none focus:border-[#ff6b00]">
                      <option value="">Choose a product...</option>
                      {products.map(product => (
                        <option key={product._id} value={product._id}>{product.name}</option>
                      ))}
                    </select>
                  </label>

                  {(() => {
                    const selected = products.find(p => p._id === productId);
                    if (selected?.variants && selected.variants.length > 0) {
                      return (
                        <label className="block animate-reveal">
                          <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Linked Product Variant (Optional)</span>
                          <select value={variantSku} onChange={event => setVariantSku(event.target.value)} className="mt-2 w-full rounded-xl border border-[#eaded4] px-4 py-3 font-semibold outline-none focus:border-[#ff6b00]">
                            <option value="">Apply to all variants (Whole Product)</option>
                            {selected.variants.map(v => (
                              <option key={v.sku} value={v.sku}>{v.title}</option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm font-semibold leading-6 text-[#7c2d12]">
                  {placement === 'STORY'
                    ? 'A story is a short market update. It is shown on your market page and automatically archives after 24 hours.'
                    : 'A shop advert is limited to one active video per shop. Buyers can like and comment on it from the video feed and your market storefront.'}
                </div>
              )}

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Tags</span>
                <input value={tags} onChange={event => setTags(event.target.value)} placeholder="fresh, handmade, momo" className="mt-2 w-full rounded-xl border border-[#eaded4] px-4 py-3 font-semibold outline-none focus:border-[#ff6b00]" />
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#63736a]">Thumbnail URL</span>
                <input value={thumbnailUrl} onChange={event => setThumbnailUrl(event.target.value)} placeholder="Optional public image URL" className="mt-2 w-full rounded-xl border border-[#eaded4] px-4 py-3 font-semibold outline-none focus:border-[#ff6b00]" />
              </label>

              <button onClick={publish} disabled={submitting || uploading} className="min-h-12 w-full rounded-xl bg-[#ff6b00] px-5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50">
                {submitting ? 'Publishing...' : placement === 'STORY' ? 'Publish story' : 'Publish video ad'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#eaded4] bg-white p-6 shadow-sm">
            <SellerVideoFeed
              sellerId={seller?._id}
              compact
              title="Your active videos"
              description="Published videos buyers can discover from RMF video feeds."
            />
          </div>
        </section>
      </div>
    </Layout>
  );
}
