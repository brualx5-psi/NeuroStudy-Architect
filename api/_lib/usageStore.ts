import { getSupabaseAdmin } from './supabase.js';
import { PlanName } from './planLimits.js';
import { UsageSnapshot } from './usageLimits.js';

export type UsageRow = {
  id?: string;
  user_id: string;
  month: string;
  plan: PlanName;
  roadmaps_created: number;
  web_searches_used: number;
  youtube_minutes_used: number;
  chat_messages: number;
  tokens_estimated: number;
  tokens_used: number;
  chat_tokens_estimated: number;
  chat_tokens_used: number;
  created_at?: string;
  updated_at?: string;
};

export type UserAccess = {
  planName: PlanName;
  isAdmin: boolean;
};

export type UsageDeltas = Partial<
  Pick<
    UsageRow,
    | 'roadmaps_created'
    | 'web_searches_used'
    | 'youtube_minutes_used'
    | 'chat_messages'
    | 'tokens_estimated'
    | 'tokens_used'
    | 'chat_tokens_estimated'
    | 'chat_tokens_used'
  >
>;

const globalStore = globalThis as typeof globalThis & { __usageStore?: Map<string, UsageRow> };
const localStore = globalStore.__usageStore || new Map<string, UsageRow>();
globalStore.__usageStore = localStore;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeUsageRow = (row: UsageRow): UsageRow => ({
  ...row,
  roadmaps_created: toNumber(row.roadmaps_created),
  web_searches_used: toNumber(row.web_searches_used),
  youtube_minutes_used: toNumber(row.youtube_minutes_used),
  chat_messages: toNumber(row.chat_messages),
  tokens_estimated: toNumber(row.tokens_estimated),
  tokens_used: toNumber(row.tokens_used),
  chat_tokens_estimated: toNumber(row.chat_tokens_estimated),
  chat_tokens_used: toNumber(row.chat_tokens_used)
});

const mapPlanName = (status?: string | null): PlanName => {
  if (status === 'starter' || status === 'pro' || status === 'free') return status;
  if (status === 'premium') return 'pro';
  return 'free';
};

const createEmptyUsage = (userId: string, month: string, plan: PlanName): UsageRow => ({
  user_id: userId,
  month,
  plan,
  roadmaps_created: 0,
  web_searches_used: 0,
  youtube_minutes_used: 0,
  chat_messages: 0,
  tokens_estimated: 0,
  tokens_used: 0,
  chat_tokens_estimated: 0,
  chat_tokens_used: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

export const getCurrentMonth = () => new Date().toISOString().substring(0, 7);

export const getUserPlan = async (userId: string): Promise<PlanName> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 'free';
  const { data } = await supabase
    .from('users')
    .select('subscription_status')
    .eq('id', userId)
    .single();
  return mapPlanName(data?.subscription_status);
};

export const getUserAccess = async (userId: string): Promise<UserAccess> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { planName: 'free', isAdmin: false };
  const { data } = await supabase
    .from('users')
    .select('subscription_status, is_admin')
    .eq('id', userId)
    .single();
  return {
    planName: mapPlanName(data?.subscription_status),
    isAdmin: Boolean(data?.is_admin)
  };
};

export const ensureUsageRow = async (
  userId: string,
  month: string,
  plan: PlanName
): Promise<UsageRow> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const key = `${userId}:${month}`;
    const existing = localStore.get(key);
    if (existing) return existing;
    const created = createEmptyUsage(userId, month, plan);
    localStore.set(key, created);
    return created;
  }

  try {
    const { data, error } = await supabase
      .from('user_usage_monthly')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    if (data && !error) {
      return normalizeUsageRow(data as UsageRow);
    }

    // When creating new record, fetch actual plan from users table to avoid using default 'free'
    const actualPlan = await getUserPlan(userId);
    const fresh = createEmptyUsage(userId, month, actualPlan);
    const { data: inserted, error: insertError } = await supabase
      .from('user_usage_monthly')
      .insert([fresh])
      .select()
      .single();

    if (insertError || !inserted) {
      const key = `${userId}:${month}`;
      localStore.set(key, fresh);
      return fresh;
    }

    return normalizeUsageRow(inserted as UsageRow);
  } catch {
    const key = `${userId}:${month}`;
    const existing = localStore.get(key);
    if (existing) return existing;
    const created = createEmptyUsage(userId, month, plan);
    localStore.set(key, created);
    return created;
  }
};

