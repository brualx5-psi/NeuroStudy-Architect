import React, { useState, useEffect, useRef } from 'react';
import { StudyGuide } from '../types';
import { BrainCircuit, PenTool, Target, Eye, CheckCircle, Download, Printer, FileCode, HelpCircle, Brain, Image as ImageIcon, X, Edit, Layers, ChevronRight } from './Icons';
import { refineContent, generateDiagram } from '../services/geminiService';

interface ResultsViewProps {
  guide: StudyGuide;
  onReset: () => void;
  onGenerateQuiz: () => void;
  onUpdateGuide?: (newGuide: StudyGuide) => void;
  isParetoOnly?: boolean;
  onUnlockFullStudy?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ guide, onReset, onGenerateQuiz, onUpdateGuide, isParetoOnly = false, onUnlockFullStudy }) => {
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

${!isParetoOnly ? `
## 🎯 Conceitos Core (Pareto 80/20)
${guide.coreConcepts.map(c => `- **${c.concept}**: ${c.definition}`).join('\n')}

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

  const handleMagicAction = async (text: string, task: 'simplify' | 'example' | 'mnemonic', idx: number) => {
    setActiveMagicMenu(null);
    setLoadingMagic(true);
    setMagicOutput(null);
    try {
      const result = await refineContent(text, task);
      setMagicOutput({ idx, text: result });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMagic(false);
    }
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
      
      {!isParetoOnly && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 no-print">
            <button onClick={onReset} className="text-sm text-gray-500 hover:text-indigo-600 underline font-medium">← Criar novo roteiro</button>
            <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={onGenerateQuiz} className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors" title="Gerar Quiz de Revisão"><HelpCircle className="w-4 h-4" /> Gerar Quiz</button>
            <button onClick={handleDownloadMD} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors" title="Baixar Nota para Obsidian (Markdown)"><FileCode className="w-4 h-4" /> Salvar Obsidian</button>
            <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors" title="Imprimir (Opção Nativa)"><Printer className="w-4 h-4" /> Imprimir</button>
            <button onClick={handleDirectDownloadPDF} disabled={isGeneratingPDF} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50" title="Baixar arquivo PDF direto">{isGeneratingPDF ? <span className="animate-spin text-white">⌛</span> : <Download className="w-4 h-4" />} {isGeneratingPDF ? 'Gerando...' : 'Download PDF'}</button>
            </div>
        </div>
      )}

      <div id="printable-guide">
        <div className={`bg-white rounded-xl paper-shadow p-8 border-t-4 ${isParetoOnly ? 'border-red-500' : 'border-indigo-500'} print:shadow-none print:border-0 print:border-t-0 print:mb-6`}>
            <div className="flex justify-between items-start mb-4"><h2 className="text-3xl font-serif font-bold text-gray-900">{guide.subject}</h2></div>
            
            <div className={`mb-6 p-6 rounded-lg border ${isParetoOnly ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'} print:bg-gray-50 print:border-gray-300`}>
            <div className={`flex items-center gap-2 mb-2 ${isParetoOnly ? 'text-red-700' : 'text-indigo-700'} font-semibold uppercase tracking-wide text-sm print:text-black`}>
                <BrainCircuit className="w-5 h-5" />
                <span>{isParetoOnly ? 'ESSÊNCIA PARETO 80/20' : 'Advance Organizer (O Mapa)'}</span>
            </div>
            <div className={`${isParetoOnly ? 'text-red-900 whitespace-pre-wrap' : 'text-indigo-900'} leading-relaxed text-lg font-serif print:text-black`}>
                {renderMarkdownText(guide.overview)}
            </div>
            </div>

            {/* Concepts and Checkpoints are now HIDDEN in Pareto Mode */}
            {!isParetoOnly && guide.coreConcepts.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Target className="w-6 h-6 text-red-500 print:text-black" />
                        Conceitos Core (Pareto 80/20)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {guide.coreConcepts.map((item, idx) => (
                        <div key={idx} className="relative bg-white border border-gray-200 p-4 rounded-lg shadow-sm print:shadow-none print:border-black break-inside-avoid group">
                            <span className="block text-xs font-bold text-gray-400 mb-1 print:text-gray-600">CONCEITO #{idx + 1}</span>
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-gray-900 mb-2">{item.concept}</h4>
                                <div className="relative no-print">
                                    <button onClick={() => setActiveMagicMenu(activeMagicMenu?.idx === idx && activeMagicMenu?.type === 'concept' ? null : {idx, type: 'concept'})} className="p-1 text-gray-300 hover:text-indigo-600 transition-colors" title="INSIGHT CEREBRAL"><Brain className="w-4 h-4" /></button>
                                    {activeMagicMenu?.idx === idx && activeMagicMenu?.type === 'concept' && (
                                        <div className="absolute right-0 top-6 bg-white shadow-xl border border-gray-100 rounded-lg p-1 w-48 z-20 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                                            <div className="px-3 py-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-b border-gray-100 mb-1">Insight Cerebral</div>
                                            <button onClick={() => handleMagicAction(item.definition, 'simplify', idx)} className="text-left px-3 py-2 hover:bg-gray-50 text-sm rounded text-gray-700">👶 Explicar como p/ 5 anos</button>
                                            <button onClick={() => handleMagicAction(item.definition, 'example', idx)} className="text-left px-3 py-2 hover:bg-gray-50 text-sm rounded text-gray-700">🌍 Dar exemplo real</button>
                                            <button onClick={() => handleMagicAction(item.definition, 'mnemonic', idx)} className="text-left px-3 py-2 hover:bg-gray-50 text-sm rounded text-gray-700">🧠 Criar mnemônico</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-yellow-50 p-3 rounded text-sm text-gray-800 border-l-4 border-yellow-400 font-mono print:bg-white print:border-black print:italic">
                            ANOTAR EXATAMENTE ISSO: <br/>
                            "{item.definition}"
                            </div>
                            {magicOutput?.idx === idx && activeMagicMenu?.type === 'concept' && ( 
                                <div className="mt-2 bg-indigo-50 p-3 rounded text-sm text-indigo-800 border border-indigo-100 animate-fade-in">
                                    <div className="flex justify-between mb-1"><span className="font-bold text-xs uppercase flex items-center gap-1"><Brain className="w-3 h-3"/> Insight Cerebral</span><button onClick={() => setMagicOutput(null)} className="text-xs hover:text-indigo-900"><X className="w-3 h-3"/></button></div>
                                    {renderMarkdownText(magicOutput.text)}
                                </div>
                            )}
                            {loadingMagic && activeMagicMenu?.idx === idx && activeMagicMenu?.type === 'concept' && (
                                <div className="mt-2 text-xs text-indigo-500 animate-pulse flex items-center gap-1"><span className="animate-spin">🧠</span> Gerando insight...</div>
                            )}
                        </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {isParetoOnly && onUnlockFullStudy && (
            <div className="mt-8 bg-white p-8 rounded-xl border-2 border-dashed border-gray-200 text-center animate-fade-in">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Quer ir além do resumo?</h3>
                <p className="text-gray-500 mb-6 max-w-lg mx-auto">O NeuroStudy gerou a essência. Para um estudo ativo completo com checkpoints e quiz, clique abaixo.</p>
                <button onClick={onUnlockFullStudy} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-transform active:scale-95 flex items-center gap-2 mx-auto">
                    <Layers className="w-5 h-5"/> Desbloquear Estudo Completo <ChevronRight className="w-4 h-4"/>
                </button>
            </div>
        )}

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
                                <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-white/50 px-3 py-1 rounded-full border border-gray-100 print:bg-white print:border print:border-black print:text-black self-start md:self-auto"><span>⏱️ {cp.timestamp}</span></div>
                            </div>

                            <div className={`p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${cp.completed ? 'opacity-80 hover:opacity-100' : 'opacity-100'}`}>
                                <div className="space-y-4">
                                    <div className="flex gap-3"><div className="min-w-6 pt-1 text-blue-500 print:text-black"><Eye className="w-5 h-5"/></div><div><p className="text-xs font-bold text-gray-400 uppercase print:text-black">Procurar</p><p className="text-gray-700 print:text-black">{cp.lookFor}</p></div></div>
                                    <div className="flex gap-3"><div className="min-w-6 pt-1 text-green-600 print:text-black"><CheckCircle className="w-5 h-5"/></div><div><p className="text-xs font-bold text-gray-400 uppercase print:text-black">Pergunta (Active Recall)</p><p className="text-gray-800 font-medium italic print:text-black">"{cp.question}"</p></div></div>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-5 border border-yellow-100 space-y-4 print:bg-white print:border-black">
                                    <div className="flex gap-3 group/edit"><div className="min-w-6 pt-1 text-gray-600 print:text-black"><PenTool className="w-5 h-5"/></div><div className="w-full"><div className="flex items-center justify-between mb-1"><p className="text-xs font-bold text-gray-500 uppercase print:text-black">Anotar Exatamente Isso</p><div className="flex gap-1 opacity-0 group-hover/edit:opacity-100 transition-opacity bg-white shadow-sm border border-gray-200 rounded px-1 no-print"><button onMouseDown={(e) => {e.preventDefault(); handleFormat(idx, 'b');}} className="px-1 text-xs font-serif font-bold hover:bg-gray-100" title="Negrito">B</button><button onMouseDown={(e) => {e.preventDefault(); handleFormat(idx, 'i');}} className="px-1 text-xs font-serif italic hover:bg-gray-100" title="Itálico">I</button><button onMouseDown={(e) => {e.preventDefault(); handleFormat(idx, 'u');}} className="px-1 text-xs font-serif underline hover:bg-gray-100" title="Sublinhado">U</button></div></div><div className="border-l-2 border-gray-300 pl-3 print:border-black"><textarea id={`note-textarea-${idx}`} ref={el => { textareaRefs.current[idx] = el; if(el) adjustTextareaHeight(el); }} value={cp.noteExactly} onInput={(e) => adjustTextareaHeight(e.target as HTMLTextAreaElement)} onChange={(e) => handleUpdateCheckpoint(idx, 'noteExactly', e.target.value)} className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-gray-200 focus:border-indigo-300 rounded px-2 py-1 transition-all text-gray-900 font-serif leading-relaxed resize-none overflow-hidden print:hidden focus:outline-none focus:ring-2 focus:ring-indigo-100" spellCheck={false} placeholder="Clique para editar..." /><div className="hidden print:block text-gray-900 font-serif leading-relaxed whitespace-pre-wrap">{renderFormatted(cp.noteExactly)}</div></div></div></div>
                                    {showDrawSection && (
                                    <div className={`mt-4 pt-4 border-t ${cp.drawLabel === 'essential' ? 'border-orange-200' : 'border-gray-200'} print:border-black`}>
                                        <div className="flex justify-between items-center mb-2"><p className={`text-xs font-bold uppercase print:text-black ${cp.drawLabel === 'essential' ? 'text-orange-600' : 'text-slate-500'}`}>{drawLabelText}</p>{!cp.imageUrl && (<button onClick={() => handleGenerateImage(idx, cp.drawExactly)} disabled={loadingImage === idx} className="text-xs flex items-center gap-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded transition-colors no-print">{loadingImage === idx ? <span className="animate-spin">⌛</span> : <ImageIcon className="w-3 h-3" />} Gerar Diagrama IA</button>)}</div>
                                        {cp.imageUrl ? (<div className="relative group"><img src={cp.imageUrl} alt="Diagrama Gerado" className="w-full h-auto rounded border border-gray-200" /><button onClick={() => handleGenerateImage(idx, cp.drawExactly)} className="absolute top-2 right-2 bg-white/80 p-1 rounded hover:bg-white text-xs opacity-0 group-hover:opacity-100 transition-opacity no-print">Regerar</button></div>) : (<div className={`border-2 border-dashed rounded p-4 text-sm print:border-black print:text-black group/editdraw relative ${cp.drawLabel === 'essential' ? 'border-orange-300 bg-orange-50/50 text-orange-800' : 'border-gray-300 bg-white text-gray-500'}`}><div className="flex gap-2"><span className="pt-1">✏️</span><div className="w-full"><textarea value={cp.drawExactly} onChange={(e) => handleUpdateCheckpoint(idx, 'drawExactly', e.target.value)} className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-gray-200 focus:border-indigo-300 rounded px-2 py-1 transition-all text-inherit text-sm resize-y print:hidden focus:outline-none focus:ring-2 focus:ring-indigo-100" rows={2} /><div className="hidden print:block">{renderFormatted(cp.drawExactly)}</div></div></div><span className="absolute top-2 right-2 opacity-0 group-hover/editdraw:opacity-100 transition-opacity text-gray-300 print:hidden"><Edit className="w-3 h-3"/></span></div>)}
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )})}
                </div>
            </div>
        )}
      </div>
      
      {!isParetoOnly && (
        <div className="bg-emerald-50 rounded-xl p-8 text-center border border-emerald-100 no-print">
            <h3 className="text-emerald-800 font-bold text-lg mb-2">Fase 3: Consolidação</h3>
            <p className="text-emerald-700 mb-4 max-w-2xl mx-auto">Você completou o mapa! Agora faça a <strong>Revisão Imediata</strong> lendo suas anotações em voz alta. Agende a primeira repetição espaçada para amanhã.</p>
            <div className="flex justify-center gap-4"><button onClick={onGenerateQuiz} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center gap-2"><HelpCircle className="w-5 h-5" /> Fazer Quiz Agora</button></div>
        </div>
      )}
    </div>
  );
};