# 🥫 Validade — Controle de Despensa

PWA para escanear produtos do mercado, ler a data de validade com a câmera e avisar antes de vencer.

## Funcionalidades

- **Código de barras**: escaneia com a câmera e busca nome/marca automaticamente no Open Food Facts
- **Data de validade por foto (OCR)**: captura a validade impressa na embalagem e extrai a data (formatos: `25/12/2026`, `12.08.26`, `15 ABR 2027`, `09/2026`)
- **Inventário**: lista ordenada por validade com badges coloridos (vermelho = vencido/≤3 dias, amarelo = dentro do prazo de aviso), busca e categorias
- **Consumir 1**: baixa a quantidade a cada unidade consumida; remove ao zerar
- **Edição manual** de qualquer campo a qualquer momento
- **Alertas**: banner no topo do app + notificação do navegador 1x/dia (antecedência configurável no sino 🔔: 3 a 30 dias)
- **Offline**: funciona sem internet depois do primeiro acesso (exceto busca de produto e OCR na primeira vez)

## Como publicar (necessário para usar no celular)

A câmera e a instalação como app exigem **HTTPS**. Opções gratuitas:

### Netlify Drop (mais fácil, sem conta git)
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `validade-app` inteira para a página
3. Pronto — você recebe um link `https://...netlify.app`

### GitHub Pages
1. Crie um repositório e envie os arquivos desta pasta
2. Settings → Pages → Deploy from branch → `main` / raiz
3. Acesse `https://SEU_USUARIO.github.io/NOME_DO_REPO/`

## Como instalar no celular

- **Android (Chrome)**: abra o link → menu ⋮ → "Adicionar à tela inicial" / "Instalar app"
- **iPhone (Safari)**: abra o link → botão Compartilhar → "Adicionar à Tela de Início"

## Observações técnicas

- Leitura de código de barras: API nativa `BarcodeDetector` (Chrome/Android); em navegadores sem suporte (Safari/iOS), carrega a biblioteca ZXing automaticamente
- OCR: Tesseract.js (carregado sob demanda na primeira captura — a primeira leitura demora mais)
- Dados salvos localmente no aparelho (`localStorage`) — não vão para nenhum servidor
- Notificações disparam ao abrir o app ou quando ele volta ao primeiro plano (limitação de PWAs: sem servidor de push, não há notificação com o app totalmente fechado no iOS; no Android o atalho instalado ajuda)
