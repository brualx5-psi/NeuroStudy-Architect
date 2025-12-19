import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StudyGuide, CoreConcept } from '../types';
import { generateTool, generateDiagram } from '../services/geminiService';
import {
    CheckCircle, BookOpen, Brain, Target,
    Smile, RefreshCw, Layers, Calendar, Clock,
    ChevronDown, ChevronRight, PenTool, Zap, Lightbulb
} from './Icons';

interface ResultsViewProps {
    guide: StudyGuide;
    onReset: () => void;
    onGenerateQuiz: () => void;
    onGoToFlashcards: () => void;
    onUpdateGuide: (updatedGuide: StudyGuide) => void;
    isParetoOnly?: boolean;
    onScheduleReview?: (studyId: string) => void;
    isReviewScheduled?: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
    guide, onReset, onGenerateQuiz, onGoToFlashcards, onUpdateGuide, isParetoOnly, onScheduleReview, isReviewScheduled
}) => {
    // Estado para controlar qual conceito está carregando/expandido
    const [insightLoading, setInsightLoading] = useState<number | null>(null);
    const [expandedConcepts, setExpandedConcepts] = useState<Set<number>>(new Set());
    const [activeInsightTab, setActiveInsightTab] = useState<Record<number, 'feynman' | 'example'>>({});

    const [loadingDiagramForCheckpoint, setLoadingDiagramForCheckpoint] = useState<string | null>(null);

    // Função "Insight Cerebral": Gera Feynman e Exemplo juntos ao clicar no cérebro
    // Função "Insight Cerebral": Apenas expande a visualização. A geração agora é sob demanda (lazy).
    const handleInsightClick = (index: number) => {
        const newExpanded = new Set(expandedConcepts);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
            // NÃO define aba padrão, espera o usuário clicar
            if (activeInsightTab[index]) {
                // Se já tinha aba ativa, mantém
            } else {
                // Estado inicial: nenhuma aba selecionada ou apenas visualização
                // Ouvindo o pedido do usuário: "vai aparecer icone... só gerar quando clicar"
            }
        }
        setExpandedConcepts(newExpanded);
    };

    // Nova função para gerenciar o clique na aba e gerar conteúdo se necessário
    const handleInsightTabClick = async (index: number, tab: 'feynman' | 'example', concept: CoreConcept) => {
        setActiveInsightTab(prev => ({ ...prev, [index]: tab }));

        // Se já tem o conteúdo, não faz nada
        if (tab === 'feynman' && concept.tools?.feynman) return;
        if (tab === 'example' && concept.tools?.example) return;

        // Se não tem, gera
        setInsightLoading(index);
        try {
            const toolType = tab === 'feynman' ? 'explainLikeIm5' : 'realWorldApplication';
            const content = await generateTool(toolType, concept.concept, concept.definition);

            const newConcepts = [...(guide.coreConcepts || [])];
            if (!newConcepts[index].tools) newConcepts[index].tools = {};

            if (tab === 'feynman') newConcepts[index].tools!.feynman = content;
            else newConcepts[index].tools!.example = content;

            onUpdateGuide({ ...guide, coreConcepts: newConcepts });
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar insight.");
        } finally {
            setInsightLoading(null);
        }
    };

    const handleGenerateCheckpointDiagram = async (checkpointId: string, description: string) => {
        setLoadingDiagramForCheckpoint(checkpointId);
        try {
            const url = await generateDiagram(description);
            const newCheckpoints = guide.checkpoints?.map(c =>
                c.id === checkpointId ? { ...c, imageUrl: url } : c
            );
            onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
        } catch (error) {
            alert("Erro ao gerar diagrama.");
        } finally {
            setLoadingDiagramForCheckpoint(null);
        }
    };

    const toggleCheckpoint = (id: string) => {
        const newCheckpoints = guide.checkpoints?.map(c =>
            c.id === id ? { ...c, completed: !c.completed } : c
        );
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
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-40"> {/* pb-40 para dar espaço para a barra fixa */}

            {/* HEADER - ADVANCE ORGANIZER (Contexto do Livro ou Material) */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl -z-10 opacity-50"></div>

                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${isBook ? 'bg-orange-100 text-orange-700' : isParetoOnly ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
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
                                    {guide.coreConcepts.map((concept, i) => (
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
                        {guide.coreConcepts.map((concept, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative group">
                                <div className="flex justify-between items-start mb-4 pr-8">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl ${isBook ? 'bg-red-100 text-red-700' : 'bg-indigo-600 text-white'} flex items-center justify-center font-bold text-lg shadow-lg shrink-0`}>
                                            {idx + 1}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 leading-tight">{concept.concept}</h3>
                                    </div>
                                    <div className="absolute top-4 right-4">
                                        <button onClick={() => handleInsightClick(idx)} disabled={insightLoading === idx} className={`p-2 rounded-full transition-all duration-300 ${expandedConcepts.has(idx) ? 'bg-purple-100 text-purple-600 rotate-180' : 'bg-gray-100 text-gray-400 hover:bg-purple-50 hover:text-purple-500 hover:scale-110'}`} title="Insight Cerebral (Expandir)">
                                            {insightLoading === idx ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Brain className="w-6 h-6" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-600 leading-relaxed text-base pl-[3.5rem]">{concept.definition}</p>
                                {/* ÁREA EXPANDIDA (Igual ao original) */}
                                {expandedConcepts.has(idx) && (
                                    <div className="mt-6 pl-0 md:pl-[3.5rem] animate-in fade-in slide-in-from-top-2">
                                        <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
                                            <button onClick={() => handleInsightTabClick(idx, 'feynman', concept)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeInsightTab[idx] === 'feynman' ? 'bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200' : 'text-gray-400 hover:bg-gray-50'}`}><Smile className="w-4 h-4" /> Método Feynman</button>
                                            <button onClick={() => handleInsightTabClick(idx, 'example', concept)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeInsightTab[idx] === 'example' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}><Target className="w-4 h-4" /> Aplicação Real</button>
                                        </div>
                                        {insightLoading === idx && <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center gap-2 text-gray-500 animate-pulse"><RefreshCw className="w-5 h-5 animate-spin" /> Gerando Insight Curto...</div>}
                                        {insightLoading !== idx && (
                                            <>
                                                {activeInsightTab[idx] === 'feynman' && concept.tools?.feynman && <div className="bg-green-50 p-6 rounded-2xl border border-green-100 relative overflow-hidden animate-in fade-in"><div className="absolute top-0 right-0 p-2 opacity-10"><Smile className="w-16 h-16 text-green-600" /></div><div className="text-green-900 leading-relaxed text-sm relative z-10 prose prose-sm max-w-none"><ReactMarkdown>{concept.tools?.feynman}</ReactMarkdown></div></div>}
                                                {activeInsightTab[idx] === 'example' && concept.tools?.example && <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden animate-in fade-in"><div className="absolute top-0 right-0 p-2 opacity-10"><Target className="w-16 h-16 text-blue-600" /></div><div className="text-blue-900 leading-relaxed text-sm relative z-10 prose prose-sm max-w-none"><ReactMarkdown>{concept.tools.example}</ReactMarkdown></div></div>}
                                                {!activeInsightTab[idx] && <div className="p-4 text-center text-xs text-gray-400 italic">Selecione uma ferramenta acima para gerar o insight.</div>}
                                            </>
                                        )}
                                    </div>
                                )}
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
                        <h2 className="text-xl font-bold text-gray-800">Capítulos e Insights (Pareto Local)</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {guide.bookChapters.map((chapter, i) => (
                            <div key={i} className={`p-6 rounded-2xl border-l-4 shadow-sm transition-all ${chapter.completed ? 'bg-green-50 border-green-500 opacity-90' : 'bg-white border-orange-400'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className={`text-xl font-bold ${chapter.completed ? 'text-green-800' : 'text-gray-800'}`}>
                                        {chapter.title}
                                    </h3>
                                    <button
                                        onClick={() => toggleChapterRead(i)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${chapter.completed ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-white text-gray-400 border-gray-200 hover:border-green-400 hover:text-green-600'}`}
                                        title="Marcar como lido"
                                    >
                                        {chapter.completed ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                                        {chapter.completed ? 'LIDO' : 'MARCAR COMO LIDO'}
                                    </button>
                                </div>

                                <div className={`p-4 rounded-xl border ${chapter.completed ? 'bg-white/50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 block flex items-center gap-1 ${chapter.completed ? 'text-green-600' : 'text-orange-600'}`}>
                                        <Zap className="w-3 h-3" /> Essência do Capítulo (80/20)
                                    </span>
                                    <p className={`text-sm leading-relaxed ${chapter.completed ? 'text-green-900' : 'text-orange-900 font-medium'}`}>
                                        {chapter.paretoChunk}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* SEÇÃO CHECKPOINTS: SÓ MOSTRA SE NÃO FOR LIVRO E NÃO FOR PARETO PURO */}
            {!isBook && !isParetoOnly && guide.checkpoints && guide.checkpoints.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mt-8">
                    {/* ... (Todo o conteúdo de Checkpoints original) ... */}
                    <div className="bg-gray-50 p-6 border-b border-gray-200">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 text-xl"><Target className="w-6 h-6 text-red-500" /> Checkpoints de Aprendizado</h2>
                        <p className="text-sm text-gray-500 mt-1">Pontos chave para verificar se você realmente aprendeu.</p>
                    </div>
                    <div className="p-6 space-y-6">
                        {guide.checkpoints.map((checkpoint) => (
                            <div key={checkpoint.id}
                                className={`flex flex-col md:flex-row gap-6 p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${checkpoint.completed ? 'bg-green-50 border-green-200 opacity-70' : 'bg-white border-gray-100 hover:border-indigo-100'}`}
                            >
                                <div className="flex-1 space-y-4" onClick={() => toggleCheckpoint(checkpoint.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${checkpoint.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                            {checkpoint.completed && <CheckCircle className="w-5 h-5 text-white" />}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-lg ${checkpoint.completed ? 'text-green-800 line-through' : 'text-gray-900'}`}>{checkpoint.mission}</h4>
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
                                            <div className={`p-4 rounded-xl border-l-4 ${checkpoint.drawLabel === 'essential' ? 'bg-orange-50 border-orange-500' : 'bg-blue-50 border-blue-400'}`}>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 block flex items-center gap-1 ${checkpoint.drawLabel === 'essential' ? 'text-orange-700' : 'text-blue-700'}`}>
                                                    <Target className="w-3 h-3" />
                                                    {checkpoint.drawLabel === 'essential' ? 'DESENHO OBRIGATÓRIO:' : 'SUGESTÃO DE DESENHO:'}
                                                </span>
                                                <p className={`text-sm italic ${checkpoint.drawLabel === 'essential' ? 'text-orange-900' : 'text-blue-900'}`}>{checkpoint.drawExactly}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-1/3 flex flex-col justify-center items-center border-l border-gray-100 pl-0 md:pl-6 pt-4 md:pt-0">
                                    {checkpoint.imageUrl ? (
                                        <div className="relative w-full group">
                                            <img src={checkpoint.imageUrl} alt="Diagrama" className="w-full rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:scale-105 transition-transform bg-white" onClick={() => window.open(checkpoint.imageUrl, '_blank')} />
                                            <p className="text-center text-[10px] text-gray-400 mt-2">Diagrama gerado por IA</p>
                                        </div>
                                    ) : (
                                        <div className="text-center w-full bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200">
                                            <p className="text-xs text-gray-400 mb-3 font-medium">Não entendeu o desenho?</p>
                                            <button onClick={() => handleGenerateCheckpointDiagram(checkpoint.id, checkpoint.drawExactly)} disabled={loadingDiagramForCheckpoint === checkpoint.id} className="w-full py-3 px-4 bg-white border border-orange-200 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                                                {loadingDiagramForCheckpoint === checkpoint.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Gerar Diagrama Visual
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
                            <button onClick={() => onScheduleReview(studyIdPlaceholder)} disabled={isReviewScheduled} className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto ${isReviewScheduled ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-1'}`}>
                                {isReviewScheduled ? <><Calendar className="w-5 h-5" /> Revisão Agendada</> : <><Clock className="w-5 h-5" /> Agendar Revisão</>}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* GAMIFIED PROGRESS HUD (Barra Fixa Inferior) */}
            {(!isParetoOnly || isBook) && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 transition-transform duration-500 animate-in slide-in-from-bottom-20">
                    <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">

                        {/* Seção da Barra de Progresso */}
                        <div className="w-full md:w-1/2 space-y-2">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                                    <Target className="w-3 h-3" /> Progresso da Missão
                                </span>
                                <span className={`text-sm font-black ${percent === 100 ? 'text-green-600' : 'text-indigo-600'}`}>
                                    {percent}%
                                </span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${percent === 100 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 relative'}`}
                                    style={{ width: `${percent}%` }}
                                >
                                    {percent < 100 && <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>}
                                </div>
                            </div>
                        </div>

                        {/* Seção de Feedback Motivacional */}
                        <div className="w-full md:w-1/2 flex items-center md:justify-end">
                            {percent === 100 ? (
                                <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-xl border border-green-200 animate-pulse">
                                    <div className="bg-green-100 p-2 rounded-full"><Smile className="w-5 h-5 text-green-600" /></div>
                                    <div>
                                        <p className="text-sm font-bold text-green-800">Parabéns! Missão Cumprida! 🚀</p>
                                        <p className="text-xs text-green-600">Você dominou este conteúdo.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition-all hover:bg-indigo-100">
                                    <div className="bg-indigo-100 p-2 rounded-full shrink-0">
                                        <Zap className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-indigo-500 font-bold uppercase mb-0.5">Próximo Passo:</p>
                                        <p className="text-sm font-medium text-indigo-900 leading-tight line-clamp-1">
                                            {nextTitle ? `Bora! Falta pouco. Descubra sobre "${nextTitle}"` : "Continue avançando!"}
                                        </p>
                                        <p className="text-[10px] text-indigo-400 mt-0.5 hidden sm:block">
                                            Vai ser interessante conectar os pontos!
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
