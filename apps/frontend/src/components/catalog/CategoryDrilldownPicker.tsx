'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
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

function buildCategoryIndex(categories: CatalogCategory[]): CategoryIndex {
  const byId = new Map(categories.map(category => [category.id, category]));
  const childrenByParent = new Map<string, CatalogCategory[]>();
  const branchIds = new Set<string>();
  const roots: CatalogCategory[] = [];

  categories.forEach(category => {
    const parentId = category.parentId || null;

    if (!parentId || !byId.has(parentId)) {
      roots.push(category);
      return;
    }

    branchIds.add(parentId);
    const currentChildren = childrenByParent.get(parentId) || [];
    currentChildren.push(category);
    childrenByParent.set(parentId, currentChildren);
  });

  const sorter = (a: CatalogCategory, b: CatalogCategory) => a.label.localeCompare(b.label);
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
  const [activeParentId, setActiveParentId] = useState<string | null>(null);

  const index = useMemo(() => buildCategoryIndex(categories), [categories]);

  const selectedCategory = value ? index.byId.get(value) : undefined;
  const selectedPath = selectedCategory ? getCategoryPath(selectedCategory, index.byId) : '';
  const activeParent = activeParentId ? index.byId.get(activeParentId) : undefined;
  const activePath = activeParent ? getCategoryPath(activeParent, index.byId) : '';

  const displayedCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query) {
      return categories
        .filter(category => {
          const path = getCategoryPath(category, index.byId);
          const isBranch = index.branchIds.has(category.id);
          return (!leafOnly || !isBranch) && getCategorySearchText(category, path).includes(query);
        })
        .sort((a, b) => getCategoryPath(a, index.byId).localeCompare(getCategoryPath(b, index.byId)));
    }

    return activeParentId ? index.childrenByParent.get(activeParentId) || [] : index.roots;
  }, [activeParentId, categories, index, leafOnly, search]);

  const openPicker = () => {
    if (disabled) return;

    setIsOpen(current => {
      const nextOpen = !current;
      if (nextOpen && selectedCategory) {
        setActiveParentId(selectedCategory.parentId || null);
      }
      return nextOpen;
    });
  };

  const closePicker = () => {
    setIsOpen(false);
    setSearch('');
  };

  const handleBack = () => {
    if (!activeParent) {
      setActiveParentId(null);
      return;
    }

    setActiveParentId(activeParent.parentId || null);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 rounded-md border border-[#e0e0e0] bg-[#fcf9f8] p-4 text-left text-sm font-semibold text-[#1b1c1c] shadow-sm transition hover:border-[#ff6b00] focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className={selectedPath ? 'block truncate' : 'block truncate text-[#1b1c1c]/45'}>
            {selectedPath || placeholder}
          </span>
          {selectedPath && (
            <span className="mt-1 block truncate text-[10px] font-black uppercase tracking-[0.18em] text-[#e05300]">
              Exact category selected
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[#e05300] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/5"
            aria-label="Close category picker"
            onClick={closePicker}
          />

          <div className="absolute left-0 right-0 z-50 mt-3 flex max-h-[460px] origin-top flex-col overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-2xl">
            <div className="border-b border-[#e0e0e0] bg-[#fff7ed] p-4">
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#414844]/45"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    if (event.target.value.trim()) setActiveParentId(null);
                  }}
                  placeholder="Search exact category, e.g. soap, cement, bracelets"
                  className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 pl-9 pr-10 text-xs font-semibold text-[#1b1c1c] outline-none transition placeholder:text-[#1b1c1c]/35 focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/15"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#414844]/50 transition hover:bg-[#ffedd5] hover:text-[#1b1c1c]"
                    aria-label="Clear category search"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {!search && (
              <div className="flex items-center gap-2 border-b border-[#e0e0e0] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#414844]/60">
                {activeParentId ? (
                  <>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center gap-1 rounded-full bg-[#ffedd5] px-3 py-1.5 text-[#e05300] transition hover:bg-[#fed7aa]"
                    >
                      <ArrowLeft size={12} aria-hidden="true" />
                      Back
                    </button>
                    <span className="min-w-0 truncate text-[#1b1c1c]">{activePath}</span>
                  </>
                ) : (
                  <span>Choose a parent category</span>
                )}
              </div>
            )}

            <div className="flex-1 space-y-1 overflow-y-auto p-3" role="listbox">
              {displayedCategories.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#e0e0e0] bg-[#fcf9f8] px-4 py-8 text-center text-xs font-semibold text-[#414844]/55">
                  No matching categories yet.
                </div>
              ) : (
                displayedCategories.map(category => {
                  const isBranch = index.branchIds.has(category.id);
                  const isSelected = category.id === value;
                  const path = getCategoryPath(category, index.byId);
                  const parentPath = path.includes(' > ') ? path.slice(0, path.lastIndexOf(' > ')) : '';
                  const canSelect = !leafOnly || !isBranch;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (isBranch) {
                          setActiveParentId(category.id);
                          setSearch('');
                          return;
                        }

                        if (canSelect) {
                          onChange(category.id, category);
                          closePicker();
                        }
                      }}
                      className={`group flex w-full items-center justify-between gap-3 rounded-md p-3 text-left transition ${
                        isSelected
                          ? 'border border-[#ff6b00]/35 bg-[#fff7ed] text-[#e05300]'
                          : 'border border-transparent text-[#1b1c1c] hover:border-[#ffedd5] hover:bg-[#fcf9f8]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{category.label}</span>
                        {search && parentPath && (
                          <span className="mt-0.5 block truncate text-[11px] font-medium text-[#414844]/55">
                            {parentPath}
                          </span>
                        )}
                      </span>

                      {isBranch ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ff6b00]/20 bg-[#fff7ed] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#e05300] transition group-hover:bg-[#ff6b00] group-hover:text-white">
                          Subcategories
                          <ChevronRight size={12} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f1f5f2] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#24513f]">
                          {isSelected && <Check size={12} aria-hidden="true" />}
                          Select
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#e0e0e0] bg-[#fcf9f8] px-4 py-3 text-[11px] font-medium text-[#414844]/65">
              Start broad, then step down until the exact product type appears. Search jumps directly to final categories.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
