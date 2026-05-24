'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Check, ChevronRight, Search, X, Folder, Layers, Tag, Grid } from 'lucide-react';
import type { CatalogCategory } from '@/lib/catalog';

type CategoryDrilldownPickerProps = {
  categories: CatalogCategory[];
  value?: string;
  onChange: (categoryId: string, category: CatalogCategory) => void;
  placeholder?: string;
  disabled?: boolean;
  leafOnly?: boolean;
  className?: string;
};

type CategoryIndex = {
  byId: Map<string, CatalogCategory>;
  childrenByParent: Map<string, CatalogCategory[]>;
  branchIds: Set<string>;
  roots: CatalogCategory[];
};

const CORE_ROOT_IDS = [
  'grocery',
  'food',
  'bakery',
  'fashion',
  'shoes',
  'sportswear',
  'hardware',
  'handicrafts',
  'home',
  'electronics',
  'cosmetics',
  'automotive',
  'education',
  'agriculture',
  'services',
  'events',
  'property',
  'pets',
  'solar-energy',
  'office-business',
  'finance',
  'other',
];

function buildCategoryIndex(categories: CatalogCategory[]): CategoryIndex {
  const byId = new Map(categories.map(category => [category.id, category]));
  const childrenByParent = new Map<string, CatalogCategory[]>();
  const branchIds = new Set<string>();
  const roots: CatalogCategory[] = [];

  categories.forEach(category => {
    const parentId = category.parentId || null;

    if (!parentId || !byId.has(parentId)) {
      if (CORE_ROOT_IDS.includes(category.id)) {
        roots.push(category);
      }
      return;
    }

    branchIds.add(parentId);
    const currentChildren = childrenByParent.get(parentId) || [];
    currentChildren.push(category);
    childrenByParent.set(parentId, currentChildren);
  });

  // Preserve the exact chronological/logical order defined in the master taxonomy tree
  const categoryOrderMap = new Map(categories.map((c, index) => [c.id, index]));
  const sorter = (a: CatalogCategory, b: CatalogCategory) => {
    const idxA = categoryOrderMap.get(a.id) ?? 0;
    const idxB = categoryOrderMap.get(b.id) ?? 0;
    return idxA - idxB;
  };
  roots.sort(sorter);
  childrenByParent.forEach(children => children.sort(sorter));

  return { byId, childrenByParent, branchIds, roots };
}

function getCategoryPath(category: CatalogCategory, byId: Map<string, CatalogCategory>) {
  const parts = [category.label];
  const seenIds = new Set([category.id]);
  let parentId = category.parentId || null;

  while (parentId && !seenIds.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;

    parts.unshift(parent.label);
    seenIds.add(parent.id);
    parentId = parent.parentId || null;
  }

  return parts.join(' > ');
}

function getCategorySearchText(category: CatalogCategory, path: string) {
  return [
    category.id,
    category.label,
    category.productType,
    path,
    ...(category.aliases || []),
  ].join(' ').toLowerCase();
}

