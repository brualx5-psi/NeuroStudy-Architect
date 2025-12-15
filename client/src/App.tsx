import React, { useState, useEffect, useRef } from 'react';
import { storage } from './services/storage';
import { InputType, StudySession, Folder, StudyMode, ProcessingState, StudySource, StudyGuide } from './types';
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
import { NeuroLogo, UploadCloud, FileText, Video, Search, BookOpen, Monitor, CheckCircle, Layers, Target, Menu, Lock, Bell, Calendar, GenerateIcon, Eye, Edit, Trash, BatteryCharging, Activity, Rocket, X } from './components/Icons';

export function App() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // DADOS
  const [folders, setFolders] = useState<Folder[]>([]);
  const [studies, setStudies] = useState<StudySession[]>([]);
  
  // Interface
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sources' | 'guide' | 'slides' | 'quiz' | 'flashcards'>('sources');
  const [processingState, setProcessingState] = useState<ProcessingState>({ isLoading: false, error: null, step: 'idle' });
  
  // Inputs
  const [inputText, setInputText] = useState('');
  const [inputType, setInputType] = useState<InputType>(InputType.TEXT);
  const [selectedMode, setSelectedMode] = useState<StudyMode>(StudyMode.NORMAL);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [quickInputMode, setQuickInputMode] = useState<'none' | 'text'>('none');
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editSourceName, setEditSourceName] = useState('');
  const [previewSource, setPreviewSource] = useState<StudySource | null>(null);
  
  // Modais
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [showReviewScheduler, setShowReviewScheduler] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const paretoInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIN & CARREGAMENTO ---
  useEffect(() => {
    const auth = localStorage.getItem('neurostudy_auth');
    if (auth === 'true') {
      setIsAuthorized(true);
    }
  }, []);

  // Carrega dados
  useEffect(() => {
    if (isAuthorized) {
        const initData = async () => {
          const { studies: s, folders: f } = await storage.loadData();
          setStudies(s || []);
          setFolders(f || []);
        };
        initData();
    }
  }, [isAuthorized]);

  // Salva dados
  useEffect(() => {
    if (studies.length > 0 || folders.length > 0) {
      storage.saveData(studies, folders);
    }
  }, [studies, folders]);

  const handleLogin = () => {
    if (passwordInput === 'neurostudy2025') {
      localStorage.setItem('neurostudy_auth', 'true');
      setIsAuthorized(true);
    } else if (passwordInput === 'convidado') {
      localStorage.removeItem('neurostudy_auth');
      setIsAuthorized(true);
    } else {
      alert('Senha incorreta.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('neurostudy_auth');
    setIsAuthorized(false);
    setView('landing');
  };

  // --- CRUD ---
  const createFolder = (name: string, parentId?: string) => { 
      const newFolder: Folder = { id: Date.now().toString(), name, parentId }; 
      setFolders(prev => [...prev, newFolder]); 
      return newFolder.id; 
  };
  
  const createStudy = (folderId: string, title: string, mode: StudyMode = selectedMode, isBook: boolean = false) => {
    const newStudy: StudySession = {
      id: Date.now().toString(), folderId, title, sources: [], mode, isBook,
      guide: null, slides: null, quiz: null, flashcards: null, createdAt: Date.now(), updatedAt: Date.now()
    };
    setStudies(prev => [newStudy, ...prev]);
    setActiveStudyId(newStudy.id);
    setActiveTab('sources');
    return newStudy;
  };

  const updateStudy = (id: string, updates: Partial<StudySession>) => {
      setStudies(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s));
  };

  // --- FUNÇÃO DE AGENDAMENTO (NOVA) ---
  const handleScheduleReview = (date: number) => {
    if (activeStudyId) {
        updateStudy(activeStudyId, { nextReviewDate: date });
        setShowReviewScheduler(false);
        alert("Revisão agendada com sucesso!");
    }
  };

  const deleteStudy = (id: string) => { 
      setStudies(prev => prev.filter(s => s.id !== id)); 
      if (activeStudyId === id) setActiveStudyId(null); 
  };

  const deleteFolder = (id: string) => { 
      const idsToDelete = new Set<string>();
      const collectIds = (fid: string) => {
          idsToDelete.add(fid);
          folders.filter(f => f.parentId === fid).forEach(child => collectIds(child.id));
      };
      collectIds(id);
      setFolders(prev => prev.filter(f => !idsToDelete.has(f.id)));
      setStudies(prev => prev.filter(s => !idsToDelete.has(s.folderId)));
      if (activeStudy?.folderId && idsToDelete.has(activeStudy.folderId)) setActiveStudyId(null);
  };

  const renameFolder = (id: string, name: string) => setFolders(p => p.map(f => f.id === id ? {...f, name} : f));
  const moveFolder = (fid: string, pid?: string) => setFolders(p => p.map(f => f.id === fid ? {...f, parentId: pid} : f));
  const moveStudy = (sid: string, fid: string) => updateStudy(sid, { folderId: fid });
  const handleSaveTitle = () => { if (activeStudyId && editTitleInput.trim()) updateStudy(activeStudyId, { title: editTitleInput }); setIsEditingTitle(false); };
  
  const updateStudyGuide = (studyId: string, newGuide: StudyGuide) => { updateStudy(studyId, { guide: newGuide }); };
  const updateStudyMode = (studyId: string, mode: StudyMode) => { updateStudy(studyId, { mode }); };

  const activeStudy = studies.find(s => s.id === activeStudyId) || null;
  const isParetoStudy = activeStudy?.mode === StudyMode.PARETO;
  const isGuideComplete = (activeStudy?.guide?.checkpoints?.filter(c => c.completed).length || 0) === (activeStudy?.guide?.checkpoints?.length || 0) && (activeStudy?.guide?.checkpoints?.length || 0) > 0;
  const dueReviewsCount = studies.filter(s => s.nextReviewDate && s.nextReviewDate <= Date.now()).length;

  const fileToBase64 = (file: File): Promise<string> => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; }); };

  const handleQuickStart = async (content: string | File, type: InputType, mode: StudyMode = StudyMode.NORMAL, autoGenerate: boolean = false, isBook: boolean = false) => {
    let targetFolderId = isBook ? 'root-books' : mode === StudyMode.PARETO ? 'root-pareto' : 'root-neuro';
    const title = content instanceof File ? content.name : 'Novo Estudo';
    const study = createStudy(targetFolderId, isBook ? `Livro: ${title}` : title, mode, isBook);
    
    let sourceContent = content instanceof File ? await fileToBase64(content) : content;
    let name = content instanceof File ? content.name : 'Texto/Link';
    let mimeType = content instanceof File ? content.type : 'text/plain';

    const newSource: StudySource = { id: Date.now().toString(), type, name, content: sourceContent, mimeType, dateAdded: Date.now() };
    updateStudy(study.id, { sources: [newSource] });
    
    setView('app'); setInputText(''); setQuickInputMode('none');
    if (autoGenerate) setTimeout(() => handleGenerateGuideForStudy(study.id, newSource, mode, isBook), 100);
  };

  const handleGenerateGuideForStudy = async (studyId: string, source: StudySource, mode: StudyMode, isBook: boolean) => {
    setProcessingState({ isLoading: true, error: null, step: 'analyzing' });
    try {
        const guide = await generateStudyGuide(source.content, source.mimeType || 'text/plain', mode, [InputType.PDF, InputType.VIDEO, InputType.IMAGE].includes(source.type), isBook);
        updateStudy(studyId, { guide });
        setActiveTab('guide');
    } catch (e: any) { setProcessingState({ isLoading: false, error: e.message, step: 'idle' }); } finally { setProcessingState(p => ({...p, isLoading: false, step: 'idle'})); }
  };

  const addSourceToStudy = async () => {
      if(!activeStudyId) return;
      let content = inputText; let type = inputType; let name = "Texto"; let mime = "text/plain";
      if(selectedFile) { content = await fileToBase64(selectedFile); type = inputType; name = selectedFile.name; mime = selectedFile.type; }
      const newSource: StudySource = { id: Date.now().toString(), type, name, content, mimeType: mime, dateAdded: Date.now() };
      setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, sources: [...s.sources, newSource] } : s));
      setInputText(''); setSelectedFile(null);
  };

  const removeSource = (sid: string) => setStudies(p => p.map(s => s.id === activeStudyId ? {...s, sources: s.sources.filter(x => x.id !== sid)} : s));
  const handleStartRenamingSource = (source: StudySource) => { setEditingSourceId(source.id); setEditSourceName(source.name); };
  const handleSaveSourceRename = () => { if (!activeStudyId || !editingSourceId) return; setStudies(prev => prev.map(s => { if (s.id === activeStudyId) return { ...s, sources: s.sources.map(src => src.id === editingSourceId ? { ...src, name: editSourceName } : src) }; return s; })); setEditingSourceId(null); setEditSourceName(''); };
  
  const handleGenerateSlides = async () => { if(activeStudy?.guide) { setProcessingState({isLoading:true, error:null, step:'slides'}); const s = await generateSlides(activeStudy.guide); updateStudy(activeStudyId!, { slides: s }); setProcessingState(p=>({...p, isLoading:false})); }};
  const handleGenerateQuiz = async () => { if(activeStudy?.guide) { setProcessingState({isLoading:true, error:null, step:'quiz'}); const q = await generateQuiz(activeStudy.guide, activeStudy.mode); updateStudy(activeStudyId!, { quiz: q }); setProcessingState(p=>({...p, isLoading:false})); }};
  const handleGenerateFlashcards = async () => { if(activeStudy?.guide) { setProcessingState({isLoading:true, error:null, step:'flashcards'}); const f = await generateFlashcards(activeStudy.guide); updateStudy(activeStudyId!, { flashcards: f }); setProcessingState(p=>({...p, isLoading:false})); }};
  
  // Helpers
  const handleParetoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if(f) handleQuickStart(f, InputType.TEXT, StudyMode.PARETO, true, false); };
  const handleBookUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if(f) handleQuickStart(f, InputType.PDF, StudyMode.NORMAL, false, true); };
  const handleStartSession = () => { createStudy('root-neuro', `Novo Estudo`, selectedMode); };
  const handleFolderExam = (fid: string) => {}; 
  const renderSourceDescription = (t: InputType) => null;

  const renderMainContent = () => {
    if (!activeStudy) {
      return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
               <div className="text-center pt-8">
                   <NeuroLogo size={60} className="mx-auto mb-4 text-indigo-600" />
                   <h2 className="text-3xl font-bold text-gray-900">Novo Estudo</h2>
                   <p className="text-gray-500">Escolha o nível de profundidade e sua fonte para começar.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {/* Card Pareto */}
                   <div className="relative group">
                       <input type="file" ref={paretoInputRef} className="hidden" onChange={handleParetoUpload} accept=".pdf, video/*, audio/*, image/*, .epub, .mobi"/>
                       <button onClick={() => paretoInputRef.current?.click()} className="w-full p-6 bg-white border-2 border-red-100 hover:border-red-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group-hover:-translate-y-1">
                           <div className="bg-red-50 w-12 h-12 rounded-xl flex items-center justify-center text-red-600 mb-4"><Target className="w-6 h-6"/></div>
                           <h3 className="text-lg font-bold text-gray-900">Pareto 80/20</h3>
                           <p className="text-sm text-gray-500 mt-2">Resumo ultra-rápido. O essencial de PDFs ou Vídeos em segundos.</p>
                       </button>
                   </div>

                   {/* Card NeuroStudy (Padrão) */}
                   <button onClick={handleStartSession} className="w-full p-6 bg-white border-2 border-indigo-100 hover:border-indigo-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-left hover:-translate-y-1">
                       <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 mb-4"><Layers className="w-6 h-6"/></div>
                       <h3 className="text-lg font-bold text-gray-900">NeuroStudy</h3>
                       <p className="text-sm text-gray-500 mt-2">O método completo. Roteiro, Slides e Quiz para estudo profundo.</p>
                   </button>

                   {/* Card Livros */}
                   <div className="relative group">
                       <input type="file" ref={bookInputRef} className="hidden" onChange={handleBookUpload} accept=".pdf,.epub,.mobi"/>
                       <button onClick={() => bookInputRef.current?.click()} className="w-full p-6 bg-white border-2 border-orange-100 hover:border-orange-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group-hover:-translate-y-1">
                           <div className="bg-orange-50 w-12 h-12 rounded-xl flex items-center justify-center text-orange-600 mb-4"><BookOpen className="w-6 h-6"/></div>
                           <h3 className="text-lg font-bold text-gray-900">Livros</h3>
                           <p className="text-sm text-gray-500 mt-2">Análise de obras completas. Capítulos, conceitos e aplicação prática.</p>
                       </button>
                   </div>
               </div>
            </div>
        </div>
      );
    }

    if (processingState.isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <ProcessingStatus step={processingState.step} size="large" />
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button onClick={() => setActiveTab('sources')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'sources' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Fontes</button>
              <button onClick={() => setActiveTab('guide')} disabled={!activeStudy.guide} className="px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Roteiro</button>
              {!isParetoStudy && <button onClick={() => setActiveTab('quiz')} disabled={!activeStudy.quiz} className="px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">Quiz</button>}
          </div>

          {activeTab === 'sources' && (
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex gap-2 mb-4">
                          <button onClick={() => setInputType(InputType.TEXT)} className="px-3 py-1 bg-gray-100 rounded text-sm">Texto</button>
                          <button onClick={() => setInputType(InputType.PDF)} className="px-3 py-1 bg-gray-100 rounded text-sm">PDF</button>
                      </div>
                      {inputType === InputType.TEXT ? (
                          <textarea value={inputText} onChange={e => setInputText(e.target.value)} className="w-full h-32 border rounded p-2" placeholder="Cole seu texto..." />
                      ) : (
                          <input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                      )}
                      <button onClick={addSourceToStudy} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded font-bold">Adicionar</button>
                  </div>
                  
                  {activeStudy.sources.map(s => (
                      <div key={s.id} className="bg-white p-4 rounded border flex justify-between">
                          <span>{s.name}</span>
                          <button onClick={() => removeSource(s.id)}><Trash className="w-4 h-4 text-red-500"/></button>
                      </div>
                  ))}
                  
                  {!activeStudy.isBook && activeStudy.sources.length > 0 && (
                      <button onClick={() => handleGenerateGuideForStudy(activeStudy.id, activeStudy.sources[0], activeStudy.mode, false)} className="w-full bg-green-600 text-white py-3 rounded font-bold mt-4">Gerar Roteiro</button>
                  )}
              </div>
          )}

          {activeTab === 'guide' && activeStudy.guide && <ResultsView guide={activeStudy.guide} onReset={()=>{}} onGenerateQuiz={handleGenerateQuiz} onGoToFlashcards={handleGenerateFlashcards} />}
          {activeTab === 'quiz' && activeStudy.quiz && <QuizView questions={activeStudy.quiz} onGenerate={handleGenerateQuiz} onClear={() => updateStudy(activeStudyId!, { quiz: null })} />}
      </div>
    );
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <NeuroLogo size={60} className="mx-auto mb-6 text-indigo-600"/>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">NeuroStudy Architect</h1>
          <input type="password" placeholder="Senha de acesso" className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} autoFocus />
          <button onClick={handleLogin} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700">Entrar</button>
          <div className="mt-4 text-xs text-gray-400">Use 'convidado' para acesso Free</div>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <NeuroLogo size={100} className="mx-auto mb-6"/>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">Bem-vindo, {isPro ? 'Pro' : 'Convidado'}</h1>
                <button onClick={() => setView('app')} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">Ir para o Painel</button>
            </div>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-white font-sans text-slate-800 overflow-hidden">
      <Sidebar 
        folders={folders} studies={studies} activeStudyId={activeStudyId} 
        onSelectStudy={setActiveStudyId} onCreateFolder={createFolder} 
        onCreateStudy={(fid, t) => createStudy(fid, t)} 
        onDeleteStudy={deleteStudy} onDeleteFolder={deleteFolder}
        onRenameFolder={renameFolder} onMoveFolder={moveFolder} onMoveStudy={moveStudy}
        onOpenMethodology={() => setShowMethodologyModal(true)} onFolderExam={handleFolderExam} onGoToHome={() => setView('landing')}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="flex justify-between items-center p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm z-10">
           <div className="flex items-center gap-4">
               <button className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
               {activeStudy ? (
                   <h1 className="font-bold text-xl">{activeStudy.title}</h1>
               ) : ( 
                   <div className="flex items-center gap-3">
                       <h1 className="text-xl font-bold text-gray-400 flex items-center gap-2"><NeuroLogo size={24} className="grayscale opacity-50"/> Painel</h1>
                   </div>
               )}
           </div>
           <div className="flex items-center gap-3">
               {activeStudy && (
                   <>
                      <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" onClick={() => setShowNotifications(!showNotifications)}><Bell className="w-5 h-5"/>{dueReviewsCount > 0 && (<span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>)}</button>
                      {showNotifications && (<><div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div><NotificationCenter studies={studies} onSelectStudy={setActiveStudyId} onClose={() => setShowNotifications(false)} /></>)}
                      <button onClick={() => setShowReviewScheduler(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"><Calendar className="w-4 h-4"/> Agendar Revisão</button>
                   </>
               )}
               <button onClick={handleLogout} className="text-xs text-red-500 hover:underline">Sair</button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
          {renderMainContent()}
        </div>

        <PomodoroTimer />
        <ChatWidget studyGuide={activeStudy?.guide || null} />
        {showMethodologyModal && <MethodologyModal onClose={() => setShowMethodologyModal(false)} />}
        
        {/* COMPONENTE DE REVISÃO ADICIONADO AQUI */}
        {showReviewScheduler && activeStudy && (
            <ReviewSchedulerModal 
                onClose={() => setShowReviewScheduler(false)} 
                onSchedule={handleScheduleReview} 
                studyTitle={activeStudy.title} 
            />
        )}

        {previewSource && <SourcePreviewModal source={previewSource} onClose={() => setPreviewSource(null)} />}
      </div>
    </div>
  );
}
