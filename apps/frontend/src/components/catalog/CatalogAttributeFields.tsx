'use client';

import React from 'react';
import { CatalogCategory, CatalogField, ProductVariantDraft } from '@/lib/catalog';

type Props = {
  category: CatalogCategory;
  attributes: Record<string, unknown>;
  onAttributesChange: (attributes: Record<string, unknown>) => void;
  variants?: ProductVariantDraft[];
  onVariantsChange?: (variants: ProductVariantDraft[]) => void;
};

const fieldClass = 'w-full rounded-md border border-[#d9e0db] bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ffedd5]';

const inputTypeFor = (field: CatalogField) => {
  if (field.type === 'date') return 'date';
  if (field.type === 'number') return 'number';
  if (field.type === 'color') return 'color';
  return 'text';
};

const inputValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return '';
};

const uniqueFieldsByKey = <T extends { key: string }>(fields: T[] = []) => {
  const seen = new Set<string>();
  return fields.filter(field => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
};

export function CatalogAttributeFields({ category, attributes, onAttributesChange, variants = [], onVariantsChange }: Props) {
  const categoryAttributes = React.useMemo(() => uniqueFieldsByKey(category.attributes), [category.attributes]);
  const variantAxes = React.useMemo(() => uniqueFieldsByKey(category.variantAxes), [category.variantAxes]);

  const updateAttribute = (key: string, value: unknown) => {
    onAttributesChange({ ...attributes, [key]: value });
  };

  const addVariant = () => {
    const options = Object.fromEntries(variantAxes.map(axis => [axis.key, '']));
    onVariantsChange?.([
      ...variants,
      { title: '', sku: '', options, price: '', unit: category.defaultUnit, stockType: 'finite', stockQuantity: '', images: [], isActive: true },
    ]);
  };

  const updateVariant = (index: number, patch: Partial<ProductVariantDraft>) => {
    onVariantsChange?.(variants.map((variant, currentIndex) => currentIndex === index ? { ...variant, ...patch } : variant));
  };

  const updateVariantOption = (index: number, key: string, value: string) => {
    const variant = variants[index];
    updateVariant(index, { options: { ...(variant?.options || {}), [key]: value } });
  };

  const updateVariantImages = (index: number, value: string) => {
    updateVariant(index, { images: value.split('\n').map(url => url.trim()).filter(Boolean) });
  };

  return (
    <section className="space-y-4 rounded-lg border border-[#d9e0db] bg-[#f7faf8] p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ff6b00]">Category intelligence</p>
        <h3 className="mt-1 text-lg font-black text-[#1b1c1c]">{category.label} attributes</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {categoryAttributes.map(field => (
          <label key={field.key} className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#405046]">
              {field.label}{field.required ? ' *' : ''}{field.unit ? ` (${field.unit})` : ''}
            </span>
            {field.type === 'select' ? (
              <select
                required={field.required}
                value={inputValue(attributes[field.key])}
                onChange={event => updateAttribute(field.key, event.target.value)}
                className={fieldClass}
              >
                <option value="">Select...</option>
                {(field.options || []).map(option => <option key={`${field.key}-${option}`} value={option}>{option}</option>)}
              </select>
            ) : field.type === 'boolean' ? (
              <label className="flex h-11 items-center gap-3 rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold text-[#1b1c1c]">
                <input
                  type="checkbox"
                  checked={Boolean(attributes[field.key])}
                  onChange={event => updateAttribute(field.key, event.target.checked)}
                  className="h-4 w-4 accent-[#ff6b00]"
                />
                Yes
              </label>
            ) : (
              <input
                required={field.required}
                type={inputTypeFor(field)}
                min={field.min}
                max={field.max}
                value={inputValue(attributes[field.key])}
                onChange={event => updateAttribute(field.key, event.target.value)}
                className={`${fieldClass} ${field.type === 'color' ? 'h-11 p-1' : ''}`}
              />
            )}
          </label>
        ))}
      </div>

      {variantAxes.length > 0 && onVariantsChange && (
        <div className="space-y-3 border-t border-[#d9e0db] pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#1b1c1c]">Variants</p>
              <p className="mt-1 text-xs font-semibold text-[#5f7569]">Use these for size, color, package size, capacity, or other buyer-selectable options.</p>
            </div>
            <button type="button" onClick={addVariant} className="rounded-md bg-[#ff6b00] px-3 py-2 text-xs font-black text-white">
              Add variant
            </button>
          </div>

          {variants.map((variant, index) => (
            <div key={index} className="rounded-md border border-[#d9e0db] bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#405046]">Variant {index + 1}</p>
                <button type="button" onClick={() => onVariantsChange(variants.filter((_, currentIndex) => currentIndex !== index))} className="text-xs font-black text-[#7b3f3f]">
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={fieldClass} placeholder="SKU" value={variant.sku || ''} onChange={event => updateVariant(index, { sku: event.target.value })} />
                <input className={fieldClass} placeholder="Variant title" value={variant.title || ''} onChange={event => updateVariant(index, { title: event.target.value })} />
                {variantAxes.map(axis => (
                  <label key={axis.key} className="block">
                    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#405046]">{axis.label}</span>
                    {axis.type === 'select' ? (
                      <select className={fieldClass} value={variant.options?.[axis.key] || ''} onChange={event => updateVariantOption(index, axis.key, event.target.value)}>
                        <option value="">Select...</option>
                        {(axis.options || []).map(option => <option key={`${axis.key}-${option}`} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input type={inputTypeFor(axis)} className={`${fieldClass} ${axis.type === 'color' ? 'h-11 p-1' : ''}`} value={variant.options?.[axis.key] || ''} onChange={event => updateVariantOption(index, axis.key, event.target.value)} />
                    )}
                  </label>
                ))}
                <input className={fieldClass} type="number" placeholder="Variant price markup (+/- RWF relative to parent)" value={variant.price || ''} onChange={event => updateVariant(index, { price: event.target.value })} />
                <input className={fieldClass} placeholder="Unit" value={variant.unit || category.defaultUnit} onChange={event => updateVariant(index, { unit: event.target.value })} />
                <select className={fieldClass} value={variant.stockType || 'finite'} onChange={event => updateVariant(index, { stockType: event.target.value as ProductVariantDraft['stockType'] })}>
                  <option value="finite">Finite stock</option>
                  <option value="infinite">Always available</option>
                  <option value="on_demand">Made to order</option>
                </select>
                <input className={fieldClass} type="number" min="0" placeholder="Variant stock" value={variant.stockQuantity || ''} onChange={event => updateVariant(index, { stockQuantity: event.target.value })} />
                <input className={fieldClass} placeholder="Variant video URL (optional)" value={variant.videoUrl || ''} onChange={event => updateVariant(index, { videoUrl: event.target.value })} />
                <input className={fieldClass} placeholder="Variant video thumbnail URL (optional)" value={variant.thumbnailUrl || ''} onChange={event => updateVariant(index, { thumbnailUrl: event.target.value })} />
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#405046]">Variant image URLs</span>
                  <textarea
                    className={`${fieldClass} min-h-24`}
                    placeholder="One image URL per line"
                    value={(variant.images || []).join('\n')}
                    onChange={event => updateVariantImages(index, event.target.value)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
