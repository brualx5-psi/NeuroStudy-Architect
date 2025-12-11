
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
import { NeuroLogo, Brain, BrainCircuit, UploadCloud, FileText, Video, Search, BookOpen, Monitor, HelpCircle, Plus, Trash, Zap, Link, Rocket, BatteryCharging, Activity, GraduationCap, Globe, Edit, CheckCircle, Layers, Camera, Target, ChevronRight, Menu, Lock, Bell, Calendar, GenerateIcon } from './components/Icons';

export function App() {
  // --- STATE ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  useEffect(() => {
    const authorized = localStorage.getItem('neurostudy_auth');
    if (authorized === 'true') {
      setIsAuthorized(true);
    }
  }, []);

  const handleLogin = () => {
    if (passwordInput === 'neurostudy2025') {
      setIsAuthorized(true);
      localStorage.setItem('neurostudy_auth', 'true');
    } else {
      alert('Senha incorreta.');
    }
  };

  const [view, setView] = useState<'landing' | 'app'>('landing');

  // Folders & Studies (Mock Database)
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'default', name: 'Meus Estudos' },
    { id: 'biologia', name: 'Biologia' },
  ]);
  const [studies, setStudies] = useState<StudySession[]>([]);
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);

  // Active UI State
  const [activeTab, setActiveTab] = useState<'sources' | 'guide' | 'slides' | 'quiz' | 'flashcards'>('sources');
  const [inputText, setInputText] = useState('');
  const [inputType, setInputType] = useState<InputType>(InputType.TEXT);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Mode Selection
  const [selectedMode, setSelectedMode] = useState<StudyMode>(StudyMode.NORMAL);

  // Quick Start State
  const [quickInputMode, setQuickInputMode] = useState<'none' | 'text'>('none');

  // Renaming State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleInput, setEditTitleInput] = useState('');

  // Methodology Modal State
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);

  // Review Scheduler State
  const [showReviewScheduler, setShowReviewScheduler] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [processingState, setProcessingState] = useState<ProcessingState>({
    isLoading: false,
    error: null,
    step: 'idle'
  });

  // Refs for Pareto Upload
  const paretoInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const activeStudy = studies.find(s => s.id === activeStudyId) || null;
  const isParetoStudy = activeStudy?.mode === StudyMode.PARETO;
  
  // Calculate Completion Logic
  const totalCheckpoints = activeStudy?.guide?.checkpoints?.length || 0;
  const completedCheckpoints = activeStudy?.guide?.checkpoints?.filter(c => c.completed).length || 0;
  const isGuideComplete = totalCheckpoints > 0 && totalCheckpoints === completedCheckpoints;

  // Calculate Notifications
  const dueReviewsCount = studies.filter(s => s.nextReviewDate && s.nextReviewDate <= Date.now()).length;

  // Reset editing state when changing study
  useEffect(() => {
      setIsEditingTitle(false);
      setEditTitleInput('');
      setIsMobileMenuOpen(false); // Close menu on study select
  }, [activeStudyId]);

  // --- ACTIONS ---

  const handleGoToHome = () => {
    setView('landing');
    setIsMobileMenuOpen(false);
    setActiveStudyId(null); // CRITICAL: Clear active study to prevent stuck Pareto layout
  };

  const createFolder = (name: string, parentId?: string) => {
    const newFolder: Folder = { id: Date.now().toString(), name, parentId };
    setFolders([...folders, newFolder]);
    return newFolder.id;
  };

  const renameFolder = (id: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const deleteFolder = (id: string) => {
    if (id === 'default' || id === 'quick-studies') return;
    
    const idsToDelete = new Set<string>();
    const collectIds = (fid: string) => {
        idsToDelete.add(fid);
        folders.filter(f => f.parentId === fid).forEach(child => collectIds(child.id));
    };
    collectIds(id);

    setFolders(folders.filter(f => !idsToDelete.has(f.id)));
    setStudies(studies.filter(s => !idsToDelete.has(s.folderId)));
    
    if (activeStudy?.folderId && idsToDelete.has(activeStudy.folderId)) setActiveStudyId(null);
  };

  const moveFolder = (folderId: string, targetParentId: string | undefined) => {
    if (folderId === targetParentId) return;
    let current = folders.find(f => f.id === targetParentId);
    while (current) {
        if (current.id === folderId) {
            console.warn("Cannot move folder into its own child");
            return;
        }
        current = folders.find(f => f.id === current.parentId);
    }
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: targetParentId } : f));
  };

  const moveStudy = (studyId: string, targetFolderId: string) => {
    setStudies(prev => prev.map(s => s.id === studyId ? { ...s, folderId: targetFolderId } : s));
  };

  const createStudy = (folderId: string, title: string, mode: StudyMode = StudyMode.NORMAL) => {
    const newStudy: StudySession = {
      id: Date.now().toString(),
      folderId,
      title,
      sources: [],
      mode,
      guide: null,
      slides: null,
      quiz: null,
      flashcards: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setStudies(prev => [...prev, newStudy]);
    setActiveStudyId(newStudy.id);
    
    setActiveTab(mode === StudyMode.PARETO ? 'guide' : 'sources');
    
    setSelectedMode(mode);
    return newStudy;
  };

  const deleteStudy = (id: string) => {
    setStudies(studies.filter(s => s.id !== id));
    if (activeStudyId === id) setActiveStudyId(null);
  };

  const updateStudyGuide = (studyId: string, newGuide: StudyGuide) => {
    setStudies(prev => prev.map(s => s.id === studyId ? { ...s, guide: newGuide } : s));
  };

  const updateStudyMode = (studyId: string, mode: StudyMode) => {
      setStudies(prev => prev.map(s => s.id === studyId ? { ...s, mode: mode } : s));
  };

  const handleSaveTitle = () => {
    if (activeStudyId && editTitleInput.trim()) {
        setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, title: editTitleInput } : s));
    }
    setIsEditingTitle(false);
  };

  const handleScheduleReview = (timestamp: number) => {
      if (activeStudyId) {
          setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, nextReviewDate: timestamp } : s));
          setShowReviewScheduler(false);
          alert(`Revisão agendada para ${new Date(timestamp).toLocaleDateString('pt-BR')}!`);
      }
  };

  const addSourceToStudy = async () => {
    if (!activeStudyId) return;

    let content = '';
    let mimeType = '';
    let name = '';

    if (inputType === InputType.TEXT || inputType === InputType.DOI || inputType === InputType.URL) {
      if (!inputText.trim()) return;
      content = inputText;
      mimeType = 'text/plain';
      if (inputType === InputType.DOI) name = `DOI: ${inputText.slice(0, 20)}...`;
      else if (inputType === InputType.URL) name = `Site: ${inputText.slice(0, 30)}...`;
      else name = `Nota de Texto ${new Date().toLocaleTimeString()}`;
    } else {
      if (!selectedFile) return;
      content = await fileToBase64(selectedFile);
      mimeType = selectedFile.type;
      name = selectedFile.name;
    }

    const newSource: StudySource = {
      id: Date.now().toString(),
      type: inputType,
      name,
      content,
      mimeType,
      dateAdded: Date.now()
    };

    setStudies(prev => prev.map(s => {
      if (s.id === activeStudyId) {
        return { ...s, sources: [...s.sources, newSource] };
      }
      return s;
    }));

    setInputText('');
    setSelectedFile(null);
  };

  const removeSource = (sourceId: string) => {
    if (!activeStudyId) return;
    setStudies(prev => prev.map(s => {
      if (s.id === activeStudyId) {
        return { ...s, sources: s.sources.filter(src => src.id !== sourceId) };
      }
      return s;
    }));
  };

  const handleQuickStart = async (content: string | File, type: InputType, mode: StudyMode = StudyMode.NORMAL, autoGenerate: boolean = false) => {
    let folderId = 'quick-studies';
    let quickFolder = folders.find(f => f.id === folderId);
    
    if (!quickFolder) {
        const newFolder = { id: folderId, name: '⚡ Estudos Rápidos' };
        setFolders(prev => [...prev, newFolder]);
    }

    const fileName = content instanceof File ? content.name : 'Novo Estudo';
    let title = '';
    if (mode === StudyMode.PARETO) {
        title = `Pareto 80/20: ${fileName}`;
    } else {
        const modeName = mode === StudyMode.SURVIVAL ? 'Sobrevivência' : mode === StudyMode.HARD ? 'Hard' : 'Rápido';
        title = `Estudo ${modeName}: ${fileName}`;
    }
    const newStudy = createStudy(folderId, title, mode);

    let sourceContent = '';
    let mimeType = '';
    let name = '';

    if (content instanceof File) {
      sourceContent = await fileToBase64(content);
      mimeType = content.type;
      name = content.name;
    } else {
      sourceContent = content;
      mimeType = 'text/plain';
      if (type === InputType.DOI) name = 'DOI Link';
      else if (type === InputType.URL) name = 'Website Link';
      else name = 'Texto Colado';
    }

    const newSource: StudySource = {
      id: Date.now().toString(),
      type: type,
      name,
      content: sourceContent,
      mimeType,
      dateAdded: Date.now()
    };

    setStudies(prev => prev.map(s => {
      if (s.id === newStudy.id) {
        return { ...s, sources: [newSource] };
      }
      return s;
    }));

    setQuickInputMode('none');
    setInputText('');
    setView('app');

    if (autoGenerate) {
       setTimeout(() => handleGenerateGuideForStudy(newStudy.id, newSource, mode), 100);
    }
  };

  const handleParetoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          let type = InputType.TEXT;
          if (file.type.includes('pdf')) type = InputType.PDF;
          else if (file.type.includes('video') || file.type.includes('audio')) type = InputType.VIDEO;
          else if (file.type.includes('image')) type = InputType.IMAGE;
          
          handleQuickStart(file, type, StudyMode.PARETO, true); 
      }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFolderExam = (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      const folderStudies = studies.filter(s => s.folderId === folderId && s.guide !== null);

      if (folderStudies.length === 0) {
          alert("Esta pasta não tem estudos com roteiros gerados para criar um provão.");
          return;
      }

      const megaSubject = `Provão: ${folder.name}`;
      const megaOverview = `Exame unificado cobrindo ${folderStudies.length} estudos: ${folderStudies.map(s => s.title).join(', ')}.`;
      
      const allConcepts = folderStudies.flatMap(s => s.guide!.coreConcepts);
      const allCheckpoints = folderStudies.flatMap(s => s.guide!.checkpoints.map(cp => ({ ...cp, noteExactly: cp.noteExactly.substring(0, 200) }))); 

      const megaGuide: StudyGuide = {
          subject: megaSubject,
          overview: megaOverview,
          coreConcepts: allConcepts,
          checkpoints: allCheckpoints
      };

      const examStudy = createStudy(folderId, megaSubject, StudyMode.NORMAL);
      
      setStudies(prev => prev.map(s => s.id === examStudy.id ? { ...s, guide: megaGuide } : s));
      setActiveTab('quiz');
  };

  const handleGenerateGuideForStudy = async (studyId: string, source: StudySource, mode: StudyMode) => {
    const isBinary = source.type === InputType.PDF || source.type === InputType.VIDEO || source.type === InputType.IMAGE;
    const isVideo = source.type === InputType.VIDEO;

    setProcessingState({ isLoading: true, error: null, step: isVideo ? 'transcribing' : 'analyzing' });

    try {
        const progressTimer = setTimeout(() => {
            setProcessingState(prev => ({ ...prev, step: 'generating' }));
        }, 3500);
        
        const guide = await generateStudyGuide(source.content, source.mimeType || 'text/plain', mode, isBinary);
        
        clearTimeout(progressTimer);

        setStudies(prev => prev.map(s => 
            s.id === studyId ? { ...s, guide } : s
        ));
        
        setProcessingState({ isLoading: false, error: null, step: 'idle' });
        setActiveTab('guide');
    } catch (err: any) {
        setProcessingState({ isLoading: false, error: err.message, step: 'idle' });
    }
  };

  const handleGenerateGuide = async () => {
    if (!activeStudy || activeStudy.sources.length === 0) return;
    const source = activeStudy.sources[activeStudy.sources.length - 1]; 
    handleGenerateGuideForStudy(activeStudy.id, source, activeStudy.mode);
  };

  const handleGenerateSlides = async () => {
    if (!activeStudy?.guide) return;
    setProcessingState({ isLoading: true, error: null, step: 'slides' });
    try {
        const slides = await generateSlides(activeStudy.guide);
        setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, slides } : s));
    } catch (err: any) {
        setProcessingState(prev => ({ ...prev, error: err.message }));
    } finally {
        setProcessingState(prev => ({ ...prev, isLoading: false, step: 'idle' }));
    }
  };

  const handleGenerateQuiz = async (config?: {quantity: number, difficulty: 'easy' | 'medium' | 'hard' | 'mixed'}) => {
    if (!activeStudy?.guide) return;
    setProcessingState({ isLoading: true, error: null, step: 'quiz' });
    try {
        const quiz = await generateQuiz(activeStudy.guide, activeStudy.mode || StudyMode.NORMAL, config);
        setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, quiz } : s));
    } catch (err: any) {
        setProcessingState(prev => ({ ...prev, error: err.message }));
    } finally {
        setProcessingState(prev => ({ ...prev, isLoading: false, step: 'idle' }));
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!activeStudy?.guide) return;
    setProcessingState({ isLoading: true, error: null, step: 'flashcards' });
    try {
        const flashcards = await generateFlashcards(activeStudy.guide);
        setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, flashcards } : s));
    } catch (err: any) {
        setProcessingState(prev => ({ ...prev, error: err.message }));
    } finally {
        setProcessingState(prev => ({ ...prev, isLoading: false, step: 'idle' }));
    }
  };

  const handleClearQuiz = () => {
    if (!activeStudyId) return;
    setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, quiz: null } : s));
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
          <p className="text-gray-500 mb-6">Esta plataforma está em fase de testes fechados. Por favor, insira a senha de acesso.</p>
          
          <input 
            type="password"
            placeholder="Senha de acesso"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-4"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          
          <button 
            onClick={handleLogin}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
                {/* LOGO NO HEADER DA LANDING PAGE */}
                <div className="flex items-center gap-2">
                    <NeuroLogo size={40} className="text-indigo-600" />
                    <span className="font-extrabold text-slate-900 tracking-tight text-xl">NeuroStudy</span>
                </div>
            </div>
            <button onClick={() => setView('app')} className="text-gray-500 hover:text-indigo-600 font-medium text-sm transition-colors">Entrar no Painel →</button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-4">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest border border-indigo-100">Neurociência Aplicada</span>
                    
                    {/* HERO LOGO - CENTRALIZADO E GRANDE */}
                    <div className="flex justify-center mb-6">
                        <div className="p-1 bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] shadow-xl border border-indigo-100">
                            <NeuroLogo size={100} className="text-indigo-600" />
                        </div>
                    </div>
                    
                    <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">Pare de estudar.<br/><span className="text-indigo-600">Comece a aprender.</span></h2>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">Transforme PDFs, Vídeos e Anotações em guias de estudo ativo, slides e quizzes automaticamente.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    {/* BUTTON 1: FULL PLATFORM */}
                    <button
                        onClick={() => setView('app')}
                        className="group relative flex flex-col items-start p-6 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-200 rounded-2xl transition-all w-full md:w-80 shadow-sm hover:shadow-xl hover:-translate-y-1"
                    >
                        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 mb-4 group-hover:scale-110 transition-transform"><Layers className="w-8 h-8" /></div>
                        <h3 className="text-lg font-bold text-gray-900">Método NeuroStudy</h3>
                        <p className="text-sm text-gray-500 mt-2 text-left flex-1">
                            Acesso completo. Pastas, roteiros, flashcards e professor virtual.
                        </p>
                        <span className="mt-4 w-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-indigo-700 transition-colors">
                            Iniciar <ChevronRight className="w-4 h-4" />
                        </span>
                    </button>

                    {/* BUTTON 2: PARETO FAST TRACK */}
                    <div className="relative group w-full md:w-80">
                        <input type="file" ref={paretoInputRef} className="hidden" onChange={handleParetoUpload} accept=".pdf, video/*, audio/*, image/*"/>
                        <button
                            onClick={() => {
                                if (paretoInputRef.current) {
                                    paretoInputRef.current.click();
                                }
                            }}
                            className="relative flex flex-col items-start p-6 bg-white hover:bg-red-50 border-2 border-red-100 hover:border-red-200 rounded-2xl transition-all w-full shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                        >
                             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                            <div className="bg-red-100 p-3 rounded-xl text-red-600 mb-4 group-hover:scale-110 transition-transform"><Target className="w-8 h-8" /></div>
                            <h3 className="text-lg font-bold text-gray-900">Método Pareto 80/20</h3>
                            <p className="text-sm text-gray-500 mt-2 text-left flex-1">
                                Extração rápida. Apenas o essencial do arquivo. Sem pastas, sem login.
                            </p>
                            <span className="mt-4 w-full bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-red-700 transition-colors">
                                Iniciar <ChevronRight className="w-4 h-4" />
                            </span>
                        </button>
                    </div>
                </div>

                <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition-all">
                    <div className="flex flex-col items-center gap-2"><BookOpen className="w-6 h-6 text-gray-400" /><span className="text-xs font-bold text-gray-400">PDFs e Livros</span></div>
                    <div className="flex flex-col items-center gap-2"><Video className="w-6 h-6 text-gray-400" /><span className="text-xs font-bold text-gray-400">Vídeo Aulas</span></div>
                    <div className="flex flex-col items-center gap-2"><Camera className="w-6 h-6 text-gray-400" /><span className="text-xs font-bold text-gray-400">Fotos de Caderno</span></div>
                    <div className="flex flex-col items-center gap-2"><Globe className="w-6 h-6 text-gray-400" /><span className="text-xs font-bold text-gray-400">Sites e Artigos</span></div>
                </div>
            </div>
        </main>
        
        {/* LANDING PAGE FOOTER */}
        <footer className="py-6 text-center border-t border-gray-200 bg-white">
            <p className="text-sm text-gray-500 font-medium">
                Desenvolvido por <span className="text-gray-900 font-bold">Bruno Alexandre</span>
            </p>
            <div className="mt-2">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">
                    Versão Beta
                </span>
            </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white font-sans text-slate-800 overflow-hidden animate-in fade-in duration-500">
      {!isParetoStudy && (
        <>
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                