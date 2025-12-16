import React, { useState } from 'react';
import { Search, BookOpen, FileText, Plus, X, Globe, Loader2, Link as LinkIcon, Star, Shield } from './Icons';
import { InputType } from '../types';

interface SearchResult {
  id: string;
  title: string;
  author: string;
  description: string;
  url: string;
  type: InputType;
  thumbnail?: string;
  // Novos campos para a pirâmide
  reliabilityScore?: number; // 0 a 5
  reliabilityLabel?: string;
  isGuideline?: boolean;
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

  // --- LÓGICA DA PIRÂMIDE DE EVIDÊNCIA (Heurística) ---
  const calculateReliability = (title: string, abstract: string = ''): { score: number, label: string, isGuideline: boolean } => {
    const text = (title + ' ' + abstract).toLowerCase();

    // 1. GUIDELINES (TOPO SUPREMO)
    if (text.includes('guideline') || text.includes('diretriz') || text.includes('consensus') || text.includes('consensos') || text.includes('position statement')) {
        return { score: 5, label: 'Diretriz Clínica (Guideline)', isGuideline: true };
    }

    // 2. NÍVEL 1: Revisões Sistemáticas e Meta-análises
    if (text.includes('meta-analysis') || text.includes('meta-análise') || text.includes('systematic review') || text.includes('revisão sistemática')) {
        return { score: 5, label: 'Nível 1: Meta-análise/Rev. Sistemática', isGuideline: false };
    }

    // 3. NÍVEL 2: Ensaios Clínicos Randomizados (RCT)
    if (text.includes('randomized') || text.includes('randomizado') || text.includes('clinical trial') || text.includes('ensaio clínico')) {
        return { score: 4, label: 'Nível 2: Ensaio Clínico Randomizado', isGuideline: false };
    }

    // 4. NÍVEL 3: Estudos de Coorte
    if (text.includes('cohort') || text.includes('coorte') || text.includes('longitudinal') || text.includes('prospective') || text.includes('prospectivo')) {
        return { score: 3, label: 'Nível 3: Estudo de Coorte', isGuideline: false };
    }

    // 5. NÍVEL 4: Caso-Controle
    if (text.includes('case-control') || text.includes('caso-controle') || text.includes('retrospective') || text.includes('retrospectivo')) {
        return { score: 2, label: 'Nível 4: Estudo Caso-Controle', isGuideline: false };
    }

    // 6. NÍVEL 5: Série de Casos / Relatos / Opinião
    if (text.includes('case report') || text.includes('relato de caso') || text.includes('case series') || text.includes('série de casos')) {
        return { score: 1, label: 'Nível 5: Relato de Caso/Série', isGuideline: false };
    }

    // Padrão (Estudos primários não especificados ou artigos gerais)
    return { score: 2, label: 'Artigo Científico / Estudo Primário', isGuideline: false };
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      if (activeTab === 'book') {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=9&langRestrict=pt`);
        const data = await response.json();
        
        if (data.items) {
          const formatted: SearchResult[] = data.items.map((item: any) => ({
            id: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors?.join(', ') || 'Autor Desconhecido',
            description: item.volumeInfo.description?.slice(0, 200) + '...' || 'Sem descrição.',
            url: item.volumeInfo.previewLink || item.volumeInfo.infoLink,
            type: InputType.URL, 
            thumbnail: item.volumeInfo.imageLinks?.thumbnail
          }));
          setResults(formatted);
        }

      } else if (activeTab === 'article') {
        // Busca na OpenAlex
        const response = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=12`);
        const data = await response.json();

        if (data.results) {
           const formatted: SearchResult[] = data.results.map((item: any) => {
             // Calculamos a confiabilidade baseada no título e tipo
             const reliability = calculateReliability(item.display_name || item.title, item.abstract_inverted_index ? 'abstract available' : '');
             
             return {
                id: item.id,
                title: item.display_name || item.title,
                author: item.authorships?.[0]?.author?.display_name || 'Pesquisador Acadêmico',
                description: `Publicado em: ${item.publication_year}. Citado por: ${item.cited_by_count}. Revista: ${item.primary_location?.source?.display_name || 'Fonte Acadêmica'}`,
                url: item.doi || item.primary_location?.landing_page_url || `https://openalex.org/${item.id}`,
                type: InputType.DOI,
                thumbnail: undefined,
                reliabilityScore: reliability.score,
                reliabilityLabel: reliability.label,
                isGuideline: reliability.isGuideline
             };
           });
           
           // ORDENAÇÃO INTELIGENTE: Guidelines primeiro, depois maior Score
           const sorted = formatted.sort((a, b) => {
               if (a.isGuideline && !b.isGuideline) return -1;
               if (!a.isGuideline && b.isGuideline) return 1;
               return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
           });

           setResults(sorted);
        }

      } else {
        const response = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=9`);
        const data = await response.json();

        if (data.query?.search) {
            const formatted: SearchResult[] = data.query.search.map((item: any) => ({
                id: item.pageid.toString(),
                title: item.title,
                author: 'Wikipedia / Web',
                description: item.snippet.replace(/<[^>]*>?/gm, '') + '...',
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
                    placeholder={`Pesquisar ${activeTab === 'book' ? 'livros' : activeTab === 'article' ? 'ciência (ex: ansiedade treatment systematic review)' : 'conceitos'}...`} 
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
                        <div key={item.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all flex flex-col h-full group relative ${item.isGuideline ? 'border-yellow-400 ring-1 ring-yellow-200 bg-yellow-50/30' : 'border-gray-200'}`}>
                            
