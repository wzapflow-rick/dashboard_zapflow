'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  FileImage,
  Film,
  LoaderCircle,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize, processImage } from '@/lib/image-utils';
import {
  MEDIA_CATEGORY_OPTIONS,
  MEDIA_MAX_FILES_PER_SELECTION,
  validateMediaUploadDescriptor,
  type MediaAsset,
  type MediaCategory,
  type MediaKind,
} from '@/lib/media-library';

type UploadStatus = 'queued' | 'optimizing' | 'uploading' | 'saving' | 'done' | 'error' | 'cancelled';

interface CloudinaryUploadResult {
  public_id: string;
  resource_type: 'image' | 'video';
  signature: string;
  version: number;
}

interface SignedUpload {
  uploadUrl: string;
  resourceType: 'image' | 'video';
  fields: Record<string, string>;
}

interface UploadItem {
  id: string;
  key: string;
  file: File;
  preparedFile?: File;
  name: string;
  category: MediaCategory;
  kind: MediaKind;
  status: UploadStatus;
  progress: number;
  error?: string;
  uploadedResource?: CloudinaryUploadResult;
}

interface MediaUploaderProps {
  remainingSlots: number;
  onUploaded: (asset: MediaAsset) => void;
  onActiveChange?: (active: boolean) => void;
  disabled?: boolean;
}

const ACTIVE_STATUSES = new Set<UploadStatus>(['queued', 'optimizing', 'uploading', 'saving']);
const MAX_PARALLEL_UPLOADS = 3;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir o envio.');
  return body;
}

function uploadDirectly(
  signed: SignedUpload,
  file: File,
  onProgress: (progress: number) => void,
  onRequest: (request: XMLHttpRequest) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    onRequest(request);
    request.open('POST', signed.uploadUrl);
    request.responseType = 'json';

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(90, 10 + Math.round((event.loaded / event.total) * 80)));
    });
    request.addEventListener('load', () => {
      const body = request.response || (() => {
        try {
          return JSON.parse(request.responseText);
        } catch {
          return {};
        }
      })();

      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body?.error?.message || 'O Cloudinary recusou este arquivo.'));
        return;
      }
      if (!body.public_id || !body.signature || !body.version) {
        reject(new Error('O serviço de mídia retornou uma resposta incompleta.'));
        return;
      }
      resolve(body as CloudinaryUploadResult);
    });
    request.addEventListener('error', () => reject(new Error('A conexão caiu durante o envio.')));
    request.addEventListener('abort', () => reject(new DOMException('Envio cancelado.', 'AbortError')));

    const payload = new FormData();
    Object.entries(signed.fields).forEach(([key, value]) => payload.set(key, value));
    payload.set('file', file);
    request.send(payload);
  });
}

function getFileKey(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join(':');
}

function getStatusLabel(status: UploadStatus): string {
  const labels: Record<UploadStatus, string> = {
    queued: 'Na fila',
    optimizing: 'Otimizando',
    uploading: 'Enviando',
    saving: 'Salvando',
    done: 'Concluído',
    error: 'Falhou',
    cancelled: 'Cancelado',
  };
  return labels[status];
}

