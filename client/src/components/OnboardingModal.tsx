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
        handleComplete();
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
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="p-5 overflow-y-auto flex-1">
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
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-5 py-3 flex justify-end items-center border-t flex-shrink-0">
                    <button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        🚀 Começar Agora
                    </button>
                </div>
            </div>
        </div>
    );
};
