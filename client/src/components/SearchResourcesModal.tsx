import React, { useState } from 'react';
import { Search, BookOpen, FileText, Plus, X, Globe, Loader2, Link as LinkIcon } from './Icons';
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
  const [activeTab, setActiveTab] = useState<'book' | 'article' | 'web'>('book');
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
        // --- API 1: GOOGLE BOOKS (Livros Reais) ---
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=9&langRestrict=pt`);
        const data = await response.json();
        
        if (data.items) {
          const formatted: SearchResult[] = data.items.map((item: any) => ({
            id: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors?.join(', ') || 'Autor Desconhecido',
            description: item.volumeInfo.description?.slice(0, 200) + '...' || 'Sem descrição disponível.',
            url: item.volumeInfo.previewLink || item.volumeInfo.infoLink,
            type: InputType.URL, // Salva como Link para o livro
            thumbnail: item.volumeInfo.imageLinks?.thumbnail
          }));
          setResults(formatted);
        }

      } else if (activeTab === 'article') {
        // --- API 2: OPENALEX (Ciência/DOI Real) ---
        // Busca trabalhos científicos reais, filtrando por relevância
        const response = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=9`);
        const data = await response.json();

        if (data.results) {
           const formatted: SearchResult[] = data.results.map((item: any) => ({
             id: item.id,
             title: item.display_name || item.title,
             author: item.authorships?.[0]?.author?.display_name || 'Pesquisador Acadêmico',
             description: `Publicado em: ${item.publication_year}. Citado por: ${item.cited_by_count}. Revista: ${item.primary_location?.source?.display_name || 'N/A'}`,
             url: item.doi || item.primary_location?.landing_page_url || `https://openalex.org/${item.id}`,
             type: InputType.DOI,
             thumbnail: undefined 
           }));
           setResults(formatted);
        }

      } else {
        // --- API 3: WIKIPEDIA (Web/Conceitos Reais) ---
        // Ótima para trazer definições e links de estudo rápido
        const response = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=9`);
        const data = await response.json();

        if (data.query?.search) {
            const formatted: SearchResult[] = data.query.search.map((item: any) => ({
                id: item.pageid.toString(),
                title: item.title,
                author: 'Wikipedia / Web',
                description: item.snippet.replace(/<[^>]*>?/gm, '') + '...', // Remove tags HTML do snippet
                url: `https://pt.wikipedia.org/?curid=${item.pageid}`,
                type: InputType.URL,
                thumbnail: undefined
            }));
            setResults(formatted);
        }
      }
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-100 p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-600"/> Pesquisar Fontes</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500"/></button>
        </div>

        {/* Tabs & Search */}
        <div className="p-6 bg-gray-50 border-b border-gray-200 shrink-0 space-y-4">
            <div className="flex gap-2 justify-center">
                <button onClick={() => setActiveTab('book')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><BookOpen className="w-4 h-4"/> Livros</button>
                <button onClick={() => setActiveTab('article')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'article' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><FileText className="w-4 h-4"/> Artigos (DOI)</button>
                <button onClick={() => setActiveTab('web')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'web' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Globe className="w-4 h-4"/> Web / Wiki</button>
            </div>
            
            <div className="relative max-w-2xl mx-auto">
                <input 
                    autoFocus
                    type="text" 
                    placeholder={`Pesquisar sobre ${activeTab === 'book' ? 'livros' : activeTab === 'article' ? 'ciência' : 'conceitos'}...`} 
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-lg shadow-sm transition-all"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                <button 
                    onClick={handleSearch}
                    disabled={loading || !query.trim()}
                    className="absolute right-2 top-2 bottom-2 px-6 bg-gray-900 hover:bg-black text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Buscar'}
                </button>
            </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map((item) => (
                        <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full group">
                            <div className="flex items-start gap-4 mb-3">
                                {item.thumbnail ? (
                                    <img src={item.thumbnail} alt={item.title} className="w-16 h-24 object-cover rounded shadow-sm shrink-0" />
                                ) : (
                                    <div className={`w-16 h-24 flex items-center justify-center rounded shrink-0 ${activeTab === 'book' ? 'bg-orange-100 text-orange-500' : activeTab === 'article' ? 'bg-blue-100 text-blue-500' : 'bg-indigo-100 text-indigo-500'}`}>
                                        {activeTab === 'book' ? <BookOpen className="w-8 h-8"/> : activeTab === 'article' ? <FileText className="w-8 h-8"/> : <Globe className="w-8 h-8"/>}
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-gray-900 line-clamp-2 leading-tight mb-1 text-sm">{item.title}</h4>
                                    <p className="text-xs text-gray-500 font-medium line-clamp-1">{item.author}</p>
                                </div>
                            </div>
                            
                            <p className="text-xs text-gray-600 line-clamp-4 mb-4 flex-1 leading-relaxed">{item.description}</p>
                            
                            <button 
                                onClick={() => { onAddSource(item.title, item.url, item.type); onClose(); }}
                                className="w-full mt-auto flex items-center justify-center gap-2 py-2.5 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 rounded-lg font-bold text-xs transition-all"
                            >
                                <Plus className="w-4 h-4"/> Adicionar Recomendação
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    {loading ? (
                        <div className="text-center animate-pulse">
                            <Globe className="w-12 h-12 mx-auto mb-4 text-indigo-200"/>
                            <p className="text-indigo-500 font-bold mb-2">Conectando ao conhecimento...</p>
                            <p className="text-xs">Buscando em fontes reais.</p>
                        </div>
                    ) : hasSearched ? (
                        <div className="text-center">
                            <Search className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                            <p>Nenhum resultado encontrado para "{query}".</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Globe className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                            <p>Digite um tema para buscar livros, artigos ou conceitos.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
