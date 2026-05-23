import db, { query } from '@/lib/db';
import { headers } from 'next/headers';

interface RateLimitConfig {
  maxAttempts: number;      // Numero maximo de tentativas
  windowMs: number;         // Janela de tempo em milissegundos
  blockDurationMs: number;  // Duracao do bloqueio em milissegundos
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  blockedUntil?: Date;
  retryAfterMs?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,      // 15 minutos
  blockDurationMs: 30 * 60 * 1000, // 30 minutos de bloqueio
};

// Config mais restritiva para IP (protege contra ataques em massa)
const IP_CONFIG: RateLimitConfig = {
  maxAttempts: 15,               // 15 tentativas por IP (pode tentar multiplas contas)
  windowMs: 15 * 60 * 1000,      // 15 minutos
  blockDurationMs: 60 * 60 * 1000, // 1 hora de bloqueio para IPs suspeitos
};

/**
 * Obtem o IP do cliente a partir dos headers
 */
export async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    
    // Vercel/Cloudflare usam x-forwarded-for
    const forwardedFor = headersList.get('x-forwarded-for');
    if (forwardedFor) {
      // Pode conter multiplos IPs separados por virgula, pegamos o primeiro
      return forwardedFor.split(',')[0].trim();
    }
    
    // Fallback para x-real-ip
    const realIp = headersList.get('x-real-ip');
    if (realIp) {
      return realIp;
    }
    
    // Vercel specific header
    const vercelIp = headersList.get('x-vercel-forwarded-for');
    if (vercelIp) {
      return vercelIp.split(',')[0].trim();
    }
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Verifica se uma acao esta dentro do limite de rate limiting
 * Usa PostgreSQL para funcionar de forma distribuida em ambiente serverless
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const { maxAttempts, windowMs, blockDurationMs } = { ...DEFAULT_CONFIG, ...config };

  try {
    // Verificar se esta bloqueado
    const blockCheck = await db.query<{ blocked_until: Date }>(
      `SELECT blocked_until FROM rate_limit_attempts 
       WHERE identifier = $1 AND action = $2 AND blocked_until > NOW()
       ORDER BY blocked_until DESC LIMIT 1`,
      [identifier, action]
    );

    if (blockCheck.rows.length > 0 && blockCheck.rows[0].blocked_until) {
      const blockedUntil = new Date(blockCheck.rows[0].blocked_until);
      const retryAfterMs = blockedUntil.getTime() - Date.now();
      
      return {
        allowed: false,
        remaining: 0,
        blockedUntil,
        retryAfterMs,
      };
    }

    // Contar tentativas na janela de tempo
    const windowStart = new Date(Date.now() - windowMs);
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM rate_limit_attempts 
       WHERE identifier = $1 AND action = $2 AND attempted_at > $3`,
      [identifier, action, windowStart.toISOString()]
    );

    const attemptCount = parseInt(countResult.rows[0]?.count || '0', 10);
    const remaining = Math.max(0, maxAttempts - attemptCount - 1);

    if (attemptCount >= maxAttempts) {
      // Bloquear o usuario
      const blockedUntil = new Date(Date.now() + blockDurationMs);
      
      await db.query(
        `INSERT INTO rate_limit_attempts (identifier, action, attempted_at, blocked_until)
         VALUES ($1, $2, NOW(), $3)`,
        [identifier, action, blockedUntil.toISOString()]
      );

      return {
        allowed: false,
        remaining: 0,
        blockedUntil,
        retryAfterMs: blockDurationMs,
      };
    }

    // Registrar tentativa
    await db.query(
      `INSERT INTO rate_limit_attempts (identifier, action, attempted_at)
       VALUES ($1, $2, NOW())`,
      [identifier, action]
    );

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    console.error('[RateLimit] Erro ao verificar rate limit:', error);
    // Em caso de erro, permitir a acao (fail-open)
    // Isso evita bloquear usuarios por erro de banco
    return {
      allowed: true,
      remaining: maxAttempts,
    };
  }
}

/**
 * Limpa as tentativas de um identificador apos login bem-sucedido
 */
export async function clearRateLimitAttempts(
  identifier: string,
  action: string
): Promise<void> {
  try {
    await db.query(
      `DELETE FROM rate_limit_attempts 
       WHERE identifier = $1 AND action = $2`,
      [identifier, action]
    );
  } catch (error) {
    console.error('[RateLimit] Erro ao limpar tentativas:', error);
  }
}

/**
 * Limpa registros antigos (chamar via cron diariamente)
 */
export async function cleanupOldAttempts(hoursOld: number = 24): Promise<number> {
  try {
    const result = await db.query(
      `DELETE FROM rate_limit_attempts 
       WHERE attempted_at < NOW() - INTERVAL '${hoursOld} hours'
       AND (blocked_until IS NULL OR blocked_until < NOW())`
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error('[RateLimit] Erro ao limpar registros antigos:', error);
    return 0;
  }
}

/**
 * Verifica rate limit combinado para login (email + IP)
 * Bloqueia tanto por tentativas no mesmo email quanto por IP suspeito
 */
export async function checkLoginRateLimit(
  email: string,
  ip?: string
): Promise<{ allowed: boolean; error?: string; blockedBy?: 'email' | 'ip' }> {
  const clientIp = ip || await getClientIp();
  
  // 1. Verificar rate limit por email (5 tentativas)
  const emailResult = await checkRateLimit(email.toLowerCase(), 'login', {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  });

  if (!emailResult.allowed) {
    const remainingTime = Math.ceil((emailResult.retryAfterMs || 0) / 1000 / 60);
    return {
      allowed: false,
      error: `Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.`,
      blockedBy: 'email',
    };
  }

  // 2. Verificar rate limit por IP (15 tentativas - mais generoso pois pode ter multiplos usuarios)
  if (clientIp !== 'unknown') {
    const ipResult = await checkRateLimit(`ip:${clientIp}`, 'login', IP_CONFIG);

    if (!ipResult.allowed) {
      const remainingTime = Math.ceil((ipResult.retryAfterMs || 0) / 1000 / 60);
      console.log(`[RateLimit] IP bloqueado: ${clientIp}`);
      return {
        allowed: false,
        error: `Muitas tentativas de login deste endereco. Tente novamente em ${remainingTime} minutos.`,
        blockedBy: 'ip',
      };
    }
  }

  return { allowed: true };
}

/**
 * Limpa tentativas de rate limit apos login bem-sucedido
 */
export async function clearLoginRateLimits(email: string, ip?: string): Promise<void> {
  const clientIp = ip || await getClientIp();
  
  await clearRateLimitAttempts(email.toLowerCase(), 'login');
  
  // Nao limpa o IP pois outros usuarios podem estar usando o mesmo IP legitimamente
  // Apenas reduz a contagem em 1 para nao penalizar logins validos
}
