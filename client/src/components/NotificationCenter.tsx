import React from 'react';
import { StudySession, StudyMode } from '../types';
import { Clock, Calendar, CheckCircle, Trash, BookOpen, Target, Layers, X, Play, Edit } from './Icons';

interface NotificationCenterProps {
    studies: StudySession[];
    onSelectStudy: (id: string) => void;
    onClose: () => void;
    onMarkDone: (id: string) => void;
    onSnooze: (id: string) => void;
    onDeleteReview: (id: string) => void;
    onEditReview: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
    studies,
    onSelectStudy,
    onClose,
    onMarkDone,
    onSnooze,
    onDeleteReview,
    onEditReview
}) => {
    const now = Date.now();

    // Filtra revisões vencidas ou para hoje
    const dueReviews = studies.filter(s => s.nextReviewDate && s.nextReviewDate <= now).sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));

    // Próximas revisões (3 dias)
    const upcomingReviews = studies.filter(s => s.nextReviewDate && s.nextReviewDate > now && s.nextReviewDate <= now + (3 * 24 * 60 * 60 * 1000)).sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));

    const getTypeInfo = (study: StudySession) => {
        if (study.isBook) return { label: 'Livro', icon: <BookOpen className="w-3 h-3" />, color: 'text-orange-600 bg-orange-50 border-orange-100' };
        if (study.mode === StudyMode.PARETO) return { label: 'Pareto', icon: <Target className="w-3 h-3" />, color: 'text-red-600 bg-red-50 border-red-100' };
        return { label: 'NeuroStudy', icon: <Layers className="w-3 h-3" />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
    };

    return (
        <div className="absolute top-16 right-4 md:right-8 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in">
            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Central de Revisão</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{dueReviews.length}</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {dueReviews.length === 0 && upcomingReviews.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Tudo em dia! Nenhuma revisão agendada.</p>
                    </div>
                ) : (
                    <>
                        {dueReviews.length > 0 && (
                            <div className="p-2">
                                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> Para Hoje / Atrasadas</p>
                                <div className="space-y-2">
                                    {dueReviews.map(study => {
                                        const typeInfo = getTypeInfo(study);
                                        return (
                                            <div key={study.id} className="bg-white border border-red-100 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                                <div className="p-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { onSelectStudy(study.id); onClose(); }}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${typeInfo.color}`}>
                                                            {typeInfo.icon} {typeInfo.label}
                                                        </span>
                                                        <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">Agora</span>
                                                    </div>
                                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{study.title}</h4>
                                                </div>

                                                {/* ACTION BAR */}
                                                <div className="flex border-t border-gray-100 divide-x divide-gray-100 bg-gray-50">
                                                    <button onClick={(e) => { e.stopPropagation(); onMarkDone(study.id); }} className="flex-1 py-2 text-xs font-bold text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1" title="Marcar como feito (+7 dias)">
                                                        <CheckCircle className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); onEditReview(study.id); onClose(); }} className="flex-1 py-2 text-xs font-bold text-indigo-500 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1" title="Alterar Data / Reagendar">
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
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {upcomingReviews.length > 0 && (
                            <div className="p-2 border-t border-gray-100 bg-slate-50/50 mt-2">
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 px-2 mt-2">Em Breve</p>
                                <div className="space-y-1">
                                    {upcomingReviews.map(study => {
                                        const typeInfo = getTypeInfo(study);
                                        return (
                                            <div key={study.id} className="relative group">
                                                <button
                                                    onClick={() => { onSelectStudy(study.id); onClose(); }}
                                                    className="w-full text-left p-3 rounded-lg bg-white hover:bg-indigo-50 transition-colors border border-gray-100 hover:border-indigo-100 group shadow-sm"
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-gray-700 text-xs line-clamp-1">{study.title}</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded group-hover:bg-white">{new Date(study.nextReviewDate!).toLocaleDateString('pt-BR')}</span>
                                                            <div
                                                                onClick={(e) => { e.stopPropagation(); onEditReview(study.id); onClose(); }}
                                                                className="p-1 hover:bg-indigo-200 rounded text-indigo-400 hover:text-indigo-600 cursor-pointer transition-colors"
                                                                title="Editar data"
                                                            >
                                                                <Edit className="w-3 h-3" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${typeInfo.color} opacity-70`}>
                                                            {typeInfo.label}
                                                        </span>
                                                    </div>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
