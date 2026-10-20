import React, { useEffect, useRef, useState } from 'react';
import { downloadStudyBackup, getCloudRecoveryCopies, getLocalRecoveryCopies } from '../services/storage';
import { parseSnapshot, type RecoveryCopy, type StudySnapshot } from '../services/studyPersistence';

export function StudyBackups({ userId, snapshot, onRestore }: {
  userId: string; snapshot?: StudySnapshot; onRestore?: (snapshot: StudySnapshot) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copies, setCopies] = useState<RecoveryCopy[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RecoveryCopy | null>(null);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [hasPending] = useState(() => getLocalRecoveryCopies(userId).some(copy => copy.unclaimed || copy.label.includes('pendente')));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    dialog.current?.showModal();
    setCopies(getLocalRecoveryCopies(userId));
    setError('');
    setLoading(true);
    void getCloudRecoveryCopies(userId).then(cloud => {
      if (!cancelled) setCopies(local => [...local, ...cloud]);
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao consultar histórico.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, userId]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-teal-300 px-3 py-2 text-sm text-teal-800 bg-white">
      Backups{hasPending ? ' • cópia local disponível' : ''}
    </button>
    {open && <dialog ref={dialog} onCancel={() => setOpen(false)} aria-labelledby="study-backups-title"
      className="w-[min(94vw,680px)] max-h-[85vh] overflow-y-auto rounded-2xl p-6 bg-white text-slate-800 backdrop:bg-black/40">
      <div className="flex justify-between items-center gap-4">
        <h2 id="study-backups-title" className="font-bold text-xl">Cópias de segurança</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar backups" className="p-2">Fechar</button>
      </div>
      <p className="my-3 text-sm">O histórico guarda até 50 versões anteriores na nuvem. Baixe também uma cópia para guardar fora do site.</p>
      <div className="flex flex-wrap gap-3 my-4">
        {snapshot && <button className="rounded-lg bg-teal-700 px-3 py-2 text-white" onClick={() => downloadStudyBackup(snapshot, userId)}>Baixar estudos atuais</button>}
        <label className="rounded-lg border px-3 py-2 cursor-pointer">Abrir arquivo de backup
          <input className="block text-xs mt-2 max-w-full" type="file" accept="application/json,.json" onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const raw = JSON.parse(await file.text());
              // Files and legacy shared storage always require explicit ownership confirmation.
              setSelected({ ...parseSnapshot(raw), id: 'file', label: file.name, updatedAt: Number(raw.updatedAt) || 0, unclaimed: true });
              setOwnershipConfirmed(false);
              setError('');
            } catch { setError('Arquivo inválido. Seus estudos atuais foram preservados.'); }
          }} />
        </label>
      </div>
      {error && <p role="alert" className="text-amber-800 bg-amber-50 p-3 rounded-lg">{error}</p>}
      {loading && <p role="status">Consultando histórico na nuvem...</p>}
      {!loading && copies.length === 0 && <p>Nenhuma versão anterior encontrada.</p>}
      <ul className="space-y-2 my-4">
        {copies.map(copy => <li key={copy.id} className="border rounded-lg p-3 flex justify-between gap-3">
          <div><strong className="text-sm">{copy.label}</strong><p className="text-xs">{copy.studies.length} estudos • {copy.updatedAt ? new Date(copy.updatedAt).toLocaleString('pt-BR') : 'Data desconhecida'}</p></div>
          <button className="underline" onClick={() => { setSelected(copy); setOwnershipConfirmed(false); }}>Ver cópia</button>
        </li>)}
      </ul>
      {selected && <section className="border border-teal-300 rounded-lg p-4">
        <h3 className="font-bold">{selected.label}</h3>
        <ul className="text-sm my-2 max-h-40 overflow-auto">{selected.studies.map(study => <li key={study.id}>{study.title}</li>)}</ul>
        {selected.unclaimed && <label className="block text-sm my-3"><input type="checkbox" checked={ownershipConfirmed} onChange={e => setOwnershipConfirmed(e.target.checked)} /> Confirmo que estes estudos são meus e quero importá-los nesta conta.</label>}
        <p className="text-sm my-2">A recuperação adiciona cópias dos estudos. Os estudos atuais são preservados.</p>
        <div className="flex flex-wrap gap-3">
          <button className="border rounded-lg px-3 py-2" onClick={() => downloadStudyBackup(selected, userId)}>Baixar esta cópia</button>
          {onRestore && <button className="bg-teal-700 text-white rounded-lg px-3 py-2 disabled:opacity-40" disabled={selected.unclaimed && !ownershipConfirmed}
            onClick={() => { onRestore(selected); setSelected(null); setOpen(false); }}>Adicionar como cópias</button>}
        </div>
      </section>}
    </dialog>}
  </>;
}
