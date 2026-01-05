import { StudySession, Folder } from '../types';
import { supabase } from './supabase';

const LOCAL_STORAGE_KEY = 'neurostudy_data';

/**
 * Verifica se o modo nuvem (Supabase) está ativo.
 */
export const isCloudMode = () => !!supabase;

const getAuthenticatedUserId = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
};

/**
 * Salva os dados do usuário, escolhendo entre Supabase (Modo Nuvem) ou LocalStorage (Modo Local/Amigos).
 */
export const saveUserData = async (studies: StudySession[], folders: Folder[]) => {
  // Sempre salva no localStorage como backup.
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ studies, folders }));

  if (!isCloudMode()) return;

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      console.warn('[Storage] Usuário não autenticado para salvar na nuvem.');
      return;
    }

    // Tenta atualizar primeiro para evitar conflito 409 no upsert
    const { data: existingData } = await supabase!
      .from('user_data')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let error = null;

    if (existingData) {
      const { error: updateError } = await supabase!
        .from('user_data')
        .update({
          content: { studies, folders },
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase!
        .from('user_data')
        .insert({
          user_id: userId,
          content: { studies, folders },
          updated_at: new Date().toISOString()
        });
      error = insertError;
    }

    if (error) {
      console.warn('[Storage] Erro ao salvar na nuvem (dados salvos localmente):', error.message);
    }
  } catch (err) {
    console.warn('[Storage] Exceção ao salvar na nuvem (dados salvos localmente):', err);
  }
};

/**
 * Carrega os dados, tentando primeiro o Supabase e, se não for configurado, usa o LocalStorage.
 */
export const loadUserData = async (): Promise<{ studies: StudySession[]; folders: Folder[] }> => {
  const defaultData = { studies: [], folders: [] };

  if (!isCloudMode()) {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : defaultData;
  }

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      console.warn('[Storage] Usuário não autenticado, usando localStorage.');
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : defaultData;
    }

    const { data, error } = await supabase!
      .from('user_data')
      .select('content')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Storage] Erro ao carregar da nuvem, usando localStorage como fallback:', error.message);
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : defaultData;
    }

    if (!data) {
      await supabase!
        .from('user_data')
        .insert({
          user_id: userId,
          content: defaultData,
          updated_at: new Date().toISOString()
        });
      return defaultData;
    }

    return data.content || defaultData;
  } catch (err) {
    console.warn('[Storage] Exceção ao carregar da nuvem, usando localStorage:', err);
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return localData ? JSON.parse(localData) : defaultData;
  }
};
