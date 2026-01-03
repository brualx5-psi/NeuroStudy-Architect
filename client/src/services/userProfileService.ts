/**
 * Serviço centralizado para gerenciar perfil do usuário
 * Facilita migração para Supabase depois
 */

import { UserProfile, StudyArea, Purpose, ExamType, SourceType, PreferredSource } from '../types';

const STORAGE_KEY = 'neurostudy_user_profile';
const CURRENT_VERSION = 1;

/**
 * Obtém o perfil do usuário do localStorage
 */
export const getProfile = (): UserProfile | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const profile = JSON.parse(stored) as UserProfile;

        // Valida versão do perfil
        if (profile.profileVersion !== CURRENT_VERSION) {
            console.warn('[UserProfile] Versão desatualizada, migrando...');
            // Aqui poderia ter lógica de migração
        }

        return profile;
    } catch (error) {
        console.error('[UserProfile] Erro ao ler perfil:', error);
        return null;
    }
};

/**
 * Salva o perfil do usuário no localStorage
 */
export const saveProfile = (profile: Partial<UserProfile>): UserProfile => {
    const existing = getProfile();

    const newProfile: UserProfile = {
        ...existing,
        ...profile,
        profileVersion: CURRENT_VERSION,
        createdAt: existing?.createdAt || new Date().toISOString(),
    } as UserProfile;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        console.log('[UserProfile] Perfil salvo:', newProfile);
        return newProfile;
    } catch (error) {
        console.error('[UserProfile] Erro ao salvar perfil:', error);
        throw error;
    }
};

/**
 * Limpa o perfil do usuário
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
 * Verifica se o onboarding foi completado
 */
export const hasCompletedOnboarding = (): boolean => {
    const profile = getProfile();
    return profile?.hasCompletedOnboarding ?? false;
};

/**
 * Marca o onboarding como completado
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
