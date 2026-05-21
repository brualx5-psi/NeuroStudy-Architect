/**
 * Serviço centralizado para gerenciar perfil/onboarding do usuário.
 *
 * Mantém localStorage como cache/fallback, mas quando há Supabase autenticado
 * também persiste o perfil em public.user_data.content.profile para funcionar
 * entre dispositivos diferentes.
 */

import { UserProfile, StudyArea, Purpose, ExamType, SourceType, PreferredSource } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'neurostudy_user_profile';
const CURRENT_VERSION = 1;

const STUDY_AREAS: StudyArea[] = ['health', 'engineering', 'law', 'marketing', 'general'];
const PURPOSES: Purpose[] = ['vestibular', 'exam', 'graduation', 'postgrad', 'professional'];
const EXAM_TYPES: ExamType[] = ['oab', 'concursos', 'enem', 'residencia', 'none'];
const SOURCE_TYPES: SourceType[] = ['video', 'pdf', 'text', 'mixed'];
const PREFERRED_SOURCES: PreferredSource[] = ['auto', 'pubmed', 'openalex', 'grounding'];

type UserDataContent = {
    studies?: unknown;
    folders?: unknown;
    profile?: Partial<UserProfile> | null;
    [key: string]: unknown;
};

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);

const normalizeProfile = (profile: Partial<UserProfile> | null | undefined): UserProfile | null => {
    if (!profile) return null;

    const studyArea = isOneOf(profile.studyArea, STUDY_AREAS) ? profile.studyArea : null;
    const purpose = isOneOf(profile.purpose, PURPOSES) ? profile.purpose : null;

    if (!studyArea || !purpose) return null;

    return {
        name: typeof profile.name === 'string' ? profile.name : undefined,
        studyArea,
        purpose,
        examType: isOneOf(profile.examType, EXAM_TYPES) ? profile.examType : undefined,
        primarySourceType: isOneOf(profile.primarySourceType, SOURCE_TYPES) ? profile.primarySourceType : 'text',
        preferredSource: isOneOf(profile.preferredSource, PREFERRED_SOURCES)
            ? profile.preferredSource
            : studyArea === 'health'
                ? 'pubmed'
                : 'auto',
        profileVersion: typeof profile.profileVersion === 'number' ? profile.profileVersion : CURRENT_VERSION,
        hasCompletedOnboarding: Boolean(profile.hasCompletedOnboarding),
        createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : new Date().toISOString(),
    };
};

const writeLocalProfile = (profile: UserProfile): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
};

const getAuthenticatedUserId = async (userIdOverride?: string) => {
    if (userIdOverride) return userIdOverride;
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) return null;
    return data.user.id;
};

/**
 * Obtém o perfil do usuário do localStorage.
 */
export const getProfile = (): UserProfile | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const profile = normalizeProfile(JSON.parse(stored) as Partial<UserProfile>);
        if (!profile) return null;

        // Valida versão do perfil
        if (profile.profileVersion !== CURRENT_VERSION) {
            console.warn('[UserProfile] Versão desatualizada, migrando...');
            profile.profileVersion = CURRENT_VERSION;
            writeLocalProfile(profile);
        }

        return profile;
    } catch (error) {
        console.error('[UserProfile] Erro ao ler perfil:', error);
        return null;
    }
};

/**
 * Carrega o perfil salvo na nuvem e atualiza o cache local.
 * Se não houver Supabase/usuário/registro, usa o localStorage como fallback.
 */
export const loadProfile = async (userIdOverride?: string): Promise<UserProfile | null> => {
    if (!supabase) return getProfile();

    try {
        const userId = await getAuthenticatedUserId(userIdOverride);
        if (!userId) return getProfile();

        const { data, error } = await supabase
            .from('user_data')
            .select('content')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.warn('[UserProfile] Erro ao carregar perfil da nuvem, usando localStorage:', error.message);
            return getProfile();
        }

        const content = data?.content as UserDataContent | null | undefined;
        const cloudProfile = normalizeProfile(content?.profile);

        if (cloudProfile?.hasCompletedOnboarding) {
            writeLocalProfile(cloudProfile);
            console.log('[UserProfile] Perfil carregado da nuvem:', cloudProfile);
            return cloudProfile;
        }

        const localProfile = getProfile();
        if (localProfile?.hasCompletedOnboarding) {
            // Migra perfis antigos que existiam apenas no localStorage para a nuvem.
            void saveProfileToCloud(localProfile, userId);
        }

        return localProfile;
    } catch (error) {
        console.warn('[UserProfile] Exceção ao carregar perfil da nuvem, usando localStorage:', error);
        return getProfile();
    }
};

