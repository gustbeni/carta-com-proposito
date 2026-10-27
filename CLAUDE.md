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
| `netlify/functions/pagar.mjs` | Cria a carta (ainda não paga) e gera o Pix (API de Orders, vale 2 horas: `PT2H`, e o site espera e confere pelo mesmo tempo, `PIX_MS`) ou o link do cartão (Checkout Pro) |
| `netlify/functions/status.mjs` | O site pergunta a cada poucos segundos se o pagamento caiu |
| `netlify/functions/aviso.mjs` | Webhook do Mercado Pago (`/api/aviso`) |
| `netlify/functions/carta.mjs` | Entrega a carta paga. Se a música for do Spotify, troca pela versão do YouTube e guarda em `reg.musicaYT`. |
| `netlify/functions/atualizar.mjs` | Edição da carta até 7 dias depois do pagamento, usando a chave guardada no aparelho de quem comprou |
| `netlify/functions/musica.mjs` | `/api/musica?s=track/ID`: recebe um Spotify e devolve o YouTube equivalente |
| `netlify/functions/buscar.mjs` | `/api/buscar?q=`: busca a música pelo nome no YouTube (`sugestoesYouTube`) e devolve sugestões. Guarda cada busca por 14 dias no Blobs (store `buscas`). Quando o limite diário do YouTube acaba, responde `{ limite: true }` até o dia seguinte, e o site esconde a busca e fica só com o link. |
| `netlify/functions/config.mjs` | `/api/config`: diz ao site se o envio por e-mail está ligado (só é chamado no pagamento e na carta paga) |
| `netlify/functions/acesso.mjs` | `/api/acesso`: página **/meuacesso**. Recebe o e-mail da compra e devolve as cartas pagas (com a chave, para editar). Sem código de confirmação, por decisão do dono; tem limite de 40 consultas por hora por IP. Na primeira chamada liga ao e-mail as cartas vendidas antes (store `acessos`, chave `e/<hash do e-mail>`; o e-mail não fica escrito). O `pagar.mjs` já guarda cada compra nova ali. |
| `netlify/functions/email.mjs` | `/api/email`: botão "Receber a carta no meu e-mail" da carta paga (pede a chave, no máximo 5 envios) |
| `ads/` | Imagens baixadas pela Action `baixar.yml` (lista em `ads/urls.txt`) |

As cartas ficam no **Netlify Blobs**, store `cartas`, chave `c/<id>`. O registro guarda `{ carta, chave, email, querEmail, plano, pago, pagoEm, mpOrder, mpId, valor, nav, metaOk, musicaYT, emailOk, emailEnvios, emailErros }`.

**E-mail da carta:** na hora de pagar aparece "Quero receber a carta (link e QR code) neste e-mail" (marcado). Quando o pagamento é confirmado (`confirmarPagamento`, chamado pelo `status`, pelo `aviso` e pela `carta`), `mandarEmail` manda uma vez só e desiste depois de 3 erros. Na carta paga aparece "Enviamos..." ou o botão para receber. Só funciona com `EMAIL_USUARIO` e `EMAIL_SENHA_APP` no Netlify; sem elas, a opção nem aparece.

**Meu acesso (/meuacesso):** depois do pagamento a pessoa cai nessa página (no lugar da antiga "página de obrigado"). Ela lista as cartas do e-mail com copiar o link, enviar, baixar o QR code, abrir e editar (7 dias). O e-mail fica lembrado no aparelho (`cp2:acesso`). Editar uma carta de outro aparelho traz a carta do servidor para o criador (`rascunhoDoServidor`) e salva pelo `/api/atualizar`, sem mandar as fotos de novo. O e-mail da carta também leva o link do Meu acesso, e o começo do site tem "Já comprou? Entrar no Meu acesso".

**Pacotes:** no criador, depois de "Cor e música", vem a etapa `premium` ("Você não quer ver a sua carta na versão Premium?"), com os benefícios, "Ver a minha carta na versão Premium", o botão de baixo "Quero a Premium" e "Não, quero continuar na versão Padrão". Quem escolhe o Premium ganha a etapa `extras` (mais 3 polaroides e as 7 fotos do mini filme). A última etapa tem "Ver carta final", que abre a carta e leva à tela pronta (com o pacote escolhido e "Trocar"), e daí ao pagamento. As etapas que não valem para a carta somem (`so`, `passosValidos`); numa carta já paga a oferta não aparece. Em "Editar alguma coisa", o botão vira "Pronto" e volta direto para a carta pronta (`ui.editando`).

