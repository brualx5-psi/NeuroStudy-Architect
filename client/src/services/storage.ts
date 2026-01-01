import { StudySession, Folder } from '../types';
import { supabase } from './supabase';

const LOCAL_STORAGE_KEY = 'neurostudy_data';

/**
 * Verifica se o modo nuvem (Supabase) está ativo.
 */
export const isCloudMode = () => !!supabase;

/**
 * Salva os dados do usuário, escolhendo entre Supabase (Modo Nuvem) ou LocalStorage (Modo Local/Amigos).
 */
export const saveUserData = async (studies: StudySession[], folders: Folder[]) => {
  // Sempre salva no localStorage como backup
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ studies, folders }));

  if (isCloudMode()) {
    // MODO NUVEM (Para ti): Tenta salvar no Supabase
    try {
      const { error } = await supabase!
        .from('user_data')
        .upsert({
          id: 1,
          content: { studies, folders },
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.warn('⚠️ Erro ao salvar na nuvem (dados salvos localmente):', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exceção ao salvar na nuvem (dados salvos localmente):', err);
    }
  }
};

/**
 * Carrega os dados, tentando primeiro o Supabase e, se não for configurado, usa o LocalStorage.
 */
export const loadUserData = async (): Promise<{ studies: StudySession[], folders: Folder[] }> => {
  const defaultData = { studies: [], folders: [] };

  if (isCloudMode()) {
    // MODO NUVEM
    try {
      const { data, error } = await supabase!
        .from('user_data')
        .select('content')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: Nenhuma linha encontrada (OK se for o primeiro acesso)
        console.warn('⚠️ Erro ao carregar da nuvem, usando localStorage como fallback:', error.message);
        // Fallback para localStorage se a tabela não existir ou outro erro
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        return localData ? JSON.parse(localData) : defaultData;
      }
      return data?.content || defaultData;
    } catch (err) {
      console.warn('⚠️ Exceção ao carregar da nuvem, usando localStorage:', err);
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : defaultData;
    }
  } else {
    // MODO LOCAL
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : defaultData;
  }
};
