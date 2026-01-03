import React from 'react';
import { ArrowLeft, Scale, Shield, AlertTriangle, CreditCard, XCircle, Mail } from 'lucide-react';

interface TermsPageProps {
    onBack?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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
                        <div className="p-3 bg-indigo-600 rounded-xl">
                            <Scale className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">Termos de Uso</h1>
                            <p className="text-slate-500">Última atualização: Janeiro de 2026</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 md:p-12 space-y-8">

                    {/* Intro */}
                    <section>
                        <p className="text-slate-600 leading-relaxed">
                            Bem-vindo ao <strong className="text-indigo-600">NeuroStudy</strong>! Estes Termos de Uso regulam o acesso e uso da nossa plataforma de estudos com inteligência artificial. Ao utilizar o NeuroStudy, você concorda com estes termos.
                        </p>
                    </section>

                    {/* 1. Definições */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">1</span>
                            Definições
                        </h2>
                        <ul className="space-y-2 text-slate-600">
                            <li><strong>Plataforma:</strong> O aplicativo web NeuroStudy e todos os seus recursos.</li>
                            <li><strong>Usuário:</strong> Pessoa física que acessa e utiliza a Plataforma.</li>
                            <li><strong>Desenvolvedor:</strong> Bruno Alexandre, responsável pelo desenvolvimento e manutenção.</li>
                            <li><strong>Conteúdo:</strong> Roteiros de estudo, pesquisas, e materiais gerados pela plataforma.</li>
                        </ul>
                    </section>

                    {/* 2. Serviços */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">2</span>
                            Serviços Oferecidos
                        </h2>
                        <p className="text-slate-600 mb-4">O NeuroStudy oferece:</p>
                        <ul className="space-y-2 text-slate-600 list-disc list-inside">
                            <li>Geração de roteiros de estudo personalizados com IA</li>
                            <li>Pesquisa em bases científicas (PubMed, OpenAlex)</li>
                            <li>Integração com YouTube para análise de vídeos educacionais</li>
                            <li>Chat inteligente para suporte ao aprendizado</li>
                            <li>Exportação de materiais em PDF</li>
                        </ul>
                    </section>

                    {/* 3. Planos */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-600" />
                            Planos e Preços
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-2">Plano Gratuito</h3>
                                <ul className="text-sm text-slate-600 space-y-1">
                                    <li>• 3 roteiros de estudo por mês</li>
                                    <li>• 30 minutos de análise YouTube</li>
                                    <li>• 10 pesquisas web</li>
                                    <li>• 20 mensagens no chat</li>
                                </ul>
                            </div>
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                                <h3 className="font-bold text-indigo-900 mb-2">Plano Premium - R$ 29,90/mês</h3>
                                <ul className="text-sm text-indigo-700 space-y-1">
                                    <li>• Roteiros ilimitados</li>
                                    <li>• Uso ilimitado de todas as funcionalidades</li>
                                    <li>• Suporte prioritário</li>
                                    <li>• Acesso a recursos exclusivos</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 4. Responsabilidades */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-600" />
                            Responsabilidades do Usuário
                        </h2>
                        <ul className="space-y-2 text-slate-600 list-disc list-inside">
                            <li>Fornecer informações verdadeiras no cadastro</li>
                            <li>Manter a confidencialidade de suas credenciais de acesso</li>
                            <li>Não utilizar a plataforma para fins ilegais ou antiéticos</li>
                            <li>Não tentar acessar sistemas ou dados de outros usuários</li>
                            <li>Verificar e validar informações geradas pela IA antes de uso profissional</li>
                        </ul>
                    </section>

                    {/* 5. Limitações */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Limitações de Responsabilidade
                        </h2>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-amber-800 text-sm leading-relaxed">
                                <strong>Importante:</strong> O NeuroStudy utiliza inteligência artificial que pode gerar conteúdos imprecisos ou desatualizados. O Desenvolvedor não se responsabiliza por decisões tomadas com base exclusiva no conteúdo gerado pela plataforma. Sempre verifique informações críticas com fontes oficiais.
                            </p>
                        </div>
                    </section>

                    {/* 6. Cancelamento */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-500" />
                            Cancelamento e Reembolso
                        </h2>
                        <ul className="space-y-2 text-slate-600 list-disc list-inside">
                            <li>O plano Premium pode ser cancelado a qualquer momento</li>
                            <li>Ao cancelar, você mantém acesso até o fim do período pago</li>
                            <li>Não há reembolso proporcional por dias não utilizados</li>
                            <li>A conta gratuita permanece ativa após cancelamento do Premium</li>
                        </ul>
                    </section>

                    {/* 7. Propriedade Intelectual */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">7</span>
                            Propriedade Intelectual
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            O Usuário mantém a propriedade dos dados e conteúdos que inserir na plataforma. Os roteiros gerados são de uso exclusivo do Usuário. A marca NeuroStudy, logotipos e código-fonte são propriedade do Desenvolvedor.
                        </p>
                    </section>

                    {/* 8. Alterações */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-black text-sm">8</span>
                            Alterações nos Termos
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Estes termos podem ser alterados a qualquer momento. Alterações significativas serão comunicadas por email. O uso continuado da plataforma após alterações implica aceitação dos novos termos.
                        </p>
                    </section>

                    {/* Contato */}
                    <section className="pt-6 border-t border-slate-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            Contato
                        </h2>
                        <p className="text-slate-600">
                            Para dúvidas sobre estes termos, entre em contato:<br />
                            <strong>Desenvolvedor:</strong> Bruno Alexandre<br />
                            <strong>Email:</strong> <a href="mailto:contato@neurostudy.com.br" className="text-indigo-600 hover:underline">contato@neurostudy.com.br</a>
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

export default TermsPage;
