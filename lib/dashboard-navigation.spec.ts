import { getDashboardNavigation, isDashboardRouteActive } from './dashboard-navigation';

function itemNames(items: ReturnType<typeof getDashboardNavigation>['main']) {
  return items.map((item) => item.name);
}

describe('getDashboardNavigation', () => {
  it('keeps all admin routes except inventory when inventory control is disabled', () => {
    const { main, management } = getDashboardNavigation({ role: 'admin', controle_estoque: false });

    expect(itemNames(main)).toEqual([
      'Visão Geral',
      'Cardápio',
      'Expedição',
      'Mesas',
      'Clientes',
      'Marketing',
    ]);
    expect(itemNames(management)).toEqual([
      'Avaliações',
      'Usuários',
      'Acertos',
      'Relatórios',
      'Configurações',
      'Assinatura',
    ]);
  });

  it('shows inventory to an admin with inventory control enabled', () => {
    const { main } = getDashboardNavigation({ role: 'admin', controle_estoque: true });

    expect(itemNames(main)).toContain('Insumos');
  });

  it('keeps only manager routes for a manager', () => {
    const { main, management } = getDashboardNavigation({ role: 'gerente', controle_estoque: true });

    expect(itemNames(main)).toEqual(['Visão Geral', 'Expedição', 'Mesas', 'Clientes']);
    expect(itemNames(management)).toEqual(['Avaliações', 'Acertos', 'Relatórios']);
  });

  it('keeps only service routes for an attendant', () => {
    const { main, management } = getDashboardNavigation({ role: 'atendente' });

    expect(itemNames(main)).toEqual(['Expedição', 'Mesas', 'Clientes']);
    expect(management).toEqual([]);
  });
});

describe('isDashboardRouteActive', () => {
  it('matches exact routes, nested routes, and links with query strings', () => {
    expect(isDashboardRouteActive('/dashboard/menu', '/dashboard/menu')).toBe(true);
    expect(isDashboardRouteActive('/dashboard/menu/novo', '/dashboard/menu')).toBe(true);
    expect(isDashboardRouteActive('/dashboard/marketing', '/dashboard/marketing?tab=divulgacao')).toBe(true);
  });

  it('does not mark the dashboard root active on every dashboard route', () => {
    expect(isDashboardRouteActive('/dashboard/menu', '/dashboard')).toBe(false);
  });
});