export function MediaUploader({
  remainingSlots,
  onUploaded,
  onActiveChange,
  disabled = false,
}: MediaUploaderProps) {
  const [category, setCategory] = useState<MediaCategory>('products');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const itemsRef = useRef(items);
  const requestsRef = useRef(new Map<string, XMLHttpRequest>());
  const knownFilesRef = useRef(new Set<string>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const updateItem = useCallback((id: string, update: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  const runUpload = useCallback(async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item || item.status !== 'queued') return;

    try {
      let preparedFile = item.preparedFile;
      let uploadedResource = item.uploadedResource;

      if (!uploadedResource) {
        if (!preparedFile) {
          updateItem(id, { status: item.kind === 'image' ? 'optimizing' : 'uploading', progress: 5, error: undefined });
          preparedFile = item.kind === 'image'
            ? await processImage(item.file, {
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.84,
                format: 'webp',
              })
            : item.file;
          updateItem(id, { preparedFile });
        }

        const preparedValidation = validateMediaUploadDescriptor({
          name: item.name,
          category: item.category,
          mimeType: preparedFile.type,
          sizeBytes: preparedFile.size,
        });
        if (!preparedValidation.valid) throw new Error(preparedValidation.error);

        updateItem(id, { status: 'uploading', progress: 10 });
        const signedResponse = await fetch('/api/media-library/upload/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            mimeType: preparedFile.type,
            sizeBytes: preparedFile.size,
          }),
        });
        const signed = await readJsonResponse<SignedUpload>(signedResponse);
        uploadedResource = await uploadDirectly(
          signed,
          preparedFile,
          (progress) => updateItem(id, { progress }),
          (request) => requestsRef.current.set(id, request),
        );
        requestsRef.current.delete(id);
        updateItem(id, { uploadedResource });
      }

      updateItem(id, { status: 'saving', progress: 94 });
      const finalizeResponse = await fetch('/api/media-library/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          category: item.category,
          publicId: uploadedResource.public_id,
          resourceType: uploadedResource.resource_type,
          signature: uploadedResource.signature,
          version: uploadedResource.version,
        }),
      });
      const finalized = await readJsonResponse<{ asset: MediaAsset }>(finalizeResponse);
      updateItem(id, { status: 'done', progress: 100, error: undefined });
      onUploaded(finalized.asset);
    } catch (error) {
      requestsRef.current.delete(id);
      if (error instanceof DOMException && error.name === 'AbortError') return;
      updateItem(id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Falha inesperada no envio.',
      });
    }
  }, [onUploaded, updateItem]);

  useEffect(() => {
    const activeCount = items.filter((item) =>
      item.status === 'optimizing' || item.status === 'uploading' || item.status === 'saving').length;
    const slots = Math.max(0, MAX_PARALLEL_UPLOADS - activeCount);
    items.filter((item) => item.status === 'queued').slice(0, slots).forEach((item) => {
      void runUpload(item.id);
    });
  }, [items, runUpload]);

  useEffect(() => {
    onActiveChange?.(items.some((item) => ACTIVE_STATUSES.has(item.status)));
  }, [items, onActiveChange]);

  useEffect(() => () => {
    requestsRef.current.forEach((request) => request.abort());
    requestsRef.current.clear();
  }, []);

  const addFiles = (fileList: FileList | File[]) => {
    if (disabled) return;
    const selected = Array.from(fileList);
    if (selected.length > MEDIA_MAX_FILES_PER_SELECTION) {
      toast.error(`Selecione no máximo ${MEDIA_MAX_FILES_PER_SELECTION} arquivos por vez.`);
    }

    const reservedSlots = itemsRef.current.filter((item) =>
      item.status !== 'error' && item.status !== 'cancelled' && item.status !== 'done').length;
    let availableSlots = Math.max(0, remainingSlots - reservedSlots);
    const nextItems: UploadItem[] = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const file of selected.slice(0, MEDIA_MAX_FILES_PER_SELECTION)) {
      if (availableSlots <= 0) break;
      const key = getFileKey(file);
      if (knownFilesRef.current.has(key)) {
        duplicateCount += 1;
        continue;
      }

      const validation = validateMediaUploadDescriptor({
        name: file.name,
        category,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!validation.valid) {
        invalidCount += 1;
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }

      knownFilesRef.current.add(key);
      nextItems.push({
        id: globalThis.crypto.randomUUID(),
        key,
        file,
        name: validation.name,
        category,
        kind: validation.kind,
        status: 'queued',
        progress: 0,
      });
      availableSlots -= 1;
    }

    if (duplicateCount > 0) toast.error(`${duplicateCount} arquivo(s) duplicado(s) foram ignorados.`);
    if (selected.length > 0 && nextItems.length === 0 && invalidCount === 0 && duplicateCount === 0) {
      toast.error('Seu acervo não possui espaço para mais mídias.');
    }
    if (nextItems.length > 0) setItems((current) => [...current, ...nextItems]);
  };

  const cancelUpload = (item: UploadItem) => {
    requestsRef.current.get(item.id)?.abort();
    updateItem(item.id, { status: 'cancelled', error: undefined });
  };

  const retryUpload = (item: UploadItem) => {
    updateItem(item.id, { status: 'queued', progress: item.uploadedResource ? 92 : 0, error: undefined });
  };

  const completedCount = items.filter((item) => item.status === 'done').length;
  const activeCount = items.filter((item) => ACTIVE_STATUSES.has(item.status)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="media-upload-category" className="text-sm font-semibold text-text-primary">
          Categoria destes arquivos
        </label>
        <select
          id="media-upload-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as MediaCategory)}
          className="h-11 rounded-lg border border-border-dark bg-surface-dark px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        >
          {MEDIA_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <label
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-5 py-8 text-center transition-colors ${
          disabled
            ? 'cursor-not-allowed border-border-dark bg-surface-dark/60 opacity-60'
            : isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border-dark bg-surface-dark hover:border-primary/70 hover:bg-surface-elevated'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
          }}
          className="sr-only"
          aria-label={disabled ? 'Acervo aguardando configuração' : 'Arraste as imagens ou vídeos ou selecione arquivos'}
        />
        <span className="flex size-11 items-center justify-center rounded-lg border border-border-dark bg-surface-elevated text-primary">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-semibold text-text-primary">
            {disabled ? 'Envio indisponível' : 'Solte arquivos aqui ou clique para selecionar'}
          </span>
          <span className="text-sm leading-relaxed text-text-secondary">
            JPG, PNG ou WebP até 10 MB · MP4 até 50 MB · máximo de 20 por seleção
          </span>
        </span>
      </label>

      {items.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Fila de envios" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-text-primary">Fila de envios</span>
            <span className="text-text-secondary">
              {activeCount > 0 ? `${activeCount} em andamento` : `${completedCount} concluído(s)`}
            </span>
          </div>

          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {items.map((item) => {
              const isActive = ACTIVE_STATUSES.has(item.status);
              return (
                <article key={item.id} className="flex items-center gap-3 rounded-lg border border-border-dark bg-surface-dark p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-text-secondary">
                    {item.kind === 'video'
                      ? <Film className="size-4" aria-hidden="true" />
                      : <FileImage className="size-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                      <span className={`shrink-0 text-xs font-semibold ${item.status === 'error' ? 'text-accent-promo' : item.status === 'done' ? 'text-primary' : 'text-text-secondary'}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className={`h-full rounded-full transition-[width] ${item.status === 'error' ? 'bg-accent-promo' : 'bg-primary'}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className={`mt-1 truncate text-xs ${item.error ? 'text-accent-promo' : 'text-text-secondary'}`}>
                      {item.error || `${formatFileSize(item.file.size)} · ${MEDIA_CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label}`}
                    </p>
                  </div>
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => cancelUpload(item)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
                      aria-label={`Cancelar envio de ${item.name}`}
                    >
                      {item.status === 'queued'
                        ? <X className="size-4" aria-hidden="true" />
                        : <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                    </button>
                  )}
                  {(item.status === 'error' || item.status === 'cancelled') && (
                    <button
                      type="button"
                      onClick={() => retryUpload(item)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-elevated hover:text-primary"
                      aria-label={`Tentar novamente ${item.name}`}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                    </button>
                  )}
                  {item.status === 'done' && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
