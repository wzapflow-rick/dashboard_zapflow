'use client';

import Image from 'next/image';
import { useState, type KeyboardEvent } from 'react';
import {
  Check,
  Copy,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/image-utils';
import {
  MEDIA_CATEGORY_OPTIONS,
  getMediaCategoryLabel,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';
import { cn } from '@/lib/utils';

interface MediaAssetCardProps {
  asset: MediaAsset;
  onRename: (id: number, name: string) => Promise<void>;
  onCategoryChange: (id: number, category: MediaCategory) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(value));
}

export function MediaAssetCard({ asset, onRename, onCategoryChange, onDelete }: MediaAssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(asset.name);
  const [isSaving, setIsSaving] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(asset.url);
      toast.success('Link da imagem copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  }

  async function saveName() {
    if (draftName.trim() === asset.name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onRename(asset.id, draftName);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function changeCategory(category: MediaCategory) {
    setIsSaving(true);
    try {
      await onCategoryChange(asset.id, category);
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    const confirmed = window.confirm(
      `Excluir “${asset.name}”? A imagem será removida permanentemente do acervo.`,
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await onDelete(asset.id);
    } finally {
      setIsSaving(false);
    }
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) {
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      setDraftName(asset.name);
      setIsEditing(false);
    }
  }

  return (
    <article className="group overflow-visible rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden rounded-t-[11px] bg-muted">
        <Image
          src={asset.url}
          alt={`Imagem do acervo: ${asset.name}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
          className="object-cover transition duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <span className="max-w-[70%] truncate rounded-lg border border-background/20 bg-background/85 px-2 py-1 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-sm">
            {getMediaCategoryLabel(asset.category)}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="flex size-8 items-center justify-center rounded-lg border border-background/20 bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background"
              aria-label={`Copiar link de ${asset.name}`}
              title="Copiar link"
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>

            <details className="relative">
              <summary
                className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg border border-background/20 bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background [&::-webkit-details-marker]:hidden"
                aria-label={`Ações de ${asset.name}`}
                title="Mais ações"
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="size-4" aria-hidden="true" />}
              </summary>
              <div className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
                <button
                  type="button"
                  onClick={(event) => {
                    setDraftName(asset.name);
                    setIsEditing(true);
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-muted"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Renomear
                </button>

                <label className="mt-1 block rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">
                  Mudar categoria
                  <select
                    value={asset.category}
                    disabled={isSaving}
                    onChange={(event) => void changeCategory(event.target.value as MediaCategory)}
                    className="mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                    aria-label={`Categoria de ${asset.name}`}
                  >
                    {MEDIA_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void confirmDelete()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Excluir
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      <div className="p-3">
        {isEditing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
            className="flex items-center gap-1.5"
          >
            <label className="sr-only" htmlFor={`media-name-${asset.id}`}>Nome da imagem</label>
            <input
              id={`media-name-${asset.id}`}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={handleNameKeyDown}
              maxLength={120}
              autoFocus
              disabled={isSaving}
              className="h-8 min-w-0 flex-1 rounded-lg border border-primary bg-background px-2 text-sm font-semibold text-foreground outline-none ring-2 ring-primary/15"
            />
            <button
              type="submit"
              disabled={isSaving || !draftName.trim()}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Salvar novo nome"
              title="Salvar"
            >
              {isSaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(asset.name);
                setIsEditing(false);
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Cancelar alteração do nome"
              title="Cancelar"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </form>
        ) : (
          <p className="truncate text-sm font-bold text-foreground" title={asset.name}>{asset.name}</p>
        )}

        <div className={cn('mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground', isEditing && 'opacity-60')}>
          {asset.width && asset.height ? <span>{asset.width} × {asset.height}</span> : <span>Dimensões indisponíveis</span>}
          <span aria-hidden="true">•</span>
          <span>{formatFileSize(asset.sizeBytes)}</span>
          <span aria-hidden="true">•</span>
          <time dateTime={asset.createdAt}>{formatUploadDate(asset.createdAt)}</time>
        </div>
      </div>
    </article>
  );
}
