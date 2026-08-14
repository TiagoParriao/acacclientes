# Carteira Digital de Filiado — ACAC

Sistema próprio para a Associação Comercial e Agro Industrial de Curionópolis gerenciar a
carteira digital de filiados, substituindo o modelo anterior (site estático + Google Sheets de
terceiro, que expunha todos os cadastros no front-end).

- **Filiado**: acessa sua carteirinha digital com QR code (`carteirinha.html?token=...`).
- **Empresa parceira**: escaneia o QR pela câmera e recebe validação instantânea (`validar.html`).
- **Gestor (admin)**: painel com login para listar, aprovar, editar e ativar/desativar filiados,
  com histórico de todas as alterações (`admin/`).

Front-end estático (HTML/CSS/JS puro), hospedado no GitHub Pages. Banco de dados e autenticação
no Supabase (Postgres + Auth + Row Level Security).

## Passo a passo para colocar no ar

### 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (recomendado: com o e-mail/GitHub
   da própria associação, não de terceiros).
2. Clique em **New project**. Escolha um nome (ex.: `acac-carteira`), uma senha de banco (guarde
   em local seguro) e a região mais próxima (ex.: São Paulo).
3. Aguarde o projeto terminar de provisionar (1–2 minutos).

### 2. Rodar o script do banco de dados

1. No painel do projeto, vá em **SQL Editor > New query**.
2. Cole todo o conteúdo de [`sql/schema.sql`](sql/schema.sql) e clique em **Run**.
3. Isso cria as tabelas (`filiados`, `admins`, `validacoes`, `historico_alteracoes`), as
   políticas de segurança (RLS) e o bucket de storage `fotos-filiados` para as fotos.

### 3. Configurar o front-end

1. Vá em **Project Settings > API**.
2. Copie a **Project URL** e a chave **anon public**.
3. Abra [`config.js`](config.js) e substitua:
   ```js
   const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
   const SUPABASE_ANON_KEY = 'SUA-ANON-KEY-AQUI';
   ```
   pelos valores reais. A `anon key` é segura para ficar aqui — quem protege os dados são as
   políticas de RLS do banco, não o segredo da chave.

### 4. Importar os 29 cadastros existentes

1. Instale as dependências do script (uma vez só):
   ```bash
   npm install
   ```
2. Em **Project Settings > API**, copie também a chave **service_role** (secreta — nunca vai
   para o front-end nem para o Git).
3. Rode primeiro em modo de teste, sem gravar nada, para conferir se está lendo tudo certo:
   ```bash
   node scripts/importar-cadastros.mjs --dry-run
   ```
4. Se a lista de 29 filiados aparecer correta, rode de verdade (isso baixa as fotos do Google
   Drive e sobe pro seu Supabase Storage, e insere os 29 registros):

   No PowerShell:
   ```powershell
   $env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
   node scripts/importar-cadastros.mjs
   ```
5. Confira no painel do Supabase (**Table Editor > filiados**) se os 29 registros entraram
   corretamente, com foto e situação certas.

### 5. Criar seu usuário admin

1. No Supabase, vá em **Authentication > Users > Add user** e crie seu usuário (e-mail + senha).
2. Volte ao **SQL Editor** e rode (trocando o e-mail):
   ```sql
   insert into public.admins (user_id, nome)
   select id, 'Seu Nome' from auth.users where email = 'seu-email@exemplo.com';
   ```
3. Agora esse e-mail/senha consegue logar em `admin/login.html` e gerenciar os filiados.

### 6. Publicar no GitHub Pages

1. Confira que `config.js` está com os valores reais preenchidos (ele **precisa** ir para o
   repositório — é a chave pública, não a secreta).
2. Faça commit e push das mudanças para o repositório `acacclientes`.
3. Em **Settings > Pages** do repositório, confirme que o Pages está publicando a branch
   principal a partir da raiz.
4. O site ficará em `https://tiagoparriao.github.io/acacclientes/`.

## Estrutura do projeto

```
index.html              landing com links para cadastro / validar / admin
cadastro.html + .js      formulário público de cadastro (entra como "pendente")
carteirinha.html + .js   carteirinha do filiado com QR code (acessa por ?token=)
validar.html + .js       leitor de QR para empresas parceiras validarem
admin/                   painel do gestor (login, listagem, edição, histórico)
assets/                  CSS, logo e imagem de fundo compartilhados
sql/schema.sql            script único de criação do banco + políticas de segurança
scripts/importar-cadastros.mjs   importação dos cadastros existentes (rodado uma vez, localmente)
config.js                 URL e chave pública do Supabase
```

## Sobre a segurança

- A tabela `filiados` **não tem select público**. A única forma de consultar um filiado de fora
  é pela função `consultar_por_token`, que recebe um token e devolve no máximo 1 registro — nunca
  a lista inteira.
- O token do QR code é um UUID aleatório, não uma sequência (`id=1, 2, 3...`) nem o CNPJ — não dá
  para "adivinhar" o link de outro filiado.
- Só usuários cadastrados na tabela `admins` conseguem listar todos os filiados, editar dados ou
  mudar situação — reforçado por Row Level Security no banco, não só na interface.
- Toda alteração de nome, empresa, CNPJ, foto ou situação gera uma linha automática em
  `historico_alteracoes` (via trigger no banco), com autor e data.

## Próximos passos sugeridos (fora do escopo desta versão)

- Login do filiado por CPF/CNPJ + código, em vez de link direto (hoje os cadastros importados
  não têm CPF preenchido — precisaria coletar isso antes).
- Relatórios sobre a tabela `validacoes` (quantas vezes cada carteirinha foi validada).
- Restringir tipo/tamanho de arquivo no upload de fotos diretamente na configuração do bucket
  (**Storage > fotos-filiados > Policies/Settings**).
