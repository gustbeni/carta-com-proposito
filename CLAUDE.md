# Carta com Propósito

Site que vende uma **carta cristã digital personalizada**: **Padrão R$ 21,99** e **Premium R$ 29,99**, com Pix ou cartão (Mercado Pago). Quem compra monta a carta no site; quem recebe abre por `/c/<id>` ou QR code.

- Site: https://cartacomproposito.com.br (antigo: carta-com-proposito.netlify.app) · Repo: github.com/gustbeni/carta-com-proposito (deploy automático no Netlify a cada push na `main`; siteId `ad41fbad-e2d7-48fe-8d45-b13d3d141d31`).
- O dono (Gustavo Benites) fala português do Brasil e não é programador: responda sempre em português simples.
- **Histórico do dia a dia** (vendas, anúncios, cada mudança com data): `historico.md`. Leia só quando precisar. Cada fechamento de dia e cada mudança publicada ganha uma linha curta lá, não aqui.

## Regras importantes

- **Publicar gasta créditos do Netlify (≈ 15 por deploy).** Cada mudança vai num commit com `[skip netlify]`. Só publique (commit sem `[skip netlify]`) quando o dono disser "Publique", ou se algo urgente quebrar vendas (avise antes). Ao terminar uma mudança, lembre o que está guardado sem publicar. "Rascunho" = mandar prints antes de guardar.
- Commit: `git -c user.name=gustbeni -c user.email=gustbeni@users.noreply.github.com commit`, depois `git pull -q --rebase origin main && git push -q origin HEAD:main`.
- **Preço:** cobrado de verdade em `PRECO`, `PRECO_PREMIUM` e `EXTRAS` no `netlify/lib/comum.mjs`; texto mostrado em `PRICE`, `PRICE_PREMIUM` e `EXTRAS` no `carta_tpl.html`. Mude os dois lados. Pedidos guardam `reg.valor` (os antigos seguem pelo valor antigo).
- **Variáveis no Netlify** (nunca no código, nunca pedir no chat): `MP_ACCESS_TOKEN`, `META_CAPI_TOKEN`, `EMAIL_USUARIO`, `EMAIL_SENHA_APP`, `NTFY_TOPICO`; opcionais `PRECO`, `PRECO_PREMIUM`, `YOUTUBE_KEY`, `META_PIXEL_ID`, `META_TEST_CODE`, `PAGAMENTO`, `PAGBANK_TOKEN`, `PAGBANK_SANDBOX`.
- **Não invente** depoimentos, avaliações, números de clientes, preço de referência falso ou promoção falsa (valor riscado só se for a soma real do que a pessoa marcou). Vídeo encenado leva "cena ilustrativa". Sem logo do WhatsApp.
- **Não exponha dados de compradores** (nome, e-mail, telefone) em commits, logs, textos ou ntfy.
- Meta: Pixel `1595171231774957`; navegador e servidor mandam `Purchase` com o mesmo `eventID` `compra_<id>`. Webhook do Mercado Pago: `/api/aviso` (Order e Pagamentos).

## Domínio

Site em **https://cartacomproposito.com.br** desde 22/11 (Registro.br, no CPF do dono; DNS no Registro.br: **A** `75.2.60.5` e **CNAME** `www` → `carta-com-proposito.netlify.app`; renovar em 22/11/2027). O endereço antigo `carta-com-proposito.netlify.app` **redireciona** (301, `netlify.toml`) para o domínio novo, mantendo o caminho e o `?fbclid` (anúncios, links e QR codes antigos funcionam); só `/api/*` continua respondendo no antigo, por causa dos avisos do Mercado Pago dos pedidos antigos. O servidor usa `process.env.URL` (domínio primário). O `Referer` da busca do YouTube continua com o endereço antigo de propósito (a chave pode estar presa a ele).

## Arquivos

| Caminho | O que é |
|---|---|
| `fonte/carta_tpl.html` | **Fonte principal** (HTML + JS do criador e da carta; textos `VERSES`, `OCCASIONS`, `MESSAGES`, `PRAYERS`, `REASONS`). Edite aqui. |
| `fonte/estilo-base.css` | CSS (entra em `{{CSS}}`) |
| `fonte/dados.json` | Textos das cartas antigas (formato sem `x`) |
| `fonte/montar.py` | Gera `public/index.html` (`python3 fonte/montar.py`). Tem o viewport (sem zoom). **Não edite o `public/index.html` à mão.** |
| `netlify/lib/comum.mjs` | Preços, pacotes (`planoDe`, `valorDo`, `expirou`, `diasDe`, `limparCarta`), Mercado Pago, `confirmarPagamento`, Meta CAPI, `mandarEmail`, `avisarDono` (ntfy), `verPendentesZap`, Spotify→YouTube |
| `netlify/lib/correio.mjs` | E-mail com link e QR code (Gmail/nodemailer) |
| `netlify/functions/` | `pagar` (cria carta e Pix de 30 min `PT30M` ou cartão Checkout Pro), `status`, `aviso`, `carta`, `atualizar` (editar até 7 dias), `musica`, `buscar`, `config`, `acesso` (/meuacesso), `email`, `zap`, `ping`, `aviso-pagbank` |
| `netlify/desligado/lembrete.mjs` | Lembrete por e-mail de Pix não pago (desligado para não gastar créditos) |
| `rascunhos/` | Coisas fora do site (ex.: carta de Natal, ainda não usada) |

