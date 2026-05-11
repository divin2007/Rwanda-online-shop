'use client';
import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { useLanguage } from '@/context/LanguageContext';

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-heading font-bold mb-8">{t('privacy_title')}</h1>
        <Card className="prose prose-slate max-w-none">
          <p>{t('privacy_last_updated')}</p>
          <p>{t('privacy_intro')}</p>
          <h2>{t('privacy_1_title')}</h2>
          <p>{t('privacy_1_desc')}</p>
          <h2>{t('privacy_2_title')}</h2>
          <p>{t('privacy_2_desc')}</p>
          <h2>{t('privacy_3_title')}</h2>
          <p>{t('privacy_3_desc')}</p>
        </Card>
      </div>
    </Layout>
  );
}
