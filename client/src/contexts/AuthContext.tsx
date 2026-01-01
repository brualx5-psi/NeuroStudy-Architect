import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    study_area?: string;
    subscription_status?: 'free' | 'trial' | 'active' | 'cancelled';
    onboarding_completed?: boolean;
}

interface UserUsage {
    roadmaps_created: number;          // Free: max 3, Pro: max 50
    feynman_used: number;              // Free: max 3, Pro: max 100
    pdf_exports: number;               // Free: max 1, Pro: max 50
    youtube_minutes_used: number;      // Free: max 30, Pro: max 600
    web_research_used: number;         // Free: max 1, Pro: max 200
    chat_messages: number;             // Free: max 50/mês, Pro: max 500/mês
}

// ====================================================================
// LIMITES POR PLANO (Seguros e Sustentáveis)
// ====================================================================
const LIMITS = {
    FREE: {
        roadmaps: 3,
        feynman: 3,
        pdf_exports: 1,               // 1x/mês com marca d'água
        youtube_minutes: 30,          // 1 vídeo curto
        web_research: 1,              // 1 busca/mês (teaser)
        chat_messages: 50,            // 50 mensagens/mês
        pages_per_source: 30,
        sources_per_study: 2,
        total_pages_per_study: 60,    // 30 x 2 = airbag
        flashcards_per_study: 15,
    },
    PRO: {
        roadmaps: 50,
        feynman: 100,                 // Alto, mas não ilimitado
        pdf_exports: 30,              // Conservador: suficiente para uso normal
        youtube_minutes: 600,         // 10 horas/mês
        web_research: 100,            // Conservador: buscas combinam múltiplas fontes
        chat_messages: 500,           // 500 mensagens/mês
        pages_per_source: 300,        // Conservador: cobre maioria dos livros
        sources_per_study: 10,
        total_pages_per_study: 1500,  // Airbag: máx 1500 páginas equiv. por roteiro
        flashcards_per_study: 100,
    }
};

// Exportar limites para uso em outros componentes
export { LIMITS };

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    usage: UserUsage | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    isPro: boolean;
    limits: typeof LIMITS.FREE | typeof LIMITS.PRO;
    // Verificações de limite
    canCreateStudy: () => boolean;
    canUseFeynman: () => boolean;
    canExportPDF: () => boolean;
    canTranscribeYoutube: (minutes?: number) => boolean;
    canUseWebResearch: () => boolean;
    canSendChatMessage: () => boolean;
    getRemainingYoutubeMinutes: () => number;
    // Incrementadores
    incrementUsage: (type: 'roadmap' | 'feynman' | 'pdf_export' | 'youtube' | 'web_research' | 'chat', amount?: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [usage, setUsage] = useState<UserUsage | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase!
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setProfile(data);
            await fetchUsage(userId);
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
        }
    };

    const fetchUsage = async (userId: string) => {
        const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        try {
            let { data, error } = await supabase!
                .from('user_usage')
                .select('roadmaps_created, feynman_used, pdf_exports, youtube_minutes_used, web_research_used, chat_messages')
                .eq('user_id', userId)
                .eq('month', currentMonth)
                .single();

            if (error && error.code === 'PGRST116') {
                // Não encontrou uso para este mês, criar um novo
                const { data: newData, error: insertError } = await supabase!
                    .from('user_usage')
                    .insert([{ user_id: userId, month: currentMonth }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                data = newData;
            } else if (error) {
                throw error;
            }

            setUsage(data);
        } catch (error) {
            console.error('Erro ao buscar consumo:', error);
        }
    };

    useEffect(() => {
        supabase?.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            }
            setLoading(false);
        });

        const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase?.auth.signOut();
        setUser(null);
        setProfile(null);
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trial';
    const limits = isPro ? LIMITS.PRO : LIMITS.FREE;

    // ====== VERIFICAÇÕES DE LIMITE ======

    const canCreateStudy = () => {
        const max = isPro ? LIMITS.PRO.roadmaps : LIMITS.FREE.roadmaps;
        return (usage?.roadmaps_created ?? 0) < max;
    };

    const canUseFeynman = () => {
        const max = isPro ? LIMITS.PRO.feynman : LIMITS.FREE.feynman;
        return (usage?.feynman_used ?? 0) < max;
    };

    const canExportPDF = () => {
        const max = isPro ? LIMITS.PRO.pdf_exports : LIMITS.FREE.pdf_exports;
        return (usage?.pdf_exports ?? 0) < max;
    };

    const canTranscribeYoutube = (additionalMinutes: number = 0) => {
        const max = isPro ? LIMITS.PRO.youtube_minutes : LIMITS.FREE.youtube_minutes;
        return ((usage?.youtube_minutes_used ?? 0) + additionalMinutes) <= max;
    };

    const getRemainingYoutubeMinutes = () => {
        const max = isPro ? LIMITS.PRO.youtube_minutes : LIMITS.FREE.youtube_minutes;
        return max - (usage?.youtube_minutes_used ?? 0);
    };

    const canUseWebResearch = () => {
        const max = isPro ? LIMITS.PRO.web_research : LIMITS.FREE.web_research;
        return (usage?.web_research_used ?? 0) < max;
    };

    const canSendChatMessage = () => {
        const max = isPro ? LIMITS.PRO.chat_messages : LIMITS.FREE.chat_messages;
        return (usage?.chat_messages ?? 0) < max;
    };

    // ====== INCREMENTADORES ======

    const incrementUsage = async (type: 'roadmap' | 'feynman' | 'pdf_export' | 'youtube' | 'web_research' | 'chat', amount: number = 1) => {
        if (!user || !usage) return;

        const currentMonth = new Date().toISOString().substring(0, 7);

        const columnMap: Record<string, keyof UserUsage> = {
            roadmap: 'roadmaps_created',
            feynman: 'feynman_used',
            pdf_export: 'pdf_exports',
            youtube: 'youtube_minutes_used',
            web_research: 'web_research_used',
            chat: 'chat_messages'
        };

        const column = columnMap[type];
        const newValue = (usage[column] || 0) + amount;

        try {
            const { error } = await supabase!
                .from('user_usage')
                .update({ [column]: newValue })
                .eq('user_id', user.id)
                .eq('month', currentMonth);

            if (error) throw error;

            setUsage(prev => prev ? {
                ...prev,
                [column]: newValue
            } : null);
        } catch (error) {
            console.error('Erro ao incrementar uso:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            usage,
            loading,
            signOut,
            refreshProfile,
            isPro,
            limits,
            canCreateStudy,
            canUseFeynman,
            canExportPDF,
            canTranscribeYoutube,
            canUseWebResearch,
            canSendChatMessage,
            getRemainingYoutubeMinutes,
            incrementUsage
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