/**
 * Salva o perfil do usuário na nuvem sem bloquear a UI.
 */
export const saveProfileToCloud = async (profile: UserProfile, userIdOverride?: string): Promise<void> => {
    if (!supabase) return;

    try {
        const userId = await getAuthenticatedUserId(userIdOverride);
        if (!userId) return;

        const { data, error: loadError } = await supabase
            .from('user_data')
            .select('content')
            .eq('user_id', userId)
            .maybeSingle();

        if (loadError) {
            console.warn('[UserProfile] Erro ao ler user_data antes de salvar perfil:', loadError.message);
        }

        const existingContent = (data?.content ?? {}) as UserDataContent;
        const content: UserDataContent = {
            ...existingContent,
            profile,
        };

        const { error } = await supabase
            .from('user_data')
            .upsert(
                {
                    user_id: userId,
                    content,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );

        if (error) {
            console.warn('[UserProfile] Erro ao salvar perfil na nuvem:', error.message, error.details, error.hint);
        } else {
            console.log('[UserProfile] Perfil salvo na nuvem');
        }
    } catch (error) {
        console.warn('[UserProfile] Exceção ao salvar perfil na nuvem:', error);
    }
};

/**
 * Salva o perfil do usuário no localStorage e agenda persistência no Supabase.
 */
export const saveProfile = (profile: Partial<UserProfile>): UserProfile => {
    const existing = getProfile();

    const newProfile = normalizeProfile({
        ...existing,
        ...profile,
        profileVersion: CURRENT_VERSION,
        createdAt: existing?.createdAt || new Date().toISOString(),
    });

    if (!newProfile) {
        throw new Error('Perfil de onboarding inválido: área de estudo e objetivo são obrigatórios.');
    }

    try {
        writeLocalProfile(newProfile);
        console.log('[UserProfile] Perfil salvo localmente:', newProfile);
        void saveProfileToCloud(newProfile);
        return newProfile;
    } catch (error) {
        console.error('[UserProfile] Erro ao salvar perfil:', error);
        throw error;
    }
};

/**
 * Limpa o perfil do usuário localmente.
 */
export const clearProfile = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('[UserProfile] Perfil removido');
    } catch (error) {
        console.error('[UserProfile] Erro ao limpar perfil:', error);
    }
};

/**
 * Verifica se o onboarding foi completado pelo cache local.
 * Para decisão inicial entre dispositivos, prefira loadProfile(userId).
 */
export const hasCompletedOnboarding = (): boolean => {
    const profile = getProfile();
    return profile?.hasCompletedOnboarding ?? false;
};

/**
 * Marca o onboarding como completado.
 */
export const completeOnboarding = (): void => {
    saveProfile({ hasCompletedOnboarding: true });
};

/**
 * Obtém a fonte preferida (com fallback automático baseado na área)
 */
export const getPreferredSource = (): PreferredSource => {
    const profile = getProfile();

    if (!profile) return 'auto';
    if (profile.preferredSource !== 'auto') return profile.preferredSource;

    // Lógica automática baseada na área
    if (profile.studyArea === 'health') return 'pubmed';
    return 'grounding';
};

/**
 * Obtém o nome do usuário (ou null se não definido)
 */
export const getUserName = (): string | null => {
    const profile = getProfile();
    return profile?.name || null;
};

/**
 * Labels para exibição na UI
 */
export const LABELS = {
    studyArea: {
        health: '🏥 Saúde/Medicina',
        engineering: '⚙️ Engenharia/Exatas',
        law: '⚖️ Direito',
        marketing: '📊 Marketing/Negócios',
        general: '📚 Geral'
    },
    purpose: {
        vestibular: '🎓 Vestibular',
        exam: '📝 Concursos',
        graduation: '🎒 Faculdade',
        postgrad: '📖 Pós-graduação',
        professional: '💼 Profissional'
    },
    examType: {
        oab: 'OAB',
        concursos: 'Concursos Públicos',
        enem: 'ENEM',
        residencia: 'Residência Médica',
        none: 'Outro'
    },
    primarySourceType: {
        video: '🎬 Vídeos',
        pdf: '📄 PDFs/Livros',
        text: '📝 Textos/Artigos',
        mixed: '🔀 Misto'
    },
    preferredSource: {
        auto: '✨ Automático (Recomendado)',
        pubmed: '🏥 PubMed (Saúde)',
        openalex: '📚 OpenAlex (Acadêmico)',
        grounding: '🌐 Web/Geral'
    }
};
