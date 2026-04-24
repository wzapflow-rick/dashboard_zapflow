import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/dashboard', '/onboarding']
const authRoutes = ['/login', '/register']

// Rotas restritas por role (apenas admin e gerente podem acessar)
const adminOnlyRoutes = [
    '/dashboard/settings',
    '/dashboard/subscription',
    '/dashboard/users',
    '/dashboard/growth',
    '/dashboard/testes',
    '/dashboard/insumos',
    '/dashboard/categories',
    '/dashboard/complements',
]

// Rotas acessíveis por gerentes (além do dashboard base)
const gerenteRoutes = [
    '/dashboard/expedition',
    '/dashboard/customers',
    '/dashboard/ratings',
    '/dashboard/acertos',
]

// Rotas acessíveis por atendentes (além do dashboard base)
const atendenteRoutes = [
    '/dashboard/expedition',
    '/dashboard/customers',
]

// Rotas acessíveis por cozinheiros
const cozinheiroRoutes = [
    '/dashboard/expedition',
]

const allowedRoutesByRole: Record<string, string[]> = {
    admin: [], // admin acessa tudo
    gerente: gerenteRoutes,
    atendente: atendenteRoutes,
    cozinheiro: cozinheiroRoutes,
}

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    
    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        const proto = req.headers.get('x-forwarded-proto');
        if (proto && proto !== 'https') {
            const httpsUrl = new URL(req.url);
            httpsUrl.protocol = 'https';
            return NextResponse.redirect(httpsUrl);
        }
    }

    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
    const isAuthRoute = authRoutes.includes(path)

    const cookie = req.cookies.get('session')?.value
    const session = cookie ? await decrypt(cookie) : null

    // Remove console.log in production for security
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Middleware Path: ${path} | Session: ${!!session} | Role: ${session?.role} | Onboarded: ${session?.onboarded}`);
    }

    // 1. Se tentar acessar rota protegida sem sessão -> login
    if (isProtectedRoute && !session) {
        return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    // 2. Se logado e tentar acessar login/register -> dashboard ou onboarding
    if (isAuthRoute && session) {
        return session.onboarded
            ? NextResponse.redirect(new URL(session.role === 'cozinheiro' ? '/dashboard/expedition' : '/dashboard', req.nextUrl))
            : NextResponse.redirect(new URL('/onboarding', req.nextUrl))
    }

    // 3. Se logado mas NÃO onboarded -> obriga onboarding (exceto se já estiver lá)
    if (session && !session.onboarded && !path.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/onboarding', req.nextUrl))
    }

    // 4. Se logado E já onboarded mas tenta voltar no onboarding -> dashboard
    if (session && session.onboarded && path.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    // 5. Proteção por role (apenas para usuários da tabela 'usuarios', não admins da empresa)
    if (session && session.source === 'usuario' && !['admin', 'gerente'].includes(session.role)) {
        const role = session.role as string;
        const allowed = allowedRoutesByRole[role] || [];
        
        // Verifica se a rota atual é restrita a admin
        const isAdminRoute = adminOnlyRoutes.some(route => path.startsWith(route));
        if (isAdminRoute) {
            return NextResponse.redirect(new URL('/dashboard/expedition', req.nextUrl))
        }

        // Verifica se a rota está na lista de permissões do role
        const isAllowedRoute = allowed.some(route => path.startsWith(route));
        const isDashboardHome = path === '/dashboard' || path === '/dashboard/';
        
        if (!isAllowedRoute && (isDashboardHome || !isAllowedRoute)) {
            // Redireciona para a primeira rota permitida do role
            const fallback = allowed.length > 0 ? allowed[0] : '/dashboard/expedition';
            return NextResponse.redirect(new URL(fallback, req.nextUrl))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
