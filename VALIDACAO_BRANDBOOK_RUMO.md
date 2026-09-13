# Validação — Brand Book Rumo

Referência: [brandbook.rumolog.com](https://brandbook.rumolog.com/index.html?=direct)

## Tokens de marca (`styles.css`)

As cores, a fonte e a forma ficam centralizadas em variáveis `--rumo-*` no topo do CSS. As variáveis que o site já usava (`--navy`, `--text`, `--muted`, `--border`, `--surface`…) agora apontam para esses tokens.

| Token | HEX | Uso no dashboard |
|---|---|---|
| Azul | `#003865` | Cor dominante: barra do topo, títulos, valores, botão primário |
| Azul Claro | `#32A6E6` | Foco de campos, acento de KPI, módulo do grafismo |
| Verde | `#1E9F7F` | Status concluído, marcadores de seção, barra de progresso |
| Verde Claro | `#7FE06C` | Aba ativa, fim da barra de progresso, botão primário no tema escuro |
| Amarelo | `#FBD300` | Só em toques: status "em andamento", avisos, botão de tema |
| Laranja | `#F78344` | Só no marcador de risco moderado |
| Cinzas de interface | `#F2F5F6` · `#E5EBEE` · `#D7E0E5` · `#CAD6DD` | Fundo, trilhos, bordas |
| Texto neutro | `#4D626F` | Rótulos e textos de apoio |

- O roxo não é usado, porque é a cor principal da Raízen.
- A paleta secundária aparece só em marcadores pequenos.

## Logo

- Arquivos oficiais em `assets/rumo/` (`rumo-logo-branco.png` e `rumo-logo-azul.png`).
- **Topo:** logo branco sobre a barra azul, com 92px de largura (a redução mínima é 70px) e área de segurança livre ao redor.
- **Rodapé:** logo azul no tema claro e branco no tema escuro, com 76px de largura.
- O logo não é distorcido, recolorido nem recebe sombra.

## Tipografia

- A pilha de fontes é `"Cera Pro", Verdana, Geneva, Tahoma, sans-serif`.
- **Licença:** os arquivos da Cera Pro **não** estão no projeto, porque ela é uma fonte paga e não pode ser redistribuída. Quem tiver a Cera Pro instalada vê a fonte oficial. Os demais veem a Verdana, que é o fallback oficial do manual.

## Grafismo e forma

- **Módulos com chanfro:** aparecem no marcador das seções, no indicador da aba ativa, no canto dos KPIs e na faixa do rodapé.
- **Cards:** brancos, com raio sutil de 10px e sombra leve tingida de azul.
- **Tema escuro:** fundos azul profundo, com texto e logo brancos.

## Densidade em desktop

- **Texto:** base de 13px, títulos de seção com 20px e valores de KPI com 24px (antes eram 38px e 32px).
- **Área útil:** até 1840px de largura (antes era 1180px).
- **Grades automáticas:** limpeza a partir de 360px por card e obras a partir de 280px. Em uma tela de 1600px ficam 4 colunas de limpeza e 5 de obras. Em 1920px ficam 6 colunas de obras.
- **Espaçamentos e controles:** campos e botões com 32px de altura e espaçamentos internos menores.

## Acessibilidade

- Texto sobre o azul `#003865` é sempre branco.
- O amarelo nunca é usado como cor de texto, só como fundo ou marcador.
- Rótulos pequenos usam `#4D626F` ou `#002B4D` sobre fundo claro, com contraste AA.
- Todos os controles têm foco visível.
