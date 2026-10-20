import { supabase } from './supabase';
import { StudyPersistence, parseSnapshot, readLocalCopies, type RecoveryCopy, type StudySnapshot, type StudyTransport } from './studyPersistence';

export const isCloudMode = () => !!supabase;
const browserStorage = () => { try { return localStorage; } catch { return null; } };

const transport: StudyTransport = {
  async load(userId) {
    if (!supabase) throw new Error('Conexão com a nuvem indisponível.');
    const { data, error } = await supabase.from('user_data').select('content, study_revision').eq('user_id', userId).maybeSingle();
    if (error) throw new Error('Não foi possível carregar seus estudos. Tente novamente com internet.');
    return { ...parseSnapshot(data?.content ?? { studies: [], folders: [] }), revision: data?.study_revision ?? 0 };
  },
  async save(userId, snapshot, revision) {
    if (!supabase) throw new Error('Conexão com a nuvem indisponível.');
    const { data, error } = await supabase.rpc('save_study_snapshot', {
      p_user_id: userId, p_expected_revision: revision, p_studies: snapshot.studies, p_folders: snapshot.folders,
    });
    if (error) throw new Error(error.code === '40001' ? 'Os estudos foram alterados em outra aba ou aparelho.' : 'Não foi possível confirmar o salvamento na nuvem.');
    if (!Number.isSafeInteger(data)) throw new Error('A nuvem não confirmou a versão salva.');
    return data as number;
  },
};

export const createStudySession = (userId: string) => new StudyPersistence(userId, transport, browserStorage(), crypto.randomUUID());
export const getLocalRecoveryCopies = (userId: string) => readLocalCopies(browserStorage(), userId);

export async function getCloudRecoveryCopies(userId: string): Promise<RecoveryCopy[]> {
  if (!supabase) throw new Error('Nuvem indisponível.');
  const { data, error } = await supabase.from('study_history').select('revision, saved_at, content').eq('user_id', userId).order('revision', { ascending: false }).limit(50);
  if (error) throw new Error('Não foi possível consultar o histórico na nuvem.');
  return (data || []).flatMap(row => {
    try { return [{ ...parseSnapshot(row.content), id: `cloud:${row.revision}`, updatedAt: Date.parse(row.saved_at), label: `Nuvem — versão ${row.revision}` }]; }
    catch { return []; }
  });
}

export function downloadStudyBackup(snapshot: StudySnapshot, userId: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...snapshot, userId, schemaVersion: 1, updatedAt: Date.now() }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `neurostudy-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
