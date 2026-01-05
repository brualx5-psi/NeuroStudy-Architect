
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { PLAN_LABELS, PLAN_LIMITS, PlanLimits, PlanName } from '../config/planLimits';

// Definição dos tipos
type SubscriptionStatus = 'free' | 'starter' | 'pro' | 'premium';

type UserProfile = {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    study_area: string | null;
    study_purpose: string | null;
    subscription_status: SubscriptionStatus;
    is_admin?: boolean;
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
    monthly_tokens_used: number;
    chat_tokens_used: number;
    updated_at: string;
};

type UsageLimits = PlanLimits;

type UsageMetric = keyof UserUsage;

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    usage: UserUsage | null;
    loading: boolean;
    planName: PlanName;
    planLabel: string;
    isPaid: boolean;
    isPro: boolean;
    isAdmin: boolean;
    limits: UsageLimits;
    canCreateStudy: () => boolean;
    canUseFeynman: () => boolean;
    incrementUsage: (updates: Partial<Record<UsageMetric, number>>) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const USAGE_STORAGE_PREFIX = 'neurostudy_usage';
// TODO: localStorage é apenas fallback e não é seguro para planos pagos.

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    usage: null,
    loading: true,
    planName: 'free',
    planLabel: PLAN_LABELS.free,
    isPaid: false,
    isPro: false,
    isAdmin: false,
    limits: PLAN_LIMITS.free,
    canCreateStudy: () => true,
    canUseFeynman: () => true,
    incrementUsage: async () => { },
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [usage, setUsage] = useState<UserUsage | null>(null);
    const [loading, setLoading] = useState(true);

    const resolvePlanName = (status?: SubscriptionStatus | null): PlanName => {
        if (status === 'starter' || status === 'pro' || status === 'free') return status;
        if (status === 'premium') return 'pro';
        return 'free';
    };

    const planName = resolvePlanName(profile?.subscription_status);
    const limits = PLAN_LIMITS[planName];
    const planLabel = PLAN_LABELS[planName];
    const isAdmin = Boolean(profile?.is_admin);
    const isPaid = isAdmin || planName !== 'free';
    const isPro = planName === 'pro';

    const getCurrentMonth = () => new Date().toISOString().substring(0, 7);

    const createEmptyUsage = (userId: string, month: string): UserUsage => ({
        user_id: userId,
        month,
        roadmaps_created: 0,
        feynman_used: 0,
        pdf_exports: 0,
        youtube_minutes_used: 0,
        web_research_used: 0,
        chat_messages: 0,
        monthly_tokens_used: 0,
        chat_tokens_used: 0,
        updated_at: new Date().toISOString()
    });

    const normalizeUsage = (data: Partial<UserUsage> | null, userId: string, month: string) => ({
        ...createEmptyUsage(userId, month),
        ...(data || {})
    });

    const getUsageStorageKey = (userId: string, month: string) => `${USAGE_STORAGE_PREFIX}:${userId}:${month}`;

    const loadLocalUsage = (userId: string, month: string): UserUsage | null => {
        const raw = localStorage.getItem(getUsageStorageKey(userId, month));
        if (!raw) return null;
        try {
            return JSON.parse(raw) as UserUsage;
        } catch {
            return null;
        }
    };

    const saveLocalUsage = (data: UserUsage) => {
        localStorage.setItem(getUsageStorageKey(data.user_id, data.month), JSON.stringify(data));
    };

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
        const currentMonth = getCurrentMonth();

        if (!client) {
            const localUsage = loadLocalUsage(userId, currentMonth);
            setUsage(normalizeUsage(localUsage, userId, currentMonth));
            return;
        }

        try {
            let { data, error } = await client
                .from('user_usage_monthly')
                .select('*')
                .eq('user_id', userId)
                .eq('month', currentMonth)
                .single();

            if (error && error.code === 'PGRST116') {
                const { data: newData, error: insertError } = await client
                    .from('user_usage_monthly')
                    .insert([createEmptyUsage(userId, currentMonth)])
                    .select()
                    .single();

                if (!insertError) data = newData;
            }

            if (data) {
                const normalized = normalizeUsage(data, userId, currentMonth);
                setUsage(normalized);
                saveLocalUsage(normalized);
            } else {
                setUsage(normalizeUsage(null, userId, currentMonth));
            }
        } catch (error) {
            console.error('Erro ao buscar consumo:', error);
            const localUsage = loadLocalUsage(userId, currentMonth);
            setUsage(normalizeUsage(localUsage, userId, currentMonth));
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
        if (isAdmin) return true;
        if (!usage) return true;
        return usage.roadmaps_created < limits.roadmaps;
    };

    const canUseFeynman = () => {
        if (isAdmin) return true;
        if (isPaid) return true;
        if (!usage) return true;
        return usage.feynman_used < 3;
    };

    const incrementUsage = async (updates: Partial<Record<UsageMetric, number>>) => {
        if (!user) return;
        const client = getSupabaseClient();
        const currentMonth = getCurrentMonth();
        const current = normalizeUsage(usage, user.id, currentMonth);
        const updatedAt = new Date().toISOString();

        const nextUsage = { ...current, updated_at: updatedAt };
        Object.entries(updates).forEach(([key, value]) => {
            if (typeof value !== 'number') return;
            const typedKey = key as UsageMetric;
            const currentValue = (nextUsage[typedKey] as number) || 0;
            nextUsage[typedKey] = currentValue + value;
        });

        setUsage(nextUsage);
        saveLocalUsage(nextUsage);

        if (!client) return;

        try {
            const updateFields: Record<string, number | string> = { updated_at: updatedAt };
            Object.keys(updates).forEach((key) => {
                const typedKey = key as UsageMetric;
                updateFields[typedKey] = nextUsage[typedKey] as number;
            });
            await client
                .from('user_usage_monthly')
                .update(updateFields)
                .eq('user_id', user.id)
                .eq('month', currentMonth);
        } catch (error) {
            console.error('Erro ao incrementar uso:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, usage, loading, planName, planLabel, isPaid, isPro, isAdmin, limits, canCreateStudy, canUseFeynman, incrementUsage, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
