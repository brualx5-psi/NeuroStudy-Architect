
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
import { BrainCircuit, UploadCloud, FileText, Video, Search, BookOpen, Monitor, HelpCircle, Plus, Trash, Zap, Link, Rocket, BatteryCharging, Activity, GraduationCap, Globe, Edit, CheckCircle, Layers, Camera, Target, ChevronRight } from './components/Icons';

export function App() {
  // --- STATE ---
  const [view, setView] = useState<'landing' | 'app'>('landing'); // Controls Landing Page vs Main App

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

  const [processingState, setProcessingState] = useState<ProcessingState>({
    isLoading: false,
    error: null,
    step: 'idle'
  });

  // Refs for Pareto Upload
  const paretoInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const activeStudy = studies.find(s => s.id === activeStudyId) || null;

  // Reset editing state when changing study
  useEffect(() => {
      setIsEditingTitle(false);
      setEditTitleInput('');
  }, [activeStudyId]);

  // --- ACTIONS ---

  const createFolder = (name: string, parentId?: string) => {
    const newFolder: Folder = { id: Date.now().toString(), name, parentId };
    setFolders([...folders, newFolder]);
    return newFolder.id;
  };

  const renameFolder = (id: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const deleteFolder = (id: string) => {
    if (id === 'default' || id === 'quick-studies') return; // Protect default and quick folders
    
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

  // --- QUICK START LOGIC ---
  const handleQuickStart = async (content: string | File, type: InputType, mode: StudyMode = StudyMode.NORMAL) => {
    // 1. Ensure Quick Study folder exists
    let folderId = 'quick-studies';
    let quickFolder = folders.find(f => f.id === folderId);
    
    if (!quickFolder) {
        const newFolder = { id: folderId, name: '⚡ Estudos Rápidos' };
        setFolders(prev => [...prev, newFolder]);
    }

    // 2. Create Study
    const title = `Estudo ${mode === StudyMode.SURVIVAL ? 'Pareto 80/20' : 'Rápido'} - ${new Date().toLocaleTimeString()}`;
    const newStudy = createStudy(folderId, title, mode);

    // 3. Process Content
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

    // 4. Add Source
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
    
    // Automatically switch to app view if started from landing page
    setView('app');
  };

  const handleParetoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Use SURVIVAL mode which corresponds to Pareto 80/20 in the backend prompt
          let type = InputType.TEXT;
          if (file.type.includes('pdf')) type = InputType.PDF;
          else if (file.type.includes('video') || file.type.includes('audio')) type = InputType.VIDEO;
          else if (file.type.includes('image')) type = InputType.IMAGE;
          
          handleQuickStart(file, type, StudyMode.SURVIVAL);
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

  // --- FOLDER EXAM LOGIC ---
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

  // --- GENERATION HANDLERS ---

  const handleGenerateGuide = async () => {
    if (!activeStudy || activeStudy.sources.length === 0) return;
    
    const source = activeStudy.sources[activeStudy.sources.length - 1]; 
    const isBinary = source.type === InputType.PDF || source.type === InputType.VIDEO || source.type === InputType.IMAGE;
    const isVideo = source.type === InputType.VIDEO;
    
    setProcessingState({ 
        isLoading: true, 
        error: null, 
        step: isVideo ? 'transcribing' : 'analyzing' 
    });

    try {
      const progressTimer = setTimeout(() => {
          setProcessingState(prev => ({ ...prev, step: 'generating' }));
      }, 3500);
      
      const guide = await generateStudyGuide(source.content, source.mimeType || 'text/plain', activeStudy.mode, isBinary);
      
      clearTimeout(progressTimer);

      setStudies(prev => prev.map(s => 
        s.id === activeStudyId ? { ...s, guide } : s
      ));
      
      setProcessingState({ isLoading: false, error: null, step: 'idle' });
      setActiveTab('guide');
    } catch (err: any) {
      setProcessingState({ isLoading: false, error: err.message, step: 'idle' });
    }
  };

  const handleRegenerateGuide = async (newMode: StudyMode) => {
      if (!activeStudy) return;
      updateStudyMode(activeStudy.id, newMode);
      
      if (activeStudy.sources.length === 0) return;
      
      const source = activeStudy.sources[activeStudy.sources.length - 1]; 
      const isVideo = source.type === InputType.VIDEO;
      
      setProcessingState({ 
        isLoading: true, 
        error: null, 
        step: isVideo ? 'transcribing' : 'analyzing' 
      });

      try {
        const isBinary = source.type === InputType.PDF || source.type === InputType.VIDEO || source.type === InputType.IMAGE;
        
        const progressTimer = setTimeout(() => {
            setProcessingState(prev => ({ ...prev, step: 'generating' }));
        }, 3000);

        const guide = await generateStudyGuide(source.content, source.mimeType || 'text/plain', newMode, isBinary);
        
        clearTimeout(progressTimer);
        
        setStudies(prev => prev.map(s => 
            s.id === activeStudyId ? { ...s, guide, mode: newMode } : s
        ));
        setProcessingState({ isLoading: false, error: null, step: 'idle' });
      } catch (err: any) {
        setProcessingState({ isLoading: false, error: err.message, step: 'idle' });
      }
  };

  const handleGenerateSlides = async () => {
    if (!activeStudy?.guide) return;
    setProcessingState({ isLoading: true, error: null, step: 'slides' });
    try {
        const slides = await generateSlides(activeStudy.guide);
        setStudies(prev => prev.map(s => 
            s.id === activeStudyId ? { ...s, slides } : s
        ));
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
        setStudies(prev => prev.map(s => 
            s.id === activeStudyId ? { ...s, quiz } : s
        ));
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
        setStudies(prev => prev.map(s => 
            s.id === activeStudyId ? { ...s, flashcards } : s
        ));
    } catch (err: any) {
        setProcessingState(prev => ({ ...prev, error: err.message }));
    } finally {
        setProcessingState(prev => ({ ...prev, isLoading: false, step: 'idle' }));
    }
  };

  const handleClearQuiz = () => {
    if (!activeStudyId) return;
    setStudies(prev => prev.map(s => 
      s.id === activeStudyId ? { ...s, quiz: null } : s
    ));
  };


  // --- RENDER LANDING PAGE ---
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
                <BrainCircuit className="w-8 h-8 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900">NeuroStudy Architect</h1>
            </div>
            <button 
                onClick={() => setView('app')} 
                className="text-gray-500 hover:text-indigo-600 font-medium text-sm transition-colors"
            >
                Entrar no Painel →
            </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-12">
                
                <div className="space-y-4">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest border border-indigo-100">
                        Neurociência Aplicada
                    </span>
                    <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        Pare de estudar.<br/>
                        <span className="text-indigo-600">Comece a aprender.</span>
                    </h2>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                        Transforme PDFs, Vídeos e Anotações em guias de estudo ativo, slides e quizzes automaticamente.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    {/* BUTTON 1: FULL PLATFORM */}
                    <button
                        onClick={() => setView('app')}
                        className="group relative flex flex-col items-start p-6 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-200 rounded-2xl transition-all w-full md:w-80 shadow-sm hover:shadow-xl hover:-translate-y-1"
                    >
                        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                            <Layers className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Método NeuroStudy</h3>
                        <p className="text-sm text-gray-500 mt-2 text-left">
                            Acesso completo. Pastas, roteiros, flashcards e professor virtual.
                        </p>
                        <span className="mt-4 text-indigo-600 font-bold text-sm flex items-center gap-1">
                            Acessar Plataforma <ChevronRight className="w-4 h-4" />
                        </span>
                    </button>

                    {/* BUTTON 2: PARETO FAST TRACK */}
                    <div className="relative group w-full md:w-80">
                         {/* Hidden Input for Pareto */}
                        <input 
                            type="file" 
                            ref={paretoInputRef}
                            className="hidden" 
                            onChange={handleParetoUpload} 
                            accept=".pdf, video/*, audio/*, image/*"
                        />
                        <button
                            onClick={() => paretoInputRef.current?.click()}
                            className="relative flex flex-col items-start p-6 bg-white hover:bg-red-50 border-2 border-red-100 hover:border-red-200 rounded-2xl transition-all w-full shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                        >
                             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                            <div className="bg-red-100 p-3 rounded-xl text-red-600 mb-4 group-hover:scale-110 transition-transform">
                                <Target className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Método Pareto 80/20</h3>
                            <p className="text-sm text-gray-500 mt-2 text-left">
                                Extração rápida. Apenas o essencial do arquivo. Sem pastas, sem login.
                            </p>
                            <span className="mt-4 text-red-600 font-bold text-sm flex items-center gap-1">
                                Carregar Arquivo Agora <ChevronRight className="w-4 h-4" />
                            </span>
                        </button>
                    </div>
                </div>

                <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition-all">
                    <div className="flex flex-col items-center gap-2">
                        <BookOpen className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-bold text-gray-400">PDFs e Livros</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                         <Video className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-bold text-gray-400">Vídeo Aulas</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                         <Camera className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-bold text-gray-400">Fotos de Caderno</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                         <Globe className="w-6 h-6 text-gray-400" />
                        <span className="text-xs font-bold text-gray-400">Sites e Artigos</span>
                    </div>
                </div>
            </div>
        </main>
      </div>
    );
  }

  // --- RENDER MAIN APP ---
  return (
    <div className="flex h-screen bg-white font-sans text-slate-800 overflow-hidden animate-in fade-in duration-500">
      
      {/* SIDEBAR */}
      <Sidebar 
        folders={folders} 
        studies={studies}
        activeStudyId={activeStudyId}
        onSelectStudy={setActiveStudyId}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onCreateStudy={(fid, t) => createStudy(fid, t, StudyMode.NORMAL)} // Default new study to Normal
        onDeleteStudy={deleteStudy}
        onDeleteFolder={deleteFolder}
        onMoveFolder={moveFolder}
        onMoveStudy={moveStudy}
        onOpenMethodology={() => setShowMethodologyModal(true)}
        onFolderExam={handleFolderExam}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Top Bar */}
        {activeStudy && (
          <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 flex-shrink-0 z-10">
            {isEditingTitle ? (
                <div className="flex items-center gap-2">
                    <input 
                        autoFocus
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                        onBlur={handleSaveTitle}
                        className="text-xl font-bold text-gray-800 border-b-2 border-indigo-500 outline-none px-1"
                    />
                    <button onClick={handleSaveTitle} className="text-green-600"><CheckCircle className="w-5 h-5"/></button>
                </div>
            ) : (
                <div className="flex items-center gap-2 group">
                    <h2 className="text-xl font-bold text-gray-800 truncate max-w-md" title={activeStudy.title}>{activeStudy.title}</h2>
                    <button 
                        onClick={() => { setIsEditingTitle(true); setEditTitleInput(activeStudy.title); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
                        title="Renomear Estudo"
                    >
                        <Edit className="w-4 h-4"/>
                    </button>
                    {activeStudy.mode === StudyMode.SURVIVAL && (
                        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded uppercase border border-red-200">
                            Pareto 80/20
                        </span>
                    )}
                </div>
            )}
            
            <div className="flex items-center gap-6">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('sources')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'sources' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Fontes
                    </button>
                    <button 
                        onClick={() => setActiveTab('guide')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'guide' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <BookOpen className="w-4 h-4" /> Roteiro
                    </button>
                    <button 
                        onClick={() => setActiveTab('slides')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'slides' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Monitor className="w-4 h-4" /> Slides
                    </button>
                    <button 
                        onClick={() => setActiveTab('quiz')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <HelpCircle className="w-4 h-4" /> Quiz
                    </button>
                    <button 
                        onClick={() => setActiveTab('flashcards')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'flashcards' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Layers className="w-4 h-4" /> Cards
                    </button>
                </div>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto bg-gray-50 p-8 scroll-smooth relative">
            {!activeStudy ? (
                // --- QUICK START DASHBOARD (Empty State Replacement) ---
                <div className="h-full flex flex-col items-center justify-center max-w-6xl mx-auto relative">
                    
                    {quickInputMode === 'none' ? (
                      <>
                        <div className="text-center mb-10">
                            <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">O que você vai <span className="text-indigo-600">aprender</span> hoje?</h1>
                            <p className="text-lg text-gray-500 max-w-xl mx-auto">
                                Transforme qualquer conteúdo em conhecimento ativo instantaneamente. Escolha uma fonte para começar.
                            </p>
                        </div>

                        {/* Mode Selector for Quick Start */}
                         <div className="flex justify-center gap-4 mb-8">
                            {[StudyMode.SURVIVAL, StudyMode.NORMAL, StudyMode.TURBO].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setSelectedMode(mode)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${selectedMode === mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                >
                                    {mode === StudyMode.SURVIVAL && <BatteryCharging className="w-4 h-4" />}
                                    {mode === StudyMode.NORMAL && <Activity className="w-4 h-4" />}
                                    {mode === StudyMode.TURBO && <Rocket className="w-4 h-4" />}
                                    <span className="text-sm font-bold capitalize">{mode === 'SURVIVAL' ? 'Sobrevivência' : mode}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full px-4">
                            {/* Option 1: PDF */}
                            <label className="group relative flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                <div className="p-3 bg-red-50 rounded-full text-red-600 mb-3 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Estudar PDF</h3>
                                <p className="text-xs text-gray-500 text-center">Livros e slides.</p>
                                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if(file) handleQuickStart(file, InputType.PDF, selectedMode);
                                }} />
                            </label>

                            {/* Option 2: Video */}
                            <label className="group relative flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                <div className="p-3 bg-blue-50 rounded-full text-blue-600 mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Video className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Vídeo/Áudio</h3>
                                <p className="text-xs text-gray-500 text-center">Transcrever aula.</p>
                                <input type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if(file) handleQuickStart(file, InputType.VIDEO, selectedMode);
                                }} />
                            </label>

                             {/* Option 3: Image (NEW) */}
                            <label className="group relative flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-pink-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                <div className="p-3 bg-pink-50 rounded-full text-pink-600 mb-3 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                                    <Camera className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Foto Caderno</h3>
                                <p className="text-xs text-gray-500 text-center">Anotações/Livros.</p>
                                <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if(file) handleQuickStart(file, InputType.IMAGE, selectedMode);
                                }} />
                            </label>

                             {/* Option 4: Text Paste */}
                            <button 
                                onClick={() => { setInputType(InputType.TEXT); setQuickInputMode('text'); }}
                                className="group relative flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                <div className="p-3 bg-amber-50 rounded-full text-amber-600 mb-3 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Colar Texto</h3>
                                <p className="text-xs text-gray-500 text-center">Resumos e notas.</p>
                            </button>

                             {/* Option 5: URL */}
                             <button 
                                onClick={() => { setInputType(InputType.URL); setQuickInputMode('text'); }}
                                className="group relative flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                <div className="p-3 bg-cyan-50 rounded-full text-cyan-600 mb-3 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                                    <Globe className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Estudar Site</h3>
                                <p className="text-xs text-gray-500 text-center">Links e Blogs.</p>
                            </button>

                             {/* Option 6: DOI */}
                             <button 
                                onClick={() => { setInputType(InputType.DOI); setQuickInputMode('text'); }}
                                className="group relative flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <Link className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Artigo DOI</h3>
                                <p className="text-xs text-gray-500 text-center">Busca científica.</p>
                            </button>
                        </div>

                        {/* Recent Hint */}
                        <div className="mt-12 flex items-center gap-2 text-gray-400 text-sm">
                            <BrainCircuit className="w-4 h-4" />
                            <span>Suas pastas recentes estão na barra lateral à esquerda.</span>
                        </div>
                      </>
                    ) : (
                      // QUICK INPUT TEXT MODE
                      <div className="w-full max-w-2xl animate-fade-in">
                          <div className="flex items-center justify-between mb-4">
                             <h2 className="text-2xl font-bold text-gray-800">
                               {inputType === InputType.DOI ? 'Colar DOI do Artigo' : 
                                inputType === InputType.URL ? 'Colar Link do Site' : 
                                'Colar Texto para Estudo'}
                             </h2>
                             <button onClick={() => setQuickInputMode('none')} className="text-gray-500 hover:text-gray-700">Cancelar</button>
                          </div>
                          
                          <textarea
                             autoFocus
                             className="w-full h-64 p-6 border border-gray-300 rounded-xl shadow-inner text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none mb-4"
                             placeholder={
                                 inputType === InputType.DOI ? "Ex: 10.1038/s41586-020-2012-7" : 
                                 inputType === InputType.URL ? "Ex: https://pt.wikipedia.org/wiki/Neurociência" :
                                 "Cole o conteúdo aqui..."
                             }
                             value={inputText}
                             onChange={(e) => setInputText(e.target.value)}
                          ></textarea>

                          <button 
                            onClick={() => handleQuickStart(inputText, inputType, selectedMode)}
                            disabled={!inputText.trim()}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                          >
                             {selectedMode === StudyMode.TURBO && <Rocket className="w-5 h-5" />}
                             {selectedMode === StudyMode.NORMAL && <Activity className="w-5 h-5" />}
                             {selectedMode === StudyMode.SURVIVAL && <BatteryCharging className="w-5 h-5" />}
                             Iniciar Estudo Agora ({selectedMode === 'SURVIVAL' ? 'Sobrevivência' : selectedMode})
                          </button>
                      </div>
                    )}
                </div>
            ) : (
                // CONTENT VIEWS
                <div className="max-w-5xl mx-auto">
                    
                    {/* --- SOURCES TAB --- */}
                    {activeTab === 'sources' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Upload Card */}
                                <div className="bg-white p-6 rounded-xl paper-shadow border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <UploadCloud className="w-5 h-5 text-indigo-500"/> Adicionar Fonte
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {/* Type Selector */}
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button onClick={() => setInputType(InputType.TEXT)} className={`flex-1 py-1.5 text-xs font-medium rounded ${inputType === InputType.TEXT ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>Texto</button>
                                            <button onClick={() => setInputType(InputType.PDF)} className={`flex-1 py-1.5 text-xs font-medium rounded ${inputType === InputType.PDF ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>PDF</button>
                                            <button onClick={() => setInputType(InputType.IMAGE)} className={`flex-1 py-1.5 text-xs font-medium rounded ${inputType === InputType.IMAGE ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>Imagem</button>
                                            <button onClick={() => setInputType(InputType.VIDEO)} className={`flex-1 py-1.5 text-xs font-medium rounded ${inputType === InputType.VIDEO ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>Vídeo</button>
                                            <button onClick={() => setInputType(InputType.URL)} className={`flex-1 py-1.5 text-xs font-medium rounded ${inputType === InputType.URL ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>Site</button>
                                            <button onClick={() => setInputType(InputType.DOI)} className={`flex-1 py-1.5 text-xs font-medium rounded ${inputType === InputType.DOI ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>DOI</button>
                                        </div>

                                        {inputType === InputType.TEXT || inputType === InputType.DOI || inputType === InputType.URL ? (
                                            <textarea
                                                className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder={
                                                    inputType === InputType.DOI ? "Cole o DOI aqui..." : 
                                                    inputType === InputType.URL ? "Cole o link do site aqui..." :
                                                    "Cole seu texto..."
                                                }
                                                value={inputText}
                                                onChange={(e) => setInputText(e.target.value)}
                                            />
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                                                    <p className="text-sm text-gray-500">
                                                        {selectedFile ? selectedFile.name : 
                                                         inputType === InputType.IMAGE ? "Upload de Imagem (JPG, PNG)" :
                                                         inputType === InputType.VIDEO ? "Upload de Vídeo/Áudio" :
                                                         "Upload de PDF"}
                                                    </p>
                                                </div>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept={
                                                        inputType === InputType.VIDEO ? "video/*,audio/*" : 
                                                        inputType === InputType.IMAGE ? "image/png, image/jpeg, image/webp" :
                                                        ".pdf"
                                                    }
                                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                />
                                            </label>
                                        )}

                                        <button 
                                            onClick={addSourceToStudy}
                                            disabled={(!inputText && !selectedFile)}
                                            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                        >
                                            Adicionar ao Estudo
                                        </button>
                                    </div>
                                </div>

                                {/* Sources List Card */}
                                <div className="bg-white p-6 rounded-xl paper-shadow border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-4">Fontes Adicionadas ({activeStudy.sources.length})</h3>
                                    {activeStudy.sources.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">Nenhuma fonte adicionada.</p>
                                    ) : (
                                        <ul className="space-y-2 max-h-64 overflow-y-auto">
                                            {activeStudy.sources.map(source => (
                                                <li key={source.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 group">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        {source.type === InputType.PDF ? <FileText className="w-4 h-4 text-red-500"/> : 
                                                         source.type === InputType.VIDEO ? <Video className="w-4 h-4 text-blue-500"/> : 
                                                         source.type === InputType.IMAGE ? <Camera className="w-4 h-4 text-pink-500"/> : 
                                                         source.type === InputType.DOI ? <Link className="w-4 h-4 text-emerald-500"/> : 
                                                         source.type === InputType.URL ? <Globe className="w-4 h-4 text-cyan-500"/> :
                                                         <FileText className="w-4 h-4 text-gray-500"/>}
                                                        <span className="text-sm text-gray-700 truncate">{source.name}</span>
                                                    </div>
                                                    <button onClick={() => removeSource(source.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash className="w-4 h-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-indigo-900 text-lg">Pronto para transformar?</h3>
                                    <p className="text-indigo-700 text-sm">O NeuroStudy vai analisar suas fontes e criar o roteiro perfeito.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
                                        <span className="text-xs font-bold text-indigo-500 uppercase">Modo:</span>
                                        {/* Replaced Select with Icon Buttons for Sources Tab */}
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => updateStudyMode(activeStudy.id, StudyMode.SURVIVAL)}
                                                className={`p-1.5 rounded ${activeStudy.mode === StudyMode.SURVIVAL ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100 text-gray-400'}`}
                                                title="Sobrevivência"
                                            >
                                                <BatteryCharging className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => updateStudyMode(activeStudy.id, StudyMode.NORMAL)}
                                                className={`p-1.5 rounded ${activeStudy.mode === StudyMode.NORMAL ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-400'}`}
                                                title="Normal"
                                            >
                                                <Activity className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => updateStudyMode(activeStudy.id, StudyMode.TURBO)}
                                                className={`p-1.5 rounded ${activeStudy.mode === StudyMode.TURBO ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100 text-gray-400'}`}
                                                title="Turbo"
                                            >
                                                <Rocket className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleGenerateGuide}
                                        disabled={activeStudy.sources.length === 0 || processingState.isLoading}
                                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-transform active:scale-[0.99]"
                                    >
                                        {processingState.isLoading ? (
                                            <>
                                                <span className="animate-spin text-white">⚙️</span> 
                                                {processingState.step === 'transcribing' ? 'Transcrevendo Áudio...' :
                                                 processingState.step === 'analyzing' ? 'Lendo Documento...' :
                                                 processingState.step === 'generating' ? 'Escrevendo Roteiro...' : 
                                                 'Processando...'}
                                            </>
                                        ) : (
                                            <>
                                                <BrainCircuit className="w-5 h-5" /> Gerar Roteiro
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- GUIDE TAB --- */}
                    {activeTab === 'guide' && (
                        activeStudy.guide ? (
                            <ResultsView 
                                guide={activeStudy.guide} 
                                onReset={() => setActiveTab('sources')}
                                onGenerateQuiz={() => setActiveTab('quiz')}
                                onUpdateGuide={(newGuide) => updateStudyGuide(activeStudyId, newGuide)}
                            />
                        ) : (
                            <div className="text-center py-20 text-gray-400">
                                <p>Nenhum roteiro gerado ainda. Adicione fontes e clique em Gerar.</p>
                            </div>
                        )
                    )}

                    {/* --- SLIDES TAB --- */}
                    {activeTab === 'slides' && (
                         <div className="animate-fade-in">
                            {activeStudy.slides ? (
                                <SlidesView slides={activeStudy.slides} />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <Monitor className="w-16 h-16 text-gray-200 mb-4" />
                                    <h3 className="text-xl font-bold text-gray-700 mb-2">Slides de Aula</h3>
                                    <p className="text-gray-500 mb-6 max-w-md">Gere uma apresentação estruturada pronta para usar ou revisar, baseada no seu roteiro.</p>
                                    <button 
                                        onClick={handleGenerateSlides}
                                        disabled={!activeStudy.guide || processingState.isLoading}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {processingState.isLoading ? 'Criando Slides...' : 'Gerar Slides Agora'}
                                    </button>
                                </div>
                            )}
                         </div>
                    )}

                    {/* --- QUIZ TAB --- */}
                    {activeTab === 'quiz' && (
                         <div className="animate-fade-in">
                            <QuizView 
                                questions={activeStudy.quiz || []}
                                onGenerate={handleGenerateQuiz}
                                onClear={handleClearQuiz}
                            />
                         </div>
                    )}

                    {/* --- FLASHCARDS TAB --- */}
                    {activeTab === 'flashcards' && (
                         <div className="animate-fade-in">
                            <FlashcardsView 
                                cards={activeStudy.flashcards || []}
                                onGenerate={handleGenerateFlashcards}
                            />
                         </div>
                    )}

                </div>
            )}
        </main>
      </div>

      {/* FLOATING CHAT */}
      <ChatWidget studyGuide={activeStudy?.guide || null} />

      {/* METHODOLOGY MODAL */}
      {showMethodologyModal && (
        <MethodologyModal onClose={() => setShowMethodologyModal(false)} />
      )}

    </div>
  );
}