                            {/* SELO DE GUIDELINE */}
                            {item.isGuideline && (
                                <div className="absolute -top-3 -right-2 bg-yellow-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                                    <Shield className="w-3 h-3 fill-white" /> GUIDELINE
                                </div>
                            )}

                            <div className="flex items-start gap-4 mb-3">
                                {item.thumbnail ? (
                                    <img src={item.thumbnail} alt={item.title} className="w-16 h-24 object-cover rounded shadow-sm shrink-0" />
                                ) : (
                                    <div className={`w-16 h-24 flex items-center justify-center rounded shrink-0 ${activeTab === 'book' ? 'bg-orange-100 text-orange-500' : activeTab === 'article' ? 'bg-blue-100 text-blue-500' : 'bg-indigo-100 text-indigo-500'}`}>
                                        {activeTab === 'book' ? <BookOpen className="w-8 h-8"/> : activeTab === 'article' ? <FileText className="w-8 h-8"/> : <Globe className="w-8 h-8"/>}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <h4 className="font-bold text-gray-900 line-clamp-2 leading-tight mb-1 text-sm" title={item.title}>{item.title}</h4>
                                    <p className="text-xs text-gray-500 font-medium line-clamp-1">{item.author}</p>
                                    
                                    {/* CLASSIFICAÇÃO DA PIRÂMIDE (Só aparece em Artigos) */}
                                    {activeTab === 'article' && item.reliabilityScore !== undefined && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-0.5 mb-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star 
                                                        key={i} 
                                                        className={`w-3 h-3 ${i < (item.reliabilityScore || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} 
                                                        fill={i < (item.reliabilityScore || 0)}
                                                    />
                                                ))}
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.isGuideline ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : item.reliabilityScore && item.reliabilityScore >= 4 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                {item.reliabilityLabel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <p className="text-xs text-gray-600 line-clamp-4 mb-4 flex-1 leading-relaxed">{item.description}</p>
                            
                            <button 
                                onClick={() => { onAddSource(item.title, item.url, item.type); onClose(); }}
                                className={`w-full mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all ${item.isGuideline ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm' : 'bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200'}`}
                            >
                                <Plus className="w-4 h-4"/> {item.isGuideline ? 'Adicionar Guideline' : 'Adicionar Fonte'}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    {loading ? (
                        <div className="text-center animate-pulse">
                            <Globe className="w-12 h-12 mx-auto mb-4 text-indigo-200"/>
                            <p className="text-indigo-500 font-bold mb-2">Analisando evidências...</p>
                            <p className="text-xs">Classificando por nível de confiabilidade (0-5).</p>
                        </div>
                    ) : hasSearched ? (
                        <div className="text-center">
                            <Search className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                            <p>Nenhum resultado encontrado para "{query}".</p>
                            <p className="text-xs mt-2">Tente termos em inglês para mais artigos científicos (ex: "Anxiety guidelines").</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Globe className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                            <p>Digite um tema para buscar conhecimento.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
