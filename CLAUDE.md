# Carta com Propósito

Site que vende uma **carta cristã digital personalizada** em dois pacotes, **Padrão (R$ 21,99)** e **Premium (R$ 29,99)**, pagos com Pix ou cartão (Mercado Pago). Quem compra monta a carta no próprio site. Quem recebe abre pelo link `/c/<id>` ou pelo QR code.

- Site no ar: https://carta-com-proposito.netlify.app
- Repositório: github.com/gustbeni/carta-com-proposito. O deploy é automático no Netlify a cada push na `main`.
- O dono fala português do Brasil e não é programador. Explique as coisas em linguagem simples e sempre em português.

## Estrutura

| Caminho | O que é |
|---|---|
| `fonte/carta_tpl.html` | **Fonte principal da página** (HTML + JS do criador passo a passo e da carta). Os textos das cartas novas (`VERSES`, `OCCASIONS`, `MESSAGES`, `PRAYERS`, `REASONS`) ficam aqui. Edite aqui. |
| `fonte/estilo-base.css` | CSS base, que entra no lugar de `{{CSS}}` |
| `fonte/dados.json` | Textos das cartas vendidas antes da estética nova (versículos, títulos e orações antigos). Entram no lugar de `{{DADOS}}`. |
| `fonte/montar.py` | Gera `public/index.html`. Rode `python3 fonte/montar.py` depois de editar a fonte. |
| `public/index.html` | Página publicada. É gerada pelo script, **não edite à mão**. |
| `public/privacidade.html`, `public/img/` | Política de privacidade e imagens do site |
| `netlify/lib/comum.mjs` | Preços (`PRECO` e `PRECO_PREMIUM`), pacotes (`planoDe`, `valorDo`, `expirou`), Mercado Pago, confirmação de pagamento, API de Conversões do Meta, envio do e-mail (`mandarEmail`) e troca de Spotify por YouTube |
| `netlify/lib/correio.mjs` | Monta e manda o e-mail com o link e o QR code da carta (Gmail, com nodemailer e qrcode) |
| `netlify/functions/pagar.mjs` | Cria a carta (ainda não paga) e gera o Pix (API de Orders) ou o link do cartão (Checkout Pro) |
| `netlify/functions/status.mjs` | O site pergunta a cada poucos segundos se o pagamento caiu |
| `netlify/functions/aviso.mjs` | Webhook do Mercado Pago (`/api/aviso`) |
| `netlify/functions/carta.mjs` | Entrega a carta paga. Se a música for do Spotify, troca pela versão do YouTube e guarda em `reg.musicaYT`. |
| `netlify/functions/atualizar.mjs` | Edição da carta até 7 dias depois do pagamento, usando a chave guardada no aparelho de quem comprou |
| `netlify/functions/musica.mjs` | `/api/musica?s=track/ID`: recebe um Spotify e devolve o YouTube equivalente |
| `netlify/functions/config.mjs` | `/api/config`: diz ao site se o envio por e-mail está ligado (só é chamado no pagamento e na carta paga) |
| `netlify/functions/email.mjs` | `/api/email`: botão "Receber a carta no meu e-mail" da carta paga (pede a chave, no máximo 5 envios) |
| `ads/` | Imagens baixadas pela Action `baixar.yml` (lista em `ads/urls.txt`) |

As cartas ficam no **Netlify Blobs**, store `cartas`, chave `c/<id>`. O registro guarda `{ carta, chave, email, querEmail, plano, pago, pagoEm, mpOrder, mpId, valor, nav, metaOk, musicaYT, emailOk, emailEnvios, emailErros }`.

**E-mail da carta:** na hora de pagar aparece "Quero receber a carta (link e QR code) neste e-mail" (marcado). Quando o pagamento é confirmado (`confirmarPagamento`, chamado pelo `status`, pelo `aviso` e pela `carta`), `mandarEmail` manda uma vez só e desiste depois de 3 erros. Na carta paga aparece "Enviamos..." ou o botão para receber. Só funciona com `EMAIL_USUARIO` e `EMAIL_SENHA_APP` no Netlify; sem elas, a opção nem aparece.

