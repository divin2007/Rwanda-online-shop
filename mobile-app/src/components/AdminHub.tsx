import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  AlertTriangle,
  BadgeCheck,
  Bike,
  Box,
  ClipboardCheck,
  Headphones,
  MapPinned,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Wallet,
} from 'lucide-react-native';
import { ErrorBlock, LoadingBlock } from './StateView';
import { Field, PrimaryButton } from './FormControls';
import { api } from '../lib/api';
import { compactNumber, formatDateTime, money, shortId } from '../lib/format';
import { asArray } from '../lib/normalize';
import { colors } from '../theme';
import { CatalogCategory, Market, Product, SellerProfile } from '../types';
import { useRemote } from '../hooks/useRemote';

type AdminTab = 'overview' | 'approvals' | 'ops' | 'catalog';

type AdminPayload = {
  summary: Record<string, any> | null;
  analytics: Record<string, any> | null;
  dashboard: Record<string, any> | null;
  accounting: Record<string, any> | null;
  approvals: {
    sellers?: SellerProfile[];
    markets?: Market[];
  } | null;
  pendingSellers: SellerProfile[];
  pendingRiders: Record<string, any>[];
  pendingProducts: Product[];
  markets: Market[];
  fraudAlerts: Record<string, any>[];
  disputes: Record<string, any>[];
  payouts: Record<string, any>[];
  supportTickets: Record<string, any>[];
  categories: CatalogCategory[];
  governance: Record<string, any> | null;
};

const emptyAdminPayload: AdminPayload = {
  summary: null,
  analytics: null,
  dashboard: null,
  accounting: null,
  approvals: null,
  pendingSellers: [],
  pendingRiders: [],
  pendingProducts: [],
  markets: [],
  fraudAlerts: [],
  disputes: [],
  payouts: [],
  supportTickets: [],
  categories: [],
  governance: null,
};

const loadAdminPayload = async (): Promise<AdminPayload> => {
  const [
    summary,
    analytics,
    dashboard,
    accounting,
    approvals,
    pendingSellers,
    pendingRiders,
    pendingProducts,
    markets,
    fraudAlerts,
    disputes,
    payouts,
    supportTickets,
    categories,
    governance,
  ] = await Promise.all([
    api.get<Record<string, any>>('admin', '/analytics/summary').catch(() => null),
    api.get<Record<string, any>>('admin', '/admin/analytics').catch(() => null),
    api.get<Record<string, any>>('admin', '/admin/dashboard/analytics').catch(() => null),
    api.get<Record<string, any>>('admin', '/admin/accounting/summary').catch(() => null),
    api.get<AdminPayload['approvals']>('admin', '/admin/approvals').catch(() => null),
    api.get<SellerProfile[]>('seller', '/sellers?isApproved=false').catch(() => []),
    api.get<Record<string, any>[]>('rider', '/riders?isApproved=false').catch(() => []),
    api.get<Product[]>('product', '/products?isApproved=false&isActive=true').catch(() => []),
    api.get<Market[]>('market', '/markets').catch(() => []),
    api.get<Record<string, any>[]>('admin', '/admin/fraud-alerts').catch(() => []),
    api.get<Record<string, any>[]>('admin', '/admin/disputes?status=active').catch(() => []),
    api.get<Record<string, any>[]>('wallet', '/wallets/payouts/all').catch(() => []),
    api.get<Record<string, any>[]>('admin', '/admin/support').catch(() => []),
    api.get<CatalogCategory[]>('product', '/products/catalog/categories?includeInactive=true').catch(() => []),
    api.get<Record<string, any>>('product', '/products/catalog/governance').catch(() => null),
  ]);

  return {
    summary,
    analytics,
    dashboard,
    accounting,
    approvals,
    pendingSellers: asArray<SellerProfile>(pendingSellers),
    pendingRiders: asArray<Record<string, any>>(pendingRiders),
    pendingProducts: asArray<Product>(pendingProducts),
    markets: asArray<Market>(markets),
    fraudAlerts: asArray<Record<string, any>>(fraudAlerts),
    disputes: asArray<Record<string, any>>(disputes),
    payouts: asArray<Record<string, any>>(payouts),
    supportTickets: asArray<Record<string, any>>(supportTickets),
    categories: asArray<CatalogCategory>(categories),
    governance,
  };
};

