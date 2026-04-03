'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  getCategories,
  updateProductAvailability,
  deleteProduct,
  upsertProduct,
  upsertCategory,
  deleteCategory,
  type Category
} from '@/app/actions/products';
import { getInsumos, getReceitaDoProduto, getTodasReceitas, type Insumo } from '@/app/actions/insumos';
import { toast } from 'sonner';

export function useMenuData() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [insumosList, setInsumosList] = useState<Insumo[]>([]);
  const [productRecipes, setProductRecipes] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData, insumosData, receitasData] = await Promise.all([
        getProducts(),
        getCategories(),
        getInsumos(),
        getTodasReceitas()
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setInsumosList(insumosData);
      setProductRecipes(receitasData);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do banco de dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    import('@/app/actions/auth').then(({ getMe }) => {
      getMe().then(setUser);
    });
    fetchData();
  }, [fetchData]);

  const toggleDisponibilidade = async (produtoId: number | string, statusAtual: boolean) => {
    const novoStatus = !statusAtual;
    const previousProducts = [...products];
    setProducts(products.map(p => p.id === produtoId ? { ...p, disponivel: novoStatus } : p));

    try {
      await updateProductAvailability(produtoId, novoStatus);
      toast.success(novoStatus ? 'Produto ativado com sucesso!' : 'Produto esgotado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar disponibilidade:', error);
      setProducts(previousProducts);
      toast.error('Erro ao atualizar disponibilidade no servidor.');
    }
  };

  const handleDelete = async (id: number | string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteProduct(id);
        setProducts(products.filter(p => p.id !== id));
        toast.success('Produto excluído com sucesso!');
        const categoriesData = await getCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
        toast.error('Erro ao excluir produto no servidor.');
      }
    }
  };

  const handleSaveCategory = async (data: Partial<Category>) => {
    try {
      const saved = await upsertCategory(data);
      if (data.id) {
        setCategories(categories.map(c => c.id === data.id ? saved as Category : c));
        toast.success('Categoria atualizada!');
      } else {
        setCategories([...categories, saved as Category]);
        toast.success('Categoria criada!');
      }
      return saved;
    } catch (error) {
      toast.error('Erro ao salvar categoria.');
      throw error;
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta categoria? Os produtos vinculados perderão a referência.')) {
      try {
        await deleteCategory(id);
        setCategories(categories.filter(c => c.id !== id));
        toast.success('Categoria excluída com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir:', error);
        toast.error('Erro ao excluir a categoria.');
      }
    }
  };

  const getCategoryName = (id: number) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.nome : 'Sem Categoria';
  };

  return {
    products,
    setProducts,
    categories,
    setCategories,
    user,
    loading,
    insumosList,
    productRecipes,
    fetchData,
    toggleDisponibilidade,
    handleDelete,
    handleSaveCategory,
    handleDeleteCategory,
    getCategoryName
  };
}
