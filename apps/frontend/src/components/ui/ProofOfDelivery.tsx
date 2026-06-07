'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Camera, CheckCircle2, PackageCheck, QrCode, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { deliveryApi } from '@/lib/api';
import { resolveUploadUrl } from '@/lib/uploadUrls';
import { sanitizeText } from '@/lib/sanitize';

const QrReader = dynamic(
  () => import('react-qr-reader').then(mod => mod.QrReader as React.ComponentType<any>),
  { ssr: false },
);

interface ProofOfDeliveryProps {
  deliveryId: string;
  status?: string;
  onUpdated?: () => void;
}

const PICKED_UP_STATUSES = ['picked_up', 'en_route_to_dropoff', 'pending_handover', 'delivered'];

/**
 * Proof-of-delivery steps embedded inside the active delivery card:
 *   1. Scan stall QR (camera) or enter the QR payload manually.
 *   2. Capture / upload a pickup photo.
 *   3. Confirm pickup (verifies QR + photo via POST /deliveries/:id/scan-qr).
 *   4. Confirm handover to the customer (POST /deliveries/:id/handover).
 */
export const ProofOfDelivery: React.FC<ProofOfDeliveryProps> = ({ deliveryId, status, onUpdated }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [qrData, setQrData] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isHandingOver, setIsHandingOver] = useState(false);

  const pickedUp = PICKED_UP_STATUSES.includes(String(status || '').toLowerCase());
  const delivered = String(status || '').toLowerCase() === 'delivered';
  const awaitingHandover = String(status || '').toLowerCase() === 'pending_handover';

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await deliveryApi.post(`/deliveries/${deliveryId}/pickup-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.data?.url;
      if (url) {
        setPhotoUrl(url);
        toast.success('Pickup photo uploaded');
      } else {
        toast.error('Upload did not return a photo URL');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Photo upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const confirmPickup = async () => {
    if (!qrData || !photoUrl) {
      toast.error('Scan the stall QR and add a pickup photo first');
      return;
    }
    setIsVerifying(true);
    try {
      await deliveryApi.post(`/deliveries/${deliveryId}/scan-qr`, {
        qrData: sanitizeText(qrData, 500),
        photoUrl,
      });
      toast.success('Pickup verified with photo and QR');
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Pickup verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const confirmHandover = async () => {
    setIsHandingOver(true);
    try {
      // JWT role determines the side; body role is a fallback.
      await deliveryApi.post(`/deliveries/${deliveryId}/handover`, { role: 'rider' });
      toast.success('Handover confirmed');
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Handover confirmation failed');
    } finally {
      setIsHandingOver(false);
    }
  };

  if (delivered) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle2 size={18} className="text-green-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-green-800">Delivery completed</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-[#dfe7e2] bg-[#fcf9f8] p-4">
      <div className="flex items-center gap-2">
        <PackageCheck size={16} className="text-[#ff6b00]" />
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1c1c]">Proof of delivery</p>
      </div>

      {!pickedUp ? (
        <div className="space-y-4">
          {/* Step 1: QR scan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#5f7569]">
                <QrCode size={13} className="text-[#ff6b00]" /> Step 1 · Scan stall QR
              </p>
              <button
                type="button"
                onClick={() => setShowScanner(s => !s)}
                className="rounded-md border border-[#dfe7e2] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#1b1c1c] transition hover:border-[#ff6b00]"
              >
                {showScanner ? 'Close camera' : 'Open camera'}
              </button>
            </div>
            {showScanner && (
              <div className="overflow-hidden rounded-md border border-[#dfe7e2] bg-black">
                <QrReader
                  constraints={{ facingMode: 'environment' }}
                  scanDelay={300}
                  onResult={(result: any) => {
                    const text = result?.getText?.() || result?.text || '';
                    if (!text) return;
                    setQrData(text);
                    setShowScanner(false);
                    toast.success('Stall QR captured');
                  }}
                  videoStyle={{ width: '100%' }}
                />
              </div>
            )}
            <input
              value={qrData}
              onChange={e => setQrData(e.target.value)}
              placeholder="QR payload appears here after scanning, or type it"
              className="w-full rounded-md border border-[#dfe7e2] bg-white px-3 py-2 text-xs font-semibold text-[#1b1c1c] outline-none focus:border-[#ff6b00]"
            />
          </div>

          {/* Step 2: pickup photo */}
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#5f7569]">
              <Camera size={13} className="text-[#ff6b00]" /> Step 2 · Pickup photo
            </p>
            {photoUrl ? (
              <div className="relative overflow-hidden rounded-md border border-[#dfe7e2]">
                <img src={resolveUploadUrl(photoUrl, 'delivery')} alt="Pickup proof" className="max-h-44 w-full object-cover" />
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm bg-green-600 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white">
                  <CheckCircle2 size={11} /> Photo added
                </span>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-[#cdd8d2] bg-white p-5 text-center transition hover:border-[#ff6b00]">
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                <Camera size={24} className="text-[#5f7569]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[#1b1c1c]">
                  {isUploading ? 'Uploading…' : 'Tap to take / upload photo'}
                </span>
              </label>
            )}
          </div>

          {/* Step 3: confirm pickup */}
          <button
            type="button"
            onClick={confirmPickup}
            disabled={!qrData || !photoUrl || isVerifying}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#ff6b00] py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#e05300] disabled:opacity-40"
          >
            <ScanLine size={15} />
            {isVerifying ? 'Verifying…' : 'Step 3 · Confirm pickup'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <CheckCircle2 size={15} className="text-green-600" />
            <p className="text-[9px] font-black uppercase tracking-widest text-green-800">Pickup verified</p>
          </div>
          <button
            type="button"
            onClick={confirmHandover}
            disabled={isHandingOver}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#e05300] py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
          >
            <PackageCheck size={15} />
            {isHandingOver ? 'Confirming…' : awaitingHandover ? 'Confirm handover to customer' : 'Confirm delivery handover'}
          </button>
        </div>
      )}
    </div>
  );
};
