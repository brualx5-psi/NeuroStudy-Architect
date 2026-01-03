import React from 'react';
import { ArrowLeft, Shield, Database, Eye, Lock, UserCheck, Trash2, Mail } from 'lucide-react';

interface PrivacyPageProps {
    onBack?: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            window.history.back();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                    </button>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-600 rounded-xl">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">Política de Privacidade</h1>
                            <p className="text-slate-500">Última atualização: Janeiro de 2026</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 md:p-12 space-y-8">

                    {/* Intro */}
                    <section>
                        <p className="text-slate-600 leading-relaxed">
                            O <strong className="text-indigo-600">NeuroStudy</strong> está comprometido com a proteção dos seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos e protegemos suas informações, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
                        </p>
                    </section>

                    {/* 1. Dados Coletados */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Database className="w-5 h-5 text-indigo-600" />
                            Dados que Coletamos
                        </h2>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h3 className="font-bold text-slate-900 mb-2">Dados de Identificação</h3>
                                <ul className="text-sm text-slate-600 space-y-1">
                                    <li>• Email (via Login Google ou Magic Link)</li>
                                    <li>• Nome completo (via Google OAuth)</li>
                                    <li>• Foto de perfil (via Google OAuth)</li>
                                </ul>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h3 className="font-bold text-slate-900 mb-2">Dados de Estudo</h3>
                                <ul className="text-sm text-slate-600 space-y-1">
                                    <li>• Área de estudo (Psicologia, Medicina, etc.)</li>
                                    <li>• Propósito de estudo (Concurso, Graduação, etc.)</li>
                                    <li>• Tipo de exame alvo (se aplicável)</li>
                                    <li>• Preferências de fontes de pesquisa</li>
                                </ul>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h3 className="font-bold text-slate-900 mb-2">Dados de Uso</h3>
                                <ul className="text-sm text-slate-600 space-y-1">
                                    <li>• Quantidade de roteiros criados</li>
                                    <li>• Minutos de YouTube analisados</li>
                                    <li>• Pesquisas web realizadas</li>
                                    <li>• Mensagens enviadas no chat</li>
                                    <li>• Status de assinatura (Gratuito/Premium)</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 2. Finalidade */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-indigo-600" />
                            Como Usamos seus Dados
                        </h2>
                        <ul className="space-y-2 text-slate-600 list-disc list-inside">
                            <li><strong>Personalização:</strong> Adaptar conteúdos à sua área de estudo</li>
                            <li><strong>Funcionalidade:</strong> Permitir login e salvar seu progresso</li>
                            <li><strong>Limites de uso:</strong> Controlar o uso dos recursos conforme seu plano</li>
                            <li><strong>Comunicação:</strong> Enviar emails sobre sua conta (quando necessário)</li>
                            <li><strong>Melhorias:</strong> Entender como o app é usado para melhorá-lo</li>
                        </ul>

                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <p className="text-emerald-800 text-sm">
                                <strong>✅ Não vendemos seus dados.</strong> Suas informações nunca serão compartilhadas com terceiros para fins comerciais.
                            </p>
                        </div>
                    </section>

                    {/* 3. Armazenamento */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-indigo-600" />
                            Armazenamento e Segurança
                        </h2>
                        <p className="text-slate-600 mb-4">
                            Seus dados são armazenados de forma segura utilizando:
                        </p>
                        <ul className="space-y-2 text-slate-600 list-disc list-inside">
                            <li><strong>Supabase:</strong> Plataforma de banco de dados com criptografia</li>
                            <li><strong>HTTPS:</strong> Toda comunicação é criptografada</li>
                            <li><strong>OAuth 2.0:</strong> Autenticação segura via Google</li>
                            <li><strong>Tokens JWT:</strong> Sessões protegidas e temporárias</li>
                        </ul>
                    </section>

                    {/* 4. Seus Direitos */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-indigo-600" />
                            Seus Direitos (LGPD)
                        </h2>
                        <p className="text-slate-600 mb-4">
                            Conforme a LGPD, você tem direito a:
                        </p>
                        <div className="grid md:grid-cols-2 gap-3">
                            {[
                                'Confirmar o tratamento dos seus dados',
                                'Acessar seus dados pessoais',
                                'Corrigir dados incompletos ou desatualizados',
                                'Solicitar anonimização ou bloqueio',
                                'Solicitar a exclusão dos seus dados',
                                'Revogar consentimento a qualquer momento'
                            ].map((right, i) => (
                                <div key={i} className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
                                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {i + 1}
                                    </div>
                                    <span className="text-sm text-indigo-800">{right}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 5. Exclusão */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-500" />
                            Exclusão de Dados
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Você pode solicitar a exclusão completa dos seus dados a qualquer momento. Ao fazer isso:
                        </p>
                        <ul className="mt-3 space-y-2 text-slate-600 list-disc list-inside">
                            <li>Todos os seus dados pessoais serão removidos em até 30 dias</li>
                            <li>Roteiros e materiais criados serão excluídos permanentemente</li>
                            <li>Esta ação é irreversível</li>
                        </ul>
                    </section>

                    {/* 6. Uso Futuro */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">6</span>
                            Uso Futuro de Dados Agregados
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Podemos utilizar dados <strong>anonimizados e agregados</strong> para fins estatísticos, como "X usuários utilizam nossa plataforma". Esses dados nunca identificam você individualmente e são usados apenas para demonstrar o alcance do NeuroStudy.
                        </p>
                    </section>

                    {/* 7. Cookies */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">7</span>
                            Cookies e Armazenamento Local
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Utilizamos armazenamento local (localStorage) para manter suas preferências e sessão de login. Não utilizamos cookies de rastreamento de terceiros para publicidade.
                        </p>
                    </section>

                    {/* 8. Alterações */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">8</span>
                            Alterações nesta Política
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Esta política pode ser atualizada periodicamente. Alterações significativas serão comunicadas por email ou através de aviso na plataforma. Recomendamos verificar esta página regularmente.
                        </p>
                    </section>

                    {/* Contato */}
                    <section className="pt-6 border-t border-slate-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            Contato do Encarregado de Dados
                        </h2>
                        <p className="text-slate-600">
                            Para exercer seus direitos ou esclarecer dúvidas:<br />
                            <strong>Responsável:</strong> Bruno Alexandre<br />
                            <strong>Email:</strong> <a href="mailto:suporte@neurostudy.com.br" className="text-indigo-600 hover:underline">suporte@neurostudy.com.br</a>
                        </p>
                    </section>

                </div>

                {/* Footer */}
                <p className="text-center text-slate-400 text-sm mt-8">
                    © 2026 NeuroStudy. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default PrivacyPage;
