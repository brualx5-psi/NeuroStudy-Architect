import React from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Zap, Sparkles, Crown } from '../components/Icons';
import { PLAN_LIMITS, PLAN_PRICES, PlanName } from '../config/planLimits';

// Links de assinatura do Mercado Pago
const MP_SUBSCRIPTION_LINKS = {
  starter_mensal: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=1b3bff62d1f44f70878a89508e94c346',
  starter_anual: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=854c80057c0e420683c129a07273f7c8',
  pro_mensal: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=87f2fd4ff4544ade8568359886acd3aa',
  pro_anual: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=a7e0f68a4c4f4ddca4c2ae512a8a1db5',
};

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (plan: PlanName) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onSelectPlan }) => {
  if (!isOpen) return null;

  const proLimits = PLAN_LIMITS.pro;
  const starterLimits = PLAN_LIMITS.starter;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col md:flex-row">
          <div className="md:w-[45%] p-6 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white relative flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
              <div className="inline-flex p-2.5 bg-white/20 rounded-xl mb-4 backdrop-blur-md">
                <Crown className="w-6 h-6 text-amber-300" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2 tracking-tight leading-tight">
                Tudo liberado<br />com mais capacidade
              </h2>
              <p className="text-indigo-100 text-sm mb-6 leading-relaxed font-medium">
                O plano Pro libera o máximo de tokens e os maiores limites mensais.
              </p>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold">{proLimits.roadmaps} roteiros/mês</span>
                    <span className="text-indigo-200 text-sm ml-1">(maior limite)</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold">{proLimits.pages_per_source} páginas por fonte</span>
                    <span className="text-indigo-200 text-sm ml-1">(livros longos)</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold">{proLimits.youtube_minutes} min de YouTube/mês</span>
                    <span className="text-indigo-200 text-sm ml-1">(até {proLimits.youtube_minutes_per_video} min/vídeo)</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold">{proLimits.web_research} pesquisas web/mês</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1.5 rounded-full mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold">Chat com tokens estendidos</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex-1 p-6 bg-white flex flex-col justify-center">
            <div className="grid grid-cols-1 gap-6">
              <div className="relative p-6 rounded-3xl border-2 border-indigo-600 bg-indigo-50/50 shadow-xl shadow-indigo-100/50 group transition-all">
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                  Recomendado
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">NeuroStudy Pro</h3>
                    <p className="text-slate-500 font-bold text-sm">Limites máximos</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-slate-900">{PLAN_PRICES.pro}</span>
                    <span className="text-slate-400 font-bold text-sm">/mês</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 mb-4">
                  <p className="text-emerald-700 text-sm font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Tokens e limites premium para produção intensiva
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => window.open(MP_SUBSCRIPTION_LINKS.pro_mensal, '_blank')}
                    className="py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] flex flex-col items-center justify-center gap-1"
                  >
                    <span className="flex items-center gap-1">
                      <Zap className="w-4 h-4 fill-current" />
                      Mensal
                    </span>
                    <span className="text-xs text-indigo-200">{PLAN_PRICES.pro}/mês</span>
                    <span className="text-[9px] text-indigo-300">Cancele quando quiser</span>
                  </button>
                  <button
                    onClick={() => window.open(MP_SUBSCRIPTION_LINKS.pro_anual, '_blank')}
                    className="py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] flex flex-col items-center justify-center gap-1 relative"
                  >
                    <span className="absolute -top-2 -right-2 bg-green-500 text-[10px] font-black px-2 py-0.5 rounded-full">3 DIAS GRÁTIS</span>
                    <span className="flex items-center gap-1">
                      <Crown className="w-4 h-4" />
                      Anual
                    </span>
                    <span className="text-xs text-amber-100">R$ 599/ano</span>
                    <span className="text-[9px] text-amber-200">2 meses grátis</span>
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">NeuroStudy Starter</h3>
                    <p className="text-slate-500 font-bold text-sm">Equilíbrio diário</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">{PLAN_PRICES.starter}</span>
                    <span className="text-slate-400 font-bold text-sm">/mês</span>
                  </div>
                </div>

                <ul className="text-xs text-slate-600 font-medium mb-4 space-y-1">
                  <li>• {starterLimits.roadmaps} roteiros/mês</li>
                  <li>• {starterLimits.sources_per_study} fontes por roteiro</li>
                  <li>• {starterLimits.pages_per_source} páginas por fonte</li>
                  <li>• {starterLimits.youtube_minutes} min YouTube/mês</li>
                  <li>• {starterLimits.web_research} pesquisas web/mês</li>
                </ul>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => window.open(MP_SUBSCRIPTION_LINKS.starter_mensal, '_blank')}
                    className="py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex flex-col items-center gap-0.5"
                  >
                    <span>Mensal</span>
                    <span className="text-xs text-slate-400">{PLAN_PRICES.starter}/mês</span>
                    <span className="text-[9px] text-slate-500">Cancele quando quiser</span>
                  </button>
                  <button
                    onClick={() => window.open(MP_SUBSCRIPTION_LINKS.starter_anual, '_blank')}
                    className="py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex flex-col items-center gap-0.5 relative"
                  >
                    <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-[8px] font-black text-amber-900 px-1.5 py-0.5 rounded-full">3 DIAS GRÁTIS</span>
                    <span>Anual</span>
                    <span className="text-xs text-emerald-100">R$ 299/ano</span>
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-700">Plano Free</h4>
                  <p className="text-xs text-slate-500 font-medium">Experimente a metodologia</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {PLAN_LIMITS.free.roadmaps} roteiros • {PLAN_LIMITS.free.pages_per_source} pág • {PLAN_LIMITS.free.youtube_minutes} min YouTube
                  </p>
                </div>
                <button
                  onClick={() => { onSelectPlan?.('free'); onClose(); }}
                  className="px-5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-600 font-bold rounded-xl transition-all text-sm"
                >
                  Continuar Free
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 font-medium">
              Pagamento seguro via Mercado Pago. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
