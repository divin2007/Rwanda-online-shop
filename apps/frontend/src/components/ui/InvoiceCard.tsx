'use client';

import React from 'react';
import { Download, FileText } from 'lucide-react';

interface InvoiceCardProps {
  invoice: {
    _id: string;
    invoiceNumber: string;
    periodStart?: string;
    periodEnd?: string;
    totalAmount?: number;
    status?: string;
    pdfUrl?: string | null;
  };
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const InvoiceCard = ({ invoice }: InvoiceCardProps) => {
  const period = invoice.periodStart
    ? `${new Date(invoice.periodStart).toLocaleDateString()} – ${invoice.periodEnd ? new Date(invoice.periodEnd).toLocaleDateString() : ''}`
    : '';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <FileText className="text-[#e05300]" size={20} />
        <div>
          <p className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</p>
          <p className="text-xs text-gray-500">{period}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-gray-900">{(invoice.totalAmount || 0).toLocaleString()} RWF</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[invoice.status || 'pending'] || STATUS_STYLES.pending}`}>
          {invoice.status || 'pending'}
        </span>
        {invoice.pdfUrl && (
          <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-bold hover:bg-gray-50">
            <Download size={12} /> PDF
          </a>
        )}
      </div>
    </div>
  );
};

export default InvoiceCard;
