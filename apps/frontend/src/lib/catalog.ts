export type CatalogFieldType = 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'date' | 'color';

export type CatalogField = {
  key: string;
  label: string;
  type: CatalogFieldType;
  required?: boolean;
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  searchable?: boolean;
  filterable?: boolean;
};

export type CatalogCategory = {
  id: string;
  label: string;
  productType: string;
  defaultUnit: string;
  aliases: string[];
  variantAxes: CatalogField[];
  attributes: CatalogField[];
};

export type ProductVariantDraft = {
  sku?: string;
  title?: string;
  options: Record<string, string>;
  price?: string;
  unit?: string;
  stockType: 'finite' | 'infinite' | 'on_demand';
  stockQuantity?: string;
  images?: string[];
  isActive?: boolean;
};

export const fallbackCatalogCategories: CatalogCategory[] = [
  {
    id: 'grocery',
    label: 'Fresh Produce & Groceries',
    productType: 'fresh_food',
    defaultUnit: 'kg',
    aliases: ['grocery', 'groceries', 'produce', 'food'],
    variantAxes: [{ key: 'packageSize', label: 'Package size', type: 'select', options: ['250g', '500g', '1kg', '5kg', '10kg', '25kg'] }],
    attributes: [
      { key: 'originDistrict', label: 'Origin district', type: 'select', required: true, options: ['Kigali', 'Musanze', 'Rubavu', 'Huye', 'Nyagatare', 'Muhanga', 'Rwamagana', 'Other'] },
      { key: 'freshnessGrade', label: 'Freshness grade', type: 'select', required: true, options: ['A', 'B', 'C'] },
      { key: 'harvestDate', label: 'Harvest date', type: 'date' },
      { key: 'organic', label: 'Organic', type: 'boolean' },
      { key: 'shelfLifeDays', label: 'Shelf life', type: 'number', unit: 'days' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion & Apparel',
    productType: 'apparel',
    defaultUnit: 'pcs',
    aliases: ['fashion', 'apparel', 'textiles'],
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom'] },
      { key: 'color', label: 'Color', type: 'color' },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', required: true, options: ['Cotton', 'Kitenge', 'Silk', 'Wool', 'Polyester', 'Leather', 'Mixed'] },
      { key: 'gender', label: 'Fit for', type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'] },
      { key: 'fit', label: 'Fit', type: 'select', options: ['Slim', 'Regular', 'Relaxed', 'Custom'] },
      { key: 'lengthMeters', label: 'Fabric length', type: 'number', unit: 'm' },
      { key: 'care', label: 'Care instructions', type: 'text' },
    ],
  },
  {
    id: 'handicrafts',
    label: 'Handicrafts',
    productType: 'artisan_good',
    defaultUnit: 'pcs',
    aliases: ['handicrafts', 'crafts', 'artisan'],
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Custom'] },
      { key: 'color', label: 'Color', type: 'color' },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', required: true, options: ['Sisal', 'Clay', 'Wood', 'Cow dung', 'Banana fiber', 'Beads', 'Mixed'] },
      { key: 'artisanDistrict', label: 'Artisan district', type: 'select', required: true, options: ['Kigali', 'Huye', 'Musanze', 'Rubavu', 'Muhanga', 'Nyagatare', 'Other'] },
      { key: 'handmade', label: 'Handmade', type: 'boolean' },
      { key: 'productionDays', label: 'Production time', type: 'number', unit: 'days' },
      { key: 'dimensions', label: 'Dimensions', type: 'text' },
    ],
  },
  {
    id: 'home',
    label: 'Home & Interior',
    productType: 'home_good',
    defaultUnit: 'pcs',
    aliases: ['home', 'household'],
    variantAxes: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large'] },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', options: ['Wood', 'Clay', 'Metal', 'Glass', 'Fabric', 'Plastic', 'Mixed'] },
      { key: 'room', label: 'Room', type: 'select', options: ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Outdoor'] },
      { key: 'dimensions', label: 'Dimensions', type: 'text' },
      { key: 'fragile', label: 'Fragile', type: 'boolean' },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    productType: 'electronics',
    defaultUnit: 'pcs',
    aliases: ['electronics'],
    variantAxes: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'capacity', label: 'Capacity', type: 'select', options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB'] },
    ],
    attributes: [
      { key: 'brand', label: 'Brand', type: 'text', required: true },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['New', 'Used like new', 'Used good', 'Refurbished'] },
      { key: 'warrantyMonths', label: 'Warranty', type: 'number', unit: 'months' },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    productType: 'other',
    defaultUnit: 'pcs',
    aliases: ['other'],
    variantAxes: [],
    attributes: [
      { key: 'brand', label: 'Brand / maker', type: 'text' },
      { key: 'originDistrict', label: 'Origin district', type: 'text' },
      { key: 'condition', label: 'Condition', type: 'select', options: ['New', 'Used like new', 'Used good', 'Made to order'] },
    ],
  },
];

export const categoryFor = (categories: CatalogCategory[], categoryId?: string) =>
  categories.find(category => category.id === categoryId) || categories[categories.length - 1] || fallbackCatalogCategories[fallbackCatalogCategories.length - 1];
