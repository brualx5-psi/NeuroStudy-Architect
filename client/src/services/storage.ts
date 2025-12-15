import { createClient } from '@supabase/supabase-js';
import { StudySession, Folder } from '../types';

// Configuração do Supabase (Sempre tenta conectar, mas só usa se for PRO)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Chaves para salvar no navegador (Backup e Modo Free)
const LOCAL_STUDIES = 'neuro_studies_data';
const LOCAL_FOLDERS = 'neuro_folders_data';

// Verifica se é VOCÊ (Dono)
const isProUser = () => localStorage.getItem('neurostudy_auth') === 'true';

export const storage = {
  // --- CARREGAR DADOS ---
  loadData: async () => {
    let studies: StudySession[] = [];
    let folders: Folder[] = [];

    // 1. Tenta carregar do LocalStorage primeiro (funciona offline e para Free)
    try {
      const localS = localStorage.getItem(LOCAL_STUDIES);
      const localF = localStorage.getItem(LOCAL_FOLDERS);
      if (localS) studies = JSON.parse(localS);
      if (localF) folders = JSON.parse(localF);
    } catch (e) {
      console.error('Erro local:', e);
    }

    // 2. Se for VOCÊ (Pro), tenta baixar a versão mais recente da nuvem
    if (isProUser() && supabase) {
      try {
        const { data } = await supabase.from('neuro_backup').select('*');
        
        if (data && data.length > 0) {
          // Se achar dados na nuvem, eles têm prioridade
          const cloudStudies = data.find(row => row.id === 'studies')?.content;
          const cloudFolders = data.find(row => row.id === 'folders')?.content;
          
          if (cloudStudies) studies = cloudStudies;
          if (cloudFolders) folders = cloudFolders;
          console.log('☁️ Sincronizado com a Nuvem (Pro)');
        }
      } catch (e) {
        console.error('⚠️ Erro ao conectar Supabase (usando local):', e);
      }
    }

    return { studies, folders };
  },

  // --- SALVAR DADOS ---
  saveData: async (studies: StudySession[], folders: Folder[]) => {
    // 1. Sempre salva no navegador (Backup garantido)
    localStorage.setItem(LOCAL_STUDIES, JSON.stringify(studies));
    localStorage.setItem(LOCAL_FOLDERS, JSON.stringify(folders));

    // 2. Se for VOCÊ (Pro), salva também na nuvem
    if (isProUser() && supabase) {
      try {
        // Salva Estudos
        await supabase
          .from('neuro_backup')
          .upsert({ id: 'studies', content: studies });
        
        // Salva Pastas
        await supabase
          .from('neuro_backup')
          .upsert({ id: 'folders', content: folders });
          
      } catch (e) {
        console.error('Erro ao subir para nuvem:', e);
      }
    }
  }
};
