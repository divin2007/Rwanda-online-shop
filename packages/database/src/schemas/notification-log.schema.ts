import { Schema, model } from 'mongoose';

export const notificationLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: String, required: true }, // SMS, EMAIL, IN_APP, WHATSAPP
  type: { type: String, required: true },
  referenceId: { type: Schema.Types.ObjectId },
  referenceType: { type: String },
  content: { type: String, required: true },
  status: { type: String, required: true }, // PENDING, SENT, DELIVERED, FAILED
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  failureReason: { type: String },
  sentAt: Date,
  deliveredAt: Date
}, { timestamps: true });

export const NotificationLog = model('NotificationLog', notificationLogSchema);
