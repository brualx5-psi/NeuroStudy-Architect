import React, { useState, useEffect, useRef } from 'react';
import { InputType, ProcessingState, StudyGuide, StudySession, Folder, StudySource, StudyMode, SlideContent } from './types';
import { generateStudyGuide, generateSlides, generateQuiz, generateFlashcards, uploadFileToGemini, transcribeMedia } from './services/geminiService';
import { loadUserData, saveUserData, isCloudMode } from './services/storage';
import { hasCompletedOnboarding } from './services/userProfileService';
import { ResultsView } from './components/ResultsView';
import { SlidesView } from './components/SlidesView';
import { QuizView } from './components/QuizView';
import { FlashcardsView } from './components/FlashcardsView';
import { MindMapView } from './components/MindMapView';
import { ConnectionsView } from './components/ConnectionsView';
import { ChatWidget } from './components/ChatWidget';
import { Sidebar } from './components/Sidebar';
import { MethodologyModal } from './components/MethodologyModal';
import { ProcessingStatus } from './components/ProcessingStatus';
import { PomodoroTimer } from './components/PomodoroTimer';
import { ReviewSchedulerModal } from './components/ReviewSchedulerModal';
import { NotificationCenter } from './components/NotificationCenter';
import { SourcePreviewModal } from './components/SourcePreviewModal';
import { SearchResourcesModal } from './components/SearchResourcesModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { SettingsModal } from './components/SettingsModal';
import { UsageBadge } from './components/UsageBadge';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { useSettings, SettingsProvider } from './contexts/SettingsContext';
import { LoginPage } from './pages/LoginPage';
import { NeuroLogo, UploadCloud, FileText, Search, BookOpen, Monitor, Plus, Trash, Link, Rocket, BatteryCharging, Activity, Globe, Edit, CheckCircle, Layers, Target, Menu, Bell, Calendar, GenerateIcon, Eye, Settings, Play, X, Lock, ChevronRight, Zap, HelpCircle, Sparkles, Loader2 } from './components/Icons';

