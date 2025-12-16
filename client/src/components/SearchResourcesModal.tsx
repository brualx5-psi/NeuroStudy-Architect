import React, { useState } from 'react';
import { Search, BookOpen, Video, FileText, Plus, X, Globe, Loader2 } from './Icons';
import { InputType } from '../types';

interface SearchResult {
  id: string;
  title: string;
  author: string;
  description: string;
  url: string;
  type: InputType;
  thumbnail?: string;
}

interface SearchResourcesModalProps {
  onClose: () => void;
  onAddSource: (name: string, content: string, type: InputType) => void;
}

export const SearchResourcesModal: React.FC<SearchResourcesModalProps> = ({ onClose, onAddSource }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'book' | 'video' | 'article'>('book');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      if (activeTab === 'book') {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6&langRestrict=pt`);
        const data = await response.json();
        
        if (data.items) {
          const formatted: SearchResult[] = data.items.map((item: any) => ({
            id: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors?.join(', ') || 'Autor Desconhecido',
            description: item.volumeInfo.description?.slice(0, 150) + '...' || 'Sem descrição.',
            url: item.volumeInfo.previewLink || item.volumeInfo.infoLink,
            type: InputType.URL,
            thumbnail: item.volumeInfo.imageLinks?.thumbnail
          }));
          setResults(formatted);
        }
      } else if (activeTab === 'video') {
        await new Promise(r => setTimeout(r, 800)); 
        setResults([
            { id: 'v1', title: `Aula Completa: ${query}`, author: 'Canal Educação', description: 'Visão aprofundada sobre o tema.', url: 'https://youtube.com', type: InputType.VIDEO },
            { id: 'v2', title: `Resumo Rápido: ${query}`, author: 'NeuroStudy', description: 'Pontos chaves em 5 minutos.', url: 'https://youtube.com', type: InputType.VIDEO },
        ]);
      } else {
        await new Promise(r => setTimeout(r, 800));
        setResults([
            { id: 'a1', title: `Artigo Científico: ${query}`, author: 'Scielo / Nature', description: 'Análise clínica recente.', url: `https://doi.org/10.1038/example`, type: InputType.DOI },
        ]);
      }
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 p-4 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-600"/> Pesquisar Conteúdo</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500"/></button>
        </div>
        <div className="p-6 bg-gray-50 border-b border-gray-200 space-y-4">
            <div className="flex gap-2 justify-center">
                <button onClick={() => setActiveTab('book')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border'}`}><BookOpen className="w-4 h-4"/> Livros</button>
                <button onClick={() => setActiveTab('video')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'video' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border'}`}><Video className="w-4 h-4"/> Vídeos</button>
                <button onClick={() => setActiveTab('article')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'article' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}><FileText className="w-4 h-4"/> Artigos</button>
            </div>
            <div className="relative max-w-2xl mx-auto flex gap-2">
                <input autoFocus type="text" placeholder="Digite o tema..." className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch} disabled={loading || !query.trim()} className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}</button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map((item) => (
                        <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                            <h4 className="font-bold text-gray-900 line-clamp-2 mb-1">{item.title}</h4>
                            <p className="text-xs text-gray-500 font-medium mb-2">{item.author}</p>
                            <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">{item.description}</p>
                            <button onClick={() => { onAddSource(item.title, item.url, item.type); onClose(); }} className="w-full mt-auto flex items-center justify-center gap-2 py-2 bg-gray-900 hover:bg-indigo-600 text-white rounded-lg font-bold text-sm transition-colors"><Plus className="w-4 h-4"/> Adicionar</button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400"><Search className="w-16 h-16 mx-auto mb-4 opacity-20"/><p>{hasSearched ? "Nenhum resultado." : "Digite para pesquisar."}</p></div>
            )}
        </div>
      </div>
    </div>
  );
  export const Loader2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
};