export function CategoryDrilldownPicker({
  categories,
  value,
  onChange,
  placeholder = 'Select a product category',
  disabled = false,
  leafOnly = true,
  className = '',
}: CategoryDrilldownPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // Track selected active paths in the cascading panels
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const coreCategoriesOnly = useMemo(() => {
    const byId = new Map(categories.map(c => [c.id, c]));
    const memo = new Map<string, boolean>();

    const isCore = (catId: string): boolean => {
      if (CORE_ROOT_IDS.includes(catId)) return true;
      if (memo.has(catId)) return memo.get(catId)!;

      const cat = byId.get(catId);
      if (!cat || !cat.parentId) {
        memo.set(catId, false);
        return false;
      }

      memo.set(catId, false);
      const result = isCore(cat.parentId);
      memo.set(catId, result);
      return result;
    };

    return categories.filter(cat => isCore(cat.id));
  }, [categories]);

  const index = useMemo(() => buildCategoryIndex(coreCategoriesOnly), [coreCategoriesOnly]);

  const selectedCategory = value ? index.byId.get(value) : undefined;
  const selectedPath = selectedCategory ? getCategoryPath(selectedCategory, index.byId) : '';

  // Synchronize internal selection state when value changes externally
  useEffect(() => {
    if (selectedCategory) {
      const parentId = selectedCategory.parentId || null;
      if (parentId) {
        const parent = index.byId.get(parentId);
        if (parent && parent.parentId) {
          setSelectedParentId(parent.parentId);
          setSelectedSubId(parentId);
        } else {
          setSelectedParentId(parentId);
          setSelectedSubId(null);
        }
      } else {
        setSelectedParentId(selectedCategory.id);
        setSelectedSubId(null);
      }
    }
  }, [value, selectedCategory, index.byId]);

  // Derived columns
  const primaryCategories = index.roots;
  const subCategories = useMemo(() => {
    if (!selectedParentId) return [];
    return index.childrenByParent.get(selectedParentId) || [];
  }, [selectedParentId, index.childrenByParent]);

  const leafCategories = useMemo(() => {
    if (!selectedSubId) return [];
    return index.childrenByParent.get(selectedSubId) || [];
  }, [selectedSubId, index.childrenByParent]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return coreCategoriesOnly
      .filter(category => {
        const path = getCategoryPath(category, index.byId);
        const isBranch = index.branchIds.has(category.id);
        return (!leafOnly || !isBranch) && getCategorySearchText(category, path).includes(query);
      })
      .sort((a, b) => getCategoryPath(a, index.byId).localeCompare(getCategoryPath(b, index.byId)));
  }, [search, coreCategoriesOnly, index, leafOnly]);

  const openPicker = () => {
    if (disabled) return;
    setIsOpen(current => !current);
  };

  const closePicker = () => {
    setIsOpen(false);
    setSearch('');
  };

  const handlePrimarySelect = (catId: string, hasSub: boolean) => {
    setSelectedParentId(catId);
    setSelectedSubId(null);
    if (!hasSub) {
      const category = index.byId.get(catId);
      if (category) {
        onChange(catId, category);
        closePicker();
      }
    }
  };

  const handleSubSelect = (catId: string, hasSub: boolean) => {
    setSelectedSubId(catId);
    if (!hasSub) {
      const category = index.byId.get(catId);
      if (category) {
        onChange(catId, category);
        closePicker();
      }
    }
  };

  const handleLeafSelect = (catId: string) => {
    const category = index.byId.get(catId);
    if (category) {
      onChange(catId, category);
      closePicker();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-[#eaded4] bg-[#fcf9f8] p-4 text-left text-sm font-semibold text-[#1b1c1c] shadow-sm transition hover:border-[#ff6b00] focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className={selectedPath ? 'block truncate font-bold text-[#1b1c1c]' : 'block truncate text-[#1b1c1c]/45'}>
            {selectedPath || placeholder}
          </span>
          {selectedPath && (
            <span className="mt-1.5 block truncate text-[9px] font-black uppercase tracking-[0.2em] text-[#ff6b00]">
              ✓ exact category resolved
            </span>
          )}
        </span>
        <ChevronRight
          size={18}
          className={`shrink-0 text-[#ff6b00] transition-transform ${isOpen ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-[#1b1c1c]/60 backdrop-blur-md"
            aria-label="Close category picker"
            onClick={closePicker}
          />

          <div className="fixed inset-0 z-50 flex min-h-dvh items-stretch justify-center overflow-y-auto p-3 pointer-events-none sm:p-5">
          <div className="rmf-modal-panel max-w-6xl pointer-events-auto animate-reveal">
            
            {/* Search Header */}
            <div className="rmf-modal-header">
              <div className="relative w-full">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#63736a]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search exact categories instantly... (e.g. soap, cement, baskets)"
                  className="w-full rounded-xl border border-[#eaded4] bg-white py-3.5 pl-11 pr-12 text-sm font-semibold text-[#1b1c1c] outline-none transition placeholder:text-[#63736a]/50 focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/12"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#63736a] hover:bg-[#ffedd5] hover:text-[#1b1c1c] transition"
                    aria-label="Clear search"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="rmf-modal-close"
                aria-label="Close category picker"
              >
                &times;
              </button>
            </div>

            {/* Content Area */}
            {search.trim() ? (
              // Flat Search Results List
              <div className="rmf-modal-body space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#63736a] px-2 mb-3">Search Results</p>
                {searchResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#eaded4] bg-[#fcf9f8] px-6 py-12 text-center text-sm font-semibold text-[#63736a]">
                    No matching categories found. Try keeping it simple (e.g. "gift", "shoe").
                  </div>
                ) : (
                  searchResults.map(category => {
                    const isSelected = category.id === value;
                    const path = getCategoryPath(category, index.byId);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          onChange(category.id, category);
                          closePicker();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl p-4 text-left border transition ${
                          isSelected
                            ? 'border-[#ff6b00] bg-[#fff7ed] text-[#e05300]'
                            : 'border-transparent text-[#1b1c1c] hover:border-[#ff6b00]/30 hover:bg-[#fffbf8]'
                        }`}
                      >
                        <div>
                          <span className="block text-sm font-bold">{category.label}</span>
                          <span className="mt-1 block text-xs font-semibold text-[#63736a]">{path}</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fcf4] border border-[#d1fae5] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#15803d]">
                          {isSelected && <Check size={12} />}
                          Select Category
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              // Cascading Columns Category Picker
              <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[#eaded4] overflow-hidden md:grid-cols-3 md:divide-x md:divide-y-0">
                
                {/* Column 1: Primary Categories */}
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-4 bg-[#fcf9f8] border-b border-[#eaded4] flex items-center gap-2">
                    <Grid size={14} className="text-[#ff6b00]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#63736a]">1. Parent Category</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
                    {primaryCategories.map(cat => {
                      const isSelected = cat.id === selectedParentId;
                      const hasSub = index.branchIds.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handlePrimarySelect(cat.id, hasSub)}
                          className={`group flex w-full items-center justify-between rounded-xl p-3.5 text-left border transition-all duration-300 ${
                            isSelected
                              ? 'border-[#ff6b00]/30 bg-[#fff7ed] text-[#ff6b00] font-black'
                              : 'border-transparent text-[#1b1c1c] hover:bg-[#fffbf8] hover:border-[#ffedd5]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Folder size={15} className={isSelected ? 'text-[#ff6b00]' : 'text-[#63736a]/60'} />
                            <span className="truncate text-sm font-bold">{cat.label}</span>
                          </span>
                          {hasSub ? (
                            <ChevronRight size={14} className={`transition-transform duration-300 ${isSelected ? 'translate-x-0.5 text-[#ff6b00]' : 'text-[#63736a]/40 group-hover:translate-x-0.5'}`} />
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#15803d] bg-[#f0fcf4] px-1.5 py-0.5 rounded">select</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Column 2: Sub-categories */}
                <div className="flex flex-col h-full overflow-hidden bg-[#fffdfb]">
                  <div className="p-4 bg-[#fdfaf7] border-b border-[#eaded4] flex items-center gap-2">
                    <Layers size={14} className="text-[#ff6b00]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#63736a]">2. Sub-Category</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
                    {!selectedParentId ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-50">
                        <Folder size={24} className="text-[#63736a]" />
                        <p className="text-xs font-semibold text-[#63736a]">Select parent category above to unlock sub-categories.</p>
                      </div>
                    ) : subCategories.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                        <p className="text-xs font-semibold text-[#63736a]">No sub-categories available.</p>
                      </div>
                    ) : (
                      subCategories.map(cat => {
                        const isSelected = cat.id === selectedSubId;
                        const hasSub = index.branchIds.has(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSubSelect(cat.id, hasSub)}
                            className={`group flex w-full items-center justify-between rounded-xl p-3.5 text-left border transition-all duration-300 ${
                              isSelected
                                ? 'border-[#ff6b00]/30 bg-[#fff7ed] text-[#ff6b00] font-black'
                                : 'border-transparent text-[#1b1c1c] hover:bg-[#fffbf8] hover:border-[#ffedd5]'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Layers size={14} className={isSelected ? 'text-[#ff6b00]' : 'text-[#63736a]/60'} />
                              <span className="truncate text-sm font-bold">{cat.label}</span>
                            </span>
                            {hasSub ? (
                              <ChevronRight size={14} className={`transition-transform duration-300 ${isSelected ? 'translate-x-0.5 text-[#ff6b00]' : 'text-[#63736a]/40 group-hover:translate-x-0.5'}`} />
                            ) : (
                              <span className="text-[8px] font-black uppercase tracking-wider text-[#15803d] bg-[#f0fcf4] px-1.5 py-0.5 rounded">select</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Column 3: Leaf nodes / Product types */}
                <div className="flex flex-col h-full overflow-hidden bg-white">
                  <div className="p-4 bg-[#fcf9f8] border-b border-[#eaded4] flex items-center gap-2">
                    <Tag size={14} className="text-[#ff6b00]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#63736a]">3. Product Type</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
                    {!selectedSubId ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-50">
                        <Layers size={22} className="text-[#63736a]" />
                        <p className="text-xs font-semibold text-[#63736a]">Select sub-category to view specific product types.</p>
                      </div>
                    ) : leafCategories.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                        <Check size={20} className="text-[#15803d]" />
                        <p className="text-xs font-semibold text-[#63736a]">This category is complete! You can select it directly.</p>
                        <button
                          type="button"
                          onClick={() => handleLeafSelect(selectedSubId)}
                          className="mt-2 rounded-lg bg-[#ff6b00] px-4 py-2 text-xs font-bold text-white hover:bg-[#e05300] transition"
                        >
                          Select "{index.byId.get(selectedSubId)?.label}"
                        </button>
                      </div>
                    ) : (
                      leafCategories.map(cat => {
                        const isSelected = cat.id === value;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleLeafSelect(cat.id)}
                            className={`group flex w-full items-center justify-between rounded-xl p-3.5 text-left border transition-all duration-300 ${
                              isSelected
                                ? 'border-[#ff6b00] bg-[#fff7ed] text-[#ff6b00] font-black'
                                : 'border-transparent text-[#1b1c1c] hover:bg-[#fffbf8] hover:border-[#ffedd5]'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Tag size={13} className={isSelected ? 'text-[#ff6b00]' : 'text-[#63736a]/60'} />
                              <span className="truncate text-sm font-bold">{cat.label}</span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f0fcf4] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#15803d]">
                              {isSelected && <Check size={10} />}
                              Select
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Footer Info */}
            <div className="border-t border-[#eaded4] bg-[#fdfbf9] px-6 py-4 flex items-center justify-between text-xs font-semibold text-[#63736a]">
              <span>Choose parent category, click child subcategory, then select the final product type.</span>
              <button 
                type="button" 
                onClick={closePicker} 
                className="text-[10px] font-black uppercase tracking-wider text-[#ff6b00] hover:underline"
              >
                Close Picker
              </button>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
