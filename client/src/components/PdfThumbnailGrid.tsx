import React, { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfThumbnailGridProps {
    pdfFile: File;
    selectedPages: number[];
    onPageToggle: (pageNumber: number) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
}

interface ThumbnailData {
    pageNumber: number;
    dataUrl: string;
}

export const PdfThumbnailGrid: React.FC<PdfThumbnailGridProps> = ({
    pdfFile,
    selectedPages,
    onPageToggle,
    onSelectAll,
    onClearAll
}) => {
    const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    useEffect(() => {
        abortRef.current = false;
        generateThumbnails();

        return () => {
            abortRef.current = true;
        };
    }, [pdfFile]);

    const generateThumbnails = async () => {
        setLoading(true);
        setError(null);
        setThumbnails([]);

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            setTotalPages(pdf.numPages);

            const thumbs: ThumbnailData[] = [];
            const THUMBNAIL_SCALE = 0.3; // Escala pequena para thumbnails
            const BATCH_SIZE = 5; // Processar em lotes para não travar

            for (let i = 1; i <= pdf.numPages; i++) {
                if (abortRef.current) break;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d')!;
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                thumbs.push({
                    pageNumber: i,
                    dataUrl: canvas.toDataURL('image/jpeg', 0.7)
                });

                // Atualizar thumbnails a cada lote
                if (i % BATCH_SIZE === 0 || i === pdf.numPages) {
                    setThumbnails([...thumbs]);
                }
            }

            setLoading(false);
        } catch (err) {
            console.error('Erro ao gerar thumbnails:', err);
            setError('Não foi possível carregar o preview do PDF');
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="text-center py-8 text-red-500">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header com ações */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando páginas... ({thumbnails.length}/{totalPages || '?'})
                        </span>
                    ) : (
                        <span>
                            {selectedPages.length} de {totalPages} página(s) selecionada(s)
                        </span>
                    )}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={onSelectAll}
                        className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                    >
                        Selecionar todas
                    </button>
                    <button
                        onClick={onClearAll}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                        Limpar seleção
                    </button>
                </div>
            </div>

            {/* Grid de thumbnails */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto p-2 bg-gray-50 rounded-lg">
                {thumbnails.map((thumb) => {
                    const isSelected = selectedPages.includes(thumb.pageNumber);
                    return (
                        <button
                            key={thumb.pageNumber}
                            onClick={() => onPageToggle(thumb.pageNumber)}
                            className={`relative group rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                    ? 'border-indigo-500 ring-2 ring-indigo-300 shadow-lg'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <img
                                src={thumb.dataUrl}
                                alt={`Página ${thumb.pageNumber}`}
                                className="w-full h-auto"
                            />
                            {/* Overlay de seleção */}
                            <div className={`absolute inset-0 transition-opacity ${isSelected
                                    ? 'bg-indigo-500/20'
                                    : 'bg-black/0 group-hover:bg-black/10'
                                }`} />
                            {/* Número da página */}
                            <div className={`absolute bottom-0 left-0 right-0 text-center py-1 text-xs font-bold ${isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-800/70 text-white'
                                }`}>
                                {thumb.pageNumber}
                            </div>
                            {/* Checkmark */}
                            {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    );
                })}

                {/* Placeholders durante loading */}
                {loading && thumbnails.length < totalPages && Array.from({ length: Math.min(6, (totalPages || 12) - thumbnails.length) }).map((_, i) => (
                    <div
                        key={`placeholder-${i}`}
                        className="aspect-[3/4] bg-gray-200 rounded-lg animate-pulse flex items-center justify-center"
                    >
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PdfThumbnailGrid;
