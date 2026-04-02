'use client';

import { useState, useMemo } from 'react';

interface Product {
  id: number | string;
  nome?: string;
  categoria_id?: number;
  disponivel?: boolean;
  preco?: number;
}

export function useMenuFilters(products: Product[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const itemsPerPage = 5;

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const name = p.nome || '';
      const id = String(p.id || '');
      const catId = p.categoria_id || 0;

      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategoryId === 0 || catId === selectedCategoryId;
      const matchesAvailability = availabilityFilter === 'all' ? true : availabilityFilter === 'available' ? p.disponivel : !p.disponivel;

      return matchesSearch && matchesCategory && matchesAvailability;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return (a.nome || '').localeCompare(b.nome || '');
        case 'name_desc': return (b.nome || '').localeCompare(a.nome || '');
        case 'price_asc': return (Number(a.preco) || 0) - (Number(b.preco) || 0);
        case 'price_desc': return (Number(b.preco) || 0) - (Number(a.preco) || 0);
        case 'id_asc': return (Number(a.id) || 0) - (Number(b.id) || 0);
        case 'id_desc':
        case 'recent':
        default: return (Number(b.id) || 0) - (Number(a.id) || 0);
      }
    });

    return result;
  }, [products, searchQuery, selectedCategoryId, availabilityFilter, sortBy]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId(0);
    setCurrentPage(1);
    setAvailabilityFilter('all');
    setSortBy('recent');
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    currentPage,
    setCurrentPage,
    isFilterOpen,
    setIsFilterOpen,
    sortBy,
    setSortBy,
    availabilityFilter,
    setAvailabilityFilter,
    itemsPerPage,
    filteredProducts,
    paginatedProducts,
    totalPages,
    resetFilters
  };
}