**Detalhes dos pacotes:**
- **Padrão, R$ 21,99:** 4 fotos (3 polaroides e 1 na câmera). Fica no ar por **3 meses** depois do pagamento (`DIAS_PADRAO`). Depois disso, `/api/carta` devolve `{ expirada: true }`. Só vale para pedidos com `reg.plano` (feitos depois dos pacotes). As cartas vendidas antes continuam para sempre.
- **Premium, R$ 29,99:** vitalícia, com abertura de cinema (`cineOpen`; o nome do casal fica sempre numa linha só e diminui se não couber), 6 polaroides em slides de cinema em que a foto salta 50% maior da polaroide (`slidesHTML`), câmera com raios de ouro e o **mini filme do casal** (`playFilm`): até 7 fotos com transições, frases, música e tela final. Se não houver fotos do filme, ele usa as fotos da carta.
- Quem diz se é Premium é o pedido (`reg.plano`), nunca a carta: `limparCarta(c, plano)` corta o que for do Premium num pedido Padrão, e `carta.mjs` acrescenta `pl: "p"` na entrega.
- Fotos no rascunho: 0-2 polaroides, 3 foto final, 4-6 polaroides do Premium, 7-13 mini filme (`NFOTOS`). Na carta: `fu` (até 6), `fc`, `ffu`, `ffc` e `mf` (até 7).
- No começo do site há "Ver prévia carta Premium" e "Ver prévia carta Padrão". As prévias usam as fotos de casal de `public/img/exemplo/`.

Enquanto a pessoa monta, as fotos ficam no aparelho (IndexedDB `cp2`, com o localStorage de reserva), em até 1440 px (as maiores guardadas antes são reduzidas ao abrir o site, para o iPhone não recarregar a página). Cada toque numa foto cria um seletor novo (`abrirGaleria`). A grade do mini filme usa as classes `photos film`; `.film` também é a tela do mini filme, por isso há regras `.photos.film` que desfazem o posicionamento dela.

A `carta` nova tem `x: 2` e os campos `r, oc, p, d, v, m, mot, ora, dt, th, mu/ml, fu/fc, ffu/ffc` (veja `cartaParaServidor` no `carta_tpl.html`). Cartas sem `x` são do formato antigo e continuam abrindo: `cartaDoServidor` converte usando o `dados.json`. As fotos ficam no Cloudinary (`kmd9kglx`, preset `carta_com_proposito`) e a carta guarda só o caminho.

## Regras importantes

- **Cada deploy no Netlify gasta créditos (cerca de 15).** Junte várias mudanças num commit só. Para subir sem publicar, use `[skip netlify]` na mensagem do commit.
- **Pedido do dono (24/10): sempre juntar as alterações e publicar de uma vez só.** Cada mudança vai num commit com `[skip netlify]`. Só publique (commit sem `[skip netlify]`) quando o dono pedir ("publica"), ou quando for algo urgente que quebra vendas, e aí avise antes. Ao terminar cada alteração, **lembre o dono** do que está guardado sem publicar e pergunte se quer juntar mais coisas antes de publicar. Em 24/10 restavam cerca de 430 dos 1.000 créditos do plano, que vencem em 10/11. Se acabarem, o site continua no ar, mas as publicações travam.
- **Preço:** fica em `PRECO` e `PRECO_PREMIUM` no `comum.mjs`, que são os valores cobrados de verdade, e em `PRICE` e `PRICE_PREMIUM` no `carta_tpl.html`, que são só o texto mostrado (`PRICE_OLD` é o preço riscado da Padrão). Mude sempre os dois lados. Os pedidos guardam `reg.valor`, então os criados antes de uma mudança de preço continuam sendo confirmados pelo valor antigo.
- **Variáveis no Netlify** (nunca coloque os valores no código nem peça para colarem no chat):
  - `MP_ACCESS_TOKEN`: Mercado Pago, produção
  - `META_CAPI_TOKEN`: API de Conversões do Meta, marcada como secreta
  - `EMAIL_USUARIO` e `EMAIL_SENHA_APP`: conta do Gmail que manda a carta por e-mail e a "senha de app" dela (16 letras, criada em myaccount.google.com/apppasswords com a verificação em duas etapas ligada)
  - `NTFY_TOPICO`: nome do canal do app ntfy que dá um toque no celular do dono a cada venda (`avisarDono` no `comum.mjs`, chamado no `confirmarPagamento`; manda só o pacote, o valor e o link da carta, sem dados de quem comprou). Sem ela, não avisa.
  - opcionais: `PRECO`, `PRECO_PREMIUM`, `YOUTUBE_KEY`, `META_PIXEL_ID`, `META_TEST_CODE`
