'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ImagePlus, LoaderCircle, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  extractMenuProductsFromImage,
  getCompanyMenuCategories,
  saveMenuProductsForCompany,
} from '@/app/actions/import-menu-from-image';
import { type Category } from '@/app/actions/products';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { isValidImageFile, processImage } from '@/lib/image-utils';

type MenuProductDraft = {
  nome: string;
  descricao: string | null;
  preco: number | null;
  categoria: string | null;
};

type DraftRow = MenuProductDraft & { id: string; precoText: string; selecionado: boolean };

interface ImageMenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: number;
  empresaNome: string;
}

function formatPrice(value: number | null): string {
  return value === null ? '' : String(value);
}

export default function ImageMenuImportModal({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
}: ImageMenuImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoadingCategories(true);
    getCompanyMenuCategories(empresaId)
      .then((result) => { if (active) setCategories(result); })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as categorias.');
      })
      .finally(() => { if (active) setIsLoadingCategories(false); });
    return () => { active = false; };
  }, [empresaId, isOpen]);

  const reset = () => {
    setImage(null);
    setPreview(null);
    setRows([]);
    setCategories([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (isReading || isSaving) return;
    reset();
    onClose();
  };

  const handleImageChange = (file?: File) => {
    if (!file) return;
    if (!isValidImageFile(file)) {
      toast.error('Use uma imagem JPG, PNG ou WebP de até 10 MB.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setRows([]);
  };

  const extract = async () => {
    if (!image) {
      toast.error('Escolha uma foto do cardápio primeiro.');
      return;
    }

    setIsReading(true);
    try {
      let compressed = await processImage(image, {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.72,
        format: 'jpeg',
      });
      if (compressed.size > 750 * 1024) {
        compressed = await processImage(image, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.55,
          format: 'jpeg',
        });
      }
      if (compressed.size > 750 * 1024) {
        throw new Error('A imagem ficou grande demais. Tente uma foto menor.');
      }

      const formData = new FormData();
      formData.append('image', compressed);
      const products = await extractMenuProductsFromImage(formData);
      setRows(products.map((product) => ({
        ...product,
        id: crypto.randomUUID(),
        precoText: formatPrice(product.preco),
        selecionado: true,
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler essa imagem.');
    } finally {
      setIsReading(false);
    }
  };

  const updateRow = (id: string, changes: Partial<DraftRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  };

  const saveSelected = async () => {
    const selected = rows.filter((row) => row.selecionado);
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um produto para cadastrar.');
      return;
    }

    setIsSaving(true);
    const products = selected.map((row) => {
      const price = Number(row.precoText.replace(',', '.'));
      return {
        nome: row.nome.trim(),
        descricao: row.descricao?.trim() || '',
        preco: Number.isFinite(price) && price > 0 ? price : 0,
        categoria: row.categoria?.trim() || null,
      };
    });

    try {
      const result = await saveMenuProductsForCompany(empresaId, products);
      if (result.created > 0) {
        const savedIds = new Set(selected.slice(0, result.created).map((row) => row.id));
        setRows((current) => current.filter((row) => !savedIds.has(row.id)));
      }
      if (!result.success) {
        toast.error(
          result.created > 0
            ? `${result.error} Revise os itens restantes antes de tentar novamente.`
            : `Não foi possível cadastrar os produtos: ${result.error}`,
        );
        return;
      }

      toast.success(
        result.withoutPrice > 0
          ? `${result.created} produto(s) cadastrados para ${empresaNome}; ${result.withoutPrice} sem preço ficaram indisponíveis para revisão.`
          : `${result.created} produto(s) cadastrados para ${empresaNome}.`,
      );
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cadastrar os produtos.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = rows.filter((row) => row.selecionado).length;

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={close}
      title={`Importar cardápio • ${empresaNome}`}
      size="full"
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Envie uma foto nítida do cardápio de <strong>{empresaNome}</strong>. A IA preenche os produtos para você revisar antes de cadastrar.
        </p>

        {rows.length === 0 ? (
          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => handleImageChange(event.target.files?.[0])}
            />

            {preview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900">
                <img src={preview} alt="Prévia da foto do cardápio" className="max-h-64 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-zinc-800 dark:text-white"
                >
                  <ImagePlus className="size-4" /> Trocar foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-primary hover:bg-primary/5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Upload className="size-6" />
                </span>
                <span className="font-semibold text-slate-800 dark:text-zinc-100">Escolher foto do cardápio</span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">JPG, PNG ou WebP • até 10 MB</span>
              </button>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Confira nomes e preços antes de salvar. Itens sem preço identificado serão cadastrados indisponíveis.
            </div>

            <button
              type="button"
              onClick={extract}
              disabled={!image || isReading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isReading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {isReading ? 'Lendo produtos da foto…' : 'Ler produtos da foto'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Revise os produtos encontrados</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {selectedCount} de {rows.length} selecionado(s) • categorias novas serão criadas ao salvar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRows((current) => current.map((row) => ({ ...row, selecionado: !current.every((item) => item.selecionado) })))}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {rows.every((row) => row.selecionado) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>

            <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
              {rows.map((row, index) => (
                <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="mb-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={row.selecionado}
                      onChange={(event) => updateRow(row.id, { selecionado: event.target.checked })}
                      aria-label={`Selecionar ${row.nome}`}
                      className="size-4 accent-primary"
                    />
                    <span className="text-xs font-bold text-slate-400">Produto {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                      className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      aria-label={`Remover ${row.nome}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      Nome
                      <input
                        value={row.nome}
                        onChange={(event) => updateRow(row.id, { nome: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      Preço (R$)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.precoText}
                        onChange={(event) => updateRow(row.id, { precoText: event.target.value })}
                        placeholder="Não identificado"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      Categoria
                      <input
                        value={row.categoria || ''}
                        onChange={(event) => updateRow(row.id, { categoria: event.target.value || null })}
                        placeholder="Sem categoria"
                        list="menu-import-categories"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 sm:col-span-2">
                      Descrição
                      <textarea
                        value={row.descricao || ''}
                        onChange={(event) => updateRow(row.id, { descricao: event.target.value || null })}
                        rows={2}
                        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>

            <datalist id="menu-import-categories">
              {categories.map((category) => <option key={category.id} value={category.nome} />)}
            </datalist>
            {isLoadingCategories && <p className="text-xs text-slate-500">Carregando categorias da empresa…</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setRows([])}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft className="size-4" /> Escolher outra foto
              </button>
              <button
                type="button"
                onClick={saveSelected}
                disabled={isSaving || selectedCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {isSaving ? 'Cadastrando…' : `Cadastrar ${selectedCount} produto(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </MobileDrawer>
  );
}