export function AppContent() {
    const { user, loading, signOut, isPro, limits, canCreateStudy, incrementUsage, usage } = useAuth();
    const { settings } = useSettings();
    // Estado da view - começa como 'app' se usuário logado
    const [view, setView] = useState<'landing' | 'app'>('landing');

    // Força ir para 'app' quando usuário está logado
    const effectiveView = user ? 'app' : view;
    const [folders, setFolders] = useState<Folder[]>([]);
    const [studies, setStudies] = useState<StudySession[]>([]);
    const [activeStudyId, setActiveStudyId] = useState<string | null>(null);
    const [targetFolderId, setTargetFolderId] = useState<string>('root-neuro');

    const handleRequestNewStudy = (folderId: string) => {
        if (!isOnboardingComplete) {
            setShowOnboarding(true);
            return;
        }

        setTargetFolderId(folderId);

        const isBook = folderId === 'root-books';
        const isPareto = folderId === 'root-pareto';

        // Verifica se já existe um estudo vazio para reutilizar nessa pasta
        const existing = studies.find(s =>
            s.folderId === folderId &&
            s.sources.length === 0 &&
            (s.title === 'Novo Estudo' || s.title === 'Livro: Novo Estudo' || s.title === 'Pareto: Novo Estudo')
        );

        if (existing) {
            setActiveStudyId(existing.id);
            // Garante que o modo está correto para os contextos especiais
            if (isPareto && existing.mode !== StudyMode.PARETO) updateStudyMode(existing.id, StudyMode.PARETO);
            if (isBook && !existing.isBook) { /* Forçar isBook seria complexo aqui, melhor confiar na criação correta */ }
        } else {
            // Cria um novo estudo imediatamente configurado para o contexto
            createStudy(
                folderId,
                isBook ? 'Livro: Novo Estudo' : isPareto ? 'Pareto: Novo Estudo' : 'Novo Estudo',
                isPareto ? StudyMode.PARETO : StudyMode.NORMAL,
                isBook
            );
        }

        setView('app');
    };

    // ATUALIZADO: Adicionadas as abas 'map' e 'connections'
    const [activeTab, setActiveTab] = useState<'sources' | 'guide' | 'slides' | 'quiz' | 'flashcards' | 'map' | 'connections'>('sources');

    const [inputText, setInputText] = useState('');
    const [inputType, setInputType] = useState<InputType>(InputType.TEXT);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedMode, setSelectedMode] = useState<StudyMode>(StudyMode.NORMAL);
    const [quickInputMode, setQuickInputMode] = useState<'none' | 'text'>('none');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleInput, setEditTitleInput] = useState('');
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [editSourceName, setEditSourceName] = useState('');
    const [previewSource, setPreviewSource] = useState<StudySource | null>(null);
    const [showMethodologyModal, setShowMethodologyModal] = useState(false);
    const [showReviewScheduler, setShowReviewScheduler] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const initialOnboardingComplete = hasCompletedOnboarding();
    const [isOnboardingComplete, setIsOnboardingComplete] = useState(initialOnboardingComplete);
    const [showOnboarding, setShowOnboarding] = useState(!initialOnboardingComplete);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [initialSettingsTab, setInitialSettingsTab] = useState<'search' | 'productivity' | 'account'>('search');
    const [processingState, setProcessingState] = useState<ProcessingState>({ isLoading: false, error: null, step: 'idle' });

    // Refs precisam ser declarados antes de qualquer return condicional
    const paretoInputRef = useRef<HTMLInputElement>(null);
    const bookInputRef = useRef<HTMLInputElement>(null);

    // TODOS os useEffect precisam vir antes de qualquer return condicional
    useEffect(() => {
        const load = async () => {
            const data = await loadUserData();
            if (data) {
                if (data.studies) setStudies(data.studies || []);
                if (data.folders) setFolders(data.folders || []);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (studies.length > 0 || folders.length > 0) {
                saveUserData(studies, folders);
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [studies, folders]);

    useEffect(() => {
        setIsEditingTitle(false);
        setEditTitleInput('');
        setIsMobileMenuOpen(false);
        setEditingSourceId(null);
    }, [activeStudyId]);

    // Se estiver carregando a sessão, mostra um loading bonito
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-xl shadow-indigo-100/50">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
                <p className="text-slate-400 font-bold animate-pulse">Sincronizando neurônios...</p>
            </div>
        );
    }

    // Se não houver usuário, redireciona para o login
    if (!user) {
        return <LoginPage />;
    }

    const activeStudy = studies.find(s => s.id === activeStudyId) || null;
    const isParetoStudy = activeStudy?.mode === StudyMode.PARETO;

    const totalCheckpoints = activeStudy?.guide?.checkpoints?.length || 0;
    const completedCheckpoints = activeStudy?.guide?.checkpoints?.filter(c => c.completed).length || 0;
    const isGuideComplete = totalCheckpoints > 0 && totalCheckpoints === completedCheckpoints;
    const dueReviewsCount = studies.filter(s => s.nextReviewDate && s.nextReviewDate <= Date.now()).length;



    const handleGoToHome = () => { setIsMobileMenuOpen(false); setActiveStudyId(null); setView('landing'); };

    const createFolder = (name: string, parentId?: string) => {
        const newFolder: Folder = { id: Date.now().toString(), name, parentId };
        setFolders([...folders, newFolder]);
        return newFolder.id;
    };

    const renameFolder = (id: string, newName: string) => { setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f)); };
    const deleteFolder = (id: string) => {
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
        setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: targetParentId } : f));
    };
    const moveStudy = (studyId: string, targetFolderId: string) => { setStudies(prev => prev.map(s => s.id === studyId ? { ...s, folderId: targetFolderId } : s)); };

    const createStudy = (folderId: string, title: string, mode: StudyMode = selectedMode, isBook: boolean = false) => {
        // Verificação de limite de roteiros
        if (!isPro && !canCreateStudy()) {
            setShowSubscriptionModal(true);
            return null;
        }

        const newStudy: StudySession = {
            id: Date.now().toString(), folderId, title, sources: [], mode, isBook,
            guide: null, slides: null, quiz: null, flashcards: null, createdAt: Date.now(), updatedAt: Date.now(),
            reviewStep: 0
        };
        setStudies(prev => [...prev, newStudy]);
        setActiveStudyId(newStudy.id);
        setActiveTab('sources');
        setSelectedMode(mode);
        return newStudy;
    };

    const deleteStudy = (id: string) => { setStudies(studies.filter(s => s.id !== id)); if (activeStudyId === id) setActiveStudyId(null); };
    const updateStudyGuide = (studyId: string, newGuide: StudyGuide) => { setStudies(prev => prev.map(s => s.id === studyId ? { ...s, guide: newGuide } : s)); };
    const updateStudyMode = (studyId: string, mode: StudyMode) => { setStudies(prev => prev.map(s => s.id === studyId ? { ...s, mode: mode } : s)); };
    const handleSaveTitle = () => { if (activeStudyId && editTitleInput.trim()) { setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, title: editTitleInput } : s)); } setIsEditingTitle(false); };
    const addSourceToStudy = async () => {
        if (!activeStudyId || !activeStudy) return;

        // Verificação de limite de fontes por roteiro
        const maxSources = limits.sources_per_study;
        if (activeStudy.sources.length >= maxSources) {
            alert(`Limite de ${maxSources} fontes por roteiro atingido!`);
            if (!isPro) setShowSubscriptionModal(true);
            return;
        }

        let content = ''; let mimeType = ''; let name = ''; let finalType = inputType;
        if (inputType === InputType.TEXT || inputType === InputType.DOI || inputType === InputType.URL) {
            if (!inputText.trim()) return;

            // Verificação de limite de páginas para texto (Free: 30 pág ~ 75.000 chars)
            const maxChars = limits.pages_per_source * 2500;
            if (inputText.length > maxChars) {
                alert(`Texto muito longo! Seu plano suporta até ${limits.pages_per_source} páginas (aprox. ${maxChars.toLocaleString()} caracteres).`);
                if (!isPro) setShowSubscriptionModal(true);
                return;
            }

            content = inputText; mimeType = 'text/plain';
            if (inputType === InputType.DOI) name = `DOI: ${inputText.slice(0, 20)}...`;
            else if (inputType === InputType.URL) name = `Link: ${inputText.slice(0, 30)}...`;
            else name = `Nota de Texto ${new Date().toLocaleTimeString()}`;
        } else {
            if (!selectedFile) return;

            // Lógica de Transcrição Automática para Vídeo/Áudio
            if (inputType === InputType.VIDEO) {
                // Bloqueio de transcrição para usuários Free (ou verificar limite de minutos)
                if (!isPro) {
                    setShowSubscriptionModal(true);
                    return;
                }

                setProcessingState({ isLoading: true, error: null, step: 'transcribing' });
                try {
                    // Otimização: Upload direto do arquivo binário (sem converter para base64 antes)
                    // Isso permite arquivos gigantes (60min+) sem travar o navegador e é muito mais rápido.
                    // 1. Upload para Gemini (para gerar URI)
                    const fileUri = await uploadFileToGemini(selectedFile, selectedFile.type);
                    // 2. Transcrever
                    const transcript = await transcribeMedia(fileUri, selectedFile.type);

                    // 3. Salvar como Fonte de TEXTO
                    content = transcript;
                    mimeType = 'text/plain';
                    name = `[Transcrição] ${selectedFile.name}`;
                    finalType = InputType.TEXT; // Muda para Texto pois agora é uma transcrição

                    // Incrementar uso de YouTube (estimando 30min por arquivo por simplicidade)
                    await incrementUsage('youtube', 30);

                    setProcessingState({ isLoading: false, error: null, step: 'idle' });
                } catch (err: any) {
                    setProcessingState({ isLoading: false, error: "Erro na transcrição: " + err.message, step: 'idle' });
                    return;
                }
            } else {
                content = await fileToBase64(selectedFile); mimeType = selectedFile.type; name = selectedFile.name;
                if (inputType === InputType.PDF) {
                    if (name.toLowerCase().endsWith('.epub')) finalType = InputType.EPUB;
                    else if (name.toLowerCase().endsWith('.mobi')) finalType = InputType.MOBI;
                }
            }
        }
        const isFirstSource = (!activeStudy?.sources || activeStudy.sources.length === 0);
        const newSource: StudySource = { id: Date.now().toString(), type: finalType, name, content, mimeType, dateAdded: Date.now(), isPrimary: isFirstSource };
        setStudies(prev => prev.map(s => { if (s.id === activeStudyId) return { ...s, sources: [...s.sources, newSource] }; return s; }));
        setInputText(''); setSelectedFile(null);
    };

    const handleSetPrimarySource = (sourceId: string) => {
        if (!activeStudyId) return;
        setStudies(prev => prev.map(s => {
            if (s.id === activeStudyId) {
                return {
                    ...s,
                    sources: s.sources.map(src => ({ ...src, isPrimary: src.id === sourceId }))
                };
            }
            return s;
        }));
    };

    const handleAddSearchSource = (name: string, content: string, type: InputType) => {
        if (!activeStudyId) return;
        const newSource: StudySource = {
            id: Date.now().toString(), type, name, content, mimeType: 'text/plain', dateAdded: Date.now()
        };
        setStudies(prev => prev.map(s => {
            if (s.id === activeStudyId) return { ...s, sources: [...s.sources, newSource] };
            return s;
        }));
    };

    const removeSource = (sourceId: string) => { if (!activeStudyId) return; setStudies(prev => prev.map(s => { if (s.id === activeStudyId) return { ...s, sources: s.sources.filter(src => src.id !== sourceId) }; return s; })); };
    const handleStartRenamingSource = (source: StudySource) => { setEditingSourceId(source.id); setEditSourceName(source.name); };
    const handleSaveSourceRename = () => { if (!activeStudyId || !editingSourceId) return; setStudies(prev => prev.map(s => { if (s.id === activeStudyId) return { ...s, sources: s.sources.map(src => src.id === editingSourceId ? { ...src, name: editSourceName } : src) }; return s; })); setEditingSourceId(null); setEditSourceName(''); };

    const handleQuickStart = async (content: string | File, type: InputType, mode: StudyMode = StudyMode.NORMAL, autoGenerate: boolean = false, isBook: boolean = false) => {
        if (!isOnboardingComplete) {
            setShowOnboarding(true);
            return;
        }

        let targetFolderId = 'root-neuro';
        if (isBook) targetFolderId = 'root-books';
        else if (mode === StudyMode.PARETO) targetFolderId = 'root-pareto';

        const fileName = content instanceof File ? content.name : 'Novo Estudo';
        let title = isBook ? `Livro: ${fileName}` : mode === StudyMode.PARETO ? `Pareto 80/20: ${fileName}` : `Estudo: ${fileName}`;

        const newStudy = createStudy(targetFolderId, title, mode, isBook);
        if (!newStudy) return; // Limite atingido, modal já exibido

        let sourceContent = ''; let mimeType = 'text/plain'; let name = '';
        if (content instanceof File) { sourceContent = await fileToBase64(content); mimeType = content.type; name = content.name; }
        else { sourceContent = content; if (type === InputType.DOI) name = 'DOI Link'; else if (type === InputType.URL) name = 'Website Link'; else name = 'Texto Colado'; }

        const newSource: StudySource = { id: Date.now().toString(), type, name, content: sourceContent, mimeType, dateAdded: Date.now(), isPrimary: true };
        setStudies(prev => prev.map(s => { if (s.id === newStudy.id) return { ...s, sources: [newSource] }; return s; }));

        setQuickInputMode('none'); setInputText(''); setView('app');
        if (autoGenerate) { setTimeout(() => handleGenerateGuideForStudy(newStudy.id, [newSource], mode, isBook), 100); }
    };

    const handleParetoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            let type = InputType.TEXT;
            if (file.type.includes('pdf')) type = InputType.PDF;
            else if (file.name.endsWith('.epub')) type = InputType.EPUB;
            else if (file.name.endsWith('.mobi')) type = InputType.MOBI;
            else if (file.type.includes('video') || file.type.includes('audio')) type = InputType.VIDEO;
            else if (file.type.includes('image')) type = InputType.IMAGE;
            handleQuickStart(file, type, StudyMode.PARETO, true, false);
        }
    };

    const handleBookUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            let type = InputType.PDF;
            if (file.name.endsWith('.epub')) type = InputType.EPUB;
            if (file.name.endsWith('.mobi')) type = InputType.MOBI;
            handleQuickStart(file, type, StudyMode.NORMAL, false, true);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => { const result = reader.result as string; const base64 = result.split(',')[1]; resolve(base64); }; reader.onerror = (error) => reject(error); }); };

    const handleGenerateGuideForStudy = async (studyId: string, sources: StudySource[], mode: StudyMode, isBook: boolean) => {
        // Encontra a fonte primária para definir o passo inicial (transcribing vs analyzing)
        const primarySource = sources.find(s => s.isPrimary) || sources[0];
        const isVideo = primarySource?.type === InputType.VIDEO;
        const isBinary = sources.some(s => s.type === InputType.PDF || s.type === InputType.EPUB || s.type === InputType.MOBI); // Simplificação

        setProcessingState({ isLoading: true, error: null, step: isVideo ? 'transcribing' : 'analyzing' });
        try {
            const progressTimer = setTimeout(() => { setProcessingState(prev => ({ ...prev, step: 'generating' })); }, 3500);

            // ATENÇÃO: Agora passamos o ARRAY de fontes para o geminiService
            const guide = await generateStudyGuide(sources, mode, isBinary, isBook);

            clearTimeout(progressTimer);
            setStudies(prev => prev.map(s => s.id === studyId ? { ...s, guide } : s));
            setStudies(prev => prev.map(s => s.id === studyId ? { ...s, guide } : s));
            setProcessingState({ isLoading: false, error: null, step: 'idle' });
            setActiveTab('guide');
        } catch (err: any) {
            setProcessingState({ isLoading: false, error: err.message, step: 'idle' });
        }
    };

    const handleGenerateGuide = async () => {
        if (!activeStudy || activeStudy.sources.length === 0) return;

        // Verificação de limite de roteiros (incrementa uso ao gerar)
        if (!isPro && !canCreateStudy()) {
            setShowSubscriptionModal(true);
            return;
        }

        await handleGenerateGuideForStudy(activeStudy.id, activeStudy.sources, activeStudy.mode, activeStudy.isBook || false);

        // Incrementar uso após geração bem-sucedida
        await incrementUsage('roadmap');
    };

    const handleGenerateSlides = async () => {
        // Slides é recurso PRO apenas
        if (!isPro) {
            setShowSubscriptionModal(true);
            return;
        }
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
    const handleGenerateQuiz = async (config?: any) => { if (!activeStudy?.guide) return; setProcessingState({ isLoading: true, error: null, step: 'quiz' }); try { const quiz = await generateQuiz(activeStudy.guide, activeStudy.mode || StudyMode.NORMAL, config); setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, quiz } : s)); } catch (err: any) { setProcessingState(prev => ({ ...prev, error: err.message })); } finally { setProcessingState(prev => ({ ...prev, isLoading: false, step: 'idle' })); } };
    const handleGenerateFlashcards = async () => { if (!activeStudy?.guide) return; setProcessingState({ isLoading: true, error: null, step: 'flashcards' }); try { const flashcards = await generateFlashcards(activeStudy.guide); setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, flashcards } : s)); } catch (err: any) { setProcessingState(prev => ({ ...prev, error: err.message })); } finally { setProcessingState(prev => ({ ...prev, isLoading: false, step: 'idle' })); } };
    const handleClearQuiz = () => { if (!activeStudyId) return; setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, quiz: null } : s)); };
    const handleStartSession = () => {
        if (!isOnboardingComplete) {
            setShowOnboarding(true);
            return;
        }

        const isBookContext = targetFolderId === 'root-books';
        const isParetoContext = targetFolderId === 'root-pareto';

        // Verifica se já existe um "Novo Estudo" (ou nome padrão) VAZIO nesta pasta
        const existingEmptyStudy = studies.find(s =>
            s.folderId === targetFolderId &&
            (s.title === 'Novo Estudo' || s.title === 'Livro: Novo Estudo' || s.title === 'Pareto: Novo Estudo') &&
            s.sources.length === 0
        );

        if (existingEmptyStudy) {
            setActiveStudyId(existingEmptyStudy.id);
            if (isParetoContext) updateStudyMode(existingEmptyStudy.id, StudyMode.PARETO);
            else updateStudyMode(existingEmptyStudy.id, selectedMode);
        } else {
            const title = isBookContext ? `Livro: Novo Estudo` : isParetoContext ? `Pareto: Novo Estudo` : `Novo Estudo`;
            const mode = isParetoContext ? StudyMode.PARETO : selectedMode;
            createStudy(targetFolderId, title, mode, isBookContext);
        }
    };
    const handleOnboardingCreateStudy = () => {
        handleStartSession();
        setShowSearchModal(true);
    };
    const handleFolderExam = (fid: string) => {
        // Feature "Provão" (Folder Exam) placeholder
        alert('🚀 Provão Geral: Em breve você poderá gerar simulados de pastas inteiras! Estamos finalizando esta IA.');
    };

    const handleMarkReviewDone = (studyId: string) => {
        setStudies(prev => prev.map(s => {
            if (s.id === studyId) {
                const currentStep = s.reviewStep || 0;
                const nextStep = currentStep + 1;

                let daysToAdd = 1;
                if (nextStep === 1) daysToAdd = 7;
                if (nextStep === 2) daysToAdd = 14;
                if (nextStep >= 3) daysToAdd = 30;

                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + daysToAdd);

                return {
                    ...s,
                    nextReviewDate: nextDate.getTime(),
                    reviewStep: nextStep
                };
            }
            return s;
        }));
    };

    const openGoogleCalendar = (title: string, date: Date) => {
        const start = new Date(date);
        start.setHours(9, 0, 0, 0);
        const end = new Date(date);
        end.setHours(10, 0, 0, 0);

        const format = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Revisão: ${title}`)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent("Revisão espaçada recomendada pelo NeuroStudy Architect.")}&sf=true&output=xml`;

        window.open(url, '_blank');
    };

    const handleInitialSchedule = (studyId: string) => {
        const study = studies.find(s => s.id === studyId);
        if (study) {
            setActiveStudyId(studyId);
            setShowReviewScheduler(true);
        }
    };

    const handleSnoozeReview = (studyId: string) => {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 1);
        setStudies(prev => prev.map(s => s.id === studyId ? { ...s, nextReviewDate: nextDate.getTime() } : s));
    };

    const handleDeleteReview = (studyId: string) => {
        setStudies(prev => prev.map(s => s.id === studyId ? { ...s, nextReviewDate: undefined } : s));
    };

    const handleScheduleReview = (timestamp: number, openCalendar: boolean = false) => {
        if (activeStudyId) {
            setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, nextReviewDate: timestamp } : s));

            if (openCalendar) {
                const study = studies.find(s => s.id === activeStudyId);
                if (study) openGoogleCalendar(study.title, new Date(timestamp));
            }
        }
    };

    if (effectiveView === 'landing') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
                <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <NeuroLogo size={40} className="text-indigo-600" />
                        <span className="font-extrabold text-slate-900 tracking-tight text-xl">NeuroStudy</span>
                        {isCloudMode() && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-100 uppercase tracking-wider">Cloud Sync</span>}
                    </div>
                    <button onClick={() => setView('app')} className="text-gray-500 hover:text-indigo-600 font-medium text-sm transition-colors">Entrar no Painel →</button>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="max-w-5xl mx-auto space-y-12">
                        <div className="space-y-4">
                            <span className="inline-block py-1 px-3 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest border border-indigo-100">IA + Neurociência</span>
                            <div className="flex justify-center mb-8"><NeuroLogo size={130} className="drop-shadow-2xl" /></div>
                            <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">Não é resumo.<br /><span className="text-indigo-600">É roteiro.</span></h2>
                            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">Economize energia mental <strong>planejando</strong>. Gaste energia mental <strong>aprendendo</strong>.</p>
                            <p className="text-sm text-slate-400 max-w-lg mx-auto">Transforme PDFs, Vídeos e Anotações em roteiros de estudo ativo baseados em neurociência.</p>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                            <button onClick={() => setView('app')} className="group relative flex flex-col items-start p-6 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-200 rounded-2xl transition-all w-full md:w-80 shadow-sm hover:shadow-xl hover:-translate-y-1">
                                <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 mb-4 group-hover:scale-110 transition-transform"><Layers className="w-8 h-8" /></div>
                                <h3 className="text-lg font-bold text-gray-900">Método NeuroStudy</h3>
                                <p className="text-sm text-gray-500 mt-2 text-left flex-1">Acesso completo. Pastas, roteiros, flashcards e professor virtual.</p>
                                <span className="mt-4 w-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-indigo-700 transition-colors">Iniciar <ChevronRight className="w-4 h-4" /></span>
                            </button>

                            <div className="relative group w-full md:w-80">
                                <input type="file" ref={bookInputRef} className="hidden" onChange={handleBookUpload} accept=".pdf,.epub,.mobi" />
                                <button onClick={() => bookInputRef.current?.click()} className="relative flex flex-col items-start p-6 bg-white hover:bg-orange-50 border-2 border-orange-100 hover:border-orange-200 rounded-2xl transition-all w-full shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                                    <div className="bg-orange-100 p-3 rounded-xl text-orange-600 mb-4 group-hover:scale-110 transition-transform"><BookOpen className="w-8 h-8" /></div>
                                    <h3 className="text-lg font-bold text-gray-900">Resumo de Livros</h3>
                                    <p className="text-sm text-gray-500 mt-2 text-left flex-1">Analise livros inteiros. Modos Sobrevivência, Normal e Hard.</p>
                                    <span className="mt-4 w-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-orange-600 transition-colors">Iniciar <ChevronRight className="w-4 h-4" /></span>
                                </button>
                            </div>

                            <div className="relative group w-full md:w-80">
                                <input type="file" ref={paretoInputRef} className="hidden" onChange={handleParetoUpload} accept=".pdf, video/*, audio/*, image/*, .epub, .mobi" />
                                <button onClick={() => paretoInputRef.current?.click()} className="relative flex flex-col items-start p-6 bg-white hover:bg-red-50 border-2 border-red-100 hover:border-red-200 rounded-2xl transition-all w-full shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                    <div className="bg-red-100 p-3 rounded-xl text-red-600 mb-4 group-hover:scale-110 transition-transform"><Target className="w-8 h-8" /></div>
                                    <h3 className="text-lg font-bold text-gray-900">Método Pareto 80/20</h3>
                                    <p className="text-sm text-gray-500 mt-2 text-left flex-1">Extração Rápida. Ideal para consultas ágeis e tirar dúvidas pontuais.</p>
                                    <span className="mt-4 w-full bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-1 px-4 py-3 rounded-lg group-hover:bg-red-700 transition-colors">Iniciar <ChevronRight className="w-4 h-4" /></span>
                                </button>
                            </div>
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
        <div className="flex h-screen bg-white dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 overflow-hidden animate-in fade-in duration-500">
            <Sidebar
                folders={folders} studies={studies} activeStudyId={activeStudyId}
                onSelectStudy={setActiveStudyId} onCreateFolder={createFolder}
                onRenameFolder={renameFolder} onCreateStudy={createStudy}
                onDeleteStudy={deleteStudy} onDeleteFolder={deleteFolder}
                onMoveFolder={moveFolder} onMoveStudy={moveStudy}
                onOpenMethodology={() => setShowMethodologyModal(true)}
                onFolderExam={handleFolderExam} onRequestNewStudy={handleRequestNewStudy}
                onGoToHome={handleGoToHome}
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                <header className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden text-gray-600" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
                        {activeStudy ? (
                            <div className="flex flex-col">
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
                        ) : (<h1 className="text-xl font-bold text-gray-400">Criar Novo Estudo</h1>)}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span
                                className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 cursor-pointer hover:bg-indigo-100"
                                onClick={() => { setInitialSettingsTab('productivity'); setShowSettingsModal(true); }}
                                title="Configurar foco e produtividade"
                            >
                                🎯 Foco: {settings.focusArea || 'Geral'}
                            </span>
                            <button
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                                onClick={() => { setInitialSettingsTab('search'); setShowSettingsModal(true); }}
                                title="Configurações"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                        <UsageBadge />
                        <div className="relative">
                            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" onClick={() => setShowNotifications(!showNotifications)}>
                                <Bell className="w-5 h-5" />
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
                                        onEditReview={handleInitialSchedule} // Reusa a função que abre o modal
                                    />
                                </>
                            )}
                        </div>

                        {activeStudy && (
                            <button onClick={() => setShowReviewScheduler(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"><Calendar className="w-4 h-4" /> Agendar Revisão</button>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 scroll-smooth">

                    {processingState.error && (
                        <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-500 text-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-6 mx-auto max-w-4xl" role="alert">
                            <strong className="font-bold">Ocorreu um erro: </strong>
                            <span className="block sm:inline">{processingState.error}</span>
                            <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setProcessingState(prev => ({ ...prev, error: null }))}>
                                <X className="w-5 h-5 text-red-500" />
                            </button>
                        </div>
                    )}

                    {activeStudy ? (
                        processingState.isLoading ? (
                            <div className="flex items-center justify-center h-full min-h-[500px]">
                                <ProcessingStatus step={processingState.step} size="large" mode={activeStudy.mode} isBook={activeStudy.isBook} />
                            </div>
                        ) : (
                            activeStudy.isBook && !activeStudy.guide ? (
                                <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
                                    <div className="text-center mb-8">
                                        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-orange-200">
                                            <BookOpen className="w-10 h-10" />
                                        </div>
                                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Configurar Resumo do Livro</h2>
                                        <p className="text-gray-500 max-w-md mx-auto">Selecione o nível de profundidade que deseja para a análise desta obra.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full px-4">
                                        <button onClick={() => updateStudyMode(activeStudy.id, StudyMode.SURVIVAL)} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${activeStudy.mode === StudyMode.SURVIVAL ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm text-orange-500"><BatteryCharging className="w-6 h-6" /></div>
                                                <h3 className="font-bold text-gray-900">Sobrevivência</h3>
                                            </div>
                                            <p className="text-xs text-gray-600 leading-relaxed mb-2 font-semibold">Foco Absoluto (20/80)</p>
                                            <p className="text-xs text-gray-500 leading-relaxed">Analisa a obra inteira de uma vez para extrair apenas a tese central e os pilares globais.</p>
                                        </button>

                                        <button onClick={() => updateStudyMode(activeStudy.id, StudyMode.NORMAL)} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${activeStudy.mode === StudyMode.NORMAL ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm text-orange-500"><Activity className="w-6 h-6" /></div>
                                                <h3 className="font-bold text-gray-900">Normal</h3>
                                            </div>
                                            <p className="text-xs text-gray-600 leading-relaxed mb-2 font-semibold">Capítulo a Capítulo</p>
                                            <p className="text-xs text-gray-500 leading-relaxed">Extrai os conceitos chave e a aplicação prática de cada parte.</p>
                                        </button>

                                        <button onClick={() => updateStudyMode(activeStudy.id, StudyMode.HARD)} className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${activeStudy.mode === StudyMode.HARD ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm text-orange-500"><Rocket className="w-6 h-6" /></div>
                                                <h3 className="font-bold text-gray-900">Hard</h3>
                                            </div>
                                            <p className="text-xs text-gray-600 leading-relaxed mb-2 font-semibold">Deep Dive (Profundo)</p>
                                            <p className="text-xs text-gray-500 leading-relaxed">Análise profunda e hierárquica.</p>
                                        </button>
                                    </div>

                                    <button onClick={handleGenerateGuide} className="mt-8 bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-200 hover:bg-orange-600 hover:-translate-y-1 transition-all flex items-center gap-2">
                                        <Play className="w-5 h-5 fill-current" />
                                        Gerar Resumo do Livro
                                    </button>
                                </div>
                            ) : (
                                <div className="max-w-5xl mx-auto space-y-6">
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                        <button onClick={() => setActiveTab('sources')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'sources' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}><UploadCloud className="w-4 h-4" /> Fontes</button>
                                        <button onClick={() => setActiveTab('guide')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'guide' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}><FileText className="w-4 h-4" /> Roteiro</button>
                                        {!isParetoStudy && (
                                            <>
                                                <button onClick={() => setActiveTab('slides')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'slides' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}><Monitor className="w-4 h-4" /> Slides</button>
                                                <button onClick={() => setActiveTab('quiz')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'quiz' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}>{activeStudy.quiz ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Quiz</button>
                                                <button onClick={() => setActiveTab('flashcards')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}>{activeStudy.flashcards ? <Layers className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Flashcards</button>
                                                {/* NOVAS ABAS */}
                                                <button onClick={() => setActiveTab('map')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}><Zap className="w-4 h-4" /> Mapa Mental</button>
                                                <button onClick={() => setActiveTab('connections')} disabled={!activeStudy.guide} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'connections' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50'}`}><Globe className="w-4 h-4" /> Conexões</button>
                                            </>
                                        )}
                                    </div>

                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        {activeTab === 'sources' && (
                                            <div className="space-y-6">
                                                {/* ÁREA DE INPUT: Só mostra se NÃO for Pareto COM fonte já adicionada */}
                                                {(!isParetoStudy || activeStudy.sources.length === 0) ? (
                                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-indigo-500" /> Adicionar Conteúdo</h2>
                                                        <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-1.5 rounded-xl w-full">
                                                            <button onClick={() => setInputType(InputType.TEXT)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.TEXT ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Texto</button>
                                                            <button onClick={() => setInputType(InputType.PDF)} className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.PDF ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>PDF / E-book</button>
                                                            <button onClick={() => setInputType(InputType.VIDEO)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.VIDEO ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Vídeo</button>
                                                            <button onClick={() => setInputType(InputType.IMAGE)} className={`flex-1 min-w-[100px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.IMAGE ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Img/Caderno</button>
                                                            <button onClick={() => setInputType(InputType.URL)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.URL ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Link</button>
                                                            <button onClick={() => setInputType(InputType.DOI)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-bold transition-all ${inputType === InputType.DOI ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>DOI/Artigo</button>
                                                            <button onClick={() => setShowSearchModal(true)} className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-bold transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2`}><Globe className="w-4 h-4" /> Pesquisar Web</button>
                                                        </div>
                                                        {inputType === InputType.URL && (
                                                            <div className="mb-4 bg-green-50 text-green-800 p-3 rounded-lg text-xs flex items-start gap-2 border border-green-100">
                                                                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                                <p><strong>✅ Links suportados:</strong> YouTube, PDFs online, sites e artigos. A IA extrai e analisa o conteúdo automaticamente. Para vídeos privados, certifique-se de estar logado.</p>
                                                            </div>
                                                        )}
                                                        <div className="space-y-4">
                                                            {inputType === InputType.TEXT || inputType === InputType.DOI || inputType === InputType.URL ? (
                                                                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-sans text-sm" placeholder={inputType === InputType.URL ? "Cole o link aqui..." : inputType === InputType.DOI ? "Ex: 10.1038/s41586-020-2649-2" : "Cole suas anotações ou texto aqui..."} />
                                                            ) : (
                                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept={inputType === InputType.PDF ? ".pdf,.epub,.mobi" : inputType === InputType.VIDEO ? "video/*,audio/*" : "image/*"} />
                                                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                                                        {selectedFile ? (<><FileText className="w-8 h-8 text-indigo-500" /><span className="font-medium text-gray-900">{selectedFile.name}</span><span className="text-xs">Clique para trocar</span></>) : (<><UploadCloud className="w-8 h-8" /><span className="font-medium">Clique ou arraste o arquivo aqui</span><span className="text-xs">Suporta {inputType === InputType.PDF ? 'PDF, EPUB, MOBI' : inputType === InputType.VIDEO ? 'Vídeo/Áudio' : 'Imagens (Cadernos/Lousas)'}</span></>)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <button onClick={addSourceToStudy} disabled={(!inputText && !selectedFile)} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed">Adicionar à Lista</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* CARD DE ARQUIVO PRONTO (Modo Pareto) */
                                                    <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-center animate-in fade-in">
                                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                                        <h3 className="text-lg font-bold text-green-800">Arquivo Carregado</h3>
                                                        <p className="text-green-700">O Modo Pareto usa apenas uma fonte principal.</p>
                                                    </div>
                                                )}

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
                                                                            <div className="flex items-center gap-2">
                                                                                <h3 className="font-bold text-gray-800 truncate cursor-pointer hover:text-indigo-600 transition-colors" title="Clique para visualizar" onClick={() => setPreviewSource(source)}>{source.name}</h3>
                                                                                {/* Esconde botão renomear em Pareto */}
                                                                                {!isParetoStudy && <button onClick={() => handleStartRenamingSource(source)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-opacity" title="Renomear Fonte"><Edit className="w-3 h-3" /></button>}
                                                                            </div>
                                                                        )}
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <button onClick={() => handleSetPrimarySource(source.id)} className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 border ${source.isPrimary ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
                                                                                <Sparkles className={`w-3 h-3 ${source.isPrimary ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
                                                                                {source.isPrimary ? 'Fonte Principal' : 'Complementar'}
                                                                            </button>
                                                                            <span className="text-xs text-gray-300">|</span>
                                                                            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">{source.type} • {new Date(source.dateAdded).toLocaleTimeString()}</span>
                                                                            <button onClick={() => setPreviewSource(source)} className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors"><Eye className="w-3 h-3" /> Ver</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {/* Esconde lixeira em Pareto */}
                                                                {!isParetoStudy && <button onClick={() => removeSource(source.id)} className="text-gray-400 hover:text-red-500 p-2 ml-2"><Trash className="w-5 h-5" /></button>}
                                                            </div>
                                                        ))}

                                                        {!activeStudy.isBook && (
                                                            <div className="flex flex-col gap-4 justify-end pt-4 border-t border-gray-100 mt-4">
                                                                <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
                                                                    {/* Seleção de Modo escondida se já estamos em Pareto (assumindo que não troca) ou apenas travada? 
                                                                        O usuário disse "unica opcao é voltar". Se eu deixar trocar de modo, ele sai da restrição.
                                                                        Vou manter visível, mas se ele mudar pra NORMAL, as opções voltam. 
                                                                        Mas se ele começou como Pareto, melhor manter. 
                                                                        Vou deixar visível por enquanto.
                                                                    */}
                                                                    <Settings className="w-4 h-4 text-gray-400" />
                                                                    <span className="font-bold">Modo:</span>
                                                                    <select value={activeStudy.mode} onChange={(e) => updateStudyMode(activeStudy.id, e.target.value as StudyMode)} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                                                                        <option value={StudyMode.SURVIVAL}>Sobrevivência</option>
                                                                        <option value={StudyMode.NORMAL}>Normal</option>
                                                                        <option value={StudyMode.HARD}>Hard</option>
                                                                        <option value={StudyMode.PARETO}>Pareto 80/20</option>
                                                                    </select>
                                                                </div>

                                                                <button onClick={handleGenerateGuide} className={`group relative text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-3 overflow-hidden w-full ${isParetoStudy
                                                                    ? 'bg-gradient-to-r from-red-600 to-red-500 hover:shadow-red-200'
                                                                    : activeStudy.isBook
                                                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:shadow-orange-200'
                                                                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200'
                                                                    }`}>
                                                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                                                    <GenerateIcon className="w-8 h-8 animate-pulse" />
                                                                    <span className="relative">{isParetoStudy ? 'Gerar Resumo 80/20' : 'Gerar Roteiro NeuroStudy'}</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'guide' && !processingState.isLoading && activeStudy.guide && (
                                            <ResultsView
                                                guide={activeStudy.guide}
                                                onReset={() => setActiveTab('sources')}
                                                onGenerateQuiz={() => setActiveTab('quiz')}
                                                onGoToFlashcards={() => setActiveTab('flashcards')}
                                                onUpdateGuide={(g) => updateStudyGuide(activeStudy.id, g)}
                                                isParetoOnly={activeStudy.mode === StudyMode.PARETO}
                                                onScheduleReview={() => handleInitialSchedule(activeStudy.id)}
                                                isReviewScheduled={!!activeStudy.nextReviewDate}
                                                onOpenSubscription={() => setShowSubscriptionModal(true)}
                                            />
                                        )}

                                        {activeTab === 'slides' && !processingState.isLoading && (<div className="space-y-6">{activeStudy.slides ? (<SlidesView slides={activeStudy.slides} onUpdateSlides={(newSlides) => setStudies(prev => prev.map(s => s.id === activeStudyId ? { ...s, slides: newSlides } : s))} />) : (<div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"><Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-bold text-gray-700 mb-2">Slides de Aula</h3><p className="text-gray-500 mb-6 max-w-md mx-auto">Transforme o roteiro em uma apresentação estruturada.</p><button onClick={handleGenerateSlides} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Gerar Slides com IA</button></div>)}</div>)}
                                        {activeTab === 'quiz' && !processingState.isLoading && (<div className="space-y-6">{(activeStudy.quiz || activeStudy.guide) ? (<QuizView questions={activeStudy.quiz || []} onGenerate={handleGenerateQuiz} onClear={handleClearQuiz} />) : (<div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"><CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-bold text-gray-700 mb-2">Quiz de Recuperação Ativa</h3><p className="text-gray-500 mb-6 max-w-md mx-auto">Teste seu conhecimento para fortalecer as conexões neurais.</p><div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200"><Lock className="w-4 h-4" /> Gere o Roteiro primeiro</div></div>)}</div>)}
                                        {activeTab === 'flashcards' && !processingState.isLoading && (<div className="space-y-6">{(activeStudy.flashcards || activeStudy.guide) ? (<FlashcardsView cards={activeStudy.flashcards || []} onGenerate={handleGenerateFlashcards} />) : (<div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed"><Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-bold text-gray-700 mb-2">Flashcards</h3><p className="text-gray-500 mb-6 max-w-md mx-auto">Pratique a recuperação ativa com cartões.</p><div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold border border-yellow-200"><Lock className="w-4 h-4" /> Gere o Roteiro primeiro</div></div>)}</div>)}

                                        {/* NOVAS VIEWS MAP E CONNECTIONS */}
                                        {activeTab === 'map' && !processingState.isLoading && activeStudy.guide && (
                                            <MindMapView guide={activeStudy.guide} onUpdateGuide={(g) => updateStudyGuide(activeStudy.id, g)} />
                                        )}
                                        {activeTab === 'connections' && !processingState.isLoading && activeStudy.guide && (
                                            <ConnectionsView guide={activeStudy.guide} onUpdateGuide={(g) => updateStudyGuide(activeStudy.id, g)} />
                                        )}
                                    </div>
                                </div>
                            ))
                    ) : (
                        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 items-center justify-center animate-in fade-in slide-in-from-bottom-4">
                            <div className="max-w-4xl mx-auto w-full px-6 py-4 space-y-6">
                                <div className="text-center">
                                    <img src="/logo.png" alt="NeuroStudy" className="w-16 h-16 mx-auto mb-3" />
                                    <h2 className="text-3xl font-bold text-gray-900">Novo Estudo</h2>
                                    <p className="text-gray-500">Escolha o nível de profundidade e sua fonte para começar.</p>
                                </div>
                                <div className="max-w-md mx-auto">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do estudo (opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Anatomia do Sistema Nervoso"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        id="study-name-input"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button onClick={() => setSelectedMode(StudyMode.SURVIVAL)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.SURVIVAL ? 'border-green-500 bg-green-50 shadow-md ring-1 ring-green-200' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}><div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center text-green-600"><BatteryCharging className="w-6 h-6" /></div><div><span className="block font-bold text-gray-900">Sobrevivência</span><span className="text-xs text-gray-500">Apenas o essencial. Rápido e direto.</span></div></button>
                                    <button onClick={() => setSelectedMode(StudyMode.NORMAL)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.NORMAL ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'}`}><div className="bg-indigo-100 w-10 h-10 rounded-lg flex items-center justify-center text-indigo-600"><Activity className="w-6 h-6" /></div><div><span className="block font-bold text-gray-900">Normal</span><span className="text-xs text-gray-500">Equilíbrio ideal entre teoria e prática.</span></div></button>
                                    <button onClick={() => setSelectedMode(StudyMode.HARD)} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2 text-left ${selectedMode === StudyMode.HARD ? 'border-purple-500 bg-purple-50 shadow-md ring-1 ring-purple-200' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'}`}><div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center text-purple-600"><Rocket className="w-6 h-6" /></div><div><span className="block font-bold text-gray-900">Hard</span><span className="text-xs text-gray-500">Profundidade máxima e detalhes.</span></div></button>
                                </div>
                                <div className="pt-4">
                                    <button onClick={handleStartSession} className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2">Escolher fontes</button>
                                    <p className="text-center text-gray-400 text-xs mt-2">Você poderá adicionar PDFs, Vídeos e Textos na próxima etapa.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {settings.pomodoro.showWidget && (
                    <PomodoroTimer
                        focusMinutes={settings.pomodoro.focusMinutes}
                        breakMinutes={settings.pomodoro.breakMinutes}
                        autoStartBreak={settings.pomodoro.autoStartBreak}
                        enableAlerts={settings.notifications.pomodoroAlerts}
                        soundEnabled={settings.notifications.soundEnabled}
                    />
                )}
                <ChatWidget studyGuide={activeStudy?.guide || null} />
                {showMethodologyModal && <MethodologyModal onClose={() => setShowMethodologyModal(false)} />}
                {previewSource && <SourcePreviewModal source={previewSource} onClose={() => setPreviewSource(null)} />}
                {showReviewScheduler && activeStudy && (
                    <ReviewSchedulerModal
                        studyTitle={activeStudy.title}
                        onClose={() => setShowReviewScheduler(false)}
                        onSchedule={handleScheduleReview}
                    />
                )}
                {showSearchModal && (
                    <SearchResourcesModal
                        onClose={() => setShowSearchModal(false)}
                        onAddSource={handleAddSearchSource}
                        onOpenSubscription={() => setShowSubscriptionModal(true)}
                    />
                )}
                {showOnboarding && (
                    <OnboardingModal
                        onComplete={() => { setIsOnboardingComplete(true); setShowOnboarding(false); }}
                        onCreateStudy={handleOnboardingCreateStudy}
                    />
                )}
                {showSettingsModal && (
                    <SettingsModal
                        isOpen={showSettingsModal}
                        onClose={() => setShowSettingsModal(false)}
                        initialTab={initialSettingsTab}
                    />
                )}
            </div>

            {/* Subscription Modal - Rendered OUTSIDE main container to avoid stacking context issues */}
            {showSubscriptionModal && (
                <SubscriptionModal
                    isOpen={showSubscriptionModal}
                    onClose={() => setShowSubscriptionModal(false)}
                />
            )}
        </div>
    );
}

export function App() {
    return (
        <AuthProvider>
            <SettingsProvider>
                <AppContent />
            </SettingsProvider>
        </AuthProvider>
    );
}
