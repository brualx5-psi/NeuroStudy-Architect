import { StudySession, Folder, UserProfile } from '../types';
import { supabase } from './supabase';
import { getProfile } from './userProfileService';

const LOCAL_STORAGE_KEY = 'neurostudy_data';

export type SaveUserDataResult = {
  localSaved: boolean;
  cloudSaved: boolean;
  cloudSkipped?: boolean;
  error?: string;
};

type UserDataContent = {
  studies?: StudySession[];
  folders?: Folder[];
  profile?: UserProfile | null;
  updatedAt?: number;
  [key: string]: unknown;
};

type LocalUserData = {
  studies: StudySession[];
  folders: Folder[];
  updatedAt?: number;
};

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

export const saveLocalBackupNow = (studies: StudySession[], folders: Folder[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ studies, folders, updatedAt: Date.now() }));
};

const readLocalBackup = (): LocalUserData | null => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) return null;
  const parsed = JSON.parse(data) as Partial<LocalUserData>;
  return {
    studies: Array.isArray(parsed.studies) ? parsed.studies : [],
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined
  };
};

const hasUserData = (data: LocalUserData | { studies?: StudySession[]; folders?: Folder[] } | null | undefined) => {
  return Boolean((data?.studies?.length || 0) > 0 || (data?.folders?.length || 0) > 0);
};

/**
 * Salva os dados do usuário, escolhendo entre Supabase (Modo Nuvem) ou LocalStorage (Modo Local/Amigos).
 * Permite receber o userId já resolvido para evitar corrida com auth.getUser().
 */
export const saveUserData = async (studies: StudySession[], folders: Folder[], userIdOverride?: string): Promise<SaveUserDataResult> => {
  let localSaved = false;
  try {
    // O backup local precisa ser imediato: se o usuário fechar a aba logo após criar/gerar,
    // requestIdleCallback/setTimeout pode não rodar e o estudo some até do mesmo aparelho.
    saveLocalBackupNow(studies, folders);
    localSaved = true;
  } catch (err) {
    console.warn('[Storage] Erro ao salvar backup local:', err);
  }

  if (!isCloudMode()) return { localSaved, cloudSaved: false, cloudSkipped: true };

  try {
    const userId = userIdOverride ?? await getAuthenticatedUserId();
    if (!userId) {
      console.warn('[Storage] Usuário não autenticado para salvar na nuvem.');
      return { localSaved, cloudSaved: false, cloudSkipped: true, error: 'Usuário não autenticado para salvar na nuvem.' };
    }

    // Usa upsert para evitar condição de corrida e erros de chave duplicada
    const profile = getProfile();
    const payload = {
      user_id: userId,
      content: { studies, folders, updatedAt: Date.now(), ...(profile ? { profile } : {}) },
      updated_at: new Date().toISOString()
    };
    console.log('[Storage] Salvando para user_id:', userId);
    console.log('[Storage] Studies no payload:', payload.content.studies?.length || 0);

    const { data, error } = await supabase!
      .from('user_data')
      .upsert(payload, { onConflict: 'user_id' })
      .select();

    console.log('[Storage] Resposta do upsert:', { data, error });

    if (error) {
      console.warn('[Storage] Erro ao salvar na nuvem:', error.message, error.details, error.hint);
      return { localSaved, cloudSaved: false, error: error.message };
    } else {
      console.log('[Storage] Salvo com sucesso! Data retornado:', data);
      return { localSaved, cloudSaved: true };
    }
  } catch (err) {
    console.warn('[Storage] Exceção ao salvar na nuvem (dados salvos localmente):', err);
    return { localSaved, cloudSaved: false, error: err instanceof Error ? err.message : 'Erro desconhecido ao salvar na nuvem.' };
  }
};

/**
 * Carrega os dados, tentando primeiro o Supabase e, se não for configurado, usa o LocalStorage.
 * Permite receber o userId já resolvido para evitar corrida com auth.getUser().
 */
export const loadUserData = async (userIdOverride?: string): Promise<{ studies: StudySession[]; folders: Folder[] }> => {
  const defaultData = { studies: [], folders: [] };

  if (!isCloudMode()) {
    return readLocalBackup() || defaultData;
  }

  try {
    const userId = userIdOverride ?? await getAuthenticatedUserId();
    if (!userId) {
      console.warn('[Storage] Usuário não autenticado, usando localStorage.');
      return readLocalBackup() || defaultData;
    }

    console.log('[Storage] Carregando para user_id:', userId);
    const { data, error } = await supabase!
      .from('user_data')
      .select('content, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('[Storage] Resposta do banco:', { data, error, hasContent: !!data?.content, studiesCount: data?.content?.studies?.length });

    if (error) {
      console.warn('[Storage] Erro ao carregar da nuvem, usando localStorage como fallback:', error.message);
      return readLocalBackup() || defaultData;
    }

    const localData = readLocalBackup();

    if (!data) {
      if (hasUserData(localData)) {
        console.warn('[Storage] Nenhum registro na nuvem; recuperando backup local e migrando para a nuvem.');
        void saveUserData(localData!.studies, localData!.folders, userId);
        return localData!;
      }
      console.warn('[Storage] Nenhum registro encontrado para este user_id, retornando dados vazios');
      return defaultData;
    }

    const content = (data.content || defaultData) as UserDataContent;
    const remoteData = {
      studies: content.studies || [],
      folders: content.folders || []
    };
    const remoteUpdatedAt = typeof content.updatedAt === 'number'
      ? content.updatedAt
      : data.updated_at
        ? Date.parse(data.updated_at)
        : 0;
    const localLooksNewer = hasUserData(localData) && (
      (localData?.updatedAt || 0) > remoteUpdatedAt ||
      (!localData?.updatedAt && (localData?.studies.length || 0) > remoteData.studies.length)
    );

    if (localLooksNewer) {
      console.warn('[Storage] Backup local parece mais novo que a nuvem; usando local e migrando para a nuvem.');
      void saveUserData(localData!.studies, localData!.folders, userId);
      return localData!;
    }

    if (!hasUserData(remoteData) && hasUserData(localData)) {
      console.warn('[Storage] Nuvem vazia; usando backup local para evitar perda de estudos neste aparelho.');
      void saveUserData(localData!.studies, localData!.folders, userId);
      return localData!;
    }

    console.log('[Storage] Retornando dados:', { studies: content.studies?.length || 0, folders: content.folders?.length || 0 });
    return remoteData;
  } catch (err) {
    console.warn('[Storage] Exceção ao carregar da nuvem, usando localStorage:', err);
    return readLocalBackup() || defaultData;
  }
};
