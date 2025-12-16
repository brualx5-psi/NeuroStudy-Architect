import React, { useState, useEffect, useRef } from 'react';
import { InputType, ProcessingState, StudyGuide, StudySession, Folder, StudySource, StudyMode } from './types';
import { generateStudyGuide, generateSlides, generateQuiz, generateFlashcards } from './services/geminiService';
import { ResultsView } from './components/ResultsView';
import { SlidesView } from './components/SlidesView';
import { QuizView } from './components/QuizView';
import { FlashcardsView } from './components/FlashcardsView';
import { ChatWidget } from './components/ChatWidget';
import { Sidebar } from './components/Sidebar';
import { MethodologyModal } from './components/MethodologyModal';
import { ProcessingStatus } from './components/ProcessingStatus';
import { PomodoroTimer } from './components/PomodoroTimer';
import { ReviewSchedulerModal } from './components/ReviewSchedulerModal';
import { NotificationCenter } from './components/NotificationCenter';
import { SourcePreviewModal } from './components/SourcePreviewModal';
import { NeuroLogo, Brain, UploadCloud, FileText, Video, Search, BookOpen, Monitor, HelpCircle, Plus, Trash, Zap, Link, Rocket, BatteryCharging, Activity, GraduationCap, Globe, Edit, CheckCircle, Layers, Camera, Target, ChevronRight, Menu, Lock, Bell, Calendar, GenerateIcon, Eye, Settings, Play } from './components/Icons';

