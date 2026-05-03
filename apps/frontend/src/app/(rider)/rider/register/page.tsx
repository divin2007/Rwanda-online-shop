'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { riderApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function RiderRegistrationPage() {
  const router = useRouter();
  const [plateNumber, setPlateNumber] = useState('');
  const [documents, setDocuments] = useState({ license: '', vehicle: '', id: '', insurance: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documents.license || !documents.vehicle || !documents.id || !documents.insurance) {
      return toast.error('All documents must be uploaded');
    }

    setIsSubmitting(true);
    try {
      await riderApi.post('/riders/register', { plateNumber, documents });
      toast.success('Registration submitted for approval!');
      router.push('/rider/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-10 px-4">
        <Card className="animate-fade-in">
          <h1 className="text-2xl font-heading font-bold mb-2">Rider Registration</h1>
          <p className="text-text-secondary mb-8">Submit your vehicle and identity documents to get verified.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1">Plate Number</label>
              <input type="text" required className="w-full p-3 border border-border rounded-lg" placeholder="RAB 123 C" value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())} />
            </div>

            <div>
              <h3 className="font-bold mb-4">Required Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImageUpload label="Driving License" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, license: url})} />
                <ImageUpload label="National ID" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, id: url})} />
                <ImageUpload label="Vehicle Photo" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, vehicle: url})} />
                <ImageUpload label="Insurance Certificate" service="rider" endpoint="/riders/upload-document" onUploadSuccess={url => setDocuments({...documents, insurance: url})} />
              </div>
            </div>

            <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Registration'}
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
