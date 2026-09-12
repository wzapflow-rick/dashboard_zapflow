import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import {
  getMediaKindFromMimeType,
  validateMediaUploadDescriptor,
  type MediaKind,
} from '@/lib/media-library';

export type CloudinaryResourceType = 'image' | 'video';

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface CloudinaryResource {
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  secure_url: string;
}

export interface VerifiedCloudinaryMedia {
  publicId: string;
  resourceType: CloudinaryResourceType;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export class CloudinaryMediaError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_CONFIGURED' | 'INVALID_MEDIA' | 'LOOKUP_FAILED' | 'DELETE_FAILED',
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CloudinaryMediaError';
  }
}

function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryMediaError(
      'O envio de mídias está temporariamente indisponível. Configure o Cloudinary para continuar.',
      'NOT_CONFIGURED',
      503,
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryMediaConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim()
      && process.env.CLOUDINARY_API_KEY?.trim()
      && process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export function getCompanyMediaFolder(empresaId: number | string): string {
  const companyHash = createHash('sha256')
    .update(String(empresaId))
    .digest('hex')
    .slice(0, 20);
  return `zapflow_media/${companyHash}`;
}

export function createSignedMediaUpload(input: {
  empresaId: number | string;
  kind: MediaKind;
}) {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = getCompanyMediaFolder(input.empresaId);
  const publicId = randomUUID();
  const uploadParams = {
    folder,
    overwrite: false,
    public_id: publicId,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(uploadParams, config.apiSecret);
  const resourceType: CloudinaryResourceType = input.kind;

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`,
    resourceType,
    expectedPublicId: `${folder}/${publicId}`,
    expiresAt: timestamp + 10 * 60,
    fields: {
      api_key: config.apiKey,
      folder,
      overwrite: 'false',
      public_id: publicId,
      signature,
      timestamp: String(timestamp),
    },
  };
}

function secureStringEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCloudinaryUploadSignature(input: {
  publicId: string;
  version: number;
  signature: string;
}): boolean {
  const config = getCloudinaryConfig();
  const expected = cloudinary.utils.api_sign_request(
    { public_id: input.publicId, version: input.version },
    config.apiSecret,
  );
  return secureStringEquals(expected, input.signature);
}

export function isCompanyMediaPublicId(
  publicId: string,
  empresaId: number | string,
): boolean {
  const folder = getCompanyMediaFolder(empresaId);
  return publicId.startsWith(`${folder}/`) && !publicId.slice(folder.length + 1).includes('/');
}

function getMimeType(resourceType: string, format: string): string | null {
  const normalizedFormat = format.toLowerCase();
  if (resourceType === 'video' && normalizedFormat === 'mp4') return 'video/mp4';
  if (resourceType !== 'image') return null;
  if (normalizedFormat === 'jpg' || normalizedFormat === 'jpeg') return 'image/jpeg';
  if (normalizedFormat === 'png') return 'image/png';
  if (normalizedFormat === 'webp') return 'image/webp';
  return null;
}

export async function inspectCloudinaryMedia(input: {
  publicId: string;
  resourceType: CloudinaryResourceType;
  empresaId: number | string;
}): Promise<VerifiedCloudinaryMedia> {
  getCloudinaryConfig();

  if (!isCompanyMediaPublicId(input.publicId, input.empresaId)) {
    throw new CloudinaryMediaError('A mídia enviada não pertence a esta empresa.', 'INVALID_MEDIA', 403);
  }

  let resource: CloudinaryResource;
  try {
    resource = await cloudinary.api.resource(input.publicId, {
      resource_type: input.resourceType,
      type: 'upload',
    }) as CloudinaryResource;
  } catch {
    throw new CloudinaryMediaError(
      'Não foi possível confirmar o arquivo enviado. Tente novamente.',
      'LOOKUP_FAILED',
      502,
    );
  }

  const mimeType = getMimeType(resource.resource_type, resource.format);
  const validation = validateMediaUploadDescriptor({
    name: resource.public_id,
    category: 'other',
    mimeType,
    sizeBytes: resource.bytes,
  });
  const url = new URL(resource.secure_url);
  const matchesRequest = resource.public_id === input.publicId
    && resource.resource_type === input.resourceType
    && url.protocol === 'https:'
    && url.hostname === 'res.cloudinary.com';

  if (!validation.valid || !matchesRequest) {
    throw new CloudinaryMediaError(
      validation.valid ? 'O arquivo enviado não pôde ser validado.' : validation.error,
      'INVALID_MEDIA',
      400,
    );
  }

  return {
    publicId: resource.public_id,
    resourceType: input.resourceType,
    url: resource.secure_url,
    mimeType: validation.mimeType,
    sizeBytes: validation.sizeBytes,
    width: Number.isInteger(resource.width) && Number(resource.width) > 0 ? Number(resource.width) : null,
    height: Number.isInteger(resource.height) && Number(resource.height) > 0 ? Number(resource.height) : null,
  };
}

export async function cleanupCloudinaryMedia(
  publicId: string,
  resourceType: CloudinaryResourceType,
): Promise<void> {
  getCloudinaryConfig();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: 'upload',
    invalidate: true,
  });

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new CloudinaryMediaError('Não foi possível remover a mídia do armazenamento.', 'DELETE_FAILED', 502);
  }
}

export function parseCloudinaryAssetUrl(urlValue: string): {
  publicId: string;
  resourceType: CloudinaryResourceType;
} | null {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const uploadIndex = segments.indexOf('upload');
  const resourceType = segments[uploadIndex - 1];
  if (uploadIndex < 2 || (resourceType !== 'image' && resourceType !== 'video')) return null;

  let publicIdSegments = segments.slice(uploadIndex + 1);
  const versionIndex = publicIdSegments.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionIndex >= 0) publicIdSegments = publicIdSegments.slice(versionIndex + 1);
  if (publicIdSegments.length === 0 || publicIdSegments.some((segment) => segment.includes(','))) return null;

  const finalSegment = publicIdSegments.at(-1)?.replace(/\.[a-z0-9]+$/i, '');
  if (!finalSegment) return null;
  publicIdSegments[publicIdSegments.length - 1] = finalSegment;

  return {
    publicId: publicIdSegments.join('/'),
    resourceType,
  };
}

export async function deleteStoredCloudinaryMedia(input: {
  url: string;
  mimeType: string;
}): Promise<void> {
  const parsed = parseCloudinaryAssetUrl(input.url);
  if (!parsed) {
    if (input.url.includes('res.cloudinary.com')) {
      throw new CloudinaryMediaError(
        'Não foi possível identificar esta mídia legada com segurança.',
        'DELETE_FAILED',
        409,
      );
    }
    return;
  }

  const mimeKind = getMediaKindFromMimeType(input.mimeType);
  const resourceType = mimeKind ?? parsed.resourceType;
  await cleanupCloudinaryMedia(parsed.publicId, resourceType);
}
