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
import { NeuroLogo, Brain, UploadCloud, FileText, Video, Search, BookOpen, Monitor, HelpCircle, Plus, Trash, Zap, Link, Rocket, BatteryCharging, Activity, GraduationCap, Globe, Edit, CheckCircle, Layers, Camera, Target, ChevronRight, Menu, Lock, Bell, Calendar, GenerateIcon, Eye, Settings } from './components/Icons';

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

  // CORREÇÃO: Começa na Landing Page para obrigar a escolha do método
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

  // Mode Selection Global
  const [selectedMode, setSelectedMode] = useState<StudyMode>(StudyMode.NORMAL);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editSourceName, setEditSourceName] = useState('');
  const [previewSource, setPreviewSource] = useState<StudySource | null>(null);
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [showReviewScheduler, setShowReviewScheduler] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [processingState, setProcessingState] = useState<ProcessingState>({
    isLoading: false,
    error: null,
    step: 'idle'
  });

  const paretoInputRef = useRef<HTMLInputElement>(null);

  const activeStudy = studies.find(s => s.id === activeStudyId) || null;
  const isParetoStudy = activeStudy?.mode === StudyMode.PARETO;
  
  const totalCheckpoints = activeStudy?.guide?.checkpoints?.length || 0;
  const completedCheckpoints = activeStudy?.guide?.checkpoints?.filter(c => c.completed).length || 0;
  const isGuideComplete = totalCheckpoints > 0 && totalCheckpoints === completedCheckpoints;
  const dueReviewsCount = studies.filter(s => s.nextReviewDate && s.nextReviewDate <= Date.now()).length;

  useEffect(() => {
      setIsEditingTitle(false);
      setEditTitleInput('');
      setIsMobileMenuOpen(false);
      setEditingSourceId(null);
  }, [activeStudyId]);

  // --- ACTIONS ---

  const handleGoToHome = () => {
    setIsMobileMenuOpen(false);
    setActiveStudyId(null);
    setView('landing'); 
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
        if (current.id === folderId) { return; }
        current = folders.find(f => f.id === current.parentId);
    }
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: targetParentId } : f));
  };

  const moveStudy = (studyId: string, targetFolderId: string) => {
    setStudies(prev => prev.map(s => s.id === studyId ? { ...s, folderId: targetFolderId } : s));
  };

  const createStudy = (folderId: string, title: string, mode: StudyMode = selectedMode) => {
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
    setActiveTab('sources');
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
      else if (inputType === InputType.URL) name = `Link: ${inputText.slice(0, 30)}...`;
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

  const handleStartRenamingSource = (source: StudySource) => {
      setEditingSourceId(source.id);
      setEditSourceName(source.name);
  };

  const handleSaveSourceRename = () => {
      if (!activeStudyId || !editingSourceId) return;
      setStudies(prev => prev.map(s => {
          if (s.id === activeStudyId) {
              return { ...s, sources: s.sources.map(src => src.id === editingSourceId ? { ...src, name: editSourceName } : src) };
          }
          return s;
      }));
      setEditingSourceId(null);
      setEditSourceName('');
  };

  const handleQuickStart = async (content: string | File, type: InputType, mode: StudyMode = StudyMode.NORMAL, autoGenerate: boolean = false) => {
    let folderId = 'quick-studies';
    let quickFolder = folders.find(f => f.id === folderId);
    if (!quickFolder) {
        const newFolder = { id: folderId, name: '⚡ Estudos Rápidos' };
        setFolders(prev => [...prev, newFolder]);
    }

    const fileName = content instanceof File ? content.name : 'Novo Estudo';
    let title = mode === StudyMode.PARETO ? `Pareto 80/20: ${fileName}` : `Estudo: ${fileName}`;
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
      const megaOverview = `Exame unificado cobrindo ${folderStudies.length} estudos.`;
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
        setStudies(prev => prev.map(s => s.id === studyId ? { ...s, guide } : s));
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

  const handleStartSession = () => {
      const modeName = selectedMode === StudyMode.SURVIVAL ? 'Sobrevivência' : selectedMode === StudyMode.HARD ? 'Hard' : 'Normal';
      createStudy('default', `Novo Estudo (${modeName})`, selectedMode);
  };

  const renderSourceDescription = (type: InputType) => {
      switch(type) {
          case InputType.VIDEO: return <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs">ℹ️ O áudio do vídeo será transcrito e analisado.</span>;
          case InputType.PDF: return <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">ℹ️ Texto e imagens do PDF serão processados.</span>;
          case InputType.IMAGE: return <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs">ℹ️ Foto do Caderno? A IA lê sua letra manuscrita.</span>;
          case InputType.DOI: return <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">ℹ️ Busca automática pelo resumo do artigo científico.</span>;
          case InputType.URL: return <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">ℹ️ Conteúdo da página web será extraído.</span>;
          default: return null;
      }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
          <p className="text-gray-500 mb-6">Esta plataforma está em fase de testes fechados. Por favor, insira a senha de acesso.</p>
          <input type="password" placeholder="Senha de acesso" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-4" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} autoFocus />
          <button onClick={handleLogin} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Entrar</button>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-gray-200">
            <div className="flex items-center gap-2"><div className="flex items-center gap-2"><NeuroLogo size={40} className="text-indigo-600" /><span className="font-extrabold text-slate-900 tracking-tight text-xl">NeuroStudy</span></div></div>
            <button onClick={() => setView('app')} className="text-gray-500 hover:text-indigo-600 font-medium text-sm transition-colors">Entrar no Painel →</button>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-4">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest border border-indigo-100">Neurociência Aplicada</span>
                    <div className="flex justify-center mb-6"><div className="p-1 bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] shadow-xl border border-indigo-100"><NeuroLogo size={100} className="text-indigo-600" /></div></div>
                    <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">Pare de estudar.<br/><span className="text-indigo-600">Comece a aprender.</span></h2>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">Transforme PDFs, Vídeos e Anotações em guias de estudo ativo, slides e quizzes automaticamente.</p>
                </div>
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <button onClick={() => setView('app')} className="group relative flex flex-col items-start p-6 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-200 rounded-2xl transition-all w-full md:w-80 shadow-sm hover:shadow-xl hover:-translate-y-1">
                        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 mb-4 group-hover:scale-110 transition-transform"><Layers className="w-8 h-8" /></div>
                        <h3 className="text-lg font-bold text-gray-900">Método NeuroStudy</h3>
                        <p className="text-sm text-gray-500 mt-2 text-left flex-1">Acesso completo. Pastas, roteiros, flashcards e professor virtual.</p>
                        <span className="mt-4 w-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-indigo-700 transition-colors">Iniciar <ChevronRight className="w-4 h-4" /></span>
                    </button>
                    <div className="relative group w-full md:w-80">
                        <input type="file" ref={paretoInputRef} className="hidden" onChange={handleParetoUpload} accept=".pdf, video/*, audio/*, image/*"/>
                        <button onClick={() => { if (paretoInputRef.current) { paretoInputRef.current.click(); } }} className="relative flex flex-col items-start p-6 bg-white hover:bg-red-50 border-2 border-red-100 hover:border-red-200 rounded-2xl transition-all w-full shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                            <div className="bg-red-100 p-3 rounded-xl text-red-600 mb-4 group-hover:scale-110 transition-transform"><Target className="w-8 h-8" /></div>
                            <h3 className="text-lg font-bold text-gray-900">Método Pareto 80/20</h3>
                            <p className="text-sm text-gray-500 mt-2 text-left flex-1">Extração rápida. Apenas o essencial do arquivo. Sem pastas, sem login.</p>
                            <span className="mt-4 w-full bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-red-700 transition-colors">Iniciar <ChevronRight className="w-4 h-4" /></span>
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
        <footer className="py-6 text-center border-t border-gray-200 bg-white">
            <p className="text-sm text-gray-500 font-medium">Desenvolvido por <span className="text-gray-900 font-bold">Bruno Alexandre</span></p>
            <div className="mt-2"><span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">Versão Beta</span></div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white font-sans text-slate-800 overflow-hidden animate-in fade-in duration-500">
      {!isParetoStudy && (
        <>
            {isMobileMenuOpen && ( <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)} /> )}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
                <Sidebar folders={folders} studies={studies} activeStudyId={activeStudyId} selectedMode={selectedMode} onSelectMode={setSelectedMode} onSelectStudy={setActiveStudyId} onCreateFolder={createFolder} onRenameFolder={renameFolder} onCreateStudy={createStudy} onDeleteStudy={deleteStudy} onDeleteFolder={deleteFolder} onMoveFolder={moveFolder} onMoveStudy={moveStudy} onOpenMethodology={() => setShowMethodologyModal(true)} onFolderExam={handleFolderExam} onGoToHome={handleGoToHome} />
            </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="flex justify-between items-center p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-600" onClick={() => setIsMobileMenuOpen(true)}> <Menu className="w-6 h-6" /> </button>
            {activeStudy ? (
                <div className="flex flex-col">
                     <div className="flex items-center gap-2">
                         {isEditingTitle ? ( <input autoFocus value={editTitleInput} onChange={(e) => setEditTitleInput(e.target.value)} onBlur={handleSaveTitle} onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()} className="font-bold text-xl text-gray-900 border-b border-indigo-500 outline-none bg-transparent" /> ) : ( <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 group cursor-pointer" onClick={() => { setEditTitleInput(activeStudy.title); setIsEditingTitle(true); }}> {activeStudy.title} <Edit className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" /> </h1> )}
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${activeStudy.mode === StudyMode.PARETO ? 'bg-red-50 text-red-600 border-red-100' : activeStudy.mode === StudyMode.HARD ? 'bg-purple-50 text-purple-600 border-purple-100' : activeStudy.mode === StudyMode.SURVIVAL ? 'bg-green-50 text-green-600 border-green-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}> {activeStudy.mode === StudyMode.PARETO ? 'Pareto 80/20' : activeStudy.mode} </span>
                     </div>
                     <p className="text-xs text-gray-500">Atualizado em {new Date(activeStudy.updatedAt).toLocaleDateString()}</p>
                </div>
            ) : (
                <h1 className="text-xl font-bold text-gray-400 flex items-center gap-2"> <NeuroLogo size={24} className="grayscale opacity-50"/> Criar Novo Estudo </h1>
            )}
          </div>
          <div className="flex items-center gap-3">
             {activeStudy && ( <> <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" onClick={() => setShowNotifications(!showNotifications)} title="Notificações de Revisão"> <Bell className="w-5 h-5"/> {dueReviewsCount > 0 && ( <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span> )} </button> {showNotifications && ( <> <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div> <NotificationCenter studies={studies} onSelectStudy={setActiveStudyId} onClose={() => setShowNotifications(false)} /> </> )} <button onClick={() => setShowReviewScheduler(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"> <Calendar className="w-4 h-4"/> Agendar Revisão </button> </> )}
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 scroll-smooth">
          {activeStudy ? (
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    <button onClick={() => setActiveTab('sources')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'sources' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}> <UploadCloud className="w-4 h-4"/> Fontes </button>
                    <button onClick={() => setActiveTab('guide')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'guide' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}> <FileText className="w-4 h-4"/> Roteiro </button>
                    {!isParetoStudy && ( <> <button onClick={() => setActiveTab('slides')} disabled={!activeStudy.slides} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'slides' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}> <Monitor className="w-4 h-4"/> Slides </button> <button onClick={() => setActiveTab('quiz')} disabled={!activeStudy.quiz && !isGuideComplete} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}> {isGuideComplete || activeStudy.quiz ? <CheckCircle className="w-4 h-4"/> : <Lock className="w-4 h-4"/>} Quiz </button> <button onClick={() => setActiveTab('flashcards')} disabled={!activeStudy.flashcards && !isGuideComplete} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}> {isGuideComplete || activeStudy.flashcards ? <Layers className="w-4 h-4"/> : <Lock className="w-4 h-4"/>} Flashcards </button> </> )}
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {activeTab === 'sources' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-indigo-500"/> Adicionar Conteúdo</h2>
                                <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-1.5 rounded-xl w-full">
                                    <button onClick={() => setInputType(InputType.TEXT)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.TEXT ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Texto</button>
                                    <button onClick={() => setInputType(InputType.PDF)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.PDF ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>PDF</button>
                                    <button onClick={() => setInputType(InputType.VIDEO)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.VIDEO ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Vídeo</button>
                                    <button onClick={() => setInputType(InputType.IMAGE)} className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.IMAGE ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Img/Caderno</button>
                                    <button onClick={() => setInputType(InputType.URL)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.URL ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Link</button>
                                    <button onClick={() => setInputType(InputType.DOI)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.DOI ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>DOI/Artigo</button>
                                </div>
                                <div className="mb-4 animate-in fade-in duration-200">{renderSourceDescription(inputType)}</div>
                                <div className="space-y-4">
                                    {inputType === InputType.TEXT || inputType === InputType.DOI || inputType === InputType.URL ? ( <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-sans text-sm" placeholder={inputType === InputType.URL ? "Cole o link aqui..." : inputType === InputType.DOI ? "Ex: 10.1038/s41586-020-2649-2" : "Cole suas anotações ou texto aqui..."} /> ) : ( <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative"> <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept={inputType === InputType.PDF ? ".pdf" : inputType === InputType.VIDEO ? "video/*,audio/*" : "image/*"} /> <div className="flex flex-col items-center gap-2 text-gray-500"> {selectedFile ? ( <> <FileText className="w-8 h-8 text-indigo-500"/> <span className="font-medium text-gray-900">{selectedFile.name}</span> <span className="text-xs">Clique para trocar</span> </> ) : ( <> <UploadCloud className="w-8 h-8"/> <span className="font-medium">Clique ou arraste o arquivo aqui</span> <span className="text-xs">Suporta {inputType === InputType.PDF ? 'PDFs' : inputType === InputType.VIDEO ? 'Vídeo/Áudio' : 'Imagens (Cadernos/Lousas)'}</span> </> )} </div> </div> )}
                                    <button onClick={addSourceToStudy} disabled={(!inputText && !selectedFile)} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"> Adicionar à Lista </button>
                                </div>
                            </div>
                            {activeStudy.sources.length > 0 && (
                                <div className="space-y-4">
                                    {activeStudy.sources.map((source, idx) => ( <div key={source.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2 group hover:border-indigo-200 transition-colors"> <div className="flex items-center gap-4 flex-1"> <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0"> {idx + 1} </div> <div className="flex-1 min-w-0"> {editingSourceId === source.id ? ( <div className="flex items-center gap-2"> <input autoFocus value={editSourceName} onChange={(e) => setEditSourceName(e.target.value)} onBlur={handleSaveSourceRename} onKeyDown={(e) => e.key === 'Enter' && handleSaveSourceRename()} className="w-full text-sm font-bold text-gray-800 border-b border-indigo-500 outline-none bg-transparent" /> </div> ) : ( <div className="flex items-center gap-2"> <h3 className="font-bold text-gray-800 truncate cursor-pointer hover:text-indigo-600 transition-colors" title="Clique para visualizar" onClick={() => setPreviewSource(source)}>{source.name}</h3> <button onClick={() => handleStartRenamingSource(source)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-opacity" title="Renomear Fonte"> <Edit className="w-3 h-3"/> </button> </div> )} <div className="flex items-center gap-2 mt-1"> <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">{source.type} • {new Date(source.dateAdded).toLocaleTimeString()}</span> <button onClick={() => setPreviewSource(source)} className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors"> <Eye className="w-3 h-3"/> Visualizar </button> </div> </div> </div> <button onClick={() => removeSource(source.id)} className="text-gray-400 hover:text-red-500 p-2 ml-2"><Trash className="w-5 h-5"/></button> </div> ))}
                                    <div className="flex flex-col gap-4 justify-end pt-4 border-t border-gray-100 mt-4">
                                        <div className="flex items-center justify-end gap-2 text-sm text-gray-600"> <Settings className="w-4 h-4 text-gray-400"/> <span className="font-bold">Modo:</span> <select value={activeStudy.mode} onChange={(e) => updateStudyMode(activeStudy.id, e.target.value as StudyMode)} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"> <option value={StudyMode.SURVIVAL}>Sobrevivência</option> <option value={StudyMode.NORMAL}>Normal</option> <option value={StudyMode.HARD}>Hard</option> <option value={StudyMode.PARETO}>Pareto 80/20</option> </select> </div>
                                        <button onClick={handleGenerateGuide} className="group relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-indigo-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 overflow-hidden w-full"> <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div> <GenerateIcon className="w-8 h-8 animate-pulse"/> <span className="relative">Gerar Roteiro NeuroStudy</span> </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {processingState.isLoading && ( <div className="flex items-center justify-center h-96"> <ProcessingStatus step={processingState.step} /> </div> )}
                    {activeTab === 'guide' && !processingState.isLoading && activeStudy.guide && ( <ResultsView guide={activeStudy.guide} onReset={() => setActiveTab('sources')} onGenerateQuiz={() => setActiveTab('quiz')} onUpdateGuide={(g) => updateStudyGuide(activeStudy.id, g)} isParetoOnly={activeStudy.mode === StudyMode.PARETO} /> )}
                    {activeTab === 'slides' && !processingState.isLoading && ( <div className="space-y-6"> {activeStudy.slides ? ( <SlidesView slides={activeStudy.slides} /> ) : ( <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"> <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4"/> <h3 className="text-xl font-bold text-gray-700 mb-2">Slides de Aula</h3> <p className="text-gray-500 mb-6 max-w-md mx-auto">Transforme o roteiro em uma apresentação estruturada para ensinar o conteúdo (Técnica Feynman).</p> <button onClick={handleGenerateSlides} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Slides com IA</button> </div> )} </div> )}
                    {activeTab === 'quiz' && !processingState.isLoading && ( <div className="space-y-6"> {activeStudy.quiz ? ( <QuizView questions={activeStudy.quiz} onGenerate={handleGenerateQuiz} onClear={handleClearQuiz} /> ) : ( <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"> <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4"/> <h3 className="text-xl font-bold text-gray-700 mb-2">Quiz de Recuperação Ativa</h3> <p className="text-gray-500 mb-6 max-w-md mx-auto">Teste seu conhecimento para fortalecer as conexões neurais. Perguntas mistas de múltipla escolha e dissertativas.</p> {isGuideComplete ? ( <button onClick={() => handleGenerateQuiz()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Quiz</button> ) : ( <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200"> <Lock className="w-4 h-4"/> Complete todos os checkpoints para liberar </div> )} </div> )} </div> )}
                    {activeTab === 'flashcards' && !processingState.isLoading && ( <div className="space-y-6"> {activeStudy.flashcards ? ( <FlashcardsView cards={activeStudy.flashcards} onGenerate={handleGenerateFlashcards} /> ) : ( <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"> <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4"/> <h3 className="text-xl font-bold text-gray-700 mb-2">Flashcards</h3> <p className="text-gray-500 mb-6 max-w-md mx-auto">Pratique a recuperação ativa com cartões de memorização.</p> {isGuideComplete ? ( <button onClick={handleGenerateFlashcards} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Flashcards</button> ) : ( <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200"> <Lock className="w-4 h-4"/> Complete todos os checkpoints para liberar </div> )} </div> )} </div> )}
                </div>
            </div>
          ) : (
             <div className="flex flex-col h-full bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-4">
                 <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
                    {/* Header */}
                    <div className="text-center pt-8">
                        <NeuroLogo size={60} className="mx-auto mb-4 text-indigo-600" />
                        <h2 className="text-3xl font-bold text-gray-900">Novo Estudo</h2>
                        <p className="text-gray-500">Escolha o nível de profundidade e sua fonte para começar.</p>
                    </div>

                    {/* Mode Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={() => setSelectedMode(StudyMode.SURVIVAL)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.SURVIVAL ? 'border-green-500 bg-green-50 shadow-md ring-1 ring-green-200' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}>
                            <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center text-green-600"><BatteryCharging className="w-6 h-6"/></div>
                            <div><span className="block font-bold text-gray-900">Sobrevivência</span><span className="text-xs text-gray-500">Apenas o essencial. Rápido e direto.</span></div>
                        </button>
                        <button onClick={() => setSelectedMode(StudyMode.NORMAL)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.NORMAL ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                             <div className="bg-indigo-100 w-10 h-10 rounded-lg flex items-center justify-center text-indigo-600"><Activity className="w-6 h-6"/></div>
                             <div><span className="block font-bold text-gray-900">Normal</span><span className="text-xs text-gray-500">Equilíbrio ideal entre teoria e prática.</span></div>
                        </button>
                        <button onClick={() => setSelectedMode(StudyMode.HARD)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.HARD ? 'border-purple-500 bg-purple-50 shadow-md ring-1 ring-purple-200' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'}`}>
                             <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center text-purple-600"><Rocket className="w-6 h-6"/></div>
                             <div><span className="block font-bold text-gray-900">Hard</span><span className="text-xs text-gray-500">Profundidade máxima e detalhes.</span></div>
                        </button>
                    </div>

                    <div className="pt-8">
                        {/* CORREÇÃO 2: Botão "Escolher fontes" sem ícone */}
                        <button 
                            onClick={handleStartSession}
                            className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                            Escolher fontes
                        </button>
                        <p className="text-center text-gray-400 text-xs mt-3">Você poderá adicionar PDFs, Vídeos e Textos na próxima etapa.</p>
                    </div>
                 </div>
             </div>
          )}
        </div>

        {/* Floating Widgets */}
        <PomodoroTimer />
        <ChatWidget studyGuide={activeStudy?.guide || null} />
        {showMethodologyModal && <MethodologyModal onClose={() => setShowMethodologyModal(false)} />}
        {previewSource && <SourcePreviewModal source={previewSource} onClose={() => setPreviewSource(null)} />}
      </div>
    </div>
  );
}