import { supabase } from './supabase';
import { InputType } from '../types';

export type LinkPreview = {
  url: string;
  title?: string;
  summary?: string;
  siteName?: string;
  doi?: string;
  source: 'doi' | 'url';
};

const getAuthHeaders = async () => {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
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
    const message = typeof payload?.message === 'string' ? payload.message : 'Falha ao carregar preview.';
    throw new Error(message);
  }
  return payload as T;
};

export const fetchLinkPreview = async (input: string, type: InputType, name?: string) =>
  postJson<LinkPreview>('/api/utils?action=preview', { input, type, name });
