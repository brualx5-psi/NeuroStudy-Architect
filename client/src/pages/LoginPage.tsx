import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { BrainCircuit, Mail, Chrome, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-100">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md relative">
                {/* Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white shadow-2xl rounded-3xl overflow-hidden">
                    <div className="p-8 md:p-10">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="inline-flex p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4 animate-bounce-subtle">
                                <BrainCircuit className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">NeuroStudy</h1>
                            <p className="text-slate-500 font-medium">A primeira IA que não estuda por você, mas cria o roteiro perfeito.</p>
                        </div>

                        {/* Buttons */}
                        <div className="space-y-4">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                            >
                                <Chrome className="w-5 h-5" />
                                Entrar com Google
                            </button>

                            <div className="relative flex items-center gap-4 my-8">
                                <div className="flex-1 border-t border-slate-100"></div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Ou via e-mail</span>
                                <div className="flex-1 border-t border-slate-100"></div>
                            </div>

                            <form onSubmit={handleEmailLogin} className="space-y-4">
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="seu@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Enviar link de acesso
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>

                            {message && (
                                <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Loader2 className="w-5 h-5 shrink-0" />}
                                    <p className="text-sm font-medium leading-tight">{message.text}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                            Ao entrar, você concorda com nossos <br className="md:hidden" />
                            <a href="#" className="text-indigo-600 hover:underline">Termos de Uso</a> e <a href="#" className="text-indigo-600 hover:underline">Privacidade</a>.
                        </p>
                    </div>
                </div>

                {/* Floating elements for "vibe" */}
                <div className="absolute top-[-20px] right-[-20px] bg-white p-3 rounded-2xl shadow-xl border border-slate-100 rotate-12 hidden md:block">
                    <span className="text-xl">🚀</span>
                </div>
                <div className="absolute bottom-[-10px] left-[-30px] bg-white p-3 rounded-2xl shadow-xl border border-slate-100 -rotate-12 hidden md:block">
                    <span className="text-xl">🧬</span>
                </div>
            </div>
        </div>
    );
};
