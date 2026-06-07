'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { sellerApi } from '@/lib/api';

interface ExportProduct {
  _id: string;
  name: string;
  unit?: string;
  exportMinQty?: number;
  sellerId?: string;
  seller?: { _id?: string };
}

interface ExportInquiryModalProps {
  product: ExportProduct;
  onClose: () => void;
}

const DOC_OPTIONS = [
  { value: 'CERTIFICATE_OF_ORIGIN', label: 'Certificate of Origin' },
  { value: 'PACKING_LIST', label: 'Packing List' },
  { value: 'PHYTOSANITARY', label: 'Phytosanitary Certificate' },
  { value: 'INVOICE', label: 'Commercial Invoice' },
] as const;

export const ExportInquiryModal = ({ product, onClose }: ExportInquiryModalProps) => {
  const [quantity, setQuantity] = useState(String(product.exportMinQty || ''));
  const [deliveryCountry, setDeliveryCountry] = useState('');
  const [docs, setDocs] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sellerId = product.seller?._id || product.sellerId;

  const toggleDoc = (value: string) => {
    setDocs((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  };

  const handleSubmit = async () => {
    if (!sellerId) return toast.error('Seller information missing for this product');
    if (!deliveryCountry.trim()) return toast.error('Please enter a delivery country');
    setSubmitting(true);
    try {
      await sellerApi.post('/export/inquiries', {
        sellerId,
        products: [{ productId: product._id, quantity: Number(quantity) || undefined, unit: product.unit }],
        documentsRequested: docs,
        deliveryCountry: deliveryCountry.trim(),
        notes: notes.trim() || undefined,
      });
      toast.success('Export inquiry submitted. The seller and our export desk will follow up.');
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to submit inquiry. Please log in and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Export Inquiry — {product.name}</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Quantity ({product.unit || 'units'})</label>
            <input
              type="number"
              min={product.exportMinQty || 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder={product.exportMinQty ? `Min ${product.exportMinQty}` : 'Quantity'}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Delivery Country</label>
            <input
              type="text"
              value={deliveryCountry}
              onChange={(e) => setDeliveryCountry(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Kenya, UAE, Belgium"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Documents Requested</label>
            <div className="grid grid-cols-2 gap-2">
              {DOC_OPTIONS.map((doc) => (
                <label key={doc.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={docs.includes(doc.value)} onChange={() => toggleDoc(doc.value)} />
                  {doc.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Packaging, timeline, certifications, etc."
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded bg-[#e05300] py-2.5 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Inquiry'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportInquiryModal;
