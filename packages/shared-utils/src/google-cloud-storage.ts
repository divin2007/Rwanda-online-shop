import * as crypto from 'crypto';

export interface GoogleCloudStorageConfig {
  bucket: string;
  clientEmail: string;
  privateKey: string;
  projectId?: string;
  publicUrlPrefix?: string;
  predefinedAcl?: string;
}

let accessTokenCache: { token: string; expiresAt: number } | null = null;

const tokenUrl = 'https://oauth2.googleapis.com/token';
const storageScope = 'https://www.googleapis.com/auth/devstorage.read_write';

const base64Url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const parseJsonConfig = () => {
  const raw = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON
    || process.env.GCS_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
      projectId: parsed.project_id,
    };
  } catch {
    return null;
  }
};

const normalizePrivateKey = (value?: string) => value?.replace(/\\n/g, '\n');

export const getGoogleCloudStorageConfig = (): GoogleCloudStorageConfig | null => {
  const serviceAccount = parseJsonConfig();
  const bucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || process.env.GCS_CLIENT_EMAIL || serviceAccount?.clientEmail;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_CLOUD_PRIVATE_KEY || process.env.GCS_PRIVATE_KEY || serviceAccount?.privateKey);

  if (!bucket || !clientEmail || !privateKey) return null;

  return {
    bucket,
    clientEmail,
    privateKey,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCS_PROJECT_ID || serviceAccount?.projectId,
    publicUrlPrefix: process.env.GOOGLE_CLOUD_STORAGE_PUBLIC_URL_PREFIX || process.env.GCS_PUBLIC_URL_PREFIX,
    predefinedAcl: process.env.GOOGLE_CLOUD_STORAGE_PREDEFINED_ACL || process.env.GCS_PREDEFINED_ACL,
  };
};

const createServiceAccountJwt = (config: GoogleCloudStorageConfig) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: config.clientEmail,
    scope: storageScope,
    aud: tokenUrl,
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(config.privateKey))}`;
};

const getAccessToken = async (config: GoogleCloudStorageConfig) => {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createServiceAccountJwt(config),
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token request failed with ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Google OAuth token response did not include access_token');

  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(Number(data.expires_in || 3600) - 60, 60) * 1000,
  };
  return accessTokenCache.token;
};

const publicObjectUrl = (bucket: string, key: string, prefix?: string) => {
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/');
  if (prefix) return `${prefix.replace(/\/$/, '')}/${encodedKey}`;
  return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${encodedKey}`;
};

export const uploadToGoogleCloudStorage = async (
  fileBuffer: Buffer,
  key: string,
  mimeType: string,
  config: GoogleCloudStorageConfig,
): Promise<string> => {
  const token = await getAccessToken(config);
  const params = new URLSearchParams({
    uploadType: 'media',
    name: key,
  });

  if (config.predefinedAcl) {
    params.set('predefinedAcl', config.predefinedAcl);
  }

  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(config.bucket)}/o?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
        'Cache-Control': process.env.GOOGLE_CLOUD_STORAGE_CACHE_CONTROL || 'public, max-age=31536000, immutable',
      },
      body: fileBuffer as any,
    } as any,
  );

  if (!response.ok) {
    throw new Error(`Google Cloud Storage upload failed with ${response.status}: ${await response.text()}`);
  }

  return publicObjectUrl(config.bucket, key, config.publicUrlPrefix);
};

