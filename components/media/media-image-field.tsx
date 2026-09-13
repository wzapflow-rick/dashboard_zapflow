'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import {
  Check,
  Film,
  Image as ImageIcon,
  Images,
  LoaderCircle,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { getMediaLibrary } from '@/app/actions/media-library';
import { MediaUploader } from '@/components/media/media-uploader';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import {
  MEDIA_CATEGORY_OPTIONS,
  MEDIA_LIBRARY_LIMIT,
  getMediaAssetKind,
  isMediaVideoUrl,
  type MediaAsset,
  type MediaCategory,
  type MediaCategoryFilter,
} from '@/lib/media-library';
import { cn } from '@/lib/utils';

interface MediaImageFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  title: string;
  description: string;
  recommendedSize?: string;
  initialCategory?: MediaCategory;
  aspect?: 'square' | 'banner';
  allowVideo?: boolean;
  removeLabel?: string;
  className?: string;
}

type PickerMode = 'library' | 'upload';

const MEDIA_IMAGE_PICKER_KEY = 'media-library:image-picker';

export function MediaImageField({
  value,
  onChange,
  title,
  description,
  recommendedSize,
  initialCategory = 'products',
  aspect = 'square',
  allowVideo = false,
  removeLabel = 'Remover imagem',
  className,
}: MediaImageFieldProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MediaCategoryFilter>('all');
  const { data, error, isLoading, mutate } = useSWR(
    isOpen ? MEDIA_IMAGE_PICKER_KEY : null,
    getMediaLibrary,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const selectableAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return (data?.assets ?? []).filter((asset) => {
      const assetKind = getMediaAssetKind(asset);
      const isSupportedImage = assetKind === 'image' && asset.mimeType.startsWith('image/');
      const isSupportedVideo = allowVideo && assetKind === 'video';
      if (!isSupportedImage && !isSupportedVideo) return false;
      if (category !== 'all' && asset.category !== category) return false;
      return !normalizedQuery || asset.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
    });
  }, [allowVideo, category, data?.assets, query]);

  const remainingSlots = Math.max(0, MEDIA_LIBRARY_LIMIT - (data?.total ?? MEDIA_LIBRARY_LIMIT));
  const isBanner = aspect === 'banner';
  const selectedValueIsVideo = allowVideo && isMediaVideoUrl(value);

  const openPicker = (nextMode: PickerMode) => {
    setMode(nextMode);
    setIsOpen(true);
  };

  const chooseAsset = (asset: MediaAsset) => {
    onChange(asset.url);
    setIsOpen(false);
  };

  const handleUploaded = async (asset: MediaAsset) => {
    await mutate((current) => {
      if (!current) return current;
      const alreadyStored = current.assets.some((item) => item.id === asset.id);
      return {
        ...current,
        assets: [asset, ...current.assets.filter((item) => item.id !== asset.id)],
        total: alreadyStored ? current.total : current.total + 1,
      };
    }, { revalidate: false });
    chooseAsset(asset);
  };

  const picker = (
    <MobileDrawer
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={allowVideo ? 'Escolher mídia' : 'Escolher imagem'}
      size="full"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist" aria-label={allowVideo ? 'Origem da mídia' : 'Origem da imagem'}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'library'}
            onClick={() => setMode('library')}
            className={cn(
              'flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors',
              mode === 'library'
                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <Images className="size-4" aria-hidden="true" />
            Meu acervo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'upload'}
            onClick={() => setMode('upload')}
            className={cn(
              'flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors',
              mode === 'upload'
                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <Upload className="size-4" aria-hidden="true" />
            Enviar nova
          </button>
        </div>

        {mode === 'library' ? (
          <div className="flex flex-col gap-4" role="tabpanel">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">{allowVideo ? 'Buscar mídia no acervo' : 'Buscar imagem no acervo'}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label>
                <span className="sr-only">Filtrar imagens por categoria</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as MediaCategoryFilter)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:w-48"
                >
                  <option value="all">Todas as categorias</option>
                  {MEDIA_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {isLoading ? (
              <div className="flex min-h-52 items-center justify-center text-slate-500" role="status">
                <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
                <span className="sr-only">Carregando acervo</span>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                Não foi possível carregar o acervo. Tente novamente.
              </div>
            ) : data?.setupRequired ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                O acervo ainda precisa ser configurado. Acesse{' '}
                <Link href="/dashboard/media-library" className="font-semibold underline underline-offset-2">
                  Meu Acervo
                </Link>{' '}
                para concluir o setup.
              </div>
            ) : selectableAssets.length > 0 ? (
              <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3" aria-label={allowVideo ? 'Mídias do acervo' : 'Imagens do acervo'}>
                {selectableAssets.map((asset) => {
                  const selected = value === asset.url;
                  const isVideo = getMediaAssetKind(asset) === 'video';
                  const categoryLabel = MEDIA_CATEGORY_OPTIONS.find((option) => option.value === asset.category)?.label;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => chooseAsset(asset)}
                      aria-label={`Usar ${asset.name}`}
                      aria-pressed={selected}
                      className={cn(
                        'group flex min-w-0 flex-col gap-2 rounded-xl border bg-white p-2 text-left transition-colors hover:border-primary dark:bg-slate-900',
                        selected ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 dark:border-slate-700',
                      )}
                    >
                      <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        {isVideo ? (
                          <video
                            src={asset.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="pointer-events-none size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Image
                            src={asset.url}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 42vw, 180px"
                            className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                        )}
                        {isVideo && (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                            <Film className="size-3" aria-hidden="true" /> MP4
                          </span>
                        )}
                        {selected && (
                          <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-white shadow-md">
                            <Check className="size-4" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 px-1 pb-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{asset.name}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{categoryLabel}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                {allowVideo ? <Film className="size-8 text-slate-400" aria-hidden="true" /> : <ImageIcon className="size-8 text-slate-400" aria-hidden="true" />}
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {allowVideo ? 'Nenhuma mídia encontrada' : 'Nenhuma imagem encontrada'}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Ajuste os filtros ou envie {allowVideo ? 'uma nova mídia' : 'uma nova imagem'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  {allowVideo ? 'Enviar mídia' : 'Enviar imagem'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="dark rounded-xl bg-background-dark p-3 sm:p-4" role="tabpanel">
            {!isLoading && !data?.uploadConfigured && !data?.setupRequired && (
              <p className="mb-4 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm leading-relaxed text-amber-200">
                O envio ainda não está configurado. As mídias já salvas continuam disponíveis no acervo.
              </p>
            )}
            <MediaUploader
              remainingSlots={remainingSlots}
              onUploaded={handleUploaded}
              disabled={isLoading || Boolean(data?.setupRequired) || !data?.uploadConfigured || remainingSlots <= 0}
              imagesOnly={!allowVideo}
              initialCategory={initialCategory}
              maxFiles={1}
            />
          </div>
        )}
      </div>
    </MobileDrawer>
  );

  return (
    <>
      <div className={cn('flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:flex-row sm:items-center', className)}>
        <div
          className={cn(
            'relative shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800',
            isBanner ? 'h-28 w-full sm:w-52' : 'size-24',
          )}
        >
          {value ? (
            selectedValueIsVideo ? (
              <video
                src={value}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                aria-hidden="true"
                className="pointer-events-none size-full object-cover"
              />
            ) : (
              <Image src={value} alt={title} fill sizes={isBanner ? '208px' : '96px'} className="object-cover" />
            )
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 text-slate-400">
              {allowVideo ? <Film className="size-7" aria-hidden="true" /> : <ImageIcon className="size-7" aria-hidden="true" />}
              <span className="text-[10px] font-bold uppercase tracking-wide">{allowVideo ? 'Sem mídia' : 'Sem imagem'}</span>
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
            {recommendedSize && <p className="text-xs text-slate-400 dark:text-slate-500">{recommendedSize}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPicker('library')}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Images className="size-4" aria-hidden="true" />
              {allowVideo ? 'Escolher mídia' : 'Escolher do acervo'}
            </button>
            <button
              type="button"
              onClick={() => openPicker('upload')}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <Upload className="size-4" aria-hidden="true" />
              {allowVideo ? 'Enviar mídia' : 'Enviar nova'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {removeLabel}
              </button>
            )}
          </div>
        </div>
      </div>
      {mounted ? createPortal(picker, document.body) : null}
    </>
  );
}
