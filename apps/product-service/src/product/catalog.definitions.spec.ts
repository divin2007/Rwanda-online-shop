import { resolveCatalogCategory } from './catalog.definitions';

describe('catalog definitions', () => {
  it('resolves legacy grocery labels to the grocery taxonomy', () => {
    expect(resolveCatalogCategory('Spices').id).toBe('grocery');
    expect(resolveCatalogCategory('Produce').productType).toBe('fresh_food');
  });

  it('resolves apparel characteristics from common buyer language', () => {
    const category = resolveCatalogCategory('kitenge fabric');
    expect(category.id).toBe('fashion');
    expect(category.variantAxes.map(axis => axis.key)).toEqual(expect.arrayContaining(['size', 'color']));
  });
});
