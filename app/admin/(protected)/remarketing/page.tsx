'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  KanbanSquare,
  Inbox,
  Workflow,
  Settings,
  Users,
} from 'lucide-react';
import { FunilBoard } from '@/components/admin/funil/funil-board';
import { AprovacaoBox } from '@/components/admin/funil/aprovacao-box';
import { CadenciasEditor } from '@/components/admin/funil/cadencias-editor';

type Aba = 'funil' | 'aprovacao' | 'cadencias';

const ABAS: { id: Aba; label: string; icon: typeof KanbanSquare }[] = [
  { id: 'funil', label: 'Funil', icon: KanbanSquare },
  { id: 'aprovacao', label: 'Caixa de Aprovacao', icon: Inbox },
  { id: 'cadencias', label: 'Cadencias', icon: Workflow },
];

export default function RemarketingFunilPage() {
  const [aba, setAba] = useState<Aba>('funil');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Funil de Follow-up</h1>
          <p className="text-slate-400 mt-1">
            Acompanhe leads, trial e clientes. Cadencias automaticas e aprovacao manual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/remarketing/contatos"
            className="flex items-center gap-2 bg-[#0f1f35] border border-[#1e3a5f] hover:bg-[#162438] text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Users className="size-4" />
            <span className="hidden sm:inline">Contatos</span>
          </Link>
          <Link
            href="/admin/remarketing/config"
            className="flex items-center gap-2 bg-[#0f1f35] border border-[#1e3a5f] hover:bg-[#162438] text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Settings className="size-4" />
            <span className="hidden sm:inline">Configuracoes</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1e3a5f] overflow-x-auto">
        {ABAS.map((item) => {
          const active = aba === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap ${
                active
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Conteudo */}
      {aba === 'funil' && <FunilBoard />}
      {aba === 'aprovacao' && <AprovacaoBox />}
      {aba === 'cadencias' && <CadenciasEditor />}
    </div>
  );
}
