import React, { useState } from 'react';
import { supabase } from '../services/supabase';

type DiagnosticsResult = {
  ZEPTOMAIL_TOKEN: string;
  ZEPTOMAIL_FROM_EMAIL: string;
  ZEPTOMAIL_FROM_NAME: string;
};

type TestResult = {
  ok: boolean;
  diagnostics?: DiagnosticsResult;
  error?: string;
  result?: unknown;
};

export const AdminEmailPanel: React.FC = () => {
  const [toEmail, setToEmail] = useState('');
  const [plan, setPlan] = useState<'starter' | 'pro'>('starter');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleSend = async () => {
    if (!toEmail.includes('@')) return;
    setIsSending(true);
    setResult(null);
    try {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      const resp = await fetch('/api/admin/testEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toEmail, plan }),
      });
      const json = await resp.json();
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message || e) });
    } finally {
      setIsSending(false);
    }
  };

  const statusColor = (val: string) =>
    val === 'MISSING' ? 'text-red-600 font-bold' : 'text-green-600 font-semibold';

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-1">Teste de email de boas-vindas</h4>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
          Envia um email de teste via ZeptoMail e exibe o diagnóstico das variáveis de ambiente.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1 block">Email destino</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="bruno@neurostudy.com.br"
              className="w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1 block">Plano</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as 'starter' | 'pro')}
              className="border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <button
            onClick={handleSend}
            disabled={isSending || !toEmail.includes('@')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors"
          >
            {isSending ? 'Enviando…' : 'Enviar teste'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border p-4 space-y-3 ${result.ok ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:bg-red-900/20'}`}>
          <p className={`text-sm font-bold ${result.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {result.ok ? '✓ Email enviado com sucesso!' : '✗ Falha ao enviar email'}
          </p>

          {result.diagnostics && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Diagnóstico de env vars</p>
              {Object.entries(result.diagnostics).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-500 dark:text-slate-400">{key}</span>
                  <span className={statusColor(val as string)}>{val as string}</span>
                </div>
              ))}
            </div>
          )}

          {result.error && (
            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide mb-1">Erro</p>
              <p className="text-xs font-mono break-all text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded p-2">
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-slate-600 p-4 bg-gray-50 dark:bg-slate-700 space-y-1">
        <p className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide mb-2">Env vars necessárias (Vercel)</p>
        {[
          ['ZEPTOMAIL_TOKEN', 'Token da API ZeptoMail'],
          ['ZEPTOMAIL_FROM_EMAIL', 'Ex: bruno@neurostudy.com.br'],
          ['ZEPTOMAIL_FROM_NAME', 'Opcional — nome do remetente'],
          ['ASAAS_WEBHOOK_TOKEN', 'Mesmo valor configurado no Asaas'],
        ].map(([key, hint]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 min-w-fit">{key}</span>
            <span className="text-gray-400 dark:text-slate-500">{hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
