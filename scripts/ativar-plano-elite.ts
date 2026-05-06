/**
 * Script para ativar plano Elite manualmente para uma empresa
 * 
 * Uso: npx tsx scripts/ativar-plano-elite.ts
 */

import { Pool } from 'pg';

const EMAIL_CLIENTE = 'laisethayane459@gmail.com';
const PLANO = 'elite';
const DIAS_VIGENCIA = 30; // 30 dias de plano

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log(`Buscando empresa com email: ${EMAIL_CLIENTE}...`);
    
    // Buscar empresa pelo email
    const empresaResult = await pool.query(
      'SELECT id, nome, nome_fantasia, email, slug FROM empresas WHERE email = $1',
      [EMAIL_CLIENTE]
    );

    if (empresaResult.rows.length === 0) {
      console.log('Empresa NAO encontrada pelo email. Buscando em usuarios...');
      
      // Tentar buscar pelo email em usuarios
      const usuarioResult = await pool.query(
        'SELECT u.empresa_id, e.nome, e.nome_fantasia, e.email, e.slug FROM usuarios u JOIN empresas e ON u.empresa_id = e.id WHERE u.email = $1',
        [EMAIL_CLIENTE]
      );
      
      if (usuarioResult.rows.length === 0) {
        console.error('ERRO: Nenhuma empresa ou usuario encontrado com esse email!');
        
        // Listar algumas empresas recentes para debug
        const recentesResult = await pool.query(
          'SELECT id, nome, nome_fantasia, email, slug FROM empresas ORDER BY created_at DESC LIMIT 10'
        );
        console.log('\nEmpresas recentes para referencia:');
        console.table(recentesResult.rows);
        
        process.exit(1);
      }
      
      // Usar dados do usuario
      const usuario = usuarioResult.rows[0];
      console.log(`Encontrado via usuario! Empresa: ${usuario.nome_fantasia || usuario.nome} (ID: ${usuario.empresa_id})`);
      
      await ativarPlano(pool, usuario.empresa_id, PLANO, DIAS_VIGENCIA);
    } else {
      const empresa = empresaResult.rows[0];
      console.log(`Empresa encontrada: ${empresa.nome_fantasia || empresa.nome} (ID: ${empresa.id})`);
      
      await ativarPlano(pool, empresa.id, PLANO, DIAS_VIGENCIA);
    }

  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function ativarPlano(pool: Pool, empresaId: number, plano: string, dias: number) {
  const hoje = new Date();
  const dataProxima = new Date(hoje);
  dataProxima.setDate(dataProxima.getDate() + dias);

  console.log(`\nAtivando plano ${plano.toUpperCase()} para empresa ID ${empresaId}...`);
  console.log(`Data de vencimento: ${dataProxima.toLocaleDateString('pt-BR')}`);

  // Verificar se existe assinatura
  const existingResult = await pool.query(
    'SELECT id, plano, status FROM assinaturas WHERE empresa_id = $1',
    [empresaId]
  );

  if (existingResult.rows.length > 0) {
    // Atualizar assinatura existente
    console.log(`Assinatura existente encontrada (plano: ${existingResult.rows[0].plano}, status: ${existingResult.rows[0].status})`);
    
    await pool.query(`
      UPDATE assinaturas 
      SET plano = $1, 
          status = 'authorized', 
          data_proxima_cobranca = $2, 
          valor = 0,
          cartao_ultimos_digitos = 'ADMIN',
          cartao_bandeira = 'ADMIN',
          updated_at = NOW()
      WHERE empresa_id = $3
    `, [plano, dataProxima.toISOString(), empresaId]);
    
    console.log('Assinatura ATUALIZADA com sucesso!');
  } else {
    // Criar nova assinatura
    console.log('Nenhuma assinatura encontrada, criando nova...');
    
    await pool.query(`
      INSERT INTO assinaturas (
        empresa_id, plano, status, valor, 
        data_inicio, data_proxima_cobranca,
        cartao_ultimos_digitos, cartao_bandeira,
        created_at, updated_at
      ) VALUES ($1, $2, 'authorized', 0, NOW(), $3, 'ADMIN', 'ADMIN', NOW(), NOW())
    `, [empresaId, plano, dataProxima.toISOString()]);
    
    console.log('Nova assinatura CRIADA com sucesso!');
  }

  // Verificar resultado
  const verificacao = await pool.query(`
    SELECT a.*, e.nome_fantasia, e.email 
    FROM assinaturas a 
    JOIN empresas e ON a.empresa_id = e.id 
    WHERE a.empresa_id = $1
  `, [empresaId]);

  console.log('\n=== RESULTADO FINAL ===');
  console.table(verificacao.rows.map(row => ({
    empresa: row.nome_fantasia,
    email: row.email,
    plano: row.plano,
    status: row.status,
    vencimento: new Date(row.data_proxima_cobranca).toLocaleDateString('pt-BR')
  })));
}

main();