export function App() {
  // ... estados existentes ...

  // NOVAS FUNÇÕES PARA O NOTIFICATION CENTER
  const handleMarkReviewDone = (studyId: string) => {
      // Exemplo: reagenda para daqui a 7 dias (lógica simples de espaçamento)
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);
      setStudies(prev => prev.map(s => s.id === studyId ? { ...s, nextReviewDate: nextDate.getTime() } : s));
  };

  const handleSnoozeReview = (studyId: string) => {
      // Adia por 1 dia
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);
      setStudies(prev => prev.map(s => s.id === studyId ? { ...s, nextReviewDate: nextDate.getTime() } : s));
  };

  const handleDeleteReview = (studyId: string) => {
      // Remove o agendamento
      setStudies(prev => prev.map(s => s.id === studyId ? { ...s, nextReviewDate: undefined } : s));
  };

  // ... (código do componente continua) ...

  return (
    <div className="flex h-screen bg-white font-sans text-slate-800 overflow-hidden animate-in fade-in duration-500">
      <Sidebar folders={folders} studies={studies} activeStudyId={activeStudyId} onSelectStudy={setActiveStudyId} onCreateFolder={createFolder} onRenameFolder={renameFolder} onCreateStudy={createStudy} onDeleteStudy={deleteStudy} onDeleteFolder={deleteFolder} onMoveFolder={moveFolder} onMoveStudy={moveStudy} onOpenMethodology={() => setShowMethodologyModal(true)} onFolderExam={handleFolderExam} onGoToHome={handleGoToHome} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* HEADER ATUALIZADO: Sino agora aparece sempre */}
        <header className="flex justify-between items-center p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-600" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
            {activeStudy ? (
                <div className="flex flex-col">
                     {/* ... (Título do estudo existente) ... */}
                     <div className="flex items-center gap-2">
                         {isEditingTitle ? (
                             <input autoFocus value={editTitleInput} onChange={(e) => setEditTitleInput(e.target.value)} onBlur={handleSaveTitle} onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()} className="font-bold text-xl text-gray-900 border-b border-indigo-500 outline-none bg-transparent" />
                         ) : (
                             <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 group cursor-pointer" onClick={() => { setEditTitleInput(activeStudy.title); setIsEditingTitle(true); }}>
                                {activeStudy.title}
                                <Edit className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                             </h1>
                         )}
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${activeStudy.isBook ? 'bg-orange-50 text-orange-600 border-orange-100' : activeStudy.mode === StudyMode.PARETO ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                             {activeStudy.isBook ? 'MODO LIVRO' : activeStudy.mode}
                         </span>
                     </div>
                     <p className="text-xs text-gray-500">Atualizado em {new Date(activeStudy.updatedAt).toLocaleDateString()}</p>
                </div>
            ) : ( <h1 className="text-xl font-bold text-gray-400 flex items-center gap-2"><NeuroLogo size={24} className="grayscale opacity-50"/> Criar Novo Estudo</h1> )}
          </div>
          
          <div className="flex items-center gap-3">
             {/* NOTIFICAÇÕES (MOVIDO PARA FORA DO IF activeStudy) */}
             <div className="relative">
                <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" onClick={() => setShowNotifications(!showNotifications)}>
                    <Bell className="w-5 h-5"/>
                    {dueReviewsCount > 0 && (<span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}
                </button>
                {showNotifications && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                        <NotificationCenter 
                            studies={studies} 
                            onSelectStudy={setActiveStudyId} 
                            onClose={() => setShowNotifications(false)} 
                            onMarkDone={handleMarkReviewDone}
                            onSnooze={handleSnoozeReview}
                            onDeleteReview={handleDeleteReview}
                        />
                    </>
                )}
             </div>

             {activeStudy && (
                <button onClick={() => setShowReviewScheduler(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"><Calendar className="w-4 h-4"/> Agendar Revisão</button>
             )}
          </div>
        </header>

        {/* ... (Resto do conteúdo: div flex-1, switch activeStudy, PomodoroTimer, etc) ... */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 scroll-smooth">
            {/* ... Conteúdo existente ... */}
            {activeStudy ? (
                // ... lógica existente do estudo ...
                processingState.isLoading ? (
                    <div className="flex items-center justify-center h-full min-h-[500px]">
                        <ProcessingStatus step={processingState.step} size="large" />
                    </div>
                ) : (
                    // ... resto do código do estudo (activeStudy.isBook, Tabs, etc) ...
                    // (Mantenha o código existente aqui)
                    activeStudy.isBook && !activeStudy.guide ? (
                        // ... Configurar Resumo do Livro ...
                        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
                           {/* ... Copie o conteúdo existente do bloco isBook ... */}
                           <div className="text-center mb-8">
                               <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-orange-200">
                                   <BookOpen className="w-10 h-10"/>
                               </div>
                               <h2 className="text-3xl font-bold text-gray-900 mb-2">Configurar Resumo do Livro</h2>
                               <p className="text-gray-500 max-w-md mx-auto">Selecione o nível de profundidade que deseja para a análise desta obra.</p>
                           </div>
                           {/* ... Botões Survival, Normal, Hard ... */}
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full px-4">
                               <button onClick={() => updateStudyMode(activeStudy.id, StudyMode.SURVIVAL)} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${activeStudy.mode === StudyMode.SURVIVAL ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                                   <div className="flex items-center gap-3 mb-3">
                                       <div className="p-2 bg-white rounded-lg shadow-sm text-orange-500"><BatteryCharging className="w-6 h-6"/></div>
                                       <h3 className="font-bold text-gray-900">Sobrevivência</h3>
                                   </div>
                                   <p className="text-xs text-gray-600 leading-relaxed mb-2 font-semibold">Foco Absoluto (20/80)</p>
                                   <p className="text-xs text-gray-500 leading-relaxed">Analisa a obra inteira de uma vez para extrair apenas a tese central e os pilares globais.</p>
                               </button>
                               <button onClick={() => updateStudyMode(activeStudy.id, StudyMode.NORMAL)} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${activeStudy.mode === StudyMode.NORMAL ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                                   <div className="flex items-center gap-3 mb-3">
                                       <div className="p-2 bg-white rounded-lg shadow-sm text-orange-500"><Activity className="w-6 h-6"/></div>
                                       <h3 className="font-bold text-gray-900">Normal</h3>
                                   </div>
                                   <p className="text-xs text-gray-600 leading-relaxed mb-2 font-semibold">Capítulo a Capítulo</p>
                                   <p className="text-xs text-gray-500 leading-relaxed">Extrai os conceitos chave e a aplicação prática de cada parte.</p>
                               </button>
                               <button onClick={() => updateStudyMode(activeStudy.id, StudyMode.HARD)} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${activeStudy.mode === StudyMode.HARD ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                                   <div className="flex items-center gap-3 mb-3">
                                       <div className="p-2 bg-white rounded-lg shadow-sm text-orange-500"><Rocket className="w-6 h-6"/></div>
                                       <h3 className="font-bold text-gray-900">Hard</h3>
                                   </div>
                                   <p className="text-xs text-gray-600 leading-relaxed mb-2 font-semibold">Deep Dive</p>
                                   <p className="text-xs text-gray-500 leading-relaxed">Análise profunda e hierárquica.</p>
                               </button>
                           </div>
                           <button onClick={handleGenerateGuide} className="mt-8 bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-200 hover:bg-orange-600 hover:-translate-y-1 transition-all flex items-center gap-2">
                               <Play className="w-5 h-5 fill-current" />
                               Gerar Resumo do Livro
                           </button>
                       </div>
                    ) : (
                        // ... Resto das Tabs (Sources, Guide, Quiz, etc) ...
                        <div className="max-w-5xl mx-auto space-y-6">
                            {/* ... (Copiar estrutura de Tabs existente) ... */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                <button onClick={() => setActiveTab('sources')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'sources' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}><UploadCloud className="w-4 h-4"/> Fontes</button>
                                <button onClick={() => setActiveTab('guide')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'guide' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}><FileText className="w-4 h-4"/> Roteiro</button>
                                {!isParetoStudy && (
                                    <>
                                        <button onClick={() => setActiveTab('slides')} disabled={!activeStudy.slides} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'slides' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}><Monitor className="w-4 h-4"/> Slides</button>
                                        <button onClick={() => setActiveTab('quiz')} disabled={!activeStudy.quiz && !isGuideComplete} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}>{isGuideComplete || activeStudy.quiz ? <CheckCircle className="w-4 h-4"/> : <Lock className="w-4 h-4"/>} Quiz</button>
                                        <button onClick={() => setActiveTab('flashcards')} disabled={!activeStudy.flashcards && !isGuideComplete} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}>{isGuideComplete || activeStudy.flashcards ? <Layers className="w-4 h-4"/> : <Lock className="w-4 h-4"/>} Flashcards</button>
                                    </>
                                )}
                            </div>

                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                {activeTab === 'sources' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                            {/* ... Inputs de Fonte ... */}
                                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-indigo-500"/> Adicionar Conteúdo</h2>
                                            <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-1.5 rounded-xl w-full">
                                                <button onClick={() => setInputType(InputType.TEXT)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.TEXT ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Texto</button>
                                                <button onClick={() => setInputType(InputType.PDF)} className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.PDF ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>PDF / E-book</button>
                                                <button onClick={() => setInputType(InputType.VIDEO)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.VIDEO ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Vídeo</button>
                                                <button onClick={() => setInputType(InputType.IMAGE)} className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.IMAGE ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Img/Caderno</button>
                                                <button onClick={() => setInputType(InputType.URL)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.URL ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Link</button>
                                                <button onClick={() => setInputType(InputType.DOI)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.DOI ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>DOI/Artigo</button>
                                            </div>
                                            {/* ... Area de texto ou File Upload ... */}
                                            <div className="space-y-4">
                                                {inputType === InputType.TEXT || inputType === InputType.DOI || inputType === InputType.URL ? (
                                                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-sans text-sm" placeholder={inputType === InputType.URL ? "Cole o link aqui..." : inputType === InputType.DOI ? "Ex: 10.1038/s41586-020-2649-2" : "Cole suas anotações ou texto aqui..."} />
                                                ) : (
                                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept={inputType === InputType.PDF ? ".pdf,.epub,.mobi" : inputType === InputType.VIDEO ? "video/*,audio/*" : "image/*"} />
                                                        <div className="flex flex-col items-center gap-2 text-gray-500">
                                                            {selectedFile ? (<><FileText className="w-8 h-8 text-indigo-500"/><span className="font-medium text-gray-900">{selectedFile.name}</span><span className="text-xs">Clique para trocar</span></>) : (<><UploadCloud className="w-8 h-8"/><span className="font-medium">Clique ou arraste o arquivo aqui</span><span className="text-xs">Suporta {inputType === InputType.PDF ? 'PDF, EPUB, MOBI' : inputType === InputType.VIDEO ? 'Vídeo/Áudio' : 'Imagens (Cadernos/Lousas)'}</span></>)}
                                                        </div>
                                                    </div>
                                                )}
                                                <button onClick={addSourceToStudy} disabled={(!inputText && !selectedFile)} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed">Adicionar à Lista</button>
                                            </div>
                                        </div>

                                        {/* ... Lista de fontes e botão Gerar ... */}
                                        {activeStudy.sources.length > 0 && (
                                            <div className="space-y-4">
                                                {activeStudy.sources.map((source, idx) => (
                                                    <div key={source.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2 group hover:border-indigo-200 transition-colors">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">{idx + 1}</div>
                                                            <div className="flex-1 min-w-0">
                                                                {editingSourceId === source.id ? (
                                                                    <div className="flex items-center gap-2"><input autoFocus value={editSourceName} onChange={(e) => setEditSourceName(e.target.value)} onBlur={handleSaveSourceRename} onKeyDown={(e) => e.key === 'Enter' && handleSaveSourceRename()} className="w-full text-sm font-bold text-gray-800 border-b border-indigo-500 outline-none bg-transparent" /></div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2"><h3 className="font-bold text-gray-800 truncate cursor-pointer hover:text-indigo-600 transition-colors" title="Clique para visualizar" onClick={() => setPreviewSource(source)}>{source.name}</h3><button onClick={() => handleStartRenamingSource(source)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-opacity" title="Renomear Fonte"><Edit className="w-3 h-3"/></button></div>
                                                                )}
                                                                <div className="flex items-center gap-2 mt-1"><span className="text-xs text-gray-500 uppercase tracking-wider font-bold">{source.type} • {new Date(source.dateAdded).toLocaleTimeString()}</span><button onClick={() => setPreviewSource(source)} className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors"><Eye className="w-3 h-3"/> Visualizar</button></div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => removeSource(source.id)} className="text-gray-400 hover:text-red-500 p-2 ml-2"><Trash className="w-5 h-5"/></button>
                                                    </div>
                                                ))}

                                                {!activeStudy.isBook && (
                                                    <div className="flex flex-col gap-4 justify-end pt-4 border-t border-gray-100 mt-4">
                                                        <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
                                                            <Settings className="w-4 h-4 text-gray-400"/>
                                                            <span className="font-bold">Modo:</span>
                                                            <select value={activeStudy.mode} onChange={(e) => updateStudyMode(activeStudy.id, e.target.value as StudyMode)} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                                                                <option value={StudyMode.SURVIVAL}>Sobrevivência</option>
                                                                <option value={StudyMode.NORMAL}>Normal</option>
                                                                <option value={StudyMode.HARD}>Hard</option>
                                                                <option value={StudyMode.PARETO}>Pareto 80/20</option>
                                                            </select>
                                                        </div>

                                                        <button onClick={handleGenerateGuide} className="group relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-indigo-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 overflow-hidden w-full">
                                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                                            <GenerateIcon className="w-8 h-8 animate-pulse"/>
                                                            <span className="relative">Gerar Roteiro NeuroStudy</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'guide' && !processingState.isLoading && activeStudy.guide && (<ResultsView guide={activeStudy.guide} onReset={() => setActiveTab('sources')} onGenerateQuiz={() => setActiveTab('quiz')} onGoToFlashcards={() => setActiveTab('flashcards')} onUpdateGuide={(g) => updateStudyGuide(activeStudy.id, g)} isParetoOnly={activeStudy.mode === StudyMode.PARETO} />)}
                                {activeTab === 'slides' && !processingState.isLoading && (<div className="space-y-6">{activeStudy.slides ? (<SlidesView slides={activeStudy.slides} />) : (<div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"><Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4"/><h3 className="text-xl font-bold text-gray-700 mb-2">Slides de Aula</h3><p className="text-gray-500 mb-6 max-w-md mx-auto">Transforme o roteiro em uma apresentação estruturada.</p><button onClick={handleGenerateSlides} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Slides com IA</button></div>)}</div>)}
                                {activeTab === 'quiz' && !processingState.isLoading && (<div className="space-y-6">{activeStudy.quiz ? (<QuizView questions={activeStudy.quiz} onGenerate={handleGenerateQuiz} onClear={handleClearQuiz}/>) : (<div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"><CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4"/><h3 className="text-xl font-bold text-gray-700 mb-2">Quiz de Recuperação Ativa</h3><p className="text-gray-500 mb-6 max-w-md mx-auto">Teste seu conhecimento para fortalecer as conexões neurais.</p>{isGuideComplete ? (<button onClick={() => handleGenerateQuiz()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Quiz</button>) : (<div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200"><Lock className="w-4 h-4"/> Complete todos os checkpoints para liberar</div>)}</div>)}</div>)}
                                {activeTab === 'flashcards' && !processingState.isLoading && (<div className="space-y-6">{activeStudy.flashcards ? (<FlashcardsView cards={activeStudy.flashcards} onGenerate={handleGenerateFlashcards}/>) : (<div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"><Layers className="w-16 h-16 text-gray-300 mx-auto mb-4"/><h3 className="text-xl font-bold text-gray-700 mb-2">Flashcards</h3><p className="text-gray-500 mb-6 max-w-md mx-auto">Pratique a recuperação ativa com cartões.</p>{isGuideComplete ? (<button onClick={handleGenerateFlashcards} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Flashcards</button>) : (<div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200"><Lock className="w-4 h-4"/> Complete todos os checkpoints para liberar</div>)}</div>)}</div>)}
                            </div>
                        </div>
                    )
                )
            ) : (
             <div className="flex flex-col h-full bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-4">
                 <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
                    <div className="text-center pt-8">
                        <NeuroLogo size={60} className="mx-auto mb-4 text-indigo-600" />
                        <h2 className="text-3xl font-bold text-gray-900">Novo Estudo</h2>
                        <p className="text-gray-500">Escolha o nível de profundidade e sua fonte para começar.</p>
                    </div>
                    {/* Botões da tela inicial (Sobrevivência, Normal, Hard) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={() => setSelectedMode(StudyMode.SURVIVAL)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.SURVIVAL ? 'border-green-500 bg-green-50 shadow-md ring-1 ring-green-200' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}><div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center text-green-600"><BatteryCharging className="w-6 h-6"/></div><div><span className="block font-bold text-gray-900">Sobrevivência</span><span className="text-xs text-gray-500">Apenas o essencial. Rápido e direto.</span></div></button>
                        <button onClick={() => setSelectedMode(StudyMode.NORMAL)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.NORMAL ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'}`}><div className="bg-indigo-100 w-10 h-10 rounded-lg flex items-center justify-center text-indigo-600"><Activity className="w-6 h-6"/></div><div><span className="block font-bold text-gray-900">Normal</span><span className="text-xs text-gray-500">Equilíbrio ideal entre teoria e prática.</span></div></button>
                        <button onClick={() => setSelectedMode(StudyMode.HARD)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.HARD ? 'border-purple-500 bg-purple-50 shadow-md ring-1 ring-purple-200' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'}`}><div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center text-purple-600"><Rocket className="w-6 h-6"/></div><div><span className="block font-bold text-gray-900">Hard</span><span className="text-xs text-gray-500">Profundidade máxima e detalhes.</span></div></button>
                    </div>
                    <div className="pt-8">
                        <button onClick={handleStartSession} className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2">Escolher fontes</button>
                        <p className="text-center text-gray-400 text-xs mt-3">Você poderá adicionar PDFs, Vídeos e Textos na próxima etapa.</p>
                    </div>
                 </div>
             </div>
          )}
        </div>

        <PomodoroTimer />
        <ChatWidget studyGuide={activeStudy?.guide || null} />
        {showMethodologyModal && <MethodologyModal onClose={() => setShowMethodologyModal(false)} />}
        {previewSource && <SourcePreviewModal source={previewSource} onClose={() => setPreviewSource(null)} />}
      </div>
    </div>
  );
}