**Pacotes (escolhidos só no fim, na prévia pronta):**
- **Padrão, R$ 21,99:** 4 fotos (3 polaroides e 1 na câmera). Fica no ar por **3 meses** depois do pagamento (`DIAS_PADRAO`). Depois disso, `/api/carta` devolve `{ expirada: true }`. Só vale para pedidos com `reg.plano` (feitos depois dos pacotes). As cartas vendidas antes continuam para sempre.
- **Premium, R$ 29,99:** vitalícia, com abertura de cinema (`cineOpen`), 6 polaroides em slides de cinema em que a foto salta 50% maior da polaroide (`slidesHTML`), câmera com raios de ouro e o **mini filme do casal** (`playFilm`): até 7 fotos com transições, frases, música e tela final. Se não houver fotos do filme, ele usa as fotos da carta.
- Quem diz se é Premium é o pedido (`reg.plano`), nunca a carta: `limparCarta(c, plano)` corta o que for do Premium num pedido Padrão, e `carta.mjs` acrescenta `pl: "p"` na entrega.
- Fotos no rascunho: 0-2 polaroides, 3 foto final, 4-6 polaroides do Premium, 7-13 mini filme (`NFOTOS`). Na carta: `fu` (até 6), `fc`, `ffu`, `ffc` e `mf` (até 7).
- No começo do site há "Ver prévia carta Premium" e "Ver prévia carta Padrão". As prévias usam as fotos de casal de `public/img/exemplo/`.

Enquanto a pessoa monta, as fotos ficam no aparelho (IndexedDB `cp2`, com o localStorage de reserva), em até 2048 px e boa qualidade.

A `carta` nova tem `x: 2` e os campos `r, oc, p, d, v, m, mot, ora, dt, th, mu/ml, fu/fc, ffu/ffc` (veja `cartaParaServidor` no `carta_tpl.html`). Cartas sem `x` são do formato antigo e continuam abrindo: `cartaDoServidor` converte usando o `dados.json`. As fotos ficam no Cloudinary (`kmd9kglx`, preset `carta_com_proposito`) e a carta guarda só o caminho.

## Regras importantes

- **Cada deploy no Netlify gasta créditos (cerca de 15).** Junte várias mudanças num commit só. Para subir sem publicar, use `[skip netlify]` na mensagem do commit.
- **Preço:** fica em `PRECO` e `PRECO_PREMIUM` no `comum.mjs`, que são os valores cobrados de verdade, e em `PRICE` e `PRICE_PREMIUM` no `carta_tpl.html`, que são só o texto mostrado (`PRICE_OLD` é o preço riscado da Padrão). Mude sempre os dois lados. Os pedidos guardam `reg.valor`, então os criados antes de uma mudança de preço continuam sendo confirmados pelo valor antigo.
- **Variáveis no Netlify** (nunca coloque os valores no código nem peça para colarem no chat):
  - `MP_ACCESS_TOKEN`: Mercado Pago, produção
  - `META_CAPI_TOKEN`: API de Conversões do Meta, marcada como secreta
  - `EMAIL_USUARIO` e `EMAIL_SENHA_APP`: conta do Gmail que manda a carta por e-mail e a "senha de app" dela (16 letras, criada em myaccount.google.com/apppasswords com a verificação em duas etapas ligada)
  - opcionais: `PRECO`, `PRECO_PREMIUM`, `YOUTUBE_KEY`, `META_PIXEL_ID`, `META_TEST_CODE`
- **Meta:** Pixel `1595171231774957`. O navegador envia `Purchase` com `eventID: "compra_<id>"`, e o servidor envia o mesmo `event_id`, então o Meta não conta a venda em dobro. O domínio está na lista de permissões do Pixel.
- **Mercado Pago:** o webhook de produção aponta para `/api/aviso`, com os eventos Order e Pagamentos.
- **Não invente** depoimentos, avaliações ou números de clientes. Vídeos com cenas encenadas levam o aviso "cena ilustrativa". Não use o logo do WhatsApp.
- **Não exponha dados pessoais de compradores**, como e-mail e nome, em commits, logs ou textos.

## Como a carta funciona (quem recebe)

`/c/<id>` abre só a carta (o criador fica escondido). Ela começa num **envelope de ouro** com um **selo real** pequeno (cera vinho, contas, louros e uma cruzinha de ouro) e fitas de cetim. Sem versículo na capa. O **toque no selo** faz a abertura com raios de luz, clarão e faíscas douradas, e começa a música: a instrumental (Amazing Grace gerada no navegador, objeto `Music`) ou a música de vocês do YouTube ou Spotify (objeto `Som`; o servidor troca Spotify por YouTube).

