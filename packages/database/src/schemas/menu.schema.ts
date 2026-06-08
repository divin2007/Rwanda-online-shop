import mongoose, { Schema, model } from 'mongoose';

const menuModifierSchema = new Schema({
  name: { type: String, required: true },            // e.g. "Size", "Sauce"
  options: [{ label: String, extraPrice: { type: Number, default: 0 } }], // e.g. [{label:"Large", extraPrice:500}]
  required: { type: Boolean, default: false },
  multiSelect: { type: Boolean, default: false }
});

const menuItemSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  images: [{ type: String }],
  dietaryTags: [{ type: String }],  // e.g. ['vegan','halal','gluten-free']
  preparationMinutes: { type: Number, default: 15, min: 0 },
  isAvailable: { type: Boolean, default: true },
  modifiers: [menuModifierSchema],
  sortOrder: { type: Number, default: 0 },
  // Cold-chain / perishable handling for prepared food items.
  perishable: { type: Boolean, default: false },
  maxDeliveryMinutes: { type: Number }
});

const menuSectionSchema = new Schema({
  name: { type: String, required: true },   // e.g. "Starters", "Mains", "Drinks"
  description: { type: String },
  items: [menuItemSchema],
  sortOrder: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true }
});

const availabilityHourSchema = new Schema({
  day: { type: String },   // e.g. "monday"
  open: { type: String },  // e.g. "08:00"
  close: { type: String }  // e.g. "22:00"
}, { _id: false });

export const menuSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sections: [menuSectionSchema],
  availabilityHours: [availabilityHourSchema],
  isActive: { type: Boolean, default: true },
  currency: { type: String, default: 'RWF' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// sellerId is already unique (creates an index); add userId for fast owner lookups.
menuSchema.index({ userId: 1 });

export const Menu = mongoose.models.Menu || model('Menu', menuSchema);