- **Meta:** Pixel `1595171231774957`. O navegador envia `Purchase` com `eventID: "compra_<id>"`, e o servidor envia o mesmo `event_id`, então o Meta não conta a venda em dobro. O domínio está na lista de permissões do Pixel.
- **Mercado Pago:** o webhook de produção aponta para `/api/aviso`, com os eventos Order e Pagamentos.
- **Não invente** depoimentos, avaliações ou números de clientes. Vídeos com cenas encenadas levam o aviso "cena ilustrativa". Não use o logo do WhatsApp.
- **Não exponha dados pessoais de compradores**, como e-mail e nome, em commits, logs ou textos.

## Como a carta funciona (quem recebe)

`/c/<id>` abre só a carta (o criador fica escondido). Ela começa num **envelope de ouro** com um **selo real** pequeno (cera vinho, contas, louros e uma cruzinha de ouro) e fitas de cetim. Sem versículo na capa. O **toque no selo** faz a abertura com raios de luz, clarão e faíscas douradas, e começa a música: a instrumental (Amazing Grace gerada no navegador, objeto `Music`) ou a música de vocês do YouTube ou Spotify (objeto `Som`; o servidor troca Spotify por YouTube).

A carta aparece **passo a passo**, uma parte de cada vez (`letterHTML` marca cada parte com `data-step`; `bindLetter` controla). A ordem e a ação de cada parte:
1. **Abertura** ("Para Ana"): "Continuar". Só "Para" e o nome, sem a data de hoje em cima e sem o título da ocasião embaixo (o envelope, a abertura de cinema e a imagem do QR code também não mostram o título).
2. **Roleta da Palavra**: fina, com Jesus ao lado empurrando. Sorteia um versículo das ocasiões do mesmo tipo de carta que não esteja na carta, e ele aparece letra por letra. Depois, "Continuar".
3. **Nossa música** (só com música do YouTube ou Spotify): a música **começa no toque do selo** (`iniciarMusica` no `openViewer`, com o player escondido em `.mdock`); esta parte só mostra que ela está tocando. Se o celular bloquear o som, aparece o botão flutuante "Toque para ouvir com som". A instrumental também começa no selo.
4. **Fotos**: polaroides grandes, penduradas e balançando (no Premium, slides de cinema). "Continuar".
5. **Pote dos motivos**: papeizinhos enrolados com fitas. Cada toque tira um bilhete que voa e "cola" na tela; é preciso ler **todos** ("Guardar no coração"). Se o pote ficou vazio, a carta usa 5 bilhetes automáticos.
6. **Versículos escolhidos**: sem aspas, em ouro espelhado (`.mirror`, uma palavra por `.mw`). "Continuar".
7. **Mensagem**: pergaminho real. Chega enrolado com fita de cetim e selo de cera, o selo se rompe e ele desenrola, com coroa no topo e moldura de ouro. A pena escreve o texto na hora (tocar no papel termina) e um selo carimba o fim. No "Continuar" ele **fica aberto** (não se enrola mais).
8. **Números**: "Juntos desde" + data bem grandes, os dias dentro de um coração num relógio, horas e noites. "Continuar".
9. **Última foto**: câmera antiga (um pouco menor). O toque dá o flash e a foto, 30% maior que antes, sai pela fenda e se revela mais rápido. A carta segue sozinha.
10. **Mini filme** (Premium).
11. **Pedido** (namoro e noivado): "Sim".
12. **Oração**: é a última etapa; tocar em "Amém".
13. **Despedida**: assinatura grande em ouro e chuva de corações.

Na prévia de quem está montando, a roleta, o pote e outras partes têm "Pular esta parte" (menos o pergaminho e a última foto, onde o botão ficava em cima de onde se toca). Nas prévias de exemplo do começo (`hooks.rapido`) não há "Pular": o pergaminho já vem aberto e escreve rápido, a roleta e a câmera disparam sozinhas, e rolar a tela para baixo passa para a próxima parte (aviso "Role a tela para ver a próxima parte"). Quem recebe não tem nada disso.

Visual: fundo de veludo (temas `rosa` = Vinho, `dourado` = Púrpura, `ceu` = Noite), tudo com ouro. Nomes e assinatura na fonte Great Vibes (classe `gold-t`); versículos em Playfair Display itálico com ouro espelhado; mensagem em Parisienne; bilhetes em Cormorant Garamond. Nada de logo do WhatsApp: o botão de enviar usa um ícone neutro.

## Para ver como ficou

Abra o `public/index.html` gerado no navegador e use "Ver prévia carta Premium", "Ver prévia carta Padrão" ou o ícone de olho. As funções do servidor só funcionam no Netlify, ou com `netlify dev`, que precisa da Netlify CLI e das variáveis.

## Situação em 22/10/2026

