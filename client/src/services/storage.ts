import { StudySession, Folder } from '../types';

const LOCAL_STUDIES_KEY = 'neuro_studies_data';
const LOCAL_FOLDERS_KEY = 'neuro_folders_data';

export const storage = {
  loadData: async () => {
    try {
      const localS = localStorage.getItem(LOCAL_STUDIES_KEY);
      const localF = localStorage.getItem(LOCAL_FOLDERS_KEY);
      return { 
        studies: localS ? JSON.parse(localS) : [], 
        folders: localF ? JSON.parse(localF) : [] 
      };
    } catch (e) {
      console.error("Erro ao carregar local:", e);
      return { studies: [], folders: [] };
    }
  },

  saveData: async (studies: StudySession[], folders: Folder[]) => {
    localStorage.setItem(LOCAL_STUDIES_KEY, JSON.stringify(studies));
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  }
};
