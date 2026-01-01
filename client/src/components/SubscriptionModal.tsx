import React from 'react';
import { X, Check, Zap, Sparkles, Crown, Globe, BrainCircuit } from '../components/Icons';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPlan?: (plan: 'free' | 'pro') => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onSelectPlan }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal */}
            <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex flex-col md:flex-row h-full">
                    {/* Left Side: Pro Benefits */}
                    <div className="flex-1 p-8 md:p-12 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10">
                            <div className="inline-flex p-3 bg-white/20 rounded-2xl mb-6 backdrop-blur-md">
                                <Crown className="w-8 h-8 text-amber-300" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tight leading-tight">
                                Qualidade Garantida<br />+ Capacidade Total
                            </h2>
                            <p className="text-indigo-100 text-base md:text-lg mb-8 leading-relaxed font-medium">
                                Quiz e Flashcards com IA Pro. Mais páginas, mais vídeos, mais resultados.
                            </p>

                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                                    <div>
                                        <span className="font-bold">50 roteiros/mês</span>
                                        <span className="text-indigo-200 text-sm ml-1">(vs 3 no Free)</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                                    <div>
                                        <span className="font-bold">300 páginas por fonte</span>
                                        <span className="text-indigo-200 text-sm ml-1">(livros completos)</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                                    <div>
                                        <span className="font-bold">10h de vídeo/mês</span>
                                        <span className="text-indigo-200 text-sm ml-1">(transcrição IA)</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                                    <div>
                                        <span className="font-bold">Pesquisa Web com IA</span>
                                        <span className="text-indigo-200 text-sm ml-1">(100 buscas/mês)</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                                    <div>
                                        <span className="font-bold">Slides, Mapas Mentais, Exportação PDF</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Side: Plans */}
                    <div className="flex-[1.2] p-8 md:p-12 bg-white flex flex-col justify-center">
                        <div className="grid grid-cols-1 gap-6">
                            {/* Plan Card: PRO */}
                            <div className="relative p-6 rounded-3xl border-2 border-indigo-600 bg-indigo-50/50 shadow-xl shadow-indigo-100/50 group transition-all">
                                <div className="absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                                    🚀 Recomendado
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900">NeuroStudy Pro</h3>
                                        <p className="text-slate-500 font-bold text-sm">Resultados de verdade</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-black text-slate-900">R$ 29</span>
                                        <span className="text-slate-400 font-bold text-sm">/mês</span>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 mb-6">
                                    <p className="text-emerald-700 text-sm font-bold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        Quiz e Flashcards com IA Pro — mais precisos e eficientes
                                    </p>
                                </div>

                                <button
                                    onClick={() => onSelectPlan?.('pro')}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Zap className="w-5 h-5 fill-current" />
                                    Assinar e Desbloquear
                                </button>
                            </div>

                            {/* Plan Card: FREE */}
                            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-700">Plano Gratuito</h4>
                                    <p className="text-xs text-slate-500 font-medium">Experimente a metodologia</p>
                                    <p className="text-[10px] text-slate-400 mt-1">3 roteiros • 30 pág • 1 vídeo curto</p>
                                </div>
                                <button
                                    onClick={() => { onSelectPlan?.('free'); onClose(); }}
                                    className="px-5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-600 font-bold rounded-xl transition-all text-sm"
                                >
                                    Continuar Grátis
                                </button>
                            </div>
                        </div>

                        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
                            Pagamento seguro via Mercado Pago. Cancele quando quiser.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
