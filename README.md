<div align="center">

![Imgur](https://i.imgur.com/uPvHCk3.png)

</div>

O ARS Arcana é um website desenvolvido para reunir e organizar as magias de Dungeons & Dragons 5.5e em um só lugar. Uma biblioteca mágica pensada para facilitar a consulta de magias durante suas aventuras, permitindo explorar habilidades, descobrir novas possibilidades e preparar seu próximo grimório.

---

## Funcionalidades

- **Biblioteca de magias:** explore as magias de D&D 5.5e em uma interface organizada e intuitiva.

- **Busca de magias:** encontre rapidamente uma magia pelo nome.

- **Filtros avançados:** refine sua pesquisa por classe, círculo e escola de magia.

- **Informações detalhadas:** consulte informações como tempo de conjuração, alcance, duração e componentes.

- **Magias salvas:** entre com Google para guardar suas magias favoritas na sua conta.

- **Grimório pessoal:** organize suas magias em grimórios sincronizados entre dispositivos.

- **Conta:** acesse Magias Salvas, Arsenal e saia da conta pelo menu do cabeçalho.

## Autenticação

O login usa exclusivamente Google OAuth (Auth.js) com sessões de servidor
revogáveis. Usuários, contas Google, sessões e grimórios ficam no PostgreSQL;
a Biblioteca e os detalhes das magias continuam públicos.

1. Crie credenciais OAuth do tipo **Aplicativo da Web** no Google Cloud Console.
2. Cadastre `http://localhost:3000/api/auth/callback/google` como URL de
   redirecionamento autorizada em desenvolvimento (e a URL equivalente em
   produção).
3. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `AUTH_SECRET` no
   `.env.local`, conforme `.env.example`.
4. Aplique as migrações com `npm run db:migrate` antes de iniciar a aplicação.

Os grimórios antigos salvos no IndexedDB não são importados. Se existirem, a
tela de login pede confirmação explícita e só os apaga depois de um login
bem-sucedido; o cache de detalhes das magias (`cache_magias`) é preservado.

## Sobre o projeto

O ARS Arcana surgiu com a ideia de tornar a consulta de magias mais prática e agradável para jogadores de Dungeons & Dragons.

Seja para preparar a ficha de um novo personagem, planejar suas próximas escolhas ou simplesmente descobrir uma magia interessante, o objetivo é oferecer uma experiência simples, organizada e imersiva.

---

<div align="center">

_Que seus estudos arcanos nunca terminem._

</div>
