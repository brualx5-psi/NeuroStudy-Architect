import React, { useState, useEffect, useRef } from 'react';
import { StudyGuide } from '../types';
import { BrainCircuit, PenTool, Target, Eye, CheckCircle, Download, Printer, FileCode, HelpCircle, Brain, Image as ImageIcon, X, Edit, Layers, ChevronRight, Smile, Sparkles, Globe, Lock, Play, RefreshCw, Clock } from './Icons';
import { refineContent, generateDiagram } from '../services/geminiService';

interface ResultsViewProps {
  guide: StudyGuide;
  onReset: () => void;
  onGenerateQuiz: () => void;
  onUpdateGuide?: (newGuide: StudyGuide) => void;
  isParetoOnly?: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ guide, onReset, onGenerateQuiz, onUpdateGuide, isParetoOnly = false }) => {
  const [activeMagicMenu, setActiveMagicMenu] = useState<{idx: number, type: 'concept' | 'checkpoint'} | null>(null);
  const [magicOutput, setMagicOutput] = useState<{idx: number, text: string} | null>(null);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [loadingImage, setLoadingImage] = useState<number | null>(null); 
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Calculate Progress
  const completedCount = guide.checkpoints.filter(cp => cp.completed).length;
  const totalCount = guide.checkpoints.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  const adjustTextareaHeight = (element: HTMLTextAreaElement | null) => {
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  };

  useEffect(() => {
    textareaRefs.current.forEach(adjustTextareaHeight);
  }, [guide.checkpoints]);

  const generateMarkdown = (guide: StudyGuide) => {
    return `---
tags: [estudo, neurostudy, ${guide.subject.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}]
assunto: ${guide.subject}
data: ${new Date().toLocaleDateString('pt-BR')}
status: 🟧 Ativo
progress: ${completedCount}/${totalCount}
---

# ${guide.subject}

## 🧠 ${isParetoOnly ? 'RESUMO PARETO 80/20' : 'Advance Organizer'}
${guide.overview}

## 🎯 Conceitos Core
${guide.coreConcepts.map(c => `- **${c.concept}**: ${c.definition}`).join('\n')}

${!isParetoOnly ? `
## 📍 Jornada de Aprendizagem (Checkpoints)

${guide.checkpoints.map((cp, i) => `### ${i+1}. ${cp.mission} [${cp.completed ? 'x' : ' '}]
> **Tempo**: ${cp.timestamp}

- 👁️ **Procurar**: ${cp.lookFor}
- 📝 **Anotar**: ${cp.noteExactly}
${cp.drawExactly && cp.drawLabel !== 'none' ? `- ✏️ **Desenhar (${cp.drawLabel})**: ${cp.drawExactly}` : ''}
${cp.imageUrl ? `![Diagrama](${cp.imageUrl})` : ''}
- ❓ **Pergunta**: ${cp.question}
`).join('\n')}
` : ''}

---
*Gerado por NeuroStudy Architect*
`;
  };

  const handleDownloadMD = () => {
    const md = generateMarkdown(guide);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${guide.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_obsidian.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDirectDownloadPDF = () => {
    const element = document.getElementById('printable-guide');
    if (!element) return;
    setIsGeneratingPDF(true);
    element.classList.add('pdf-export');
    const opt = {
      margin: 5,
      filename: `${guide.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_neurostudy.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    const worker = (window as any).html2pdf();
    worker.set(opt).from(element).save().then(() => {
        element.classList.remove('pdf-export');
        setIsGeneratingPDF(false);
    }).catch((err: any) => {
        console.error("PDF generation failed", err);
        element.classList.remove('pdf-export');
        setIsGeneratingPDF(false);
        alert("Erro ao gerar PDF. Tente a opção 'Imprimir' em vez disso.");
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
    newCheckpoints[index] = { 
      ...newCheckpoints[index], 
      completed: !newCheckpoints[index].completed,
      completedAt: !newCheckpoints[index].completed ? Date.now() : undefined
    };
    onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
  };

  const handleFormat = (index: number, tag: string) => {
    const textareaId = `note-textarea-${index}`;
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea || !onUpdateGuide) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = guide.checkpoints[index].noteExactly;
    if (start === end) return; 
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    const newText = `${before}<${tag}>${selected}</${tag}>${after}`;
    handleUpdateCheckpoint(index, 'noteExactly', newText);
  };

  const handleMagicAction = async (text: string, task: 'simplify' | 'example' | 'mnemonic' | 'joke', idx: number) => {
    setLoadingMagic(true);
    setMagicOutput(null);
    try {
      const result = await refineContent(text, task);
      setMagicOutput({ idx, text: result });
    } catch (e) {
      console.error(e);
      setLoadingMagic(false);
    } finally {
      setLoadingMagic(false);
    }
  };

  const handleCloseMagic = () => {
      setActiveMagicMenu(null);
      setMagicOutput(null);
      setLoadingMagic(false);
  };

  const handleGenerateImage = async (checkpointIndex: number, description: string) => {
    if (loadingImage !== null) return;
    setLoadingImage(checkpointIndex);
    try {
        const imageUrl = await generateDiagram(description);
        if (onUpdateGuide) {
            const newCheckpoints = [...guide.checkpoints];
            newCheckpoints[checkpointIndex] = { ...newCheckpoints[checkpointIndex], imageUrl };
            onUpdateGuide({ ...guide, checkpoints: newCheckpoints });
        }
    } catch (e) {
        alert("Erro ao gerar imagem. Tente novamente.");
    } finally {
        setLoadingImage(null);
    }
  };

  const renderFormatted = (text: string) => {
      return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const renderMarkdownText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <p key={i} className="mb-1 last:mb-0">
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
      </p>
    ));
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 no-print">
        <button onClick={onReset} className="text-sm text-gray-500 hover:text-indigo-600 underline font-medium">
          ← {isParetoOnly ? 'Analisar outro arquivo' : 'Criar novo roteiro'}
        </button>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={handleDownloadMD} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors" title="Baixar Nota para Obsidian (Markdown)"><FileCode className="w-4 h-4" /> Salvar Obsidian</button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors" title="Imprimir (Opção Nativa)"><Printer className="w-4 h-4" /> Imprimir</button>
          <button onClick={handleDirectDownloadPDF} disabled={isGeneratingPDF} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50" title="Baixar arquivo PDF direto">{isGeneratingPDF ? <span className="animate-spin text-white">⌛</span> : <Download className="w-4 h-4" />} {isGeneratingPDF ? 'Gerando...' : 'Download PDF'}</button>
        </div>
      </div>

      <div id="printable-guide">
        <div className={`bg-white rounded-xl paper-shadow p-8 border-t-4 ${isParetoOnly ? 'border-red-500' : 'border-indigo-500'} print:shadow-none print:border-0 print:border-t-0 print:mb-6`}>
            <div className="flex justify-between items-start mb-4"><h2 className="text-3xl font-serif font-bold text-gray-900">{guide.subject}</h2></div>
            
            <div className={`mb-6 p-6 rounded-lg border ${isParetoOnly ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'} print:bg-gray-50 print:border-gray-300`}>
            <div className={`flex items-center gap-2 mb-2 ${isParetoOnly ? 'text-red-700' : 'text-indigo-700'} font-semibold uppercase tracking-wide text-sm print:text-black`}>
                <BrainCircuit className="w-5 h-5" />
                <span>{isParetoOnly ? 'RESUMO EXECUTIVO (80/20)' : 'Advance Organizer (O Mapa)'}</span>
            </div>
            <div className={`${isParetoOnly ? 'text-red-900 whitespace-pre-wrap' : 'text-indigo-900'} leading-relaxed text-lg font-serif print:text-black`}>
                {renderMarkdownText(guide.overview)}
            </div>
            </div>

            {guide.coreConcepts.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Target className={`w-6 h-6 ${isParetoOnly ? 'text-red-500' : 'text-indigo-500'} print:text-black`} />
                        {isParetoOnly ? 'Conceitos Chave (O 20%)' : 'Conceitos Core'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {guide.coreConcepts.map((item, idx) => {
                            const isActive = activeMagicMenu?.idx === idx && activeMagicMenu?.type === 'concept';
                            const hasResult = magicOutput?.idx === idx;
                            
                            return (
                                <div key={idx} className={`relative bg-white border border-gray-200 p-5 rounded-xl shadow-sm print:shadow-none print:border-black break-inside-avoid transition-all duration-300 ${isActive ? 'ring-2 ring-indigo-200' : ''}`}>
                                    <span className="block text-xs font-bold text-gray-400 mb-1 print:text-gray-600">CONCEITO #{idx + 1}</span>
                                    
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-gray-900 text-lg leading-tight">{item.concept}</h4>
                                        <div className="no-print shrink-0 ml-2">
                                            <button 
                                                onClick={() => isActive ? handleCloseMagic() : setActiveMagicMenu({idx, type: 'concept'})} 
                                                className={`p-1.5 rounded-lg transition-all duration-200 ${isActive ? 'bg-indigo-100 text-indigo-700 rotate-90' : 'text-gray-300 hover:text-indigo-600 hover:bg-gray-50'}`} 
                                                title={isActive ? "Fechar Insight" : "Abrir Insight Cerebral"}
                                            >
                                                {isActive ? <X className="w-5 h-5"/> : <Brain className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* TOOLBAR EXPANDABLE */}
                                    {isActive && !loadingMagic && !hasResult && (
                                        <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 animate-in slide-in-from-top-2 fade-in duration-200">
                                            <div className="text-[10px] uppercase font-bold text-indigo-400 mb-2 px-1 flex items-center gap-1"><Sparkles className="w-3 h-3"/> Escolha uma lente cognitiva:</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <button onClick={() => handleMagicAction(item.definition, 'simplify', idx)} className="text-left px-3 py-2 bg-white hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 text-sm rounded-lg text-indigo-900 transition-colors flex items-center gap-2 shadow-sm">👶 Explicar Simples</button>
                                                <button onClick={() => handleMagicAction(item.definition, 'example', idx)} className="text-left px-3 py-2 bg-white hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 text-sm rounded-lg text-indigo-900 transition-colors flex items-center gap-2 shadow-sm">🌍 Exemplo Real</button>
                                                <button onClick={() => handleMagicAction(item.definition, 'mnemonic', idx)} className="text-left px-3 py-2 bg-white hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 text-sm rounded-lg text-indigo-900 transition-colors flex items-center gap-2 shadow-sm">🧠 Criar Mnemônico</button>
                                                <button onClick={() => handleMagicAction(item.concept, 'joke', idx)} className="text-left px-3 py-2 bg-white hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 text-sm rounded-lg text-indigo-900 transition-colors flex items-center gap-2 shadow-sm">🎭 Criar Piada</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* LOADING STATE */}
                                    {loadingMagic && isActive && (
                                        <div className="mb-4 flex flex-col items-center justify-center p-6 bg-white rounded-xl border-2 border-indigo-100 border-dashed animate-pulse">
                                             <Brain className="w-10 h-10 text-indigo-500 animate-spin mb-2" />
                                             <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Processando Insight...</span>
                                        </div>
                                    )}

                                    {/* RESULT DISPLAY */}
                                    {hasResult && isActive && (
                                        <div className="mb-4 bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                            <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-100 flex justify-between items-center">
                                                <span className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-1"><Brain className="w-3 h-3"/> Insight Gerado</span>
                                            </div>
                                            <div className="p-4 text-sm text-gray-700 leading-relaxed">
                                                {renderMarkdownText(magicOutput.text)}
                                            </div>
                                            <div className="bg-gray-50 px-3 py-2 text-center border-t border-gray-100">
                                                <button onClick={handleCloseMagic} className="text-xs text-indigo-600 font-bold hover:underline">Fechar Insight</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-yellow-50 p-4 rounded-lg text-sm text-gray-800 border-l-4 border-yellow-400 font-mono print:bg-white print:border print:border-black print:italic leading-relaxed shadow-sm">
                                        <p className="text-[10px] font-bold text-yellow-600 uppercase mb-1">DEFINIÇÃO:</p>
                                        "{item.definition}"
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {!isParetoOnly && guide.checkpoints.length > 0 && (
            <div className="relative mt-8">
                <div className="mb-8 bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-gray-700 flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500"/> Progresso da Jornada</span>
                        <span className="text-indigo-600 font-bold">{completedCount}/{totalCount} checkpoints</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 border border-gray-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-1" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300 hidden md:block print:hidden"></div>
                <h3 className="text-2xl font-bold text-gray-800 mb-8 pl-4 print:pl-0">A Jornada (Checkpoints)</h3>
                <div className="space-y-8">
                {guide.checkpoints.map((cp, idx) => {
                    const showDrawSection = cp.drawExactly && cp.drawExactly.trim().length > 0 && cp.drawLabel !== 'none';
                    const drawLabelText = cp.drawLabel === 'essential' ? 'DESENHO ESSENCIAL' : 'SUGESTÃO VISUAL';
                    
                    return (
                    <div key={idx} className="relative md:pl-20 print:pl-0 break-inside-avoid">
                        <div className={`absolute left-4 top-6 w-8 h-8 border-4 rounded-full hidden md:flex items-center justify-center z-10 print:hidden transition-colors duration-300 ${cp.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-indigo-500'}`}>
                            <span className={`text-xs font-bold ${cp.completed ? 'text-white' : 'text-indigo-700'}`}>{cp.completed ? '✓' : idx + 1}</span>
                        </div>

                        <div className={`rounded-xl paper-shadow overflow-hidden border transition-all duration-300 print:shadow-none print:border-black print:mb-4 ${cp.completed ? 'border-emerald-200 bg-emerald-50/10' : 'bg-white border-gray-100'}`}>
                            <div className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${cp.completed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-gray-200'} print:bg-gray-100 print:border-black`}>
                                <div className="flex items-start gap-4">
                                    <button onClick={() => handleToggleCheckpoint(idx)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shrink-0 no-print ${cp.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110' : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-transparent'}`} title={cp.completed ? 'Marcar como pendente' : 'Marcar como concluído'}><CheckCircle className="w-6 h-6" /></button>
                                    <div><span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider print:border print:border-black print:bg-white print:text-black ${cp.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>Checkpoint #{idx + 1}</span><h4 className={`font-bold text-lg mt-1 transition-colors ${cp.completed ? 'text-emerald-900' : 'text-gray-900'}`}>{cp.mission}</h4></div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-white/50 px-3 py-1 rounded-full border border-gray-100 print:bg-white print:border print:border-black">
                                    <Clock className="w-4 h-4" />
                                    <span>{cp.timestamp}</span>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="flex gap-4">
                                    <div className="mt-1"><Eye className="w-5 h-5 text-blue-500" /></div>
                                    <div><h5 className="font-bold text-gray-700 text-sm uppercase mb-1">O que procurar:</h5><p className="text-gray-600 leading-relaxed">{cp.lookFor}</p></div>
                                </div>

                                <div className="flex gap-4 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 print:bg-white print:border-gray-200">
                                    <div className="mt-1"><PenTool className="w-5 h-5 text-orange-500" /></div>
                                    <div className="flex-1 w-full">
                                        <div className="flex justify-between items-center mb-1">
                                            <h5 className="font-bold text-gray-700 text-sm uppercase">Anotar Exatamente Isso:</h5>
                                            <div className="flex gap-1 no-print">
                                                <button onClick={() => handleFormat(idx, 'b')} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-bold hover:bg-gray-50" title="Negrito">B</button>
                                                <button onClick={() => handleFormat(idx, 'mark')} className="px-2 py-0.5 bg-yellow-100 border border-yellow-200 rounded text-xs font-bold text-yellow-800 hover:bg-yellow-200" title="Marca-texto">M</button>
                                            </div>
                                        </div>
                                        <textarea
                                            id={`note-textarea-${idx}`}
                                            className="w-full bg-transparent border-none outline-none resize-none font-serif text-lg text-gray-800 leading-relaxed overflow-hidden"
                                            value={cp.noteExactly}
                                            onChange={(e) => handleUpdateCheckpoint(idx, 'noteExactly', e.target.value)}
                                            rows={1}
                                        />
                                    </div>
                                </div>

                                {showDrawSection && (
                                    <div className="flex gap-4 bg-purple-50/50 p-4 rounded-lg border border-purple-100 print:bg-white print:border-gray-200">
                                        <div className="mt-1"><Edit className="w-5 h-5 text-purple-500" /></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="font-bold text-purple-900 text-sm uppercase flex items-center gap-2">
                                                    {drawLabelText}
                                                    {cp.drawLabel === 'essential' && <span className="bg-purple-200 text-purple-800 text-[10px] px-1.5 py-0.5 rounded-full">Obrigatório</span>}
                                                </h5>
                                                {!cp.imageUrl && (
                                                    <button 
                                                        onClick={() => handleGenerateImage(idx, cp.drawExactly)} 
                                                        disabled={loadingImage === idx}
                                                        className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition-colors flex items-center gap-1 no-print disabled:opacity-50"
                                                    >
                                                        {loadingImage === idx ? 'Gerando...' : <><ImageIcon className="w-3 h-3"/> Gerar Diagrama AI</>}
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-gray-700 italic border-l-2 border-purple-300 pl-3 mb-3">{cp.drawExactly}</p>
                                            
                                            {cp.imageUrl ? (
                                                <div className="mt-2 rounded-lg overflow-hidden border border-purple-200 shadow-sm relative group">
                                                     <img src={cp.imageUrl} alt="Diagrama gerado por IA" className="w-full h-auto max-h-64 object-contain bg-white" />
                                                     <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                         <button onClick={() => handleGenerateImage(idx, cp.drawExactly)} className="bg-white/80 p-1.5 rounded-full hover:bg-white text-purple-700 shadow-sm" title="Regerar Imagem"><RefreshCw className="w-4 h-4"/></button>
                                                     </div>
                                                </div>
                                            ) : (
                                                <div className="h-32 border-2 border-dashed border-purple-200 rounded-lg flex items-center justify-center text-purple-300 text-sm print:border-black">Espaço para desenho</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 print:bg-white print:border-black">
                                    <div className="flex items-center gap-2 mb-2">
                                        <HelpCircle className="w-4 h-4 text-indigo-500" />
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pergunta de Verificação</span>
                                    </div>
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