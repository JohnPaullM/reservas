# Sistema de Reservas — passo a passo de instalação

Este é um app de reservas com calendário. Ele funciona no computador, no iPhone e no Android, e manda **todo dia de manhã uma notificação com as reservas do dia** para a equipe.

**Custo: R$ 0.** Ele usa três serviços gratuitos:

| Serviço | Para quê | Plano |
|---|---|---|
| **Supabase** | Guarda as reservas e controla o login da equipe | Free |
| **GitHub Pages** | Hospeda o app (gera o link que a equipe abre) | Free |
| **GitHub Actions** | Dispara o alerta diário automaticamente | Free |

Reserve uns **40 minutos** para a primeira instalação. Você só faz isso uma vez.

> **Quer ver antes de instalar?** Dê dois cliques no `index.html`. Ele abre em **modo demonstração**, com dados de exemplo salvos só no seu navegador.

---

## Passo 1 — Criar o banco de dados (Supabase)

1. Acesse **supabase.com** → *Start your project* → entre com sua conta GitHub ou e-mail.
2. Clique em **New project**:
   - **Name:** `reservas`
   - **Database Password:** crie uma senha forte e guarde-a.
   - **Region:** *South America (São Paulo)*
   - Clique em **Create new project** e espere uns 2 minutos.
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Abra o arquivo `supabase/schema.sql` (no Bloco de Notas mesmo), copie **tudo**, cole e clique em **Run**. A mensagem esperada é *Success*.
   - O script também cria a pasta privada **anexos**, onde ficam as fotos das reservas. Para conferir, abra **Storage** no menu.
   - Se você já tinha rodado uma versão anterior deste arquivo, rode de novo sem medo. Ele só adiciona o que falta e não apaga reservas.
5. Pegue as chaves em **Project Settings** (engrenagem) → **API Keys**:
   - **Project URL**, que tem o formato `https://xxxx.supabase.co` e aparece em *Data API*.
   - **Publishable key**, que começa com `sb_publishable_`. Se o painel mostrar a aba *Legacy*, ela se chama **anon public**.
   - **Secret key**, que começa com `sb_secret_`. Na aba *Legacy*, ela se chama **service_role**.
   - ⚠️ A **Secret key** dá acesso total. Ela vai **apenas** no GitHub Secrets (passo 5) e **nunca** dentro dos arquivos do app.

### Bloquear cadastros de estranhos e cadastrar a equipe

6. Abra **Authentication** → **Sign In / Providers** e **desligue** a opção *Allow new users to sign up*. Assim, só quem você cadastrar consegue entrar.
7. Abra **Authentication** → **Users** → **Add user** → **Create new user**:
   - Preencha o e-mail e uma senha para o funcionário.
   - Marque **Auto Confirm User**.
   - Repita para cada pessoa da equipe, incluindo você.
   - Para trocar a senha de alguém depois, clique no usuário e use *Reset password* ou crie uma senha nova.

---

## Passo 2 — Preencher o `config.js`

Abra o `config.js` no Bloco de Notas e preencha entre as aspas:

```js
NOME: "Reservas – Nome do seu estabelecimento",
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_KEY: "sb_publishable_...",          // a Publishable/anon, NÃO a secret
VAPID_PUBLIC_KEY: "B...."                    // do arquivo CHAVES-VAPID.txt
```

### Personalizar os pedidos especiais

No mesmo arquivo fica a lista `EXTRAS`, com as opções que aparecem para marcar na reserva. Você pode adicionar, remover ou renomear à vontade:

```js
EXTRAS: [
  { nome: "Foto na taça", icone: "📷", pergunta: "Detalhes da foto (opcional)" },
  { nome: "Nome na taça", icone: "✍️", pergunta: "Qual nome vai na taça?" },
  { nome: "Bolo próprio", icone: "🎂" },
  { nome: "Espumante na chegada", icone: "🥂", pergunta: "Quantas garrafas?" }
]
```

- `pergunta` é opcional. Quando a opção tem uma pergunta, aparece um campo de texto ao marcá-la (ex.: o nome que vai na taça).
- Reservas antigas continuam mostrando opções que você tirar da lista.

Salve o arquivo.

