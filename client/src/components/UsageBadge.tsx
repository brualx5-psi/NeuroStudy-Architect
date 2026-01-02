import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionModal } from './SubscriptionModal';

export const UsageBadge: React.FC = () => {
    const { usage, limits, isPro } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!usage) return null;

    const roadmapsUsed = usage.roadmaps_created || 0;
    const roadmapsMax = limits.roadmaps;
    const percentage = Math.min((roadmapsUsed / roadmapsMax) * 100, 100);

    // Cor do badge baseada no uso
    const getBadgeColor = () => {
        if (percentage >= 100) return 'bg-red-100 text-red-700 border-red-200';
        if (percentage >= 80) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    };

    const items = [
        { icon: '📚', label: 'Roteiros', used: usage.roadmaps_created, max: limits.roadmaps },
        { icon: '📹', label: 'YouTube', used: usage.youtube_minutes_used, max: limits.youtube_minutes, unit: 'min' },
        { icon: '🧠', label: 'Feynman', used: usage.feynman_used, max: isPro ? 100 : 3 },
        { icon: '🔍', label: 'Pesquisa Web', used: usage.web_research_used, max: limits.web_research },
    ];

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Badge Compacto */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 ${getBadgeColor()}`}
                    title="Ver limites de uso"
                >
                    <span>📚</span>
                    <span>{roadmapsMax - roadmapsUsed}</span>
                    <svg
                        className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-800">Limite Mensal</h3>
                            {isPro ? (
                                <span className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold">PRO</span>
                            ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Grátis</span>
                            )}
                        </div>

                        <div className="space-y-3">
                            {items.map((item, idx) => {
                                const pct = Math.min((item.used / item.max) * 100, 100);
                                const remaining = item.max - item.used;
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 text-gray-600">
                                                <span>{item.icon}</span>
                                                {item.label}
                                            </span>
                                            <span className={`font-bold ${pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-gray-700'}`}>
                                                {remaining}{item.unit || ''} restantes
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!isPro && (
                            <button
                                onClick={() => { setIsOpen(false); setShowSubscriptionModal(true); }}
                                className="w-full mt-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md"
                            >
                                ⚡ Fazer Upgrade PRO
                            </button>
                        )}
                    </div>
                )}
            </div>
            <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />
        </>
    );
};
