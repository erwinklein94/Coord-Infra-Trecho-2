# Controle Trecho 2 — Infraestrutura Ferroviária

Site estático para GitHub Pages com:

- Dashboard de obras e metas do PDM.
- Formulário diário para fiscais.
- Histórico local no navegador.
- Exportação de relatórios para JSON, PDF via impressão do navegador e texto para WhatsApp.
- Importação de relatórios JSON para atualizar o dashboard e baixar novo `data/obras.json`.

## Como publicar no GitHub Pages

1. Descompacte o `.zip`.
2. Envie os arquivos para um repositório GitHub.
3. No GitHub, vá em **Settings > Pages**.
4. Selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/root`.
6. Aguarde o link do GitHub Pages ficar disponível.

## Arquivos principais

- `index.html`: estrutura do site.
- `styles.css`: visual e responsividade.
- `script.js`: lógica do dashboard, relatórios, exportações e importações.
- `data/obras.json`: base pública das obras exibidas no dashboard.

## Fluxo recomendado

### Fiscal

1. Abre o site.
2. Vai em **Relatório do fiscal**.
3. Preenche data, horários, obra, metros executados, observações e fotos.
4. Salva o relatório.
5. Em **Histórico**, seleciona um período.
6. Exporta:
   - **JSON** para enviar à coordenação e alimentar o dashboard.
   - **PDF** para registro formal.
   - **WhatsApp** para envio rápido em texto.

### Coordenação

1. Recebe os JSONs dos fiscais.
2. Abre a aba **Atualizar dados**.
3. Importa os JSONs.
4. Clica em **Aplicar no dashboard local**.
5. Confere a aba **Dashboard**.
6. Clica em **Baixar obras.json atualizado**.
7. Substitui o arquivo `data/obras.json` no repositório.
8. Faz commit para atualizar o GitHub Pages.

## Observações importantes

- O site não usa banco de dados nem servidor. Ele roda 100% no navegador.
- Os relatórios ficam salvos no `localStorage` do navegador de cada fiscal.
- Ao limpar dados do navegador, o histórico local pode ser perdido.
- Para evitar perda de informação, oriente os fiscais a exportarem JSON/PDF diariamente.
- O WhatsApp abre apenas com o texto preenchido; fotos não são anexadas automaticamente por limitação do navegador/WhatsApp Web.
- O botão PDF abre a janela de impressão. No navegador, escolha **Salvar como PDF**.

## Editar obras iniciais

Abra `data/obras.json` e ajuste os campos:

```json
{
  "id": "OBR-001",
  "nome": "Nome da obra",
  "frente": "Drenagem",
  "tipo": "Canaleta / bueiro / talude",
  "kmInicio": "101+200",
  "kmFim": "101+900",
  "metaMetros": 700,
  "executadoMetros": 280,
  "responsavel": "Fiscal 1",
  "status": "Em andamento",
  "ultimaAtualizacao": "2026-05-19",
  "observacoes": "Observações da coordenação",
  "apontamentosAplicados": []
}
```

Status sugeridos:

- `Planejada`
- `Em andamento`
- `Atenção`
- `Concluída`

## Próximas melhorias possíveis

- Login por fiscal.
- Banco de dados real, como Firebase ou Supabase.
- Sincronização automática sem commit manual.
- Campos específicos por tipo de obra.
- Mapa dos KMs.
- Assinatura digital do fiscal e da coordenação.
