import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, Plus, X, Globe, Loader2, HelpCircle, Shield, Crown } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { InputType } from '../types';
import { searchPubMed } from '../services/pubmedService';
import { getProfile, getPreferredSource } from '../services/userProfileService';

interface SearchResult {
    id: string;
    title: string;
    author: string;
    description: string;
    url: string;
    type: InputType;
    thumbnail?: string;
    reliabilityScore?: number; // 1 a 5 (5 Ã© o melhor)
    reliabilityLabel?: string;
    isGuideline?: boolean;
}

interface SearchResourcesModalProps {
    onClose: () => void;
    onAddSource: (name: string, content: string, type: InputType) => void;
    onOpenSubscription: () => void;
}

// COMPONENTE VISUAL: PirÃ¢mide de EvidÃªncia Interativa
const EvidencePyramid = ({ score, isGuideline }: { score: number, isGuideline?: boolean }) => {
    // Dados de cada nÃ­vel da pirÃ¢mide
    const levels = [
        { level: 5, name: 'Meta-anÃ¡lise', fullName: 'Meta-anÃ¡lise / RevisÃ£o SistemÃ¡tica', tool: 'AMSTAR 2, ROBIS', color: '#059669' },
        { level: 4, name: 'RCT', fullName: 'Ensaio ClÃ­nico Randomizado', tool: 'RoB 2', color: '#22c55e' },
        { level: 3, name: 'Coorte', fullName: 'Estudo de Coorte / Longitudinal', tool: 'NOS, ROBINS-I', color: '#eab308' },
        { level: 2, name: 'Caso-Controle', fullName: 'Estudo Caso-Controle', tool: 'NOS', color: '#f97316' },
        { level: 1, name: 'Observacional', fullName: 'Observacional / SÃ©rie de Casos / OpiniÃ£o', tool: '-', color: '#ef4444' },
    ];

    const currentLevel = levels.find(l => l.level === score) || levels[4];
    const guidelineTooltip = 'Diretriz clÃ­nica oficial - MÃ¡xima autoridade. AvaliaÃ§Ã£o: AGREE II';

    return (
        <div className="flex items-center gap-2">
            {/* Mini PirÃ¢mide SVG */}
            <div className="relative group cursor-pointer" title={isGuideline ? guidelineTooltip : `${currentLevel.fullName}\nAvaliaÃ§Ã£o: ${currentLevel.tool}`}>
                <svg width="40" height="36" viewBox="0 0 100 90" className="drop-shadow-sm">
                    {/* NÃ­vel 5 - Topo */}
                    <polygon
                        points="50,5 62,22 38,22"
                        fill={score >= 5 || isGuideline ? levels[0].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* NÃ­vel 4 */}
                    <polygon
                        points="38,22 62,22 70,38 30,38"
                        fill={score >= 4 || isGuideline ? levels[1].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* NÃ­vel 3 */}
                    <polygon
                        points="30,38 70,38 78,54 22,54"
                        fill={score >= 3 ? levels[2].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* NÃ­vel 2 */}
                    <polygon
                        points="22,54 78,54 86,70 14,70"
                        fill={score >= 2 ? levels[3].color : '#e5e7eb'}
                        stroke="#fff" strokeWidth="1"
                    />
                    {/* NÃ­vel 1 - Base */}
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
                    <div className="font-bold text-xs mb-1">{isGuideline ? 'ðŸ›ï¸ Guideline' : `ðŸ“Š ${currentLevel.name}`}</div>
                    <div className="text-gray-300 mb-1">{isGuideline ? 'Diretriz clÃ­nica oficial' : currentLevel.fullName}</div>
                    <div className="text-gray-400 border-t border-gray-700 pt-1 mt-1">
                        Ferramenta: {isGuideline ? 'AGREE II' : currentLevel.tool}
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                </div>
            </div>

            {/* Label */}
            <div className="flex flex-col">
                <span className={`text-[10px] font-bold ${isGuideline ? 'text-purple-700' : score >= 4 ? 'text-emerald-700' : score >= 3 ? 'text-yellow-700' : 'text-gray-600'}`}>
                    {isGuideline ? 'ðŸ›ï¸ Guideline' : currentLevel.name}
                </span>
                <span className="text-[8px] text-gray-400">
                    NÃ­vel {score}/5
                </span>
            </div>
        </div>
    );
};

