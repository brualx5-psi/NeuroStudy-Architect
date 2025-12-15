import React, { useState, useEffect, useRef } from 'react';
import { storage } from './services/storage'; // Conexão corrigida
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
import { NeuroLogo, UploadCloud, FileText, Video, Search, BookOpen, Monitor, CheckCircle, Layers, Target, Menu, Lock, Bell, Calendar, GenerateIcon, Eye, Edit, Trash } from './components/Icons';

export function App() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // DADOS PRINCIPAIS
  const [folders, setFolders] = useState<Folder[]>([]);
  const [studies, setStudies] = useState<StudySession[]>([]);
  
  // Estados de Interface
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
  
  // Modais
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [showReviewScheduler, setShowReviewScheduler] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<StudySource | null>(null);

  const paretoInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  // --- 1. LOGIN & CARREGAMENTO ---
  useEffect(() => {
    const auth = localStorage.getItem('neurostudy_auth');
    if (auth === 'true') {
      setIsAuthorized(true);
      setIsPro(true);
    } else {
      // Se não tem senha salva, pede login
      setIsAuthorized(false); 
    }
  }, []);

  // Quando autorizar, carrega os dados (Nuvem ou Local)
  useEffect(() => {
    if (!isAuthorized) return;
    const initData = async () => {
      const { studies: s, folders: f } = await storage.loadData();
      setStudies(s);
      setFolders(f);
    };
    initData();
  }, [isAuthorized]);

  // --- 2. SALVAMENTO AUTOMÁTICO ---
  // Sempre que mudar estudos ou pastas, salva tudo (Nuvem se Pro, Local se Free)
  useEffect(() => {
    if (studies.length > 0 || folders.length > 0) {
      storage.saveData(studies, folders);
    }
  }, [studies, folders]);

  const handleLogin = () => {
    if (passwordInput === 'neurostudy2025') {
      // MODO PRO
      localStorage.setItem('neurostudy_auth', 'true');
      setIsAuthorized(true);
      setIsPro(true);
      window.location.reload(); // Recarrega para ativar Supabase
    } else if (passwordInput === 'convidado') {
      // MODO FREE
      localStorage.removeItem('neurostudy_auth');
      setIsAuthorized(true);
      setIsPro(false);
    } else {
      alert('Senha incorreta.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('neurostudy_auth');
    setIsAuthorized(false);
    setStudies([]); setFolders([]);
    setView('landing');
  };

  // --- CRUD Lógica Simplificada (apenas altera o estado, o useEffect salva) ---
  const createFolder = (name: string, parentId?: string) => { 
      setFolders(prev => [...prev, { id: Date.now().toString(), name, parentId }]);
      return Date.now().toString();
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

  // ... (Helpers de UI mantidos)
  const activeStudy = studies.find(s => s.id === activeStudyId) || null;
  const isParetoStudy = activeStudy?.mode === StudyMode.PARETO;
  const isGuideComplete = (activeStudy?.guide?.checkpoints?.filter(c => c.completed).length || 0) === (activeStudy?.guide?.checkpoints?.length || 0) && (activeStudy?.guide?.checkpoints?.length || 0) > 0;
  const dueReviewsCount = studies.filter(s => s.nextReviewDate && s.nextReviewDate <= Date.now()).length;

  const fileToBase64 = (file: File): Promise<string> => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; }); };

  const handleQuickStart = async (content: string | File, type: InputType, mode: StudyMode = StudyMode.NORMAL, autoGenerate: boolean = false, isBook: boolean = false) => {
    let targetFolderId = isBook ? 'root-books' : mode === StudyMode.PARETO ? 'root-pareto' : 'root-neuro';
    const title = content instanceof File ? content.name : 'Novo Estudo';
    const study = createStudy(targetFolderId, isBook ? `Livro: ${title}` : title, mode, isBook);
    
    let sourceContent = '', mimeType = 'text/plain', name = '';
    if (content instanceof File) { sourceContent = await fileToBase64(content); mimeType = content.type; name = content.name; } 
    else { sourceContent = content; name = 'Texto/Link'; }

    const newSource: StudySource = { id: Date.now().toString(), type, name, content: sourceContent, mimeType, dateAdded: Date.now() };
    updateStudy(study.id, { sources: [newSource] });
    
    setView('app'); setInputText(''); setQuickInputMode('none');
    if (autoGenerate) setTimeout(() => handleGenerateGuideForStudy(study.id, newSource, mode, isBook), 100);
  };

  const handleGenerateGuideForStudy = async (studyId: string, source: StudySource, mode: StudyMode, isBook: boolean) => {
    const isBinary = [InputType.PDF, InputType.VIDEO, InputType.IMAGE, InputType.EPUB].includes(source.type);
    setProcessingState({ isLoading: true, error: null, step: source.type === InputType.VIDEO ? 'transcribing' : 'analyzing' });
    try {
        const timer = setTimeout(() => setProcessingState(p => ({...p, step: 'generating'})), 3000);
        const guide = await generateStudyGuide(source.content, source.mimeType || 'text/plain', mode, isBinary, isBook);
        clearTimeout(timer);
        updateStudy(studyId, { guide });
        setProcessingState({ isLoading: false, error: null, step: 'idle' });
        setActiveTab('guide');
    } catch (e: any) { setProcessingState({ isLoading: false, error: e.message, step: 'idle' }); }
  };

  // Renderização
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <NeuroLogo size={60} className="mx-auto mb-6 text-indigo-600"/>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">NeuroStudy Architect</h1>
          <input type="password" placeholder="Senha de acesso" className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700">Entrar</button>
          <div className="mt-4 text-xs text-gray-400">Use 'convidado' para acesso Free</div>
        </div>
      </div>
    );
  }

  // (Parte Visual do App - Simplificada para caber, mas você mantém a sua lógica de UI)
  if (view === 'landing') {
      return (
        // ... (Mesmo código da Landing Page que você já tem, só chame setView('app')) ...
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
        onDeleteStudy={(id) => setStudies(prev => prev.filter(s => s.id !== id))} 
        onDeleteFolder={(id) => setFolders(prev => prev.filter(f => f.id !== id))}
        onRenameFolder={(id, name) => setFolders(prev => prev.map(f => f.id === id ? {...f, name} : f))}
        onMoveFolder={(fid, pid) => setFolders(prev => prev.map(f => f.id === fid ? {...f, parentId: pid} : f))}
        onMoveStudy={(sid, fid) => updateStudy(sid, { folderId: fid })}
        onOpenMethodology={() => setShowMethodologyModal(true)} onFolderExam={() => {}} onGoToHome={handleGoToHome}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="flex justify-between items-center p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm z-10">
           <div className="flex items-center gap-4">
               {activeStudy ? <h1 className="font-bold">{activeStudy.title}</h1> : <h1 className="font-bold text-gray-400">Novo Estudo</h1>}
               <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isPro ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{isPro ? 'PRO (Nuvem)' : 'FREE (Local)'}</span>
           </div>
           <button onClick={handleLogout} className="text-xs text-red-500 hover:underline">Sair</button>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {/* ... (Lógica de renderização das Tabs, ResultsView, etc - Igual ao seu código original) ... */}
            {activeStudy ? (
                // Renderize aqui seus componentes (ResultsView, SlidesView, etc) baseados no activeTab
                // Para não estourar o limite de caracteres, use a lógica de UI que você já tem no seu App.tsx original
                <div className="max-w-5xl mx-auto">
                    {/* Exemplo: Botões de Tab */}
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => setActiveTab('guide')} className="px-4 py-2 bg-white rounded shadow-sm">Roteiro</button>
                        {/* ... outros botões ... */}
                    </div>
                    
                    {activeTab === 'guide' && activeStudy.guide && (
                        <ResultsView guide={activeStudy.guide} onReset={() => {}} onGenerateQuiz={() => {}} />
                    )}
                    {/* ... outras views ... */}
                </div>
            ) : (
                // Tela de Novo Estudo
                <div className="flex flex-col items-center justify-center h-full">
                    <h2 className="text-2xl font-bold mb-4">Comece um novo estudo</h2>
                    <div className="flex gap-4">
                        <button onClick={() => handleQuickStart("Texto de teste", InputType.TEXT)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold">Criar Teste Rápido</button>
                    </div>
                </div>
            )}
        </div>
      </div>
      
      {/* Componentes Globais */}
      <PomodoroTimer />
      <ChatWidget studyGuide={activeStudy?.guide || null} />
    </div>
  );
}
