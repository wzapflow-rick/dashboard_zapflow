'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/image-utils';
import {
  MEDIA_CATEGORY_OPTIONS,
  getMediaAssetKind,
  getMediaCategoryLabel,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';

interface MediaAssetCardProps {
  asset: MediaAsset;
  onRename: (id: number, name: string) => Promise<void>;
  onCategoryChange: (id: number, category: MediaCategory) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  disabled?: boolean;
}

export function MediaAssetCard({
  asset,
  onRename,
  onCategoryChange,
  onDelete,
  disabled = false,
}: MediaAssetCardProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const kind = getMediaAssetKind(asset);

  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [previewOpen]);

  const handleRename = async () => {
    menuRef.current?.removeAttribute('open');
    const nextName = window.prompt('Novo nome da mídia', asset.name)?.trim();
    if (!nextName || nextName === asset.name) return;
    setBusy(true);
    try {
      await onRename(asset.id, nextName);
      toast.success('Mídia renomeada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível renomear.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    menuRef.current?.removeAttribute('open');
    if (!window.confirm(`Excluir “${asset.name}” permanentemente do acervo e do armazenamento?`)) return;
    setBusy(true);
    try {
      await onDelete(asset.id);
      toast.success('Mídia excluída.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    menuRef.current?.removeAttribute('open');
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopied(true);
      toast.success('Link copiado.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const handleCategoryChange = async (category: MediaCategory) => {
    setBusy(true);
    try {
      await onCategoryChange(asset.id, category);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a categoria.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <article className="group overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-sm transition-colors hover:border-primary/50">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface-elevated text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Pré-visualizar ${asset.name}`}
        >
          {kind === 'image' ? (
            <Image
              src={asset.url}
              alt={asset.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <>
              <Film className="size-10" aria-hidden="true" />
              <span className="absolute flex size-10 items-center justify-center rounded-full bg-background-dark/80 text-text-primary">
                <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />
              </span>
            </>
          )}
          <span className="absolute left-2 top-2 rounded-md border border-border-dark bg-background-dark/85 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-primary">
            {kind === 'video' ? 'Vídeo' : 'Imagem'}
          </span>
        </button>

        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-text-primary" title={asset.name}>{asset.name}</h2>
              <p className="mt-0.5 text-xs text-text-secondary">{formatFileSize(asset.sizeBytes)}</p>
            </div>

            <details ref={menuRef} className="relative shrink-0">
              <summary
                className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary [&::-webkit-details-marker]:hidden"
                aria-label={`Ações de ${asset.name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-border-dark bg-surface-elevated p-1 shadow-xl">
                <button type="button" onClick={handleRename} disabled={busy || disabled} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-dark disabled:opacity-50">
                  <Pencil className="size-4" aria-hidden="true" /> Renomear
                </button>
                <button type="button" onClick={handleCopy} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-dark">
                  {copied ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} Copiar link
                </button>
                <a href={asset.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-dark">
                  <ExternalLink className="size-4" aria-hidden="true" /> Abrir original
                </a>
                <div className="my-1 border-t border-border-dark" />
                <button type="button" onClick={handleDelete} disabled={busy || disabled} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-accent-promo hover:bg-surface-dark disabled:opacity-50">
                  <Trash2 className="size-4" aria-hidden="true" /> Excluir
                </button>
              </div>
            </details>
          </div>

          <label className="sr-only" htmlFor={`media-category-${asset.id}`}>Categoria de {asset.name}</label>
          <select
            id={`media-category-${asset.id}`}
            value={asset.category}
            disabled={busy || disabled}
            onChange={(event) => void handleCategoryChange(event.target.value as MediaCategory)}
            className="h-9 w-full rounded-md border border-border-dark bg-surface-elevated px-2 text-xs font-medium text-text-primary outline-none focus:border-primary disabled:opacity-50"
            aria-label={`Categoria de ${asset.name}`}
          >
            {MEDIA_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </article>

      {previewOpen && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby={`media-preview-title-${asset.id}`}>
          <button type="button" onClick={() => setPreviewOpen(false)} className="absolute inset-0 bg-background-dark/90" aria-label="Fechar pré-visualização" />
          <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border-dark bg-surface-dark shadow-2xl md:rounded-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-border-dark px-4 py-3 md:px-5">
              <div className="min-w-0">
                <h2 id={`media-preview-title-${asset.id}`} className="truncate font-semibold text-text-primary">{asset.name}</h2>
                <p className="text-sm text-text-secondary">
                  {getMediaCategoryLabel(asset.category)} · {formatFileSize(asset.sizeBytes)}
                  {asset.width && asset.height ? ` · ${asset.width} × ${asset.height}px` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} className="flex size-9 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-elevated hover:text-text-primary" aria-label="Fechar">
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background-dark p-4 md:p-6">
              {kind === 'video' ? (
                <video src={asset.url} controls playsInline preload="metadata" className="max-h-[70dvh] max-w-full rounded-lg" aria-label={asset.name} />
              ) : (
                <div className="relative h-[60dvh] w-full">
                  <Image src={asset.url} alt={asset.name} fill sizes="90vw" className="object-contain" />
                </div>
              )}
            </div>
            <footer className="flex items-center justify-end border-t border-border-dark px-4 py-3 md:px-5">
              <a href={asset.url} download target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-border-dark px-3 text-sm font-semibold text-text-primary hover:bg-surface-elevated">
                <Download className="size-4" aria-hidden="true" /> Baixar original
              </a>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
