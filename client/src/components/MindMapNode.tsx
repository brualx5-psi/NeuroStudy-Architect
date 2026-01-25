import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { BrainCircuit, Lightbulb, Target, Zap, Smile, Heart, Star, Activity, Rocket, Anchor, BookOpen, Coffee, Code, Layers, Users } from './Icons';

// Cores vibrantes ADHD Friendly
const COLORS = [
    { bg: 'bg-blue-500', border: 'border-blue-600', shadow: 'shadow-blue-200', text: 'text-white' },
    { bg: 'bg-emerald-500', border: 'border-emerald-600', shadow: 'shadow-emerald-200', text: 'text-white' },
    { bg: 'bg-amber-500', border: 'border-amber-600', shadow: 'shadow-amber-200', text: 'text-white' },
    { bg: 'bg-violet-500', border: 'border-violet-600', shadow: 'shadow-violet-200', text: 'text-white' },
    { bg: 'bg-rose-500', border: 'border-rose-600', shadow: 'shadow-rose-200', text: 'text-white' },
    { bg: 'bg-cyan-500', border: 'border-cyan-600', shadow: 'shadow-cyan-200', text: 'text-white' },
];

const ICONS = [Lightbulb, Target, Zap, Smile, Heart, Star, Activity, Rocket, Anchor, BookOpen, Coffee, Code, Layers, Users];

// Função determinística para escolher cor baseada no ID ou Label
const getColor = (id: string, level: number) => {
    if (level === 0) return { bg: 'bg-indigo-600', border: 'border-indigo-800', shadow: 'shadow-indigo-300', text: 'text-white', scale: 'scale-125' };

    const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[sum % COLORS.length];
};

// Função determinística para ícone
const getIcon = (label: string) => {
    const sum = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ICONS[sum % ICONS.length];
};

export const MindMapNode = memo(({ data, id }: any) => {
    const { label, level = 1 } = data;
    const color = getColor(id + label, level);
    const Icon = getIcon(label);

    const isRoot = level === 0;

    return (
        <div className="relative group">
            {/* Handles invisíveis para conexão */}
            <Handle type="target" position={Position.Left} className="w-1 h-1 !bg-transparent !border-0" />
            <Handle type="source" position={Position.Right} className="w-1 h-1 !bg-transparent !border-0" />

            <div
                className={`
          relative flex items-center gap-3 px-6 py-4 rounded-full border-b-4 transition-transform hover:-translate-y-1 hover:scale-105 duration-300 cursor-pointer
          ${color.bg} ${color.border} ${color.text} ${isRoot ? 'shadow-2xl scale-110 min-w-[200px] justify-center' : 'shadow-xl min-w-[160px]'}
          ${color.shadow}
        `}
            >
                {/* Brilho/Reflexo */}
                <div className="absolute top-1 left-4 right-4 h-1/2 bg-white/20 rounded-full blur-[2px]" />

                {/* Ícone */}
                <div className={`p-2 bg-white/20 rounded-full backdrop-blur-sm ${isRoot ? 'w-12 h-12' : 'w-8 h-8'} flex items-center justify-center`}>
                    <Icon className={isRoot ? 'w-7 h-7' : 'w-5 h-5'} />
                </div>

                {/* Texto */}
                <span className={`font-bold ${isRoot ? 'text-xl uppercase tracking-wider' : 'text-sm'}`}>
                    {label}
                </span>
            </div>
        </div>
    );
});
