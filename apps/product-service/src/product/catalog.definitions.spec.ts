import { resolveCatalogCategory } from './catalog.definitions';

describe('catalog definitions', () => {
  it('resolves legacy grocery labels to the grocery taxonomy', () => {
    expect(resolveCatalogCategory('Spices').id).toBe('grocery-produce-alliums');
    expect(resolveCatalogCategory('Produce').productType).toBe('fresh_food');
  });

  it('resolves apparel characteristics from common buyer language', () => {
    const category = resolveCatalogCategory('kitenge fabric');
    expect(category.id).toBe('fashion-textiles-kitenge');
    expect(category.variantAxes.map(axis => axis.key)).toEqual(expect.arrayContaining(['size', 'color']));
  });

  it('resolves footwear queries to the shoes taxonomy', () => {
    const category = resolveCatalogCategory('boots');
    expect(category.id).toBe('shoes-boots');
    expect(category.variantAxes.map(axis => axis.key)).toEqual(expect.arrayContaining(['size', 'color']));
  });

  it('resolves bakery queries to the bakery taxonomy', () => {
    const category = resolveCatalogCategory('croissant');
    expect(category.id).toBe('bakery-pastries-snacks');
    expect(category.variantAxes.map(axis => axis.key)).toEqual(expect.arrayContaining(['size', 'flavor']));
  });

  it('resolves hardware queries to the hardware taxonomy', () => {
    const category = resolveCatalogCategory('screws');
    expect(category.id).toBe('hardware-construction-fixtures');
    expect(category.variantAxes.map(axis => axis.key)).toEqual(expect.arrayContaining(['size', 'color']));
  });
});
