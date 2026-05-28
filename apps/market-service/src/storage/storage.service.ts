import { Injectable, Logger } from '@nestjs/common';
import { getGoogleCloudStorageConfig, uploadToGoogleCloudStorage } from '@rmf/shared-utils';
import * as crypto from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, folder: string): Promise<string> {
    const key = `${folder}/${fileName}`;
    const googleCloudStorage = getGoogleCloudStorageConfig();
    if (googleCloudStorage) {
      try {
        this.logger.log(`Uploading file ${fileName} to Google Cloud Storage bucket ${googleCloudStorage.bucket}...`);
        return await uploadToGoogleCloudStorage(fileBuffer, key, mimeType, googleCloudStorage);
      } catch (error: any) {
        this.logger.error(`Google Cloud Storage upload failed: ${error.message}. Trying the next storage backend.`);
      }
    }

    const s3Endpoint = process.env.S3_ENDPOINT;
    const s3Bucket = process.env.S3_BUCKET;
    const s3AccessKey = process.env.S3_ACCESS_KEY;
    const s3SecretKey = process.env.S3_SECRET_KEY;
    const s3Region = process.env.S3_REGION || 'us-east-1';
    const s3PublicUrlPrefix = process.env.S3_PUBLIC_URL_PREFIX;

    // Fallback to local FS if S3 is not configured
    if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
      this.logger.log('S3 not fully configured. Falling back to local filesystem storage.');
      const uploadDir = join(process.cwd(), 'uploads', folder);
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      writeFileSync(join(uploadDir, fileName), fileBuffer);
      
      const port = (process.env.PORT && process.env.PORT !== '3000') ? process.env.PORT : (folder === 'products' ? 3003 : 3002);
      const publicBaseUrl = (folder === 'products' ? process.env.PRODUCT_SERVICE_PUBLIC_URL : process.env.MARKET_SERVICE_PUBLIC_URL)
        || `http://localhost:${port}`;
      return `${publicBaseUrl}/uploads/${folder}/${fileName}`;
    }

    this.logger.log(`Uploading file ${fileName} to S3 bucket ${s3Bucket}...`);
    
    try {
      const url = await this.uploadToS3(fileBuffer, key, mimeType, {
        endpoint: s3Endpoint,
        bucket: s3Bucket,
        accessKey: s3AccessKey,
        secretKey: s3SecretKey,
        region: s3Region,
        publicUrlPrefix: s3PublicUrlPrefix,
      });
      return url;
    } catch (error: any) {
      this.logger.error(`S3 upload failed: ${error.message}. Falling back to local filesystem storage.`);
      // Safe fallback on error
      const uploadDir = join(process.cwd(), 'uploads', folder);
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      writeFileSync(join(uploadDir, fileName), fileBuffer);
      const port = (process.env.PORT && process.env.PORT !== '3000') ? process.env.PORT : (folder === 'products' ? 3003 : 3002);
      const publicBaseUrl = (folder === 'products' ? process.env.PRODUCT_SERVICE_PUBLIC_URL : process.env.MARKET_SERVICE_PUBLIC_URL)
        || `http://localhost:${port}`;
      return `${publicBaseUrl}/uploads/${folder}/${fileName}`;
    }
  }

  private async uploadToS3(
    fileBuffer: Buffer,
    key: string,
    mimeType: string,
    config: {
      endpoint: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      region: string;
      publicUrlPrefix?: string;
    }
  ): Promise<string> {
    const { endpoint, bucket, accessKey, secretKey, region, publicUrlPrefix } = config;
    
    // Parse endpoint
    const parsedUrl = new URL(endpoint);
    const host = parsedUrl.host;
    
    // Determine target URL and path
    let targetUrl = `${endpoint}/${bucket}/${key}`;
    let path = `/${bucket}/${key}`;
    let requestHost = host;

    // If it's a standard AWS endpoint, virtual host style is preferred
    if (host.endsWith('amazonaws.com')) {
      requestHost = `${bucket}.s3.${region}.amazonaws.com`;
      targetUrl = `https://${requestHost}/${key}`;
      path = `/${key}`;
    }

    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const dateStamp = amzDate.substring(0, 8);

    const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Canonical Headers
    const canonicalHeaders = `host:${requestHost}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    // Canonical Request
    const canonicalRequest = [
      'PUT',
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

    // String to Sign
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    // Signature Key
    const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'Host': requestHost,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader,
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length.toString(),
    };

    // Upload to S3
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers,
      body: fileBuffer as any,
    } as any);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 responded with ${response.status}: ${text}`);
    }

    if (publicUrlPrefix) {
      return `${publicUrlPrefix}/${key}`;
    }

    return targetUrl;
  }
}