---

## Passo 3 — Publicar o app (GitHub Pages)

1. Crie uma conta em **github.com**, se ainda não tiver.
2. Clique em **+** (canto superior direito) → **New repository**:
   - **Repository name:** `reservas`
   - Marque **Public**. O plano gratuito exige isso. O código fica visível, mas **as reservas não**, porque elas ficam no Supabase, protegidas por login.
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Abra a pasta `sistema-reservas` no seu computador, selecione **todo o conteúdo dela** (incluindo a pasta `.github`), arraste para a página e clique em **Commit changes**.
   - Confira que a lista mostra `index.html`, `app.js`, as pastas `icons`, `supabase`, `notificacoes` e `.github`.
   - Se a pasta `.github` não subir: clique em **Add file → Create new file**, digite o nome `.github/workflows/alerta-diario.yml`, cole o conteúdo desse arquivo e clique em **Commit**.
5. Abra **Settings** → **Pages**:
   - **Source:** *Deploy from a branch*
   - **Branch:** `main` / `(root)` → **Save**
6. Em 1 ou 2 minutos aparece o link do app, no formato **`https://SEU-USUARIO.github.io/reservas/`**. Este é o endereço que você passa para a equipe.

---

## Passo 4 — Testar o login

Abra o link no computador e entre com um dos usuários criados no passo 1. Crie uma reserva de teste. Ela deve aparecer no calendário e também no Supabase, em **Table Editor → reservas**.

---

## Passo 5 — Configurar o alerta diário

1. No repositório do GitHub, abra **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Crie estes 6 segredos, um de cada vez. O nome precisa ser exatamente igual ao da tabela:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | O Project URL |
| `SUPABASE_SECRET_KEY` | A **Secret key** (ou service_role) |
| `VAPID_PUBLIC_KEY` | A chave pública do `CHAVES-VAPID.txt` |
| `VAPID_PRIVATE_KEY` | A chave **privada** do `CHAVES-VAPID.txt` |
| `VAPID_CONTATO` | O seu e-mail |
| `APP_URL` | O link do app, ex.: `https://SEU-USUARIO.github.io/reservas/` |

3. Abra a aba **Actions**. Se aparecer um botão para habilitar workflows, clique nele.
4. Para testar agora: clique em **Alerta diário de reservas** → **Run workflow** → **Run workflow**. Em uns 30 segundos, todos os aparelhos que já ativaram os alertas recebem o resumo (veja o passo 6).

A partir daí, o alerta sai **sozinho todo dia, por volta das 7h** (horário de Brasília).

### Mudar o horário do alerta

Edite o arquivo `.github/workflows/alerta-diario.yml` no próprio GitHub (ícone de lápis) e troque a linha `cron`. O horário fica em UTC, que é **Brasília + 3 horas**:

| Horário desejado (Brasília) | Linha |
|---|---|
| 06:50 (padrão) | `- cron: '50 9 * * *'` |
| 08:00 | `- cron: '0 11 * * *'` |
| 10:30 | `- cron: '30 13 * * *'` |
| 07:00 só de terça a domingo | `- cron: '0 10 * * 0,2-6'` |

Se não quiser o aviso "Sem reservas hoje", troque `ENVIAR_SEM_RESERVAS: 'sim'` por `'nao'`.

---

## Passo 6 — Instalar nos celulares e ativar os alertas

Cada funcionário faz isso **uma vez em cada aparelho**.

### iPhone (precisa de iOS 16.4 ou mais recente)

1. Abra o link no **Safari**. Precisa ser o Safari; o Chrome do iPhone não serve aqui.
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. **Feche o Safari** e abra o app pelo **novo ícone** na tela de início.
4. Entre com e-mail e senha → toque em **🔔 Ativar alertas** → **Permitir**.
5. Deve chegar a notificação "Alertas ativados ✓".

### Android

1. Abra o link no **Chrome**.
2. Toque no menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).
3. Abra pelo ícone, entre e toque em **🔔 Ativar alertas** → **Permitir**.

### Computador (Windows/Mac)

Abra o link no Chrome ou no Edge. Para instalar, clique no ícone de instalar na barra de endereço ou no botão **Instalar** do app. Depois, ative os alertas em **🔔 Ativar alertas**.