export function AdminHub() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { data, loading, refreshing, error, refresh } = useRemote<AdminPayload>(loadAdminPayload, []);
  const payload = data || emptyAdminPayload;

  const counts = useMemo(() => ({
    approvalCount: payload.pendingSellers.length + payload.pendingRiders.length + payload.pendingProducts.length,
    fraudCount: payload.fraudAlerts.length,
    disputeCount: payload.disputes.length,
    payoutCount: payload.payouts.filter(payout => String(payout.status || '').toLowerCase() === 'pending').length || payload.payouts.length,
    supportCount: payload.supportTickets.filter(ticket => String(ticket.status || '').toLowerCase() !== 'resolved').length,
  }), [payload]);

  const runAction = async (key: string, successMessage: string, action: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await action();
      await refresh();
      Alert.alert('Done', successMessage);
    } catch (err) {
      Alert.alert('Action failed', err instanceof Error ? err.message : 'The service rejected this action.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !data) return <LoadingBlock label="Loading admin operations..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <ShieldCheck color={colors.orange} size={28} />
        <Text style={styles.kicker}>Admin operations</Text>
        <Text style={styles.title}>Trust, approvals, catalog health, and money movement.</Text>
        <Text style={styles.heroMeta}>
          {compactNumber(payload.summary?.marketCount)} markets, {compactNumber(payload.summary?.sellerCount || payload.analytics?.activeSellers)} sellers, {compactNumber(payload.summary?.orderCount)} orders
        </Text>
      </View>

      <View style={styles.stats}>
        <Metric icon={<ReceiptText color={colors.orange} size={18} />} value={money(payload.analytics?.monthlyGMV || payload.accounting?.totalGMV)} label="Monthly GMV" />
        <Metric icon={<Wallet color={colors.orange} size={18} />} value={money(payload.accounting?.totalCommission || payload.analytics?.monthlyCommission)} label="Commission" />
      </View>
      <View style={styles.stats}>
        <Metric icon={<Store color={colors.orange} size={18} />} value={counts.approvalCount} label="Approvals" />
        <Metric icon={<AlertTriangle color={colors.orange} size={18} />} value={counts.fraudCount + counts.disputeCount} label="Risks" />
        <Metric icon={<Headphones color={colors.orange} size={18} />} value={counts.supportCount} label="Support" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <Tab label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
        <Tab label={`Approvals ${counts.approvalCount}`} active={tab === 'approvals'} onPress={() => setTab('approvals')} />
        <Tab label="Operations" active={tab === 'ops'} onPress={() => setTab('ops')} />
        <Tab label="Catalog" active={tab === 'catalog'} onPress={() => setTab('catalog')} />
      </ScrollView>

      {tab === 'overview' ? <OverviewTab payload={payload} counts={counts} runAction={runAction} busyKey={busyKey} /> : null}
      {tab === 'approvals' ? <ApprovalsTab payload={payload} runAction={runAction} busyKey={busyKey} /> : null}
      {tab === 'ops' ? <OperationsTab payload={payload} runAction={runAction} busyKey={busyKey} /> : null}
      {tab === 'catalog' ? <CatalogTab payload={payload} runAction={runAction} busyKey={busyKey} /> : null}
    </ScrollView>
  );
}

