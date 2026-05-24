'use client';

import React, { useState } from 'react';
import { Camera, CheckCircle2, FileText, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { productApi, sellerApi, deliveryApi, riderApi, orderApi, marketApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';

interface ImageUploadProps {
  onUploadSuccess?: (url: string) => void;
  onChange?: (url: string) => void;
  value?: string;
  service: 'product' | 'seller' | 'rider' | 'delivery' | 'order' | 'market';
  endpoint: string;
  capture?: 'environment' | 'user';
  label?: string;
  compact?: boolean;
  kind?: 'image' | 'document';
  accept?: string;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const ImageUpload = ({
  onUploadSuccess,
  onChange,
  value,
  service,
  endpoint,
  capture,
  label = 'Upload image',
  compact,
  kind,
  accept,
}: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [fileName, setFileName] = useState('');

  const previewUrlRef = React.useRef<string | null>(null);
  const isDocumentUpload = kind === 'document' || endpoint.includes('upload-document');
  const acceptedTypes = isDocumentUpload ? DOCUMENT_TYPES : IMAGE_TYPES;
  const inputAccept = accept || acceptedTypes.join(',');
  const maxFileSize = isDocumentUpload ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
  const isPdfPreview = Boolean(fileName.toLowerCase().endsWith('.pdf') || preview?.toLowerCase().endsWith('.pdf'));
  const resolvedPreview = preview ? resolveUploadUrl(preview, service, endpoint) : null;

  React.useEffect(() => {
    if (value) setPreview(resolveUploadUrl(value, service, endpoint));
  }, [endpoint, service, value]);

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const getApiInstance = () => {
    const apiMap: Record<string, any> = {
      product: productApi,
      seller: sellerApi,
      delivery: deliveryApi,
      rider: riderApi,
      order: orderApi,
      market: marketApi,
    };
    return apiMap[service] || productApi;
  };

  const validateFile = (file: File) => {
    if (!acceptedTypes.includes(file.type)) {
      throw new Error(isDocumentUpload ? 'Upload a PDF, JPG, PNG, or WebP file.' : 'Upload a JPG, PNG, WebP, GIF, or AVIF image.');
    }
    if (file.size > maxFileSize) {
      throw new Error(`File must be under ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateFile(file);
    } catch (error: any) {
      toast.error(error.message || 'Unsupported file');
      e.target.value = '';
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setFileName(file.name);
    setPreview(file.type.startsWith('image/') ? objectUrl : null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await getApiInstance().post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Upload failed');
      }

      const url = resolveUploadUrl(res.data.data.url, service, endpoint);
      onUploadSuccess?.(url);
      onChange?.(url);
      setPreview(file.type.startsWith('image/') ? url : null);
      toast.success(isDocumentUpload ? 'Document uploaded' : 'Image uploaded');
    } catch (error: any) {
      console.error('Upload failed', error);
      toast.error(error.response?.data?.message || error.message || 'Upload failed');
      setPreview(value || null);
      setFileName('');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (compact) {
    return (
      <div className="relative inline-block">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-3 py-2 text-xs font-bold text-[#405046] shadow-sm transition hover:border-[#ff6b00] hover:text-[#ff6b00] active:scale-95">
          {isUploading ? <Upload size={14} className="animate-pulse" /> : isDocumentUpload ? <FileText size={14} /> : <Camera size={14} />}
          {label}
          <input
            type="file"
            accept={inputAccept}
            capture={isDocumentUpload ? undefined : capture}
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && <label className="mb-2 block text-sm font-bold text-[#1b1c1c]">{label}</label>}
      <div className="relative flex min-h-[8rem] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white p-4 text-center transition hover:border-[#ff6b00] hover:bg-[#fcf9f8]">
        {resolvedPreview && !isPdfPreview ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-md">
            <img src={resolvedPreview} alt="Upload preview" loading="eager" fetchPriority="high" className="h-full w-full object-cover" />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#e05300]/45">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#ffedd5] text-[#ff6b00]">
              {fileName || value ? <CheckCircle2 size={22} /> : isDocumentUpload ? <FileText size={22} /> : <Camera size={22} />}
            </div>
            <div>
              <p className="text-sm font-black text-[#1b1c1c]">
                {fileName || (value ? 'File uploaded' : isDocumentUpload ? 'Upload document' : 'Upload product photo')}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#414844]">
                {isDocumentUpload ? 'PDF, JPG, PNG, or WebP' : 'JPG, PNG, WebP, GIF, or AVIF'} under {Math.round(maxFileSize / 1024 / 1024)}MB
              </p>
            </div>
          </div>
        )}
        <input
          type="file"
          accept={inputAccept}
          capture={isDocumentUpload ? undefined : capture}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>
    </div>
  );
};
