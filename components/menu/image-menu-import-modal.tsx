'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  ArrowLeft,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  extractMenuProductsFromImage,
  getCompanyMenuData,
  saveMenuProductsForCompany,
  uploadCompanyProductImage,
} from '@/app/actions/import-menu-from-image';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { parseCurrency } from '@/lib/utils';
import { isValidImageFile, processImage } from '@/lib/image-utils';

const ProductFormModal = dynamic(() => import('@/components/menu/product-form-modal'), { ssr: false });

type MenuProduct = {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  categoria_id: number | null;
  categoria: string;
  disponivel: boolean;
  imagem: string;
  tag?: string | null;
  tamanhos?: unknown;
  tamanhos_json?: unknown;
  recomendacoes?: unknown;
};

type MenuCategory = {
  id: number;
  nome: string;
  empresa_id: number;
};

type ExtractedProduct = {
  nome: string;
  descricao: string | null;
  preco: number | null;
  categoria: string | null;
};

type DraftRow = ExtractedProduct & {
  id: string;
  matchedProductId?: number;
  matchedProductName?: string;
  precoText: string;
  selecionado: boolean;
};

type EditingProduct = MenuProduct & { precoText: string };

interface ImageMenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: number;
  empresaNome: string;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [activeTab, setActiveTab] = useState<'produtos' | 'foto' | 'revisao'>('produtos');
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoadingMenu(true);
    getCompanyMenuData(empresaId)
      .then((data) => {
        if (!active) return;
        setProducts(data.products as MenuProduct[]);
        setCategories(data.categories as MenuCategory[]);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : 'Não foi possível carregar o cardápio.');
      })
      .finally(() => { if (active) setIsLoadingMenu(false); });
    return () => { active = false; };
  }, [empresaId, isOpen]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const resetPhoto = () => {
    setImage(null);
    setPreview(null);
    setRows([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (isReading || isSaving) return;
    resetPhoto();
    setEditingProduct(null);
    setActiveTab('produtos');
    onClose();
  };

  const refreshMenu = async () => {
    const data = await getCompanyMenuData(empresaId);
    setProducts(data.products as MenuProduct[]);
    setCategories(data.categories as MenuCategory[]);
  };

  const handleImageChange = (file?: File) => {
    if (!file) return;
    if (!isValidImageFile(file)) {
      toast.error('Use uma imagem JPG, PNG ou WebP de até 10 MB.');
      return;
    }
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
      const extracted = await extractMenuProductsFromImage(formData);
      const matchedIds = new Set<number>();
      setRows(extracted.map((product) => {
        const match = products.find((existing) =>
          !matchedIds.has(existing.id) && normalizeName(existing.nome) === normalizeName(product.nome),
        );
        if (match) matchedIds.add(match.id);
        return {
          ...product,
          id: crypto.randomUUID(),
          matchedProductId: match?.id,
          matchedProductName: match?.nome,
          precoText: product.preco === null ? '' : String(product.preco),
          selecionado: true,
        };
      }));
      setActiveTab('revisao');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler essa imagem.');
    } finally {
      setIsReading(false);
    }
  };

  const updateRow = (id: string, changes: Partial<DraftRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  };

  const saveSelectedRows = async () => {
    const selected = rows.filter((row) => row.selecionado);
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um produto para salvar.');
      return;
    }

    setIsSaving(true);
    const payload = selected.map((row) => {
      const priceText = row.precoText.trim();
      const price = priceText === '' ? null : Number(priceText.replace(',', '.'));
      return {
        id: row.matchedProductId,
        nome: row.nome.trim(),
        descricao: row.descricao?.trim() ?? null,
        preco: price !== null && Number.isFinite(price) ? price : null,
        categoria: row.categoria?.trim() || null,
      };
    });

    try {
      const result = await saveMenuProductsForCompany(empresaId, payload);
      const savedCount = result.created + result.updated;
      if (savedCount > 0 && !result.success) {
        const savedIds = new Set(selected.slice(0, savedCount).map((row) => row.id));
        setRows((current) => current.filter((row) => !savedIds.has(row.id)));
      }
      if (!result.success) {
        toast.error(
          savedCount > 0
            ? `${result.error} Revise os itens restantes antes de tentar novamente.`
            : `Não foi possível salvar: ${result.error}`,
        );
        await refreshMenu();
        return;
      }

      await refreshMenu();
      toast.success(
        `${result.updated} produto(s) atualizado(s) e ${result.created} novo(s) adicionado(s) para ${empresaNome}.` +
        (result.withoutPrice > 0 ? ` ${result.withoutPrice} sem preço ficaram indisponíveis.` : ''),
      );
      resetPhoto();
      setActiveTab('produtos');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar os produtos.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveManualEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProduct) return;
    const price = Number(editingProduct.precoText.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Informe um preço válido.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveMenuProductsForCompany(empresaId, [{
        id: editingProduct.id,
        nome: editingProduct.nome.trim(),
        descricao: editingProduct.descricao,
        preco: price,
        categoria: editingProduct.categoria || null,
        disponivel: editingProduct.disponivel,
      }]);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await refreshMenu();
      setEditingProduct(null);
      toast.success('Produto atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o produto.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (product: MenuProduct) => {
    setEditingProduct({ ...product, precoText: String(product.preco) });
  };

  const filteredProducts = products.filter((product) => {
    const query = normalizeName(search);
    return !query || normalizeName(`${product.nome} ${product.categoria} ${product.descricao}`).includes(query);
  });
  const selectedCount = rows.filter((row) => row.selecionado).length;
  const newCount = rows.filter((row) => !row.matchedProductId).length;
  const updateCount = rows.length - newCount;

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={close}
      title={`Cardápio • ${empresaNome}`}
      size="full"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab('produtos')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${activeTab === 'produtos' ? 'bg-white text-slate-900 shadow dark:bg-zinc-800 dark:text-white' : 'text-slate-500'}`}
          >
            Produtos ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(rows.length > 0 ? 'revisao' : 'foto')}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${activeTab !== 'produtos' ? 'bg-white text-slate-900 shadow dark:bg-zinc-800 dark:text-white' : 'text-slate-500'}`}
          >
            <ImagePlus className="size-4" /> Foto do cardápio
          </button>
        </div>

        {activeTab === 'produtos' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto ou categoria..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setActiveTab('foto')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-brand-hover"
              >
                <ImagePlus className="size-4" /> Atualizar pela foto
              </button>
            </div>

            {isLoadingMenu ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" /> Carregando cardápio…
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-zinc-700">
                <p className="font-semibold text-slate-800 dark:text-white">Esta empresa ainda não tem produtos.</p>
                <p className="mt-1 text-sm text-slate-500">Envie a foto do cardápio para cadastrar os itens.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('foto')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-slate-950"
                >
                  <ImagePlus className="size-4" /> Importar foto
                </button>
              </div>
            ) : (
              <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                    {editingProduct?.id === product.id ? (
                      <form onSubmit={saveManualEdit} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            Nome
                            <input
                              required
                              value={editingProduct.nome}
                              onChange={(event) => setEditingProduct({ ...editingProduct, nome: event.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            Preço (R$)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={editingProduct.precoText}
                              onChange={(event) => setEditingProduct({ ...editingProduct, precoText: event.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            Categoria
                            <input
                              value={editingProduct.categoria}
                              onChange={(event) => setEditingProduct({ ...editingProduct, categoria: event.target.value })}
                              list="menu-import-categories"
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                          </label>
                          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={editingProduct.disponivel}
                              onChange={(event) => setEditingProduct({ ...editingProduct, disponivel: event.target.checked })}
                              className="size-4 accent-primary"
                            />
                            Disponível no cardápio
                          </label>
                          <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 sm:col-span-2">
                            Descrição
                            <textarea
                              value={editingProduct.descricao}
                              onChange={(event) => setEditingProduct({ ...editingProduct, descricao: event.target.value })}
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingProduct(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-zinc-700 dark:text-zinc-200">Cancelar</button>
                          <button type="submit" disabled={isSaving} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{isSaving ? 'Salvando…' : 'Salvar produto'}</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{product.nome}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${product.disponivel ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800'}`}>
                              {product.disponivel ? 'Disponível' : 'Indisponível'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                            {product.categoria || 'Sem categoria'} · R$ {product.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {product.descricao && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">{product.descricao}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditing(product)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <Pencil className="size-3.5" /> Editar
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {filteredProducts.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>}
              </div>
            )}
            <datalist id="menu-import-categories">
              {categories.map((category) => <option key={category.id} value={category.nome} />)}
            </datalist>
          </div>
        )}

        {activeTab === 'foto' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-xs leading-relaxed text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Itens com o mesmo nome serão propostos para atualização. Itens que não aparecem na foto continuarão no cardápio.
            </div>

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
                className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-primary hover:bg-primary/5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="size-6" /></span>
                <span className="font-semibold text-slate-800 dark:text-zinc-100">Escolher foto do cardápio</span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">JPG, PNG ou WebP • até 10 MB</span>
              </button>
            )}

            <button
              type="button"
              onClick={extract}
              disabled={!image || isReading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isReading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {isReading ? 'Lendo produtos da foto…' : 'Ler e comparar com o cardápio'}
            </button>
          </div>
        )}

        {activeTab === 'revisao' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Revise as alterações</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {updateCount} atualização(ões) · {newCount} produto(s) novo(s) · {selectedCount} selecionado(s)
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

            <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
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
                    <span className="text-xs font-bold text-slate-400">Item {index + 1}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.matchedProductId ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}>
                      {row.matchedProductId ? `Atualiza: ${row.matchedProductName}` : 'Novo produto'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                      className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      aria-label={`Remover ${row.nome} da importação`}
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
                        placeholder={row.matchedProductId ? 'Manter preço atual' : 'Não identificado'}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      Categoria
                      <input
                        value={row.categoria || ''}
                        onChange={(event) => updateRow(row.id, { categoria: event.target.value || null })}
                        placeholder={row.matchedProductId ? 'Manter categoria atual' : 'Sem categoria'}
                        list="menu-import-categories"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 sm:col-span-2">
                      Descrição
                      <textarea
                        value={row.descricao || ''}
                        onChange={(event) => updateRow(row.id, { descricao: event.target.value || null })}
                        placeholder={row.matchedProductId ? 'Manter descrição atual se não alterar' : ''}
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

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('foto')}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft className="size-4" /> Voltar à foto
              </button>
              <button
                type="button"
                onClick={saveSelectedRows}
                disabled={isSaving || selectedCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {isSaving ? 'Salvando…' : `Salvar ${selectedCount} alterações`}
              </button>
            </div>
          </div>
        )}
      </div>
    </MobileDrawer>
  );
}
