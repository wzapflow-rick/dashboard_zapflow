'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  ImageIcon,
  Images,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { deleteMediaAsset, updateMediaAsset } from '@/app/actions/media-library';
import { MediaAssetCard } from '@/components/media/media-asset-card';
import { MEDIA_LIBRARY_INPUT_ID, MediaUploader } from '@/components/media/media-uploader';
import {
  MEDIA_CATEGORY_OPTIONS,
  MEDIA_LIBRARY_LIMIT,
  filterAndSortMediaAssets,
  getMediaCategoryCounts,
  type MediaAsset,
  type MediaCategory,
  type MediaCategoryFilter,
  type MediaSort,
} from '@/lib/media-library';
import { cn } from '@/lib/utils';

interface MediaLibraryManagerProps {
  initialAssets: MediaAsset[];
  initialTotal: number;
}

export function MediaLibraryManager({ initialAssets, initialTotal }: MediaLibraryManagerProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MediaCategoryFilter>('all');
  const [sort, setSort] = useState<MediaSort>('recent');

  const categoryCounts = useMemo(() => getMediaCategoryCounts(assets), [assets]);
  const visibleAssets = useMemo(
    () => filterAndSortMediaAssets(assets, query, category, sort),
    [assets, category, query, sort],
  );
  const usagePercentage = Math.min(100, Math.round((total / MEDIA_LIBRARY_LIMIT) * 100));

  const handleUploaded = useCallback((asset: MediaAsset) => {
    setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
    setTotal((current) => Math.min(MEDIA_LIBRARY_LIMIT, current + 1));
    toast.success(`${asset.name} foi adicionada ao acervo.`);
  }, []);

  async function handleRename(id: number, name: string) {
    try {
      const updated = await updateMediaAsset({ id, name });
      setAssets((current) => current.map((asset) => (asset.id === id ? updated : asset)));
      toast.success('Imagem renomeada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível renomear a imagem.');
      throw error;
    }
  }

  async function handleCategoryChange(id: number, nextCategory: MediaCategory) {
    try {
      const updated = await updateMediaAsset({ id, category: nextCategory });
      setAssets((current) => current.map((asset) => (asset.id === id ? updated : asset)));
      toast.success('Categoria atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível mudar a categoria.');
      throw error;
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMediaAsset(id);
      setAssets((current) => current.filter((asset) => asset.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success('Imagem excluída do acervo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a imagem.');
      throw error;
    }
  }

  function openFilePicker() {
    document.getElementById(MEDIA_LIBRARY_INPUT_ID)?.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav aria-label="Navegação estrutural">
            <ol className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <li><Link href="/dashboard/menu" className="transition hover:text-foreground">Produtos</Link></li>
              <li><ChevronRight className="size-3.5" aria-hidden="true" /></li>
              <li aria-current="page" className="text-foreground">Acervo de mídias</li>
            </ol>
          </nav>
          <div className="mt-3 flex items-center gap-3">
            <div className="hidden size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:flex">
              <Images className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-balance font-sans text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Acervo de mídias
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Organize imagens de produtos e reutilize o material certo em poucos cliques.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openFilePicker}
          disabled={total >= MEDIA_LIBRARY_LIMIT}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Adicionar imagens
        </button>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <MediaUploader
          remainingSlots={Math.max(0, MEDIA_LIBRARY_LIMIT - total)}
          onUploaded={handleUploaded}
        />

        <aside className="flex flex-col gap-4" aria-label="Resumo do acervo">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Uso do plano</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                  {total}<span className="text-base font-semibold text-muted-foreground">/{MEDIA_LIBRARY_LIMIT}</span>
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ImageIcon className="size-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" aria-label={`${usagePercentage}% do acervo utilizado`}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercentage}%` }} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {Math.max(0, MEDIA_LIBRARY_LIMIT - total)} imagens disponíveis no plano atual.
            </p>
            <Link
              href="/dashboard/subscription"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-sm font-bold text-primary transition hover:bg-primary/15"
            >
              Fazer upgrade
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-bold text-foreground">Por categoria</h2>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition',
                  category === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                Todas
                <span className="text-xs">{assets.length}</span>
              </button>
              {MEDIA_CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition',
                    category === option.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {option.label}
                  <span className="text-xs">{categoryCounts[option.value]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
            <div className="flex gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold text-foreground">Dica rápida</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Prefira imagens com fundo limpo, luz natural e enquadramento consistente.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section aria-labelledby="media-assets-title" className="min-w-0">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1 xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="media-search" className="sr-only">Buscar no acervo</label>
              <input
                id="media-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome do arquivo..."
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0" aria-label="Filtrar por categoria">
                <button
                  type="button"
                  onClick={() => setCategory('all')}
                  className={cn(
                    'h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition',
                    category === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  Todas
                </button>
                {MEDIA_CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategory(option.value)}
                    className={cn(
                      'h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition',
                      category === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
                Ordenar
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as MediaSort)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="media-assets-title" className="text-base font-bold text-foreground">Suas imagens</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {visibleAssets.length} {visibleAssets.length === 1 ? 'resultado' : 'resultados'}
            </p>
          </div>
        </div>

        {visibleAssets.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleAssets.map((asset) => (
              <MediaAssetCard
                key={asset.id}
                asset={asset}
                onRename={handleRename}
                onCategoryChange={handleCategoryChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ImageIcon className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-bold text-foreground">
              {assets.length === 0 ? 'Seu acervo ainda está vazio' : 'Nenhuma imagem encontrada'}
            </h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              {assets.length === 0
                ? 'Envie as primeiras imagens para criar uma biblioteca organizada para seus produtos.'
                : 'Tente outro termo de busca ou selecione uma categoria diferente.'}
            </p>
            {assets.length === 0 && total < MEDIA_LIBRARY_LIMIT && (
              <button
                type="button"
                onClick={openFilePicker}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                <Plus className="size-4" aria-hidden="true" />
                Adicionar imagens
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
