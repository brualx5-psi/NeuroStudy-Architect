import React, { useState } from 'react';
import { GuideEditChange } from '../services/geminiService';
import { Check, X, PenTool, Plus, Trash, ChevronDown, ChevronRight, AlertTriangle } from './Icons';

export type GuideProposalStatus = 'pending' | 'approved' | 'discarded' | 'outdated';

interface GuideChangePreviewProps {
    summary: string;
    changes: GuideEditChange[];
    rejected?: Array<{ path: string; reason: string }>;
    status: GuideProposalStatus;
    onApprove: () => void;
    onDiscard: () => void;
}

const OP_META: Record<GuideEditChange['op'], { label: string; icon: React.ReactNode; className: string }> = {
    set: { label: 'Reescrito', icon: <PenTool className="w-3 h-3" />, className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    insert: { label: 'Adicionado', icon: <Plus className="w-3 h-3" />, className: 'bg-green-50 text-green-700 border-green-100' },
    remove: { label: 'Removido', icon: <Trash className="w-3 h-3" />, className: 'bg-red-50 text-red-700 border-red-100' }
};

const TextBlock: React.FC<{ label: string; text: string; tone: 'before' | 'after' }> = ({ label, text, tone }) => (
    <div className={`p-2 rounded-lg border text-[11px] leading-relaxed whitespace-pre-wrap break-words ${tone === 'before'
        ? 'bg-red-50/60 border-red-100 text-red-900/80 line-through decoration-red-300'
        : 'bg-green-50/60 border-green-100 text-green-900'}`}
    >
        <span className="block text-[9px] font-bold uppercase tracking-wider opacity-60 mb-0.5 no-underline">{label}</span>
        {text}
    </div>
);

export const GuideChangePreview: React.FC<GuideChangePreviewProps> = ({
    summary, changes, rejected = [], status, onApprove, onDiscard
}) => {
    const [expanded, setExpanded] = useState<Set<number>>(() => new Set(changes.length <= 2 ? changes.map((_, i) => i) : []));

    const toggle = (index: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    return (
        <div className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50/70 overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-amber-100/80 border-b border-amber-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Proposta de alteração — nada foi salvo ainda
                </p>
                {summary && <p className="text-xs text-amber-900 font-medium mt-1 leading-snug">{summary}</p>}
            </div>

            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {changes.map((change, index) => {
                    const meta = OP_META[change.op] || OP_META.set;
                    const isOpen = expanded.has(index);

                    return (
                        <div key={`${change.path}-${index}`} className="rounded-xl border border-amber-200 bg-white overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggle(index)}
                                className="w-full flex items-start gap-2 p-2 text-left hover:bg-amber-50/60 transition-colors"
                            >
                                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 mt-1 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-1 shrink-0" />}
                                <span className="flex-1 min-w-0">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${meta.className}`}>
                                        {meta.icon} {meta.label}
                                    </span>
                                    <span className="block text-xs font-bold text-gray-800 mt-1 leading-snug">{change.label}</span>
                                </span>
                            </button>

                            {isOpen && (
                                <div className="px-2 pb-2 space-y-1.5">
                                    {change.before && <TextBlock label="Antes" text={change.before} tone="before" />}
                                    {change.after && <TextBlock label="Depois" text={change.after} tone="after" />}
                                </div>
                            )}
                        </div>
                    );
                })}

                {rejected.length > 0 && (
                    <p className="text-[10px] text-amber-700/80 leading-snug pt-1">
                        {rejected.length} pedido(s) não puderam ser aplicados automaticamente. Use o botão “Editar roteiro” para ajustar à mão.
                    </p>
                )}
            </div>

            {status === 'pending' ? (
                <div className="flex gap-2 p-3 border-t border-amber-200 bg-white">
                    <button
                        type="button"
                        onClick={onDiscard}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" /> Descartar
                    </button>
                    <button
                        type="button"
                        onClick={onApprove}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold shadow-sm hover:bg-green-700 transition-colors"
                    >
                        <Check className="w-3.5 h-3.5" /> Aprovar e salvar
                    </button>
                </div>
            ) : (
                <div className={`p-3 border-t text-xs font-bold flex items-start gap-1.5 ${status === 'approved'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : status === 'outdated'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                >
                    {status === 'approved' && <><Check className="w-3.5 h-3.5 mt-0.5" /> Alterações salvas no roteiro.</>}
                    {status === 'discarded' && <><X className="w-3.5 h-3.5 mt-0.5" /> Proposta descartada.</>}
                    {status === 'outdated' && (
                        <>
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="font-medium leading-snug">
                                O roteiro mudou depois desta proposta, então ela não vale mais. Peça a alteração de novo.
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
