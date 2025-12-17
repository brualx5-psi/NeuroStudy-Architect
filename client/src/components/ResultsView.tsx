import React, { useState } from 'react';
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

    const [loadingDiagramForCheckpoint, setLoadingDiagramForCheckpoint] = useState<string | null>(null);

    // Função "Insight Cerebral": Gera Feynman e Exemplo juntos ao clicar no cérebro
    const handleInsightClick = async (index: number, concept: CoreConcept) => {
        // Se já tiver as ferramentas, apenas abre/fecha
        if (concept.tools?.feynman || concept.tools?.example) {
            const newExpanded = new Set(expandedConcepts);
            if (newExpanded.has(index)) newExpanded.delete(index);
            else newExpanded.add(index);
            setExpandedConcepts(newExpanded);
            return;
        }

        // Se não tiver, gera ambas
        setInsightLoading(index);
        try {
            const [feynman, example] = await Promise.all([
                generateTool('explainLikeIm5', concept.concept, concept.definition),
                generateTool('realWorldApplication', concept.concept, concept.definition)
            ]);

            const newConcepts = [...(guide.coreConcepts || [])];
            if (!newConcepts[index].tools) newConcepts[index].tools = {};

            newConcepts[index].tools = {
                feynman,
                example
            };

            onUpdateGuide({ ...guide, coreConcepts: newConcepts });

            // Abre automaticamente após gerar
            const newExpanded = new Set(expandedConcepts);
            newExpanded.add(index);
            setExpandedConcepts(newExpanded);

        } catch (error) {
            console.error(error);
            alert("Erro ao gerar insights cerebrais.");
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

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

            {/* HEADER - ADVANCE ORGANIZER (Layout Antigo Limpo) */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl -z-10 opacity-50"></div>

                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                            {isParetoOnly ? 'Modo Pareto 80/20' : 'Roteiro de Estudo'}
                        </span>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{guide.title}</h1>
                    </div>
                    <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-bold transition-colors text-sm">
                        <RefreshCw className="w-4 h-4" /> Novo
                    </button>
                </div>

                {/* Advance Organizer */}
                <div className="mt-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-500" /> Advance Organizer
                    </span>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-lg shadow-inner">
                        {guide.overview}
                    </div>
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL (Core Concepts) */}
            <section className="space-y-6">
                <div className="flex items-center gap-2 px-2">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-gray-800">
                        {guide.bookChapters ? 'Capítulos Analisados' : 'Conceitos Fundamentais'}
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* SE FOR LIVRO */}
                    {guide.bookChapters && guide.bookChapters.length > 0 ? (
                        guide.bookChapters.map((chapter, i) => (
                            <div key={i} className="bg-white p-6 rounded-2xl border-l-4 border-orange-400 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">{chapter.title}</h3>
                                <p className="text-gray-600 mb-4 italic">{chapter.summary}</p>
                                <div className="space-y-3">
                                    {chapter.keyPoints.map((point: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{idx + 1}</div>
                                            <p className="text-gray-700 text-sm leading-relaxed">{point}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        /* SE FOR ARTIGO/TEXTO - Layout "Insight Cerebral" */
                        guide.coreConcepts && guide.coreConcepts.length > 0 ? (
                            guide.coreConcepts.map((concept, idx) => (
                                <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative group">

                                    {/* CABEÇALHO DO CARD */}
                                    <div className="flex justify-between items-start mb-4 pr-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-200 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 leading-tight">{concept.concept}</h3>
                                        </div>

                                        {/* BOTÃO INSIGHT CEREBRAL (NO CANTO DIREITO EM CIMA) */}
                                        <div className="absolute top-4 right-4">
                                            <button
                                                onClick={() => handleInsightClick(idx, concept)}
                                                disabled={insightLoading === idx}
                                                className={`p-2 rounded-full transition-all duration-300 ${expandedConcepts.has(idx) ? 'bg-purple-100 text-purple-600 rotate-180' : 'bg-gray-100 text-gray-400 hover:bg-purple-50 hover:text-purple-500 hover:scale-110'}`}
                                                title="Insight Cerebral (Expandir)"
                                            >
                                                {insightLoading === idx ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Brain className="w-6 h-6" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* DEFINIÇÃO */}
                                    <p className="text-gray-600 leading-relaxed text-base pl-[3.5rem]">
                                        {concept.definition}
                                    </p>

                                    {/* ÁREA EXPANDIDA (INSIGHTS) */}
                                    {expandedConcepts.has(idx) && (
                                        <div className="mt-6 pl-0 md:pl-[3.5rem] grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            {/* Caixa Feynman */}
                                            <div className="bg-green-50 p-5 rounded-2xl border border-green-100 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-10"><Smile className="w-16 h-16 text-green-600" /></div>
                                                <h4 className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                                                    <Smile className="w-4 h-4" /> Método Feynman
                                                </h4>
                                                <p className="text-sm text-green-900 leading-relaxed whitespace-pre-line relative z-10">
                                                    {concept.tools?.feynman}
                                                </p>
                                            </div>

                                            {/* Caixa Exemplo */}
                                            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-10"><Target className="w-16 h-16 text-blue-600" /></div>
                                                <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                                                    <Target className="w-4 h-4" /> Aplicação Real
                                                </h4>
                                                <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line relative z-10">
                                                    {concept.tools?.example}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                                Nenhum conceito encontrado. Tente regenerar o roteiro.
                            </div>
                        )
                    )}
                </div>
            </section>

            {/* CHECKPOINTS (LAYOUT CLÁSSICO COM OBRIGATÓRIO/SUGESTÃO) */}
            {guide.checkpoints && guide.checkpoints.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mt-8">
                    <div className="bg-gray-50 p-6 border-b border-gray-200">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 text-xl"><Target className="w-6 h-6 text-red-500" /> Checkpoints de Aprendizado</h2>
                        <p className="text-sm text-gray-500 mt-1">Pontos chave para verificar se você realmente aprendeu.</p>
                    </div>
                    <div className="p-6 space-y-6">
                        {guide.checkpoints.map((checkpoint) => (
                            <div key={checkpoint.id}
                                className={`flex flex-col md:flex-row gap-6 p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${checkpoint.completed ? 'bg-green-50 border-green-200 opacity-70' : 'bg-white border-gray-100 hover:border-indigo-100'}`}
                            >

                                {/* COLUNA ESQUERDA: INSTRUÇÕES E CHECK */}
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
                                            {/* CAIXA NOTA (Escreva) */}
                                            <div className="bg-gray-50 p-4 rounded-xl border-l-4 border-gray-400">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1"><PenTool className="w-3 h-3" /> Escreva Exatamente Isso:</span>
                                                <p className="text-sm text-gray-700 italic font-serif">"{checkpoint.noteExactly}"</p>
                                            </div>

                                            {/* CAIXA DESENHO (Obrigatório vs Sugestão) */}
                                            <div className={`p-4 rounded-xl border-l-4 ${checkpoint.drawLabel === 'essential' ? 'bg-orange-50 border-orange-500' : 'bg-blue-50 border-blue-400'}`}>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 block flex items-center gap-1 ${checkpoint.drawLabel === 'essential' ? 'text-orange-700' : 'text-blue-700'}`}>
                                                    <Target className="w-3 h-3" />
                                                    {checkpoint.drawLabel === 'essential' ? 'DESENHO OBRIGATÓRIO:' : 'SUGESTÃO DE DESENHO:'}
                                                </span>
                                                <p className={`text-sm italic ${checkpoint.drawLabel === 'essential' ? 'text-orange-900' : 'text-blue-900'}`}>
                                                    {checkpoint.drawExactly}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* COLUNA DIREITA: DIAGRAMA E AÇÃO */}
                                <div className="w-full md:w-1/3 flex flex-col justify-center items-center border-l border-gray-100 pl-0 md:pl-6 pt-4 md:pt-0">
                                    {checkpoint.imageUrl ? (
                                        <div className="relative w-full group">
                                            <img src={checkpoint.imageUrl} alt="Diagrama" className="w-full rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:scale-105 transition-transform bg-white" onClick={() => window.open(checkpoint.imageUrl, '_blank')} />
                                            <p className="text-center text-[10px] text-gray-400 mt-2">Diagrama gerado por IA</p>
                                        </div>
                                    ) : (
                                        <div className="text-center w-full bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200">
                                            <p className="text-xs text-gray-400 mb-3 font-medium">Não entendeu o desenho?</p>
                                            <button
                                                onClick={() => handleGenerateCheckpointDiagram(checkpoint.id, checkpoint.drawExactly)}
                                                disabled={loadingDiagramForCheckpoint === checkpoint.id}
                                                className="w-full py-3 px-4 bg-white border border-orange-200 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                {loadingDiagramForCheckpoint === checkpoint.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                                Gerar Diagrama Visual
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* RODAPÉ */}
            {!isParetoOnly && !guide.quiz && (
                <div className="text-center py-10">
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button onClick={onGenerateQuiz} className="bg-white text-indigo-600 border-2 border-indigo-100 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm w-full sm:w-auto flex items-center justify-center gap-2">
                            <CheckCircle className="w-5 h-5" /> Gerar Quiz
                        </button>

                        <button onClick={onGoToFlashcards} className="bg-white text-orange-600 border-2 border-orange-100 px-6 py-3 rounded-xl font-bold hover:bg-orange-50 hover:border-orange-200 transition-colors shadow-sm w-full sm:w-auto flex items-center justify-center gap-2">
                            <Layers className="w-5 h-5" /> Gerar Flashcards
                        </button>

                        {onScheduleReview && (
                            <button
                                onClick={() => onScheduleReview(studyIdPlaceholder)}
                                disabled={isReviewScheduled}
                                className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto ${isReviewScheduled ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-1'}`}
                            >
                                {isReviewScheduled ? <><Calendar className="w-5 h-5" /> Revisão Agendada</> : <><Clock className="w-5 h-5" /> Agendar Revisão</>}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
