import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/dashboard', '/onboarding']
const authRoutes = ['/login', '/register']

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
    const isAuthRoute = authRoutes.includes(path)

    const cookie = req.cookies.get('session')?.value
    const session = cookie ? await decrypt(cookie) : null

    console.log(`Middleware Path: ${path} | Session: ${!!session} | Onboarded: ${session?.onboarded}`);

    // 1. Se tentar acessar rota protegida sem sessão -> login
    if (isProtectedRoute && !session) {
        console.log('Middleware: Protecting route -> redirect to login');
        return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    // 2. Se logado e tentar acessar login/register -> dashboard ou onboarding
    if (isAuthRoute && session) {
        return session.onboarded
            ? NextResponse.redirect(new URL('/dashboard', req.nextUrl))
            : NextResponse.redirect(new URL('/onboarding', req.nextUrl))
    }

    // 3. Se logado mas NÃO onboarded -> obriga onboarding (exceto se já estiver lá)
    if (session && !session.onboarded && !path.startsWith('/onboarding')) {
        console.log('Middleware: Not onboarded -> redirect to onboarding');
        return NextResponse.redirect(new URL('/onboarding', req.nextUrl))
    }

    // 4. Se logado E já onboarded mas tenta voltar no onboarding -> dashboard
    if (session && session.onboarded && path.startsWith('/onboarding')) {
        console.log('Middleware: Already onboarded -> redirect to dashboard');
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
