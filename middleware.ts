import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from './lib/session-server'

const protectedRoutes = ['/dashboard', '/onboarding']
const authRoutes = ['/login', '/register']

const adminOnlyRoutes = ['/dashboard/users', '/dashboard/settings', '/dashboard/subscription', '/dashboard/testes']

const roleRoutes = {
    admin: ['/dashboard'],
    gerente: ['/dashboard', '/dashboard/menu', '/dashboard/expedition', '/dashboard/customers', '/dashboard/ratings', '/dashboard/acertos', '/dashboard/reports'],
    atendente: ['/dashboard', '/dashboard/expedition', '/dashboard/customers'],
    cozinheiro: ['/dashboard/expedition']
}

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
    const isAuthRoute = authRoutes.some(route => path.startsWith(route))

    const session = await getSession()

    // 1. Se não logado e tentar acessar rota protegida -> login
    if (isProtectedRoute && !session) {
        const loginUrl = new URL('/login', req.nextUrl)
        loginUrl.searchParams.set('from', path)
        return NextResponse.redirect(loginUrl)
    }

    // 2. Se logado e tentar acessar login/register -> dashboard ou onboarding
    if (isAuthRoute && session) {
        return session.onboarded
            ? NextResponse.redirect(new URL(session.role === 'cozinheiro' ? '/dashboard/expedition' : '/dashboard', req.nextUrl))
            : NextResponse.redirect(new URL('/onboarding', req.nextUrl))
    }

    // 3. Se logado mas NÃO onboarded -> obriga onboarding (exceto se já estiver lá)
    if (session && !session.onboarded && !path.startsWith('/onboarding')) {
        // Rotas que não precisam de onboarding
        const publicRoutes = ['/api', '/_next', '/favicon.ico']
        const isPublic = publicRoutes.some(route => path.startsWith(route))
        
        if (!isPublic && isProtectedRoute) {
            return NextResponse.redirect(new URL('/onboarding', req.nextUrl))
        }
    }

    // 4. Controle de permissões por Role
    if (session && session.role !== 'admin') {
        const allowed = roleRoutes[session.role as keyof typeof roleRoutes] || []
        
        // Verifica se a rota atual é restrita a admin
        const isAdminRoute = adminOnlyRoutes.some(route => path.startsWith(route));
        if (isAdminRoute) {
            const fallback = allowed.length > 0 ? allowed[0] : '/dashboard/expedition';
            return NextResponse.redirect(new URL(fallback, req.nextUrl))
        }

        // Verifica se a rota está na lista de permissões do role
        const isAllowedRoute = allowed.some(route => path.startsWith(route));
        const isDashboardHome = path === '/dashboard' || path === '/dashboard/';
        
        // Se for cozinheiro e tentar acessar a home do dashboard, manda direto pra expedição
        if (session.role === 'cozinheiro' && isDashboardHome) {
            return NextResponse.redirect(new URL('/dashboard/expedition', req.nextUrl))
        }

        if (!isAllowedRoute) {
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
