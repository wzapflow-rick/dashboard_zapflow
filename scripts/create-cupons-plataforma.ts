import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createCuponsPlataformaTable() {
  const client = await pool.connect();
  
  try {
    console.log('Criando tabela cupons_plataforma...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS cupons_plataforma (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        descricao VARCHAR(255),
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('percentual', 'fixo')),
        valor DECIMAL(10,2) NOT NULL,
        valor_minimo DECIMAL(10,2) DEFAULT 0,
        uso_maximo INTEGER DEFAULT NULL,
        uso_atual INTEGER DEFAULT 0,
        data_inicio TIMESTAMP DEFAULT NOW(),
        data_fim TIMESTAMP,
        planos_aplicaveis TEXT[] DEFAULT ARRAY['start', 'pro', 'elite'],
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Tabela cupons_plataforma criada com sucesso!');
    
    // Criar índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cupons_plataforma_codigo ON cupons_plataforma(codigo);
      CREATE INDEX IF NOT EXISTS idx_cupons_plataforma_ativo ON cupons_plataforma(ativo);
    `);
    
    console.log('Índices criados com sucesso!');
    
  } catch (error) {
    console.error('Erro ao criar tabela:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createCuponsPlataformaTable();
