'use client';

import { useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { Check, CircleAlert, ImagePlus, LoaderCircle, RefreshCw, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMediaAsset } from '@/app/actions/media-library';
import { formatFileSize, processImage } from '@/lib/image-utils';
import {
  MEDIA_CATEGORY_OPTIONS,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';
import { cn } from '@/lib/utils';

export const MEDIA_LIBRARY_INPUT_ID = 'media-library-files';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_SELECTION = 20;

type UploadStatus = 'optimizing' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
}

interface MediaUploaderProps {
  remainingSlots: number;
  onUploaded: (asset: MediaAsset) => void;
}

function getOutputFormat(file: File): 'jpeg' | 'png' | 'webp' {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpeg';
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      reject(new Error('Não foi possível ler as dimensões da imagem.'));
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

function getStatusLabel(status: UploadStatus) {
  if (status === 'optimizing') return 'Otimizando';
  if (status === 'uploading') return 'Enviando';
  if (status === 'done') return 'Concluído';
  return 'Falhou';
}

function getStatusProgress(status: UploadStatus) {
  if (status === 'optimizing') return 30;
  if (status === 'uploading') return 68;
  return 100;
}

export function MediaUploader({ remainingSlots, onUploaded }: MediaUploaderProps) {
  const [category, setCategory] = useState<MediaCategory>('products');
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  const activeUploads = useMemo(
    () => items.filter((item) => item.status === 'optimizing' || item.status === 'uploading').length,
    [items],
  );
  const availableSlots = Math.max(0, remainingSlots - activeUploads);
  const completedCount = items.filter((item) => item.status === 'done').length;

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function runUpload(item: UploadItem) {
    try {
      updateItem(item.id, { status: 'optimizing', error: undefined });
      const optimizedFile = await processImage(item.file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.88,
        format: getOutputFormat(item.file),
      });
      const dimensions = await readImageDimensions(optimizedFile);

      updateItem(item.id, { status: 'uploading' });
      const formData = new FormData();
      formData.set('image', optimizedFile);
      formData.set('name', item.file.name);
      formData.set('category', category);
      formData.set('width', String(dimensions.width));
      formData.set('height', String(dimensions.height));

      const asset = await uploadMediaAsset(formData);
      onUploaded(asset);
      updateItem(item.id, { status: 'done' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar a imagem.';
      updateItem(item.id, { status: 'error', error: message });
    }
  }

  async function addFiles(fileList: FileList | File[]) {
    const candidates = Array.from(fileList).slice(0, MAX_FILES_PER_SELECTION);
    const validFiles = candidates.filter((file) => ACCEPTED_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE);
    const invalidCount = candidates.length - validFiles.length;

    if (invalidCount > 0) {
      toast.error(`${invalidCount} arquivo(s) ignorado(s). Use PNG, JPG ou WebP de até 10 MB.`);
    }
    if (validFiles.length === 0) return;
    if (availableSlots === 0) {
      toast.error('Seu acervo já atingiu o limite de imagens.');
      return;
    }

    const acceptedFiles = validFiles.slice(0, availableSlots);
    if (acceptedFiles.length < validFiles.length) {
      toast.error(`Somente ${availableSlots} imagem(ns) cabem no plano atual.`);
    }

    const queuedItems = acceptedFiles.map<UploadItem>((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}-${crypto.randomUUID()}`,
      file,
      status: 'optimizing',
    }));
    setItems((current) => [...queuedItems, ...current]);

    let cursor = 0;
    async function worker() {
      while (cursor < queuedItems.length) {
        const nextItem = queuedItems[cursor];
        cursor += 1;
        await runUpload(nextItem);
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, queuedItems.length) }, () => worker()));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="media-upload-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImagePlus className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="media-upload-title" className="font-sans text-base font-bold text-foreground">
              Adicionar imagens
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Imagens nítidas e quadradas valorizam os produtos e aumentam a confiança no cardápio.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          Categoria
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as MediaCategory)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Categoria das novas imagens"
          >
            {MEDIA_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label
        htmlFor={MEDIA_LIBRARY_INPUT_ID}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition',
          isDragging
            ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary))]'
            : 'border-border bg-background/50 hover:border-primary/70 hover:bg-primary/[0.04]',
          availableSlots === 0 && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          id={MEDIA_LIBRARY_INPUT_ID}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={availableSlots === 0}
          onChange={handleInputChange}
          className="sr-only"
        />
        <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <UploadCloud className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-bold text-foreground">
          {availableSlots === 0 ? 'Limite do acervo atingido' : 'Arraste as imagens ou clique para escolher'}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          PNG, JPG ou WebP, até 10 MB por arquivo. Selecione até 20 de uma vez.
        </p>
        {availableSlots > 0 && (
          <span className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20">
            Selecionar imagens
          </span>
        )}
      </label>

      {items.length > 0 && (
        <div className="mt-5 border-t border-border pt-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">
              {activeUploads > 0 ? `${activeUploads} envio(s) em andamento` : `${completedCount} envio(s) concluído(s)`}
            </p>
            {activeUploads === 0 && completedCount > 0 && (
              <button
                type="button"
                onClick={() => setItems((current) => current.filter((item) => item.status === 'error'))}
                className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Limpar concluídos
              </button>
            )}
          </div>

          <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-background/70 p-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    item.status === 'done' && 'bg-primary/10 text-primary',
                    item.status === 'error' && 'bg-destructive/10 text-destructive',
                    (item.status === 'optimizing' || item.status === 'uploading') && 'bg-muted text-muted-foreground',
                  )}>
                    {item.status === 'done' ? <Check className="size-4" aria-hidden="true" /> : null}
                    {item.status === 'error' ? <CircleAlert className="size-4" aria-hidden="true" /> : null}
                    {item.status === 'optimizing' || item.status === 'uploading'
                      ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground" title={item.file.name}>{item.file.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{getStatusLabel(item.status)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all', item.status === 'error' ? 'bg-destructive' : 'bg-primary')}
                        style={{ width: `${getStatusProgress(item.status)}%` }}
                      />
                    </div>
                    {item.error && <p className="mt-2 text-xs leading-5 text-destructive">{item.error}</p>}
                  </div>

                  {item.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => void runUpload(item)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={`Tentar novamente o envio de ${item.file.name}`}
                      title="Tentar novamente"
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                    </button>
                  )}
                  {(item.status === 'done' || item.status === 'error') && (
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={`Remover ${item.file.name} da lista de envios`}
                      title="Remover da lista"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="mt-2 pl-11 text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
