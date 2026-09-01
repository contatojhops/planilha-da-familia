# Planilha da Família

Você é um engenheiro de software sênior especializado em fintech e aplicações web. Construa um aplicativo web completo de Gestão Financeira Familiar, com foco em uso multiusuário (vários membros de uma mesma família), planejamento de fluxo de caixa e alertas de vencimento.

1. Stack técnica

Frontend em React + TypeScript + Tailwind CSS, com componentes shadcn/ui.

Backend via Supabase (Postgres + Auth + Row Level Security + Edge Functions + pg_cron para agendamentos).

Gráficos com Recharts.

Todas as tabelas devem ter RLS habilitado, isolando os dados por "família" (workspace), nunca por usuário isolado — vários usuários acessam os mesmos dados da família com permissões diferentes.

2. Autenticação e perfis de acesso (multiusuário)

Cadastro/login via Supabase Auth (e-mail/senha + login social opcional com Google).

Modelo de dados: uma tabela families (núcleo familiar) e uma tabela family_members que relaciona user_id a family_id com um campo role.

Papéis (roles):

Administrador: cria/edita/exclui tudo, convida e remove membros, define permissões, vê todos os relatórios.

Membro: lança receitas/despesas próprias e vê o consolidado da família, mas não edita configurações nem remove outros membros.

Visualizador: acesso somente leitura aos dashboards e relatórios (ex.: para um contador ou cônjuge que só quer acompanhar).

Convite de novos membros por e-mail (gera um link de convite com token, expira em 7 dias).

Cada lançamento financeiro deve guardar quem o criou (created_by), para rastreabilidade dentro da família.

3. Módulo "Planilha Financeira" (núcleo do app)

Tela em formato de planilha editável (grid), permitindo lançar receitas e despesas por mês, com edição inline (sem precisar abrir modal para cada célula).

Cada lançamento tem: descrição, valor, categoria, subcategoria, data, tipo (receita/despesa), se é recorrente (mensal/anual/parcelado), responsável (quem lançou/quem é o dono do gasto), forma de pagamento (dinheiro, débito, crédito, pix, boleto), e status (previsto vs. realizado).

Projeção de saldo futuro: para cada um dos próximos 12 meses, o sistema soma receitas previstas + realizadas e subtrai despesas previstas + realizadas (incluindo recorrências e parcelamentos futuros), calculando o saldo projetado do mês.

Mês com saldo projetado ≥ 0 → sinalizado em verde.

Mês com saldo projetado < 0 → sinalizado em vermelho, com destaque visual (ícone de alerta) e um cálculo mostrando o valor do déficit.

Incluir uma barra/linha do tempo horizontal no topo do dashboard com os 12 meses coloridos (semáforo visual), clicável para abrir o detalhamento daquele mês.

Saldo acumulado (efeito cascata): se um mês fecha no vermelho, isso deve impactar o saldo inicial projetado do mês seguinte, e o app deve alertar quando a soma acumulada ficar negativa mesmo que meses isolados estejam no verde.

4. Categorias e subcategorias

Categorias padrão pré-cadastradas, mas 100% customizáveis pela família:

Receitas: Salário, Freelance/Autônomo, Rendimentos de investimento, Aluguel recebido, Outros.

Despesas fixas: Moradia (aluguel/condomínio/financiamento), Contas (água, luz, gás, internet), Educação, Saúde/Plano de saúde, Transporte, Seguros, Assinaturas/streaming.

Despesas variáveis: Alimentação/mercado, Lazer, Vestuário, Cuidados pessoais, Presentes, Manutenção casa/carro.

Dívidas: Cartão de crédito, Empréstimos, Financiamentos, Consórcio.

Cada categoria tem ícone, cor e um orçamento mensal opcional (budget) definido pela família, para comparar "orçado vs. realizado".

Relatório de gasto por categoria com gráfico de pizza/rosca e comparação mês a mês.

5. Contas a pagar/receber com vencimento

Módulo dedicado (separado da planilha, mas conectado a ela) para contas com data de vencimento: boletos, faturas de cartão, mensalidades, financiamentos.

Cada conta tem: nome, valor, categoria, data de vencimento, recorrência, status (pendente, pago, atrasado, agendado), e a quem pertence.

Quando uma conta é marcada como paga, ela automaticamente vira um lançamento de despesa realizada na planilha do mês correspondente.

Dashboard "Próximos vencimentos" mostrando os próximos 7/15/30 dias, com destaque para contas atrasadas.

6. Sistema de alertas via WhatsApp

Como o Lovable não expõe diretamente uma API de WhatsApp, a arquitetura recomendada é:

O app grava os vencimentos numa tabela bills no Supabase.