A carta aparece **passo a passo**, uma parte de cada vez (`letterHTML` marca cada parte com `data-step`; `bindLetter` controla). A ordem e a ação de cada parte:
1. **Abertura** ("Para Ana", com o player da música): "Continuar".
2. **Fotos**: as três primeiras viram polaroides grandes, penduradas e balançando. "Continuar".
3. **Roleta da Palavra**: fina, com Jesus ao lado empurrando. Sorteia um versículo das ocasiões do mesmo tipo de carta que não esteja na carta, e ele aparece letra por letra. Depois, "Continuar".
4. **Números**: "Juntos desde" + data bem grandes, os dias dentro de um coração num relógio ("dias em que o meu amor se renovou"), horas e noites. "Continuar".
5. **Mensagem**: num pergaminho que se desenrola; uma pena escreve o texto na hora (tocar no papel termina). "Continuar".
6. **Pote dos motivos**: papeizinhos enrolados com fitas. Cada toque tira um bilhete que voa e "cola" na tela; é preciso ler **todos** ("Guardar no coração"). Se o pote ficou vazio, a carta usa 5 bilhetes automáticos.
7. **Última foto**: câmera antiga. O toque dá o flash, a foto sai pela fenda e vai se revelando. A carta segue sozinha.
8. **Versículos escolhidos**: sem aspas, em ouro espelhado (`.mirror`, uma palavra por `.mw`). "Continuar".
9. **Pedido** (namoro e noivado): "Sim".
10. **Oração**: é a última etapa; tocar em "Amém".
11. **Despedida**: assinatura grande em ouro e chuva de corações.

Na prévia e no exemplo, a roleta e o pote têm "Pular". Quem recebe não tem.

Visual: fundo de veludo (temas `rosa` = Vinho, `dourado` = Púrpura, `ceu` = Noite), tudo com ouro. Nomes e assinatura na fonte Great Vibes (classe `gold-t`); versículos em Playfair Display itálico com ouro espelhado; mensagem em Parisienne; bilhetes em Cormorant Garamond. Nada de logo do WhatsApp: o botão de enviar usa um ícone neutro.

## Para ver como ficou

Abra o `public/index.html` gerado no navegador e use "Ver uma prévia" ou o ícone de olho. As funções do servidor só funcionam no Netlify, ou com `netlify dev`, que precisa da Netlify CLI e das variáveis.

## Situação em 22/10/2026

- A campanha de vendas no Meta Ads está ativa (R$ 40 por dia). Foram 9 vendas na primeira semana, com custo por venda entre R$ 25 e R$ 30.
- Hoje mudou: preço de 17,99 para 21,99, envio da compra pelo servidor (API de Conversões), aviso de campo faltando visível na hora de pagar, Spotify trocado por YouTube, e o pote exigindo a leitura de todos os bilhetes.
- 23/10: nova estética (criador passo a passo) aplicada por cima do site, com pagamento, Pixel, pote e música ligados. No mesmo dia: fundo roxo avermelhado, carta de ouro com abertura gloriosa, versículos em Great Vibes dourada, pote novo, roleta da Palavra e carta passo a passo. Ainda na branch `nova-estetica`, sem publicar.
- 23/10, à noite: começo sem falar de pagamento ("Ver uma prévia"), selo real com cruz, versículos em ouro espelhado, polaroides maiores, roleta com Jesus, números com coração e relógio, pergaminho com pena, bilhete colando na tela, câmera antiga, oração no fim e carta por e-mail. Também na `nova-estetica`, sem publicar. Para o e-mail funcionar, faltam as variáveis `EMAIL_USUARIO` e `EMAIL_SENHA_APP` no Netlify.
- 23/10, madrugada: pacotes Padrão (R$ 21,99, 3 meses) e Premium (R$ 29,99, vitalícia, abertura de cinema, slides das fotos, mini filme do casal), duas prévias no começo, e correção do pergaminho. Também na `nova-estetica`, sem publicar.
- Planejado para sexta, 23/10: analisar a semana, subir um segundo vídeo no mesmo conjunto de anúncios e passar o orçamento para R$ 50.
