import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, Plus, X, Globe, Loader2, HelpCircle, Shield } from './Icons';
import { InputType } from '../types';

interface SearchResult {
    id: string;
    title: string;
    author: string;
    description: string;
    url: string;
    type: InputType;
    thumbnail?: string;
    reliabilityScore?: number; // 1 a 5 (5 é o melhor)
    reliabilityLabel?: string;
    isGuideline?: boolean;
}

interface SearchResourcesModalProps {
    onClose: () => void;
    onAddSource: (name: string, content: string, type: InputType) => void;
}

// COMPONENTE VISUAL: Barra de Nível de Evidência
const EvidenceLevelBar = ({ score, isGuideline }: { score: number, isGuideline?: boolean }) => {
    let color = 'bg-gray-300';
    let width = '20%';

    if (isGuideline) { color = 'bg-purple-600'; width = '100%'; }
    else if (score === 5) { color = 'bg-emerald-600'; width = '100%'; } // Meta-análise (Verde Escuro)
    else if (score === 4) { color = 'bg-green-500'; width = '80%'; }   // RCT (Verde Claro)
    else if (score === 3) { color = 'bg-yellow-400'; width = '60%'; }  // Coorte (Amarelo)
    else if (score === 2) { color = 'bg-orange-500'; width = '40%'; }  // Caso-controle (Laranja)
    else { color = 'bg-red-500'; width = '20%'; }                      // Outros (Vermelho)

    return (
        <div className="flex flex-col gap-1 w-full max-w-[120px]">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-500`} style={{ width }}></div>
            </div>
            <span className={`text-[9px] uppercase font-bold tracking-wider ${isGuideline ? 'text-purple-700' : 'text-gray-500'}`}>
                {isGuideline ? 'Guideline (Máximo)' : `Nível ${6 - score}`}
            </span>
        </div>
    );
};

export const SearchResourcesModal: React.FC<SearchResourcesModalProps> = ({ onClose, onAddSource }) => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'book' | 'article' | 'web'>('article');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'GUIDELINE' | 'META' | 'RCT'>('ALL'); // Filtro de Tipo de Estudo
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Controle do Tutorial
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        const hideTutorial = localStorage.getItem('neurostudy_hide_search_tutorial');
        if (!hideTutorial) {
            setShowTutorial(true);
        }
    }, []);

    // AUTO-BUSCA AO TROCAR DE ABA
    useEffect(() => {
        if (query.trim() && hasSearched) {
            handleSearch();
        }
    }, [activeTab]);

    const handleCloseTutorial = (dontShowAgain: boolean) => {
        setShowTutorial(false);
        if (dontShowAgain) {
            localStorage.setItem('neurostudy_hide_search_tutorial', 'true');
        }
    };

    // --- LÓGICA DE HIERARQUIA DE EVIDÊNCIA ---
    const calculateReliability = (title: string, abstract: string = ''): { score: number, label: string, isGuideline: boolean } => {
        const text = (title + ' ' + abstract).toLowerCase();

        // 1. GUIDELINES (TOPO)
        if (text.includes('guideline') || text.includes('diretriz') || text.includes('consensus') || text.includes('recommendation')) {
            return { score: 5, label: 'Diretriz Clínica (Guideline)', isGuideline: true };
        }
        // 2. META-ANÁLISE / REVISÃO SISTEMÁTICA
        if (text.includes('meta-analysis') || text.includes('systematic review') || text.includes('revisão sistemática')) {
            return { score: 5, label: 'Revisão Sistemática / Meta-análise', isGuideline: false };
        }
        // 3. ENSAIO CLÍNICO RANDOMIZADO (RCT)
        if (text.includes('randomized') || text.includes('randomizado') || text.includes('clinical trial')) {
            return { score: 4, label: 'Ensaio Clínico Randomizado (RCT)', isGuideline: false };
        }
        // 4. COORTE
        if (text.includes('cohort') || text.includes('coorte') || text.includes('longitudinal')) {
            return { score: 3, label: 'Estudo de Coorte', isGuideline: false };
        }
        // 5. CASO-CONTROLE
        if (text.includes('case-control') || text.includes('caso-controle')) {
            return { score: 2, label: 'Estudo Caso-Controle', isGuideline: false };
        }
        // 6. OUTROS
        return { score: 1, label: 'Estudo Primário / Opinião', isGuideline: false };
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setFilter('ALL'); // Reseta filtro ao buscar

        try {
            if (activeTab === 'book') {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40&langRestrict=pt`);
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
                // AUMENTADO PARA 40 RESULTADOS
                const response = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=40&sort=cited_by_count:desc`);
                const data = await response.json();

                if (data.results) {
                    const formatted: SearchResult[] = data.results.map((item: any) => {
                        const reliability = calculateReliability(item.display_name || item.title, item.abstract_inverted_index ? 'abstract available' : '');
                        return {
                            id: item.id,
                            title: item.display_name || item.title,
                            author: item.authorships?.[0]?.author?.display_name || 'Pesquisador',
                            description: `Publicado em: ${item.publication_year}. Citações: ${item.cited_by_count}.`,
                            url: item.doi || item.primary_location?.landing_page_url || `https://openalex.org/${item.id}`,
                            type: InputType.DOI,
                            thumbnail: undefined,
                            reliabilityScore: reliability.score,
                            reliabilityLabel: reliability.label,
                            isGuideline: reliability.isGuideline
                        };
                    });

                    // ORDENAÇÃO FORÇADA: Guidelines > Score > Citações
                    const sorted = formatted.sort((a, b) => {
                        if (a.isGuideline && !b.isGuideline) return -1;
                        if (!a.isGuideline && b.isGuideline) return 1;
                        return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
                    });

                    setResults(sorted);
                }

            } else {
                const response = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=40`);
                const data = await response.json();
                if (data.query?.search) {
                    const formatted: SearchResult[] = data.query.search.map((item: any) => ({
                        id: item.pageid.toString(),
                        title: item.title,
                        author: 'Wikipedia',
                        description: item.snippet.replace(/<[^>]*>?/gm, '') + '...',
                        url: `https://pt.wikipedia.org/?curid=${item.pageid}`,
                        type: InputType.URL
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

    // Lógica de Filtragem Visual
    const filteredResults = results.filter(r => {
        if (activeTab !== 'article') return true;
        if (filter === 'ALL') return true;
        if (filter === 'GUIDELINE') return r.isGuideline;
        if (filter === 'META') return r.reliabilityScore === 5 && !r.isGuideline;
        if (filter === 'RCT') return r.reliabilityScore === 4;
        return true;
    });

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">

            {/* TUTORIAL LÍQUIDO / GLASSMORPHISM */}
            {showTutorial && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-900 border border-indigo-500/30 shadow-2xl rounded-3xl p-8 max-w-lg text-white relative animate-in zoom-in duration-300">
                        <div className="absolute top-0 right-0 p-4">
                            <button onClick={() => setShowTutorial(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <Globe className="w-8 h-8 text-white" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold mb-2">Como Pesquisar como um Pro</h2>
                                <p className="text-white/80 leading-relaxed">
                                    O NeuroStudy prioriza a ciência. Para encontrar os melhores estudos ("High Relevance"):
                                </p>
                            </div>

                            <div className="text-left bg-black/20 p-4 rounded-xl space-y-3 w-full border border-white/10">
                                <div className="flex items-center gap-3">
                                    <span className="bg-emerald-500 w-2 h-2 rounded-full shrink-0"></span>
                                    <p className="text-sm"><span className="font-bold text-emerald-300">Seja Específico:</span> Evite "Ansiedade". Use "Terapia Cognitiva Ansiedade" ou "Anxiety treatment".</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="bg-blue-500 w-2 h-2 rounded-full shrink-0"></span>
                                    <p className="text-sm"><span className="font-bold text-blue-300">Use Inglês:</span> 95% da ciência está em inglês. Termos como <i>"Systematic Review"</i> trazem ouro.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="bg-purple-500 w-2 h-2 rounded-full shrink-0"></span>
                                    <p className="text-sm"><span className="font-bold text-purple-300">Olhe a Barra:</span> A barra colorida indica o nível de evidência (Guidelines no topo).</p>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full pt-2">
                                <button onClick={() => handleCloseTutorial(false)} className="flex-1 py-3 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors">Entendi</button>
                                <button onClick={() => handleCloseTutorial(true)} className="px-4 py-3 bg-transparent border border-white/30 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm">Não mostrar mais</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">

                {/* Header */}
                <div className="bg-white border-b border-gray-100 p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-600" /> Pesquisar Fontes</h3>

                        {/* FILTROS (CHIPS) */}
                        {activeTab === 'article' && results.length > 0 && (
                            <div className="hidden md:flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-4">
                                <span className="text-xs font-bold text-gray-400 uppercase mr-1">Filtrar:</span>
                                <button onClick={() => setFilter('ALL')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Todos</button>
                                <button onClick={() => setFilter('GUIDELINE')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${filter === 'GUIDELINE' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}><Shield className="w-3 h-3" /> Diretrizes</button>
                                <button onClick={() => setFilter('META')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${filter === 'META' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Meta-Review</button>
                                <button onClick={() => setFilter('RCT')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${filter === 'RCT' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>RCTs</button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowTutorial(true)} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Como pesquisar?"><HelpCircle className="w-5 h-5" /></button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                </div>

                {/* Tabs & Search */}
                <div className="p-6 bg-slate-50 border-b border-gray-200 shrink-0 space-y-4">
                    <div className="flex gap-2 justify-center">
                        <button onClick={() => setActiveTab('article')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'article' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><FileText className="w-4 h-4" /> Artigos Científicos</button>
                        <button onClick={() => setActiveTab('book')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><BookOpen className="w-4 h-4" /> Livros</button>
                        <button onClick={() => setActiveTab('web')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'web' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Globe className="w-4 h-4" /> Wiki / Conceitos</button>
                    </div>

                    <div className="relative max-w-2xl mx-auto group">
                        <input
                            autoFocus
                            type="text"
                            placeholder={activeTab === 'article' ? "Ex: 'Anxiety treatment systematic review' (Inglês é melhor)" : "Digite o tema..."}
                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-lg shadow-sm transition-all"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 group-focus-within:text-indigo-500 transition-colors" />
                        <button
                            onClick={handleSearch}
                            disabled={loading || !query.trim()}
                            className="absolute right-2 top-2 bottom-2 px-6 bg-slate-900 hover:bg-black text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                        </button>
                    </div>

                    {/* Dica Rápida */}
                    <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
                        <Globe className="w-3 h-3" /> Dica: Busque <span className="font-bold text-gray-700">"Guidelines"</span> ou <span className="font-bold text-gray-700">"Meta-analysis"</span> junto com o tema para ver o topo da pirâmide.
                    </p>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                    {filteredResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredResults.map((item) => (
                                <div key={item.id} className={`bg-white p-5 rounded-xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full group relative ${item.isGuideline ? 'border-purple-300 ring-1 ring-purple-100 bg-purple-50/20' : 'border-gray-200'}`}>

                                    {/* SELO DE GUIDELINE */}
                                    {item.isGuideline && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 tracking-wider uppercase z-10">
                                            <Shield className="w-3 h-3 fill-white" /> Recomendado
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-3">
                                        {/* TIPO DE FONTE E BARRA DE EVIDÊNCIA */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`p-1.5 rounded-lg ${activeTab === 'book' ? 'bg-orange-100 text-orange-600' : activeTab === 'article' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {activeTab === 'book' ? <BookOpen className="w-4 h-4" /> : activeTab === 'article' ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                                </div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate max-w-[100px]">{item.author}</span>
                                            </div>
                                        </div>
                                        {activeTab === 'article' && item.reliabilityScore !== undefined && (
                                            <EvidenceLevelBar score={item.reliabilityScore} isGuideline={item.isGuideline} />
                                        )}
                                    </div>

                                    <h4 className="font-bold text-gray-900 leading-tight mb-2 text-sm line-clamp-2 group-hover:text-indigo-700 transition-colors" title={item.title}>{item.title}</h4>

                                    <p className="text-xs text-gray-600 line-clamp-3 mb-4 flex-1 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">{item.description}</p>

                                    <button
                                        onClick={() => { onAddSource(item.title, item.url, item.type); onClose(); }}
                                        className={`w-full mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all ${item.isGuideline ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' : 'bg-white hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border-2 border-gray-100 hover:border-indigo-200'}`}
                                    >
                                        <Plus className="w-4 h-4" /> {item.isGuideline ? 'Adicionar Guideline' : 'Adicionar ao Estudo'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            {loading ? (
                                <div className="text-center animate-pulse">
                                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                    </div>
                                    <p className="text-indigo-600 font-bold mb-1">Filtrando o melhor conteúdo...</p>
                                    <p className="text-xs">Priorizando Guidelines e Revisões Sistemáticas.</p>
                                </div>
                            ) : hasSearched ? (
                                <div className="text-center max-w-md mx-auto">
                                    <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="font-bold text-gray-600 mb-2">
                                        {filter !== 'ALL' ? 'Nenhum resultado com este filtro.' : 'Nenhum resultado relevante encontrado.'}
                                    </p>
                                    <p className="text-sm">Tente remover os filtros ou usar termos mais amplos.</p>
                                </div>
                            ) : (
                                <div className="text-center max-w-md mx-auto opacity-60">
                                    <Shield className="w-20 h-20 mx-auto mb-6 text-indigo-200" />
                                    <h3 className="text-lg font-bold text-gray-600 mb-2">Pesquisa Baseada em Evidências</h3>
                                    <p className="text-sm">Nossa IA organiza os resultados por confiabilidade. Guidelines e Meta-análises aparecem primeiro.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
