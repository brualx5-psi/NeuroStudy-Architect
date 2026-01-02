
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

// Definição dos tipos
type UserProfile = {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    study_area: string | null;
    study_purpose: string | null;
    subscription_status: 'free' | 'premium';
    created_at: string;
};

type UserUsage = {
    user_id: string;
    month: string;
    roadmaps_created: number;
    feynman_used: number;
    pdf_exports: number;
    youtube_minutes_used: number;
    web_research_used: number;
    chat_messages: number;
    updated_at: string;
};

type UsageLimits = {
    roadmaps: number;
    youtube_minutes: number;
    web_research: number;
    chat_messages: number;
    sources_per_study: number;
    pages_per_source: number;
};

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    usage: UserUsage | null;
    loading: boolean;
    isPro: boolean;
    limits: UsageLimits;
    canCreateStudy: () => boolean;
    incrementUsage: (type: keyof UserUsage) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const FREE_LIMITS: UsageLimits = {
    roadmaps: 3,
    youtube_minutes: 30,
    web_research: 10,
    chat_messages: 20,
    sources_per_study: 3,
    pages_per_source: 50
};

const PRO_LIMITS: UsageLimits = {
    roadmaps: 1000,
    youtube_minutes: 10000,
    web_research: 1000,
    chat_messages: 10000,
    sources_per_study: 20,
    pages_per_source: 500
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    usage: null,
    loading: true,
    isPro: false,
    limits: FREE_LIMITS,
    canCreateStudy: () => true,
    incrementUsage: async () => { },
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [usage, setUsage] = useState<UserUsage | null>(null);
    const [loading, setLoading] = useState(true);

    // Derivados
    const isPro = profile?.subscription_status === 'premium';
    const limits = isPro ? PRO_LIMITS : FREE_LIMITS;

    const getSupabaseClient = () => {
        if (!supabase) {
            console.error('Supabase não configurado');
            return null;
        }
        return supabase;
    };

    const syncGoogleProfile = async (authUser: User) => {
        const client = getSupabaseClient();
        if (!client) return;

        const googleName = authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split('@')[0];
        const googleAvatar = authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.picture;
        const googleEmail = authUser.email;

        try {
            const { data: existingProfile } = await client
                .from('users')
                .select('id, full_name, avatar_url')
                .eq('id', authUser.id)
                .single();

            if (!existingProfile) {
                console.log('Criando novo perfil com dados do Google...');
                await client.from('users').insert({
                    id: authUser.id,
                    email: googleEmail,
                    full_name: googleName,
                    avatar_url: googleAvatar,
                    subscription_status: 'free'
                });
                return;
            }

            const updates: Record<string, string> = {};
            if (!existingProfile.full_name && googleName) updates.full_name = googleName;
            if (!existingProfile.avatar_url && googleAvatar) updates.avatar_url = googleAvatar;

            if (Object.keys(updates).length > 0) {
                console.log('Atualizando perfil com dados do Google:', updates);
                await client.from('users').update(updates).eq('id', authUser.id);
            }
        } catch (error) {
            console.error('Erro ao sincronizar perfil Google (ignorado):', error);
        }
    };

    const fetchUsage = async (userId: string) => {
        const client = getSupabaseClient();
        if (!client) return;

        const currentMonth = new Date().toISOString().substring(0, 7);
        try {
            let { data, error } = await client
                .from('user_usage')
                .select('*')
                .eq('user_id', userId)
                .eq('month', currentMonth)
                .single();

            if (error && error.code === 'PGRST116') {
                const { data: newData, error: insertError } = await client
                    .from('user_usage')
                    .insert([{ user_id: userId, month: currentMonth }])
                    .select()
                    .single();

                if (!insertError) data = newData;
            }

            if (data) setUsage(data);
            else setUsage(null);
        } catch (error) {
            console.error('Erro ao buscar consumo:', error);
            setUsage(null);
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

            if (data) {
                setProfile(data);
                await fetchUsage(userId);
            } else {
                setProfile(null);
                setUsage(null);
            }
        } catch (error) {
            console.error('Erro crítico ao buscar perfil:', error);
            setProfile(null);
            setUsage(null);
        }
    };

    useEffect(() => {
        console.log('🔵 [Auth] useEffect iniciado (Manual + Listener)');
        const client = getSupabaseClient();

        if (!client) {
            console.log('🔴 [Auth] Sem cliente, finalizando');
            setLoading(false);
            return;
        }

        // Teste de Conectividade
        console.log('🔵 [Debug] Testando conexão com banco de dados...');
        (async () => {
            try {
                const { count, error } = await client.from('users').select('count', { count: 'exact', head: true });
                if (error) console.error('🔴 [Debug] Erro de conexão DB:', error);
                else console.log('🟢 [Debug] Conexão DB OK! Count:', count);
            } catch (err: any) {
                console.error('🔴 [Debug] Exceção na conexão DB:', err);
            }
        })();

        // Timeout de segurança (3s)
        const authTimeout = setTimeout(() => {
            console.warn('⚠️ [Auth] Timeout de segurança atingido. Liberando app.');
            setLoading(false);
        }, 3000);

        // 1. Tentar parsear o hash manualmente (Google OAuth)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            console.log('🔵 [Auth] Hash encontrado, tentando setar sessão manualmente...');
            const params = new URLSearchParams(hash.substring(1)); // remove #
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (access_token && refresh_token) {
                client.auth.setSession({ access_token, refresh_token })
                    .then(({ data, error }) => {
                        if (error) {
                            console.error('🔴 [Auth] Erro ao setar sessão manual:', error);
                        } else {
                            console.log('🟢 [Auth] Sessão manual definida com sucesso:', data.session?.user?.email);
                        }
                    })
                    .catch(err => console.error('🔴 [Auth] Exceção no setSession:', err));
            }
        }

        // 2. Listener oficial
        const { data: { subscription } } = client.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
            console.log('🔔 [Auth] Evento:', event, session?.user?.email ?? 'sem usuário');

            clearTimeout(authTimeout);

            if (session?.user) {
                setUser(session.user);

                if (window.location.hash && window.location.hash.includes('access_token')) {
                    window.history.replaceState(null, '', window.location.pathname);
                }

                syncGoogleProfile(session.user)
                    .then(() => fetchProfile(session.user.id))
                    .finally(() => setLoading(false));
            } else {
                if (!window.location.hash.includes('access_token')) {
                    setUser(null);
                    setProfile(null);
                    setUsage(null);
                    setLoading(false);
                }
            }
        });

        return () => {
            clearTimeout(authTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        const client = getSupabaseClient();
        if (!client) return;
        setLoading(true);
        await client.auth.signOut();
        setUser(null);
        setProfile(null);
        setUsage(null);
        setLoading(false);
    };


    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const canCreateStudy = () => {
        if (!usage) return true;
        return usage.roadmaps_created < limits.roadmaps;
    };

    const incrementUsage = async (type: keyof UserUsage) => {
        const client = getSupabaseClient();
        if (!client || !user || !usage) return;

        const currentMonth = new Date().toISOString().substring(0, 7);
        const currentValue = (usage[type] as number) || 0;

        try {
            await client
                .from('user_usage')
                .update({ [type]: currentValue + 1 })
                .eq('user_id', user.id)
                .eq('month', currentMonth);

            // Atualizar estado local
            setUsage(prev => prev ? { ...prev, [type]: currentValue + 1 } : prev);
        } catch (error) {
            console.error('Erro ao incrementar uso:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, usage, loading, isPro, limits, canCreateStudy, incrementUsage, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
