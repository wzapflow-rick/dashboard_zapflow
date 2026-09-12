import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session-server';
import {
  MEDIA_LIBRARY_LIMIT,
  validateMediaUploadDescriptor,
} from '@/lib/media-library';
import {
  countMediaAssets,
  requireMediaLibrarySchema,
} from '@/lib/media-library-server';
import {
  CloudinaryMediaError,
  createSignedMediaUpload,
} from '@/lib/cloudinary-media';

function errorResponse(error: unknown) {
  if (error instanceof CloudinaryMediaError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Não foi possível preparar o envio.';
  const status = message === 'Não autorizado' ? 401 : message.includes('Acesso negado') ? 403 : 503;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
    }

    const user = await requireAdmin();
    await requireMediaLibrarySchema();
    const body = await request.json();
    const validation = validateMediaUploadDescriptor(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (await countMediaAssets(user.empresaId) >= MEDIA_LIBRARY_LIMIT) {
      return NextResponse.json(
        { error: 'Seu acervo atingiu o limite de 250 mídias.' },
        { status: 409 },
      );
    }

    const signedUpload = createSignedMediaUpload({
      empresaId: user.empresaId,
      kind: validation.kind,
    });

    return NextResponse.json(signedUpload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[MEDIA_LIBRARY] Falha ao assinar upload:', error);
    return errorResponse(error);
  }
}
