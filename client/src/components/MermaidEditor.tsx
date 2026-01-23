
import React, { useState, useEffect } from 'react';
import { Edit, RefreshCw, X, CheckCircle, Image, Zap } from './Icons';

interface MermaidEditorProps {
    initialCode: string;
    onUpdate: (newCode: string, newUrl: string) => void;
}

export const MermaidEditor: React.FC<MermaidEditorProps> = ({ initialCode, onUpdate }) => {
    const [code, setCode] = useState(initialCode);
    const [imageUrl, setImageUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Função para gerar URL do Mermaid.ink
    const generateUrl = (mermaidCode: string) => {
        try {
            const encoded = btoa(unescape(encodeURIComponent(mermaidCode)));
            return `https://mermaid.ink/img/${encoded}?bgColor=FFFFFF`;
        } catch (e) {
            console.error(e);
            return '';
        }
    };

    useEffect(() => {
        setCode(initialCode);
        setImageUrl(generateUrl(initialCode));
    }, [initialCode]);

    const handlePreview = () => {
        const url = generateUrl(code);
        setImageUrl(url);
        setError(null);
    };

    const handleSave = () => {
        const url = generateUrl(code);
        onUpdate(code, url);
        setIsEditing(false);
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Visualização da Imagem */}
            <div className={`relative group w-full bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl transition-all duration-300 ${isEditing ? 'opacity-40 blur-md pointer-events-none' : 'opacity-100'}`}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Diagrama Mermaid"
                        className="w-full h-auto rounded-2xl shadow-xl border-2 border-gray-100 p-6 bg-white"
                        onError={() => setError("Erro ao renderizar diagrama. Verifique a sintaxe.")}
                    />
                ) : (
                    <div className="p-12 text-center text-gray-400 bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl border-2 border-dashed border-gray-200">
                        <Zap className="w-16 h-16 mx-auto mb-4 opacity-50 text-purple-300" />
                        <p className="font-medium text-gray-500">Diagrama não disponível</p>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50/95 backdrop-blur-sm text-red-600 font-bold p-6 text-center rounded-2xl border-2 border-red-200">
                        {error}
                    </div>
                )}
            </div>

            {/* Controles */}
            <div className="flex justify-end gap-3">
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 rounded-xl text-sm font-bold transition-all shadow-sm"
                    >
                        <Edit className="w-4 h-4" /> Editar Diagrama
                    </button>
                ) : (
                    <div className="flex items-center gap-3 animate-in slide-in-from-right-4 fade-in">
                        <button
                            onClick={handlePreview}
                            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            title="Atualizar pré-visualização"
                        >
                            <RefreshCw className="w-4 h-4" /> Preview
                        </button>
                        <button
                            onClick={() => { setIsEditing(false); setCode(initialCode); handlePreview(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all shadow-sm"
                        >
                            <X className="w-4 h-4" /> Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-green-300 transition-all shadow-sm"
                        >
                            <CheckCircle className="w-4 h-4" /> Salvar
                        </button>
                    </div>
                )}
            </div>

            {/* Área de Edição (Só aparece quando isEditing = true) */}
            {isEditing && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                    <label className="block text-sm font-bold text-gray-600 uppercase mb-3 ml-1 flex items-center gap-2">
                        <Edit className="w-4 h-4 text-indigo-500" />
                        Código Mermaid (Graph TD)
                    </label>
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full h-72 p-6 font-mono text-sm bg-gradient-to-br from-gray-900 to-slate-800 text-green-400 rounded-2xl shadow-2xl focus:ring-4 focus:ring-purple-500/50 outline-none resize-y border-2 border-gray-700"
                        spellCheck={false}
                    />
                    <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                        <p className="text-xs text-gray-600 font-medium mb-2">💡 Dicas de sintaxe Mermaid:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-500">
                            <div><code className="bg-white px-2 py-1 rounded">graph TD</code> = vertical</div>
                            <div><code className="bg-white px-2 py-1 rounded">A[Texto] --&gt; B</code> = conexão</div>
                            <div><code className="bg-white px-2 py-1 rounded">style A fill:#f9f</code> = cores</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
