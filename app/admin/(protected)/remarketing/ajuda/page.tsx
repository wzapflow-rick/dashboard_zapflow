'use client';

import { useState } from 'react';
import { 
  HelpCircle,
  Settings,
  Tag,
  Target,
  MessageSquare,
  Users,
  Play,
  ListTodo,
  History,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionItemProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionItem({ title, icon, children, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-[#1e3a5f] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 bg-[#0f1f35] hover:bg-[#162438] transition-colors text-left"
      >
        <span className="text-orange-400">{icon}</span>
        <span className="flex-1 font-medium text-white">{title}</span>
        {isOpen ? (
          <ChevronDown className="size-5 text-slate-400" />
        ) : (
          <ChevronRight className="size-5 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 bg-[#0a1628] border-t border-[#1e3a5f]">
          {children}
        </div>
      )}
    </div>
  );
}

function StepNumber({ num }: { num: number }) {
  return (
    <span className="inline-flex items-center justify-center size-6 rounded-full bg-orange-500 text-white text-sm font-bold mr-2">
      {num}
    </span>
  );
}

export default function AjudaPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20">
          <HelpCircle className="size-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Central de Ajuda</h1>
          <p className="text-slate-400">Aprenda a usar o sistema de Remarketing</p>
        </div>
      </div>

      {/* O que e o sistema */}
      <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">O que esse sistema faz?</h2>
        <p className="text-slate-300 leading-relaxed">
          Envia mensagens automaticas pelo WhatsApp para seus clientes que pararam de comprar ou interagir. 
          E como um &quot;lembrete amigavel&quot; para trazer o cliente de volta.
        </p>
        
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg">Contatos</span>
          <ArrowRight className="size-4 text-slate-500" />
          <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg">Categorias</span>
          <ArrowRight className="size-4 text-slate-500" />
          <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg">Mensagens</span>
          <ArrowRight className="size-4 text-slate-500" />
          <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg">Fila</span>
          <ArrowRight className="size-4 text-slate-500" />
          <span className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg">WhatsApp</span>
        </div>
      </div>

      {/* Passo a passo */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Passo a Passo</h2>
        
        <AccordionItem 
          title="Passo 1: Configurar o Sistema" 
          icon={<Settings className="size-5" />}
          defaultOpen={true}
        >
          <ol className="space-y-3 text-slate-300">
            <li><StepNumber num={1} />Va em <strong className="text-white">Remarketing &gt; Configuracoes</strong></li>
            <li><StepNumber num={2} />No campo &quot;Instancia Evolution&quot;, coloque o nome da sua instancia (ex: zapflow_ativacao)</li>
            <li><StepNumber num={3} />Clique em <strong className="text-white">Gerar</strong> para criar uma chave de seguranca</li>
            <li><StepNumber num={4} />Escolha os horarios que as mensagens podem ser enviadas (ex: 9h as 18h)</li>
            <li><StepNumber num={5} />Escolha os dias da semana (desmarque sabado e domingo se nao quiser enviar no fim de semana)</li>
            <li><StepNumber num={6} />Clique <strong className="text-white">Salvar</strong></li>
          </ol>
        </AccordionItem>

        <AccordionItem 
          title="Passo 2: Criar Etiquetas (opcional)" 
          icon={<Tag className="size-5" />}
        >
          <p className="text-slate-400 mb-4">Etiquetas sao como &quot;adesivos&quot; para marcar seus contatos.</p>
          <ol className="space-y-3 text-slate-300">
            <li><StepNumber num={1} />Va em <strong className="text-white">Remarketing &gt; Etiquetas</strong></li>
            <li><StepNumber num={2} />Clique <strong className="text-white">Nova Etiqueta</strong></li>
            <li><StepNumber num={3} />De um nome (ex: &quot;Cliente VIP&quot;, &quot;Comprou uma vez&quot;, &quot;Inativo&quot;)</li>
            <li><StepNumber num={4} />Escolha uma cor</li>
            <li><StepNumber num={5} />Salve</li>
          </ol>
        </AccordionItem>

        <AccordionItem 
          title="Passo 3: Criar Categorias" 
          icon={<Target className="size-5" />}
        >
          <p className="text-slate-400 mb-4">Categorias agrupam contatos que vao receber mensagens parecidas.</p>
          <ol className="space-y-3 text-slate-300">
            <li><StepNumber num={1} />Va em <strong className="text-white">Remarketing &gt; Categorias</strong></li>
            <li><StepNumber num={2} />Clique <strong className="text-white">Nova Categoria</strong></li>
            <li>
              <StepNumber num={3} />Preencha:
              <ul className="ml-8 mt-2 space-y-1 text-sm text-slate-400">
                <li><strong className="text-slate-300">Nome:</strong> Ex: &quot;Clientes Inativos&quot;</li>
                <li><strong className="text-slate-300">Prioridade:</strong> 1 = mais importante</li>
                <li><strong className="text-slate-300">Cooldown:</strong> Quantas horas esperar antes de enviar outra mensagem (ex: 24h)</li>
                <li><strong className="text-slate-300">Tipo Manual:</strong> voce adiciona os contatos manualmente</li>
                <li><strong className="text-slate-300">Tipo Automatica:</strong> o sistema adiciona sozinho (ex: quem nao interage ha 7 dias)</li>
              </ul>
            </li>
            <li><StepNumber num={4} />Salve</li>
          </ol>
        </AccordionItem>

        <AccordionItem 
          title="Passo 4: Criar Mensagens" 
          icon={<MessageSquare className="size-5" />}
        >
          <ol className="space-y-3 text-slate-300">
            <li><StepNumber num={1} />Va em <strong className="text-white">Remarketing &gt; Mensagens</strong></li>
            <li>
              <StepNumber num={2} />Primeiro, crie um &quot;Tipo de Dor&quot; (o motivo da mensagem):
              <ul className="ml-8 mt-2 text-sm text-slate-400">
                <li>Clique <strong className="text-slate-300">Novo Tipo de Dor</strong></li>
                <li>Nome: Ex: &quot;Saudades&quot;</li>
              </ul>
            </li>
            <li>
              <StepNumber num={3} />Depois, crie a mensagem:
              <ul className="ml-8 mt-2 space-y-1 text-sm text-slate-400">
                <li>Clique <strong className="text-slate-300">Nova Mensagem</strong></li>
                <li><strong className="text-slate-300">Nome:</strong> Ex: &quot;Mensagem de Saudades&quot;</li>
                <li><strong className="text-slate-300">Tipo de Dor:</strong> Selecione &quot;Saudades&quot;</li>
                <li><strong className="text-slate-300">Conteudo:</strong> Escreva a mensagem</li>
              </ul>
            </li>
          </ol>
          
          <div className="mt-4 p-4 bg-[#0f1f35] rounded-lg border border-[#1e3a5f]">
            <p className="text-sm text-slate-400 mb-2">Variaveis disponiveis:</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <code className="px-2 py-1 bg-[#1e3a5f] text-orange-400 rounded">{'{{nome}}'}</code>
              <span className="text-slate-500">= nome do cliente</span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm mt-2">
              <code className="px-2 py-1 bg-[#1e3a5f] text-orange-400 rounded">{'{{telefone}}'}</code>
              <span className="text-slate-500">= telefone do cliente</span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm mt-2">
              <code className="px-2 py-1 bg-[#1e3a5f] text-orange-400 rounded">{'{{dias_ausente}}'}</code>
              <span className="text-slate-500">= dias sem interacao</span>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400 mb-2">Exemplo de mensagem:</p>
            <p className="text-sm text-slate-300 italic">
              &quot;Ola {'{{nome}}'}! Sentimos sua falta! Ja faz {'{{dias_ausente}}'} dias que voce nao nos visita. Temos novidades esperando por voce!&quot;
            </p>
          </div>
          
          <p className="mt-4 text-slate-300">
            <StepNumber num={4} />Clique em <strong className="text-white">Combinacoes</strong> para ligar a categoria com a mensagem
          </p>
        </AccordionItem>

        <AccordionItem 
          title="Passo 5: Importar Contatos" 
          icon={<Users className="size-5" />}
        >
          <ol className="space-y-3 text-slate-300">
            <li><StepNumber num={1} />Va em <strong className="text-white">Remarketing &gt; Contatos</strong></li>
            <li>
              <StepNumber num={2} />Duas opcoes:
              <ul className="ml-8 mt-2 space-y-1 text-sm text-slate-400">
                <li><strong className="text-slate-300">Importar:</strong> Puxa os contatos do seu WhatsApp automaticamente</li>
                <li><strong className="text-slate-300">Adicionar:</strong> Digita o numero manualmente</li>
              </ul>
            </li>
            <li>
              <StepNumber num={3} />Para cada contato, voce pode:
              <ul className="ml-8 mt-2 space-y-1 text-sm text-slate-400">
                <li>Adicionar etiquetas (clicando no icone de tag)</li>
                <li>Adicionar em categorias (clicando no icone de alvo)</li>
              </ul>
            </li>
          </ol>
        </AccordionItem>

        <AccordionItem 
          title="Passo 6: Testar o Sistema" 
          icon={<Play className="size-5" />}
        >
          <ol className="space-y-3 text-slate-300">
            <li><StepNumber num={1} />Va em <strong className="text-white">Remarketing &gt; Configuracoes</strong></li>
            <li><StepNumber num={2} />Role ate &quot;Executar Manualmente&quot;</li>
            <li>
              <StepNumber num={3} />Clique os botoes na ordem:
              <ul className="ml-8 mt-2 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Verificar Status</span>
                  <span className="text-slate-400">Confirma se o WhatsApp esta conectado</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">Classificar</span>
                  <span className="text-slate-400">Coloca contatos nas categorias automaticas</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">Agendar</span>
                  <span className="text-slate-400">Cria as mensagens na fila</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">Processar</span>
                  <span className="text-slate-400">Envia as mensagens</span>
                </li>
              </ul>
            </li>
          </ol>
        </AccordionItem>

        <AccordionItem 
          title="Onde ver o que aconteceu?" 
          icon={<History className="size-5" />}
        >
          <div className="space-y-3 text-slate-300">
            <div className="flex items-start gap-3">
              <ListTodo className="size-5 text-yellow-400 mt-0.5" />
              <div>
                <strong className="text-white">Remarketing &gt; Fila</strong>
                <p className="text-sm text-slate-400">Ve as mensagens aguardando envio</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <History className="size-5 text-blue-400 mt-0.5" />
              <div>
                <strong className="text-white">Remarketing &gt; Historico</strong>
                <p className="text-sm text-slate-400">Ve tudo que foi enviado ou deu erro</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Target className="size-5 text-orange-400 mt-0.5" />
              <div>
                <strong className="text-white">Remarketing &gt; Dashboard</strong>
                <p className="text-sm text-slate-400">Ve os numeros gerais</p>
              </div>
            </div>
          </div>
        </AccordionItem>
      </div>

      {/* Problemas Comuns */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="size-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Problemas Comuns</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-4 p-3 bg-[#0a1628] rounded-lg">
            <AlertTriangle className="size-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">&quot;Instancia desconectada&quot;</p>
              <p className="text-sm text-slate-400">Abra o painel da Evolution e escaneie o QR Code novamente</p>
            </div>
          </div>
          
          <div className="flex gap-4 p-3 bg-[#0a1628] rounded-lg">
            <AlertTriangle className="size-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">&quot;Nenhum item na fila&quot;</p>
              <p className="text-sm text-slate-400">Rode o &quot;Classificar&quot; e depois &quot;Agendar&quot; primeiro</p>
            </div>
          </div>
          
          <div className="flex gap-4 p-3 bg-[#0a1628] rounded-lg">
            <AlertTriangle className="size-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">&quot;Nenhuma categoria ativa&quot;</p>
              <p className="text-sm text-slate-400">Crie uma categoria e marque como ativa</p>
            </div>
          </div>
          
          <div className="flex gap-4 p-3 bg-[#0a1628] rounded-lg">
            <AlertTriangle className="size-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">Mensagem nao chegou</p>
              <p className="text-sm text-slate-400">Verifique se o numero esta correto com codigo do pais (55)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dicas */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="size-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Dicas Importantes</h2>
        </div>
        
        <ul className="space-y-2 text-slate-300">
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-1" />
            <span>Use o botao &quot;Verificar Status&quot; antes de processar para garantir que o WhatsApp esta conectado</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-1" />
            <span>O sistema respeita o cooldown - nao envia para o mesmo contato antes de X horas</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-1" />
            <span>Verifique o Historico para debugar problemas</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-1" />
            <span>Na Fila, use &quot;Enviar Agora&quot; para forcar envio imediato ignorando horarios</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