function OverviewTab({ payload, counts, runAction, busyKey }: {
  payload: AdminPayload;
  counts: Record<string, number>;
  busyKey: string | null;
  runAction: (key: string, successMessage: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <>
      <Panel title="Priority queue" icon={<ClipboardCheck color={colors.orange} size={18} />}>
        <QueueRow label="Seller applications" value={payload.pendingSellers.length} tone={payload.pendingSellers.length ? 'warn' : 'good'} />
        <QueueRow label="Rider applications" value={payload.pendingRiders.length} tone={payload.pendingRiders.length ? 'warn' : 'good'} />
        <QueueRow label="Product approvals" value={payload.pendingProducts.length} tone={payload.pendingProducts.length ? 'warn' : 'good'} />
        <QueueRow label="Open payouts" value={counts.payoutCount} tone={counts.payoutCount ? 'warn' : 'good'} />
      </Panel>

      <Panel title="Live operations" icon={<MapPinned color={colors.orange} size={18} />}>
        <View style={styles.operationMap}>
          <Text style={styles.mapTitle}>Rwanda market layer</Text>
          <Text style={styles.mapMeta}>{payload.markets.length} live market records connected from the market service.</Text>
          <View style={styles.mapGrid}>
            {payload.markets.slice(0, 6).map(market => (
              <View key={market._id} style={styles.mapPin}>
                <Text style={styles.pinName} numberOfLines={1}>{market.name}</Text>
                <Text style={styles.pinMeta} numberOfLines={1}>{market.location?.district || market.location?.address || 'Location pending'}</Text>
              </View>
            ))}
          </View>
        </View>
        <ActionButton
          label="Sync market imagery"
          busy={busyKey === 'sync-markets'}
          onPress={() => runAction('sync-markets', 'Market imagery sync started.', () => api.post('market', '/markets/sync-imagery', {}))}
        />
      </Panel>
    </>
  );
}

function ApprovalsTab({ payload, runAction, busyKey }: {
  payload: AdminPayload;
  busyKey: string | null;
  runAction: (key: string, successMessage: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <>
      <Panel title="Seller applications" icon={<Store color={colors.orange} size={18} />}>
        {payload.pendingSellers.length ? payload.pendingSellers.map(seller => (
          <ReviewCard
            key={seller._id}
            title={seller.shopDetails?.name || seller.stallName || `Seller ${shortId(seller._id)}`}
            meta={seller.shopDetails?.tagline || seller.description || 'Seller profile submitted for review.'}
            extra={seller.marketId && typeof seller.marketId === 'object' ? seller.marketId.name : seller.stallId}
            primaryLabel="Approve"
            secondaryLabel="Decline"
            primaryBusy={busyKey === `seller-${seller._id}-approve`}
            secondaryBusy={busyKey === `seller-${seller._id}-decline`}
            onPrimary={() => runAction(`seller-${seller._id}-approve`, 'Seller approved.', () => api.post('seller', `/sellers/${seller._id}/approve`, {}))}
            onSecondary={() => runAction(`seller-${seller._id}-decline`, 'Seller declined.', () => api.post('seller', `/sellers/${seller._id}/decline`, {}))}
          />
        )) : <EmptyInline text="No seller approvals are waiting." />}
      </Panel>

      <Panel title="Rider applications" icon={<Bike color={colors.orange} size={18} />}>
        {payload.pendingRiders.length ? payload.pendingRiders.map(rider => {
          const id = rider._id || rider.id;
          return (
            <ReviewCard
              key={id}
              title={rider.fullName || rider.email || `Rider ${shortId(id)}`}
              meta={rider.vehicleType || rider.plateNumber || 'Rider application is ready for admin review.'}
              extra={rider.phone || rider.status}
              primaryLabel="Approve"
              secondaryLabel="Reject"
              primaryBusy={busyKey === `rider-${id}-approve`}
              secondaryBusy={busyKey === `rider-${id}-reject`}
              onPrimary={() => runAction(`rider-${id}-approve`, 'Rider approved.', () => api.post('rider', `/riders/${id}/approve`, {}))}
              onSecondary={() => runAction(`rider-${id}-reject`, 'Rider rejected.', () => api.post('rider', `/riders/${id}/reject`, { reason: 'Rejected from mobile admin console' }))}
            />
          );
        }) : <EmptyInline text="No rider approvals are waiting." />}
      </Panel>

      <Panel title="Product approvals" icon={<Box color={colors.orange} size={18} />}>
        {payload.pendingProducts.length ? payload.pendingProducts.map(product => (
          <ReviewCard
            key={product._id}
            title={product.name}
            meta={`${money(product.price)} ${product.unit ? `per ${product.unit}` : ''}`}
            extra={product.categoryLabel || product.category || product.categoryId}
            primaryLabel="Approve"
            secondaryLabel="Remove"
            primaryBusy={busyKey === `product-${product._id}-approve`}
            secondaryBusy={busyKey === `product-${product._id}-remove`}
            onPrimary={() => runAction(`product-${product._id}-approve`, 'Product approved.', () => api.post('product', `/products/${product._id}/approve`, {}))}
            onSecondary={() => runAction(`product-${product._id}-remove`, 'Product removed from active catalog.', () => api.delete('product', `/products/${product._id}`, { reason: 'Rejected from mobile admin console' }))}
          />
        )) : <EmptyInline text="No product approvals are waiting." />}
      </Panel>
    </>
  );
}

function OperationsTab({ payload, runAction, busyKey }: {
  payload: AdminPayload;
  busyKey: string | null;
  runAction: (key: string, successMessage: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <>
      <Panel title="Fraud and disputes" icon={<AlertTriangle color={colors.orange} size={18} />}>
        {payload.fraudAlerts.slice(0, 8).map(alert => (
          <RiskRow
            key={String(alert._id || alert.createdAt)}
            title={alert.type || 'Security alert'}
            meta={alert.reason || alert.message || 'Flagged for admin review.'}
            value={alert.severity || 'Review'}
          />
        ))}
        {payload.disputes.slice(0, 5).map(dispute => (
          <RiskRow
            key={String(dispute._id || dispute.orderNumber)}
            title={`Dispute ${dispute.orderNumber || shortId(dispute._id)}`}
            meta={dispute.dispute?.reason || dispute.status || 'Buyer or seller dispute is active.'}
            value={money(dispute.financials?.totalAmount)}
          />
        ))}
        {!payload.fraudAlerts.length && !payload.disputes.length ? <EmptyInline text="No active risk items returned." /> : null}
      </Panel>

      <Panel title="Payout approvals" icon={<Wallet color={colors.orange} size={18} />}>
        {payload.payouts.length ? payload.payouts.slice(0, 8).map(payout => {
          const id = payout._id || payout.id;
          return (
            <ReviewCard
              key={id}
              title={payout.recipientPhone || payout.momoNumber || `Payout ${shortId(id)}`}
              meta={`${money(payout.amount)} via ${payout.method || 'momo'}`}
              extra={payout.status || formatDateTime(payout.createdAt)}
              primaryLabel="Complete"
              secondaryLabel="Fail"
              primaryBusy={busyKey === `payout-${id}-complete`}
              secondaryBusy={busyKey === `payout-${id}-fail`}
              onPrimary={() => runAction(`payout-${id}-complete`, 'Payout marked complete.', () => api.post('wallet', `/wallets/payout/${id}/complete`, {}))}
              onSecondary={() => runAction(`payout-${id}-fail`, 'Payout marked failed.', () => api.post('wallet', `/wallets/payout/${id}/fail`, { reason: 'Rejected from mobile admin console' }))}
            />
          );
        }) : <EmptyInline text="No payout requests returned." />}
      </Panel>

      <Panel title="Support desk" icon={<Headphones color={colors.orange} size={18} />}>
        {payload.supportTickets.length ? payload.supportTickets.slice(0, 8).map(ticket => {
          const id = ticket._id || ticket.id;
          return (
            <ReviewCard
              key={id}
              title={ticket.subject || ticket.title || `Ticket ${shortId(id)}`}
              meta={ticket.message || ticket.body || 'Support ticket waiting for action.'}
              extra={ticket.status || ticket.email}
              primaryLabel="In progress"
              secondaryLabel="Resolve"
              primaryBusy={busyKey === `support-${id}-progress`}
              secondaryBusy={busyKey === `support-${id}-resolve`}
              onPrimary={() => runAction(`support-${id}-progress`, 'Ticket moved to in progress.', () => api.patch('admin', `/admin/support/${id}`, { status: 'in_progress' }))}
              onSecondary={() => runAction(`support-${id}-resolve`, 'Ticket resolved.', () => api.patch('admin', `/admin/support/${id}`, { status: 'resolved' }))}
            />
          );
        }) : <EmptyInline text="No support tickets returned." />}
      </Panel>
    </>
  );
}

function CatalogTab({ payload, runAction, busyKey }: {
  payload: AdminPayload;
  busyKey: string | null;
  runAction: (key: string, successMessage: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [label, setLabel] = useState('');
  const [productType, setProductType] = useState('');
  const [aliases, setAliases] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [attributesJson, setAttributesJson] = useState('[]');
  const [isActive, setIsActive] = useState(true);
  const missingRequired = asArray<Record<string, any>>(payload.governance?.missingRequiredAttributes);
  const categoryIssues = asArray<Record<string, any>>(payload.governance?.categoryIssues);
  const badData = asArray<Record<string, any>>(payload.governance?.badData);

  const resetForm = () => {
    setEditingId(null);
    setCategoryId('');
    setLabel('');
    setProductType('');
    setAliases('');
    setSynonyms('');
    setAttributesJson('[]');
    setIsActive(true);
  };

  const editCategory = (category: CatalogCategory) => {
    setEditingId(category.id);
    setCategoryId(category.id);
    setLabel(category.label);
    setProductType(category.productType || '');
    setAliases((category.aliases || []).join(', '));
    setSynonyms((category.synonyms || []).join(', '));
    setAttributesJson(JSON.stringify(category.attributes || [], null, 2));
    setIsActive(category.isActive !== false);
  };

  const saveCategory = async () => {
    if (!categoryId.trim() || !label.trim()) {
      Alert.alert('Missing category data', 'Category ID and label are required.');
      return;
    }

    let attributes: CatalogCategory['attributes'] = [];
    try {
      const parsed = JSON.parse(attributesJson || '[]');
      if (!Array.isArray(parsed)) throw new Error('Attributes must be a JSON array.');
      attributes = parsed;
    } catch (err) {
      Alert.alert('Invalid attributes', err instanceof Error ? err.message : 'Attributes must be valid JSON.');
      return;
    }

    const body = {
      id: categoryId.trim(),
      label: label.trim(),
      productType: productType.trim() || categoryId.trim(),
      aliases: splitCsv(aliases),
      synonyms: splitCsv(synonyms),
      attributes,
      isActive,
    };

    await runAction(
      `category-${editingId || 'new'}-save`,
      editingId ? 'Category schema updated.' : 'Category schema created.',
      () => editingId
        ? api.put('product', `/products/catalog/categories/${encodeURIComponent(editingId)}`, body)
        : api.post('product', '/products/catalog/categories', body),
    );
  };

  return (
    <>
      <Panel title="Taxonomy governance" icon={<SlidersHorizontal color={colors.orange} size={18} />}>
        <View style={styles.stats}>
          <Metric icon={<SlidersHorizontal color={colors.orange} size={18} />} value={payload.categories.length} label="Categories" />
          <Metric icon={<AlertTriangle color={colors.orange} size={18} />} value={missingRequired.length + categoryIssues.length + badData.length} label="Data issues" />
        </View>
        <ActionButton
          label="Dry-run catalog backfill"
          busy={busyKey === 'catalog-backfill'}
          onPress={() => runAction('catalog-backfill', 'Catalog backfill dry-run completed.', () => api.post('product', '/products/catalog/migrate-backfill', { dryRun: true, limit: 250 }))}
        />
        <ActionButton
          label="Dry-run seller link repair"
          busy={busyKey === 'seller-link-heal'}
          onPress={() => runAction('seller-link-heal', 'Seller link repair dry-run completed.', () => api.post('product', '/products/admin/self-heal-seller-links', { dryRun: true, limit: 250 }))}
        />
      </Panel>

      <Panel title={editingId ? 'Edit category schema' : 'Create category schema'} icon={<SlidersHorizontal color={colors.orange} size={18} />}>
        <Field label="Category ID" value={categoryId} onChangeText={setCategoryId} autoCapitalize="none" editable={!editingId} placeholder="produce" />
        <Field label="Buyer-facing label" value={label} onChangeText={setLabel} placeholder="Produce" />
        <Field label="Product type" value={productType} onChangeText={setProductType} placeholder="produce" />
        <Field label="Aliases" value={aliases} onChangeText={setAliases} placeholder="Comma-separated aliases" />
        <Field label="Search synonyms" value={synonyms} onChangeText={setSynonyms} placeholder="Comma-separated synonyms" />
        <View style={styles.jsonGroup}>
          <Text style={styles.jsonLabel}>Attributes JSON</Text>
          <TextInput
            value={attributesJson}
            onChangeText={setAttributesJson}
            multiline
            autoCapitalize="none"
            placeholder='[{"key":"size","label":"Size","type":"select","required":true,"options":["S","M","L"]}]'
            placeholderTextColor={colors.faint}
            style={styles.jsonInput}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.rowTitle}>Visible in catalog</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.orangeSoft }} thumbColor={isActive ? colors.orange : colors.faint} />
        </View>
        <View style={styles.formActions}>
          <PrimaryButton label={editingId ? 'Save schema' : 'Create schema'} loading={busyKey === `category-${editingId || 'new'}-save`} onPress={saveCategory} />
          <TouchableOpacity style={styles.secondaryAction} onPress={resetForm} activeOpacity={0.85}>
            <Text style={styles.secondaryActionText}>Reset form</Text>
          </TouchableOpacity>
        </View>
      </Panel>

      <Panel title="Category schemas" icon={<Box color={colors.orange} size={18} />}>
        {payload.categories.length ? payload.categories.map(category => (
          <View key={category.id} style={styles.categoryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{category.label}</Text>
              <Text style={styles.rowMeta}>
                {(category.attributes || []).length} attributes, {category.isActive === false ? 'inactive' : 'active'}
              </Text>
            </View>
            <Text style={styles.tag}>{category.productType || category.id}</Text>
            <View style={styles.categoryActions}>
              <SmallButton label="Edit" onPress={() => editCategory(category)} />
              <SmallButton
                label="Disable"
                variant="outline"
                busy={busyKey === `category-${category.id}-disable`}
                onPress={() => runAction(
                  `category-${category.id}-disable`,
                  'Category schema disabled.',
                  () => api.delete('product', `/products/catalog/categories/${encodeURIComponent(category.id)}`, {}),
                )}
              />
            </View>
          </View>
        )) : <EmptyInline text="No catalog categories returned." />}
      </Panel>

      <Panel title="Governance issues" icon={<AlertTriangle color={colors.orange} size={18} />}>
        {[...missingRequired, ...categoryIssues, ...badData].slice(0, 10).map((issue, index) => (
          <RiskRow
            key={`${issue.productId || issue.categoryId || index}`}
            title={issue.productName || issue.categoryLabel || issue.type || 'Catalog issue'}
            meta={issue.reason || issue.message || issue.field || 'Issue returned by governance report.'}
            value={issue.categoryId || issue.severity || 'Audit'}
          />
        ))}
        {!missingRequired.length && !categoryIssues.length && !badData.length ? <EmptyInline text="Catalog governance is clean." /> : null}
      </Panel>
    </>
  );
}

function splitCsv(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        {icon}
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function QueueRow({ label, value, tone }: { label: string; value: number; tone: 'warn' | 'good' }) {
  return (
    <View style={styles.queueRow}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={[styles.queueValue, tone === 'good' && styles.queueValueGood]}>{value}</Text>
    </View>
  );
}

function ReviewCard({
  title,
  meta,
  extra,
  primaryLabel,
  secondaryLabel,
  primaryBusy,
  secondaryBusy,
  onPrimary,
  onSecondary,
}: {
  title: string;
  meta?: string;
  extra?: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryBusy?: boolean;
  secondaryBusy?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <View style={styles.reviewCard}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={styles.rowMeta} numberOfLines={3}>{meta}</Text> : null}
        {extra ? <Text style={styles.tag}>{extra}</Text> : null}
      </View>
      <View style={styles.actionColumn}>
        <SmallButton label={primaryLabel} busy={primaryBusy} onPress={onPrimary} />
        <SmallButton label={secondaryLabel} variant="outline" busy={secondaryBusy} onPress={onSecondary} />
      </View>
    </View>
  );
}

function RiskRow({ title, meta, value }: { title: string; meta?: string; value?: string }) {
  return (
    <View style={styles.riskRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {value ? <Text style={styles.riskValue}>{value}</Text> : null}
    </View>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <Text style={styles.emptyInline}>{text}</Text>;
}

function ActionButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} disabled={busy} onPress={onPress} activeOpacity={0.85}>
      <RefreshCw color={colors.greenDark} size={14} />
      <Text style={styles.actionText}>{busy ? 'Working...' : label}</Text>
    </TouchableOpacity>
  );
}

function SmallButton({ label, variant, busy, onPress }: { label: string; variant?: 'outline'; busy?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.smallButton, variant === 'outline' && styles.smallButtonOutline]} disabled={busy} onPress={onPress} activeOpacity={0.85}>
      {variant ? null : <BadgeCheck color={colors.greenDark} size={13} />}
      <Text style={[styles.smallButtonText, variant === 'outline' && styles.smallButtonTextOutline]}>{busy ? '...' : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  hero: { backgroundColor: colors.orangeDark, borderRadius: 16, padding: 18, gap: 8 },
  kicker: { color: colors.orangeSoft, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.card, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  heroMeta: { color: '#ffedd5', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 5 },
  statValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tabs: { gap: 8, paddingRight: 8 },
  tab: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 14, justifyContent: 'center' },
  tabActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  tabTextActive: { color: colors.orangeDark },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  queueRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  rowMeta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  queueValue: { minWidth: 34, textAlign: 'center', color: colors.warning, fontSize: 15, fontWeight: '900' },
  queueValueGood: { color: colors.success },
  operationMap: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.orangeSoft, padding: 12, gap: 10 },
  mapTitle: { color: colors.greenDark, fontSize: 15, fontWeight: '900' },
  mapMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  mapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mapPin: { width: '48%', minHeight: 58, borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: colors.card, padding: 9 },
  pinName: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  pinMeta: { color: colors.muted, fontSize: 10, marginTop: 4, fontWeight: '700' },
  actionButton: { minHeight: 44, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  actionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  reviewCard: { flexDirection: 'row', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fffaf5', padding: 12 },
  actionColumn: { width: 100, gap: 8 },
  smallButton: { minHeight: 36, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 8 },
  smallButtonOutline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  smallButtonText: { color: colors.greenDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  smallButtonTextOutline: { color: colors.danger },
  tag: { alignSelf: 'flex-start', color: colors.orangeDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  riskRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  riskValue: { color: colors.orangeDark, fontSize: 11, fontWeight: '900', maxWidth: 100, textAlign: 'right' },
  jsonGroup: { gap: 7 },
  jsonLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  jsonInput: {
    minHeight: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    textAlignVertical: 'top',
  },
  switchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  formActions: { gap: 9 },
  secondaryAction: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: colors.orangeDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  categoryActions: { width: 96, gap: 8 },
  emptyInline: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
