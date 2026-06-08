'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { productApi } from '@/lib/api';

type BulkResult = {
  total: number;
  success: number;
  failed: number;
  errors: string[];
};

export default function SellerBulkUploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const downloadTemplate = async () => {
    setIsDownloading(true);
    const toastId = toast.loading('Generating template…');
    try {
      const response = await productApi.get('/products/bulk/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'rmf_bulk_product_template.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded.', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to download template: ' + (err?.message || 'Server error'), { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Please choose a CSV or Excel file first.');
    if (!user?.id) return toast.error('Please sign in again to continue.');

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}…`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', user.id);

    try {
      const res = await productApi.post('/products/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { total, success, failed, errors } = res.data.data;
      setResult({ total, success, failed, errors: Array.isArray(errors) ? errors : [] });
      toast.success(`Import complete: ${success} imported, ${failed} failed.`, { id: toastId, duration: 5000 });
      setFile(null);
    } catch (err: any) {
      toast.error('Bulk upload failed: ' + (err?.response?.data?.message || err?.message), { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const steps = [
    { n: 1, title: 'Download the template', desc: 'Get the official spreadsheet with the correct columns.' },
    { n: 2, title: 'Fill in your products', desc: 'Add one product per row following the example values.' },
    { n: 3, title: 'Upload the file', desc: 'We validate every row and report success or errors per line.' },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-8 animate-reveal pb-20">
        <div>
          <Link href="/seller/products" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:text-[#e05300]">
            <ArrowLeft size={14} />
            Back to products
          </Link>
          <div className="mt-4 border-b-2 border-[#e0e0e0] pb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-[#ff6b00]">Seller · Bulk import</p>
            <h1 className="text-4xl font-sans tracking-normal text-[#1b1c1c]">Bulk Product Upload</h1>
            <p className="mt-2 text-sm font-semibold text-[#414844]">Import many products at once with a spreadsheet.</p>
          </div>
        </div>

        {/* Steps */}
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map(s => (
            <div key={s.n} className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffedd5] text-sm font-black text-[#e05300]">{s.n}</div>
              <p className="mt-3 text-sm font-black text-[#1b1c1c]">{s.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#5f7569]">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Step 1: template */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-[#ff6b00] shadow-sm">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <p className="text-sm font-black text-[#1b1c1c]">Step 1 — Download template</p>
              <p className="mt-1 text-xs font-semibold text-[#5f7569]">Excel/CSV with required columns and an example row.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={isDownloading}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[#e05300] px-5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
          >
            <Download size={15} />
            {isDownloading ? 'Preparing…' : 'Download template'}
          </button>
        </section>

        {/* Step 2: upload / result */}
        {result ? (
          <section className="space-y-6 rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-lg font-black text-[#1b1c1c]">
              {result.failed === 0 ? <CheckCircle2 className="text-[#80c29a]" size={22} /> : <AlertCircle className="text-red-500" size={22} />}
              Import complete
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-md border border-[#d9e0db] bg-white p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#414844]/60">Total rows</p>
                <p className="mt-2 text-3xl font-black text-[#1b1c1c]">{result.total}</p>
              </div>
              <div className="rounded-md border border-[#e05300]/20 bg-green-50/30 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#ff6b00]">Imported</p>
                <p className="mt-2 text-3xl font-black text-[#ff6b00]">{result.success}</p>
              </div>
              <div className={`rounded-md border p-4 text-center ${result.failed > 0 ? 'border-red-200 bg-red-50/30' : 'border-[#d9e0db] bg-white'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#7b3f3f]">Failed</p>
                <p className="mt-2 text-3xl font-black text-[#7b3f3f]">{result.failed}</p>
              </div>
            </div>

            {result.failed > 0 && result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7b3f3f]">Row errors</p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-red-100 bg-red-50/50 p-4 font-mono text-[10px] text-red-700">
                  {result.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-[#e0e0e0] pt-4">
              <button
                type="button"
                onClick={() => router.push('/seller/products')}
                className="px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]/40 transition hover:text-[#1b1c1c]"
              >
                ← Back to products
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-md bg-[#e05300] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00]"
              >
                Upload another
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleUpload} className="space-y-5 rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-sm">
            <p className="text-sm font-black text-[#1b1c1c]">Step 2 — Upload your filled file</p>
            <div className="group relative rounded-lg border-2 border-dashed border-[#b8c7be]/60 bg-[#f7faf8] p-12 text-center transition hover:border-[#ff6b00]">
              <input
                type="file"
                accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center gap-3">
                <UploadCloud className="text-[#5f7569] transition group-hover:text-[#ff6b00]" size={40} />
                <p className="text-xs font-black uppercase tracking-widest text-[#1b1c1c]">
                  {file ? file.name : 'Select or drag your CSV/Excel file'}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#414844]/60">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Maximum file size: 5 MB'}
                </p>
              </div>
            </div>

            {file && (
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-md border border-[#d9e0db] px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#405046] transition hover:border-[#ff6b00]"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-md bg-[#e05300] px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
                >
                  {isUploading ? 'Processing…' : 'Upload & import'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </Layout>
  );
}
