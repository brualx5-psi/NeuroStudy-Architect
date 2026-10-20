import type { Folder, StudySession } from '../types';

export type StudySnapshot = { studies: StudySession[]; folders: Folder[] };
export type StoredSnapshot = StudySnapshot & { revision: number };
export type RecoveryCopy = StudySnapshot & { id: string; label: string; updatedAt: number; unclaimed?: boolean };
export type SaveResult = { localSaved: boolean; cloudSaved: boolean; error?: string };
export interface StudyTransport {
  load(userId: string): Promise<StoredSnapshot>;
  save(userId: string, snapshot: StudySnapshot, revision: number): Promise<number>;
}

export function parseSnapshot(value: unknown): StudySnapshot {
  if (!value || typeof value !== 'object') throw new Error('Cópia de estudos inválida.');
  const { studies = [], folders = [] } = value as Partial<StudySnapshot>;
  if (!Array.isArray(studies) || !Array.isArray(folders)) throw new Error('Formato de estudos inválido.');
  const validIds = (items: { id: string }[]) => items.every(item => item && typeof item.id === 'string' && item.id.length > 0)
    && new Set(items.map(item => item.id)).size === items.length;
  if (!validIds(studies) || !validIds(folders)
    || studies.some(study => !Array.isArray(study.sources) || typeof study.title !== 'string' || typeof study.folderId !== 'string')
    || folders.some(folder => typeof folder.name !== 'string')) throw new Error('Cópia incompleta ou com identificadores repetidos.');
  return { studies, folders };
}

const serialize = (snapshot: StudySnapshot) => JSON.stringify(snapshot);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Falha de comunicação com a nuvem.';

/** A session belongs to exactly one mounted account. Never reuse it after logout. */
export class StudyPersistence {
  private disposed = false;
  private ready = false;
  private blocked: string | null = null;
  private revision = 0;
  private lastCloud = '';
  private latestLocal = '';
  private sequence = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly key: string;

  constructor(readonly userId: string, private transport: StudyTransport, private storage: Storage | null, writerId: string) {
    this.key = `neurostudy_data:${userId}:${writerId}`;
  }

  dispose() { this.disposed = true; this.ready = false; }

  async load(): Promise<StudySnapshot> {
    const data = await this.transport.load(this.userId);
    if (this.disposed) throw new Error('Sessão encerrada.');
    const snapshot = parseSnapshot(data);
    if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('Versão dos estudos inválida.');
    this.revision = data.revision;
    this.lastCloud = serialize(snapshot);
    this.ready = true;
    // Loading is read-only: never promote an unverified local copy to the cloud.
    return snapshot;
  }

  backup(snapshot: StudySnapshot): boolean {
    if (!this.ready || this.disposed) return false;
    const json = serialize(parseSnapshot(snapshot));
    if (json === this.lastCloud && !this.latestLocal) return true;
    try {
      if (!this.storage) return false;
      this.storage.setItem(this.key, JSON.stringify({ ...snapshot, userId: this.userId, schemaVersion: 1,
        baseRevision: this.revision, updatedAt: Date.now(), pending: true }));
      this.latestLocal = json;
      return true;
    } catch { return false; }
  }

  save(snapshot: StudySnapshot): Promise<SaveResult> {
    if (!this.ready || this.disposed) return Promise.resolve({ localSaved: false, cloudSaved: false, error: 'Estudos ainda não carregados nesta conta.' });
    const copy = JSON.parse(serialize(parseSnapshot(snapshot))) as StudySnapshot;
    const json = serialize(copy);
    const localSaved = this.backup(copy);
    const sequence = ++this.sequence;
    const run = async (): Promise<SaveResult> => {
      if (this.disposed) return { localSaved, cloudSaved: false, error: 'Sessão encerrada.' };
      if (this.blocked) return { localSaved, cloudSaved: false, error: this.blocked };
      try {
        if (json !== this.lastCloud) {
          this.revision = await this.transport.save(this.userId, copy, this.revision);
          this.lastCloud = json;
        }
        // An older response must not replace a newer pending local edit.
        if (!this.disposed && sequence === this.sequence && this.latestLocal === json && this.storage) {
          try {
            this.storage.setItem(this.key, JSON.stringify({ ...copy, userId: this.userId, schemaVersion: 1,
              baseRevision: this.revision, updatedAt: Date.now(), pending: false }));
          } catch { /* The pending copy is still recoverable. */ }
        }
        return { localSaved, cloudSaved: true };
      } catch (error) {
        // A timeout may have committed remotely. Reload before any further write.
        this.blocked = `${errorMessage(error)} Baixe sua cópia e reabra os estudos para comparar as versões.`;
        return { localSaved, cloudSaved: false, error: this.blocked };
      }
    };
    const result = this.queue.then(run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

export function readLocalCopies(storage: Storage | null, userId: string): RecoveryCopy[] {
  const copies: RecoveryCopy[] = [];
  if (!storage) return copies;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key || !(key.startsWith(`neurostudy_data:${userId}:`) || key === 'neurostudy_data')) continue;
      try {
        const raw = JSON.parse(storage.getItem(key) || 'null');
        if (key !== 'neurostudy_data' && raw?.userId !== userId) continue;
        copies.push({ ...parseSnapshot(raw), id: key, updatedAt: Number(raw.updatedAt) || 0,
          unclaimed: key === 'neurostudy_data', label: key === 'neurostudy_data' ? 'Backup antigo deste navegador (conta não identificada)' : raw.pending ? 'Cópia local pendente' : 'Cópia local sincronizada' });
      } catch { /* One damaged copy must not hide other copies or cloud data. */ }
    }
  } catch { /* Storage can be disabled by browser policy. */ }
  return copies.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Recovery is additive. Never replace the current collection with an old snapshot. */
export function importAsCopies(current: StudySnapshot, recovered: StudySnapshot, id = () => crypto.randomUUID()): StudySnapshot {
  parseSnapshot(recovered);
  const folderIds = new Map(recovered.folders.map(folder => [folder.id, id()]));
  return {
    folders: [...current.folders, ...recovered.folders.map(folder => ({ ...folder, id: folderIds.get(folder.id)!,
      name: `${folder.name} (recuperado)`, parentId: folder.parentId ? folderIds.get(folder.parentId) || folder.parentId : undefined }))],
    studies: [...current.studies, ...recovered.studies.map(study => ({ ...study, id: id(),
      title: `${study.title} (recuperado)`, folderId: folderIds.get(study.folderId) || study.folderId, updatedAt: Date.now() }))],
  };
}
