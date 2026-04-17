import React, { useState } from 'react';
import { supabase } from '../services/supabase';

type EmailType = 'signup' | 'upgrade' | 'cancelled';

const EMAIL_TYPES: { type: EmailType; label: string; description: string }[] = [
  { type: 'signup',    label: '1. Boas-vindas (cadastro)',  description: 'Enviado quando a pessoa cria conta' },
  { type: 'upgrade',  label: '2. Plano atualizado',        description: 'Enviado quando assina Starter ou Pro' },
  { type: 'cancelled', label: '3. Cancelamento',           description: 'Enviado quando cancela a assinatura' },
];

type TestResult = {
  ok: boolean;
  diagnostics?: Record<string, string>;
  error?: string;
  result?: unknown;
};

export const AdminEmailPanel: React.FC = () => {
  const [toEmail, setToEmail] = useState('');
  const [plan, setPlan] = useState<'starter' | 'pro'>('starter');
  const [sending, setSending] = useState<EmailType | null>(null);
  const [results, setResults] = useState<Partial<Record<EmailType, TestResult>>>({});

  const handleSend = async (type: EmailType) => {
    if (!toEmail.includes('@')) return;
    setSending(type);
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      const resp = await fetch('/api/admin/testEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toEmail, plan, type }),
      });
      const json = await resp.json();
      setResults(prev => ({ ...prev, [type]: json }));
    } catch (e: any) {
      setResults(prev => ({ ...prev, [type]: { ok: false, error: String(e?.message || e) } }));
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-1">Teste de emails</h4>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Envia cada tipo de email via ZeptoMail para o endereço abaixo.</p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end mb-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1 block">Email destino</label>
            <input
              type="email"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              placeholder="brualx5@gmail.com"
              className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1 block">Plano</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value as 'starter' | 'pro')}
              className="border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {EMAIL_TYPES.map(({ type, label, description }) => {
            const result = results[type];
            return (
              <div key={type} className="rounded-xl border border-gray-200 dark:border-slate-600 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-100">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
                  </div>
                  <button
                    onClick={() => handleSend(type)}
                    disabled={sending !== null || !toEmail.includes('@')}
                    className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    {sending === type ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>

                {result && (
                  <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                    {result.ok ? '✓ Enviado com sucesso!' : `✗ ${result.error}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Diagnóstico global baseado no primeiro resultado com diagnostics */}
      {Object.values(results).find(r => r?.diagnostics) && (() => {
        const diag = Object.values(results).find(r => r?.diagnostics)!.diagnostics!;
        return (
          <div className="rounded-xl border border-gray-200 dark:border-slate-600 p-4 bg-gray-50 dark:bg-slate-700 space-y-1">
            <p className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide mb-2">Diagnóstico de env vars</p>
            {Object.entries(diag).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-500 dark:text-slate-400">{key}</span>
                <span className={val === 'MISSING' ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>{val}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};
