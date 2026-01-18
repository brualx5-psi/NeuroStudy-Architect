import React, { useState, useEffect } from 'react';
import { X, FileText, Scissors, Check, AlertCircle, Eye, Grid3X3 } from 'lucide-react';
import { PdfThumbnailGrid } from './PdfThumbnailGrid';
import { getPdfPageCount } from '../services/pdfPageExtractor';

interface PageSelectorModalProps {
    isOpen: boolean;
    fileName: string;
    pdfFile?: File; // Novo: arquivo PDF para preview
    totalPages?: number;
    onClose: () => void;
    onConfirm: (pageSelection: PageSelection) => void;
}

export interface PageSelection {
    mode: 'all' | 'range' | 'visual';
    pageRanges?: string;
    parsedPages?: number[];
}

/**
 * Parseia string de ranges de páginas
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

/**
 * Converte array de páginas para string de ranges
 */
const pagesToRangeString = (pages: number[]): string => {
    if (pages.length === 0) return '';

    const sorted = [...pages].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            start = sorted[i];
            end = sorted[i];
        }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);

    return ranges.join(', ');
};

export const PageSelectorModal: React.FC<PageSelectorModalProps> = ({
    isOpen,
    fileName,
    pdfFile,
    totalPages: initialTotalPages,
    onClose,
    onConfirm
}) => {
    const [mode, setMode] = useState<'all' | 'range' | 'visual'>('all');
    const [pageRanges, setPageRanges] = useState('');
    const [visualSelectedPages, setVisualSelectedPages] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState<number | undefined>(initialTotalPages);

    // Carregar total de páginas do PDF se disponível
    useEffect(() => {
        if (pdfFile && !totalPages) {
            getPdfPageCount(pdfFile).then(count => {
                setTotalPages(count);
            }).catch(() => {
                // Ignora erro, totalPages permanece undefined
            });
        }
    }, [pdfFile, totalPages]);

    // Reset ao abrir
    useEffect(() => {
        if (isOpen) {
            setMode('all');
            setPageRanges('');
            setVisualSelectedPages([]);
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const parsedPages = mode === 'range'
        ? parsePageRanges(pageRanges, totalPages)
        : mode === 'visual'
            ? visualSelectedPages
            : [];

    const isValid = mode === 'all' || parsedPages.length > 0;

    const handleConfirm = () => {
        if ((mode === 'range' || mode === 'visual') && parsedPages.length === 0) {
            setError('Selecione pelo menos uma página');
            return;
        }

        onConfirm({
            mode,
            pageRanges: mode === 'range' ? pageRanges : mode === 'visual' ? pagesToRangeString(visualSelectedPages) : undefined,
            parsedPages: (mode === 'range' || mode === 'visual') ? parsedPages : undefined
        });
    };

    const handlePageToggle = (pageNumber: number) => {
        setVisualSelectedPages(prev => {
            if (prev.includes(pageNumber)) {
                return prev.filter(p => p !== pageNumber);
            }
            return [...prev, pageNumber].sort((a, b) => a - b);
        });
        setError(null);
    };

    const handleSelectAll = () => {
        if (totalPages) {
            setVisualSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
        }
    };

    const handleClearAll = () => {
        setVisualSelectedPages([]);
    };

    const formatParsedPages = () => {
        if (parsedPages.length === 0) return '';
        if (parsedPages.length <= 10) return parsedPages.join(', ');
        return `${parsedPages.slice(0, 8).join(', ')}... (${parsedPages.length} páginas)`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden animate-in slide-in-from-bottom-4 duration-300 ${mode === 'visual' ? 'max-w-4xl' : 'max-w-md'}`}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">Selecionar Páginas</h2>
                                <p className="text-sm text-white/80 truncate max-w-[250px]">{fileName}{totalPages ? ` (${totalPages} págs)` : ''}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Opções de modo */}
                    <div className="flex gap-2 flex-wrap">
                        {/* Opção: Documento inteiro */}
                        <button
                            onClick={() => { setMode('all'); setError(null); }}
                            className={`flex-1 min-w-[140px] p-3 rounded-xl border-2 text-left transition-all ${mode === 'all'
                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <FileText className={`w-4 h-4 ${mode === 'all' ? 'text-indigo-600' : 'text-gray-500'}`} />
                                <span className={`text-sm font-bold ${mode === 'all' ? 'text-indigo-600' : 'text-gray-700'}`}>
                                    Todas
                                </span>
                                {mode === 'all' && <Check className="w-4 h-4 text-indigo-600 ml-auto" />}
                            </div>
                        </button>

                        {/* Opção: Range textual */}
                        <button
                            onClick={() => { setMode('range'); setError(null); }}
                            className={`flex-1 min-w-[140px] p-3 rounded-xl border-2 text-left transition-all ${mode === 'range'
                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Scissors className={`w-4 h-4 ${mode === 'range' ? 'text-indigo-600' : 'text-gray-500'}`} />
                                <span className={`text-sm font-bold ${mode === 'range' ? 'text-indigo-600' : 'text-gray-700'}`}>
                                    Por intervalo
                                </span>
                                {mode === 'range' && <Check className="w-4 h-4 text-indigo-600 ml-auto" />}
                            </div>
                        </button>

                        {/* Opção: Visual (só aparece se tiver pdfFile) */}
                        {pdfFile && (
                            <button
                                onClick={() => { setMode('visual'); setError(null); }}
                                className={`flex-1 min-w-[140px] p-3 rounded-xl border-2 text-left transition-all ${mode === 'visual'
                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Grid3X3 className={`w-4 h-4 ${mode === 'visual' ? 'text-indigo-600' : 'text-gray-500'}`} />
                                    <span className={`text-sm font-bold ${mode === 'visual' ? 'text-indigo-600' : 'text-gray-700'}`}>
                                        Visual
                                    </span>
                                    {mode === 'visual' && <Check className="w-4 h-4 text-indigo-600 ml-auto" />}
                                </div>
                            </button>
                        )}
                    </div>

                    {/* Input de páginas (modo range) */}
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
                                Use vírgulas para separar e hífen para intervalos.
                            </p>

                            {parsedPages.length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                                    <p className="text-green-800">
                                        <span className="font-bold">✓ {parsedPages.length} página(s):</span> {formatParsedPages()}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Seleção visual (modo visual) */}
                    {mode === 'visual' && pdfFile && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                            <PdfThumbnailGrid
                                pdfFile={pdfFile}
                                selectedPages={visualSelectedPages}
                                onPageToggle={handlePageToggle}
                                onSelectAll={handleSelectAll}
                                onClearAll={handleClearAll}
                            />
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
                        {mode === 'all'
                            ? 'Usar todas as páginas'
                            : `Usar ${parsedPages.length} página(s)`
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PageSelectorModal;
