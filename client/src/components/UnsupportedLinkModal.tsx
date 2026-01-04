import React from 'react';
import { X, Upload, FileText, Youtube, AlertTriangle } from 'lucide-react';

interface UnsupportedLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadVideo: () => void;
    onPasteTranscript: () => void;
}

export const UnsupportedLinkModal: React.FC<UnsupportedLinkModalProps> = ({
    isOpen,
    onClose,
    onUploadVideo,
    onPasteTranscript,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-white" />
                        <h2 className="text-lg font-bold text-white">Link Não Suportado</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Este link parece exigir login ou não oferece transcrição acessível.
                        Para continuar, escolha uma das opções:
                    </p>

                    <div className="space-y-3">
                        {/* Opção 1: Upload */}
                        <button
                            onClick={onUploadVideo}
                            className="w-full flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors text-left"
                        >
                            <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Upload className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-white">
                                    Enviar Arquivo de Vídeo/Áudio
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Faça upload direto do seu computador
                                </p>
                            </div>
                        </button>

                        {/* Opção 2: Colar Transcrição */}
                        <button
                            onClick={onPasteTranscript}
                            className="w-full flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition-colors text-left"
                        >
                            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-white">
                                    Colar Transcrição/Legenda
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Cole o texto da transcrição manualmente
                                </p>
                            </div>
                        </button>

                        {/* Opção 3: YouTube */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Youtube className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-white">
                                    Use Links do YouTube
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Links do YouTube são processados automaticamente
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        onClick={onClose}
                        className="w-full py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnsupportedLinkModal;
