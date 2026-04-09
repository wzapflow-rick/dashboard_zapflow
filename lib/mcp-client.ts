import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class MercadoPagoMCPClient {
  private client: Client | null = null;
  private connected = false;
  private process: any = null;

  async connect(): Promise<void> {
    if (this.connected) return;

    const token = process.env.MERCADO_PAGO_MCP_TOKEN;
    if (!token) {
      throw new Error('Token MCP não configurado. Defina MERCADO_PAGO_MCP_TOKEN no .env');
    }

    const transport = new StdioClientTransport({
      command: 'npx',
      args: [
        '-y',
        'mcp-remote',
        'https://mcp.mercadopago.com/mcp',
        '--header',
        `Authorization:Bearer ${token}`
      ],
    });

    this.client = new Client(
      { name: 'zapflow-mcp', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(transport);
    this.connected = true;
  }

  async listTools() {
    if (!this.client) throw new Error('Cliente não conectado');
    return this.client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown>) {
    if (!this.client) throw new Error('Cliente não conectado');
    const result = await this.client.callTool({ name, arguments: args });
    console.log('Raw result:', JSON.stringify(result, null, 2));
    const content = (result as { content?: unknown }).content;
    if (!content || !Array.isArray(content) || content.length === 0) {
      console.log('No content in result');
      return result;
    }
    const textContent = content.find((c: unknown) => (c as { type?: string }).type === 'text');
    if (textContent && typeof textContent === 'object' && 'text' in textContent) {
      try {
        return JSON.parse((textContent as { text: string }).text);
      } catch {
        return (textContent as { text: string }).text;
      }
    }
    return result;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const mpClient = new MercadoPagoMCPClient();
