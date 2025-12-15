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
  const [isPro, setIsPro] = useState(false);
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

  // --- 1. LOGIN & CARREGAMENTO ---
  useEffect(() => {
    const auth = localStorage.getItem('neurostudy_auth');
    if (auth === 'true') {
      setIsAuthorized(true);
      setIsPro(true);
    } else {
      setIsAuthorized(false); 
    }
  }, []);

  // Carrega dados ao autorizar
  useEffect(() => {
    if (isAuthorized) {
        const initData = async () => {
          try {
            const { studies: s, folders: f } = await storage.loadData();
            setStudies(s || []);
            setFolders(f || []);
          } catch (e) {
            console.error("Erro ao carregar:", e);
            setStudies([]); setFolders([]);
          }
        };
        initData();
    }
  }, [isAuthorized]);

  // --- 2. SALVAMENTO AUTOMÁTICO ---
  useEffect(() => {
    if (studies.length > 0 || folders.length > 0) {
      storage.saveData(studies, folders);
    }
  }, [studies, folders]);

  const handleLogin = () => {
    if (passwordInput === 'neurostudy2025') {
      localStorage.setItem('neurostudy_auth', 'true');
      setIsAuthorized(true);
      setIsPro(true);
      window.location.reload(); 
    } else if (passwordInput === 'convidado') {
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

  // --- GERAR ROTEIRO (COM TRATAMENTO DE ERRO) ---
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
    } catch (e: any) { 
        console.error("Erro ao gerar roteiro:", e);
        setProcessingState({ isLoading: false, error: e.message || "Erro desconhecido.", step: 'idle' }); 
    }
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
  
  const handleGenerateSlides = async () => { if(activeStudy?.guide) { setProcessingState({isLoading:true, error:null, step:'slides'}); try { const s = await generateSlides(activeStudy.guide); updateStudy(activeStudyId!, { slides: s }); } catch(e:any){ setProcessingState(p=>({...p, error: e.message})); } finally { setProcessingState(p=>({...p, isLoading:false})); } }};
  const handleGenerateQuiz = async () => { if(activeStudy?.guide) { setProcessingState({isLoading:true, error:null, step:'quiz'}); try { const q = await generateQuiz(activeStudy.guide, activeStudy.mode); updateStudy(activeStudyId!, { quiz: q }); } catch(e:any){ setProcessingState(p=>({...p, error: e.message})); } finally { setProcessingState(p=>({...p, isLoading:false})); } }};
  const handleGenerateFlashcards = async () => { if(activeStudy?.guide) { setProcessingState({isLoading:true, error:null, step:'flashcards'}); try { const f = await generateFlashcards(activeStudy.guide); updateStudy(activeStudyId!, { flashcards: f }); } catch(e:any){ setProcessingState(p=>({...p, error: e.message})); } finally { setProcessingState(p=>({...p, isLoading:false})); } }};
  
  // Helpers
  const handleParetoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if(f) handleQuickStart(f, InputType.TEXT, StudyMode.PARETO, true, false); };
  const handleBookUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if(f) handleQuickStart(f, InputType.PDF, StudyMode.NORMAL, false, true); };
  const handleStartSession = () => { createStudy('root-neuro', `Novo Estudo`, selectedMode); };
  const handleFolderExam = (fid: string) => {}; 
  const renderSourceDescription = (t: InputType) => null;

  // --- RENDER CONTENT (VISUAL RESTAURADO) ---
  const renderMainContent = () => {
    // 1. TELA INICIAL (DASHBOARD) - COM BOTÕES BONITOS DE VOLTA
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

    // 2. LOADING
    if (processingState.isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <ProcessingStatus step={processingState.step} size="large" />
        </div>
      );
    }

    // 3. TELA DO ESTUDO ATIVO
    return (
      <div className="max-w-5xl mx-auto space-y-6">
          {/* ALERTA DE ERRO */}
          {processingState.error && (
              <div className="bg-red-50 text-red-60
