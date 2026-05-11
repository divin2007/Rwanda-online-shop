'use client';
import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { useLanguage } from '@/context/LanguageContext';

export default function TermsPage() {
  const { t } = useLanguage();
  
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-heading font-bold mb-8">{t('terms_title')}</h1>
        <Card className="prose prose-slate max-w-none">
          <p>{t('terms_last_updated')}</p>
          <h2>{t('terms_1_title')}</h2>
          <p>{t('terms_1_desc')}</p>
          <h2>{t('terms_2_title')}</h2>
          <p>{t('terms_2_desc')}</p>
          <h2>{t('terms_3_title')}</h2>
          <p>{t('terms_3_desc')}</p>
          <h2>{t('terms_4_title')}</h2>
          <p>{t('terms_4_desc')}</p>
        </Card>
      </div>
    </Layout>
  );
}
