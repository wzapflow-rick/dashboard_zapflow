'use client';

import { useState, useEffect } from 'react';
import { Star, Send, ThumbsUp, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface RatingPageProps {
    params: Promise<{
        empresaId: string;
        pedidoId: string;
    }>;
}

export default function RatingPage({ params }: RatingPageProps) {
    const [resolvedParams, setResolvedParams] = useState<{empresaId: number; pedidoId: number} | null>(null);
    const [empresaNome, setEmpresaNome] = useState('');
    const [telefoneCliente, setTelefoneCliente] = useState('');
    const [notaComida, setNotaComida] = useState(0);
    const [notaEntrega, setNotaEntrega] = useState(0);
    const [comentario, setComentario] = useState('');
    const [enviado, setEnviado] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        params.then(p => {
            setResolvedParams({
                empresaId: parseInt(p.empresaId),
                pedidoId: parseInt(p.pedidoId)
            });
        });
    }, [params]);

    useEffect(() => {
        if (resolvedParams) {
            fetch(`/api/ratings/company/${resolvedParams.empresaId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.nome) setEmpresaNome(data.nome);
                })
                .catch(console.error);
        }
    }, [resolvedParams]);

    const enviarAvaliacao = async () => {
        if (!resolvedParams || notaComida === 0 || notaEntrega === 0) return;

        setLoading(true);
        try {
            const res = await fetch('/api/ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pedido_id: resolvedParams.pedidoId,
                    empresa_id: resolvedParams.empresaId,
                    telefone_cliente: telefoneCliente || 'anonimo',
                    nota_comida: notaComida,
                    nota_entrega: notaEntrega,
                    comentario: comentario || null
                })
            });

            if (res.ok) setEnviado(true);
        } catch (error) {
            console.error('Erro ao enviar:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!resolvedParams) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-violet-500" />
            </div>
        );
    }

    if (enviado) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-sm w-full"
                >
                    <div className="size-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ThumbsUp className="size-10 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Obrigado!</h1>
                    <p className="text-slate-600">Sua avaliação foi enviada com sucesso.</p>
                    <p className="text-sm text-slate-400 mt-4">Pedido #{resolvedParams.pedidoId}</p>
                </motion.div>
            </div>
        );
    }

    const StarRating = ({ nota, setNota, label, emoji }: { nota: number; setNota: (n: number) => void; label: string; emoji: string }) => (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{emoji}</span>
                <h3 className="font-bold text-slate-900">{label}</h3>
            </div>
            <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        onClick={() => setNota(n)}
                        className="p-2 hover:scale-110 transition-transform"
                    >
                        <Star className={`size-10 ${n <= nota ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                    </button>
                ))}
            </div>
            <p className="text-center text-sm text-slate-500 mt-2">
                {nota === 0 ? 'Toque para avaliar' : 
                 nota === 1 ? 'Ruim' : 
                 nota === 2 ? 'Regular' : 
                 nota === 3 ? 'Bom' : 
                 nota === 4 ? 'Ótimo' : 'Excelente!'}
            </p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 p-4">
            <div className="max-w-lg mx-auto space-y-6 py-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Como foi seu pedido?</h1>
                    <p className="text-slate-600 mt-1">Avalie sua experiência{empresaNome ? ` com ${empresaNome}` : ''}</p>
                    <p className="text-xs text-slate-400 mt-2">Pedido #{resolvedParams.pedidoId}</p>
                </motion.div>

                <div className="space-y-4">
                    <StarRating nota={notaComida} setNota={setNotaComida} label="Comida" emoji="🍕" />
                    <StarRating nota={notaEntrega} setNota={setNotaEntrega} label="Entrega" emoji="🛵" />
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-3">Algo a dizer? (opcional)</h3>
                    <textarea
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Conte-nos mais sobre sua experiência..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                        rows={3}
                    />
                </div>

                <button
                    onClick={enviarAvaliacao}
                    disabled={loading || notaComida === 0 || notaEntrega === 0}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <><Send className="size-5" /> Enviar Avaliação</>}
                </button>

                <p className="text-xs text-center text-slate-400">Sua opinião nos ajuda a melhorar!</p>
            </div>
        </div>
    );
}