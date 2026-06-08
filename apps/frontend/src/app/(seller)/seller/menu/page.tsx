'use client';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { sellerApi } from '@/lib/api';

const BUSINESS_TYPES = [
  { value: 'STANDARD', label: 'Standard Shop' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'CAFE', label: 'Café' },
  { value: 'BAKERY', label: 'Bakery' },
  { value: 'CATERING', label: 'Catering' },
  { value: 'JUICE_BAR', label: 'Juice Bar' },
  { value: 'FOOD_KIOSK', label: 'Food Kiosk' },
];

const DIETARY_TAGS = ['vegan', 'vegetarian', 'halal', 'gluten-free', 'spicy'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type Modifier = { name: string; options: { label: string; extraPrice: number }[]; required?: boolean; multiSelect?: boolean };
type MenuItem = {
  _id?: string;
  name: string;
  description?: string;
  price: number;
  images?: string[];
  dietaryTags?: string[];
  preparationMinutes?: number;
  isAvailable?: boolean;
  modifiers?: Modifier[];
  sortOrder?: number;
};
type MenuSection = {
  _id?: string;
  name: string;
  description?: string;
  items?: MenuItem[];
  sortOrder?: number;
  isVisible?: boolean;
};
type Menu = {
  _id?: string;
  sections?: MenuSection[];
  availabilityHours?: { day: string; open: string; close: string }[];
  isActive?: boolean;
  currency?: string;
};

const emptyItem: MenuItem = {
  name: '',
  description: '',
  price: 0,
  images: [],
  dietaryTags: [],
  preparationMinutes: 15,
  isAvailable: true,
  modifiers: [],
};

export default function SellerMenuPage() {
  const { user } = useAuth();
  const [businessType, setBusinessType] = useState('STANDARD');
  const [menu, setMenu] = useState<Menu>({ sections: [], availabilityHours: [], isActive: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Section editor state
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');

  // Item editor modal state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<MenuItem>(emptyItem);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, menuRes] = await Promise.all([
        sellerApi.get('/sellers/me').catch(() => null),
        sellerApi.get('/sellers/menu/me').catch(() => null),
      ]);
      const profile = profileRes?.data?.data;
      if (profile?.businessType) setBusinessType(profile.businessType);
      const loadedMenu = menuRes?.data?.data;
      if (loadedMenu) setMenu(loadedMenu);
    } catch (e) {
      toast.error('Could not load your menu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshMenu = async () => {
    const res = await sellerApi.get('/sellers/menu/me').catch(() => null);
    if (res?.data?.data) setMenu(res.data.data);
  };

  const handleBusinessTypeChange = async (value: string) => {
    setBusinessType(value);
    try {
      await sellerApi.patch('/sellers/me/business-type', { businessType: value });
      toast.success('Business type updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update business type');
    }
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) {
      toast.error('Section name is required');
      return;
    }
    setSaving(true);
    try {
      await sellerApi.post('/sellers/menu/sections', { name: newSectionName.trim(), description: newSectionDesc.trim() });
      setNewSectionName('');
      setNewSectionDesc('');
      await refreshMenu();
      toast.success('Section added');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to add section');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId?: string) => {
    if (!sectionId) return;
    if (!confirm('Delete this section and all its items?')) return;
    try {
      await sellerApi.delete(`/sellers/menu/sections/${sectionId}`);
      await refreshMenu();
      toast.success('Section deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete section');
    }
  };

  const handleToggleSectionVisibility = async (section: MenuSection) => {
    if (!section._id) return;
    try {
      await sellerApi.put(`/sellers/menu/sections/${section._id}`, { isVisible: !section.isVisible });
      await refreshMenu();
    } catch (e: any) {
      toast.error('Failed to toggle visibility');
    }
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const sections = [...(menu.sections || [])];
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    // Persist new sortOrder for both swapped sections.
    try {
      await Promise.all(
        sections.map((s, i) => s._id ? sellerApi.put(`/sellers/menu/sections/${s._id}`, { sortOrder: i }) : null)
      );
      await refreshMenu();
    } catch {
      toast.error('Failed to reorder');
    }
  };

  const openItemEditor = (sectionId?: string, item?: MenuItem) => {
    if (!sectionId) return;
    setEditingSectionId(sectionId);
    if (item) {
      setEditingItemId(item._id || null);
      setItemForm({ ...emptyItem, ...item });
    } else {
      setEditingItemId(null);
      setItemForm(emptyItem);
    }
  };

  const closeItemEditor = () => {
    setEditingSectionId(null);
    setEditingItemId(null);
    setItemForm(emptyItem);
  };

  const handleSaveItem = async () => {
    if (!editingSectionId) return;
    if (!itemForm.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (itemForm.price === undefined || Number(itemForm.price) < 0) {
      toast.error('Price must be a non-negative number');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: itemForm.name.trim(),
        description: itemForm.description,
        price: Number(itemForm.price),
        images: itemForm.images,
        dietaryTags: itemForm.dietaryTags,
        preparationMinutes: Number(itemForm.preparationMinutes) || 15,
        isAvailable: itemForm.isAvailable,
        modifiers: itemForm.modifiers,
      };
      if (editingItemId) {
        await sellerApi.put(`/sellers/menu/sections/${editingSectionId}/items/${editingItemId}`, payload);
      } else {
        await sellerApi.post(`/sellers/menu/sections/${editingSectionId}/items`, payload);
      }
      await refreshMenu();
      closeItemEditor();
      toast.success('Item saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (sectionId?: string, itemId?: string) => {
    if (!sectionId || !itemId) return;
    if (!confirm('Delete this menu item?')) return;
    try {
      await sellerApi.delete(`/sellers/menu/sections/${sectionId}/items/${itemId}`);
      await refreshMenu();
      toast.success('Item deleted');
    } catch (e: any) {
      toast.error('Failed to delete item');
    }
  };

  const handleToggleAvailability = async (sectionId?: string, itemId?: string) => {
    if (!sectionId || !itemId) return;
    try {
      await sellerApi.patch(`/sellers/menu/sections/${sectionId}/items/${itemId}/availability`);
      await refreshMenu();
    } catch {
      toast.error('Failed to toggle availability');
    }
  };

  const handleSaveHours = async (hours: { day: string; open: string; close: string }[]) => {
    try {
      await sellerApi.patch('/sellers/menu', { availabilityHours: hours });
      setMenu((m) => ({ ...m, availabilityHours: hours }));
      toast.success('Hours saved');
    } catch {
      toast.error('Failed to save hours');
    }
  };

  // ── Modifier helpers for the item form ──
  const addModifier = () => {
    setItemForm((f) => ({ ...f, modifiers: [...(f.modifiers || []), { name: '', options: [{ label: '', extraPrice: 0 }], required: false, multiSelect: false }] }));
  };
  const updateModifier = (mi: number, patch: Partial<Modifier>) => {
    setItemForm((f) => ({ ...f, modifiers: (f.modifiers || []).map((m, i) => i === mi ? { ...m, ...patch } : m) }));
  };
  const removeModifier = (mi: number) => {
    setItemForm((f) => ({ ...f, modifiers: (f.modifiers || []).filter((_, i) => i !== mi) }));
  };
  const addOption = (mi: number) => {
    setItemForm((f) => ({
      ...f,
      modifiers: (f.modifiers || []).map((m, i) => i === mi ? { ...m, options: [...m.options, { label: '', extraPrice: 0 }] } : m),
    }));
  };
  const updateOption = (mi: number, oi: number, patch: Partial<{ label: string; extraPrice: number }>) => {
    setItemForm((f) => ({
      ...f,
      modifiers: (f.modifiers || []).map((m, i) => i === mi ? {
        ...m, options: m.options.map((o, j) => j === oi ? { ...o, ...patch } : o),
      } : m),
    }));
  };

  const isFoodBusiness = businessType !== 'STANDARD';

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Menu Management</h1>
          <p className="text-body-md text-on-surface-variant">
            Register your business type and build a structured menu buyers can order from.
          </p>
        </header>

        {/* Business type */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
          <label className="font-label-caps text-label-caps text-on-surface">Business Type</label>
          <select
            value={businessType}
            onChange={(e) => handleBusinessTypeChange(e.target.value)}
            className="rmf-input max-w-xs"
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {!isFoodBusiness && (
            <p className="text-body-sm text-on-surface-variant">
              Select a food/dining business type (Restaurant, Café, etc.) to enable your buyer-facing menu.
            </p>
          )}
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Add section */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
              <h2 className="font-label-caps text-label-caps text-on-surface">Add Menu Section</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="rmf-input flex-1"
                  placeholder="Section name (e.g. Starters)"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                />
                <input
                  className="rmf-input flex-1"
                  placeholder="Description (optional)"
                  value={newSectionDesc}
                  onChange={(e) => setNewSectionDesc(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddSection}
                  disabled={saving}
                  className="rounded-lg bg-primary-container text-white px-4 py-2 text-sm font-bold uppercase tracking-wide hover:bg-primary transition disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </section>

            {/* Sections list */}
            <div className="flex flex-col gap-4">
              {(menu.sections || []).length === 0 && (
                <p className="text-body-md text-on-surface-variant text-center py-8">
                  No sections yet. Add your first menu section above.
                </p>
              )}
              {(menu.sections || []).map((section, sIndex) => (
                <section key={section._id || sIndex} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">restaurant_menu</span>
                      <h3 className="font-label-caps text-label-caps text-on-surface">{section.name}</h3>
                      {section.isVisible === false && (
                        <span className="text-[10px] font-bold uppercase text-error">Hidden</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveSection(sIndex, -1)} title="Move up" className="p-1 hover:text-primary">
                        <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                      </button>
                      <button type="button" onClick={() => moveSection(sIndex, 1)} title="Move down" className="p-1 hover:text-primary">
                        <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => handleToggleSectionVisibility(section)} title="Toggle visibility" className="p-1 hover:text-primary">
                        <span className="material-symbols-outlined text-[18px]">{section.isVisible === false ? 'visibility_off' : 'visibility'}</span>
                      </button>
                      <button type="button" onClick={() => handleDeleteSection(section._id)} title="Delete section" className="p-1 hover:text-error">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                  {section.description && <p className="text-body-sm text-on-surface-variant">{section.description}</p>}

                  {/* Items */}
                  <div className="flex flex-col gap-2">
                    {(section.items || []).map((item) => (
                      <div key={item._id} className="flex items-center justify-between gap-3 border border-outline-variant/60 rounded p-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.images?.[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.images[0]} alt={item.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className={`text-body-md font-semibold truncate ${item.isAvailable === false ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                              {item.name}
                            </p>
                            <p className="text-body-sm text-on-surface-variant">
                              {item.price.toLocaleString()} RWF · {item.preparationMinutes ?? 15} min
                              {item.dietaryTags && item.dietaryTags.length > 0 && ` · ${item.dietaryTags.join(', ')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(section._id, item._id)}
                            title={item.isAvailable === false ? 'Mark available' : 'Mark unavailable'}
                            className="p-1 hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-[18px]">{item.isAvailable === false ? 'toggle_off' : 'toggle_on'}</span>
                          </button>
                          <button type="button" onClick={() => openItemEditor(section._id, item)} title="Edit item" className="p-1 hover:text-primary">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button type="button" onClick={() => handleDeleteItem(section._id, item._id)} title="Delete item" className="p-1 hover:text-error">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openItemEditor(section._id)}
                    className="self-start text-sm font-bold text-primary hover:text-primary-container flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span> Add item
                  </button>
                </section>
              ))}
            </div>

            {/* Availability hours */}
            <AvailabilityHoursEditor
              hours={menu.availabilityHours || []}
              onSave={handleSaveHours}
            />
          </>
        )}
      </div>

      {/* Item editor modal */}
      {editingSectionId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={closeItemEditor}>
          <div
            className="bg-surface-container-lowest w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface">{editingItemId ? 'Edit Item' : 'New Item'}</h3>
              <button type="button" onClick={closeItemEditor} className="p-1"><span className="material-symbols-outlined">close</span></button>
            </div>

            <input className="rmf-input" placeholder="Item name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            <textarea className="rmf-input" placeholder="Description" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            <div className="flex gap-2">
              <input className="rmf-input flex-1" type="number" min={0} placeholder="Price (RWF)" value={itemForm.price || ''} onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })} />
              <input className="rmf-input flex-1" type="number" min={0} placeholder="Prep minutes" value={itemForm.preparationMinutes ?? ''} onChange={(e) => setItemForm({ ...itemForm, preparationMinutes: Number(e.target.value) })} />
            </div>

            <ImageUpload
              service="seller"
              endpoint="/sellers/upload-document"
              value={itemForm.images?.[0]}
              label="Item photo"
              onChange={(url) => setItemForm((f) => ({ ...f, images: url ? [url] : [] }))}
            />

            <div>
              <p className="font-label-caps text-[10px] text-on-surface-variant mb-1">Dietary tags</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((tag) => {
                  const active = itemForm.dietaryTags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setItemForm((f) => ({
                        ...f,
                        dietaryTags: active ? (f.dietaryTags || []).filter((t) => t !== tag) : [...(f.dietaryTags || []), tag],
                      }))}
                      className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${active ? 'bg-primary-container text-white border-primary' : 'border-outline-variant text-on-surface-variant'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-body-sm text-on-surface">
              <input type="checkbox" checked={itemForm.isAvailable !== false} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} />
              Available for ordering
            </label>

            {/* Modifiers */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="font-label-caps text-[10px] text-on-surface-variant">Modifiers (add-ons)</p>
                <button type="button" onClick={addModifier} className="text-xs font-bold text-primary">+ Add modifier</button>
              </div>
              {(itemForm.modifiers || []).map((mod, mi) => (
                <div key={mi} className="border border-outline-variant/60 rounded p-2 flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <input className="rmf-input flex-1" placeholder="Modifier name (e.g. Sauce)" value={mod.name} onChange={(e) => updateModifier(mi, { name: e.target.value })} />
                    <button type="button" onClick={() => removeModifier(mi)} className="p-1 hover:text-error"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                    <input type="checkbox" checked={!!mod.multiSelect} onChange={(e) => updateModifier(mi, { multiSelect: e.target.checked })} />
                    Allow multiple selections
                  </label>
                  {mod.options.map((opt, oi) => (
                    <div key={oi} className="flex gap-2">
                      <input className="rmf-input flex-1" placeholder="Option label" value={opt.label} onChange={(e) => updateOption(mi, oi, { label: e.target.value })} />
                      <input className="rmf-input w-28" type="number" min={0} placeholder="+RWF" value={opt.extraPrice || ''} onChange={(e) => updateOption(mi, oi, { extraPrice: Number(e.target.value) })} />
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(mi)} className="self-start text-xs font-semibold text-primary">+ Add option</button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveItem}
              disabled={saving}
              className="rounded-lg bg-primary-container text-white px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-primary transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function AvailabilityHoursEditor({
  hours,
  onSave,
}: {
  hours: { day: string; open: string; close: string }[];
  onSave: (hours: { day: string; open: string; close: string }[]) => void;
}) {
  const [local, setLocal] = useState(() =>
    DAYS.map((day) => {
      const existing = hours.find((h) => h.day === day);
      return { day, open: existing?.open || '', close: existing?.close || '' };
    })
  );

  useEffect(() => {
    setLocal(DAYS.map((day) => {
      const existing = hours.find((h) => h.day === day);
      return { day, open: existing?.open || '', close: existing?.close || '' };
    }));
  }, [hours]);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
      <h2 className="font-label-caps text-label-caps text-on-surface">Availability Hours</h2>
      <div className="flex flex-col gap-2">
        {local.map((h, i) => (
          <div key={h.day} className="flex items-center gap-2">
            <span className="w-24 text-body-sm capitalize text-on-surface-variant">{h.day}</span>
            <input
              type="time"
              className="rmf-input w-32"
              value={h.open}
              onChange={(e) => setLocal((arr) => arr.map((x, j) => j === i ? { ...x, open: e.target.value } : x))}
            />
            <span className="text-on-surface-variant">–</span>
            <input
              type="time"
              className="rmf-input w-32"
              value={h.close}
              onChange={(e) => setLocal((arr) => arr.map((x, j) => j === i ? { ...x, close: e.target.value } : x))}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSave(local.filter((h) => h.open && h.close))}
        className="self-start rounded-lg bg-primary-container text-white px-4 py-2 text-sm font-bold uppercase tracking-wide hover:bg-primary transition"
      >
        Save Hours
      </button>
    </section>
  );
}