export const getUsage = async (userId: string, month: string): Promise<UsageRow | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return localStore.get(`${userId}:${month}`) || null;
  }

  try {
    const { data, error } = await supabase
      .from('user_usage_monthly')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    if (error || !data) return null;
    return normalizeUsageRow(data as UsageRow);
  } catch {
    return localStore.get(`${userId}:${month}`) || null;
  }
};

export const incrementUsage = async (
  userId: string,
  month: string,
  plan: PlanName,
  deltas: UsageDeltas
) => {
  const supabase = getSupabaseAdmin();
  console.log('[incrementUsage] supabase available:', !!supabase, 'userId:', userId, 'month:', month, 'deltas:', deltas);
  const current = normalizeUsageRow(await ensureUsageRow(userId, month, plan));
  const updatedAt = new Date().toISOString();

  // IMPORTANT: Preserve the existing plan from database, don't overwrite with default
  // Only use the passed plan as fallback if current.plan is not set
  const effectivePlan = current.plan || plan;

  const next: UsageRow = {
    ...current,
    ...deltas,
    plan: effectivePlan,
    updated_at: updatedAt
  };

  (Object.keys(deltas) as (keyof UsageDeltas)[]).forEach((key) => {
    const delta = deltas[key];
    if (typeof delta !== 'number') return;
    const base = toNumber((current as any)[key]);
    (next as any)[key] = base + delta;
  });

  if (!supabase) {
    localStore.set(`${userId}:${month}`, next);
    return next;
  }

  try {
    console.log('[incrementUsage] Attempting update for userId:', userId, 'month:', month, 'next values:', JSON.stringify(next));
    const { data, error } = await supabase
      .from('user_usage_monthly')
      .update({
        roadmaps_created: next.roadmaps_created,
        web_searches_used: next.web_searches_used,
        youtube_minutes_used: next.youtube_minutes_used,
        chat_messages: next.chat_messages,
        tokens_estimated: next.tokens_estimated,
        tokens_used: next.tokens_used,
        chat_tokens_estimated: next.chat_tokens_estimated,
        chat_tokens_used: next.chat_tokens_used,
        plan: next.plan,
        updated_at: updatedAt
      })
      .eq('user_id', userId)
      .eq('month', month)
      .select()
      .single();

    if (error) {
      console.error('[incrementUsage] Update error:', error.message, error.code);
    } else {
      console.log('[incrementUsage] Update success, data:', data ? 'returned' : 'null');
    }

    try {
      await supabase
        .from('user_usage')
        .update({
          roadmaps_created: next.roadmaps_created,
          youtube_minutes_used: next.youtube_minutes_used,
          web_research_used: next.web_searches_used,
          chat_messages: next.chat_messages,
          monthly_tokens_used: next.tokens_estimated || next.tokens_used,
          chat_tokens_used: next.chat_tokens_estimated || next.chat_tokens_used,
          updated_at: next.updated_at
        })
        .eq('user_id', userId)
        .eq('month', month);
    } catch {
      // ignore legacy table errors
    }

    return (data as UsageRow) || next;
  } catch {
    localStore.set(`${userId}:${month}`, next);
    return next;
  }
};

export const toUsageSnapshot = (row: UsageRow | null): UsageSnapshot => ({
  roadmaps_created: toNumber(row?.roadmaps_created),
  youtube_minutes_used: toNumber(row?.youtube_minutes_used),
  web_research_used: toNumber(row?.web_searches_used),
  chat_messages: toNumber(row?.chat_messages),
  monthly_tokens_used: toNumber(row?.tokens_estimated ?? row?.tokens_used),
  chat_tokens_used: toNumber(row?.chat_tokens_estimated ?? row?.chat_tokens_used)
});