- A campanha de vendas no Meta Ads está ativa (R$ 40 por dia). Foram 9 vendas na primeira semana, com custo por venda entre R$ 25 e R$ 30.
- Hoje mudou: preço de 17,99 para 21,99, envio da compra pelo servidor (API de Conversões), aviso de campo faltando visível na hora de pagar, Spotify trocado por YouTube, e o pote exigindo a leitura de todos os bilhetes.
- 23/10: nova estética (criador passo a passo) aplicada por cima do site, com pagamento, Pixel, pote e música ligados. No mesmo dia: fundo roxo avermelhado, carta de ouro com abertura gloriosa, versículos em Great Vibes dourada, pote novo, roleta da Palavra e carta passo a passo. Ainda na branch `nova-estetica`, sem publicar.
- 23/10, à noite: começo sem falar de pagamento ("Ver uma prévia"), selo real com cruz, versículos em ouro espelhado, polaroides maiores, roleta com Jesus, números com coração e relógio, pergaminho com pena, bilhete colando na tela, câmera antiga, oração no fim e carta por e-mail. Também na `nova-estetica`, sem publicar. Para o e-mail funcionar, faltam as variáveis `EMAIL_USUARIO` e `EMAIL_SENHA_APP` no Netlify.
- 23/10, madrugada: pacotes Padrão (R$ 21,99, 3 meses) e Premium (R$ 29,99, vitalícia, abertura de cinema, slides das fotos, mini filme do casal), duas prévias no começo, e correção do pergaminho. Também na `nova-estetica`, sem publicar.
- 23/10: **tudo publicado** (merge da `nova-estetica` na `main`), com o pergaminho real e a busca de música pelo nome. Falta fazer uma compra de teste com Pix e abrir a carta num iPhone.
- 23/10, depois: prévias de exemplo mais rápidas (pergaminho já aberto, pena rápida, sem enrolar no Continuar; `hooks.rapido`) e botão "Pular esta parte" em destaque em mais partes. Publicado.
- 23/10, noite: oferta do Premium como etapa do criador, nova ordem da carta (música depois da roleta), pergaminho que fica aberto, câmera menor com foto maior e edição que volta direto para a carta pronta. Publicado.
- 23/10, tarde: página /meuacesso no lugar da página de obrigado, e prévias de exemplo que passam sozinhas ao rolar a tela. Publicado.
- 24/10: compra de teste com Pix feita no site novo, e deu tudo certo (pagamento, carta e Meu acesso). Os 3 vídeos de anúncio foram aprovados. No conjunto antigo da campanha (que já tinha aprendido com as vendas), o anúncio antigo foi editado com um dos vídeos novos e duplicado mais 2 vezes com os outros vídeos. Os 3 começam à meia-noite, com R$ 40 por dia para o conjunto todo.
- Planejado para sexta, 23/10: analisar a semana, subir um segundo vídeo no mesmo conjunto de anúncios e passar o orçamento para R$ 50.
- 23/10, noite: carta só com "Para" e o nome (sem data e sem título da ocasião), nome do casal e data numa linha só na abertura de cinema (que espera a letra cursiva carregar), e contagem dos números que começa quando a parte aparece. Publicado.
- 24/10: aviso de venda no celular do dono pelo app ntfy (`NTFY_TOPICO` criada no Netlify). Publicado.
- 24/10 (sábado), primeiro dia completo com o site novo e os 3 vídeos: 5 vendas (2 pelo orgânico, perfil e link da bio), com cerca de R$ 40 de anúncio. Vendas confirmadas no Meta e aviso no celular funcionando.
- 25/10, noite: anúncios em 24 e 25/10: TRISTE 4 compras (R$ 5,92 cada), PREMIUM 1 compra (R$ 49,47), PADRÃO nenhuma. O conjunto do PADRÃO foi desligado e duplicado como "CONJUNTO VIDEO CARTA COMPLETA", com um vídeo novo (gancho, legendas por parte, final dourado) e botão "Ver detalhes". Orçamento da campanha passou de R$ 40 para R$ 50 por dia. Próxima análise: quarta, 28/10 (pausar o PREMIUM se passar de uns R$ 30 por venda; subir para R$ 55 a R$ 60 se continuar vendendo).
- 26/10: Pix passou a valer 2 horas (antes 30 minutos), e o site espera e confere o pagamento pelo mesmo tempo. Publicado.
- 27/10: o VIDEO CARTA COMPLETA vendeu 2 de madrugada e de manhã e ficou. O PREMIUM (cerca de R$ 59 por venda em 7 dias) foi desligado e trocado pelo "CONJUNTO VIDEO NOVO 2" (vídeo 777.mov, capa com a moça e "Ela só queria saber que você ainda se importa"). Ligados: TRISTE, VIDEO CARTA COMPLETA e VIDEO NOVO 2, com R$ 50 por dia.
