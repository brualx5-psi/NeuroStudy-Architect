import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { BrainCircuit, Mail, Chrome, ArrowRight, Loader2, CheckCircle2, Sparkles, Zap, Rocket, BookOpen, Target, Search, Layers, CalendarClock, GraduationCap, MessageCircle } from 'lucide-react';
import { TermsPage } from './TermsPage';
import { PrivacyPage } from './PrivacyPage';

// Componente de Carrossel com Glassmorphism
const HeroCarousel: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const features = [
        {
            icon: Zap,
            title: 'Roteiros IA',
            description: 'PDFs, vídeos e anotações transformados em roteiros de estudo estruturados em minutos.',
            gradient: 'from-indigo-500 to-indigo-600',
            shadow: 'shadow-indigo-200',
            bg: 'bg-indigo-50/50'
        },
        {
            icon: BookOpen,
            title: 'Modo Livro',
            description: 'Resuma livros inteiros. Faça upload do PDF e receba uma análise completa capítulo por capítulo.',
            gradient: 'from-orange-500 to-orange-600',
            shadow: 'shadow-orange-200',
            bg: 'bg-orange-50/50'
        },
        {
            icon: Target,
            title: 'Modo Pareto 80/20',
            description: 'Extração rápida do essencial. Ideal para consultas ágeis e tirar dúvidas pontuais.',
            gradient: 'from-red-500 to-red-600',
            shadow: 'shadow-red-200',
            bg: 'bg-red-50/50'
        },
        {
            icon: Layers,
            title: '3 Níveis de Profundidade',
            description: 'Escolha: Sobrevivência (foco no essencial), Normal (equilíbrio) ou Hard (deep dive completo).',
            gradient: 'from-amber-500 to-amber-600',
            shadow: 'shadow-amber-200',
            bg: 'bg-amber-50/50'
        },
        {
            icon: Search,
            title: 'Deep Research',
            description: 'Pesquise em bases científicas (PubMed, OpenAlex). A IA filtra e prioriza os melhores artigos.',
            gradient: 'from-cyan-500 to-cyan-600',
            shadow: 'shadow-cyan-200',
            bg: 'bg-cyan-50/50'
        },
        {
            icon: GraduationCap,
            title: 'Pirâmide de Evidências',
            description: 'Artigos classificados por nível de evidência: Guidelines, Meta-análises, RCTs e mais.',
            gradient: 'from-teal-500 to-teal-600',
            shadow: 'shadow-teal-200',
            bg: 'bg-teal-50/50'
        },
        {
            icon: CheckCircle2,
            title: 'Quiz & Flashcards',
            description: 'Teste seu conhecimento com perguntas e flashcards gerados automaticamente pela IA.',
            gradient: 'from-emerald-500 to-emerald-600',
            shadow: 'shadow-emerald-200',
            bg: 'bg-emerald-50/50'
        },
        {
            icon: MessageCircle,
            title: 'Chat Professor Virtual',
            description: 'Tire dúvidas diretamente com o professor IA. Ele conhece todo o conteúdo do seu estudo.',
            gradient: 'from-violet-500 to-violet-600',
            shadow: 'shadow-violet-200',
            bg: 'bg-violet-50/50'
        },
        {
            icon: CalendarClock,
            title: 'Revisão Espaçada',
            description: 'Agende revisões baseadas em neurociência. Lembre no momento ideal para fixar o conteúdo.',
            gradient: 'from-pink-500 to-pink-600',
            shadow: 'shadow-pink-200',
            bg: 'bg-pink-50/50'
        },
        {
            icon: BrainCircuit,
            title: 'Mapa Mental & Conexões',
            description: 'Visualize conexões entre conceitos. Entenda como os tópicos se relacionam.',
            gradient: 'from-blue-500 to-blue-600',
            shadow: 'shadow-blue-200',
            bg: 'bg-blue-50/50'
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % features.length);
        }, 3500); // Muda a cada 3.5 segundos (10 features = 35s ciclo)

        return () => clearInterval(interval);
    }, []);

    const currentFeature = features[activeIndex];
    const Icon = currentFeature.icon;

    return (
        <div className="space-y-6">
            {/* Headline Principal */}
            <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-full border border-indigo-200/50">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Powered by AI</span>
                </div>
                <h2 className="text-4xl font-black leading-tight">
                    <span className="bg-gradient-to-r from-slate-800 via-indigo-700 to-slate-800 bg-clip-text text-transparent">Estude menos.</span>
                    <br />
                    <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">Aprenda mais.</span>
                </h2>
                <p className="text-slate-500 font-medium text-sm max-w-xs mx-auto">
                    A IA que transforma qualquer conteúdo em roteiros de estudo cientificamente otimizados.
                </p>
            </div>

            {/* Carrossel Glassmorphism com Fade */}
            <div className="relative h-56 overflow-hidden">
                {features.map((feature, index) => {
                    const FeatureIcon = feature.icon;
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={index}
                            className={`absolute inset-0 transition-all duration-1000 ${isActive
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-95 pointer-events-none'
                                }`}
                        >
                            <div className={`h-full bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/50 shadow-2xl ${feature.bg} p-8 flex flex-col items-center justify-center text-center relative overflow-hidden`}>
                                {/* Glow effect */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-5 blur-xl`}></div>

                                {/* Content */}
                                <div className="relative z-10 space-y-4">
                                    <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto shadow-xl ${feature.shadow} transform transition-transform duration-500 ${isActive ? 'scale-100' : 'scale-90'}`}>
                                        <FeatureIcon className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800">{feature.title}</h3>
                                    <p className="text-slate-600 font-medium text-sm max-w-sm mx-auto leading-relaxed">{feature.description}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Indicadores de progresso */}
            <div className="flex items-center justify-center gap-2">
                {features.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveIndex(index)}
                        className={`transition-all duration-300 rounded-full ${index === activeIndex
                            ? 'w-8 h-2 bg-gradient-to-r from-indigo-600 to-blue-600'
                            : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                            }`}
                    />
                ))}
            </div>

            {/* Badges Verificáveis */}
            <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-slate-200/50 shadow-sm">
                    <span className="text-lg">🆓</span>
                    <span className="text-xs font-bold text-slate-700">Gratuito para começar</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-slate-200/50 shadow-sm">
                    <span className="text-lg">🧠</span>
                    <span className="text-xs font-bold text-slate-700">Baseado em Neurociência</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-slate-200/50 shadow-sm">
                    <span className="text-lg">🤖</span>
                    <span className="text-xs font-bold text-slate-700">Powered by Google AI</span>
                </div>
            </div>
        </div>
    );
};

