import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, Plus, X, Globe, Loader2, HelpCircle, Shield, Crown } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { InputType } from '../types';
import { searchPubMed } from '../services/pubmedService';
import { getProfile, getPreferredSource } from '../services/userProfileService';
import { canPerformAction, LimitReason } from '../services/usageLimits';
import { supabase } from '../services/supabase';
import { UsageLimitError, isUsageLimitError } from '../services/geminiService';

// Simple markdown parser for Deep Research output
const parseSimpleMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
        // Parse bold **text**
        let parsed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Parse italic *text* (but not bullets)
        parsed = parsed.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

        // Check if line is a bullet point
        const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
        const cleanLine = isBullet ? parsed.replace(/^[\s]*[\*\-]\s/, '') : parsed;

        if (isBullet) {
            return (
                <li key={idx} className="ml-4 mb-1" dangerouslySetInnerHTML={{ __html: cleanLine }} />
            );
        }
        return (
            <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: parsed }} />
        );
    });
};

const getAuthHeaders = async () => {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const postApi = async <T,>(path: string, body: unknown): Promise<T> => {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders
        },
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 402 || response.status === 429) {
            throw new UsageLimitError(
                payload.reason || 'monthly_limit',
                payload.message || 'Limite atingido.',
                payload.actions || [],
                response.status
            );
        }
        throw new Error(payload.message || 'Erro na requisicao.');
    }
    return payload as T;
};

interface SearchResult {
    id: string;
    title: string;
    author: string;
    description: string;
    url: string;
    type: InputType;
    thumbnail?: string;
    reliabilityScore?: number; // 1 a 5 (5 é o melhor)
    reliabilityLabel?: string;
    isGuideline?: boolean;
}

interface SearchResourcesModalProps {
    onClose: () => void;
    onAddSource: (name: string, content: string, type: InputType) => void;
    onOpenSubscription: () => void;
    onUsageLimit?: (reason: LimitReason) => void;
}

