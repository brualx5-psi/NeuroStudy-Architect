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

    const getSupabaseClient = () => {
        if (!supabase) {
            console.error('Supabase não configurado');
            return null;
        }
        return supabase;
    };

    // Sincroniza dados do Google OAuth com a tabela users
    const syncGoogleProfile = async (authUser: User) => {
        const client = getSupabaseClient();
        if (!client) return;

        // Extrai dados do Google OAuth
        const googleName = authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split('@')[0];
        const googleAvatar = authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.picture;
        const googleEmail = authUser.email;

        if (!googleName && !googleAvatar) return; // Nada para sincronizar

        try {
            // Verifica se o perfil já existe
            const { data: existingProfile, error: fetchError } = await client
                .from('users')
                .select('id, full_name, avatar_url')
                .eq('id', authUser.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Erro ao verificar perfil para sync:', fetchError);
                return;
            }

            // Se o perfil não existe, criar um novo
            if (!existingProfile) {
                console.log('Criando novo perfil com dados do Google...');
                const { error: insertError } = await client
                    .from('users')
                    .insert({
                        id: authUser.id,
                        email: googleEmail,
                        full_name: googleName,
                        avatar_url: googleAvatar,
                        subscription_status: 'free'
                    });

                if (insertError) {
                    console.error('Erro ao criar perfil:', insertError);
                }
                return;
            }

            // Se o perfil existe mas tem campos NULL, atualizar
            const updates: Record<string, string> = {};
            if (!existingProfile.full_name && googleName) {
                updates.full_name = googleName;
            }
            if (!existingProfile.avatar_url && googleAvatar) {
                updates.avatar_url = googleAvatar;
            }

            if (Object.keys(updates).length > 0) {
                console.log('Atualizando perfil com dados do Google:', updates);
                const { error: updateError } = await client
                    .from('users')
                    .update(updates)
                    .eq('id', authUser.id);

                if (updateError) {
                    console.error('Erro ao atualizar perfil:', updateError);
                }
            }
        } catch (error) {
            console.error('Erro ao sincronizar perfil Google:', error);
        }
    };

    const fetchProfile = async (userId: string) => {
        const client = getSupabaseClient();
        if (!client) return;

        try {
            const { data, error } = await client
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                // Se o usuário não existe na tabela, criar um perfil básico
                if (error.code === 'PGRST116') {
                    console.log('Perfil não encontrado, criando novo perfil...');
                    // Perfil não existe, definir como null - o app continua funcionando
                    setProfile(null);
                } else {
                    console.error('Erro ao buscar perfil:', error);
                    setProfile(null);
                }
            } else {
                setProfile(data);
            }

            // Tenta buscar uso, mas não bloqueia se falhar
            try {
                await fetchUsage(userId);
            } catch (usageError) {
                console.error('Erro ao buscar uso, continuando sem dados de uso:', usageError);
                setUsage(null);
            }
        } catch (error) {
            console.error('Erro crítico ao buscar perfil:', error);
            setProfile(null);
            setUsage(null);
        }
    };

    const fetchUsage = async (userId: string) => {
        const client = getSupabaseClient();
        if (!client) return;

        const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        try {
            let { data, error } = await client
                .from('user_usage')
                .select('roadmaps_created, feynman_used, pdf_exports, youtube_minutes_used, web_research_used, chat_messages')
                .eq('user_id', userId)
                .eq('month', currentMonth)
                .single();

            if (error && error.code === 'PGRST116') {
                // Não encontrou uso para este mês, tentar criar um novo
                try {
                    const { data: newData, error: insertError } = await client
                        .from('user_usage')
                        .insert([{ user_id: userId, month: currentMonth }])
                        .select()
                        .single();

                    if (insertError) {
                        console.error('Erro ao criar registro de uso, continuando sem:', insertError);
                        setUsage(null);
                        return;
                    }
                    data = newData;
                } catch (insertErr) {
                    console.error('Erro ao inserir uso:', insertErr);
                    setUsage(null);
                    return;
                }
            } else if (error) {
                // Tabela pode não existir ou outro erro
                console.error('Erro ao buscar uso (tabela pode não existir):', error);
                setUsage(null);
                return;
            }

            setUsage(data);
        } catch (error) {
            console.error('Erro ao buscar consumo:', error);
            setUsage(null);
        }
    };

    useEffect(() => {
        // Se não tiver supabase, não faz nada
        const client = getSupabaseClient();
        if (!client) {
            setLoading(false);
            return;
        }

        const persistSessionFromUrl = async () => {
            // Fluxo PKCE: Supabase devolve ?code=...
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            if (code) {
                try {
                    const { data, error } = await client.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    if (data?.session?.user) {
                        await syncGoogleProfile(data.session.user);
                        await fetchProfile(data.session.user.id);
                    }
                } catch (err) {
                    console.error('Erro ao trocar code por sessao:', err);
                } finally {
                    // Limpa a URL
                    window.history.replaceState(null, '', window.location.pathname);
                }
                return;
            }

            // Fluxo antigo: tokens no hash
            if (!window.location.hash) return;
            const hash = window.location.hash.substring(1);
            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (!accessToken || !refreshToken) return;

            try {
                const { error } = await client.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (error) throw error;
            } catch (err) {
                console.error('Erro ao definir sessao (hash):', err);
            } finally {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        };

        const initAuth = async () => {
            try {
                await persistSessionFromUrl();
                const { data: { session }, error } = await client.auth.getSession();
                if (error) throw error;
                setUser(session?.user ?? null);
                if (session?.user) {
                    await syncGoogleProfile(session.user);
                    await fetchProfile(session.user.id);
                }
            } catch (err) {
                console.error('Erro ao inicializar auth:', err);
                setUser(null);
                setProfile(null);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
            try {
                setUser(session?.user ?? null);
                if (session?.user) {
                    await syncGoogleProfile(session.user);
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                console.error('Erro no onAuthStateChange:', err);
                setUser(null);
                setProfile(null);
            } finally {
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        const client = getSupabaseClient();
        if (!client) return;
        await client.auth.signOut();
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

        const client = getSupabaseClient();
        if (!client) return;

        try {
            const { error } = await client
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
