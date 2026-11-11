import type { Pool } from 'pg';
import { getPool } from '@/lib/postgres';

// Reaproveita o MESMO pool singleton de lib/postgres.ts. Antes este arquivo
// criava um segundo Pool independente, dobrando as conexões abertas contra o
// banco. Agora ambos compartilham uma única instância por processo.
// O pool é resolvido sob demanda (Proxy) para não exigir DATABASE_URL durante
// o build da Vercel, que importa os módulos ao coletar dados das páginas.
const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

// Funcao helper para queries com retry
export async function query(text: string, params?: any[], retries = 2): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error: any) {
      console.error(`[DB] Query falhou (tentativa ${attempt}/${retries}):`, error.message);
      
      // Se for erro de conexao e ainda temos retries, tenta novamente
      if (attempt < retries && (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('timeout')
      )) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Espera progressiva
        continue;
      }
      
      throw error;
    }
  }
}

export default pool;
