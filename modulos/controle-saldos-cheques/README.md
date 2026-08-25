# Controle de Saldos e Cheques

Módulo web/PWA para o setor financeiro analisar a planilha diária de saldos e cheques.

## Como usar

1. Abra `index.html` pelo servidor local ou pelo link publicado.
2. Selecione a planilha Excel no campo **Arquivo Excel**.
3. Clique em **Gerar análise**.
4. Use **Período** para analisar todos os registros ou selecionar um intervalo personalizado.
5. Alterne entre **Resumo** e **Detalhamento** para ver totais ou indicadores do período.
6. Confira **Formas de pagamento** em dois blocos separados: recebimentos por forma e pagamentos por origem.
7. Use **Resumo** para ver categorias gerais ou **Detalhado** para ver filiais/linhas vinculadas a cada grupo.
8. Use **Salvar imagem** para baixar o painel em PNG ou **Imprimir** para imprimir.

## Regras de leitura

- A aba principal é `Fluxo`.
- A tabela vertical deve ter cabeçalhos `DATA`, `ENTRADAS`, `SAÍDAS` e `SALDO`.
- Quando a parte horizontal superior da aba `Fluxo` tiver datas mais recentes que a tabela vertical, o sistema usa automaticamente essa parte mais atual.
- Linhas sem data/período não entram nos gráficos.
- A linha de total geral é usada apenas para conferência, não como registro diário.
- A aba `fluxo diario` é usada como apoio quando existir, comparando `RECEBIMENTOS` e `PAGAMENTOS`.
- A opção **Formas de pagamento** usa a aba `fluxo diario`, lendo as datas no topo e somando recebimentos e pagamentos separadamente no período selecionado.

## Privacidade

A planilha é processada no navegador do usuário. Nenhum dado financeiro é enviado para servidor externo.

## Publicação no GitHub

A pasta `estrutura` pode ser usada como raiz do repositório privado.

Comandos sugeridos depois de configurar o GitHub:

```powershell
cd "C:\Users\Jhonny\Desktop\Sistema Financeiro(Source Code)\estrutura"
git init
git add .
git commit -m "Adiciona modulo controle de saldos e cheques"
git branch -M main
git remote add origin https://github.com/SUA-ORGANIZACAO/controle-saldos-cheques.git
git push -u origin main
```
