# Trecho 2 — Dashboard PDM Infraestrutura

Este pacote contém um site estático pronto para **GitHub Pages**, com foco na planilha principal do PDM como fonte única de dados.

## O que mudou neste esboço

- Removida a área antiga de relatório diário do fiscal.
- Removidos controles que exigiam alimentar o site manualmente.
- Criados dois dashboards:
  - **ZBV-ZAR PDM Limpeza**
  - **ZBV-ZAR Obras**
- Criados cards de limpeza de lastro por **SUB**.
- Criados cards de obras com status, risco, KM, prazo, equipamento e observação.
- Adicionada tela **Fonte de dados** para conectar a planilha PDM online publicada em CSV.
- Mantido tema claro como padrão e botão discreto de tema escuro no topo.

## Arquivos principais

```text
index.html
styles.css
script.js
data/pdm-limpeza.json
data/obras-dr.json
data/source-config.json
```

Os arquivos JSON de exemplo foram gerados a partir da planilha:

```text
1. UNIFILAR T2 DR.xlsx
```

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos deste pacote para a raiz do repositório.
3. Vá em **Settings > Pages**.
4. Em **Build and deployment**, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Salve e aguarde o link do GitHub Pages.

## Como conectar a planilha PDM online

O caminho mais simples é usar Google Planilhas:

1. Suba a planilha PDM para o Google Drive.
2. Abra no Google Planilhas.
3. Confira se as abas continuam com estes dados:
   - `ZBV-ZAR PDM Limpeza`
   - `ZBV-ZAR Obras`
4. Publique cada aba como CSV:
   - **Arquivo > Compartilhar > Publicar na Web**
   - Escolha a aba desejada.
   - Escolha o formato **CSV**.
5. Copie a URL CSV da aba de limpeza.
6. Copie a URL CSV da aba de obras.
7. No site, abra **Fonte de dados** e cole as URLs.

## Configuração central para todos os usuários

Se você não quiser que cada pessoa cole a URL no navegador, edite o arquivo:

```text
data/source-config.json
```

Exemplo:

```json
{
  "limpezaCsvUrl": "https://docs.google.com/spreadsheets/d/.../pub?gid=0&single=true&output=csv",
  "obrasCsvUrl": "https://docs.google.com/spreadsheets/d/.../pub?gid=123&single=true&output=csv"
}
```

Depois disso, faça commit no GitHub. Todos que abrirem o site passam a ler a planilha online.

## Observação importante

Evite usar PDF como fonte de dados do dashboard. PDF é bom para visualização e arquivo, mas a leitura automática é frágil. Para o dashboard, use CSV/JSON gerado pela planilha principal do PDM.

## Dados extraídos neste exemplo

- Limpeza Geral:
  - SUBs: 63, 66, 68, 70, 71, 78
  - Equipamentos: 133
- Obras:
  - Obras: 15
  - SUBs: 63, 68, 70, 78

Gerado em: 19/05/2026 23:11