Uma Supabase Edge Function, agendada via pg_cron (execução diária, ex.: 8h), varre as contas com vencimento em D-3, D-1 e D0 (configurável pelo usuário) para cada família.

Essa Edge Function chama a Meta WhatsApp Cloud API (recomendada para produção, gratuita até um volume alto de mensagens, mais estável que soluções não oficiais) usando um número comercial verificado, enviando uma mensagem de template pré-aprovada do tipo: "Olá {nome}, sua conta '{descrição}' de R$ {valor} vence em {data}."

Alternativa mais rápida para prototipar sem aprovação de template: usar o Twilio WhatsApp Sandbox/API — funciona em minutos, ideal para MVP, migrando para Meta Cloud API depois.

Cada membro da família cadastra seu número de WhatsApp e escolhe quais alertas quer receber (tela de preferências de notificação): vencimento de conta, mês projetado no vermelho, gasto acima do orçamento da categoria, meta atingida.

Implemente também um centro de notificações in-app (sino no topo) como fallback, já que a integração de WhatsApp depende de aprovação/configuração externa da Meta — assim o app funciona 100% mesmo antes do WhatsApp estar configurado.

7. Metas financeiras

Módulo de metas (ex.: "Reserva de emergência", "Viagem em dezembro", "Entrada do apartamento").

Cada meta tem: nome, valor-alvo, valor atual, data-alvo, categoria/ícone, e pode receber aportes manuais ou ser vinculada a uma "poupança automática" de X% do saldo positivo do mês.

Barra de progresso visual e projeção de "quando a meta será atingida no ritmo atual".

8. Investimentos

Módulo simples de carteira: cadastro manual de ativos (renda fixa, ações, fundos, cripto, previdência) com valor investido, data de aporte e valor atual atualizado manualmente ou por aporte recorrente.

Gráfico de evolução patrimonial (soma de saldo em conta + investimentos - dívidas = patrimônio líquido da família ao longo do tempo).

Distribuição da carteira por classe de ativo (gráfico de pizza).

9. Relatórios e dashboards avançados

Dashboard principal com: saldo do mês, projeção dos próximos 12 meses (semáforo verde/vermelho), gasto por categoria, evolução de receitas x despesas (gráfico de linha), maiores gastos do mês, patrimônio líquido.

Relatório comparativo mês a mês e ano a ano.

Relatório "orçado vs. realizado" por categoria.

Exportação de relatórios em PDF e CSV.

Filtro por membro da família (ver gastos individuais dentro do consolidado).

10. Funcionalidades adicionais essenciais para um app de finanças familiares

Controle de cartão de crédito: cadastro de cartões, limite, fatura atual, data de fechamento/vencimento, e projeção de fatura futura com base nos lançamentos parcelados.

Reserva de emergência: indicador dedicado mostrando quantos meses de despesas fixas a reserva atual cobre.

Importação de extrato: upload de CSV/OFX do banco para importar lançamentos em lote, com sugestão automática de categoria baseada em histórico.

Modo escuro/claro.

Divisão de despesas compartilhadas: marcar um gasto como "dividido" entre membros, calculando quanto cada um deve.

Histórico de auditoria: log de alterações e exclusões de lançamentos (quem alterou o quê e quando), importante em uso multiusuário.

Onboarding guiado: ao criar a família, um wizard ajuda a cadastrar renda fixa, despesas fixas recorrentes e a primeira meta.

11. Diretrizes de design

Visual limpo, confiável e "sério" (é dinheiro da família) — evitar excesso de gamificação. Usar verde/vermelho apenas para status financeiro (nunca para decoração), com uma paleta neutra de base (cinzas, azul petróleo) e boa hierarquia tipográfica.

Totalmente responsivo, com prioridade para uso mobile (a maioria vai lançar gastos pelo celular).

Navegação por sidebar colapsável em desktop e bottom navigation em mobile.

Observações para você (fora do prompt)

WhatsApp: como você pediu sugestão, a rota mais realista é começar com Twilio Sandbox para validar o fluxo rápido, e migrar para a Meta WhatsApp Cloud API quando o produto estiver estável (ela exige verificação de número comercial e aprovação de templates de mensagem, o que leva alguns dias). O Lovable não faz isso nativamente — você vai precisar configurar a Supabase Edge Function e as chaves de API à parte.

Multiusuário com permissões: pedi explicitamente RLS por family_id (não por user_id), que é o padrão certo para dados compartilhados entre vários usuários da mesma família — evita o erro comum de cada membro ver só os próprios lançamentos.

Se quiser, no próximo passo posso ajudar a detalhar o schema do banco (tabelas, colunas e políticas de RLS) antes de você colar isso no Lovable, para reduzir retrabalho de estrutura depois.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/88615813-2ea7-4a78-a166-2d0d0c01f680).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
