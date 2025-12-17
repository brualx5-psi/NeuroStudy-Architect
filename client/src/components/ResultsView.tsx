import React, { useState, useEffect } from 'react';
import { StudyGuide } from '../types';
import { generateTool, generateDiagram } from '../services/geminiService';
import { 
  CheckCircle, BookOpen, Brain, Zap, Target, 
  Smile, Layers, ChevronDown, ChevronRight,
  Lightbulb, RefreshCw, PenTool, Globe, Calendar, Clock
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

export const ResultsView: React.FC<ResultsViewProps> = ({ // <-- EXPORTAÇÃO CORRETA
  guide, onReset, onGenerateQuiz, onGoToFlashcards, onUpdateGuide, isParetoOnly, onScheduleReview, isReviewScheduled
}) => {
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('main_concepts');
  
  const [isFeynmanOpen, setIsFeynmanOpen] = useState(false);

  useEffect(() => {
    if (guide.tools?.explainLikeIm5 && !isFeynmanOpen) {
       // Lógica opcional
    }
  }, [guide.tools]);

  const handleGenerateTool = async (toolType: 'explainLikeIm5' | 'analogy' | 'realWorldApplication' | 'mnemonics' | 'interdisciplinary', topic: string) => {
    setLoadingTool(toolType);
    if (toolType === 'explainLikeIm5') setIsFeynmanOpen(true);

    try {
      const content = await generateTool(toolType, topic, JSON.stringify(guide.mainConcepts));
      const currentTools = guide.tools || {};
      const newTools = { ...currentTools, [toolType]: content };
      onUpdateGuide({ ...guide, tools: newTools });
    } catch (error) {
      alert('Erro ao gerar ferramenta. Tente novamente.');
    } finally {
      setLoadingTool(null);
    }
  };

  const handleGenerateDiagram = async () => {
      setLoadingTool('diagram');
      try {
          const url = await generateDiagram(guide.title, JSON.stringify(guide.mainConcepts));
          onUpdateGuide({ ...guide, diagramUrl: url });
      } catch (error) {
          console.error(error);
      } finally {
          setLoadingTool(null);
      }
  };

  const toggleCheckpoint = (id: string) => {
    const newCheckpoints = guide.checkpoints?.map(c => 
      c.id === id ? { ...c, completed: !c.completed } : c
    );
    onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
  };

  const renderChapter = (chapter: any, index: number) => (
      <div key={index} className="mb-8 border-l-4 border-orange-200 pl-6 py-2">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{chapter.title}</h3>
          <p className="text-gray-600 mb-4 italic">{chapter.summary}</p>
          <div className="space-y-4">
              {chapter.keyPoints.map((point: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                      <p className="text-gray-700 text-sm">{point}</p>
                  </div>
              ))}
          </div>
          {chapter.actionableStep && (
               <div className="mt-4 bg-green-50 p-4 rounded-xl border border-green-100 flex items-start gap-3">
                   <Target className="w-5 h-5 text-green-600 mt-0.5 shrink-0"/>
                   <div>
                       <span className="block font-bold text-green-800 text-sm mb-1">Aplicação Prática</span>
                       <p className="text-green-700 text-sm">{chapter.actionableStep}</p>
                   </div>
               </div>
          )}
      </div>
  );

  // Variável local simulada para o ID do estudo (já que o App.tsx que tem o ID real)
  const studyIdPlaceholder = 'study-id-placeholder'; 

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* HEADER */}
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
        {guide.summary && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-lg">
                {guide.summary}
            </div>
        )}
      </div>

      {/* FERRAMENTAS COGNITIVAS */}
      {!isParetoOnly && (
        <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Brain className="w-6 h-6 text-indigo-500"/> 
                Ferramentas Cognitivas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: FEYNMAN */}
                <div className={`p-6 rounded-2xl border transition-all duration-300 ${guide.tools?.explainLikeIm5 ? 'bg-white border-green-200 shadow-md' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg'}`}>
                    <div className="flex justify-between items-start mb-4 cursor-pointer" onClick={() => { if (guide.tools?.explainLikeIm5) setIsFeynmanOpen(!isFeynmanOpen); }}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${guide.tools?.explainLikeIm5 ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}><Smile className="w-6 h-6" /></div>
                            <div><h3 className="font-bold text-gray-900">Método Feynman</h3><p className="text-xs text-gray-500">Simplificação e Analogias</p></div>
                        </div>
                        {guide.tools?.explainLikeIm5 && (<button className="text-gray-400">{isFeynmanOpen ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</button>)}
                    </div>
                    {guide.tools?.explainLikeIm5 ? (
                        <>
                            {isFeynmanOpen ? (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <div className="prose prose-sm prose-indigo mb-4 bg-green-50/50 p-4 rounded-xl text-gray-700 whitespace-pre-line border border-green-100">{guide.tools.explainLikeIm5}</div>
                                    {!guide.tools.realWorldApplication ? (
                                        <button onClick={(e) => { e.stopPropagation(); handleGenerateTool('realWorldApplication', guide.title); }} disabled={loadingTool === 'realWorldApplication'} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm">{loadingTool === 'realWorldApplication' ? 'Criando...' : <><Target className="w-4 h-4"/> Gerar Exemplo Real</>}</button>
                                    ) : (
                                        <div className="mt-4 pt-4 border-t border-green-100 animate-in slide-in-from-top-2"><div className="flex items-center gap-2 mb-2 text-green-800 font-bold text-sm"><Target className="w-4 h-4"/> Aplicação no Mundo Real:</div><p className="text-sm text-gray-700 italic bg-white p-3 rounded-lg border border-gray-100">{guide.tools.realWorldApplication}</p></div>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setIsFeynmanOpen(false); }} className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"><ChevronDown className="w-3 h-3 rotate-180"/> Recolher Explicação</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsFeynmanOpen(true)} className="w-full py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg font-bold hover:bg-green-100 transition-colors text-sm flex items-center justify-center gap-2"><BookOpen className="w-4 h-4"/> Ver Explicação Gerada</button>
                            )}
                        </>
                    ) : (
                        <div><p className="text-sm text-gray-500 mb-4 leading-relaxed">"Se você não consegue explicar de forma simples, você não entendeu bem o suficiente."</p><button onClick={() => handleGenerateTool('explainLikeIm5', guide.title)} disabled={loadingTool === 'explainLikeIm5'} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors text-sm shadow-sm hover:shadow-md">{loadingTool === 'explainLikeIm5' ? 'Gerando...' : 'Aplicar Feynman'}</button></div>
                    )}
                </div>
                {/* Outros Cards mantidos... */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-lg bg-purple-100 text-purple-600"><Zap className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Mapa Mental</h3><p className="text-xs text-gray-500">Estrutura Visual</p></div></div>
                    {guide.diagramUrl ? (<div className="mt-2 animate-in zoom-in"><img src={guide.diagramUrl} alt="Diagrama" className="w-full rounded-lg border border-gray-100 shadow-sm hover:scale-105 transition-transform cursor-pointer" onClick={() => window.open(guide.diagramUrl, '_blank')} /><p className="text-center text-xs text-gray-400 mt-2">Clique para ampliar</p></div>) : (<div className="h-32 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200"><button onClick={handleGenerateDiagram} disabled={loadingTool === 'diagram'} className="px-4 py-2 bg-white border border-gray-200 shadow-sm text-gray-600 rounded-lg font-bold hover:text-purple-600 hover:border-purple-200 transition-colors text-sm flex items-center gap-2">{loadingTool === 'diagram' ? 'Desenhando...' : <><PenTool className="w-4 h-4"/> Gerar Mapa Mental</>}</button></div>)}
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-lg bg-orange-100 text-orange-600"><Lightbulb className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Mnemônicos</h3><p className="text-xs text-gray-500">Hacks de Memória</p></div></div>
                    {guide.tools?.mnemonics ? (<div className="p-3 bg-orange-50 rounded-lg text-sm text-gray-700 font-medium">{guide.tools.mnemonics}</div>) : (<button onClick={() => handleGenerateTool('mnemonics', guide.title)} disabled={loadingTool === 'mnemonics'} className="w-full py-2 bg-white border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm">Criar Mnemônico</button>)}
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Globe className="w-6 h-6" /></div><div><h3 className="font-bold text-gray-900">Conexões</h3><p className="text-xs text-gray-500">Visão Interdisciplinar</p></div></div>
                    {guide.tools?.interdisciplinary ? (<div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-700">{guide.tools.interdisciplinary}</div>) : (<button onClick={() => handleGenerateTool('interdisciplinary', guide.title)} disabled={loadingTool === 'interdisciplinary'} className="w-full py-2 bg-white border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors text-sm">Expandir Visão</button>)}
                </div>
            </div>
        </section>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <section>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
             <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer" onClick={() => setExpandedSection(expandedSection === 'main_concepts' ? null : 'main_concepts')}>
                 <h2 className="font-bold text-gray-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-gray-500"/> {guide.bookChapters ? 'Análise por Capítulos' : 'Conceitos Fundamentais'}</h2>
                 {expandedSection === 'main_concepts' ? <ChevronDown className="w-5 h-5 text-gray-400"/> : <ChevronRight className="w-5 h-5 text-gray-400"/>}
             </div>
             {expandedSection === 'main_concepts' && (
                 <div className="p-8">
                     {guide.bookChapters ? (<div>{guide.bookChapters.map((chapter, i) => renderChapter(chapter, i))}</div>) : (
                         <div className="space-y-6">
                            {guide.mainConcepts?.map((concept, idx) => (
                                <div key={idx} className="group">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0 group-hover:scale-110 transition-transform">{idx + 1}</div>
                                        <div className="flex-1"><h3 className="text-lg font-bold text-gray-900 mb-2">{concept.concept}</h3><p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{concept.explanation}</p></div>
                                    </div>
                                </div>
                            ))}
                         </div>
                     )}
                 </div>
             )}
          </div>
      </section>

      {/* CHECKPOINTS e ÁREA DE FINALIZAÇÃO */}
      {guide.checkpoints && guide.checkpoints.length > 0 && (
          <section>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2"><Target className="w-5 h-5 text-red-500"/> Plano de Ação (Checkpoints)</h2>
                </div>
                <div className="p-4">
                    <div className="space-y-3">
                        {guide.checkpoints.map((checkpoint) => (
                            <div key={checkpoint.id} 
                                 className={`flex items-center p-4 rounded-xl border transition-all cursor-pointer ${checkpoint.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`}
                                 onClick={() => toggleCheckpoint(checkpoint.id)}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${checkpoint.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                    {checkpoint.completed && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <span className={`flex-1 font-medium ${checkpoint.completed ? 'text-green-800 line-through decoration-green-500' : 'text-gray-700'}`}>{checkpoint.task}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </section>
      )}

      {/* TELA DE PARABÉNS + AGENDAMENTO */}
      {!isParetoOnly && !guide.quiz && guide.checkpoints && guide.checkpoints.every(c => c.completed) && (
          <div className="text-center py-10 bg-gradient-to-b from-indigo-50 to-white rounded-3xl border border-indigo-100 shadow-xl animate-in zoom-in duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>
              
              <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
                  <CheckCircle className="w-12 h-12 text-green-500"/>
              </div>
              
              <h3 className="text-3xl font-extrabold text-gray-900 mb-2">Sessão Concluída!</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">Você completou o roteiro de hoje. Para garantir a memorização de longo prazo, recomendamos agendar sua primeira revisão.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button onClick={onGenerateQuiz} className="bg-white text-indigo-600 border-2 border-indigo-100 px-8 py-3 rounded-xl font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm w-full sm:w-auto">
                      Gerar Quiz Final
                  </button>

                  {/* BOTÃO DE AGENDAMENTO AUTOMÁTICO */}
                  {onScheduleReview && (
                      <button 
                        onClick={() => onScheduleReview(studyIdPlaceholder)} 
                        disabled={isReviewScheduled}
                        className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto ${isReviewScheduled ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-1'}`}
                      >
                          {isReviewScheduled ? (
                              <><Calendar className="w-5 h-5"/> Revisão Agendada</>
                          ) : (
                              <><Clock className="w-5 h-5"/> Agendar Revisão (24h)</>
                          )}
                      </button>
                  )}
              </div>

              {!isReviewScheduled && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 bg-gray-50 inline-block px-4 py-2 rounded-full border border-gray-100">
                      <Brain className="w-3 h-3"/> Baseado na Curva do Esquecimento de Ebbinghaus
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
