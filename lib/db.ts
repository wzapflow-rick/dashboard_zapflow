import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // PostgreSQL self-hosted sem SSL
  // Configuracoes para evitar problemas de conexao em serverless
  max: 10, // Maximo de conexoes no pool
  min: 0,  // Minimo de conexoes
  idleTimeoutMillis: 30000, // Fecha conexoes inativas apos 30s
  connectionTimeoutMillis: 10000, // Timeout de conexao de 10s
  allowExitOnIdle: true, // Permite fechar em ambiente serverless
});

// Tratamento de erro do pool
pool.on('error', (err) => {
  console.error('[DB Pool] Erro inesperado no cliente:', err);
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
