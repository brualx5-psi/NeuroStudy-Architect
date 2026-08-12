import React, { useMemo, useState } from 'react';
import { StudyGuide, CoreConcept, Checkpoint } from '../types';
import {
    X, Check, Trash, Plus, ChevronDown, ChevronRight,
    BookOpen, Target, Lightbulb, Layers, AlertTriangle, PenTool
} from './Icons';

interface GuideEditorProps {
    guide: StudyGuide;
    onSave: (updatedGuide: StudyGuide) => void;
    onCancel: () => void;
}

const cloneGuide = (guide: StudyGuide): StudyGuide => JSON.parse(JSON.stringify(guide));

const createConcept = (): CoreConcept => ({ concept: '', definition: '' });

const createCheckpoint = (): Checkpoint => ({
    id: `cp-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    mission: '',
    timestamp: '',
    lookFor: '',
    noteExactly: '',
    drawExactly: '',
    question: '',
    completed: false
});

const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
};

const Field: React.FC<{
    label: string;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    hint?: string;
}> = ({ label, value, onChange, placeholder, rows = 3, hint }) => (
    <label className="block">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        {rows <= 1 ? (
            <input
                type="text"
                value={value || ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
        ) : (
            <textarea
                value={value || ''}
                placeholder={placeholder}
                rows={rows}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y"
            />
        )}
        {hint && <span className="text-[11px] text-gray-400 mt-1 block">{hint}</span>}
    </label>
);

const ItemToolbar: React.FC<{
    index: number;
    total: number;
    onMove: (direction: -1 | 1) => void;
    onRemove: () => void;
    removeTitle: string;
}> = ({ index, total, onMove, onRemove, removeTitle }) => (
    <div className="flex items-center gap-1 shrink-0">
        <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
            title="Mover para cima"
            aria-label="Mover para cima"
        >
            <ChevronDown className="w-4 h-4 rotate-180" />
        </button>
        <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
            title="Mover para baixo"
            aria-label="Mover para baixo"
        >
            <ChevronDown className="w-4 h-4" />
        </button>
        <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title={removeTitle}
            aria-label={removeTitle}
        >
            <Trash className="w-4 h-4" />
        </button>
    </div>
);

const Section: React.FC<{
    title: string;
    icon: React.ReactNode;
    count?: number;
    defaultOpen?: boolean;
    children: React.ReactNode;
}> = ({ title, icon, count, defaultOpen = true, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                {icon}
                <span className="font-bold text-gray-800">{title}</span>
                {typeof count === 'number' && (
                    <span className="ml-auto text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{count}</span>
                )}
            </button>
            {isOpen && <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">{children}</div>}
        </section>
    );
};

export const GuideEditor: React.FC<GuideEditorProps> = ({ guide, onSave, onCancel }) => {
    const [draft, setDraft] = useState<StudyGuide>(() => cloneGuide(guide));

    const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(guide), [draft, guide]);
    const isBook = !!draft.bookChapters;

    const patch = (changes: Partial<StudyGuide>) => setDraft((prev) => ({ ...prev, ...changes }));

    const updateConceptList = (
        key: 'coreConcepts' | 'supportConcepts',
        updater: (list: CoreConcept[]) => CoreConcept[]
    ) => {
        setDraft((prev) => ({ ...prev, [key]: updater(prev[key] || []) }));
    };

    const updateCheckpoints = (updater: (list: Checkpoint[]) => Checkpoint[]) => {
        setDraft((prev) => ({ ...prev, checkpoints: updater(prev.checkpoints || []) }));
    };

    const updateChapters = (updater: (list: NonNullable<StudyGuide['bookChapters']>) => NonNullable<StudyGuide['bookChapters']>) => {
        setDraft((prev) => ({ ...prev, bookChapters: updater(prev.bookChapters || []) }));
    };

    const handleCancel = () => {
        if (isDirty && !window.confirm('Descartar as alterações que você fez no roteiro?')) return;
        onCancel();
    };

    const handleSave = () => {
        const cleaned: StudyGuide = {
            ...draft,
            title: (draft.title || '').trim() || guide.title,
            coreConcepts: (draft.coreConcepts || []).filter((c) => (c.concept || '').trim() || (c.definition || '').trim()),
            supportConcepts: (draft.supportConcepts || []).filter((c) => (c.concept || '').trim() || (c.definition || '').trim())
        };
        onSave(cleaned);
    };

    const renderConceptList = (key: 'coreConcepts' | 'supportConcepts') => {
        const list = draft[key] || [];
        return (
            <>
                {list.map((concept, index) => (
                    <div key={index} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest pt-1">#{index + 1}</span>
                            <ItemToolbar
                                index={index}
                                total={list.length}
                                onMove={(direction) => updateConceptList(key, (current) => moveItem(current, index, index + direction))}
                                onRemove={() => updateConceptList(key, (current) => current.filter((_, i) => i !== index))}
                                removeTitle="Remover conceito"
                            />
                        </div>
                        <Field
                            label="Conceito"
                            rows={1}
                            value={concept.concept}
                            placeholder="Nome do conceito"
                            onChange={(value) =>
                                updateConceptList(key, (current) => current.map((item, i) => (i === index ? { ...item, concept: value } : item)))
                            }
                        />
                        <Field
                            label="Definição"
                            rows={4}
                            value={concept.definition}
                            placeholder="Explique o conceito com suas palavras"
                            onChange={(value) =>
                                updateConceptList(key, (current) => current.map((item, i) => (i === index ? { ...item, definition: value } : item)))
                            }
                        />
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => updateConceptList(key, (current) => [...current, createConcept()])}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Adicionar conceito
                </button>
            </>
        );
    };

    return (
        <div className="max-w-5xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* BARRA DE AÇÕES FIXA */}
            <div className="sticky top-0 z-30 -mx-2 px-2 py-3 bg-white/95 backdrop-blur-md border-b border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <PenTool className="w-5 h-5 text-indigo-600" /> Editando o roteiro
                    </h2>
                    <p className="text-xs text-gray-500">
                        {isDirty ? 'Você tem alterações não salvas.' : 'Altere o que quiser e clique em salvar.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors"
                    >
                        <X className="w-4 h-4" /> Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Check className="w-4 h-4" /> Salvar alterações
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <Section title="Identificação e objetivo" icon={<Lightbulb className="w-5 h-5 text-yellow-500" />}>
                    <Field label="Título do roteiro" rows={1} value={draft.title} onChange={(value) => patch({ title: value })} />
                    <Field label="Assunto" rows={1} value={draft.subject} onChange={(value) => patch({ subject: value })} />
                    <Field
                        label={isBook ? 'Objetivo do livro' : 'Objetivo da aula'}
                        rows={6}
                        value={draft.overview}
                        onChange={(value) => patch({ overview: value })}
                        hint="Aceita Markdown (**negrito**, listas com -)."
                    />
                    <Field
                        label="Alinhamento com o módulo"
                        rows={4}
                        value={draft.moduleAlignment}
                        placeholder="Opcional: como esta aula se encaixa no módulo"
                        onChange={(value) => patch({ moduleAlignment: value })}
                    />
                </Section>

                <Section
                    title={isBook ? 'Pareto Global' : 'Conceitos fundamentais'}
                    icon={<BookOpen className="w-5 h-5 text-indigo-600" />}
                    count={(draft.coreConcepts || []).length}
                >
                    {renderConceptList('coreConcepts')}
                </Section>

                <Section
                    title="Conceitos de suporte"
                    icon={<Lightbulb className="w-5 h-5 text-amber-500" />}
                    count={(draft.supportConcepts || []).length}
                    defaultOpen={false}
                >
                    {renderConceptList('supportConcepts')}
                </Section>

                {!isBook && (
                    <Section
                        title="Checkpoints de aprendizado"
                        icon={<Target className="w-5 h-5 text-red-500" />}
                        count={(draft.checkpoints || []).length}
                    >
                        {(draft.checkpoints || []).map((checkpoint, index) => {
                            const updateField = (field: keyof Checkpoint, value: string) =>
                                updateCheckpoints((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

                            return (
                                <div key={checkpoint.id || index} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest pt-1">
                                            Checkpoint {index + 1}
                                        </span>
                                        <ItemToolbar
                                            index={index}
                                            total={(draft.checkpoints || []).length}
                                            onMove={(direction) => updateCheckpoints((current) => moveItem(current, index, index + direction))}
                                            onRemove={() => updateCheckpoints((current) => current.filter((_, i) => i !== index))}
                                            removeTitle="Remover checkpoint"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <Field label="Título" rows={1} value={checkpoint.title} onChange={(value) => updateField('title', value)} />
                                        <Field
                                            label="Momento/fonte"
                                            rows={1}
                                            value={checkpoint.timestamp}
                                            placeholder="Ex: 00:05-00:10 • pág. 3"
                                            onChange={(value) => updateField('timestamp', value)}
                                        />
                                    </div>
                                    <Field label="Missão" rows={2} value={checkpoint.mission} onChange={(value) => updateField('mission', value)} />
                                    <Field label="O que procurar" rows={3} value={checkpoint.lookFor} onChange={(value) => updateField('lookFor', value)} />
                                    <Field
                                        label="Escreva exatamente isso"
                                        rows={4}
                                        value={checkpoint.noteExactly}
                                        onChange={(value) => updateField('noteExactly', value)}
                                    />
                                    <Field
                                        label="Sugestão de desenho"
                                        rows={3}
                                        value={checkpoint.drawExactly}
                                        onChange={(value) => updateField('drawExactly', value)}
                                    />
                                    <Field
                                        label="Pergunta do checkpoint"
                                        rows={2}
                                        value={checkpoint.question}
                                        onChange={(value) => updateField('question', value)}
                                    />
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => updateCheckpoints((current) => [...current, createCheckpoint()])}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50/40 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Adicionar checkpoint
                        </button>
                    </Section>
                )}

                {isBook && (
                    <Section
                        title="Capítulos do livro"
                        icon={<Layers className="w-5 h-5 text-orange-500" />}
                        count={(draft.bookChapters || []).length}
                    >
                        {(draft.bookChapters || []).map((chapter, index) => {
                            const updateField = (field: 'title' | 'content' | 'paretoChunk' | 'reflectionQuestion', value: string) =>
                                updateChapters((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

                            return (
                                <div key={index} className="p-4 rounded-xl border border-orange-100 bg-orange-50/40 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-[11px] font-bold text-orange-500 uppercase tracking-widest pt-1">
                                            Capítulo {index + 1}
                                        </span>
                                        <ItemToolbar
                                            index={index}
                                            total={(draft.bookChapters || []).length}
                                            onMove={(direction) => updateChapters((current) => moveItem(current, index, index + direction))}
                                            onRemove={() => updateChapters((current) => current.filter((_, i) => i !== index))}
                                            removeTitle="Remover capítulo"
                                        />
                                    </div>
                                    <Field label="Título" rows={1} value={chapter.title} onChange={(value) => updateField('title', value)} />
                                    <Field label="Essência 80/20" rows={3} value={chapter.paretoChunk} onChange={(value) => updateField('paretoChunk', value)} />
                                    <Field label="Conteúdo" rows={8} value={chapter.content} onChange={(value) => updateField('content', value)} />
                                    <Field
                                        label="Check mental"
                                        rows={2}
                                        value={chapter.reflectionQuestion}
                                        onChange={(value) => updateField('reflectionQuestion', value)}
                                    />
                                </div>
                            );
                        })}
                    </Section>
                )}

                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p>
                        Quiz, flashcards e slides já gerados não mudam sozinhos ao editar o roteiro. Gere-os de novo se quiser que reflitam esta versão.
                    </p>
                </div>
            </div>
        </div>
    );
};
