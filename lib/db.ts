import { getPool } from '@/lib/postgres';

// Reaproveita o MESMO pool singleton de lib/postgres.ts. Antes este arquivo
// criava um segundo Pool independente, dobrando as conexões abertas contra o
// banco. Agora ambos compartilham uma única instância por processo.
const pool = getPool();

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
