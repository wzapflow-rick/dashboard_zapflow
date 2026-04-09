import { mpClient } from './lib/mcp-client';

async function test() {
  try {
    console.log('🔌 Conectando ao servidor MCP do Mercado Pago...');
    await mpClient.connect();
    console.log('✅ Conectado!');

    console.log('📋 Listando ferramentas disponíveis...');
    const tools = await mpClient.listTools();
    console.log('Ferramentas disponíveis:', JSON.stringify(tools, null, 2));

    await mpClient.disconnect();
    console.log('✅ Teste concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

test();
