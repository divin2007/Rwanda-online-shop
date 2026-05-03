'use client';
import React, { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { productApi, sellerApi, deliveryApi, riderApi } from '@/lib/api'; // Depends on context

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void;
  service: 'product' | 'seller' | 'rider' | 'delivery';
  endpoint: string;
  capture?: 'environment' | 'user';
  label?: string;
}

export const ImageUpload = ({ onUploadSuccess, service, endpoint, capture, label = "Upload Image" }: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  
  const getApiInstance = () => {
    if (service === 'product') return productApi;
    if (service === 'seller') return sellerApi;
    if (service === 'delivery') return deliveryApi;
    if (service === 'rider') return riderApi;
    return productApi; // fallback
  };
  
  const api = getApiInstance();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        onUploadSuccess(res.data.data.url);
      }
    } catch (error) {
      console.error('Upload failed', error);
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-text-primary mb-2">{label}</label>
      <div className="relative border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-background-surface transition-colors cursor-pointer min-h-[120px]">
        {preview ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden">
             <img src={preview} alt="Preview" className="w-full h-full object-cover opacity-80" />
             {isUploading && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                 <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
               </div>
             )}
          </div>
        ) : (
          <>
            <span className="text-3xl mb-2">📸</span>
            <span className="text-sm text-text-secondary font-medium">Click to upload or take photo</span>
          </>
        )}
        <input 
          type="file" 
          accept="image/*" 
          capture={capture} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>
    </div>
  );
};
