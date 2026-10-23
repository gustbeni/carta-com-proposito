# Carta com Propósito

Site que vende uma **carta cristã digital personalizada** por **R$ 21,99**, paga com Pix ou cartão (Mercado Pago). Quem compra monta a carta no próprio site. Quem recebe abre pelo link `/c/<id>` ou pelo QR code.

- Site no ar: https://carta-com-proposito.netlify.app
- Repositório: github.com/gustbeni/carta-com-proposito. O deploy é automático no Netlify a cada push na `main`.
- O dono fala português do Brasil e não é programador. Explique as coisas em linguagem simples e sempre em português.

## Estrutura

| Caminho | O que é |
|---|---|
| `fonte/carta_tpl.html` | **Fonte principal da página** (HTML + JS do criador e da carta). Edite aqui. |
| `fonte/estilo-base.css` | CSS base, que entra no lugar de `{{CSS}}` |
| `fonte/dados.json` | Versículos, orações e textos, que entram no lugar de `{{DADOS}}` |
| `fonte/montar.py` | Gera `public/index.html`. Rode `python3 fonte/montar.py` depois de editar a fonte. |
| `public/index.html` | Página publicada. É gerada pelo script, **não edite à mão**. |
| `public/privacidade.html`, `public/img/` | Política de privacidade e imagens do site |
| `netlify/lib/comum.mjs` | Preço (`PRECO`), Mercado Pago, confirmação de pagamento, API de Conversões do Meta e troca de Spotify por YouTube |
| `netlify/functions/pagar.mjs` | Cria a carta (ainda não paga) e gera o Pix (API de Orders) ou o link do cartão (Checkout Pro) |
| `netlify/functions/status.mjs` | O site pergunta a cada poucos segundos se o pagamento caiu |
| `netlify/functions/aviso.mjs` | Webhook do Mercado Pago (`/api/aviso`) |
| `netlify/functions/carta.mjs` | Entrega a carta paga. Se a música for do Spotify, troca pela versão do YouTube e guarda em `reg.musicaYT`. |
| `netlify/functions/atualizar.mjs` | Edição da carta até 7 dias depois do pagamento, usando a chave guardada no aparelho de quem comprou |
| `netlify/functions/musica.mjs` | `/api/musica?s=track/ID`: recebe um Spotify e devolve o YouTube equivalente |
| `ads/` | Imagens baixadas pela Action `baixar.yml` (lista em `ads/urls.txt`) |

As cartas ficam no **Netlify Blobs**, store `cartas`, chave `c/<id>`. O registro guarda `{ carta, chave, email, pago, pagoEm, mpOrder, mpId, valor, nav, metaOk, musicaYT }`.

## Regras importantes

- **Cada deploy no Netlify gasta créditos (cerca de 15).** Junte várias mudanças num commit só. Para subir sem publicar, use `[skip netlify]` na mensagem do commit.
- **Preço:** fica em `PRECO` no `comum.mjs`, que é o valor cobrado de verdade, e em `CONFIG.preco` no `carta_tpl.html`, que é só o texto mostrado. Mude sempre os dois. Os pedidos guardam `reg.valor`, então os criados antes de uma mudança de preço continuam sendo confirmados pelo valor antigo.
- **Variáveis no Netlify** (nunca coloque os valores no código nem peça para colarem no chat):
  - `MP_ACCESS_TOKEN`: Mercado Pago, produção
  - `META_CAPI_TOKEN`: API de Conversões do Meta, marcada como secreta
  - opcionais: `PRECO`, `YOUTUBE_KEY`, `META_PIXEL_ID`, `META_TEST_CODE`
- **Meta:** Pixel `1595171231774957`. O navegador envia `Purchase` com `eventID: "compra_<id>"`, e o servidor envia o mesmo `event_id`, então o Meta não conta a venda em dobro. O domínio está na lista de permissões do Pixel.
- **Mercado Pago:** o webhook de produção aponta para `/api/aviso`, com os eventos Order e Pagamentos.
- **Não invente** depoimentos, avaliações ou números de clientes. Vídeos com cenas encenadas levam o aviso "cena ilustrativa". Não use o logo do WhatsApp.
- **Não exponha dados pessoais de compradores**, como e-mail e nome, em commits, logs ou textos.

## Como a carta funciona (quem recebe)

A função `mostrarCarta` revela uma parte por vez. Algumas partes **esperam uma ação** da pessoa (`p._feito = proximo`):
1. **Roleta:** girar
2. **Pote dos motivos:** ler **todos** os bilhetes. Se o pote ficou vazio, a carta usa 5 bilhetes automáticos. Na prévia aparece "Pular".
3. **Pergaminho:** a escrita termina sozinha
4. **Cabine de fotos:** tocar para revelar

As outras partes avançam sozinhas, depois de `tempoLer(p)`. A música começa no toque do selo do envelope. A carta usa tema escuro com dourado, envelope com selo de cera, rosas e polaroides.

## Para ver como ficou

Abra o `public/index.html` gerado no navegador e use "Ver exemplo" ou "Ver a prévia". As funções do servidor só funcionam no Netlify, ou com `netlify dev`, que precisa da Netlify CLI e das variáveis.

## Situação em 22/10/2026

- A campanha de vendas no Meta Ads está ativa (R$ 40 por dia). Foram 9 vendas na primeira semana, com custo por venda entre R$ 25 e R$ 30.
- Hoje mudou: preço de 17,99 para 21,99, envio da compra pelo servidor (API de Conversões), aviso de campo faltando visível na hora de pagar, Spotify trocado por YouTube, e o pote exigindo a leitura de todos os bilhetes.
- Planejado para sexta, 23/10: analisar a semana, subir um segundo vídeo no mesmo conjunto de anúncios e passar o orçamento para R$ 50.
