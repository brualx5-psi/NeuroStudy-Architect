import React, { useState } from 'react';
import { StudyArea, Purpose, ExamType } from '../types';
import { saveProfile, LABELS } from '../services/userProfileService';
import { ChevronRight, Sparkles } from './Icons';

interface OnboardingModalProps {
    onComplete: () => void;
    onCreateStudy: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, onCreateStudy }) => {
    const [step, setStep] = useState(1);
    const [studyArea, setStudyArea] = useState<StudyArea | null>(null);
    const [purpose, setPurpose] = useState<Purpose | null>(null);
    const [examType, setExamType] = useState<ExamType | null>(null);

    const canProceed = () => {
        if (step === 1) return studyArea && purpose;
        return true;
    };

    const handleNext = () => {
        if (step === 1 && purpose === 'exam' && !examType) {
            return; // User precisa escolher tipo de prova
        }
        setStep(2);
    };

    const handleComplete = () => {
        saveProfile({
            studyArea: studyArea!,
            purpose: purpose!,
            examType: purpose === 'exam' ? examType || 'none' : undefined,
            primarySourceType: 'text',
            preferredSource: studyArea === 'health' ? 'pubmed' : 'auto',
            hasCompletedOnboarding: true,
        });
        onComplete();
        onCreateStudy();
    };

    const AreaCard = ({ area, label, selected }: { area: StudyArea; label: string; selected: boolean }) => (
        <button
            onClick={() => setStudyArea(area)}
            className={`p-3 rounded-lg border-2 text-left transition-all hover:shadow-md ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-indigo-300'}`}
        >
            <span className="text-xl mb-1 block">{label.split(' ')[0]}</span>
            <span className="text-xs font-medium text-gray-700">{label.split(' ').slice(1).join(' ')}</span>
        </button>
    );

    const PurposeCard = ({ purposeVal, label, selected }: { purposeVal: Purpose; label: string; selected: boolean }) => (
        <button
            onClick={() => setPurpose(purposeVal)}
            className={`p-3 rounded-lg border-2 text-left transition-all hover:shadow-md ${selected ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-purple-300'}`}
        >
            <span className="text-xl mb-1 block">{label.split(' ')[0]}</span>
            <span className="text-xs font-medium text-gray-700">{label.split(' ').slice(1).join(' ')}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900/90 to-purple-900/90 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-bold text-base">Bem-vindo ao NeuroStudy!</span>
                        </div>
                        <div className="text-sm opacity-80">Passo {step} de 2</div>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2].map((s) => (
                            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
                        ))}
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="p-5 overflow-y-auto flex-1">
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right duration-300">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 mb-2">Qual é sua área de estudo?</h2>
                                <p className="text-sm text-gray-500 mb-3">Isso nos ajuda a encontrar as melhores fontes para você.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {(Object.entries(LABELS.studyArea) as [StudyArea, string][]).map(([area, label]) => (
                                        <AreaCard key={area} area={area} label={label} selected={studyArea === area} />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-lg font-bold text-gray-800 mb-2">Qual seu objetivo?</h2>
                                <p className="text-sm text-gray-500 mb-3">Personalizamos o tom e profundidade do conteúdo.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {(Object.entries(LABELS.purpose) as [Purpose, string][]).map(([p, label]) => (
                                        <PurposeCard key={p} purposeVal={p} label={label} selected={purpose === p} />
                                    ))}
                                </div>
                            </div>

                            {purpose === 'exam' && (
                                <div className="animate-in fade-in slide-in-from-bottom">
                                    <h2 className="text-lg font-bold text-gray-800 mb-2">Qual prova?</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.entries(LABELS.examType) as [ExamType, string][]).map(([t, label]) => (
                                            <button
                                                key={t}
                                                onClick={() => setExamType(t)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${examType === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300 text-left max-h-[50vh] overflow-y-auto pr-2">
                            {/* Título */}
                            <div className="text-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800 mb-1">🧠 Como o NeuroStudy funciona</h2>
                                <p className="text-gray-500 text-sm">Aprenda de verdade em 3 passos simples</p>
                            </div>

                            {/* Analogia */}
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-xl text-white">
                                <p className="text-sm font-medium">
                                    <strong>🏋️ Personal Trainer do Cérebro:</strong> Assim como um personal não malha por você mas cria o treino perfeito,
                                    o NeuroStudy cria o <strong>roteiro perfeito</strong> para você estudar!
                                </p>
                            </div>

                            {/* 3 Passos */}
                            <div className="space-y-3">
                                <div className="flex gap-3 items-start bg-indigo-50 p-3 rounded-xl">
                                    <div className="bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">1</div>
                                    <div>
                                        <strong className="text-indigo-900 text-sm">Antes: Receba o Roteiro</strong>
                                        <p className="text-xs text-indigo-700">A IA lê seu material e extrai os 20% mais importantes (Pareto). Você recebe checkpoints organizados.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start bg-pink-50 p-3 rounded-xl">
                                    <div className="bg-pink-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">2</div>
                                    <div>
                                        <strong className="text-pink-900 text-sm">Durante: Estude com Ação</strong>
                                        <p className="text-xs text-pink-700">Assista/leia com o roteiro aberto. A cada checkpoint, pause, anote e responda. Marque como feito!</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start bg-green-50 p-3 rounded-xl">
                                    <div className="bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">3</div>
                                    <div>
                                        <strong className="text-green-900 text-sm">Depois: Consolide</strong>
                                        <p className="text-xs text-green-700">Use Flashcards e Quiz para fixar. Agende revisões (1, 7, 14, 30 dias) para memória de longo prazo.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Dica final */}
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl text-center">
                                <p className="text-xs text-yellow-800 mb-1">
                                    <strong>💡 Lembre-se:</strong> Você é o protagonista! A IA cria o mapa, mas quem faz a jornada é você.
                                </p>
                                <p className="text-[10px] text-yellow-600">
                                    📖 Para entender a fundo como funciona, leia o <strong>Método Completo</strong> no menu lateral (ícone 🧠).
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-5 py-3 flex justify-end items-center border-t flex-shrink-0">
                    {step < 2 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="flex items-center gap-1 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Próximo <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl"
                        >
                            🚀 Criar meu primeiro estudo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
