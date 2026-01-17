import React, { useState } from 'react';
import { X, FileText, Scissors, Check, AlertCircle } from 'lucide-react';

interface PageSelectorModalProps {
    isOpen: boolean;
    fileName: string;
    totalPages?: number;
    onClose: () => void;
    onConfirm: (pageSelection: PageSelection) => void;
}

export interface PageSelection {
    mode: 'all' | 'range';
    pageRanges?: string; // Ex: "1-5, 10, 15-20"
    parsedPages?: number[]; // Ex: [1,2,3,4,5,10,15,16,17,18,19,20]
}

/**
 * Parseia string de ranges de páginas
 * Ex: "1-5, 10, 15-20" => [1,2,3,4,5,10,15,16,17,18,19,20]
 */
export const parsePageRanges = (input: string, maxPage?: number): number[] => {
    const pages: Set<number> = new Set();
    const parts = input.split(',').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    if (!maxPage || i <= maxPage) {
                        pages.add(i);
                    }
                }
            }
        } else {
            const page = parseInt(part, 10);
            if (!isNaN(page) && page > 0) {
                if (!maxPage || page <= maxPage) {
                    pages.add(page);
                }
            }
        }
    }

    return Array.from(pages).sort((a, b) => a - b);
};

export const PageSelectorModal: React.FC<PageSelectorModalProps> = ({
    isOpen,
    fileName,
    totalPages,
    onClose,
    onConfirm
}) => {
    const [mode, setMode] = useState<'all' | 'range'>('all');
    const [pageRanges, setPageRanges] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const parsedPages = parsePageRanges(pageRanges, totalPages);
    const isValid = mode === 'all' || parsedPages.length > 0;

    const handleConfirm = () => {
        if (mode === 'range' && parsedPages.length === 0) {
            setError('Digite pelo menos uma página válida');
            return;
        }

        onConfirm({
            mode,
            pageRanges: mode === 'range' ? pageRanges : undefined,
            parsedPages: mode === 'range' ? parsedPages : undefined
        });
    };

    const formatParsedPages = () => {
        if (parsedPages.length === 0) return '';
        if (parsedPages.length <= 10) return parsedPages.join(', ');
        return `${parsedPages.slice(0, 8).join(', ')}... (${parsedPages.length} páginas)`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">Selecionar Páginas</h2>
                                <p className="text-sm text-white/80 truncate max-w-[250px]">{fileName}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Opção: Documento inteiro */}
                    <button
                        onClick={() => { setMode('all'); setError(null); }}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${mode === 'all'
                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">Usar documento inteiro</p>
                                <p className="text-sm text-gray-500">Processar todas as páginas{totalPages ? ` (${totalPages} págs)` : ''}</p>
                            </div>
                            {mode === 'all' && <Check className="w-5 h-5 text-indigo-600" />}
                        </div>
                    </button>

                    {/* Opção: Selecionar páginas */}
                    <button
                        onClick={() => { setMode('range'); setError(null); }}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${mode === 'range'
                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode === 'range' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                <Scissors className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">Selecionar páginas</p>
                                <p className="text-sm text-gray-500">Escolher intervalo ou páginas específicas</p>
                            </div>
                            {mode === 'range' && <Check className="w-5 h-5 text-indigo-600" />}
                        </div>
                    </button>

                    {/* Input de páginas (aparece quando seleciona "range") */}
                    {mode === 'range' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="block text-sm font-bold text-gray-700">
                                Páginas a processar:
                            </label>
                            <input
                                type="text"
                                value={pageRanges}
                                onChange={(e) => { setPageRanges(e.target.value); setError(null); }}
                                placeholder="Ex: 1-10, 15, 20-25"
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-sm"
                                autoFocus
                            />
                            <p className="text-xs text-gray-500">
                                Use vírgulas para separar e hífen para intervalos. Ex: <code className="bg-gray-100 px-1 rounded">1-5, 10, 15-20</code>
                            </p>

                            {/* Preview das páginas parseadas */}
                            {parsedPages.length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                                    <p className="text-green-800">
                                        <span className="font-bold">✓ {parsedPages.length} página(s) selecionada(s):</span>
                                        <br />
                                        <span className="text-green-600">{formatParsedPages()}</span>
                                    </p>
                                </div>
                            )}

                            {/* Erro */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm flex items-center gap-2 text-red-700">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PageSelectorModal;
