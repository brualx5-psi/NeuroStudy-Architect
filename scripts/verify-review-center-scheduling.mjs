import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('client/src/App.tsx');
const center = read('client/src/components/NotificationCenter.tsx');
const modal = read('client/src/components/ReviewSchedulerModal.tsx');
const results = read('client/src/components/ResultsView.tsx');

const checks = [
  {
    name: 'agendamento salva nextReviewDate e updatedAt independente do Google Agenda',
    pass: app.includes('nextReviewDate: timestamp') && app.includes('updatedAt: Date.now()') && app.includes('if (openCalendar)')
  },
  {
    name: 'badge/notificação do sino considera qualquer revisão do dia, não apenas horário já vencido',
    pass: app.includes('getEndOfTodayTimestamp()') && app.includes('s.nextReviewDate <= getEndOfTodayTimestamp()')
  },
  {
    name: 'notificação de navegador no dia da revisão usa setting reviewReminders e evita duplicar por data',
    pass: app.includes('settings.notifications.reviewReminders') && app.includes('new Notification(') && app.includes('REVIEW_NOTIFICATION_STORAGE_KEY') && app.includes('getLocalDateKey(study.nextReviewDate)')
  },
  {
    name: 'Central das Revisões lista todas as revisões agendadas',
    pass: center.includes('scheduledReviews') && center.includes('Hoje / atrasadas') && center.includes('Próximas 7 dias') && center.includes('Mais tarde')
  },
  {
    name: 'Central mostra nome do roteiro/estudo e ação Abrir roteiro',
    pass: center.includes('study.guide?.title || study.title') && center.includes('Abrir roteiro') && app.includes("setActiveTab(study?.guide ? 'guide' : 'sources')")
  },
  {
    name: 'Modal deixa claro que Google Agenda é opcional e a Central sempre salva',
    pass: modal.includes('Salva na Central das Revisões') && modal.includes('Também abrir Google Agenda') && modal.includes('Salvar <ChevronRight')
  },
  {
    name: 'Botão do roteiro não usa placeholder falso para agendar',
    pass: !results.includes('studyIdPlaceholder') && results.includes('onScheduleReview?: () => void') && results.includes('Revisão salva na Central')
  }
];

const failed = checks.filter(check => !check.pass);
if (failed.length) {
  console.error('Falhas na verificação da Central de Revisões:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log('OK: Central de Revisões salva, lista, abre roteiro e notifica no dia.');
