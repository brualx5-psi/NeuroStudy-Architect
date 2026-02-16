import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StudyGuide, CoreConcept } from '../types';
import { generateTool, generateDiagram, generateDiagramSvg, isUsageLimitError } from '../services/geminiService';
import {
    CheckCircle, BookOpen, Brain, Target,
    Smile, RefreshCw, Layers, Calendar, Clock,
    ChevronDown, ChevronRight, PenTool, Zap, Lightbulb, Crown, FileDown, Rocket as NotionIcon,
    Eye, X, Download
} from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { LimitReason } from '../services/usageLimits';

interface ResultsViewProps {
    guide: StudyGuide;
    onReset: () => void;
    onGenerateQuiz: () => void;
    onGoToFlashcards: () => void;
    onUpdateGuide: (updatedGuide: StudyGuide) => void;
    isParetoOnly?: boolean;
    onScheduleReview?: (studyId: string) => void;
    isReviewScheduled?: boolean;
    onOpenSubscription: () => void;
    onUsageLimit?: (reason: LimitReason) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
    guide, onReset, onGenerateQuiz, onGoToFlashcards, onUpdateGuide, isParetoOnly, onScheduleReview, isReviewScheduled, onOpenSubscription, onUsageLimit
}) => {
    const { isPaid, canUseFeynman, incrementUsage, usage } = useAuth();

    // Estado para controlar qual conceito está carregando/expandido
    const [insightLoading, setInsightLoading] = useState<number | null>(null);
    const [expandedConcepts, setExpandedConcepts] = useState<Set<number>>(new Set());
    const [activeInsightTab, setActiveInsightTab] = useState<Record<number, 'feynman' | 'example' | 'interdisciplinary'>>({});
    const [interdisciplinaryInput, setInterdisciplinaryInput] = useState<Record<number, string>>({}); // Armazena o tema digitado por card

    const [loadingDiagramForCheckpoint, setLoadingDiagramForCheckpoint] = useState<string | null>(null);
    const [isCelebrating, setIsCelebrating] = useState(false); // Estado para animação de celebração
    const [openDiagram, setOpenDiagram] = useState<{ url: string; title?: string } | null>(null);
    const [isHudCollapsed, setIsHudCollapsed] = useState(false);

    // Função "Insight Cerebral": Apenas expande a visualização. A geração agora é sob demanda (lazy).
    const handleInsightClick = (index: number) => {
        const newExpanded = new Set(expandedConcepts);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedConcepts(newExpanded);
    };

    // Nova função para gerenciar o clique na aba e gerar conteúdo se necessário
    const handleInsightTabClick = async (index: number, tab: 'feynman' | 'example' | 'interdisciplinary', concept: CoreConcept, customDomain?: string) => {
        // Se for interdisciplinar e não tiver domínio e não for apenas mudança de aba, espera input
        if (tab === 'interdisciplinary' && !customDomain && !concept.tools?.interdisciplinary) {
            setActiveInsightTab(prev => ({ ...prev, [index]: tab }));
            return; // Aguarda o usuário digitar e confirmar
        }

        setActiveInsightTab(prev => ({ ...prev, [index]: tab }));

        // Se já tem o conteúdo, não faz nada
        if (tab === 'feynman' && concept.tools?.feynman) return;
        if (tab === 'example' && concept.tools?.example) return;
        // Para interdisciplinar, sempre regenera se vier um customDomain novo, ou usa cache se não vier
        if (tab === 'interdisciplinary' && !customDomain && concept.tools?.interdisciplinary) return;

        // Se não tem, gera
        setInsightLoading(index);
        try {
            let toolType: 'explainLikeIm5' | 'realWorldApplication' | 'interdisciplinary';

            if (tab === 'feynman') {
                if (!canUseFeynman()) {
                    onOpenSubscription();
                    setInsightLoading(null);
                    return;
                }
                toolType = 'explainLikeIm5';
            }
            else if (tab === 'example') toolType = 'realWorldApplication';
            else toolType = 'interdisciplinary';

            const content = await generateTool(toolType, concept.concept, concept.definition, customDomain);

            const newConcepts = [...(guide.coreConcepts || [])];
            if (!newConcepts[index].tools) newConcepts[index].tools = {};

            if (tab === 'feynman') {
                newConcepts[index].tools!.feynman = content;
                await incrementUsage({ feynman_used: 1 });
            }
            else if (tab === 'example') newConcepts[index].tools!.example = content;
            else newConcepts[index].tools!.interdisciplinary = content;

            onUpdateGuide({ ...guide, coreConcepts: newConcepts });
        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            } else {
                console.error(error);
                alert("Erro ao gerar insight.");
            }
        } finally {
            setInsightLoading(null);
        }
    };

    const handleGenerateCheckpointDiagram = async (checkpointId: string, description: string) => {
        setLoadingDiagramForCheckpoint(checkpointId);
        try {
            // For checkpoints, prefer simple SVG "copyable" illustrations.
            const { url } = await generateDiagramSvg(description);
            const newCheckpoints = guide.checkpoints?.map(c =>
                c.id === checkpointId ? { ...c, imageUrl: url, diagramCode: '' } : c
            );
            onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            } else {
                alert(`Erro ao gerar desenho: ${error?.message || error}`);
            }
        } finally {
            setLoadingDiagramForCheckpoint(null);
        }
    };

    const handleUpdateDiagram = (checkpointId: string, newCode: string, newUrl: string) => {
        const newCheckpoints = guide.checkpoints?.map(c =>
            c.id === checkpointId ? { ...c, imageUrl: newUrl, diagramCode: newCode } : c
        );
        onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
    };

    const toggleCheckpoint = (id: string) => {
        const newCheckpoints = guide.checkpoints?.map(c =>
            c.id === id ? { ...c, completed: !c.completed } : c
        );

        // Se marcou como completo, aciona celebração
        const isNowCompleted = newCheckpoints?.find(c => c.id === id)?.completed;
        if (isNowCompleted) {
            setIsCelebrating(true);
            setTimeout(() => setIsCelebrating(false), 3000);
        }

        onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
    };

    const studyIdPlaceholder = 'study-id-placeholder';

    const isBook = !!guide.bookChapters;

    // Função para marcar capítulo como lido (agora com persistência visual local)
    const toggleChapterRead = (index: number) => {
        if (!guide.bookChapters) return;
        const newChapters = [...guide.bookChapters];
        newChapters[index].completed = !newChapters[index].completed;
        onUpdateGuide({ ...guide, bookChapters: newChapters });
    };

    // Lógica de Progresso e Gamificação
    const getProgressStats = () => {
        if (isBook && guide.bookChapters) {
            const total = guide.bookChapters.length;
            const completed = guide.bookChapters.filter(c => c.completed).length;
            const nextItem = guide.bookChapters.find(c => !c.completed);
            return { total, completed, percent: Math.round((completed / total) * 100), nextTitle: nextItem?.title };
        } else if (guide.checkpoints) {
            const total = guide.checkpoints.length;
            const completed = guide.checkpoints.filter(c => c.completed).length;
            const nextItem = guide.checkpoints.find(c => !c.completed);
            return { total, completed, percent: Math.round((completed / total) * 100), nextTitle: nextItem?.mission };
        }
        return { total: 0, completed: 0, percent: 0, nextTitle: null };
    };

    const { percent, nextTitle } = getProgressStats();

    return (
        <div className={`max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isHudCollapsed ? 'pb-32' : 'pb-64'}`}> {/* Ajusta espaço para a barra fixa */}

            {/* Modal: Visualizar diagrama */}
            {openDiagram?.url && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setOpenDiagram(null)}
                >
                    <div
                        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{openDiagram.title || 'Diagrama'}</p>
                                <p className="text-xs text-gray-500">Visualização</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={openDiagram.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-2"
                                >
                                    <Download className="w-3 h-3" /> Abrir/baixar
                                </a>
                                <button
                                    onClick={() => setOpenDiagram(null)}
                                    className="p-2 text-gray-500 hover:text-gray-800"
                                    aria-label="Fechar"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[85vh] overflow-auto bg-gray-50">
                            <div className="p-6 bg-[#fbfbf8]">
                              <img
                                  src={openDiagram.url}
                                  alt="Desenho"
                                  className="w-full h-auto object-contain bg-[#fbfbf8] rounded-xl border border-gray-200 shadow-sm"
                                  style={{ filter: 'grayscale(1) contrast(1.15)' }}
                              />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Animations for HUD */}
            <style>{`
                @keyframes confetti {
                    0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
                    50% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(80px) rotate(720deg) scale(0.5); }
                }
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
            `}</style>

            {/* HEADER - ADVANCE ORGANIZER (Contexto do Livro ou Material) */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl -z-10 opacity-50"></div>

                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className={`inline - block px - 3 py - 1 rounded - full text - xs font - bold uppercase tracking - wider mb - 2 ${isBook ? 'bg-orange-100 text-orange-700' : isParetoOnly ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'} `}>
                            {isBook ? 'Resumo de Livro (NeuroStudy)' : isParetoOnly ? 'Modo Pareto 80/20' : 'Roteiro de Estudo'}
                        </span>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{guide.title}</h1>
                    </div>
                    {/* Botão Novo - some em Pareto puro, mas aparece em Livro */}
                    {!isParetoOnly && (
                        <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-bold transition-colors text-sm">
                            <RefreshCw className="w-4 h-4" /> Novo
                        </button>
                    )}
                </div>

                {/* ADVANCE ORGANIZER: VISUALIZAÇÃO CONDICIONAL */}
                {isParetoOnly && !isBook ? (
                    /* MODO PARETO TEXTO (Mantido) */
                    <div className="mt-8 animate-in fade-in duration-700">
                        <div className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-red-700 prose-strong:font-bold prose-a:text-indigo-600 hover:prose-a:text-indigo-500">
                            <ReactMarkdown>{guide.overview}</ReactMarkdown>
                        </div>
                        {guide.coreConcepts && guide.coreConcepts.length > 0 && (
                            <div className="mt-12 pt-8 border-t border-gray-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-red-500" /> Pontos Chave Resumidos
                                </h3>
                                <ul className="space-y-4">
                                    {guide.coreConcepts.map((concept: any, i: number) => (
                                        <li key={i} className="text-gray-700">
                                            <strong className="text-gray-900 block mb-1">{concept.concept}</strong>
                                            {concept.definition}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    /* MODO NORMAL E MODO LIVRO */
                    <div className="mt-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500" /> {isBook ? 'Advance Organizer: O que esperar' : 'Advance Organizer'}
                        </span>
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-lg shadow-inner">
                            {guide.overview}
                        </div>
                    </div>
                )}
            </div>

            {/* SEÇÃO 1: CONCEITOS GLOBAIS (Em Livro = Pareto Global) */}
            {(!isParetoOnly || isBook) && guide.coreConcepts && guide.coreConcepts.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-2 px-2">
                        {isBook ? <Target className="w-6 h-6 text-red-500" /> : <BookOpen className="w-6 h-6 text-indigo-600" />}
                        <h2 className="text-xl font-bold text-gray-800">
                            {isBook ? 'Pareto Global (A "Big Picture")' : 'Conceitos Fundamentais'}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Lista de Conceitos com Insight Cerebral (Reutilizada lógica existente) */}
                        {guide.coreConcepts.map((concept: any, idx: number) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative group">
                                <div className="flex justify-between items-start mb-4 pr-8">
                                    <div className="flex items-center gap-4">
                                        <div className={`w - 10 h - 10 rounded - xl ${isBook ? 'bg-red-100 text-red-700' : 'bg-indigo-600 text-white'} flex items - center justify - center font - bold text - lg shadow - lg shrink - 0`}>
                                            {idx + 1}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 leading-tight">{concept.concept}</h3>
                                    </div>
                                    <div className="absolute top-4 right-4">
                                        <button onClick={() => handleInsightClick(idx)} disabled={insightLoading === idx} className={`p - 2 rounded - full transition - all duration - 300 ${expandedConcepts.has(idx) ? 'bg-purple-100 text-purple-600 rotate-180' : 'bg-gray-100 text-gray-400 hover:bg-purple-50 hover:text-purple-500 hover:scale-110'} `} title="Insight Cerebral (Expandir)">
                                            {insightLoading === idx ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Brain className="w-6 h-6" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-600 leading-relaxed text-base pl-[3.5rem]">{concept.definition}</p>
                                {/* ÁREA EXPANDIDA (Igual ao original) */}
                                {expandedConcepts.has(idx) && (
                                    <div className="mt-6 pl-0 md:pl-[3.5rem] animate-in fade-in slide-in-from-top-2">

                                        <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2 overflow-x-auto">
                                            <button onClick={() => handleInsightTabClick(idx, 'feynman', concept)} className={`shrink - 0 px - 4 py - 2 rounded - lg text - xs font - bold flex items - center gap - 2 transition - all ${activeInsightTab[idx] === 'feynman' ? 'bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200' : 'text-gray-400 hover:bg-gray-50'} `}>
                                                <Smile className="w-4 h-4" />
                                                Feynman
                                                {!isPaid && <span className="text-[9px] bg-slate-100 px-1 rounded ml-1">{(usage?.feynman_used || 0)}/3</span>}
                                            </button>
                                            <button onClick={() => handleInsightTabClick(idx, 'example', concept)} className={`shrink - 0 px - 4 py - 2 rounded - lg text - xs font - bold flex items - center gap - 2 transition - all ${activeInsightTab[idx] === 'example' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200' : 'text-gray-400 hover:bg-gray-50'} `}><Target className="w-4 h-4" /> Aplicação</button>
                                            <button onClick={() => handleInsightTabClick(idx, 'interdisciplinary', concept)} className={`shrink - 0 px - 4 py - 2 rounded - lg text - xs font - bold flex items - center gap - 2 transition - all ${activeInsightTab[idx] === 'interdisciplinary' ? 'bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-200' : 'text-gray-400 hover:bg-gray-50'} `}><Layers className="w-4 h-4" /> Conexão</button>
                                        </div>

                                        {/* Input para Conexão Interdisciplinar */}
                                        {activeInsightTab[idx] === 'interdisciplinary' && (
                                            <div className="mb-4 animate-in slide-in-from-top-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                                                <p className="text-[10px] uppercase font-bold text-purple-600 mb-2">Com o que conectar?</p>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: Cinema, Biologia, História..."
                                                        className="flex-1 text-sm p-2 rounded-lg border-purple-200 focus:ring-2 focus:ring-purple-400 outline-none"
                                                        value={interdisciplinaryInput[idx] || ''}
                                                        onChange={(e) => setInterdisciplinaryInput(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleInsightTabClick(idx, 'interdisciplinary', concept, interdisciplinaryInput[idx])}
                                                    />
                                                    <button
                                                        onClick={() => handleInsightTabClick(idx, 'interdisciplinary', concept, interdisciplinaryInput[idx])}
                                                        className="px-4 bg-purple-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-purple-700"
                                                    >
                                                        Gerar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {insightLoading === idx && <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center gap-2 text-gray-500 animate-pulse"><RefreshCw className="w-5 h-5 animate-spin" /> Processando Inteligência...</div>}
                                        {insightLoading !== idx && (
                                            <>
                                                {activeInsightTab[idx] === 'feynman' && concept.tools?.feynman && <div className="bg-green-50 p-6 rounded-2xl border border-green-100 relative overflow-hidden animate-in fade-in"><div className="absolute top-0 right-0 p-2 opacity-10"><Smile className="w-16 h-16 text-green-600" /></div><div className="text-green-900 leading-relaxed text-sm relative z-10 prose prose-sm max-w-none"><ReactMarkdown>{concept.tools?.feynman}</ReactMarkdown></div></div>}
                                                {activeInsightTab[idx] === 'example' && concept.tools?.example && <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden animate-in fade-in"><div className="absolute top-0 right-0 p-2 opacity-10"><Target className="w-16 h-16 text-blue-600" /></div><div className="text-blue-900 leading-relaxed text-sm relative z-10 prose prose-sm max-w-none"><ReactMarkdown>{concept.tools.example}</ReactMarkdown></div></div>}
                                                {activeInsightTab[idx] === 'interdisciplinary' && concept.tools?.interdisciplinary && <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 relative overflow-hidden animate-in fade-in"><div className="absolute top-0 right-0 p-2 opacity-10"><Layers className="w-16 h-16 text-purple-600" /></div><div className="text-purple-900 leading-relaxed text-sm relative z-10 prose prose-sm max-w-none"><ReactMarkdown>{concept.tools.interdisciplinary}</ReactMarkdown></div></div>}
                                                {!activeInsightTab[idx] && <div className="p-4 text-center text-xs text-gray-400 italic">Selecione uma ferramenta acima para desbloquear inteligência.</div>}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* SEÇÃO 1.5: CONCEITOS DE SUPORTE (O Contexto 80%) */}
            {(!isParetoOnly || isBook) && guide.supportConcepts && guide.supportConcepts.length > 0 && (
                <section className="space-y-4 animate-in slide-in-from-bottom-6 duration-700">
                    <div className="flex items-center gap-2 px-2">
                        <Lightbulb className="w-5 h-5 text-amber-500" />
                        <h2 className="text-lg font-bold text-gray-700">
                            Conceitos de Suporte (Contexto)
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {guide.supportConcepts.map((concept: any, idx: number) => (
                            <div key={idx} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 hover:bg-amber-50 transition-colors">
                                <h3 className="font-bold text-gray-800 mb-1 text-sm flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                    {concept.concept}
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">{concept.definition}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* SEÇÃO 2: CAPÍTULOS DO LIVRO (Só aparece em modo Livro) */}
            {isBook && guide.bookChapters && guide.bookChapters.length > 0 && (
                <section className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-2 px-2">
                        <Layers className="w-6 h-6 text-orange-500" />
                        <h2 className="text-xl font-bold text-gray-800">Capítulos do Livro</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {guide.bookChapters.map((chapter: any, i: number) => (
                            <details key={i} className={`group p - 6 rounded - 2xl border - l - 4 shadow - sm transition - all ${chapter.completed ? 'bg-green-50 border-green-500' : 'bg-white border-orange-400 open:ring-2 open:ring-orange-100'} `}>
                                <summary className="flex flex-col gap-4 cursor-pointer list-none outline-none">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg group-open:rotate-180 transition-transform">
                                                <ChevronDown className="w-5 h-5" />
                                            </div>
                                            <h3 className={`text - xl font - bold ${chapter.completed ? 'text-green-800' : 'text-gray-800'} `}>
                                                {chapter.title}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={(e) => { e.preventDefault(); toggleChapterRead(i); }}
                                            className={`flex items - center gap - 2 px - 3 py - 1.5 rounded - full text - xs font - bold transition - all border ${chapter.completed ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-white text-gray-400 border-gray-200 hover:border-green-400 hover:text-green-600'} `}
                                            title="Marcar como lido"
                                        >
                                            {chapter.completed ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                                            {chapter.completed ? 'LIDO' : 'MARCAR'}
                                        </button>
                                    </div>

                                    {/* Pareto Chunk (Always Visible) */}
                                    <div className={`p - 4 rounded - xl border ${chapter.completed ? 'bg-white/50 border-green-100' : 'bg-orange-50 border-orange-100'} group - open: bg - white group - open: border - orange - 200`}>
                                        <span className={`text - [10px] font - bold uppercase tracking - wider mb - 2 block flex items - center gap - 1 ${chapter.completed ? 'text-green-600' : 'text-orange-600'} `}>
                                            <Zap className="w-3 h-3" /> Essência (80/20)
                                        </span>
                                        <p className={`text - sm leading - relaxed ${chapter.completed ? 'text-green-900' : 'text-orange-900 font-medium'} `}>
                                            {chapter.paretoChunk}
                                        </p>
                                    </div>
                                </summary>

                                {/* Conteúdo Expandido */}
                                <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-top-4 border-t border-gray-100 pt-8">

                                    {/* 1. Texto Narrativo */}
                                    <div className="prose prose-lg px-2 text-gray-700 leading-relaxed">
                                        <ReactMarkdown>{chapter.content || ""}</ReactMarkdown>
                                    </div>

                                    {/* 2. Conceitos Locais */}
                                    {chapter.coreConcepts && chapter.coreConcepts.length > 0 && (
                                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-indigo-600" /> Conceitos Chave deste Capítulo</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                {chapter.coreConcepts.map((concept: any, idx: number) => (
                                                    <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                                        <strong className="text-indigo-700 block mb-1">{concept.concept}</strong>
                                                        <p className="text-sm text-gray-600">{concept.definition}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Pergunta de Reflexão */}
                                    {chapter.reflectionQuestion && (
                                        <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 flex gap-4 items-start">
                                            <div className="bg-yellow-100 p-2 rounded-full shrink-0"><Brain className="w-6 h-6 text-yellow-700" /></div>
                                            <div>
                                                <h4 className="font-bold text-yellow-800 mb-1">Check Mental</h4>
                                                <p className="text-yellow-900 font-medium italic">"{chapter.reflectionQuestion}"</p>
                                                <p className="text-xs text-yellow-600 mt-2 uppercase font-bold tracking-wide">Pausa para responder mentalmente antes de prosseguir.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Suporte Complementar */}
                                    {chapter.supportConcepts && chapter.supportConcepts.length > 0 && (
                                        <div className="border-t border-gray-100 pt-6">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block">Material Complementar</span>
                                            <div className="grid grid-cols-1 gap-3">
                                                {chapter.supportConcepts.map((sc: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-500">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0"></div>
                                                        <span><strong className="text-gray-700">{sc.concept}:</strong> {sc.definition}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>
            )}

            {/* SEÇÃO CHECKPOINTS: SÓ MOSTRA SE NÃO FOR LIVRO E NÃO FOR PARETO PURO */}
            {!isBook && !isParetoOnly && guide.checkpoints && guide.checkpoints.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mt-8">
                    <div className="bg-gray-50 p-6 border-b border-gray-200">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 text-xl"><Target className="w-6 h-6 text-red-500" /> Checkpoints de Aprendizado</h2>
                        <p className="text-sm text-gray-500 mt-1">Pontos chave para verificar se você realmente aprendeu.</p>
                    </div>
                    <div className="p-6 space-y-6">
                        {guide.checkpoints.map((checkpoint: any) => (
                            <div key={checkpoint.id}
                                className={`flex flex - col md: flex - row gap - 6 p - 6 rounded - 2xl border - 2 transition - all cursor - pointer hover: shadow - md ${checkpoint.completed ? 'bg-green-50 border-green-200 opacity-70' : 'bg-white border-gray-100 hover:border-indigo-100'} `}
                            >
                                <div className="flex-1 space-y-4" onClick={() => toggleCheckpoint(checkpoint.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w - 8 h - 8 rounded - full border - 2 flex items - center justify - center shrink - 0 transition - colors ${checkpoint.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'} `}>
                                            {checkpoint.completed && <CheckCircle className="w-5 h-5 text-white" />}
                                        </div>
                                        <div>
                                            <h4 className={`font - bold text - lg ${checkpoint.completed ? 'text-green-800 line-through' : 'text-gray-900'} `}>{checkpoint.mission}</h4>
                                            <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Momento sugerido: {checkpoint.timestamp}</p>
                                        </div>
                                    </div>
                                    <div className="pl-12 space-y-4">
                                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1 block flex items-center gap-1"><Zap className="w-3 h-3" /> O que procurar:</span>
                                            <p className="text-sm text-indigo-900 font-medium">{checkpoint.lookFor}</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-50 p-4 rounded-xl border-l-4 border-gray-400">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1"><PenTool className="w-3 h-3" /> Escreva Exatamente Isso:</span>
                                                <p className="text-sm text-gray-700 italic font-serif">"{checkpoint.noteExactly}"</p>
                                            </div>
                                            <div className={`p - 4 rounded - xl border - l - 4 ${checkpoint.drawLabel === 'essential' ? 'bg-orange-50 border-orange-500' : 'bg-blue-50 border-blue-400'} `}>
                                                <span className={`text - [10px] font - bold uppercase tracking - wider mb - 2 block flex items - center gap - 1 ${checkpoint.drawLabel === 'essential' ? 'text-orange-700' : 'text-blue-700'} `}>
                                                    <Target className="w-3 h-3" />
                                                    {checkpoint.drawLabel === 'essential' ? 'DESENHO OBRIGATÓRIO:' : 'SUGESTÃO DE DESENHO:'}
                                                </span>
                                                <p className={`text - sm italic ${checkpoint.drawLabel === 'essential' ? 'text-orange-900' : 'text-blue-900'} `}>{checkpoint.drawExactly}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-2/5 flex flex-col justify-center items-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                                    {checkpoint.imageUrl ? (
                                        <div className="w-full">
                                            <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                                                {checkpoint.imageUrl?.includes('mermaid.ink') && (
                                                  <div className="px-3 pt-2 text-[11px] font-bold text-amber-700">Esse é um diagrama (não desenho). Use "Regerar desenho" para gerar no estilo caderno.</div>
                                                )}
                                                <div className="p-3 bg-[#fbfbf8]">
                                                  <img
                                                      src={checkpoint.imageUrl}
                                                      alt="Desenho"
                                                      className="w-full h-[140px] object-contain bg-[#fbfbf8] rounded-xl border border-gray-200"
                                                      style={{ filter: 'grayscale(1) contrast(1.15)' }}
                                                  />
                                                </div>
                                                <div className="absolute inset-x-0 bottom-0 p-2 bg-white/90 backdrop-blur flex items-center gap-2">
                                                    <button
                                                        onClick={() => setOpenDiagram({ url: checkpoint.imageUrl, title: checkpoint.mission })}
                                                        className="flex-1 text-xs text-indigo-700 font-bold flex items-center justify-center gap-2 w-full hover:underline"
                                                    >
                                                        <Eye className="w-3 h-3" /> Visualizar
                                                    </button>
                                                    <button
                                                        onClick={() => handleGenerateCheckpointDiagram(checkpoint.id, checkpoint.drawExactly)}
                                                        disabled={loadingDiagramForCheckpoint === checkpoint.id}
                                                        className="flex-1 text-xs text-orange-600 font-bold flex items-center justify-center gap-2 w-full hover:underline disabled:opacity-50"
                                                    >
                                                        {loadingDiagramForCheckpoint === checkpoint.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regerar desenho
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full min-h-[180px] bg-gradient-to-br from-slate-50 to-gray-100 p-6 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center hover:border-orange-300 hover:from-orange-50/30 hover:to-amber-50/30 transition-all group">
                                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                <PenTool className="w-6 h-6 text-orange-500" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-600 mb-1">Desenho de Referência</p>
                                            <p className="text-xs text-gray-400 mb-4 max-w-[200px]">Gere um exemplo visual (estilo caderno) para copiar.</p>
                                            <button
                                                onClick={() => handleGenerateCheckpointDiagram(checkpoint.id, checkpoint.drawExactly)}
                                                disabled={loadingDiagramForCheckpoint === checkpoint.id}
                                                className="w-full py-3 px-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-orange-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {loadingDiagramForCheckpoint === checkpoint.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                                {loadingDiagramForCheckpoint === checkpoint.id ? 'Gerando...' : 'Gerar desenho'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* RODAPÉ (Quiz e Flashcards - Disponíveis também para Livro!) */}
            {(!isParetoOnly || isBook) && !guide.quiz && (
                <div className="text-center py-10">
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button onClick={onGenerateQuiz} className="bg-white text-indigo-600 border-2 border-indigo-100 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm w-full sm:w-auto flex items-center justify-center gap-2">
                            <CheckCircle className="w-5 h-5" /> Gerar Quiz
                        </button>
                        <button onClick={onGoToFlashcards} className="bg-white text-orange-600 border-2 border-orange-100 px-6 py-3 rounded-xl font-bold hover:bg-orange-50 hover:border-orange-200 transition-colors shadow-sm w-full sm:w-auto flex items-center justify-center gap-2">
                            <Layers className="w-5 h-5" /> Gerar Flashcards
                        </button>
                        {onScheduleReview && (
                            <button onClick={() => onScheduleReview(studyIdPlaceholder)} disabled={isReviewScheduled} className={`px - 8 py - 3 rounded - xl font - bold transition - all shadow - lg flex items - center justify - center gap - 2 w - full sm: w - auto ${isReviewScheduled ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-1'} `}>
                                {isReviewScheduled ? <><Calendar className="w-5 h-5" /> Revisão Agendada</> : <><Clock className="w-5 h-5" /> Agendar Revisão</>}
                            </button>
                        )}
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={onOpenSubscription}
                                className="flex-1 sm:flex-none border-2 border-slate-200 bg-white text-slate-600 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                                <FileDown className="w-4 h-4" />
                                <span className="text-xs">Exportar PDF</span>
                                {!isPaid && <Crown className="w-3 h-3 text-indigo-600" />}
                            </button>
                            <button
                                onClick={onOpenSubscription}
                                className="flex-1 sm:flex-none border-2 border-slate-200 bg-white text-slate-600 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                                <NotionIcon className="w-4 h-4" />
                                <span className="text-xs">Notion</span>
                                {!isPaid && <Crown className="w-3 h-3 text-indigo-600" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GAMIFIED PROGRESS HUD (Barra Fixa Inferior) */}
            {(!isParetoOnly || isBook) && (
                <div className={`fixed bottom - 0 left - 0 right - 0 bg - white / 95 backdrop - blur - md border - t border - gray - 200 shadow - [0_ - 10px_40px_rgba(0, 0, 0, 0.1)] z - 40 transition - all duration - 500 animate -in slide -in -from - bottom - 20 ${isCelebrating ? 'translate-y-[-8px] scale-[1.02] border-green-400 bg-gradient-to-r from-green-50/95 to-emerald-50/95 shadow-[0_-10px_60px_rgba(34,197,94,0.3)]' : ''} `}>

                    {/* Confetti Animation Overlay */}
                    {isCelebrating && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-3 h-3 animate-[confetti_1.5s_ease-out_forwards]"
                                    style={{
                                        left: `${10 + (i * 7)}% `,
                                        top: '-10px',
                                        animationDelay: `${i * 0.1} s`,
                                        background: ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][i % 6],
                                        borderRadius: i % 2 === 0 ? '50%' : '2px',
                                        transform: `rotate(${i * 30}deg)`
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    <div className={`max - w - 5xl mx - auto px - 6 ${isHudCollapsed ? 'py-2' : 'py-4'} flex flex - col md: flex - row items - center justify - between gap - 4 relative`}>
                        <button
                            type="button"
                            onClick={() => setIsHudCollapsed(prev => !prev)}
                            className="absolute -top-4 right-4 bg-white border border-gray-200 rounded-full shadow-md w-9 h-9 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                            aria-label={isHudCollapsed ? 'Expandir progresso da missão' : 'Recolher progresso da missão'}
                            title={isHudCollapsed ? 'Expandir' : 'Recolher'}
                        >
                            <ChevronDown className={`w - 4 h - 4 transition - transform ${isHudCollapsed ? 'rotate-180' : ''} `} />
                        </button>

                        {/* Seção da Barra de Progresso */}
                        <div className={`w - full md: w - 1 / 2 ${isHudCollapsed ? 'space-y-1' : 'space-y-2'} `}>
                            <div className="flex justify-between items-end">
                                <span className={`text - xs font - extrabold uppercase tracking - wider flex items - center gap - 1 transition - colors ${isCelebrating ? 'text-green-600' : 'text-gray-500'} `}>
                                    <Target className={`w - 3 h - 3 ${isCelebrating ? 'animate-bounce' : ''} `} />
                                    {isCelebrating ? '✨ Checkpoint Concluído!' : 'Progresso da Missão'}
                                </span>
                                <span className={`text - sm font - black transition - all ${percent === 100 ? 'text-green-600' : isCelebrating ? 'text-green-600 scale-110' : 'text-indigo-600'} `}>
                                    {percent}%
                                </span>
                            </div>
                            <div className={`w - full h - 3 bg - gray - 100 rounded - full overflow - hidden shadow - inner border transition - all ${isCelebrating ? 'border-green-300 shadow-green-200' : 'border-gray-200'} `}>
                                <div
                                    className={`h - full rounded - full transition - all duration - 1000 ease - out ${percent === 100 || isCelebrating ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600'} relative`}
                                    style={{ width: `${percent}% ` }}
                                >
                                    {percent < 100 && !isCelebrating && <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>}
                                    {isCelebrating && <div className="absolute inset-0 bg-white/40 animate-pulse"></div>}
                                </div>
                            </div>
                        </div>

                        {/* Seção de Feedback Motivacional */}
                        {!isHudCollapsed && (
                            <div className="w-full md:w-1/2 flex items-center md:justify-end">
                                {percent === 100 ? (
                                    <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-xl border border-green-200 animate-pulse">
                                        <div className="bg-green-100 p-2 rounded-full"><Smile className="w-5 h-5 text-green-600" /></div>
                                        <div>
                                            <p className="text-sm font-bold text-green-800">Parabéns! Missão Cumprida! 🚀</p>
                                            <p className="text-xs text-green-600">Você dominou este conteúdo.</p>
                                        </div>
                                    </div>
                                ) : isCelebrating ? (
                                    <div className="flex items-center gap-3 bg-gradient-to-r from-green-100 to-emerald-100 px-5 py-3 rounded-xl border-2 border-green-300 shadow-lg shadow-green-200/50 animate-in zoom-in-95 duration-300">
                                        <div className="bg-green-200 p-2 rounded-full animate-bounce">
                                            <CheckCircle className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-green-800 flex items-center gap-1">
                                                Excelente! 🎉
                                            </p>
                                            <p className="text-xs text-green-600 font-medium">+1 checkpoint concluído!</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition-all hover:bg-indigo-100 max-w-full md:max-w-sm" title={nextTitle || undefined}>
                                        <div className="bg-indigo-100 p-2 rounded-full shrink-0">
                                            <Zap className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-indigo-500 font-bold uppercase mb-0.5">Próximo Passo:</p>
                                            <p className="text-sm font-medium text-indigo-900 leading-tight line-clamp-2">
                                                {nextTitle ? `Descubra: "${nextTitle}"` : "Continue avançando!"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