---

## Como usar no dia a dia

- **Ver um dia:** toque no dia do calendário. O número no dia mostra quantas reservas existem e quantas pessoas (ex.: `2 · 30p`).
- **Nova reserva:** botão **+ Nova reserva**.
- **Pedidos especiais:** no formulário, marque as opções (📷 Foto na taça, ✍️ Nome na taça…). As que têm pergunta abrem um campo de texto, como o nome que vai na taça. Os pedidos aparecem em destaque na lista do dia e no **alerta da manhã**.
- **Fotos:** no formulário, toque em **📎 Adicionar fotos**. No celular dá para tirar a foto na hora ou escolher várias da galeria. As fotos aparecem em miniatura na reserva; toque para ver grande ou baixar. Para apagar uma, use o **×** na miniatura dentro do formulário.
- **Editar ou cancelar:** toque na reserva. Em *Situação*, escolha **Cancelada** para manter o histórico, ou use **Excluir** para apagar de vez.
- **Ligar para o cliente:** toque no telefone da reserva.
- Quando alguém da equipe cria ou altera uma reserva, **as telas dos colegas se atualizam sozinhas**.
- Tocar no alerta da manhã abre o app direto no dia.

---

## Limites do plano gratuito e cuidados

- **Supabase pausa projetos sem uso por 7 dias.** O alerta diário acessa o banco todo dia, o que mantém o projeto ativo. Se mesmo assim ele pausar, entre no painel e clique em *Restore*.
- **O GitHub pode atrasar o alerta** alguns minutos em horários de pico. Por isso o padrão é 06:50.
- **O GitHub desliga agendamentos de repositórios parados há 60 dias.** O próprio workflow faz um "commit vazio" a cada 45 dias para evitar isso.
- **Backup:** no Supabase, abra **Table Editor → reservas → Export → CSV**. Faça isso de vez em quando.
- O plano gratuito cobre com folga o uso de um estabelecimento: são 500 MB de banco, o que dá centenas de milhares de reservas.
- **Fotos:** o plano gratuito tem **1 GB** para arquivos. O app reduz cada foto para cerca de 200–400 KB antes de enviar, o que dá algo em torno de **3.000 fotos**. Para liberar espaço, apague as fotos de reservas antigas (pelo app ou em Supabase → **Storage → anexos**).
- **As fotos são privadas:** só quem faz login vê, e os links para abrir uma foto expiram em 1 hora.

---

## Problemas comuns

| Problema | Solução |
|---|---|
| A tela fica em "Modo demonstração" | O `config.js` publicado no GitHub ainda está vazio. Preencha e suba de novo. |
| "E-mail ou senha incorretos" | Confira o usuário em Supabase → Authentication → Users e se *Auto Confirm* foi marcado. |
| No iPhone não aparece "Permitir" | O app precisa ser aberto **pelo ícone da tela de início**, não pelo Safari. |
| Alerta não chega | Veja os detalhes em GitHub → **Actions** → última execução. Se aparecer "Nenhum aparelho cadastrado", ninguém ativou o 🔔 ainda. Confira também se as notificações do app estão permitidas nas configurações do celular. |
| Mudei algo e o app não atualizou | Feche o app e abra de novo (às vezes, duas vezes). |
| Foto não envia ("new row violates row-level security") | O `schema.sql` não foi rodado depois desta atualização. Rode-o de novo (passo 1.4). |
| "A reserva foi salva, mas X fotos não foram enviadas" | Normalmente é a internet. Toque em **Salvar** de novo para reenviar só as que faltaram. |
| Erro "Falta o segredo ..." no Actions | Um dos 6 segredos do passo 5 está faltando ou com o nome errado. |

---

## Estrutura dos arquivos

```
sistema-reservas/
├── index.html, style.css, app.js   → o app
├── config.js                       → SUAS configurações
├── sw.js, manifest.json, icons/    → instalação e notificações
├── supabase/schema.sql             → criação do banco (passo 1)
├── notificacoes/                   → script do resumo diário
└── .github/workflows/alerta-diario.yml → agendamento do alerta
```