export const LoginPage: React.FC = () => {
    const [currentView, setCurrentView] = useState<'login' | 'terms' | 'privacy'>('login');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Show Terms or Privacy page
    if (currentView === 'terms') {
        return <TermsPage onBack={() => setCurrentView('login')} />;
    }
    if (currentView === 'privacy') {
        return <PrivacyPage onBack={() => setCurrentView('login')} />;
    }

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            const { error } = await supabase!.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setMessage(null);
            const { error } = await supabase!.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                }
            });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Link de acesso enviado! Verifique seu e-mail.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-white relative overflow-hidden selection:bg-indigo-100">
            {/* Neon Gradient Background */}
            <div className="fixed inset-0 pointer-events-none">
                {/* Gradientes sutis */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/30 via-blue-50/20 to-slate-50/40"></div>
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-radial from-indigo-200/15 via-indigo-100/10 to-transparent blur-3xl"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-radial from-blue-200/15 via-blue-100/10 to-transparent blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-gradient-radial from-indigo-100/10 to-transparent blur-2xl"></div>
            </div>

            {/* Animated floating particles */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-20 left-[10%] w-2 h-2 bg-indigo-300/30 rounded-full animate-float-slow"></div>
                <div className="absolute top-40 right-[15%] w-3 h-3 bg-blue-300/30 rounded-full animate-float-slower"></div>
                <div className="absolute bottom-32 left-[20%] w-2 h-2 bg-indigo-300/30 rounded-full animate-float-medium"></div>
                <div className="absolute bottom-48 right-[25%] w-2 h-2 bg-slate-300/30 rounded-full animate-float-slow"></div>
            </div>

            <div className="relative h-screen flex items-center justify-center p-4 md:p-6">
                <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-8 items-center">

                    {/* Hero Section - Glassmorphism Carousel */}
                    <div className="relative order-2 md:order-1 hidden md:block">
                        <HeroCarousel />
                    </div>

                    {/* Login Card */}
                    <div className="relative order-1 md:order-2">
                        <div className="bg-white/70 backdrop-blur-2xl border border-white shadow-2xl rounded-3xl overflow-hidden relative">
                            {/* Subtle border glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-blue-500/5 to-indigo-500/5 rounded-3xl blur-xl"></div>

                            <div className="relative p-6 md:p-8">
                                {/* Header */}
                                <div className="text-center mb-5">
                                    <img src="/logo.png" alt="NeuroStudy Logo" className="w-20 h-20 mx-auto mb-3 drop-shadow-lg" />
                                    <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent mb-2">
                                        NeuroStudy
                                    </h1>
                                    <p className="text-slate-600 font-semibold text-base">
                                        A primeira IA que cria o roteiro perfeito.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleGoogleLogin}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-3 py-3 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl transition-all hover:shadow-xl hover:shadow-indigo-300/50 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0 relative group overflow-hidden"
                                    >
                                        {/* Shimmer effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                        <Chrome className="w-5 h-5 relative z-10" />
                                        <span className="relative z-10">Entrar com Google</span>
                                    </button>

                                    <div className="relative flex items-center gap-4 my-4">
                                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Ou via e-mail</span>
                                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                                    </div>

                                    <form onSubmit={handleEmailLogin} className="space-y-3">
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="email"
                                                placeholder="seu@email.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium relative"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || !email}
                                            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-300/50 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0 relative group overflow-hidden"
                                        >
                                            {/* Shimmer effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                                            ) : (
                                                <>
                                                    <span className="relative z-10">Enviar link de acesso</span>
                                                    <ArrowRight className="w-4 h-4 relative z-10" />
                                                </>
                                            )}
                                        </button>
                                    </form>

                                    {message && (
                                        <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-sm ${message.type === 'success'
                                            ? 'bg-emerald-50/80 text-emerald-800 border-2 border-emerald-200'
                                            : 'bg-red-50/80 text-red-800 border-2 border-red-200'
                                            }`}>
                                            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Loader2 className="w-5 h-5 shrink-0" />}
                                            <p className="text-sm font-semibold leading-tight">{message.text}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-gradient-to-r from-slate-50/90 to-indigo-50/50 backdrop-blur-sm border-t-2 border-slate-100 text-center">
                                <p className="text-xs text-slate-500 font-medium">
                                    Ao entrar, você concorda com nossos <br className="md:hidden" />
                                    <button onClick={() => setCurrentView('terms')} className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline">Termos de Uso</button> e <button onClick={() => setCurrentView('privacy')} className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline">Privacidade</button>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS para animações */}
            <style>{`
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(5deg); }
                }
                @keyframes float-slower {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(-5deg); }
                }
                @keyframes float-medium {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-25px) rotate(3deg); }
                }
                .animate-float-slow {
                    animation: float-slow 6s ease-in-out infinite;
                }
                .animate-float-slower {
                    animation: float-slower 8s ease-in-out infinite;
                }
                .animate-float-medium {
                    animation: float-medium 7s ease-in-out infinite;
                }
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-stops));
                }
            `}</style>
        </div>
    );
};
