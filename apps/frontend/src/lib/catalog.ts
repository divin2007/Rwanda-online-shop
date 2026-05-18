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
    id: 'shoes',
    label: 'Shoes & Footwear',
    productType: 'footwear',
    defaultUnit: 'pair',
    aliases: ['shoes', 'footwear', 'boots', 'sandals', 'sneakers', 'heels', 'slippers'],
    variantAxes: [
      { key: 'size', label: 'Shoe Size (EU)', type: 'select', options: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', 'Custom'] },
      { key: 'color', label: 'Color', type: 'color' },
    ],
    attributes: [
      { key: 'material', label: 'Material', type: 'select', required: true, options: ['Leather', 'Suede', 'Canvas', 'Rubber', 'Synthetic', 'Mixed'] },
      { key: 'gender', label: 'Fit for', type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'] },
      { key: 'shoeType', label: 'Shoe Type', type: 'select', options: ['Sneakers', 'Formal', 'Boots', 'Sandals', 'Heels', 'Loafers', 'Other'] },
      { key: 'fastening', label: 'Fastening Type', type: 'select', options: ['Laces', 'Slip-on', 'Velcro', 'Buckle', 'Zipper'] },
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
      { key: 'size', label: 'Serving Size', type: 'select', options: ['Single Serving', 'Pack of 4', 'Pack of 6', 'Pack of 12', 'Small Cake (0.5kg)', 'Medium Cake (1kg)', 'Large Cake (2kg)', 'Custom'] },
      { key: 'flavor', label: 'Flavor', type: 'select', options: ['Vanilla', 'Chocolate', 'Strawberry', 'Red Velvet', 'Banana', 'Caramel', 'Lemon', 'Fruit Blend', 'Glazed', 'Other'] },
    ],
    attributes: [
      { key: 'dietary', label: 'Dietary Type', type: 'select', options: ['Regular', 'Vegan', 'Gluten-Free', 'Sugar-Free', 'Halal', 'Keto'] },
      { key: 'eggless', label: 'Eggless', type: 'boolean' },
      { key: 'shelfLifeDays', label: 'Shelf Life (Days)', type: 'number' },
      { key: 'allergens', label: 'Allergens Info', type: 'select', options: ['None', 'Contains Gluten', 'Contains Dairy', 'Contains Nuts', 'Contains Eggs', 'Contains Soy', 'Multiple Allergens'] },
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
      { key: 'size', label: 'Size / Dimension', type: 'select', options: ['Small', 'Medium', 'Large', '1/2 inch', '3/4 inch', '1 inch', '2 inch', '10mm', '20mm', '50mm', '100mm', '500g', '1kg', '5kg', 'Custom'] },
      { key: 'color', label: 'Color', type: 'color' },
    ],
    attributes: [
      { key: 'brand', label: 'Brand', type: 'text', required: true },
      { key: 'material', label: 'Material', type: 'select', options: ['Steel', 'Iron', 'Brass', 'Copper', 'Aluminum', 'Plastic/PVC', 'Wood', 'Concrete/Cement', 'Mixed'] },
      { key: 'toolType', label: 'Hardware/Tool Type', type: 'select', options: ['Hand Tool', 'Power Tool', 'Fasteners (Nails/Screws)', 'Plumbing & Fittings', 'Electrical & Wiring', 'Paint & Adhesives', 'Safety & Protective Gear', 'Building Material', 'Other'] },
      { key: 'powerSource', label: 'Power Source', type: 'select', options: ['Manual', 'Corded Electric', 'Battery Powered', 'Pneumatic (Air)', 'Gasoline', 'N/A'] },
      { key: 'warrantyMonths', label: 'Warranty (Months)', type: 'number' },
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
