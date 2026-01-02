import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { BrainCircuit, Mail, Chrome, ArrowRight, Loader2, CheckCircle2, Sparkles, Zap, Rocket } from 'lucide-react';
import { TermsPage } from './TermsPage';
import { PrivacyPage } from './PrivacyPage';

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

                    {/* Hero Section - AI Assistant Image */}
                    <div className="relative order-2 md:order-1 hidden md:block">
                        <div className="relative">
                            {/* Container com max-width conforme solicitado */}
                            <div className="relative mx-auto" style={{ maxWidth: '320px' }}>
                                <img
                                    src="/ai-hero.png"
                                    alt="AI Study Assistant"
                                    className="w-full h-auto object-contain drop-shadow-2xl rounded-3xl"
                                    style={{ objectFit: 'contain' }}
                                />

                                {/* Glow effect behind image */}
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-300/15 via-blue-300/15 to-indigo-400/15 blur-3xl -z-10 scale-110"></div>
                            </div>

                            {/* Floating holographic icons */}
                            <div className="absolute top-[15%] right-[-5%] bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-2xl border border-indigo-200/50 animate-float-slow">
                                <Sparkles className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div className="absolute bottom-[20%] left-[-5%] bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-2xl border border-blue-200/50 animate-float-slower">
                                <Zap className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="absolute top-[45%] right-[5%] bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-2xl border border-indigo-200/50 animate-float-medium">
                                <Rocket className="w-6 h-6 text-indigo-600" />
                            </div>
                        </div>

                        {/* Decorative text */}
                        <div className="mt-4 text-center space-y-1">
                            <h2 className="text-xl font-black bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 bg-clip-text text-transparent">
                                Seu assistente de estudos inteligente
                            </h2>
                            <p className="text-slate-600 font-medium text-sm">
                                Rotas personalizadas com IA
                            </p>
                        </div>
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
