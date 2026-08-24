# Templates de UI Visual/Sysint

Esta pasta guarda presets simples para futuras telas do sistema comercial.

## Arquivos

- `visual-ui-base.css`: base de cores, paineis, botoes, campos e tabelas no visual novo do sistema.
- `template-aba.html`: exemplo de tela com titulo, status, acoes e tabela.
- `template-formulario.html`: exemplo de tela com filtros/formulario e botoes.

## Como usar

1. Copie um dos arquivos `template-*.html` para a pasta do novo modulo.
2. Copie ou referencie `visual-ui-base.css`.
3. Troque somente os textos, IDs e colunas necessarios para a nova funcao.
4. Mantenha a estrutura compacta: painel azul no topo, faixas amarelas, botoes baixos e tabela com cabecalho laranja.

## Padrao visual

- Fundo geral creme.
- Painel principal com borda classica em relevo.
- Titulo/status em faixa amarelo operacional.
- Botoes pequenos com relevo.
- Campos com borda `inset`.
- Tabelas densas com cabecalho laranja e linhas creme.

Estes templates sao estaticos e nao alteram o `index.html` principal.
