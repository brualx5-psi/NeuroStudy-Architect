import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UsageMeterProps {
    type: 'roadmaps' | 'feynman' | 'youtube' | 'pdf' | 'web_research' | 'chat';
    showLabel?: boolean;
    compact?: boolean;
}

export const UsageMeter: React.FC<UsageMeterProps> = ({ type, showLabel = true, compact = false }) => {
    const { usage, limits, isPro } = useAuth();

    if (!usage) return null;

    const config: Record<string, { label: string; used: number; max: number; icon: string; unit?: string }> = {
        roadmaps: {
            label: 'Roteiros',
            used: usage.roadmaps_created,
            max: limits.roadmaps,
            icon: '📚'
        },
        feynman: {
            label: 'Feynman',
            used: usage.feynman_used,
            max: isPro ? 100 : 3,
            icon: '🧠'
        },
        youtube: {
            label: 'YouTube',
            used: usage.youtube_minutes_used,
            max: limits.youtube_minutes,
            icon: '📹',
            unit: 'min'
        },
        pdf: {
            label: 'Exportar PDF',
            used: usage.pdf_exports,
            max: isPro ? 30 : 1,
            icon: '📄'
        },
        web_research: {
            label: 'Pesquisa Web',
            used: usage.web_research_used,
            max: limits.web_research,
            icon: '🔍'
        },
        chat: {
            label: 'Chat',
            used: usage.chat_messages,
            max: limits.chat_messages,
            icon: '💬',
            unit: 'msg'
        }
    };

    const { label, used, max, icon, unit } = config[type];
    const percentage = Math.min((used / max) * 100, 100);
    const remaining = max - used;
    const isLow = percentage >= 80;
    const isExhausted = percentage >= 100;

    // Cores baseadas no status
    const getBarColor = () => {
        if (isExhausted) return 'bg-red-500';
        if (isLow) return 'bg-amber-500';
        return 'bg-indigo-500';
    };

    const getTextColor = () => {
        if (isExhausted) return 'text-red-600';
        if (isLow) return 'text-amber-600';
        return 'text-slate-600';
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2 text-xs">
                <span>{icon}</span>
                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${getBarColor()} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <span className={`${getTextColor()} font-medium`}>
                    {remaining}{unit ? unit : ''}
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    {showLabel && (
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                    )}
                </div>
                <span className={`text-xs font-bold ${getTextColor()}`}>
                    {used}/{max} {unit || 'usados'}
                </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getBarColor()} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {isLow && !isExhausted && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    ⚠️ Restam apenas {remaining} {unit || 'usos'}
                </p>
            )}
            {isExhausted && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    🚫 Limite atingido! Faça upgrade para continuar.
                </p>
            )}
        </div>
    );
};

// Componente para mostrar todos os limites de uma vez
export const UsageDashboard: React.FC = () => {
    const { isPro } = useAuth();

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                    Seu Consumo Mensal
                </h3>
                {isPro ? (
                    <span className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
                        PRO
                    </span>
                ) : (
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        Grátis
                    </span>
                )}
            </div>
            <div className="grid gap-2">
                <UsageMeter type="roadmaps" />
                <UsageMeter type="youtube" />
                <UsageMeter type="feynman" />
                <UsageMeter type="pdf" />
                <UsageMeter type="web_research" />
            </div>
        </div>
    );
};

// Componente compacto para mostrar na barra lateral
export const UsageCompactBar: React.FC = () => {
    return (
        <div className="p-2 bg-slate-50 rounded-lg space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Limite Mensal</p>
            <UsageMeter type="roadmaps" compact />
            <UsageMeter type="youtube" compact />
            <UsageMeter type="feynman" compact />
        </div>
    );
};
