# Tarefas em andamento

1. Implementar tela "Família" (`/_authenticated/familia`)
   - Listar membros da família logada com nome, papel, WhatsApp e data de entrada.
   - Para admin: alterar papel de membro e remover membro (com proteção contra auto-remoção/rebaixamento do único admin).
   - Listar convites pendentes, copiar link e revogar.
   - Modal "+ Convidar membro" com e-mail e papel.

2. Criar rota pública `/convite/:token`
   - Exigir login (redirecionar para `/auth` com retorno).
   - Mostrar família/papel do convite ou mensagem de inválido/expirado.
   - Campo de nome de exibição e botão "Aceitar convite".

3. Ajustar função `accept_family_invite` para receber nome de exibição opcional e salvar no perfil.

4. Validar typecheck, lint e preview.
