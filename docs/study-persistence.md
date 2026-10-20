# Proteção e recuperação dos estudos

O carregamento da conta é somente leitura. Uma falha de rede não vira uma coleção vazia e não libera o autosave. Cada montagem da conta tem uma sessão independente; logout, troca de usuário e reabertura invalidam a fila antiga.

As gravações usam `save_study_snapshot`, uma transação com bloqueio da linha e comparação de `study_revision`. Conflitos e respostas incertas interrompem as gravações daquela sessão. O perfil usa uma operação separada que altera somente `content.profile`. A extensão também compara a versão e informa falhas.

O banco registra o conteúdo anterior na mesma transação de cada mudança de estudos/pastas, incluindo exclusões intencionais. `study_history` conserva até 50 versões anteriores por conta; sua primeira versão é a cópia presente quando esta migração foi aplicada. Não recupera dados que já tinham sido perdidos antes disso. O histórico pertence ao mesmo banco e não substitui um backup externo.

Uma política restritiva limita `user_data` ao proprietário mesmo se houver políticas permissivas antigas. Clientes não podem apagar diretamente a linha nem modificar o histórico. O trigger recusa alterações de estudos sem incremento correto de versão, inclusive de abas antigas. Exclusão administrativa da conta continua apagando seu histórico via FK.

## Recuperação pelo aplicativo

1. Abra **Backups** e examine as versões locais e da nuvem.
2. **Baixar estudos atuais** exporta JSON que pode ser guardado fora do navegador.
3. **Adicionar como cópias** atribui novos IDs e preserva a coleção atual.
4. Em conflito, baixe primeiro a edição atual, reabra os estudos da nuvem e importe a cópia desejada. A reabertura desmonta a sessão anterior, inclusive tarefas assíncronas.

O armazenamento local usa `neurostudy_data:<userId>:<sessionId>`. Cópias pendentes de sessões anteriores não são substituídas na abertura. O antigo `neurostudy_data`, sem proprietário identificado, fica intacto e exige confirmação de pertencimento para importar. Arquivos importados também exigem confirmação. Falhas de quota são exibidas, sem afirmar que houve backup local.

## Publicação e validação

- Aplicar `20261020225405_protect_study_persistence.sql` ao projeto Supabase correto, junto da publicação deste frontend e API. Não executar novamente as migrações históricas do repositório.
- O frontend novo falha de modo seguro enquanto a migração não existe. Depois de aplicá-la, abas antigas devem ser atualizadas: gravações sem controle de versão serão recusadas e as cópias locais antigas continuam disponíveis para importação.
- `npm run test:persistence` executa cenários de corrida, rede, quotas, isolamento e recuperação; também aplica a migração em Postgres local em memória, testando RLS, conflito, perfil, histórico, retenção e extensão.
- Executar `npm run lint`, `npm run build` e os verificadores existentes de hardening/edição de roteiro.
- Verificar o commit servido no domínio de produção e as políticas/funções do banco após publicar. Não reverter o banco apagando o histórico. Um rollback para frontend antigo precisa manter os backups e tratar a incompatibilidade do salvamento.

O login e o carregamento inicial exigem internet. Cópias locais e exportadas ajudam em recuperação, mas não tornam este fluxo um aplicativo offline nem garantem contra todas as formas de perda.
