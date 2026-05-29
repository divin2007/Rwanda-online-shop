const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Dynamically parse local .env file securely without external dependencies
try {
  const dotenvPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(dotenvPath)) {
    const dotenvContent = fs.readFileSync(dotenvPath, 'utf8');
    dotenvContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.trim().startsWith('#')) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  // Silent fallback if .env is missing
}

// Load S3 parameters from environment
const s3Endpoint = process.env.S3_ENDPOINT || "https://s3.eu-north-1.amazonaws.com";
const s3Bucket = process.env.S3_BUCKET || "rwshop-media-bucket";
const s3AccessKey = process.env.S3_ACCESS_KEY;
const s3SecretKey = process.env.S3_SECRET_KEY;
const s3Region = process.env.S3_REGION || "eu-north-1";

const fileBuffer = Buffer.from("Hello S3 from Rwanda Online Shop diagnostic script!");
const fileName = "diagnostic-test.txt";
const mimeType = "text/plain";
const folder = "products";
const key = `${folder}/${fileName}`;

async function testUpload() {
  const parsedUrl = new URL(s3Endpoint);
  const host = parsedUrl.host;
  
  let targetUrl = `${s3Endpoint}/${s3Bucket}/${key}`;
  let pathStr = `/${s3Bucket}/${key}`;
  let requestHost = host;

  // Use AWS Virtual Host style matching the product service
  if (host.endsWith('amazonaws.com')) {
    requestHost = `${s3Bucket}.s3.${s3Region}.amazonaws.com`;
    targetUrl = `https://${requestHost}/${key}`;
    pathStr = `/${key}`;
  }

  console.log("Target S3 Upload URL:", targetUrl);
  console.log("Path:", pathStr);
  console.log("Request Host:", requestHost);

  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const canonicalHeaders = `host:${requestHost}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    pathStr,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  const credentialScope = `${dateStamp}/${s3Region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  const kDate = crypto.createHmac('sha256', 'AWS4' + s3SecretKey).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(s3Region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${s3AccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    'Host': requestHost,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'Authorization': authorizationHeader,
    'Content-Type': mimeType,
    'Content-Length': fileBuffer.length.toString(),
  };

  try {
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers,
      body: fileBuffer,
    });

    console.log("\n--- AWS S3 RESPONSE ---");
    console.log("HTTP Status Code:", response.status);
    const text = await response.text();
    console.log("Response Body:\n", text);
  } catch (err) {
    console.error("HTTP Request Failed:", err);
  }
}

testUpload();
