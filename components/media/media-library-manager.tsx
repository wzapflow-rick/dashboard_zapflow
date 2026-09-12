'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileImage,
  Film,
  ImagePlus,
  Library,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { deleteMediaAsset, updateMediaAsset } from '@/app/actions/media-library';
import { MediaAssetCard } from '@/components/media/media-asset-card';
import { MediaUploader } from '@/components/media/media-uploader';
import {
  MEDIA_CATEGORY_OPTIONS,
  MEDIA_LIBRARY_LIMIT,
  filterAndSortMediaAssets,
  getMediaCategoryCounts,
  type MediaAsset,
  type MediaCategory,
  type MediaCategoryFilter,
  type MediaSort,
  type MediaTypeFilter,
} from '@/lib/media-library';

interface MediaLibraryManagerProps {
  initialAssets: MediaAsset[];
  initialTotal: number;
  initialSetupRequired: boolean;
  initialUploadConfigured?: boolean;
}

export function MediaLibraryManager({
  initialAssets,
  initialTotal,
  initialSetupRequired,
  initialUploadConfigured = true,
}: MediaLibraryManagerProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MediaCategoryFilter>('all');
  const [type, setType] = useState<MediaTypeFilter>('all');
  const [sort, setSort] = useState<MediaSort>('recent');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadActive, setUploadActive] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const setupRequired = initialSetupRequired;
  const uploadDisabled = setupRequired || !initialUploadConfigured || total >= MEDIA_LIBRARY_LIMIT;
  const remainingSlots = Math.max(0, MEDIA_LIBRARY_LIMIT - total);
  const counts = useMemo(() => getMediaCategoryCounts(assets), [assets]);
  const visibleAssets = useMemo(
    () => filterAndSortMediaAssets(assets, query, category, sort, type),
    [assets, category, query, sort, type],
  );
  const hasFilters = query.trim().length > 0 || category !== 'all' || type !== 'all';

  useEffect(() => {
    if (!uploadOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (uploadActive) {
        toast.error('Aguarde ou cancele os envios antes de fechar.');
        return;
      }
      setUploadOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uploadActive, uploadOpen]);

  const closeUpload = () => {
    if (uploadActive) {
      toast.error('Aguarde ou cancele os envios antes de fechar.');
      return;
    }
    setUploadOpen(false);
  };

  const handleUploaded = (asset: MediaAsset) => {
    setAssets((current) => {
      const existingIndex = current.findIndex((item) => item.id === asset.id);
      if (existingIndex >= 0) {
        return current.map((item) => (item.id === asset.id ? asset : item));
      }
      setTotal((value) => Math.min(MEDIA_LIBRARY_LIMIT, value + 1));
      return [asset, ...current];
    });
    toast.success(`${asset.name} entrou no acervo.`);
  };

  const handleRename = async (id: number, name: string) => {
    const updated = await updateMediaAsset({ id, name });
    setAssets((current) => current.map((asset) => (asset.id === id ? updated : asset)));
  };

  const handleCategoryChange = async (id: number, nextCategory: MediaCategory) => {
    const updated = await updateMediaAsset({ id, category: nextCategory });
    setAssets((current) => current.map((asset) => (asset.id === id ? updated : asset)));
  };

  const handleDelete = async (id: number) => {
    await deleteMediaAsset(id);
    setAssets((current) => current.filter((asset) => asset.id !== id));
    setTotal((value) => Math.max(0, value - 1));
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setType('all');
  };

  return (
    <main className="min-h-full bg-background-dark px-3 py-4 text-text-primary sm:px-5 sm:py-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-border-dark pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-dark bg-surface-dark text-primary">
              <Library className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">Acervo de mídias</h1>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                Imagens e vídeos prontos para reutilizar no seu catálogo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:justify-end">
            <div className="min-w-32 flex-1 sm:flex-none">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-secondary">
                <span>Uso do acervo</span>
                <span>{total}/{MEDIA_LIBRARY_LIMIT}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated" role="progressbar" aria-label="Uso do acervo" aria-valuemin={0} aria-valuemax={MEDIA_LIBRARY_LIMIT} aria-valuenow={total}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (total / MEDIA_LIBRARY_LIMIT) * 100)}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              disabled={uploadDisabled}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-background-dark transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="size-4" aria-hidden="true" />
              <span className="hidden min-[390px]:inline">Adicionar mídia</span>
              <span className="min-[390px]:hidden">Adicionar</span>
            </button>
          </div>
        </header>

        {setupRequired && (
          <div className="flex items-start gap-3 rounded-lg border border-accent-orange/40 bg-accent-orange/10 px-4 py-3 text-sm" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-orange" aria-hidden="true" />
            <div>
              <p className="font-semibold text-text-primary">Acervo temporariamente indisponível</p>
              <p className="mt-0.5 leading-relaxed text-text-secondary">
                Verifique a conexão com o PostgreSQL e aplique a migração do acervo. A página voltará a funcionar sem perder dados.
              </p>
            </div>
          </div>
        )}

        {!setupRequired && !initialUploadConfigured && (
          <div className="flex items-start gap-3 rounded-lg border border-accent-orange/40 bg-accent-orange/10 px-4 py-3 text-sm" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-orange" aria-hidden="true" />
            <div>
              <p className="font-semibold text-text-primary">Novos envios estão pausados</p>
              <p className="mt-0.5 leading-relaxed text-text-secondary">
                Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET. As mídias já salvas continuam disponíveis.
              </p>
            </div>
          </div>
        )}

        <section className="flex flex-col gap-3" aria-label="Filtros do acervo">
          <div className="flex flex-col gap-2 lg:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar no acervo</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome..."
                className="h-10 w-full rounded-lg border border-border-dark bg-surface-dark pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
              <label>
                <span className="sr-only">Tipo de mídia</span>
                <select value={type} onChange={(event) => setType(event.target.value as MediaTypeFilter)} className="h-10 w-full rounded-lg border border-border-dark bg-surface-dark px-3 text-sm text-text-primary outline-none focus:border-primary lg:w-36">
                  <option value="all">Todos os tipos</option>
                  <option value="image">Imagens</option>
                  <option value="video">Vídeos</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Categoria</span>
                <select value={category} onChange={(event) => setCategory(event.target.value as MediaCategoryFilter)} className="h-10 w-full rounded-lg border border-border-dark bg-surface-dark px-3 text-sm text-text-primary outline-none focus:border-primary lg:w-40">
                  <option value="all">Todas categorias</option>
                  {MEDIA_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="col-span-2 sm:col-span-1">
                <span className="sr-only">Ordenar acervo</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as MediaSort)} className="h-10 w-full rounded-lg border border-border-dark bg-surface-dark px-3 text-sm text-text-primary outline-none focus:border-primary lg:w-40">
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-border-dark" role="tablist" aria-label="Categorias rápidas">
            <button type="button" role="tab" aria-selected={category === 'all'} onClick={() => setCategory('all')} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${category === 'all' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              Todos <span className="ml-1 text-xs">{assets.length}</span>
            </button>
            {MEDIA_CATEGORY_OPTIONS.map((option) => (
              <button key={option.value} type="button" role="tab" aria-selected={category === option.value} onClick={() => setCategory(option.value)} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${category === option.value ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
                {option.label} <span className="ml-1 text-xs">{counts[option.value]}</span>
              </button>
            ))}
          </div>
        </section>

        {visibleAssets.length > 0 ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" aria-label="Mídias salvas">
            {visibleAssets.map((asset) => (
              <MediaAssetCard
                key={asset.id}
                asset={asset}
                onRename={handleRename}
                onCategoryChange={handleCategoryChange}
                onDelete={handleDelete}
                disabled={setupRequired}
              />
            ))}
          </section>
        ) : assets.length === 0 ? (
          <section className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border-dark bg-surface-dark px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-lg bg-surface-elevated text-primary">
              <ImagePlus className="size-6" aria-hidden="true" />
            </span>
            <div className="max-w-md">
              <h2 className="text-lg font-bold">Seu acervo começa aqui</h2>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-text-secondary">
                Guarde fotos de produtos e vídeos curtos para reutilizar sem enviar o mesmo arquivo toda vez.
              </p>
            </div>
            {!uploadDisabled && (
              <button type="button" onClick={() => setUploadOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-background-dark hover:bg-primary-hover">
                <Upload className="size-4" aria-hidden="true" /> Adicionar primeira mídia
              </button>
            )}
          </section>
        ) : (
          <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-dark px-6 py-10 text-center">
            <span className="flex gap-2 text-text-secondary"><FileImage className="size-5" aria-hidden="true" /><Film className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 className="font-bold">Nenhuma mídia encontrada</h2>
              <p className="mt-1 text-sm text-text-secondary">Tente outro nome, tipo ou categoria.</p>
            </div>
            {hasFilters && <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary hover:underline">Limpar filtros</button>}
          </section>
        )}
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-[1050] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="media-upload-title">
          <button type="button" className="absolute inset-0 bg-background-dark/90" onClick={closeUpload} aria-label="Fechar envio de mídias" />
          <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border-dark bg-surface-elevated shadow-2xl md:rounded-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-border-dark px-4 py-4 sm:px-5">
              <div>
                <h2 id="media-upload-title" className="text-lg font-bold">Adicionar mídias</h2>
                <p className="mt-0.5 text-sm text-text-secondary">Envios diretos, seguros e com progresso em tempo real.</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={closeUpload} className="flex size-9 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-dark hover:text-text-primary" aria-label="Fechar">
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <MediaUploader
                remainingSlots={remainingSlots}
                onUploaded={handleUploaded}
                onActiveChange={setUploadActive}
                disabled={uploadDisabled}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
