'use client';

import { useEffect, useRef, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function useDriverTour() {
  const driverRef = useRef<any>(null);

  useEffect(() => {
    driverRef.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.7,
      smoothScroll: true,
      steps: [
        {
          element: '#menu-header',
          popover: {
            title: '🍽️ Gestão de Cardápio',
            description: 'Aqui você gerencia TODOS os produtos do seu restaurante. Esta é a parte mais importante do sistema!',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#btn-novo-produto',
          popover: {
            title: '➕ Novo Produto',
            description: 'Clique aqui para criar um novo produto. Você pode definir nome, preço, foto, categoria, estoque e complementos.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#btn-cadastro-massa',
          popover: {
            title: '⚡ Cadastro em Massa',
            description: 'Atribua complementos a vários produtos de uma vez só. Economize tempo!',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#search-bar',
          popover: {
            title: '🔍 Busca Rápida',
            description: 'Pesquise produtos por nome ou código. Útil quando você tem muitos itens no cardápio.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#category-filters',
          popover: {
            title: '📂 Filtro por Categorias',
            description: 'Filtre os produtos por categoria (Lanches, Bebidas, Sobremesas, etc). Clique em "Todos" para ver tudo.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#filter-dropdown',
          popover: {
            title: '⚙️ Filtros Avançados',
            description: 'Filtre por disponibilidade (disponível/esgotado) e ordene por nome, preço ou data de criação.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#product-table',
          popover: {
            title: '📋 Tabela de Produtos',
            description: 'Aqui estão todos os seus produtos. Cada linha mostra nome, preço, categoria, estoque e disponibilidade.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#product-availability',
          popover: {
            title: '✅ Disponibilidade',
            description: 'Clique no botão para ativar/desativar um produto. Produtos desativados não aparecem no cardápio público.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#product-actions',
          popover: {
            title: '✏️ Ações do Produto',
            description: 'Edite, exclua ou configure estoque/insumos de cada produto. O ícone de estoque mostra quanto de cada ingrediente você tem.',
            side: 'top',
            align: 'end'
          }
        },
        {
          element: '#pagination',
          popover: {
            title: '📄 Paginação',
            description: 'Navegue entre as páginas para ver todos os produtos. Você pode ajustar quantos itens por página.',
            side: 'top',
            align: 'center'
          }
        },
        {
          popover: {
            title: '🎉 Pronto!',
            description: 'Agora você conhece a Gestão de Cardápio! Dica: use "Produtos em Slot" na aba ao lado para criar combos e montáveis (pizzas meio a meio, etc).',
            side: 'top',
            align: 'center'
          }
        }
      ],
      onNextClick: (element, step) => {
        driverRef.current.moveNext();
      },
      onPrevClick: (element, step) => {
        driverRef.current.movePrevious();
      },
      onCloseClick: () => {
        driverRef.current.destroy();
      }
    });

    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.drive();
    }
  }, []);

  return { startTour };
}