Cartas no Netlify Blobs, store `cartas`, chave `c/<id>`. Fotos no Cloudinary (`kmd9kglx`, preset `carta_com_proposito`). Carta nova tem `x: 2` (`cartaParaServidor` / `cartaDoServidor`); legendas até 100 letras (NFC).

## Pacotes e adicionais (hoje)

- **Padrão R$ 21,99:** 4 fotos (3 polaroides + foto final na câmera). Fica no ar **1 mês** (`reg.diasPadrao` = 30; pedidos antes de 10/11 têm 3 meses; antes dos pacotes, para sempre).
- **Premium R$ 29,99:** vitalícia, abertura de cinema, 6 fotos no álbum de ouro, **cabine de fotos** e mini filme (até 7 fotos). Quem decide é o pedido (`reg.plano`), nunca a carta.
- **Adicionais da Padrão à venda:** Cabine de fotos 4,99 (`cabine`), Álbum de ouro 4,99 (`album`). **Carta para sempre** 3,99 (`vit`, `separado`) não fica na lista: aparece na janelinha `vitSheet` antes de pagar. Fora de venda mas válidos em cartas antigas: `filme`, `fotos`, `cine`, `grandes` (`oculto`). Quando a Padrão com adicionais passa da Premium aparece "Compensa mais a Premium".
- Slots de foto no rascunho: 0-2 polaroides, 3 foto final, 4-6 extras, 7-13 mini filme, 14 4ª da abertura, 15-18 cabine (`NFOTOS` = 19).

## Caminho da compra

Criador passo a passo (sem "Passo X de Y" no topo) → oferta Premium → adicionais (Padrão) → carta pronta → tela de pagamento (`checkoutView`: miniatura com fotos passando em moldura de ouro, "Vai tudo nela", 3 selos, "Finalizar minha carta") → janela **"Finalizar presente"** (`emailSheet`: e-mail, caixinha "Não tenho e-mail", aviso, Pix/cartão, "Seguir para pagamento · R$ X", frase do buquê) → se sem e-mail, janela do **WhatsApp** (`zapSheet`) → na Padrão sem `vit`, `vitSheet` → `pay(true)` → Pix (tela que reabre se o Instagram fechar) ou cartão → **Meu acesso** com a carta paga (link, WhatsApp, QR code, abrir, editar).

- E-mail vazio no "Seguir" = segue como sem e-mail (`S.emailPulado`). Sem e-mail: `reg.semEmail`, e-mail genérico `cliente.<id>@cartacomproposito.com.br` no Mercado Pago.
- WhatsApp (só Pix): `reg.whats`; 20 min sem pagar → ntfy "Pix não pago ⏳" com botão "Mandar WhatsApp" (`/api/zap`).
- Pix recusado pelo antifraude: 3 tentativas, depois `pixRecusadoSheet`. Cartão recusado: `cartaoRecusadoSheet`.
- Plano B PagBank (só Pix, pede CPF): pronto e **desligado** (liga com `PAGAMENTO=pagbank` + `PAGBANK_TOKEN`).

## A carta (quem recebe)

Envelope de ouro com selo real → toque no selo abre com luz e começa a música (instrumental "Fundo de adoração" ou YouTube). Partes, uma por vez: Para <nome> → roleta da Palavra → fotos no varal de ouro (Premium/adicional: álbum de ouro antes) → nossa música (mini player) → pote dos motivos (ler todos) → versículos em ouro espelhado → pergaminho de ouro com pena → números (juntos desde) → última foto na câmera **ou cabine de fotos** → mini filme (Premium) → pedido (namoro/noivado) → oração "Amém" → despedida. Visual: veludo (temas `rosa`, `dourado`, `ceu`) e ouro; fontes Playfair Display, DM Sans, Alex Brush, Dancing Script (pergaminho), Lora (alguns textos).

## Rotinas com o dono

- **Vendas:** prints do ntfy e do Mercado Pago (hora do Mercado Pago = hora local + 1h). Testes do dono não contam.
- **Funil:** observability do Netlify, `get-topk`, `urls_with_query`, filtro URL `/e.gif` (guarda 24 h; local = UTC-4). Pix gerados: logs da função `pagar`; pagos: 2º evento no `aviso` ≈ 1–3 min depois.
- **Meta:** dar ROAS, custo por venda por campanha e sugestão de orçamento; lembrar de recarregar o saldo à noite.
- **Fechamento do dia (à noite):** linha no `historico.md`, CSV `relatorios/vendas-por-dia.csv` (só totais do dia, sem dados de compradores) e painel de lucros (artefato https://claude.ai/code/artifact/DLyKVHddyFzspHJYYPrEhE: subir o CSV com `Artifact publish asset:true` e atualizar `ArtifactData` coleção `datasets`, doc `dias`, campo **`source.url`** (não `url`), com `if_version`). Relatório semanal todo **domingo à noite**.
- **Pendências:** carta de Natal (`rascunhos/carta-de-natal.html`) esperando o dono; depois do CNPJ (Contajá): Mercado Pago no CNPJ, emissor de NFS-e (Focus NFe) e textos como "serviço" (não "produto digital").

## Para ver como ficou

Abra `public/index.html` no navegador (Playwright já instalado) e use "Ver prévia carta Premium/Padrão". Funções do servidor só no Netlify.
