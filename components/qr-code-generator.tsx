'use client';

import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Download, Printer, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import QRCodeLib from 'qrcode';

interface QrCodeGeneratorProps {
    empresaId: number;
    empresaNome: string;
    slug?: string;
}

export default function QrCodeGenerator({ empresaId, empresaNome, slug }: QrCodeGeneratorProps) {
    const [menuUrl, setMenuUrl] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const baseUrl = window.location.origin;
        const url = slug ? `${baseUrl}/menu/${slug}` : `${baseUrl}/menu/empresa-${empresaId}`;
        setMenuUrl(url);
        
        if (canvasRef.current) {
            QRCodeLib.toCanvas(canvasRef.current, url, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#6366f1',
                    light: '#ffffff'
                }
            }).then(() => {
                const canvas = canvasRef.current;
                if (canvas) {
                    setQrDataUrl(canvas.toDataURL('image/png'));
                }
            }).catch(console.error);
        }
    }, [empresaId, slug]);

    const downloadPdf = async () => {
        try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a5'
            });

            const pageWidth = 148;
            const pageHeight = 210;
            const centerX = pageWidth / 2;

            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(empresaNome, centerX, 30, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text('Escaneie para ver o cardápio', centerX, 40, { align: 'center' });

            if (qrDataUrl) {
                const qrSize = 80;
                doc.addImage(qrDataUrl, 'PNG', centerX - qrSize/2, 50, qrSize, qrSize);
            }

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(menuUrl, centerX, 145, { align: 'center' });

            doc.setFontSize(8);
            doc.text('Powered by ZapFlow', centerX, 155, { align: 'center' });

            doc.save(`${empresaNome.replace(/\s+/g, '-')}-cardapio-qr.pdf`);
            toast.success('PDF baixado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast.error('Erro ao gerar PDF');
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(menuUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Link copiado!');
        } catch {
            toast.error('Erro ao copiar');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
                    <QrCode className="size-6 text-violet-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">QR Code do Cardápio</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gere um QR Code para打印 ou compartilhar</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                        <canvas ref={canvasRef} className="w-40 h-40" />
                    </div>
                </div>

                <div className="flex-1 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Link do Cardápio</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={menuUrl}
                                readOnly
                                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"
                            />
                            <button
                                onClick={copyLink}
                                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                {copied ? <Check className="size-5 text-green-500" /> : <Copy className="size-5 text-slate-600 dark:text-slate-300" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={downloadPdf}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl transition-colors"
                        >
                            {loading ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <>
                                    <Download className="size-5" />
                                    Baixar PDF
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        💡 Imprima e coloque nas mesas ou no balcão para seus clientes acessarem o cardápio digital.
                    </p>
                </div>
            </div>
        </div>
    );
}