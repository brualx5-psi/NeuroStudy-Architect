import React from 'react';
import { StudySession, StudyMode } from '../types';
import { Clock, Calendar, CheckCircle, Trash, BookOpen, Target, Layers, X, Edit, FileText } from './Icons';

interface NotificationCenterProps {
    studies: StudySession[];
    onSelectStudy: (id: string) => void;
    onClose: () => void;
    onMarkDone: (id: string) => void;
    onSnooze: (id: string) => void;
    onDeleteReview: (id: string) => void;
    onEditReview: (id: string) => void;
}

const getEndOfToday = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end.getTime();
};

const getStartOfToday = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
};

const DAY_MS = 24 * 60 * 60 * 1000;

const formatReviewDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const getStudyDisplayTitle = (study: StudySession) => study.guide?.title || study.title || 'Estudo sem título';

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
    studies,
    onSelectStudy,
    onClose,
    onMarkDone,
    onSnooze,
    onDeleteReview,
    onEditReview
}) => {
    const startOfToday = getStartOfToday();
    const endOfToday = getEndOfToday();

    const scheduledReviews = studies
        .filter(s => Boolean(s.nextReviewDate))
        .sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));

    // Revisões vencidas ou agendadas para qualquer horário de hoje.
    const dueReviews = scheduledReviews.filter(s => (s.nextReviewDate || 0) <= endOfToday);

    const upcomingReviews = scheduledReviews.filter(s => {
        const date = s.nextReviewDate || 0;
        return date > endOfToday && date <= endOfToday + (7 * DAY_MS);
    });

    const laterReviews = scheduledReviews.filter(s => (s.nextReviewDate || 0) > endOfToday + (7 * DAY_MS));

    const getTypeInfo = (study: StudySession) => {
        if (study.isBook) return { label: 'Livro', icon: <BookOpen className="w-3 h-3" />, color: 'text-orange-600 bg-orange-50 border-orange-100' };
        if (study.mode === StudyMode.PARETO) return { label: 'Pareto', icon: <Target className="w-3 h-3" />, color: 'text-red-600 bg-red-50 border-red-100' };
        return { label: 'NeuroStudy', icon: <Layers className="w-3 h-3" />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
    };

    const getDateBadge = (study: StudySession) => {
        const timestamp = study.nextReviewDate || 0;
        if (timestamp < startOfToday) return { label: 'Atrasada', color: 'text-red-600 bg-red-50' };
        if (timestamp <= endOfToday) return { label: 'Hoje', color: 'text-red-500 bg-red-50' };
        return { label: formatReviewDate(timestamp), color: 'text-gray-500 bg-gray-100' };
    };

    const openStudyGuide = (studyId: string) => {
        onSelectStudy(studyId);
        onClose();
    };

    const renderReviewCard = (study: StudySession, tone: 'due' | 'upcoming' | 'later') => {
        const typeInfo = getTypeInfo(study);
        const dateBadge = getDateBadge(study);
        const title = getStudyDisplayTitle(study);
        const borderClass = tone === 'due' ? 'border-red-100' : tone === 'upcoming' ? 'border-indigo-100' : 'border-gray-100';
        const hoverClass = tone === 'due' ? 'hover:bg-red-50/40' : 'hover:bg-indigo-50/60';

        return (
            <div key={study.id} className={`bg-white border ${borderClass} rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>
                <button
                    type="button"
                    className={`w-full p-3 text-left ${hoverClass} transition-colors`}
                    onClick={() => openStudyGuide(study.id)}
                    title="Abrir roteiro do estudo"
                >
                    <div className="flex justify-between items-start mb-1 gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${typeInfo.color}`}>
                            {typeInfo.icon} {typeInfo.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${dateBadge.color}`}>{dateBadge.label}</span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{title}</h4>
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                        <FileText className="w-3 h-3" /> Abrir roteiro
                    </div>
                </button>

                <div className="flex border-t border-gray-100 divide-x divide-gray-100 bg-gray-50">
                    <button onClick={(e) => { e.stopPropagation(); onMarkDone(study.id); }} className="flex-1 py-2 text-xs font-bold text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1" title="Marcar revisão como feita e agendar próxima etapa">
                        <CheckCircle className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEditReview(study.id); onClose(); }} className="flex-1 py-2 text-xs font-bold text-indigo-500 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1" title="Alterar data / reagendar">
                        <Edit className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onSnooze(study.id); }} className="flex-1 py-2 text-xs font-bold text-yellow-600 hover:bg-yellow-50 transition-colors flex items-center justify-center gap-1" title="Postergar 1 dia">
                        <Clock className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteReview(study.id); }} className="flex-1 py-2 text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1" title="Remover agendamento">
                        <Trash className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="absolute top-16 right-4 md:right-8 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in">
            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Central das Revisões</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{scheduledReviews.length}</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto">
                {scheduledReviews.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma revisão agendada.</p>
                        <p className="text-xs mt-1">Ao agendar um roteiro, ele aparece aqui mesmo se você também abrir o Google Agenda.</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-3">
                        {dueReviews.length > 0 && (
                            <section>
                                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Hoje / atrasadas</p>
                                <div className="space-y-2">
                                    {dueReviews.map(study => renderReviewCard(study, 'due'))}
                                </div>
                            </section>
                        )}

                        {upcomingReviews.length > 0 && (
                            <section className={dueReviews.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Próximas 7 dias</p>
                                <div className="space-y-2">
                                    {upcomingReviews.map(study => renderReviewCard(study, 'upcoming'))}
                                </div>
                            </section>
                        )}

                        {laterReviews.length > 0 && (
                            <section className={(dueReviews.length > 0 || upcomingReviews.length > 0) ? 'border-t border-gray-100 pt-3' : ''}>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Mais tarde</p>
                                <div className="space-y-2">
                                    {laterReviews.map(study => renderReviewCard(study, 'later'))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
