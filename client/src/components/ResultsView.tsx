import React, { useState } from 'react';
import { StudyGuide, CoreConcept } from '../types';
import { generateTool } from '../services/geminiService';
import { 
  CheckCircle, BookOpen, Brain, Target, 
  Smile, RefreshCw, Layers, Calendar, Clock
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
  // Estado local para saber qual conceito está carregando qual ferramenta
  const [loadingConceptTool, setLoadingConceptTool] = useState<{idx: number, type: string} | null>(null);

  // Função para gerar Feynman ou Exemplo para um conceito específico
  const handleGenerateConceptTool = async (index: number, concept: CoreConcept, toolType: 'feynman' | 'example') => {
    setLoadingConceptTool({ idx: index, type: toolType });
    try {
        const promptType = toolType === 'feynman' ? 'explainLikeIm5' : 'realWorldApplication';
        const content = await generateTool(promptType, concept.concept, concept.definition);
        
        // Atualiza o guia com a nova ferramenta dentro do conceito específico
        const newConcepts = [...(guide.mainConcepts || [])];
        if (!newConcepts[index].tools) newConcepts[index].tools = {};
        
        if (toolType === 'feynman') newConcepts[index].tools!.feynman = content;
        else newConcepts[index].tools!.example = content;

        onUpdateGuide({ ...guide, mainConcepts: newConcepts });
    } catch (error) {
        console.error(error);
        alert("Erro ao gerar explicação.");
    } finally {
        setLoadingConceptTool(null);
    }
  };

  const studyIdPlaceholder = 'study-id-placeholder'; 

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* HEADER: Título e Resumo Global */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl -z-10 opacity-50"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                    {isParetoOnly ? 'Modo Pareto 80/20' : 'Roteiro de Estudo'}
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{guide.title}</h1>
            </div>
            <div className="flex gap-2">
                 {!isParetoOnly && (
                    <button onClick={onGoToFlashcards} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-bold transition-colors text-sm">
                        <Layers className="w-4 h-4"/> Flashcards
                    </button>
                 )}
                 <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-bold transition-colors text-sm">
                    <RefreshCw className="w-4 h-4"/> Novo
                </button>
            </div>
        </div>
        {guide.summary && ( // Resumo do Capítulo (se livro)
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-lg mb-4">
                {guide.summary}
            </div>
        )}
        {guide.overview && !guide.summary && ( // Overview geral
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-lg">
                {guide.overview}
            </div>
        )}
      </div>

      {/* CONTEÚDO PRINCIPAL: Lista de Conceitos */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
         <div className="bg-gray-50 p-4 border-b border-gray-200">
             <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                 <BookOpen className="w-5 h-5 text-indigo-600"/> 
                 {guide.bookChapters ? 'Capítulos Analisados' : 'Conceitos Fundamentais'}
             </h2>
         </div>
         
         <div className="p-6 md:p-8 space-y-8">
             {/* RENDERIZAÇÃO SE FOR LIVRO */}
             {guide.bookChapters && guide.bookChapters.length > 0 ? (
                 guide.bookChapters.map((chapter, i) => (
                    <div key={i} className="mb-8 border-l-4 border-orange-200 pl-6 py-2">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{chapter.title}</h3>
                        <p className="text-gray-600 mb-4 italic">{chapter.summary}</p>
                        <div className="space-y-3">
                            {chapter.keyPoints.map((point: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{idx + 1}</div>
                                    <p className="text-gray-700 text-sm leading-relaxed">{point}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                 ))
             ) : (
                 /* RENDERIZAÇÃO SE FOR ARTIGO/TEXTO (AQUI ENTRA O CÉREBRO PEQUENO) */
                 guide.mainConcepts && guide.mainConcepts.length > 0 ? (
                    guide.mainConcepts.map((concept, idx) => (
                        <div key={idx} className="group border-b border-gray-100 last:border-0 pb-8 last:pb-0">
                            <div className="flex justify-between items-start gap-4 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">{idx + 1}</div>
                                    <h3 className="text-xl font-bold text-gray-900">{concept.concept}</h3>
                                </div>
                                
                                {/* BOTÕES DE AÇÃO (CÉREBRO PEQUENO) */}
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleGenerateConceptTool(idx, concept, 'feynman')}
                                        disabled={loadingConceptTool?.idx === idx}
                                        className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors tooltip-trigger relative group/btn"
                                        title="Explicar com Feynman"
                                    >
                                        <Smile className="w-5 h-5"/>
                                        <span className="sr-only">Feynman</span>
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateConceptTool(idx, concept, 'example')}
                                        disabled={loadingConceptTool?.idx === idx}
                                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                        title="Exemplo Prático"
                                    >
                                        <Target className="w-5 h-5"/>
                                        <span className="sr-only">Exemplo</span>
                                    </button>
                                </div>
                            </div>

                            <p className="text-gray-600 leading-relaxed bg-gray-50 p-5 rounded-xl border border-gray-100 text-base mb-4">
                                {concept.definition}
                            </p>

                            {/* ÁREA DE RESPOSTA DAS FERRAMENTAS */}
                            {concept.tools?.feynman && (
                                <div className="mt-3 ml-4 p-4 bg-green-50 rounded-xl border border-green-100 animate-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-2"><Smile className="w-4 h-4"/> Explicação Feynman</h4>
                                    <p className="text-sm text-green-800 leading-relaxed whitespace-pre-line">{concept.tools.feynman}</p>
                                </div>
                            )}
                            {concept.tools?.example && (
                                <div className="mt-3 ml-4 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2"><Target className="w-4 h-4"/> Exemplo Prático</h4>
                                    <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{concept.tools.example}</p>
                                </div>
                            )}
                            
                            {loadingConceptTool?.idx === idx && (
                                <div className="ml-4 text-xs text-gray-400 animate-pulse flex items-center gap-2">
                                    <Brain className="w-4 h-4 animate-bounce"/> Gerando conteúdo inteligente...
                                </div>
                            )}
                        </div>
                    ))
                 ) : (
                     <div className="text-center py-10 text-gray-400">
                         Nenhum conceito encontrado. Tente regenerar o roteiro.
                     </div>
                 )
             )}
         </div>
      </section>

      {/* CHECKPOINTS */}
      {guide.checkpoints && guide.checkpoints.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2"><Target className="w-5 h-5 text-red-500"/> Plano de Ação (Checkpoints)</h2>
                </div>
                <div className="p-4 space-y-3">
                    {guide.checkpoints.map((checkpoint) => (
                        <div key={checkpoint.id} className={`flex items-center p-4 rounded-xl border transition-all cursor-pointer ${checkpoint.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`} onClick={() => toggleCheckpoint(checkpoint.id)}>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${checkpoint.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                {checkpoint.completed && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <span className={`flex-1 font-medium ${checkpoint.completed ? 'text-green-800 line-through decoration-green-500' : 'text-gray-700'}`}>{checkpoint.mission || checkpoint.task}</span>
                        </div>
                    ))}
                </div>
          </section>
      )}

      {/* RODAPÉ E AGENDAMENTO */}
      {!isParetoOnly && !guide.quiz && (
          <div className="text-center py-10">
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button onClick={onGenerateQuiz} className="bg-white text-indigo-600 border-2 border-indigo-100 px-8 py-3 rounded-xl font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm w-full sm:w-auto">
                      Gerar Quiz Final
                  </button>
                  {onScheduleReview && (
                      <button 
                        onClick={() => onScheduleReview(studyIdPlaceholder)} 
                        disabled={isReviewScheduled}
                        className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto ${isReviewScheduled ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-1'}`}
                      >
                          {isReviewScheduled ? <><Calendar className="w-5 h-5"/> Revisão Agendada</> : <><Clock className="w-5 h-5"/> Agendar Revisão (24h)</>}
                      </button>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
