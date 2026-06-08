import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import { OrderStatus } from '@rmf/shared-types';
import { getGoogleCloudStorageConfig, uploadToGoogleCloudStorage } from '@rmf/shared-utils';

/**
 * Monthly B2B invoice generation (Feature 7). Runs on the 1st of each month at 01:00.
 */
@Injectable()
export class InvoiceGenerationService {
  private readonly logger = new Logger(InvoiceGenerationService.name);

  constructor(
    @InjectModel('B2BAccount') private b2bModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('Invoice') private invoiceModel: Model<any>,
  ) {}

  @Cron('0 1 1 * *') // 01:00 on the 1st of each month
  async generateMonthlyInvoices(): Promise<{ generated: number }> {
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); // last day of prev month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1, 0, 0, 0, 0);

    const accounts = await this.b2bModel.find({ isVerified: true, monthlyInvoiceEnabled: true, deletedAt: null }).exec();
    let generated = 0;

    for (const account of accounts) {
      try {
        const orders = await this.orderModel
          .find({
            'buyer.userId': account.userId,
            orderSource: 'b2b_recurring',
            status: OrderStatus.DELIVERED,
            deletedAt: null,
            createdAt: { $gte: periodStart, $lte: periodEnd },
          })
          .lean()
          .exec();

        if (!orders.length) continue;

        const lineItems = orders.map((o: any) => ({
          orderNumber: o.orderNumber,
          orderId: o._id,
          date: o.createdAt,
          description: (o.products || []).map((p: any) => `${p.quantity}× ${p.name}`).join(', ').slice(0, 300),
          amount: Number(o.financials?.totalAmount || 0),
        }));
        const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
        const totalAmount = subtotal; // no tax line for now

        const period = `${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
        const invoiceNumber = `INV-${period}-${String(account._id).slice(-4).toUpperCase()}`;

        // Idempotency: skip if this invoice already exists.
        const existing = await this.invoiceModel.findOne({ invoiceNumber }).lean().exec();
        if (existing) continue;

        const sellerId = orders[0]?.seller?.sellerId;
        const invoice = await this.invoiceModel.create({
          invoiceNumber,
          b2bAccountId: account._id,
          buyerUserId: account.userId,
          sellerId,
          periodStart,
          periodEnd,
          lineItems,
          subtotal,
          taxAmount: 0,
          totalAmount,
          status: 'pending',
          dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
        });

        const pdfUrl = await this.renderAndUploadPdf(invoice, account).catch((e) => {
          this.logger.error(`Invoice PDF generation failed for ${invoiceNumber}: ${e?.message}`);
          return null;
        });
        if (pdfUrl) {
          await this.invoiceModel.findByIdAndUpdate(invoice._id, { $set: { pdfUrl } });
        }

        // Reset the account's running monthly credit.
        await this.b2bModel.findByIdAndUpdate(account._id, { $set: { currentMonthCredit: 0 } });

        // Email the invoice to the buyer (non-blocking).
        this.notifyInvoice(String(account.userId), invoiceNumber, totalAmount, pdfUrl);
        generated++;
      } catch (err: any) {
        this.logger.error(`Invoice generation failed for account ${account._id}: ${err?.message}`);
      }
    }

    if (generated) this.logger.log(`Generated ${generated} monthly B2B invoice(s).`);
    return { generated };
  }

  private renderAndUploadPdf(invoice: any, account: any): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const config = getGoogleCloudStorageConfig();
            if (!config) {
              reject(new Error('GCS not configured (set INVOICE_GCS_BUCKET / GCS env)'));
              return;
            }
            const key = `invoices/${invoice.invoiceNumber}.pdf`;
            const url = await uploadToGoogleCloudStorage(buffer, key, 'application/pdf', config);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        });

        doc.fontSize(20).text('RMF — Invoice', { align: 'right' });
        doc.moveDown();
        doc.fontSize(10).text(`Invoice: ${invoice.invoiceNumber}`);
        doc.text(`Organization: ${account.organizationName || ''}`);
        doc.text(`Period: ${new Date(invoice.periodStart).toDateString()} – ${new Date(invoice.periodEnd).toDateString()}`);
        doc.moveDown();
        doc.fontSize(11).text('Line Items:');
        for (const li of invoice.lineItems || []) {
          doc.fontSize(9).text(`${new Date(li.date).toLocaleDateString()}  ${li.orderNumber}  ${li.description}  —  ${li.amount.toLocaleString()} RWF`);
        }
        doc.moveDown();
        doc.fontSize(12).text(`Total: ${Number(invoice.totalAmount).toLocaleString()} RWF`, { align: 'right' });
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private notifyInvoice(userId: string, invoiceNumber: string, amount: number, pdfUrl: string | null): void {
    const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};
    axios
      .post(url, { userId, type: 'b2b.invoice_ready', params: { invoiceNumber, amount, pdfUrl }, channels: ['IN_APP', 'EMAIL'] }, { headers })
      .catch(() => {});
  }
}
