import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import {
  isMediaCategory,
  sanitizeMediaName,
} from '@/lib/media-library';
import {
  insertMediaAssetWithQuota,
  requireMediaLibrarySchema,
} from '@/lib/media-library-server';
import {
  cleanupCloudinaryMedia,
  CloudinaryMediaError,
  inspectCloudinaryMedia,
  isCompanyMediaPublicId,
  verifyCloudinaryUploadSignature,
  type CloudinaryResourceType,
} from '@/lib/cloudinary-media';

function errorResponse(error: unknown) {
  if (error instanceof CloudinaryMediaError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Não foi possível salvar a mídia.';
  const status = message === 'Não autorizado' ? 401 : message.includes('Acesso negado') ? 403 : 503;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let cleanupTarget: { publicId: string; resourceType: CloudinaryResourceType } | null = null;

  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
    }

    const user = await requireAdmin();
    await requireMediaLibrarySchema();
    const body = await request.json();
    const name = sanitizeMediaName(body.name);
    const category = body.category;
    const publicId = typeof body.publicId === 'string' ? body.publicId : '';
    const signature = typeof body.signature === 'string' ? body.signature : '';
    const version = Number(body.version);
    const resourceType = body.resourceType as CloudinaryResourceType;

    if (!name) return NextResponse.json({ error: 'Informe um nome para a mídia.' }, { status: 400 });
    if (!isMediaCategory(category)) {
      return NextResponse.json({ error: 'Selecione uma categoria válida.' }, { status: 400 });
    }
    if (!publicId || !signature || !Number.isInteger(version) || version <= 0) {
      return NextResponse.json({ error: 'A confirmação do upload é inválida.' }, { status: 400 });
    }
    if (resourceType !== 'image' && resourceType !== 'video') {
      return NextResponse.json({ error: 'Tipo de mídia inválido.' }, { status: 400 });
    }
    if (!isCompanyMediaPublicId(publicId, user.empresaId)) {
      return NextResponse.json({ error: 'A mídia enviada não pertence a esta empresa.' }, { status: 403 });
    }
    if (!verifyCloudinaryUploadSignature({ publicId, version, signature })) {
      return NextResponse.json({ error: 'A assinatura do upload é inválida.' }, { status: 400 });
    }

    cleanupTarget = { publicId, resourceType };
    const resource = await inspectCloudinaryMedia({
      publicId,
      resourceType,
      empresaId: user.empresaId,
    });
    const persisted = await insertMediaAssetWithQuota({
      empresaId: user.empresaId,
      name,
      category,
      url: resource.url,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes,
      width: resource.width,
      height: resource.height,
    });

    if (!persisted) {
      await cleanupCloudinaryMedia(publicId, resourceType);
      cleanupTarget = null;
      return NextResponse.json(
        { error: 'Seu acervo atingiu o limite de 250 mídias.' },
        { status: 409 },
      );
    }

    cleanupTarget = null;
    revalidatePath('/dashboard/media-library');
    return NextResponse.json({ asset: persisted.asset, created: persisted.created });
  } catch (error) {
    const shouldCleanup = cleanupTarget
      && (!(error instanceof CloudinaryMediaError) || error.code === 'INVALID_MEDIA');
    if (shouldCleanup && cleanupTarget) {
      try {
        await cleanupCloudinaryMedia(cleanupTarget.publicId, cleanupTarget.resourceType);
      } catch (cleanupError) {
        console.error('[MEDIA_LIBRARY] Falha ao limpar upload rejeitado:', cleanupError);
      }
    }
    console.error('[MEDIA_LIBRARY] Falha ao finalizar upload:', error);
    return errorResponse(error);
  }
}