// COMPONENTE VISUAL: Pirâmide de Evidência Interativa
const EvidencePyramid = ({ score, isGuideline }: { score: number, isGuideline?: boolean }) => {
    // Dados de cada nível da pirâmide
    const levels = [
        { level: 5, name: 'Meta-análise', fullName: 'Meta-análise / Revisão Sistemática', tool: 'AMSTAR 2, ROBIS', color: '#059669' },
        { level: 4, name: 'RCT', fullName: 'Ensaio Clínico Randomizado', tool: 'RoB 2', color: '#22c55e' },
        { level: 3, name: 'Coorte', fullName: 'Estudo de Coorte / Longitudinal', tool: 'NOS, ROBINS-I', color: '#eab308' },
        { level: 2, name: 'Caso-Controle', fullName: 'Estudo Caso-Controle', tool: 'NOS', color: '#f97316' },
        { level: 1, name: 'Observacional', fullName: 'Observacional / Série de Casos / Opinião', tool: '-', color: '#ef4444' },
    ];

    const currentLevel = levels.find(l => l.level === score) || levels[4];
    const guidelineTooltip = 'Diretriz clínica oficial - Máxima autoridade. Avaliação: AGREE II';

    return (
        <div className="flex items-center gap-2">
            {/* Mini Pirâmide SVG */}
            <div className="relative group cursor-pointer" title={isGuideline ? guidelineTooltip : `${currentLevel.fullName}\nAvaliação: ${currentLevel.tool}`}>
                <svg width="40" height="36" viewBox="0 0 100 90" className="drop-shadow-sm">
                    {/* Nível 5 - Topo */}
                    <polygon
                        points="50,5 62,22 38,22"
                        fill={score >= 5 || isGuideline ? levels[0].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* Nível 4 */}
                    <polygon
                        points="38,22 62,22 70,38 30,38"
                        fill={score >= 4 || isGuideline ? levels[1].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* Nível 3 */}
                    <polygon
                        points="30,38 70,38 78,54 22,54"
                        fill={score >= 3 ? levels[2].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* Nível 2 */}
                    <polygon
                        points="22,54 78,54 86,70 14,70"
                        fill={score >= 2 ? levels[3].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* Nível 1 - Base */}
                    <polygon
                        points="14,70 86,70 95,88 5,88"
                        fill={score >= 1 ? levels[4].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* Seta indicando "melhor" */}
                    <path d="M96,85 L96,10 L92,18 M96,10 L100,18" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                </svg>

                {/* Tooltip expandido ao hover */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl">
                    <div className="font-bold text-xs mb-1">{isGuideline ? '🏛️ Guideline' : `📊 ${currentLevel.name}`}</div>
                    <div className="text-gray-300 mb-1">{isGuideline ? 'Diretriz clínica oficial' : currentLevel.fullName}</div>
                    <div className="text-gray-400 border-t border-gray-700 pt-1 mt-1">
                        Ferramenta: {isGuideline ? 'AGREE II' : currentLevel.tool}
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                </div>
            </div>

            {/* Label */}
            <div className="flex flex-col max-w-[60px] overflow-hidden">
                <span className={`text-[9px] font-bold truncate ${isGuideline ? 'text-purple-700' : score >= 4 ? 'text-emerald-700' : score >= 3 ? 'text-yellow-700' : 'text-gray-600'}`}>
                    {isGuideline ? 'Guideline' : currentLevel.name}
                </span>
                <span className="text-[8px] text-gray-400">
                    Nível {score}/5
                </span>
            </div>
        </div>
    );
};

type SourceMode = 'auto' | 'pubmed' | 'openalex' | 'grounding';

export const SearchResourcesModal: React.FC<SearchResourcesModalProps> = ({ onClose, onAddSource, onOpenSubscription, onUsageLimit }) => {
    const { isPaid, planName, usage, isAdmin } = useAuth();
    const { settings } = useSettings();
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'book' | 'article' | 'web'>('article');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'GUIDELINE' | 'META' | 'RCT'>('ALL'); // Filtro de Tipo de Estudo
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Seletor de fonte (auto, pubmed, openalex, grounding)
    const [sourceMode, setSourceMode] = useState<SourceMode>('auto');
    const sourceOptions: { value: SourceMode; label: string }[] = [
        { value: 'auto', label: 'Automatico (recomendado)' },
        { value: 'pubmed', label: '🏥 PubMed' },
        { value: 'openalex', label: 'OpenAlex' },
        { value: 'grounding', label: 'Web/Geral' }
    ];

    // Controle do Tutorial
    const [showTutorial, setShowTutorial] = useState(false);

    // Estado de Tradução
    const [translating, setTranslating] = useState(false);
    const [translatedQuery, setTranslatedQuery] = useState<string | null>(null);

    // Estado para avaliação de qualidade AMSTAR 2
    const [qualityAssessments, setQualityAssessments] = useState<Record<string, { score: number, summary: string, loading: boolean }>>({});

    // Função para traduzir PT → EN usando MyMemory API (gratuita)
    const handleTranslate = async () => {
        if (!query.trim()) return;

        setTranslating(true);
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=pt|en`);
            const data = await response.json();
            if (data.responseStatus === 200 && data.responseData?.translatedText) {
                const translated = data.responseData.translatedText;
                setTranslatedQuery(translated);
                setQuery(translated); // Substitui o texto pelo traduzido
            } else {
                alert('Não foi possível traduzir. Tente novamente.');
            }
        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            }
            console.error('Erro ao traduzir:', error);
            alert('Erro na tradução. Verifique sua conexão.');
        } finally {
            setTranslating(false);
        }
    };

    // === DEEP RESEARCH ===
    const [deepResearchMode, setDeepResearchMode] = useState(false);
    const [deepResearchLoading, setDeepResearchLoading] = useState(false);
    const [deepResearchInsight, setDeepResearchInsight] = useState<string | null>(null);

    // === AVALIAÇÃO DE QUALIDADE AMSTAR 2 ===
    const handleQualityAssessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPaid) {
            onOpenSubscription();
            return;
        }
        // Marca como loading
        setQualityAssessments(prev => ({
            ...prev,
            [itemId]: { score: 0, summary: '', loading: true }
        }));

        try {

            const prompt = `Você é um especialista em avaliação de evidências científicas. Analise esta meta-análise/revisão sistemática usando critérios simplificados do AMSTAR 2.

TÍTULO: ${title}
RESUMO: ${abstractText || 'Não disponível'}

Baseado nas informações disponíveis, avalie de 0-16 pontos considerando:
1. Protocolo registrado previamente?
2. Busca abrangente na literatura?
3. Justificativa para exclusão de estudos?
4. Avaliação de risco de viés?
5. Métodos estatísticos apropriados?
6. Heterogeneidade discutida?
7. Conflitos de interesse declarados?

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [número de 0 a 16]
QUALIDADE: [Alta/Moderada/Baixa/Criticamente Baixa]
RESUMO: [1 frase sobre a qualidade metodológica]`;

            const { result } = await postApi<{ result: string }>('/api/ai/web-research', {
                mode: 'quality',
                assessmentType: 'amstar',
                title,
                abstractText
            });
            const text = result || '';

            // Parse da resposta
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 8;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'Avaliação concluída';

            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score, summary, loading: false }
            }));

        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            }
            console.error('Erro na avaliação:', error);
            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score: -1, summary: 'Erro na avaliação', loading: false }
            }));
        }
    };

    // === AVALIAÇÃO RoB 2 (Risk of Bias) PARA RCTs ===
    const handleRoB2Assessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPaid) {
            onOpenSubscription();
            return;
        }
        setQualityAssessments(prev => ({
            ...prev,
            [itemId]: { score: 0, summary: '', loading: true }
        }));

        try {

            const prompt = `Você é um especialista em avaliação de evidências científicas. Analise este Ensaio Clínico Randomizado (RCT) usando os domínios do RoB 2 (Risk of Bias 2).

TÍTULO: ${title}
RESUMO: ${abstractText || 'Não disponível'}

Avalie os 5 domínios do RoB 2:
1. Randomização adequada?
2. Desvios das intervenções pretendidas?
3. Dados de desfecho faltantes?
4. Mensuração do desfecho adequada?
5. Seleção dos resultados reportados?

RESPONDA EXATAMENTE NESTE FORMATO:
RISCO: [Baixo/Algumas Preocupações/Alto]
SCORE: [número de 1 a 5, onde 5=baixo risco, 1=alto risco]
RESUMO: [1 frase sobre o risco de viés do estudo]`;

            const { result } = await postApi<{ result: string }>('/api/ai/web-research', {
                mode: 'quality',
                assessmentType: 'rob2',
                title,
                abstractText
            });
            const text = result || '';

            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 3;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'Avaliação concluída';

            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score, summary, loading: false }
            }));

        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            }
            console.error('Erro na avaliação RoB 2:', error);
            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score: -1, summary: 'Erro na avaliação', loading: false }
            }));
        }
    };

    // === AVALIAÇÃO NOS (Newcastle-Ottawa Scale) PARA COORTE/CASO-CONTROLE ===
    const handleNOSAssessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPaid) {
            onOpenSubscription();
            return;
        }
        setQualityAssessments(prev => ({ ...prev, [itemId]: { score: 0, summary: '', loading: true } }));

        try {

            const prompt = `Você é um especialista em avaliação de evidências. Analise este estudo de coorte/caso-controle usando a Newcastle-Ottawa Scale (NOS).

TÍTULO: ${title}
RESUMO: ${abstractText || 'Não disponível'}

Avalie os 3 domínios do NOS (total 9 estrelas):
1. SELEÇÃO (4 estrelas): representatividade, seleção controles, definição exposição
2. COMPARABILIDADE (2 estrelas): controle de confundidores
3. DESFECHO (3 estrelas): avaliação, seguimento adequado

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [número de 0 a 9]
QUALIDADE: [Alta (7-9)/Moderada (4-6)/Baixa (0-3)]
RESUMO: [1 frase sobre a qualidade metodológica]`;

            const { result } = await postApi<{ result: string }>('/api/ai/web-research', {
                mode: 'quality',
                assessmentType: 'nos',
                title,
                abstractText
            });
            const text = result || '';
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'Avaliação concluída';

            setQualityAssessments(prev => ({ ...prev, [itemId]: { score, summary, loading: false } }));
        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            }
            console.error('Erro NOS:', error);
            setQualityAssessments(prev => ({ ...prev, [itemId]: { score: -1, summary: 'Erro', loading: false } }));
        }
    };

    // === AVALIAÇÃO AGREE II PARA GUIDELINES ===
    const handleAGREEIIAssessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPaid) {
            onOpenSubscription();
            return;
        }
        setQualityAssessments(prev => ({ ...prev, [itemId]: { score: 0, summary: '', loading: true } }));

        try {

            const prompt = `Você é um especialista em avaliação de guidelines clínicas. Analise esta diretriz usando critérios do AGREE II.

TÍTULO: ${title}
RESUMO: ${abstractText || 'Não disponível'}

Avalie os 6 domínios do AGREE II:
1. Escopo e Propósito
2. Envolvimento das Partes Interessadas
3. Rigor do Desenvolvimento
4. Clareza da Apresentação
5. Aplicabilidade
6. Independência Editorial

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [número de 1 a 7, onde 7=excelente]
RECOMENDAÇÃO: [Fortemente Recomendada/Recomendada com Modificações/Não Recomendada]
RESUMO: [1 frase sobre a qualidade da diretriz]`;

            const { result } = await postApi<{ result: string }>('/api/ai/web-research', {
                mode: 'quality',
                assessmentType: 'agree',
                title,
                abstractText
            });
            const text = result || '';
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'Avaliação concluída';

            setQualityAssessments(prev => ({ ...prev, [itemId]: { score, summary, loading: false } }));
        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            }
            console.error('Erro AGREE II:', error);
            setQualityAssessments(prev => ({ ...prev, [itemId]: { score: -1, summary: 'Erro', loading: false } }));
        }
    };

    const handleDeepResearch = async () => {
        if (!isPaid) {
            onOpenSubscription();
            return;
        }
        if (!query.trim()) return;
        const searchCheck = canPerformAction(planName, usage, [], 'web_search', { isAdmin });
        if (!searchCheck.allowed) {
            onUsageLimit?.(searchCheck.reason || 'web_search_limit');
            return;
        }

        setDeepResearchLoading(true);
        setDeepResearchInsight(null);
        setHasSearched(true);
        setResults([]);

        try {
            // 1. Primeiro faz a busca normal para pegar artigos
            const searchResponse = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=20&sort=cited_by_count:desc`);
            const searchData = await searchResponse.json();

            if (!searchData.results || searchData.results.length === 0) {
                setDeepResearchInsight('Nenhum resultado encontrado para análise. Tente outro termo.');
                return;
            }

            // 2. Formata os artigos para análise
            const articlesForAnalysis = searchData.results.slice(0, 10).map((item: any) => ({
                title: item.display_name || item.title,
                year: item.publication_year,
                citations: item.cited_by_count,
                abstract: item.abstract_inverted_index ? 'Possui abstract' : 'Sem abstract'
            }));

            // 3. Envia para o backend analisar
            const prompt = `Você é um pesquisador científico experiente. Analise estes artigos sobre "${query}" e forneça:

ARTIGOS ENCONTRADOS:
${JSON.stringify(articlesForAnalysis, null, 2)}

TAREFA:
1. Resuma em 2-3 frases o que a literatura científica diz sobre este tema.
2. Identifique os 3 principais consensos ou descobertas.
3. Sugira 2-3 termos de busca mais específicos (em inglês) para encontrar estudos melhores.
4. Indique se há alguma lacuna ou controvérsia no tema.

Responda de forma concisa e útil para um estudante. Use bullet points. Máximo 200 palavras.`;

            const { insight } = await postApi<{ insight: string }>('/api/ai/web-research', {
                mode: 'deep_research',
                query,
                articles: articlesForAnalysis
            });
            setDeepResearchInsight(insight || '');

            // 4. Também popula os resultados normais
            const formatted = searchData.results.map((item: any) => {
                const reliability = calculateReliability(item.display_name || item.title, '', 'openalex');
                return {
                    id: item.id,
                    title: item.display_name || item.title,
                    author: item.authorships?.[0]?.author?.display_name || 'Pesquisador',
                    description: `Publicado em: ${item.publication_year}. Citações: ${item.cited_by_count}.`,
                    url: item.doi || item.primary_location?.landing_page_url || `https://openalex.org/${item.id}`,
                    type: InputType.DOI,
                    reliabilityScore: reliability.score,
                    reliabilityLabel: reliability.label,
                    isGuideline: reliability.isGuideline
                };
            });

            const sorted = formatted.sort((a: any, b: any) => {
                if (a.isGuideline && !b.isGuideline) return -1;
                if (!a.isGuideline && b.isGuideline) return 1;
                return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
            });

            setResults(sorted);
        } catch (error) {
            if (isUsageLimitError(error)) {
                onUsageLimit?.(error.reason as LimitReason);
            }
            console.error('Erro no Deep Research:', error);
            setDeepResearchInsight('Erro ao executar Deep Research. Tente novamente.');
        } finally {
            setDeepResearchLoading(false);
        }
    };

    useEffect(() => {
        const hideTutorial = localStorage.getItem('neurostudy_hide_search_tutorial');
        if (!hideTutorial) {
            setShowTutorial(true);
        }
    }, []);

    // Aplica preferências do Settings (fonte padrão)
    useEffect(() => {
        if (settings?.search?.defaultSource) {
            setSourceMode(settings.search.defaultSource as SourceMode);
        }
    }, [settings?.search?.defaultSource]);

    // AUTO-BUSCA AO TROCAR DE ABA
    useEffect(() => {
        if (query.trim() && hasSearched) {
            handleSearch();
        }
    }, [activeTab]);

    const handleCloseTutorial = (dontShowAgain: boolean) => {
        setShowTutorial(false);
        if (dontShowAgain) {
            localStorage.setItem('neurostudy_hide_search_tutorial', 'true');
        }
    };

    // --- LÓGICA DE HIERARQUIA DE EVIDÊNCIA ---
    const calculateReliability = (title: string, abstract: string = '', source: string = ''): { score: number, label: string, isGuideline: boolean } => {
        const text = (title + ' ' + abstract).toLowerCase();

        // Verifica se área do usuário é saúde
        const profile = getProfile();
        const isHealthArea = profile?.studyArea === 'health';

        // 1. GUIDELINES (TOPO) - Só para área de saúde
        if (isHealthArea && (text.includes('guideline') || text.includes('diretriz') || text.includes('consensus') || text.includes('recommendation'))) {
            return { score: 5, label: 'Diretriz Clínica (Guideline)', isGuideline: true };
        }
        // 2. META-ANÁLISE / REVISÃO SISTEMÁTICA
        if (text.includes('meta-analysis') || text.includes('systematic review') || text.includes('revisão sistemática')) {
            return { score: 5, label: 'Revisão Sistemática / Meta-análise', isGuideline: false };
        }
        // 3. ENSAIO CLÍNICO RANDOMIZADO (RCT)
        if (text.includes('randomized') || text.includes('randomizado') || text.includes('clinical trial')) {
            return { score: 4, label: 'Ensaio Clínico Randomizado (RCT)', isGuideline: false };
        }
        // 4. COORTE
        if (text.includes('cohort') || text.includes('coorte') || text.includes('longitudinal')) {
            return { score: 3, label: 'Estudo de Coorte', isGuideline: false };
        }
        // 5. CASO-CONTROLE
        if (text.includes('case-control') || text.includes('caso-controle')) {
            return { score: 2, label: 'Estudo Caso-Controle', isGuideline: false };
        }
        // 6. OUTROS
        return { score: 1, label: 'Estudo Primário / Opinião', isGuideline: false };
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        const searchCheck = canPerformAction(planName, usage, [], 'web_search', { isAdmin });
        if (!searchCheck.allowed) {
            onUsageLimit?.(searchCheck.reason || 'web_search_limit');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setFilter('ALL'); // Reseta filtro ao buscar

        try {
            if (activeTab === 'book') {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40&langRestrict=pt`);
                const data = await response.json();

                if (data.items) {
                    const formatted: SearchResult[] = data.items.map((item: any) => ({
                        id: item.id,
                        title: item.volumeInfo.title,
                        author: item.volumeInfo.authors?.join(', ') || 'Autor Desconhecido',
                        description: item.volumeInfo.description?.slice(0, 200) + '...' || 'Sem descrição.',
                        url: item.volumeInfo.previewLink || item.volumeInfo.infoLink,
                        type: InputType.URL,
                        thumbnail: item.volumeInfo.imageLinks?.thumbnail
                    }));
                    setResults(formatted);
                }

            } else if (activeTab === 'article') {
                // Determina qual fonte usar
                const effectiveSource = sourceMode === 'auto' ? getPreferredSource() : sourceMode;

                // === PUBMED ===
                if (effectiveSource === 'pubmed') {
                    const pubmedResults = await searchPubMed(query, 30);
                    const formatted: SearchResult[] = pubmedResults.map((item) => {
                        const reliability = calculateReliability(item.title, item.abstract, 'pubmed');
                        return {
                            id: item.id,
                            title: item.title,
                            author: item.authors,
                            description: `${item.journal} (${item.year})`,
                            url: item.url,
                            type: InputType.DOI,
                            reliabilityScore: reliability.score,
                            reliabilityLabel: reliability.label,
                            isGuideline: reliability.isGuideline
                        };
                    });
                    setResults(formatted);

                    // === OPENALEX ===
                } else if (effectiveSource === 'openalex') {
                    const response = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=30&sort=cited_by_count:desc`);
                    const data = await response.json();
                    if (data.results) {
                        const formatted: SearchResult[] = data.results.map((item: any) => {
                            const reliability = calculateReliability(item.display_name || item.title, '', 'openalex');
                            return {
                                id: item.id,
                                title: item.display_name || item.title,
                                author: item.authorships?.[0]?.author?.display_name || 'Pesquisador',
                                description: `Publicado em: ${item.publication_year}. Citações: ${item.cited_by_count}.`,
                                url: item.doi || `https://openalex.org/${item.id}`,
                                type: InputType.DOI,
                                reliabilityScore: reliability.score,
                                reliabilityLabel: reliability.label,
                                isGuideline: reliability.isGuideline
                            };
                        });
                        const sorted = formatted.sort((a, b) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0));
                        setResults(sorted);
                    }

                    // === IA GROUNDING ===
                } else {
                    const prompt = `Você é um assistente de pesquisa científica. Busque artigos científicos sobre: "${query}"
                
TAREFA: Encontre 10-15 artigos científicos relevantes (priorizando meta-análises, revisões sistemáticas e guidelines).

Para cada artigo encontrado, retorne um JSON com esta estrutura:
{
  "articles": [
    {
      "title": "Título do artigo",
      "author": "Primeiro autor ou organização",
      "year": 2024,
      "type": "meta-analysis" | "systematic-review" | "guideline" | "rct" | "cohort" | "other",
      "description": "Breve descrição do que o estudo descobriu (1-2 frases)",
      "url": "URL do artigo ou DOI"
    }
  ]
}

IMPORTANTE: 
- Priorize artigos de revistas científicas renomadas (Lancet, NEJM, JAMA, Cochrane, etc.)
- Inclua o DOI ou link direto sempre que possível
- Foque em estudos recentes (últimos 5-10 anos)
- Retorne APENAS o JSON, sem markdown ou explicações`;

                    try {
                        const { articles } = await postApi<{ articles: any[] }>('/api/ai/web-research', {
                            mode: 'grounding',
                            query
                        });

                        let text = JSON.stringify({ articles });

                        // Limpa e faz parse do JSON
                        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

                        try {
                            const parsed = JSON.parse(text);
                            const articles = parsed.articles || parsed;

                            if (Array.isArray(articles)) {
                                const formatted: SearchResult[] = articles.map((item: any, idx: number) => {
                                    const typeScore: Record<string, number> = {
                                        'guideline': 5,
                                        'meta-analysis': 5,
                                        'systematic-review': 5,
                                        'rct': 4,
                                        'cohort': 3,
                                        'other': 1
                                    };

                                    return {
                                        id: `grounding-${idx}-${Date.now()}`,
                                        title: item.title || 'Artigo sem título',
                                        author: item.author || 'Autor desconhecido',
                                        description: item.description || `Publicado em ${item.year || 'N/A'}`,
                                        url: item.url || item.doi || '#',
                                        type: InputType.DOI,
                                        reliabilityScore: typeScore[item.type] || 1,
                                        reliabilityLabel: item.type || 'other',
                                        isGuideline: item.type === 'guideline'
                                    };
                                });

                                // Ordena por relevância
                                const sorted = formatted.sort((a, b) => {
                                    if (a.isGuideline && !b.isGuideline) return -1;
                                    if (!a.isGuideline && b.isGuideline) return 1;
                                    return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
                                });

                                setResults(sorted);
                            }
                        } catch (parseError) {
                            console.error('Erro ao parsear resposta da IA:', parseError);
                            // Fallback para OpenAlex se falhar
                            const fallbackResponse = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=20&sort=cited_by_count:desc`);
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.results) {
                                const formatted: SearchResult[] = fallbackData.results.map((item: any) => {
                                    const reliability = calculateReliability(item.display_name || item.title, '');
                                    return {
                                        id: item.id,
                                        title: item.display_name || item.title,
                                        author: item.authorships?.[0]?.author?.display_name || 'Pesquisador',
                                        description: `Publicado em: ${item.publication_year}. Citações: ${item.cited_by_count}.`,
                                        url: item.doi || `https://openalex.org/${item.id}`,
                                        type: InputType.DOI,
                                        reliabilityScore: reliability.score,
                                        reliabilityLabel: reliability.label,
                                        isGuideline: reliability.isGuideline
                                    };
                                });
                                setResults(formatted);
                            }
                        }
                    } catch (geminiError) {
                        if (isUsageLimitError(geminiError)) {
                            onUsageLimit?.(geminiError.reason as LimitReason);
                            return;
                        }
                        console.error('Erro no grounding da IA:', geminiError);
                    }
                } // Fecha else do grounding

            } else {
                const response = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=40`);
                const data = await response.json();
                if (data.query?.search) {
                    const formatted: SearchResult[] = data.query.search.map((item: any) => ({
                        id: item.pageid.toString(),
                        title: item.title,
                        author: 'Wikipedia',
                        description: item.snippet.replace(/<[^>]*>?/gm, '') + '...',
                        url: `https://pt.wikipedia.org/?curid=${item.pageid}`,
                        type: InputType.URL
                    }));
                    setResults(formatted);
                }
            }
        } catch (error) {
            console.error("Erro na busca:", error);
        } finally {
            setLoading(false);
        }
    };

    // Lógica de Filtragem Visual
    const filteredResults = results.filter(r => {
        if (activeTab !== 'article') return true;
        if (filter === 'ALL') return true;
        if (filter === 'GUIDELINE') return r.isGuideline;
        if (filter === 'META') return r.reliabilityScore === 5 && !r.isGuideline;
        if (filter === 'RCT') return r.reliabilityScore === 4;
        return true;
    });

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">

            {/* TUTORIAL COMPLETO / GLASSMORPHISM */}
            {showTutorial && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-900 border border-indigo-500/30 shadow-2xl rounded-3xl p-6 max-w-2xl max-h-[90vh] overflow-y-auto text-white relative animate-in zoom-in duration-300">
                        <div className="absolute top-0 right-0 p-4">
                            <button onClick={() => setShowTutorial(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="flex flex-col items-center text-center space-y-5">
                            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <Globe className="w-7 h-7 text-white" />
                            </div>

                            <div>
                                <h2 className="text-xl font-bold mb-1">Guia de Pesquisa Científica</h2>
                                <p className="text-white/70 text-sm">
                                    O NeuroStudy usa as melhores bases científicas do mundo
                                </p>
                            </div>

                            {/* Cards das Fontes */}
                            <div className="grid grid-cols-3 gap-2 w-full">
                                <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3 text-left">
                                    <span className="text-green-300 font-bold text-sm flex items-center gap-1.5 mb-1">🏥 PubMed</span>
                                    <p className="text-[11px] text-green-100/80 leading-relaxed">Padrão ouro para Saúde. RCTs, Meta-análises e Guidelines.</p>
                                </div>
                                <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-left">
                                    <span className="text-blue-300 font-bold text-sm flex items-center gap-1.5 mb-1">📚 OpenAlex</span>
                                    <p className="text-[11px] text-blue-100/80 leading-relaxed">Multidisciplinar. Direito, Engenharia, Humanas.</p>
                                </div>
                                <div className="bg-purple-500/20 border border-purple-400/30 rounded-lg p-3 text-left">
                                    <span className="text-purple-300 font-bold text-sm flex items-center gap-1.5 mb-1">🌐 Web/IA</span>
                                    <p className="text-[11px] text-purple-100/80 leading-relaxed">IA com Google Search. PDFs e artigos não indexados.</p>
                                </div>
                            </div>

                            {/* Pirâmide de Evidência + Ferramentas */}
                            <div className="bg-black/30 p-4 rounded-xl w-full">
                                <p className="font-bold text-sm mb-3 text-center">📊 Entendendo a Qualidade dos Estudos</p>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Esquerda: Pirâmide Grande com Labels ao lado */}
                                    <div className="flex items-center justify-center gap-1">
                                        <svg width="100" height="110" viewBox="0 0 100 110">
                                            {/* Guideline - Estrela no topo */}
                                            <polygon points="50,5 53,12 60,12 55,17 57,24 50,20 43,24 45,17 40,12 47,12" fill="#9333ea" stroke="#fff" strokeWidth="0.5" />
                                            {/* Nível 5 - Meta-análise */}
                                            <polygon points="50,24 65,42 35,42" fill="#059669" stroke="#fff" strokeWidth="1" />
                                            {/* Nível 4 - RCT */}
                                            <polygon points="35,42 65,42 75,58 25,58" fill="#22c55e" stroke="#fff" strokeWidth="1" />
                                            {/* Nível 3 - Coorte */}
                                            <polygon points="25,58 75,58 82,74 18,74" fill="#eab308" stroke="#fff" strokeWidth="1" />
                                            {/* Nível 2 - Caso-Controle */}
                                            <polygon points="18,74 82,74 90,90 10,90" fill="#f97316" stroke="#fff" strokeWidth="1" />
                                            {/* Nível 1 - Observacional */}
                                            <polygon points="10,90 90,90 98,106 2,106" fill="#ef4444" stroke="#fff" strokeWidth="1" />
                                        </svg>
                                        {/* Labels ao lado */}
                                        <div className="text-[9px] space-y-2 text-left">
                                            <div className="flex items-center gap-1 -mt-2"><span className="text-purple-400">★</span> <span className="text-purple-300 font-bold">Guideline</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-600"></span> <span>Meta-análise</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500"></span> <span>RCT</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500"></span> <span>Coorte</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500"></span> <span>Caso-Controle</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500"></span> <span>Observacional</span></div>
                                        </div>
                                    </div>

                                    {/* Direita: Ferramentas de Avaliação */}
                                    <div className="text-left">
                                        <p className="text-[10px] text-gray-400 mb-2">Ferramentas de Avaliação</p>
                                        <div className="space-y-2 text-[10px]">
                                            <div className="bg-white/5 p-2 rounded">
                                                <p className="font-bold text-emerald-300">AMSTAR 2</p>
                                                <p className="text-gray-300">Avalia meta-análises. Score de 0-16 pontos.</p>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded">
                                                <p className="font-bold text-green-300">RoB 2 (Risk of Bias)</p>
                                                <p className="text-gray-300">Avalia RCTs. Risco: baixo, moderado ou alto.</p>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded">
                                                <p className="font-bold text-yellow-300">NOS (Newcastle-Ottawa)</p>
                                                <p className="text-gray-300">Avalia coorte e caso-controle. 0-9 estrelas.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-[10px] text-gray-400 text-center mt-3 border-t border-white/10 pt-2">
                                    ↑ Quanto mais alto na pirâmide + boa avaliação = maior confiabilidade
                                </p>
                            </div>

                            {/* Dicas de Busca */}
                            <div className="text-left bg-black/20 p-3 rounded-xl space-y-2 w-full border border-white/10">
                                <div className="flex items-start gap-3">
                                    <span className="bg-emerald-500 w-2 h-2 rounded-full shrink-0 mt-1.5"></span>
                                    <p className="text-xs"><span className="font-bold text-emerald-300">Seja Específico:</span> Use "Terapia Cognitiva Ansiedade" ao invés de "Ansiedade".</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="bg-blue-500 w-2 h-2 rounded-full shrink-0 mt-1.5"></span>
                                    <p className="text-xs"><span className="font-bold text-blue-300">Use Inglês:</span> 95% da ciência está em inglês. Use <span className="bg-white/20 px-1 py-0.5 rounded text-[10px] font-bold">🌐 PT→EN</span></p>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full pt-1">
                                <button onClick={() => handleCloseTutorial(false)} className="flex-1 py-2.5 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors">Entendi</button>
                                <button onClick={() => handleCloseTutorial(true)} className="px-4 py-2.5 bg-transparent border border-white/30 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm">Não mostrar mais</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">

                {/* Header - Compacto quando há resultados */}
                <div className={`bg-white border-b border-gray-100 flex justify-between items-center shrink-0 transition-all ${results.length > 0 ? 'p-2 px-4' : 'p-4'}`}>
                    <div className="flex items-center gap-3">
                        {results.length > 0 ? (
                            /* Versão compacta: mostra busca atual + botão nova busca */
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setResults([])}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-gray-700 transition-all"
                                >
                                    <Search className="w-4 h-4" />
                                    <span className="max-w-[200px] truncate">"{query}"</span>
                                    <span className="text-gray-400 text-xs">• Editar</span>
                                </button>
                                {/* Filtros compactos */}
                                {activeTab === 'article' && (
                                    <div className="hidden md:flex items-center gap-1">
                                        <button onClick={() => setFilter('ALL')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${filter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>Todos</button>
                                        <button onClick={() => setFilter('GUIDELINE')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${filter === 'GUIDELINE' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>Diretrizes</button>
                                        <button onClick={() => setFilter('META')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${filter === 'META' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>Meta</button>
                                        <button onClick={() => setFilter('RCT')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${filter === 'RCT' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600'}`}>RCTs</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-600" /> Pesquisar Fontes</h3>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {results.length === 0 && <button onClick={() => setShowTutorial(true)} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Como pesquisar?"><HelpCircle className="w-5 h-5" /></button>}
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                </div>

                {/* Tabs & Search - ESCONDE quando há resultados */}
                {results.length === 0 && (
                    <div className="bg-slate-50 border-b border-gray-200 shrink-0 p-6 space-y-4">
                        {results.length === 0 && (
                            <>
                                <div className="flex gap-2 justify-center">
                                    <button onClick={() => setActiveTab('article')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'article' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><FileText className="w-4 h-4" /> Artigos Científicos</button>
                                    <button onClick={() => setActiveTab('book')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><BookOpen className="w-4 h-4" /> Livros</button>
                                    <button onClick={() => setActiveTab('web')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'web' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Globe className="w-4 h-4" /> Wiki / Conceitos</button>
                                </div>

                                {/* Seletor de fonte (só para artigos) */}
                                {activeTab === 'article' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-xs text-gray-500 font-medium">Fonte:</span>
                                            {[
                                                { key: 'auto', label: '✨ Automático', color: 'indigo' },
                                                { key: 'pubmed', label: '🏥 PubMed', color: 'green' },
                                                { key: 'openalex', label: '📚 OpenAlex', color: 'blue' },
                                                { key: 'grounding', label: '🌐 Web/IA', color: 'purple' }
                                            ].map(({ key, label, color }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setSourceMode(key as any)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${sourceMode === key
                                                        ? `bg-${color}-600 text-white shadow-md`
                                                        : `bg-white border border-gray-200 text-gray-600 hover:border-${color}-300`
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Dica compacta */}
                                        {settings.search.preferPtEnHint && (
                                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-2 flex items-center justify-center gap-4 text-xs">
                                                <span className="flex items-center gap-1.5 text-indigo-700">
                                                    <Globe className="w-3.5 h-3.5" />
                                                    <span>Buscas em <b>Inglês</b> têm 10x mais resultados</span>
                                                </span>
                                                <span className="text-purple-600 bg-white px-2 py-0.5 rounded border border-purple-200 font-bold text-[11px]">
                                                    Use o botão ?? PT→EN abaixo
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        <div className="relative max-w-2xl mx-auto group">
                            <input
                                autoFocus
                                type="text"
                                placeholder={activeTab === 'article' ? "Ex: 'Anxiety treatment systematic review' (Inglês é melhor)" : "Digite o tema..."}
                                className="w-full pl-12 pr-36 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-lg shadow-sm transition-all"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setTranslatedQuery(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 group-focus-within:text-indigo-500 transition-colors" />

                            {/* Botão de Tradução PT → EN */}
                            {query.trim() && !translatedQuery && (
                                <button
                                    onClick={handleTranslate}
                                    disabled={translating}
                                    className="absolute right-28 top-2 bottom-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg transition-colors text-xs flex items-center gap-1"
                                    title="Traduzir para Inglês"
                                >
                                    {translating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>🌐 PT→EN</>
                                    )}
                                </button>
                            )}

                            {/* Indicador de que foi traduzido */}
                            {translatedQuery && (
                                <span className="absolute right-28 top-1/2 -translate-y-1/2 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                                    ✓ Traduzido
                                </span>
                            )}

                            <button
                                onClick={handleSearch}
                                disabled={loading || !query.trim()}
                                className="absolute right-2 top-2 bottom-2 px-6 bg-slate-900 hover:bg-black text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                            </button>
                        </div>

                        {/* Botão Deep Research (centralizado) - Esconde quando tem resultados */}
                        {activeTab === 'article' && results.length === 0 && (
                            <div className="flex items-center justify-center">
                                <button
                                    onClick={handleDeepResearch}
                                    disabled={deepResearchLoading}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-1 ${isPaid
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                                        : 'bg-white border-2 border-purple-100 text-purple-600 hover:border-purple-300'}`}
                                >
                                    {deepResearchLoading ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Analisando...</>
                                    ) : (
                                        <>{!isPaid && <Crown className="w-3 h-3" />} 🧠 Deep Research</>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Painel de Insights do Deep Research - Colapsável */}
                        {deepResearchInsight && (
                            <div className="group mt-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md">
                                {/* Header sempre visível */}
                                <div className="flex items-center gap-2 p-2 px-3">
                                    <div className="bg-purple-600 text-white p-1.5 rounded-lg shrink-0 text-sm">
                                        🧠
                                    </div>
                                    <span className="font-bold text-purple-800 text-xs flex-1">Análise Deep Research</span>
                                    <span className="text-[10px] text-purple-500 group-hover:hidden">Passe o mouse para expandir</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeepResearchInsight(null); }}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                {/* Conteúdo expandido no hover */}
                                <div className="max-h-0 group-hover:max-h-[250px] overflow-hidden group-hover:overflow-y-auto transition-all duration-300 px-3 pb-0 group-hover:pb-3">
                                    <div className="text-sm text-gray-700 leading-relaxed">
                                        {parseSimpleMarkdown(deepResearchInsight)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Deep Research Panel - show even with results */}
                {deepResearchInsight && results.length > 0 && (
                    <div className="group bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md">
                        <div className="flex items-center gap-2 p-2 px-4">
                            <div className="bg-purple-600 text-white p-1 rounded text-xs">🧠</div>
                            <span className="font-bold text-purple-800 text-xs flex-1">Deep Research</span>
                            <span className="text-[10px] text-purple-500 group-hover:hidden">Hover para ver</span>
                            <button onClick={() => setDeepResearchInsight(null)} className="text-gray-400 hover:text-red-500 p-1">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="max-h-0 group-hover:max-h-[200px] overflow-hidden group-hover:overflow-y-auto transition-all duration-300 px-4 pb-0 group-hover:pb-3">
                            <div className="text-xs text-gray-700 leading-relaxed">
                                {parseSimpleMarkdown(deepResearchInsight)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                    {filteredResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredResults.map((item) => (
                                <div key={item.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full group relative ${item.isGuideline ? 'border-purple-300 ring-1 ring-purple-100 bg-purple-50/20' : 'border-gray-200'}`}>

                                    {/* SELO DE GUIDELINE */}
                                    {item.isGuideline && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 tracking-wider uppercase z-10">
                                            <Shield className="w-3 h-3 fill-white" /> Recomendado
                                        </div>
                                    )}

                                    {/* Header: Autor + Barra de Evidência */}
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${activeTab === 'book' ? 'bg-orange-100 text-orange-600' : activeTab === 'article' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                {activeTab === 'book' ? <BookOpen className="w-4 h-4" /> : activeTab === 'article' ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                            </div>
                                            <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wider truncate max-w-[180px]">{item.author}</span>
                                        </div>
                                        {activeTab === 'article' && item.reliabilityScore !== undefined && (
                                            <EvidencePyramid score={item.reliabilityScore} isGuideline={item.isGuideline} />
                                        )}
                                    </div>

                                    {/* Título - mais espaço */}
                                    <h4 className="font-bold text-gray-900 leading-snug mb-2 text-sm line-clamp-3 group-hover:text-indigo-700 transition-colors" title={item.title}>{item.title}</h4>

                                    {/* Descrição */}
                                    <p className="text-xs text-gray-600 line-clamp-2 mb-2 flex-1 leading-relaxed">{item.description}</p>

                                    {/* Botão de Avaliação AMSTAR 2 (só para meta-análises) */}
                                    {activeTab === 'article' && item.reliabilityScore === 5 && !item.isGuideline && (
                                        <div className="mb-2">
                                            {qualityAssessments[item.id]?.loading ? (
                                                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg py-2 px-3">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Analisando com AMSTAR 2...
                                                </div>
                                            ) : qualityAssessments[item.id]?.score !== undefined && qualityAssessments[item.id]?.score >= 0 ? (
                                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg py-2 px-3 text-xs">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-emerald-700">🔬 AMSTAR 2</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 12 ? 'text-emerald-600' : qualityAssessments[item.id].score >= 8 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score}/16
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleQualityAssessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPaid ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPaid ? '🔬 Avaliar Qualidade (AMSTAR 2)' : <><Crown className="w-3 h-3" /> Avaliar (AMSTAR 2) - Pago</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Botão de Avaliação RoB 2 (só para RCTs) */}
                                    {activeTab === 'article' && item.reliabilityScore === 4 && (
                                        <div className="mb-2">
                                            {qualityAssessments[item.id]?.loading ? (
                                                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg py-2 px-3">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Analisando com RoB 2...
                                                </div>
                                            ) : qualityAssessments[item.id]?.score !== undefined && qualityAssessments[item.id]?.score >= 0 ? (
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg py-2 px-3 text-xs">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-blue-700">⚖️ RoB 2</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 4 ? 'text-green-600' : qualityAssessments[item.id].score >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score >= 4 ? 'Baixo' : qualityAssessments[item.id].score >= 3 ? 'Moderado' : 'Alto'} Risco
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleRoB2Assessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPaid ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPaid ? '⚖️ Avaliar Risco de Viés (RoB 2)' : <><Crown className="w-3 h-3" /> Avaliar (RoB 2) - Pago</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Botão de Avaliação NOS (Coorte e Caso-Controle) */}
                                    {activeTab === 'article' && (item.reliabilityScore === 3 || item.reliabilityScore === 2) && (
                                        <div className="mb-2">
                                            {qualityAssessments[item.id]?.loading ? (
                                                <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 rounded-lg py-2 px-3">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Analisando com NOS...
                                                </div>
                                            ) : qualityAssessments[item.id]?.score !== undefined && qualityAssessments[item.id]?.score >= 0 ? (
                                                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg py-2 px-3 text-xs">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-yellow-700">⭐ NOS</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 7 ? 'text-green-600' : qualityAssessments[item.id].score >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score}/9 estrelas
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleNOSAssessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPaid ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPaid ? '⭐ Avaliar Qualidade (NOS)' : <><Crown className="w-3 h-3" /> Avaliar (NOS) - Pago</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Botão de Avaliação AGREE II (Guidelines) */}
                                    {activeTab === 'article' && item.isGuideline && (
                                        <div className="mb-2">
                                            {qualityAssessments[item.id]?.loading ? (
                                                <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 rounded-lg py-2 px-3">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Analisando com AGREE II...
                                                </div>
                                            ) : qualityAssessments[item.id]?.score !== undefined && qualityAssessments[item.id]?.score >= 0 ? (
                                                <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200 rounded-lg py-2 px-3 text-xs">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-purple-700">🏛️ AGREE II</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 5 ? 'text-green-600' : qualityAssessments[item.id].score >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score}/7
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAGREEIIAssessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPaid ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPaid ? '🏛️ Avaliar Guideline (AGREE II)' : <><Crown className="w-3 h-3" /> Avaliar (AGREE II) - Pago</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => { onAddSource(item.title, item.url, item.type); onClose(); }}
                                        className={`w-full mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all ${item.isGuideline ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' : 'bg-white hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 border-2 border-gray-100 hover:border-indigo-200'}`}
                                    >
                                        <Plus className="w-4 h-4" /> {item.isGuideline ? 'Adicionar Guideline' : 'Adicionar ao Estudo'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            {loading ? (
                                <div className="text-center animate-pulse">
                                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                    </div>
                                    <p className="text-indigo-600 font-bold mb-1">Filtrando o melhor conteúdo...</p>
                                    <p className="text-xs">Priorizando Guidelines e Revisões Sistemáticas.</p>
                                </div>
                            ) : hasSearched ? (
                                <div className="text-center max-w-md mx-auto">
                                    <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="font-bold text-gray-600 mb-2">
                                        {filter !== 'ALL' ? 'Nenhum resultado com este filtro.' : 'Nenhum resultado relevante encontrado.'}
                                    </p>
                                    <p className="text-sm">Tente remover os filtros ou usar termos mais amplos.</p>
                                </div>
                            ) : (
                                <div className="text-center max-w-md mx-auto opacity-60">
                                    <Shield className="w-20 h-20 mx-auto mb-6 text-indigo-200" />
                                    <h3 className="text-lg font-bold text-gray-600 mb-2">Pesquisa Baseada em Evidências</h3>
                                    <p className="text-sm">Nossa IA organiza os resultados por confiabilidade. Guidelines e Meta-análises aparecem primeiro.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

