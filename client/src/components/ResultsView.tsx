import React, { useState, useEffect, useRef } from 'react';
import { StudyGuide, BookChapter } from '../types';
import { BrainCircuit, PenTool, Target, Eye, CheckCircle, Download, Printer, FileCode, HelpCircle, Brain, Image as ImageIcon, X, Sparkles, RefreshCw, Layers, Play, Lock, ChevronDown, ChevronRight, BookOpen, Clock, Zap } from './Icons';
import { refineContent, generateDiagram } from '../services/geminiService';

interface ResultsViewProps {
  guide: StudyGuide;
  onReset: () => void;
  onGenerateQuiz: () => void;
  onGoToFlashcards?: () => void;
  onUpdateGuide?: (newGuide: StudyGuide) => void;
  isParetoOnly?: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ guide, onReset, onGenerateQuiz, onGoToFlashcards, onUpdateGuide, isParetoOnly = false }) => {
  const [activeMagicMenu, setActiveMagicMenu] = useState<{idx: number, type: 'concept' | 'support' | 'checkpoint'} | null>(null);
  const [magicOutput, setMagicOutput] = useState<{idx: number, text: string} | null>(null);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [loadingImage, setLoadingImage] = useState<number | null>(null); 
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const toggleChapter = (index: number) => {
      setExpandedChapters(prev => ({...prev, [index]: !prev[index]}));
  };

  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const completedCount = guide.checkpoints ? guide.checkpoints.filter(cp => cp.completed).length : 0;
  const totalCount = guide.checkpoints ? guide.checkpoints.length : 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  const adjustTextareaHeight = (element: HTMLTextAreaElement | null) => {
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (textareaRefs.current) {
        textareaRefs.current.forEach(adjustTextareaHeight);
    }
  }, [guide.checkpoints]);

  const generateMarkdown = (guide: StudyGuide) => {
    return `---
tags: [estudo, neurostudy, ${guide.subject.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}]
assunto: ${guide.subject}
data: ${new Date().toLocaleDateString('pt-BR')}
---
# ${guide.subject}
## 🧠 Resumo
${guide.overview}
`;
  };

  const handleDownloadMD = () => {
    const md = generateMarkdown(guide);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${guide.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
  };

  const handlePrint = () => { window.print(); };

  const handleDirectDownloadPDF = () => {
    const element = document.getElementById('printable-guide');
    if (!element) return;
    setIsGeneratingPDF(true);
    element.classList.add('pdf-export');
    const opt = {
      margin: 5,
      filename: `${guide.subject}_neurostudy.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    // @ts-ignore
    const worker = window.html2pdf();
    worker.set(opt).from(element).save().then(() => {
        element.classList.remove('pdf-export');
        setIsGeneratingPDF(false);
    });
  };

  const handleUpdateCheckpoint = (index: number, field: 'noteExactly' | 'drawExactly', value: string) => {
    if (!onUpdateGuide) return;
    const newCheckpoints = [...guide.checkpoints];
    newCheckpoints[index] = { ...newCheckpoints[index], [field]: value };
    onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
  };

  const handleToggleCheckpoint = (index: number) => {
    if (!onUpdateGuide) return;
    const newCheckpoints = [...guide.checkpoints];
    newCheckpoints[index] = { ...newCheckpoints[index], completed: !newCheckpoints[index].completed };
    onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
  };

  const handleMagicAction = async (text: string, task: any, idx: number, type: any) => {
    setLoadingMagic(true);
    setMagicOutput(null);
    try {
      const result = await refineContent(text, task);
      setMagicOutput({ idx, text: result });
    } finally {
      setLoadingMagic(false);
    }
  };

  const handleCloseMagic = () => { setActiveMagicMenu(null); setMagicOutput(null); };

  const handleGenerateImage = async (checkpointIndex: number, description: string) => {
    if (loadingImage !== null) return;
    setLoadingImage(checkpointIndex);
    try {
        const imageUrl = await generateDiagram(description);
        if (imageUrl && onUpdateGuide) {
            const newCheckpoints = [...guide.checkpoints];
            newCheckpoints[checkpointIndex] = { ...newCheckpoints[checkpointIndex], imageUrl };
            onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
        }
    } catch (e) {
        alert("Erro ao gerar diagrama.");
    } finally {
        setLoadingImage(null);
    }
  };

  const renderMarkdownText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <p key={i} className="mb-1">{line}</p>
    ));
  };

  const renderChapter = (chapter: BookChapter, index: number) => {
      const isExpanded = expandedChapters[index];
      return (
          <div key={index} className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden shadow-sm transition-all">
              <button onClick={() => toggleChapter(index)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400"/> : <ChevronRight className="w-5 h-5 text-gray-400"/>}
                      <h4 className="font-bold text-gray-800 text-lg">{chapter.title}</h4>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{chapter.coreConcepts.length} Conceitos</span>
              </button>
              {isExpanded && (
                  <div className="p-6 border-t border-gray-100 space-y-6">
                      <div className="prose prose-sm max-w-none text-gray-600">
                          <h5 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><BookOpen className="w-4 h-4"/> Resumo</h5>
                          {renderMarkdownText(chapter.summary)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {chapter.coreConcepts.map((conc, idx) => (
                              <div key={idx} className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                  <strong className="block text-yellow-900 mb-1">{conc.concept}</strong>
                                  <p className="text-sm text-yellow-800">{conc.definition}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 no-print">
        <button onClick={onReset} className="text-sm text-gray-500 hover:text-indigo-600 underline font-medium">← Voltar</button>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={handleDownloadMD} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium"><FileCode className="w-4 h-4" /> Obsidian</button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium"><Printer className="w-4 h-4" /> Imprimir</button>
          <button onClick={handleDirectDownloadPDF} disabled={isGeneratingPDF} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50">{isGeneratingPDF ? '...' : <Download className="w-4 h-4" />} PDF</button>
        </div>
      </div>

      <div id="printable-guide">
        <div className={`bg-white rounded-xl paper-shadow p-8 border-t-4 ${isParetoOnly ? 'border-red-500' : 'border-indigo-500'} print:shadow-none print:border-0`}>
            <div className="flex justify-between items-start mb-4"><h2 className="text-3xl font-serif font-bold text-gray-900">{guide.subject}</h2></div>
            
            <div className={`mb-6 p-6 rounded-lg border ${isParetoOnly ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className={`flex items-center gap-2 mb-2 ${isParetoOnly ? 'text-red-700' : 'text-indigo-700'} font-semibold uppercase tracking-wide text-sm`}>
                    <BrainCircuit className="w-5 h-5" />
                    <span>{isParetoOnly ? 'RESUMO 80/20' : 'Visão Geral'}</span>
                </div>
                <div className={`${isParetoOnly ? 'text-red-900' : 'text-indigo-900'} leading-relaxed text-lg font-serif`}>
                    {renderMarkdownText(guide.overview)}
                </div>
                {guide.globalApplication && (<div className="mt-4 pt-4 border-t border-indigo-100 text-indigo-800 text-sm"><strong>💡 Aplicação Global:</strong> {guide.globalApplication}</div>)}
            </div>

            {/* SEÇÃO: CONCEITOS CORE */}
            {guide.coreConcepts.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Target className={`w-6 h-6 ${isParetoOnly ? 'text-red-500' : 'text-indigo-500'}`} />
                        {isParetoOnly ? 'Conceitos Chave (20%)' : 'Conceitos Fundamentais'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {guide.coreConcepts.map((item, idx) => {
                            const isActive = activeMagicMenu?.idx === idx && activeMagicMenu?.type === 'concept';
                            const hasResult = magicOutput?.idx === idx;
                            return (
                                <div key={idx} className={`relative bg-white border border-gray-200 p-5 rounded-xl shadow-sm transition-all duration-300 ${isActive ? 'ring-2 ring-indigo-200' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-gray-900 text-lg leading-tight">{item.concept}</h4>
                                        <div className="no-print shrink-0 ml-2">
                                            <button onClick={() => isActive ? handleCloseMagic() : setActiveMagicMenu({idx, type: 'concept'})} className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-300 hover:text-indigo-600'}`}>{isActive ? <X className="w-5 h-5"/> : <Brain className="w-5 h-5" />}</button>
                                        </div>
                                    </div>
                                    {isActive && !loadingMagic && !hasResult && (
                                        <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                            <div className="text-[10px] uppercase font-bold text-indigo-400 mb-2 px-1">Ferramentas Cognitivas:</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <button onClick={() => handleMagicAction(item.definition, 'simplify', idx, 'concept')} className="px-3 py-2 bg-white text-sm rounded-lg text-indigo-900 shadow-sm border border-indigo-100">👶 Explicar Simples</button>
                                                <button onClick={() => handleMagicAction(item.definition, 'example', idx, 'concept')} className="px-3 py-2 bg-white text-sm rounded-lg text-indigo-900 shadow-sm border border-indigo-100">🌍 Exemplo Real</button>
                                            </div>
                                        </div>
                                    )}
                                    {loadingMagic && isActive && <div className="mb-4 text-center text-xs font-bold text-indigo-400 animate-pulse">Processando...</div>}
                                    {hasResult && isActive && (
                                        <div className="mb-4 bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
                                            <div className="p-4 text-sm text-gray-700">{renderMarkdownText(magicOutput.text)}</div>
                                        </div>
                                    )}
                                    <div className="bg-yellow-50 p-4 rounded-lg text-sm text-gray-800 border-l-4 border-yellow-400 font-mono leading-relaxed shadow-sm">"{item.definition}"</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SEÇÃO: CONCEITOS DE SUPORTE */}
            {guide.supportConcepts && guide.supportConcepts.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Layers className="w-6 h-6 text-slate-500" />
                        Conceitos de Suporte (Contexto)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {guide.supportConcepts.map((item, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                                <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400"></span>{item.concept}</h4>
                                <p className="text-sm text-slate-600 leading-relaxed pl-4">{item.definition}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SEÇÃO: CAPÍTULOS DE LIVRO */}
            {guide.chapters && guide.chapters.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Layers className="w-6 h-6 text-indigo-500" /> Estrutura do Livro</h3>
                    <div className="space-y-2">{guide.chapters.map((chapter, idx) => renderChapter(chapter, idx))}</div>
                </div>
            )}
        </div>

        {/* SEÇÃO: JORNADA (CHECKPOINTS) */}
        {!isParetoOnly && guide.checkpoints && guide.checkpoints.length > 0 && (
            <div className="relative mt-8">
                <div className="mb-8 bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
                    <div className="flex justify-between text-sm mb-2"><span className="font-bold text-gray-700 flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500"/> Progresso</span><span className="text-indigo-600 font-bold">{completedCount}/{totalCount} passos</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-3 border border-gray-100 overflow-hidden"><div className="bg-emerald-500 h-3 rounded-full transition-all duration-700" style={{ width: `${progress}%` }}></div></div>
                </div>

                <h3 className="text-2xl font-bold text-gray-800 mb-8 pl-4">A Jornada (Checkpoints)</h3>
                
                <div className="space-y-8 relative">
                    <div className="absolute left-8 top-6 bottom-0 w-0.5 bg-gray-300 hidden md:block print:hidden"></div>
                    
                    {guide.checkpoints.map((cp, idx) => {
                        const showDrawSection = cp.drawLabel !== 'none';
                        const drawLabelText = cp.drawLabel === 'essential' ? 'DESENHO ESSENCIAL' : 'SUGESTÃO VISUAL';
                        const drawColorClass = cp.drawLabel === 'essential' ? 'text-purple-900 border-purple-100 bg-purple-50/50' : 'text-blue-900 border-blue-100 bg-blue-50/50';
                        
                        return (
                        <div key={idx} className="relative md:pl-20 print:pl-0 break-inside-avoid">
                            <div className={`absolute left-4 top-6 w-8 h-8 border-4 rounded-full hidden md:flex items-center justify-center z-10 print:hidden transition-colors duration-300 ${cp.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-indigo-500'}`}>
                                <span className={`text-xs font-bold ${cp.completed ? 'text-white' : 'text-indigo-700'}`}>{cp.completed ? '✓' : idx + 1}</span>
                            </div>

                            <div className={`rounded-xl paper-shadow overflow-hidden border transition-all duration-300 ${cp.completed ? 'border-emerald-200 bg-emerald-50/10' : 'bg-white border-gray-100'}`}>
                                <div className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${cp.completed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-gray-200'}`}>
                                    <div className="flex items-start gap-4">
                                        <button onClick={() => handleToggleCheckpoint(idx)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shrink-0 no-print ${cp.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110' : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-transparent'}`} title={cp.completed ? 'Marcar como pendente' : 'Marcar como concluído'}><CheckCircle className="w-6 h-6" /></button>
                                        <div><span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${cp.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>Checkpoint #{idx + 1}</span><h4 className={`font-bold text-lg mt-1 transition-colors ${cp.completed ? 'text-emerald-900' : 'text-gray-900'}`}>{cp.mission}</h4></div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-white/50 px-3 py-1 rounded-full border border-gray-100">
                                        <Clock className="w-4 h-4" />
                                        <span>{cp.timestamp}</span>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="flex gap-4">
                                        <div className="mt-1"><Eye className="w-5 h-5 text-blue-500" /></div>
                                        <div><h5 className="font-bold text-gray-700 text-sm uppercase mb-1">O que procurar:</h5><p className="text-gray-600 leading-relaxed">{cp.lookFor}</p></div>
                                    </div>

                                    <div className="flex gap-4 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
                                        <div className="mt-1"><PenTool className="w-5 h-5 text-orange-500" /></div>
                                        <div className="flex-1 w-full">
                                            <h5 className="font-bold text-gray-700 text-sm uppercase mb-1">Anotar:</h5>
                                            <textarea className="w-full bg-transparent border-none outline-none resize-none font-serif text-lg text-gray-800 leading-relaxed overflow-hidden" value={cp.noteExactly} onChange={(e) => { handleUpdateCheckpoint(idx, 'noteExactly', e.target.value); adjustTextareaHeight(e.target); }} rows={1} />
                                        </div>
                                    </div>

                                    {showDrawSection && (
                                        <div className={`flex gap-4 p-4 rounded-lg border ${drawColorClass}`}>
                                            <div className="mt-1"><PenTool className={`w-5 h-5 ${cp.drawLabel === 'essential' ? 'text-purple-500' : 'text-blue-500'}`} /></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h5 className={`font-bold text-sm uppercase flex items-center gap-2 ${cp.drawLabel === 'essential' ? 'text-purple-900' : 'text-blue-900'}`}>
                                                        {drawLabelText}
                                                    </h5>
                                                    {/* BOTÃO ATUALIZADO */}
                                                    {!cp.imageUrl && (
                                                        <button onClick={() => handleGenerateImage(idx, cp.drawExactly)} disabled={loadingImage === idx} className="text-xs bg-white/50 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 no-print disabled:opacity-50 border border-gray-200 shadow-sm font-bold">
                                                            {loadingImage === idx ? 'Desenhando...' : <><Zap className="w-3 h-3 text-yellow-500"/> Gerar Esboço (Diagrama)</>}
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-gray-700 italic border-l-2 border-gray-300 pl-3 mb-3">{cp.drawExactly}</p>
                                                
                                                {cp.imageUrl ? (
                                                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative group bg-white">
                                                         <img src={cp.imageUrl} alt="Diagrama" className="w-full h-auto max-h-64 object-contain p-2" />
                                                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                             <button onClick={() => handleGenerateImage(idx, cp.drawExactly)} className="bg-white/90 p-2 rounded-full hover:bg-white text-gray-700 shadow-md" title="Regerar"><RefreshCw className="w-4 h-4"/></button>
                                                         </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-sm">Espaço para desenho (Use o botão acima para gerar uma ideia)</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-2 mb-2"><HelpCircle className="w-4 h-4 text-indigo-500" /><span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pergunta de Verificação</span></div>
                                        <p className="font-bold text-gray-800">{cp.question}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
