'use client';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCart } from '@/components/cart/CartContext';

type ModifierOption = { label: string; extraPrice: number };
type Modifier = { name: string; options: ModifierOption[]; required?: boolean; multiSelect?: boolean };
type MenuItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  images?: string[];
  dietaryTags?: string[];
  preparationMinutes?: number;
  isAvailable?: boolean;
  modifiers?: Modifier[];
};
type MenuSection = { _id: string; name: string; description?: string; items?: MenuItem[]; isVisible?: boolean };
type Menu = {
  _id: string;
  sections?: MenuSection[];
  availabilityHours?: { day: string; open: string; close: string }[];
  isActive?: boolean;
  currency?: string;
};

type SellerLike = {
  _id: string;
  userId?: string;
  stallId?: string;
  marketId?: string | { _id?: string };
  businessType?: string;
  shopDetails?: { name?: string };
  stallName?: string;
};

const BUSINESS_LABELS: Record<string, string> = {
  RESTAURANT: 'Restaurant',
  HOTEL: 'Hotel',
  CAFE: 'Café',
  BAKERY: 'Bakery',
  CATERING: 'Catering',
  JUICE_BAR: 'Juice Bar',
  FOOD_KIOSK: 'Food Kiosk',
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function useOpenStatus(hours?: { day: string; open: string; close: string }[]) {
  return useMemo(() => {
    if (!hours || hours.length === 0) return { known: false, open: true } as const;
    const now = new Date();
    const today = DAY_NAMES[now.getDay()];
    const todayHours = hours.find((h) => h.day?.toLowerCase() === today);
    if (!todayHours || !todayHours.open || !todayHours.close) return { known: true, open: false } as const;
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = todayHours.open.split(':').map(Number);
    const [ch, cm] = todayHours.close.split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    return { known: true, open: cur >= openMin && cur <= closeMin } as const;
  }, [hours]);
}

export function MenuStorefront({ seller, menu }: { seller: SellerLike; menu: Menu }) {
  const { addToCart } = useCart();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const status = useOpenStatus(menu.availabilityHours);

  useEffect(() => {
    // Open the first section by default.
    const first = menu.sections?.[0]?._id;
    if (first) setOpenSections((s) => ({ ...s, [first]: true }));
  }, [menu.sections]);

  const businessLabel = BUSINESS_LABELS[seller.businessType || ''] || 'Dining';
  const sellerName = seller.shopDetails?.name || seller.stallName || 'Kitchen';
  const marketId = typeof seller.marketId === 'object' ? seller.marketId?._id : seller.marketId;

  const buildCartPayload = (item: MenuItem, selectedModifiers: { name: string; label: string; extraPrice: number }[]) => {
    const modifierTotal = selectedModifiers.reduce((sum, m) => sum + (m.extraPrice || 0), 0);
    return {
      _id: item._id,
      menuItemId: item._id,
      isMenuItem: true,
      name: item.name,
      price: item.price + modifierTotal,
      images: item.images,
      image: item.images?.[0],
      sellerId: seller._id,
      sellerUserId: seller.userId,
      sellerName,
      stallId: seller.stallId,
      marketId,
      preparationMinutes: item.preparationMinutes,
      selectedModifiers,
    };
  };

  const handleAdd = (item: MenuItem) => {
    if (item.isAvailable === false) return;
    if (item.modifiers && item.modifiers.length > 0) {
      setModalItem(item);
      return;
    }
    addToCart(buildCartPayload(item, []) as any);
    toast.success(`${item.name} added to order`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-container text-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
            <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
            {businessLabel}
          </span>
          {status.known && (
            <span className={`text-[11px] font-bold uppercase ${status.open ? 'text-green-600' : 'text-error'}`}>
              {status.open ? 'Open now' : 'Closed'}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {(menu.sections || []).map((section) => {
          const isOpen = openSections[section._id];
          const items = section.items || [];
          if (items.length === 0) return null;
          return (
            <div key={section._id} className="border border-outline-variant rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSections((s) => ({ ...s, [section._id]: !s[section._id] }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low"
              >
                <span className="font-label-caps text-label-caps text-on-surface">{section.name}</span>
                <span className="material-symbols-outlined text-on-surface-variant">{isOpen ? 'expand_less' : 'expand_more'}</span>
              </button>
              {isOpen && (
                <div className="flex flex-col divide-y divide-outline-variant/40">
                  {items.map((item) => {
                    const unavailable = item.isAvailable === false;
                    return (
                      <div key={item._id} className={`flex items-center gap-3 px-4 py-3 ${unavailable ? 'opacity-50' : ''}`}>
                        {item.images?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.images[0]} alt={item.name} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-body-md font-semibold text-on-surface">{item.name}</p>
                          {item.description && <p className="text-body-sm text-on-surface-variant line-clamp-2">{item.description}</p>}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="font-data-mono text-data-mono text-primary-container">{item.price.toLocaleString()} RWF</span>
                            <span className="text-[11px] text-on-surface-variant">· {item.preparationMinutes ?? 15} min</span>
                            {(item.dietaryTags || []).map((tag) => (
                              <span key={tag} className="text-[10px] uppercase font-bold text-on-surface-variant border border-outline-variant rounded-full px-1.5">{tag}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={unavailable}
                          onClick={() => handleAdd(item)}
                          className="flex-shrink-0 rounded-lg bg-primary-container text-white px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {unavailable ? 'Unavailable' : 'Add to Order'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalItem && (
        <ModifierModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onConfirm={(selected) => {
            addToCart(buildCartPayload(modalItem, selected) as any);
            toast.success(`${modalItem.name} added to order`);
            setModalItem(null);
          }}
        />
      )}
    </div>
  );
}

function ModifierModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (selected: { name: string; label: string; extraPrice: number }[]) => void;
}) {
  // selection state: modifierName -> Set of labels
  const [selection, setSelection] = useState<Record<string, string[]>>({});

  const toggle = (mod: Modifier, opt: ModifierOption) => {
    setSelection((sel) => {
      const current = sel[mod.name] || [];
      if (mod.multiSelect) {
        return {
          ...sel,
          [mod.name]: current.includes(opt.label) ? current.filter((l) => l !== opt.label) : [...current, opt.label],
        };
      }
      return { ...sel, [mod.name]: current.includes(opt.label) ? [] : [opt.label] };
    });
  };

  const selectedList = useMemo(() => {
    const list: { name: string; label: string; extraPrice: number }[] = [];
    for (const mod of item.modifiers || []) {
      for (const label of selection[mod.name] || []) {
        const opt = mod.options.find((o) => o.label === label);
        if (opt) list.push({ name: mod.name, label: opt.label, extraPrice: opt.extraPrice || 0 });
      }
    }
    return list;
  }, [selection, item.modifiers]);

  const total = item.price + selectedList.reduce((s, m) => s + m.extraPrice, 0);

  const missingRequired = (item.modifiers || []).some((m) => m.required && (selection[m.name] || []).length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface-container-lowest w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-label-caps text-label-caps text-on-surface">{item.name}</h3>
          <button type="button" onClick={onClose} className="p-1"><span className="material-symbols-outlined">close</span></button>
        </div>

        {(item.modifiers || []).map((mod) => (
          <div key={mod.name} className="flex flex-col gap-2">
            <p className="font-label-caps text-[10px] text-on-surface-variant">
              {mod.name}{mod.required ? ' *' : ''}{mod.multiSelect ? ' (choose multiple)' : ''}
            </p>
            <div className="flex flex-col gap-1">
              {mod.options.map((opt) => {
                const active = (selection[mod.name] || []).includes(opt.label);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => toggle(mod, opt)}
                    className={`flex items-center justify-between rounded border px-3 py-2 text-body-sm ${active ? 'border-primary bg-primary-fixed/40 text-on-surface' : 'border-outline-variant text-on-surface-variant'}`}
                  >
                    <span>{opt.label}</span>
                    <span className="font-data-mono">{opt.extraPrice > 0 ? `+${opt.extraPrice.toLocaleString()} RWF` : 'Free'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={missingRequired}
          onClick={() => onConfirm(selectedList)}
          className="rounded-lg bg-primary-container text-white px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-primary transition disabled:opacity-50"
        >
          Add to Order · {total.toLocaleString()} RWF
        </button>
      </div>
    </div>
  );
}
