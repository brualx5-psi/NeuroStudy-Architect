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
 * Permite receber o userId já resolvido para evitar corrida com auth.getUser().
 */
export const saveUserData = async (studies: StudySession[], folders: Folder[], userIdOverride?: string) => {
  // Sempre salva no localStorage como backup.
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ studies, folders }));

  if (!isCloudMode()) return;

  try {
    const userId = userIdOverride ?? await getAuthenticatedUserId();
    if (!userId) {
      console.warn('[Storage] Usuário não autenticado para salvar na nuvem.');
      return;
    }

    // Usa upsert para evitar condição de corrida e erros de chave duplicada
    const payload = {
      user_id: userId,
      content: { studies, folders },
      updated_at: new Date().toISOString()
    };
    console.log('[Storage] Salvando para user_id:', userId);
    console.log('[Storage] Payload completo:', JSON.stringify(payload).slice(0, 500) + '...');
    console.log('[Storage] Studies no payload:', payload.content.studies?.length || 0);

    const { data, error } = await supabase!
      .from('user_data')
      .upsert(payload, { onConflict: 'user_id' })
      .select();

    console.log('[Storage] Resposta do upsert:', { data, error });

    if (error) {
      console.warn('[Storage] Erro ao salvar na nuvem:', error.message, error.details, error.hint);
    } else {
      console.log('[Storage] Salvo com sucesso! Data retornado:', data);
    }
  } catch (err) {
    console.warn('[Storage] Exceção ao salvar na nuvem (dados salvos localmente):', err);
  }
};

/**
 * Carrega os dados, tentando primeiro o Supabase e, se não for configurado, usa o LocalStorage.
 * Permite receber o userId já resolvido para evitar corrida com auth.getUser().
 */
export const loadUserData = async (userIdOverride?: string): Promise<{ studies: StudySession[]; folders: Folder[] }> => {
  const defaultData = { studies: [], folders: [] };

  if (!isCloudMode()) {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : defaultData;
  }

  try {
    const userId = userIdOverride ?? await getAuthenticatedUserId();
    if (!userId) {
      console.warn('[Storage] Usuário não autenticado, usando localStorage.');
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : defaultData;
    }

    console.log('[Storage] Carregando para user_id:', userId);
    const { data, error } = await supabase!
      .from('user_data')
      .select('content')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('[Storage] Resposta do banco:', { data, error, hasContent: !!data?.content, studiesCount: data?.content?.studies?.length });

    if (error) {
      console.warn('[Storage] Erro ao carregar da nuvem, usando localStorage como fallback:', error.message);
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : defaultData;
    }

    if (!data) {
      console.warn('[Storage] Nenhum registro encontrado para este user_id, retornando dados vazios');
      // Não tenta criar linha aqui - deixa o primeiro saveUserData criar
      return defaultData;
    }

    console.log('[Storage] Retornando dados:', { studies: data.content?.studies?.length || 0, folders: data.content?.folders?.length || 0 });
    return data.content || defaultData;
  } catch (err) {
    console.warn('[Storage] Exceção ao carregar da nuvem, usando localStorage:', err);
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return localData ? JSON.parse(localData) : defaultData;
  }
};
