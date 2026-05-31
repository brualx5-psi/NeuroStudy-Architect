import { supabase } from './supabase';

export type SupportPayload = {
  category: 'bug' | 'feedback' | 'billing' | 'content' | 'other';
  subject: string;
  message: string;
  pageUrl?: string;
  userAgent?: string;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const sendSupportFeedback = async (payload: SupportPayload) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch('/api/support', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Não foi possível enviar o suporte agora.');
  }
  return data as { ok: true };
};
