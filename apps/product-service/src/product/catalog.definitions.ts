import { shopifyExtendedCatalogCategories } from './catalog.shopify-extended';

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
  synonyms?: string[];
  searchBoost?: number;
  isActive?: boolean;
  version?: number;
  variantAxes: CatalogField[];
  attributes: CatalogField[];
  parentId?: string | null;
};

const rmfCoreCatalogCategories: CatalogCategory[] = [
  {
    id: 'cosmetics',
    label: 'Cosmetics & Beauty',
    productType: 'health_and_beauty',
    defaultUnit: 'pcs',
    aliases: ['cosmetics', 'beauty', 'makeup', 'skin care', 'perfume'],
    parentId: null,
    variantAxes: [],
    attributes: [],
  },
  {
    id: 'cosmetics-babies',
    label: 'For Babies',
    productType: 'health_and_beauty',
    defaultUnit: 'pcs',
    aliases: ['baby cosmetics', 'baby skin care', 'infant care'],
    parentId: 'cosmetics',
    variantAxes: [],
    attributes: [],
  },
  {
    id: 'cosmetics-skin-care',
    label: 'Baby Skin Care',
    productType: 'health_and_beauty',
    defaultUnit: 'pcs',
    aliases: ['skin care', 'lotions', 'baby skin'],
    parentId: 'cosmetics-babies',
    variantAxes: [],
    attributes: [],
  },
  {
    id: 'baby-soap',
    label: 'Baby Soap',
    productType: 'health_and_beauty',
    defaultUnit: 'pcs',
    aliases: ['soap', 'baby soap', 'shampoo', 'wash'],
    parentId: 'cosmetics-skin-care',
    variantAxes: [
      { key: 'brand', label: 'Brand', type: 'select', options: ['Johnson & Johnson', 'Sebamed', 'Cetaphil', 'CeraVe', 'Aveeno', 'Baby Dove', 'Other'], filterable: true, searchable: true },
      { key: 'packSize', label: 'Pack Size', type: 'select', options: ['Single Bar', 'Pack of 2', 'Pack of 3', 'Pack of 6', '100ml Bottle', '200ml Bottle', '500ml Bottle'], filterable: true }
    ],
    attributes: [
      { key: 'skinType', label: 'Skin Type Recommendation', type: 'select', options: ['All Skin Types', 'Sensitive Skin', 'Dry Skin', 'Eczema Prone'], filterable: true },
      { key: 'organic', label: 'Organic / Natural', type: 'boolean', filterable: true },
      { key: 'hypoallergenic', label: 'Hypoallergenic', type: 'boolean', filterable: true }
    ],
  },
  {
    id: 'cosmetics-baby-food',
    label: 'Baby Food & Nutrition',
    productType: 'fresh_food',
    defaultUnit: 'pcs',
    aliases: ['baby food', 'infant nutrition', 'baby cereal'],
    parentId: 'cosmetics-babies',
    variantAxes: [],
    attributes: [],
  },
  {
    id: 'baby-cereal',
    label: 'Baby Cereal',
    productType: 'fresh_food',
    defaultUnit: 'pcs',
    aliases: ['cereal', 'baby cereal', 'porridge', 'cerelac'],
    parentId: 'cosmetics-baby-food',
    variantAxes: [
      { key: 'brand', label: 'Brand', type: 'select', options: ['Cerelac', 'Nestle', 'Gerber', 'Ella\'s Kitchen', 'Holle', 'Other'], filterable: true, searchable: true },
      { key: 'flavor', label: 'Flavor', type: 'select', options: ['Wheat & Milk', 'Rice', 'Oatmeal', 'Banana', 'Honey', 'Apple & Berry', 'Mixed Grains'], filterable: true }
    ],
    attributes: [
      { key: 'ageStage', label: 'Age Stage', type: 'select', options: ['Stage 1 (6+ months)', 'Stage 2 (8+ months)', 'Stage 3 (10+ months)', 'Stage 4 (12+ months)'], filterable: true },
      { key: 'shelfLifeDays', label: 'Shelf Life (Days)', type: 'number', min: 1, max: 730 }
    ],
  },
  {
    id: 'grocery',
    label: 'Fresh Produce & Groceries',
    productType: 'fresh_food',
    defaultUnit: 'kg',
    aliases: ['grocery', 'groceries', 'produce', 'fresh produce', 'food', 'dairy', 'spices', 'vegetables', 'fruit'],
    parentId: null,
    variantAxes: [
      { key: 'packageSize', label: 'Package size', type: 'select', options: ['250g', '500g', '1kg', '5kg', '10kg', '25kg'], filterable: true },
    ],
    attributes: [
      { key: 'originDistrict', label: 'Origin district', type: 'select', required: true, options: ['Kigali', 'Musanze', 'Rubavu', 'Huye', 'Nyagatare', 'Muhanga', 'Rwamagana', 'Other'], searchable: true, filterable: true },
      { key: 'freshnessGrade', label: 'Freshness grade', type: 'select', required: true, options: ['A', 'B', 'C'], filterable: true },
      { key: 'harvestDate', label: 'Harvest date', type: 'date' },
      { key: 'organic', label: 'Organic', type: 'boolean', filterable: true },
      { key: 'shelfLifeDays', label: 'Shelf life', type: 'number', unit: 'days', min: 0, max: 365 },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion & Apparel',
    productType: 'apparel',
    defaultUnit: 'pcs',
    aliases: ['fashion', 'apparel', 'clothing', 'clothes', 'textiles', 'kitenge', 'fabric'],
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom'], filterable: true },
      { key: 'color', label: 'Color', type: 'color', filterable: true },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', required: true, options: ['Cotton', 'Kitenge', 'Silk', 'Wool', 'Polyester', 'Leather', 'Mixed'], searchable: true, filterable: true },
      { key: 'gender', label: 'Fit for', type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'], filterable: true },
      { key: 'fit', label: 'Fit', type: 'select', options: ['Slim', 'Regular', 'Relaxed', 'Custom'], filterable: true },
      { key: 'lengthMeters', label: 'Fabric length', type: 'number', unit: 'm', min: 0 },
      { key: 'care', label: 'Care instructions', type: 'text' },
    ],
  },
  {
    id: 'shoes',
    label: 'Shoes & Footwear',
    productType: 'footwear',
    defaultUnit: 'pair',
    aliases: ['shoes', 'footwear', 'boots', 'sandals', 'sneakers', 'heels', 'slippers'],
    variantAxes: [
      { key: 'size', label: 'Shoe Size (EU)', type: 'select', options: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', 'Custom'], filterable: true },
      { key: 'color', label: 'Color', type: 'color', filterable: true },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', required: true, options: ['Leather', 'Suede', 'Canvas', 'Rubber', 'Synthetic', 'Mixed'], searchable: true, filterable: true },
      { key: 'gender', label: 'Fit for', type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'], filterable: true },
      { key: 'shoeType', label: 'Shoe Type', type: 'select', options: ['Sneakers', 'Formal', 'Boots', 'Sandals', 'Heels', 'Loafers', 'Other'], filterable: true },
      { key: 'fastening', label: 'Fastening Type', type: 'select', options: ['Laces', 'Slip-on', 'Velcro', 'Buckle', 'Zipper'], filterable: true },
      { key: 'care', label: 'Care Instructions', type: 'text' },
    ],
  },
  {
    id: 'bakery',
    label: 'Bakery & Pâtisserie',
    productType: 'bakery_good',
    defaultUnit: 'pcs',
    aliases: ['bakery', 'patisserie', 'bread', 'cake', 'pastry', 'cakes', 'croissant', 'sambusa', 'donuts', 'muffins', 'cookies'],
    variantAxes: [
      { key: 'size', label: 'Serving Size', type: 'select', options: ['Single Serving', 'Pack of 4', 'Pack of 6', 'Pack of 12', 'Small Cake (0.5kg)', 'Medium Cake (1kg)', 'Large Cake (2kg)', 'Custom'], filterable: true },
      { key: 'flavor', label: 'Flavor', type: 'select', options: ['Vanilla', 'Chocolate', 'Strawberry', 'Red Velvet', 'Banana', 'Caramel', 'Lemon', 'Fruit Blend', 'Glazed', 'Other'], filterable: true },
    ],
    attributes: [
      { key: 'dietary', label: 'Dietary Type', type: 'select', options: ['Regular', 'Vegan', 'Gluten-Free', 'Sugar-Free', 'Halal', 'Keto'], filterable: true },
      { key: 'eggless', label: 'Eggless', type: 'boolean', filterable: true },
      { key: 'shelfLifeDays', label: 'Shelf Life (Days)', type: 'number', min: 1, max: 90 },
      { key: 'allergens', label: 'Allergens Info', type: 'select', options: ['None', 'Contains Gluten', 'Contains Dairy', 'Contains Nuts', 'Contains Eggs', 'Contains Soy', 'Multiple Allergens'], filterable: true },
      { key: 'servingInstructions', label: 'Storage & Serving Instructions', type: 'text' },
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware & Tools (Quincaillerie)',
    productType: 'hardware_tool',
    defaultUnit: 'pcs',
    aliases: ['hardware', 'tools', 'quincaillerie', 'construction', 'screws', 'nails', 'paint', 'plumbing', 'electrical', 'hammer', 'screwdriver', 'drill', 'pipes', 'cables'],
    variantAxes: [
      { key: 'size', label: 'Size / Dimension', type: 'select', options: ['Small', 'Medium', 'Large', '1/2 inch', '3/4 inch', '1 inch', '2 inch', '10mm', '20mm', '50mm', '100mm', '500g', '1kg', '5kg', 'Custom'], filterable: true },
      { key: 'color', label: 'Color', type: 'color', filterable: true },
    ],
    attributes: [
      { key: 'brand', label: 'Brand', type: 'text', required: true, searchable: true, filterable: true },
      { key: 'material', label: 'Material', type: 'select', options: ['Steel', 'Iron', 'Brass', 'Copper', 'Aluminum', 'Plastic/PVC', 'Wood', 'Concrete/Cement', 'Mixed'], searchable: true, filterable: true },
      { key: 'toolType', label: 'Hardware/Tool Type', type: 'select', options: ['Hand Tool', 'Power Tool', 'Fasteners (Nails/Screws)', 'Plumbing & Fittings', 'Electrical & Wiring', 'Paint & Adhesives', 'Safety & Protective Gear', 'Building Material', 'Other'], filterable: true },
      { key: 'powerSource', label: 'Power Source', type: 'select', options: ['Manual', 'Corded Electric', 'Battery Powered', 'Pneumatic (Air)', 'Gasoline', 'N/A'], filterable: true },
      { key: 'warrantyMonths', label: 'Warranty (Months)', type: 'number', min: 0, max: 120 },
    ],
  },
  {
    id: 'handicrafts',
    label: 'Handicrafts',
    productType: 'artisan_good',
    defaultUnit: 'pcs',
    aliases: ['handicrafts', 'crafts', 'artisan', 'art', 'basket', 'agaseke', 'imigongo'],
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Custom'], filterable: true },
      { key: 'color', label: 'Color', type: 'color', filterable: true },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', required: true, options: ['Sisal', 'Clay', 'Wood', 'Cow dung', 'Banana fiber', 'Beads', 'Mixed'], searchable: true, filterable: true },
      { key: 'artisanDistrict', label: 'Artisan district', type: 'select', required: true, options: ['Kigali', 'Huye', 'Musanze', 'Rubavu', 'Muhanga', 'Nyagatare', 'Other'], filterable: true },
      { key: 'handmade', label: 'Handmade', type: 'boolean', filterable: true },
      { key: 'productionDays', label: 'Production time', type: 'number', unit: 'days', min: 0, max: 180 },
      { key: 'dimensions', label: 'Dimensions', type: 'text' },
    ],
  },
  {
    id: 'home',
    label: 'Home & Interior',
    productType: 'home_good',
    defaultUnit: 'pcs',
    aliases: ['home', 'household', 'interior', 'decor', 'kitchen'],
    variantAxes: [
      { key: 'color', label: 'Color', type: 'color', filterable: true },
      { key: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large'], filterable: true },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', options: ['Wood', 'Clay', 'Metal', 'Glass', 'Fabric', 'Plastic', 'Mixed'], searchable: true, filterable: true },
      { key: 'room', label: 'Room', type: 'select', options: ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Outdoor'], filterable: true },
      { key: 'dimensions', label: 'Dimensions', type: 'text' },
      { key: 'fragile', label: 'Fragile', type: 'boolean', filterable: true },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    productType: 'electronics',
    defaultUnit: 'pcs',
    aliases: ['electronics', 'phone', 'accessories', 'charger', 'device'],
    variantAxes: [
      { key: 'color', label: 'Color', type: 'color', filterable: true },
      { key: 'capacity', label: 'Capacity', type: 'select', options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB'], filterable: true },
    ],
    attributes: [
      { key: 'brand', label: 'Brand', type: 'text', required: true, searchable: true, filterable: true },
      { key: 'model', label: 'Model', type: 'text', searchable: true },
      { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['New', 'Used like new', 'Used good', 'Refurbished'], filterable: true },
      { key: 'warrantyMonths', label: 'Warranty', type: 'number', unit: 'months', min: 0, max: 60 },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    productType: 'other',
    defaultUnit: 'pcs',
    aliases: ['other', 'general', 'misc'],
    variantAxes: [],
    attributes: [
      { key: 'brand', label: 'Brand / maker', type: 'text', searchable: true },
      { key: 'originDistrict', label: 'Origin district', type: 'text', filterable: true },
      { key: 'condition', label: 'Condition', type: 'select', options: ['New', 'Used like new', 'Used good', 'Made to order'], filterable: true },
    ],
  },
];

export const catalogCategories: CatalogCategory[] = [
  ...rmfCoreCatalogCategories,
  ...shopifyExtendedCatalogCategories,
];

const aliasMap = new Map<string, CatalogCategory>();
const addAlias = (key: string, category: CatalogCategory) => {
  const normalized = key.toLowerCase();
  if (!aliasMap.has(normalized)) {
    aliasMap.set(normalized, category);
  }
};

for (const category of catalogCategories) {
  addAlias(category.id, category);
  addAlias(category.label, category);
  category.aliases.forEach(alias => addAlias(alias, category));
}

export const resolveCatalogCategory = (value: unknown): CatalogCategory => {
  const normalized = String(value || '').trim().toLowerCase();
  return aliasMap.get(normalized)
    || catalogCategories.find(category =>
      normalized.includes(category.id)
      || category.aliases.some(alias => normalized.includes(alias))
      || category.synonyms?.some(synonym => normalized.includes(synonym))
    )
    || catalogCategories[catalogCategories.length - 1];
};
