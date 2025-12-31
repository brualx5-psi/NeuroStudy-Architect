import React, { useState } from 'react';
import { StudyArea, Purpose, ExamType, SourceType } from '../types';
import { saveProfile, completeOnboarding, LABELS } from '../services/userProfileService';
import { X, ChevronRight, Sparkles } from './Icons';

// ChevronLeft inline (não exportado do Icons)
const ChevronLeft = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m15 18-6-6 6-6" />
    </svg>
);

interface OnboardingModalProps {
    onComplete: () => void;
    onCreateStudy: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, onCreateStudy }) => {
    const [step, setStep] = useState(1);
    const [studyArea, setStudyArea] = useState<StudyArea | null>(null);
    const [purpose, setPurpose] = useState<Purpose | null>(null);
    const [examType, setExamType] = useState<ExamType | null>(null);
    const [primarySourceType, setPrimarySourceType] = useState<SourceType | null>(null);

    const canProceed = () => {
        if (step === 1) return studyArea && purpose;
        if (step === 2) return primarySourceType;
        return true;
    };

    const handleNext = () => {
        if (step === 1 && purpose !== 'exam') {
            setStep(2);
        } else if (step === 1 && purpose === 'exam' && !examType) {
            // Mostra seletor de tipo de prova
        } else {
            setStep(step + 1);
        }
    };

    const handleComplete = () => {
        saveProfile({
            studyArea: studyArea!,
            purpose: purpose!,
            examType: purpose === 'exam' ? examType || 'none' : undefined,
            primarySourceType: primarySourceType!,
            preferredSource: studyArea === 'health' ? 'pubmed' : 'auto',
            hasCompletedOnboarding: true,
        });
        onComplete();
        onCreateStudy();
    };

    const AreaCard = ({ area, label, selected }: { area: StudyArea; label: string; selected: boolean }) => (
        <button
            onClick={() => setStudyArea(area)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-indigo-300'
                }`}
        >
            <span className="text-2xl mb-2 block">{label.split(' ')[0]}</span>
            <span className="text-sm font-medium text-gray-700">{label.split(' ').slice(1).join(' ')}</span>
        </button>
    );

    const PurposeCard = ({ purposeVal, label, selected }: { purposeVal: Purpose; label: string; selected: boolean }) => (
        <button
            onClick={() => setPurpose(purposeVal)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${selected ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-purple-300'
                }`}
        >
            <span className="text-2xl mb-2 block">{label.split(' ')[0]}</span>
            <span className="text-sm font-medium text-gray-700">{label.split(' ').slice(1).join(' ')}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900/90 to-purple-900/90 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header com progresso */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-6 h-6" />
                            <span className="font-bold text-lg">Bem-vindo ao NeuroStudy!</span>
                        </div>
                        <div className="text-sm opacity-80">Passo {step} de 3</div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="flex gap-2">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? 'bg-white' : 'bg-white/30'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="p-8">

                    {/* Step 1: Área + Objetivo */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Qual é sua área de estudo?</h2>
                                <p className="text-sm text-gray-500 mb-4">Isso nos ajuda a encontrar as melhores fontes para você.</p>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {(Object.entries(LABELS.studyArea) as [StudyArea, string][]).map(([area, label]) => (
                                        <AreaCard key={area} area={area} label={label} selected={studyArea === area} />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Qual seu objetivo?</h2>
                                <p className="text-sm text-gray-500 mb-4">Personalizamos o tom e profundidade do conteúdo.</p>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {(Object.entries(LABELS.purpose) as [Purpose, string][]).map(([p, label]) => (
                                        <PurposeCard key={p} purposeVal={p} label={label} selected={purpose === p} />
                                    ))}
                                </div>
                            </div>

                            {/* Seletor de tipo de prova (só aparece se purpose = exam) */}
                            {purpose === 'exam' && (
                                <div className="animate-in fade-in slide-in-from-bottom">
                                    <h2 className="text-lg font-bold text-gray-800 mb-2">Qual prova?</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.entries(LABELS.examType) as [ExamType, string][]).map(([t, label]) => (
                                            <button
                                                key={t}
                                                onClick={() => setExamType(t)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${examType === t
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Tipo de Fonte */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Como você prefere estudar?</h2>
                                <p className="text-sm text-gray-500 mb-4">Qual tipo de material você mais usa?</p>

                                <div className="grid grid-cols-2 gap-4">
                                    {(Object.entries(LABELS.primarySourceType) as [SourceType, string][]).map(([type, label]) => (
                                        <button
                                            key={type}
                                            onClick={() => setPrimarySourceType(type)}
                                            className={`p-6 rounded-xl border-2 text-center transition-all hover:shadow-md ${primarySourceType === type
                                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                                : 'border-gray-200 hover:border-indigo-300'
                                                }`}
                                        >
                                            <span className="text-3xl mb-2 block">{label.split(' ')[0]}</span>
                                            <span className="text-sm font-medium text-gray-700">{label.split(' ').slice(1).join(' ')}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Primeira ação */}
                    {step === 3 && (
                        <div className="text-center space-y-6 animate-in fade-in slide-in-from-right duration-300">
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto">
                                <Sparkles className="w-10 h-10 text-white" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">Tudo pronto! 🎉</h2>
                                <p className="text-gray-500">
                                    Sua experiência foi personalizada. Agora vamos criar seu primeiro estudo!
                                </p>
                            </div>

                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                                <p className="text-sm text-indigo-800">
                                    <strong>Dica:</strong> Você pode mudar suas preferências a qualquer momento nas configurações.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer com navegação */}
                <div className="bg-gray-50 px-8 py-4 flex justify-between items-center border-t">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="flex items-center gap-1 text-gray-600 hover:text-gray-800 font-medium"
                        >
                            <ChevronLeft className="w-4 h-4" /> Voltar
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
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
