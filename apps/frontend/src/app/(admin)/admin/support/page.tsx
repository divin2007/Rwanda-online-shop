'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useApi } from '@/hooks/useApi';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminSupportPage() {
  const { data: tickets, execute: fetchTickets, loading } = useApi(adminApi, 'get', '/admin/support');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminApi.patch(`/admin/support/${id}`, { status });
      toast.success('Ticket status updated');
      fetchTickets();
      if (selectedTicket && selectedTicket._id === id) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-50 text-red-700 border-red-200';
      case 'IN_PROGRESS': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'RESOLVED': return 'bg-green-50 text-green-700 border-green-200';
      case 'CLOSED': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <Layout>
      <main className="flex-1 p-4 md:p-12 animate-reveal">
        <div className="border-b border-[#e0e0e0] pb-6 mb-8 md:mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-2xl md:text-4xl font-sans text-[#1b1c1c] capitalize tracking-normal">
              Support Center
            </h1>
            <p className="text-[10px] font-medium text-[#414844] uppercase tracking-widest mt-2">
              Manage user inquiries and feedback
            </p>
          </div>
          <button
            onClick={() => fetchTickets()}
            className="rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-[9px] font-black uppercase tracking-widest text-[#414844] transition hover:bg-[#fcf9f8]"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 border border-[#e0e0e0] bg-white shadow-sm h-[calc(100vh-250px)] overflow-y-auto">
            <div className="p-4 border-b border-[#e0e0e0] bg-[#fcf9f8] sticky top-0">
              <h2 className="text-sm font-sans text-[#1b1c1c]">All Tickets</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-[#414844]">Loading tickets...</div>
            ) : (!tickets || tickets.length === 0) ? (
              <div className="p-8 text-center text-sm text-[#414844]">No support tickets found.</div>
            ) : (
              <div className="divide-y divide-[#e0e0e0]">
                {tickets.map((ticket: any) => (
                  <div
                    key={ticket._id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 cursor-pointer transition-colors ${selectedTicket?._id === ticket._id ? 'bg-[#ffedd5]' : 'hover:bg-[#fcf9f8]'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 border text-[8px] font-black uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className="text-[10px] text-[#414844]">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#1b1c1c] truncate">{ticket.subject}</h3>
                    <p className="text-[11px] text-[#414844] mt-1 truncate">{ticket.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 border border-[#e0e0e0] bg-white shadow-sm h-[calc(100vh-250px)] overflow-y-auto flex flex-col">
            {selectedTicket ? (
              <>
                <div className="p-6 border-b border-[#e0e0e0] bg-[#fcf9f8]">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-sans text-[#1b1c1c]">{selectedTicket.subject}</h2>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => updateStatus(selectedTicket._id, e.target.value)}
                      className="border border-[#e0e0e0] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff6b00]"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#414844]">From</p>
                      <p className="text-[#1b1c1c] font-medium">{selectedTicket.name}</p>
                      <p className="text-[#1b1c1c]">{selectedTicket.email}</p>
                      {selectedTicket.phone && <p className="text-[#1b1c1c]">{selectedTicket.phone}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#414844]">Submitted</p>
                      <p className="text-[#1b1c1c]">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#414844] mt-2">Ticket ID</p>
                      <p className="text-[#1b1c1c] font-mono text-xs">{selectedTicket._id}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#414844] mb-3">Message</p>
                  <div className="bg-[#fcf9f8] p-6 border border-[#e0e0e0] rounded text-sm text-[#1b1c1c] whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.message}
                  </div>
                </div>
                <div className="p-6 border-t border-[#e0e0e0] bg-[#fcf9f8] flex justify-end gap-4">
                  <a href={`mailto:${selectedTicket.email}?subject=Re: ${selectedTicket.subject}`} className="px-6 py-3 border border-[#e0e0e0] bg-white text-[#1b1c1c] text-[10px] font-black uppercase tracking-widest hover:border-[#ff6b00] transition-colors">
                    Reply via Email
                  </a>
                  {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                    <button 
                      onClick={() => updateStatus(selectedTicket._id, 'RESOLVED')}
                      className="px-6 py-3 bg-[#e05300] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#ff6b00] transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#414844] flex-col">
                <div className="text-4xl mb-4">✉️</div>
                <p className="text-sm">Select a ticket to view details</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </Layout>
  );
}