type SourceMode = 'auto' | 'pubmed' | 'openalex' | 'grounding';

export const SearchResourcesModal: React.FC<SearchResourcesModalProps> = ({ onClose, onAddSource, onOpenSubscription }) => {
    const { isPro } = useAuth();
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
        { value: 'pubmed', label: 'PubMed' },
        { value: 'openalex', label: 'OpenAlex' },
        { value: 'grounding', label: 'Web/Geral' }
    ];

    // Controle do Tutorial
    const [showTutorial, setShowTutorial] = useState(false);

    // Estado de TraduÃ§Ã£o
    const [translating, setTranslating] = useState(false);
    const [translatedQuery, setTranslatedQuery] = useState<string | null>(null);

    // Estado para avaliaÃ§Ã£o de qualidade AMSTAR 2
    const [qualityAssessments, setQualityAssessments] = useState<Record<string, { score: number, summary: string, loading: boolean }>>({});

    // FunÃ§Ã£o para traduzir PT â†’ EN usando MyMemory API (gratuita)
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
                alert('NÃ£o foi possÃ­vel traduzir. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro ao traduzir:', error);
            alert('Erro na traduÃ§Ã£o. Verifique sua conexÃ£o.');
        } finally {
            setTranslating(false);
        }
    };

    // === DEEP RESEARCH ===
    const [deepResearchMode, setDeepResearchMode] = useState(false);
    const [deepResearchLoading, setDeepResearchLoading] = useState(false);
    const [deepResearchInsight, setDeepResearchInsight] = useState<string | null>(null);

    // === AVALIAÃ‡ÃƒO DE QUALIDADE AMSTAR 2 ===
    const handleQualityAssessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPro) {
            onOpenSubscription();
            return;
        }
        // Marca como loading
        setQualityAssessments(prev => ({
            ...prev,
            [itemId]: { score: 0, summary: '', loading: true }
        }));

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
            if (!apiKey) {
                throw new Error('API Key nÃ£o configurada');
            }

            const prompt = `VocÃª Ã© um especialista em avaliaÃ§Ã£o de evidÃªncias cientÃ­ficas. Analise esta meta-anÃ¡lise/revisÃ£o sistemÃ¡tica usando critÃ©rios simplificados do AMSTAR 2.

TÃTULO: ${title}
RESUMO: ${abstractText || 'NÃ£o disponÃ­vel'}

Baseado nas informaÃ§Ãµes disponÃ­veis, avalie de 0-16 pontos considerando:
1. Protocolo registrado previamente?
2. Busca abrangente na literatura?
3. Justificativa para exclusÃ£o de estudos?
4. AvaliaÃ§Ã£o de risco de viÃ©s?
5. MÃ©todos estatÃ­sticos apropriados?
6. Heterogeneidade discutida?
7. Conflitos de interesse declarados?

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [nÃºmero de 0 a 16]
QUALIDADE: [Alta/Moderada/Baixa/Criticamente Baixa]
RESUMO: [1 frase sobre a qualidade metodolÃ³gica]`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
                })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Parse da resposta
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 8;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'AvaliaÃ§Ã£o concluÃ­da';

            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score, summary, loading: false }
            }));

        } catch (error) {
            console.error('Erro na avaliaÃ§Ã£o:', error);
            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score: -1, summary: 'Erro na avaliaÃ§Ã£o', loading: false }
            }));
        }
    };

    // === AVALIAÃ‡ÃƒO RoB 2 (Risk of Bias) PARA RCTs ===
    const handleRoB2Assessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPro) {
            onOpenSubscription();
            return;
        }
        setQualityAssessments(prev => ({
            ...prev,
            [itemId]: { score: 0, summary: '', loading: true }
        }));

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
            if (!apiKey) throw new Error('API Key nÃ£o configurada');

            const prompt = `VocÃª Ã© um especialista em avaliaÃ§Ã£o de evidÃªncias cientÃ­ficas. Analise este Ensaio ClÃ­nico Randomizado (RCT) usando os domÃ­nios do RoB 2 (Risk of Bias 2).

TÃTULO: ${title}
RESUMO: ${abstractText || 'NÃ£o disponÃ­vel'}

Avalie os 5 domÃ­nios do RoB 2:
1. RandomizaÃ§Ã£o adequada?
2. Desvios das intervenÃ§Ãµes pretendidas?
3. Dados de desfecho faltantes?
4. MensuraÃ§Ã£o do desfecho adequada?
5. SeleÃ§Ã£o dos resultados reportados?

RESPONDA EXATAMENTE NESTE FORMATO:
RISCO: [Baixo/Algumas PreocupaÃ§Ãµes/Alto]
SCORE: [nÃºmero de 1 a 5, onde 5=baixo risco, 1=alto risco]
RESUMO: [1 frase sobre o risco de viÃ©s do estudo]`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
                })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 3;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'AvaliaÃ§Ã£o concluÃ­da';

            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score, summary, loading: false }
            }));

        } catch (error) {
            console.error('Erro na avaliaÃ§Ã£o RoB 2:', error);
            setQualityAssessments(prev => ({
                ...prev,
                [itemId]: { score: -1, summary: 'Erro na avaliaÃ§Ã£o', loading: false }
            }));
        }
    };

    // === AVALIAÃ‡ÃƒO NOS (Newcastle-Ottawa Scale) PARA COORTE/CASO-CONTROLE ===
    const handleNOSAssessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPro) {
            onOpenSubscription();
            return;
        }
        setQualityAssessments(prev => ({ ...prev, [itemId]: { score: 0, summary: '', loading: true } }));

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
            if (!apiKey) throw new Error('API Key nÃ£o configurada');

            const prompt = `VocÃª Ã© um especialista em avaliaÃ§Ã£o de evidÃªncias. Analise este estudo de coorte/caso-controle usando a Newcastle-Ottawa Scale (NOS).

TÃTULO: ${title}
RESUMO: ${abstractText || 'NÃ£o disponÃ­vel'}

Avalie os 3 domÃ­nios do NOS (total 9 estrelas):
1. SELEÃ‡ÃƒO (4 estrelas): representatividade, seleÃ§Ã£o controles, definiÃ§Ã£o exposiÃ§Ã£o
2. COMPARABILIDADE (2 estrelas): controle de confundidores
3. DESFECHO (3 estrelas): avaliaÃ§Ã£o, seguimento adequado

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [nÃºmero de 0 a 9]
QUALIDADE: [Alta (7-9)/Moderada (4-6)/Baixa (0-3)]
RESUMO: [1 frase sobre a qualidade metodolÃ³gica]`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 200 } })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'AvaliaÃ§Ã£o concluÃ­da';

            setQualityAssessments(prev => ({ ...prev, [itemId]: { score, summary, loading: false } }));
        } catch (error) {
            console.error('Erro NOS:', error);
            setQualityAssessments(prev => ({ ...prev, [itemId]: { score: -1, summary: 'Erro', loading: false } }));
        }
    };

    // === AVALIAÃ‡ÃƒO AGREE II PARA GUIDELINES ===
    const handleAGREEIIAssessment = async (itemId: string, title: string, abstractText: string) => {
        if (!isPro) {
            onOpenSubscription();
            return;
        }
        setQualityAssessments(prev => ({ ...prev, [itemId]: { score: 0, summary: '', loading: true } }));

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
            if (!apiKey) throw new Error('API Key nÃ£o configurada');

            const prompt = `VocÃª Ã© um especialista em avaliaÃ§Ã£o de guidelines clÃ­nicas. Analise esta diretriz usando critÃ©rios do AGREE II.

TÃTULO: ${title}
RESUMO: ${abstractText || 'NÃ£o disponÃ­vel'}

Avalie os 6 domÃ­nios do AGREE II:
1. Escopo e PropÃ³sito
2. Envolvimento das Partes Interessadas
3. Rigor do Desenvolvimento
4. Clareza da ApresentaÃ§Ã£o
5. Aplicabilidade
6. IndependÃªncia Editorial

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [nÃºmero de 1 a 7, onde 7=excelente]
RECOMENDAÃ‡ÃƒO: [Fortemente Recomendada/Recomendada com ModificaÃ§Ãµes/NÃ£o Recomendada]
RESUMO: [1 frase sobre a qualidade da diretriz]`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 200 } })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
            const summaryMatch = text.match(/RESUMO:\s*(.+)/i);
            const summary = summaryMatch ? summaryMatch[1].trim() : 'AvaliaÃ§Ã£o concluÃ­da';

            setQualityAssessments(prev => ({ ...prev, [itemId]: { score, summary, loading: false } }));
        } catch (error) {
            console.error('Erro AGREE II:', error);
            setQualityAssessments(prev => ({ ...prev, [itemId]: { score: -1, summary: 'Erro', loading: false } }));
        }
    };

    const handleDeepResearch = async () => {
        if (!isPro) {
            onOpenSubscription();
            return;
        }
        if (!query.trim()) return;
        setDeepResearchLoading(true);
        setDeepResearchInsight(null);
        setHasSearched(true);
        setResults([]);

        try {
            // 1. Primeiro faz a busca normal para pegar artigos
            const searchResponse = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=20&sort=cited_by_count:desc`);
            const searchData = await searchResponse.json();

            if (!searchData.results || searchData.results.length === 0) {
                setDeepResearchInsight('Nenhum resultado encontrado para anÃ¡lise. Tente outro termo.');
                return;
            }

            // 2. Formata os artigos para anÃ¡lise
            const articlesForAnalysis = searchData.results.slice(0, 10).map((item: any) => ({
                title: item.display_name || item.title,
                year: item.publication_year,
                citations: item.cited_by_count,
                abstract: item.abstract_inverted_index ? 'Possui abstract' : 'Sem abstract'
            }));

            // 3. Envia para o Gemini analisar
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
            if (!apiKey) {
                setDeepResearchInsight('API Key do Gemini nÃ£o configurada.');
                return;
            }

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });

            const prompt = `VocÃª Ã© um pesquisador cientÃ­fico experiente. Analise estes artigos sobre "${query}" e forneÃ§a:

ARTIGOS ENCONTRADOS:
${JSON.stringify(articlesForAnalysis, null, 2)}

TAREFA:
1. Resuma em 2-3 frases o que a literatura cientÃ­fica diz sobre este tema.
2. Identifique os 3 principais consensos ou descobertas.
3. Sugira 2-3 termos de busca mais especÃ­ficos (em inglÃªs) para encontrar estudos melhores.
4. Indique se hÃ¡ alguma lacuna ou controvÃ©rsia no tema.

Responda de forma concisa e Ãºtil para um estudante. Use bullet points. MÃ¡ximo 200 palavras.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: { parts: [{ text: prompt }] }
            });

            let insight = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
            setDeepResearchInsight(insight);

            // 4. TambÃ©m popula os resultados normais
            const formatted = searchData.results.map((item: any) => {
                const reliability = calculateReliability(item.display_name || item.title, '', 'openalex');
                return {
                    id: item.id,
                    title: item.display_name || item.title,
                    author: item.authorships?.[0]?.author?.display_name || 'Pesquisador',
                    description: `Publicado em: ${item.publication_year}. CitaÃ§Ãµes: ${item.cited_by_count}.`,
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

    // --- LÃ“GICA DE HIERARQUIA DE EVIDÃŠNCIA ---
    const calculateReliability = (title: string, abstract: string = '', source: string = ''): { score: number, label: string, isGuideline: boolean } => {
        const text = (title + ' ' + abstract).toLowerCase();

        // Verifica se Ã¡rea do usuÃ¡rio Ã© saÃºde
        const profile = getProfile();
        const isHealthArea = profile?.studyArea === 'health';

        // 1. GUIDELINES (TOPO) - SÃ³ para Ã¡rea de saÃºde
        if (isHealthArea && (text.includes('guideline') || text.includes('diretriz') || text.includes('consensus') || text.includes('recommendation'))) {
            return { score: 5, label: 'Diretriz ClÃ­nica (Guideline)', isGuideline: true };
        }
        // 2. META-ANÃLISE / REVISÃƒO SISTEMÃTICA
        if (text.includes('meta-analysis') || text.includes('systematic review') || text.includes('revisÃ£o sistemÃ¡tica')) {
            return { score: 5, label: 'RevisÃ£o SistemÃ¡tica / Meta-anÃ¡lise', isGuideline: false };
        }
        // 3. ENSAIO CLÃNICO RANDOMIZADO (RCT)
        if (text.includes('randomized') || text.includes('randomizado') || text.includes('clinical trial')) {
            return { score: 4, label: 'Ensaio ClÃ­nico Randomizado (RCT)', isGuideline: false };
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
        return { score: 1, label: 'Estudo PrimÃ¡rio / OpiniÃ£o', isGuideline: false };
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
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
                        description: item.volumeInfo.description?.slice(0, 200) + '...' || 'Sem descriÃ§Ã£o.',
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
                                description: `Publicado em: ${item.publication_year}. CitaÃ§Ãµes: ${item.cited_by_count}.`,
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

                    // === GEMINI GROUNDING ===
                } else {
                    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
                    if (!apiKey) {
                        console.error('API Key nÃ£o configurada');
                        return;
                    }

                    const { GoogleGenAI } = await import('@google/genai');
                    const ai = new GoogleGenAI({ apiKey });

                    const prompt = `VocÃª Ã© um assistente de pesquisa cientÃ­fica. Busque artigos cientÃ­ficos sobre: "${query}"
                
TAREFA: Encontre 10-15 artigos cientÃ­ficos relevantes (priorizando meta-anÃ¡lises, revisÃµes sistemÃ¡ticas e guidelines).

Para cada artigo encontrado, retorne um JSON com esta estrutura:
{
  "articles": [
    {
      "title": "TÃ­tulo do artigo",
      "author": "Primeiro autor ou organizaÃ§Ã£o",
      "year": 2024,
      "type": "meta-analysis" | "systematic-review" | "guideline" | "rct" | "cohort" | "other",
      "description": "Breve descriÃ§Ã£o do que o estudo descobriu (1-2 frases)",
      "url": "URL do artigo ou DOI"
    }
  ]
}

IMPORTANTE: 
- Priorize artigos de revistas cientÃ­ficas renomadas (Lancet, NEJM, JAMA, Cochrane, etc.)
- Inclua o DOI ou link direto sempre que possÃ­vel
- Foque em estudos recentes (Ãºltimos 5-10 anos)
- Retorne APENAS o JSON, sem markdown ou explicaÃ§Ãµes`;

                    try {
                        const response = await ai.models.generateContent({
                            model: 'gemini-2.0-flash',
                            contents: { parts: [{ text: prompt }] },
                            config: {
                                tools: [{ googleSearch: {} }], // Ativa Grounding com Google Search
                            }
                        });

                        let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;

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
                                        title: item.title || 'Artigo sem tÃ­tulo',
                                        author: item.author || 'Autor desconhecido',
                                        description: item.description || `Publicado em ${item.year || 'N/A'}`,
                                        url: item.url || item.doi || '#',
                                        type: InputType.DOI,
                                        reliabilityScore: typeScore[item.type] || 1,
                                        reliabilityLabel: item.type || 'other',
                                        isGuideline: item.type === 'guideline'
                                    };
                                });

                                // Ordena por relevÃ¢ncia
                                const sorted = formatted.sort((a, b) => {
                                    if (a.isGuideline && !b.isGuideline) return -1;
                                    if (!a.isGuideline && b.isGuideline) return 1;
                                    return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
                                });

                                setResults(sorted);
                            }
                        } catch (parseError) {
                            console.error('Erro ao parsear resposta do Gemini:', parseError);
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
                                        description: `Publicado em: ${item.publication_year}. CitaÃ§Ãµes: ${item.cited_by_count}.`,
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
                        console.error('Erro no Gemini Grounding:', geminiError);
                    }
                } // Fecha else do Gemini Grounding

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

    // LÃ³gica de Filtragem Visual
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
                                <h2 className="text-xl font-bold mb-1">Guia de Pesquisa CientÃ­fica</h2>
                                <p className="text-white/70 text-sm">
                                    O NeuroStudy usa as melhores bases cientÃ­ficas do mundo
                                </p>
                            </div>

                            {/* Cards das Fontes */}
                            <div className="grid grid-cols-3 gap-2 w-full">
                                <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3 text-left">
                                    <span className="text-green-300 font-bold text-sm flex items-center gap-1.5 mb-1">ðŸ¥ PubMed</span>
                                    <p className="text-[11px] text-green-100/80 leading-relaxed">PadrÃ£o ouro para SaÃºde. RCTs, Meta-anÃ¡lises e Guidelines.</p>
                                </div>
                                <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-left">
                                    <span className="text-blue-300 font-bold text-sm flex items-center gap-1.5 mb-1">ðŸ“š OpenAlex</span>
                                    <p className="text-[11px] text-blue-100/80 leading-relaxed">Multidisciplinar. Direito, Engenharia, Humanas.</p>
                                </div>
                                <div className="bg-purple-500/20 border border-purple-400/30 rounded-lg p-3 text-left">
                                    <span className="text-purple-300 font-bold text-sm flex items-center gap-1.5 mb-1">ðŸŒ Web/IA</span>
                                    <p className="text-[11px] text-purple-100/80 leading-relaxed">IA com Google Search. PDFs e artigos nÃ£o indexados.</p>
                                </div>
                            </div>

                            {/* PirÃ¢mide de EvidÃªncia + Ferramentas */}
                            <div className="bg-black/30 p-4 rounded-xl w-full">
                                <p className="font-bold text-sm mb-3 text-center">ðŸ“Š Entendendo a Qualidade dos Estudos</p>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Esquerda: PirÃ¢mide Grande com Labels ao lado */}
                                    <div className="flex items-center justify-center gap-1">
                                        <svg width="100" height="110" viewBox="0 0 100 110">
                                            {/* Guideline - Estrela no topo */}
                                            <polygon points="50,5 53,12 60,12 55,17 57,24 50,20 43,24 45,17 40,12 47,12" fill="#9333ea" stroke="#fff" strokeWidth="0.5" />
                                            {/* NÃ­vel 5 - Meta-anÃ¡lise */}
                                            <polygon points="50,24 65,42 35,42" fill="#059669" stroke="#fff" strokeWidth="1" />
                                            {/* NÃ­vel 4 - RCT */}
                                            <polygon points="35,42 65,42 75,58 25,58" fill="#22c55e" stroke="#fff" strokeWidth="1" />
                                            {/* NÃ­vel 3 - Coorte */}
                                            <polygon points="25,58 75,58 82,74 18,74" fill="#eab308" stroke="#fff" strokeWidth="1" />
                                            {/* NÃ­vel 2 - Caso-Controle */}
                                            <polygon points="18,74 82,74 90,90 10,90" fill="#f97316" stroke="#fff" strokeWidth="1" />
                                            {/* NÃ­vel 1 - Observacional */}
                                            <polygon points="10,90 90,90 98,106 2,106" fill="#ef4444" stroke="#fff" strokeWidth="1" />
                                        </svg>
                                        {/* Labels ao lado */}
                                        <div className="text-[9px] space-y-2 text-left">
                                            <div className="flex items-center gap-1 -mt-2"><span className="text-purple-400">â˜…</span> <span className="text-purple-300 font-bold">Guideline</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-600"></span> <span>Meta-anÃ¡lise</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500"></span> <span>RCT</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500"></span> <span>Coorte</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500"></span> <span>Caso-Controle</span></div>
                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500"></span> <span>Observacional</span></div>
                                        </div>
                                    </div>

                                    {/* Direita: Ferramentas de AvaliaÃ§Ã£o */}
                                    <div className="text-left">
                                        <p className="text-[10px] text-gray-400 mb-2">Ferramentas de AvaliaÃ§Ã£o</p>
                                        <div className="space-y-2 text-[10px]">
                                            <div className="bg-white/5 p-2 rounded">
                                                <p className="font-bold text-emerald-300">AMSTAR 2</p>
                                                <p className="text-gray-300">Avalia meta-anÃ¡lises. Score de 0-16 pontos.</p>
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
                                    â†‘ Quanto mais alto na pirÃ¢mide + boa avaliaÃ§Ã£o = maior confiabilidade
                                </p>
                            </div>

                            {/* Dicas de Busca */}
                            <div className="text-left bg-black/20 p-3 rounded-xl space-y-2 w-full border border-white/10">
                                <div className="flex items-start gap-3">
                                    <span className="bg-emerald-500 w-2 h-2 rounded-full shrink-0 mt-1.5"></span>
                                    <p className="text-xs"><span className="font-bold text-emerald-300">Seja EspecÃ­fico:</span> Use "Terapia Cognitiva Ansiedade" ao invÃ©s de "Ansiedade".</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="bg-blue-500 w-2 h-2 rounded-full shrink-0 mt-1.5"></span>
                                    <p className="text-xs"><span className="font-bold text-blue-300">Use InglÃªs:</span> 95% da ciÃªncia estÃ¡ em inglÃªs. Use <span className="bg-white/20 px-1 py-0.5 rounded text-[10px] font-bold">ðŸŒ PTâ†’EN</span></p>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full pt-1">
                                <button onClick={() => handleCloseTutorial(false)} className="flex-1 py-2.5 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors">Entendi</button>
                                <button onClick={() => handleCloseTutorial(true)} className="px-4 py-2.5 bg-transparent border border-white/30 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm">NÃ£o mostrar mais</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">

                {/* Header */}
                <div className="bg-white border-b border-gray-100 p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-600" /> Pesquisar Fontes</h3>

                        {/* FILTROS (CHIPS) */}
                        {activeTab === 'article' && results.length > 0 && (
                            <div className="hidden md:flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-4">
                                <span className="text-xs font-bold text-gray-400 uppercase mr-1">Filtrar:</span>
                                <button onClick={() => setFilter('ALL')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Todos</button>
                                <button onClick={() => setFilter('GUIDELINE')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${filter === 'GUIDELINE' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}><Shield className="w-3 h-3" /> Diretrizes</button>
                                <button onClick={() => setFilter('META')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${filter === 'META' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Meta-Review</button>
                                <button onClick={() => setFilter('RCT')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${filter === 'RCT' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>RCTs</button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowTutorial(true)} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Como pesquisar?"><HelpCircle className="w-5 h-5" /></button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                </div>

                {/* Tabs & Search - ColapsÃ¡vel quando hÃ¡ resultados */}
                <div className={`bg-slate-50 border-b border-gray-200 shrink-0 transition-all duration-300 ${results.length > 0 ? 'p-3' : 'p-6 space-y-4'}`}>

                    {/* VersÃ£o expandida (sem resultados) */}
                    {results.length === 0 && (
                        <>
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => setActiveTab('article')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'article' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><FileText className="w-4 h-4" /> Artigos CientÃ­ficos</button>
                                <button onClick={() => setActiveTab('book')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><BookOpen className="w-4 h-4" /> Livros</button>
                                <button onClick={() => setActiveTab('web')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'web' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Globe className="w-4 h-4" /> Wiki / Conceitos</button>
                            </div>

                            {/* Seletor de fonte (sÃ³ para artigos) */}
                            {activeTab === 'article' && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-xs text-gray-500 font-medium">Fonte:</span>
                                        {[
                                            { key: 'auto', label: 'âœ¨ AutomÃ¡tico', color: 'indigo' },
                                            { key: 'pubmed', label: 'ðŸ¥ PubMed', color: 'green' },
                                            { key: 'openalex', label: 'ðŸ“š OpenAlex', color: 'blue' },
                                            { key: 'grounding', label: 'ðŸŒ Web/IA', color: 'purple' }
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
                                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-2 flex items-center justify-center gap-4 text-xs">
                                        <span className="flex items-center gap-1.5 text-indigo-700">
                                            <Globe className="w-3.5 h-3.5" />
                                            <span>Buscas em <b>InglÃªs</b> tÃªm 10x mais resultados</span>
                                        </span>
                                        <span className="text-purple-600 bg-white px-2 py-0.5 rounded border border-purple-200 font-bold text-[11px]">
                                            Use o botÃ£o ðŸŒ PTâ†’EN abaixo
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="relative max-w-2xl mx-auto group">
                        <input
                            autoFocus
                            type="text"
                            placeholder={activeTab === 'article' ? "Ex: 'Anxiety treatment systematic review' (InglÃªs Ã© melhor)" : "Digite o tema..."}
                            className="w-full pl-12 pr-36 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-lg shadow-sm transition-all"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setTranslatedQuery(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 group-focus-within:text-indigo-500 transition-colors" />

                        {/* BotÃ£o de TraduÃ§Ã£o PT â†’ EN */}
                        {query.trim() && !translatedQuery && (
                            <button
                                onClick={handleTranslate}
                                disabled={translating}
                                className="absolute right-28 top-2 bottom-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg transition-colors text-xs flex items-center gap-1"
                                title="Traduzir para InglÃªs"
                            >
                                {translating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>ðŸŒ PTâ†’EN</>
                                )}
                            </button>
                        )}

                        {/* Indicador de que foi traduzido */}
                        {translatedQuery && (
                            <span className="absolute right-28 top-1/2 -translate-y-1/2 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                                âœ“ Traduzido
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

                    {/* BotÃ£o Deep Research (centralizado) */}
                    {activeTab === 'article' && (
                        <div className="flex items-center justify-center">
                            <button
                                onClick={handleDeepResearch}
                                disabled={deepResearchLoading}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-1 ${isPro
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                                    : 'bg-white border-2 border-purple-100 text-purple-600 hover:border-purple-300'}`}
                            >
                                {deepResearchLoading ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Analisando...</>
                                ) : (
                                    <>{!isPro && <Crown className="w-3 h-3" />} ðŸ§  Deep Research</>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Painel de Insights do Deep Research */}
                    {deepResearchInsight && (
                        <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <div className="bg-purple-600 text-white p-2 rounded-lg shrink-0">
                                    ðŸ§ 
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-purple-800 text-sm mb-2">AnÃ¡lise Deep Research</h4>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {deepResearchInsight}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDeepResearchInsight(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

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

                                    {/* Header: Autor + Barra de EvidÃªncia */}
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

                                    {/* TÃ­tulo - mais espaÃ§o */}
                                    <h4 className="font-bold text-gray-900 leading-snug mb-2 text-sm line-clamp-3 group-hover:text-indigo-700 transition-colors" title={item.title}>{item.title}</h4>

                                    {/* DescriÃ§Ã£o */}
                                    <p className="text-xs text-gray-600 line-clamp-2 mb-2 flex-1 leading-relaxed">{item.description}</p>

                                    {/* BotÃ£o de AvaliaÃ§Ã£o AMSTAR 2 (sÃ³ para meta-anÃ¡lises) */}
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
                                                        <span className="font-bold text-emerald-700">ðŸ”¬ AMSTAR 2</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 12 ? 'text-emerald-600' : qualityAssessments[item.id].score >= 8 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score}/16
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleQualityAssessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPro ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPro ? 'ðŸ”¬ Avaliar Qualidade (AMSTAR 2)' : <><Crown className="w-3 h-3" /> Avaliar (AMSTAR 2) - Pro</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* BotÃ£o de AvaliaÃ§Ã£o RoB 2 (sÃ³ para RCTs) */}
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
                                                        <span className="font-bold text-blue-700">âš–ï¸ RoB 2</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 4 ? 'text-green-600' : qualityAssessments[item.id].score >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score >= 4 ? 'Baixo' : qualityAssessments[item.id].score >= 3 ? 'Moderado' : 'Alto'} Risco
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleRoB2Assessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPro ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPro ? 'âš–ï¸ Avaliar Risco de ViÃ©s (RoB 2)' : <><Crown className="w-3 h-3" /> Avaliar (RoB 2) - Pro</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* BotÃ£o de AvaliaÃ§Ã£o NOS (Coorte e Caso-Controle) */}
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
                                                        <span className="font-bold text-yellow-700">â­ NOS</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 7 ? 'text-green-600' : qualityAssessments[item.id].score >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score}/9 estrelas
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleNOSAssessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPro ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPro ? 'â­ Avaliar Qualidade (NOS)' : <><Crown className="w-3 h-3" /> Avaliar (NOS) - Pro</>}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* BotÃ£o de AvaliaÃ§Ã£o AGREE II (Guidelines) */}
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
                                                        <span className="font-bold text-purple-700">ðŸ›ï¸ AGREE II</span>
                                                        <span className={`font-bold ${qualityAssessments[item.id].score >= 5 ? 'text-green-600' : qualityAssessments[item.id].score >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {qualityAssessments[item.id].score}/7
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-[10px]">{qualityAssessments[item.id].summary}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAGREEIIAssessment(item.id, item.title, item.description)}
                                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${isPro ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                                >
                                                    {isPro ? 'ðŸ›ï¸ Avaliar Guideline (AGREE II)' : <><Crown className="w-3 h-3" /> Avaliar (AGREE II) - Pro</>}
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
                                    <p className="text-indigo-600 font-bold mb-1">Filtrando o melhor conteÃºdo...</p>
                                    <p className="text-xs">Priorizando Guidelines e RevisÃµes SistemÃ¡ticas.</p>
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
                                    <h3 className="text-lg font-bold text-gray-600 mb-2">Pesquisa Baseada em EvidÃªncias</h3>
                                    <p className="text-sm">Nossa IA organiza os resultados por confiabilidade. Guidelines e Meta-anÃ¡lises aparecem primeiro.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
