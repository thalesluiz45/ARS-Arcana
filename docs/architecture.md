# Arquitetura

O ARS Arcana utiliza o Next.js App Router com páginas de catálogo renderizadas no servidor, autenticação via Google OAuth (Auth.js), sessões server-side e persistência em PostgreSQL para grimórios individuais e um Arsenal de equipamentos. Os catálogos de magias e equipamentos permanecem públicos; as magias salvas e os itens do Arsenal são privados.

## Estrutura de diretórios

| Caminho                           | Responsabilidade                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(site)/`                 | Rotas públicas e autenticadas da aplicação com o layout principal do site                                                          |
| `src/app/login/`                  | Tela de login exclusivo via Google e confirmação de dados legados                                                                  |
| `src/app/api/auth/[...nextauth]/` | Route handlers do Auth.js                                                                                                          |
| `src/app/api/equipamentos/`       | Catálogo público de equipamentos e detalhes por slug                                                                               |
| `src/app/api/arsenal/`            | Listagem, adição e remoção de itens do Arsenal para usuários autenticados                                                          |
| `src/app/api/grimorios/`          | Listagem, criação, renomeação e exclusão de grimórios para usuários autenticados                                                   |
| `src/app/api/magias-salvas/`      | Seleção de magias para associação aos grimórios do usuário                                                                         |
| `src/auth.ts`                     | Configuração do Google Provider, sessões no banco de dados e callback de redirecionamento                                          |
| `src/lib/auth/`                   | Leitura de sessões, adapter do Auth.js e helpers para redirecionamentos seguros                                                    |
| `src/lib/equipment/`              | Busca de equipamentos, mapeamento de registros, persistência do Arsenal e mapeamento de erros                                      |
| `src/lib/grimoires/`              | Repositório de grimórios com controle de propriedade por usuário e mapeamento de erros                                             |
| `src/lib/catalog/`                | Consultas server-only ao catálogo de magias e mapeamento de registros                                                              |
| `src/lib/import/`                 | Validação de magias e equipamentos, operações de upsert e relatórios de importação                                                 |
| `src/lib/db/`                     | Adapters e migrations para PostgreSQL, Neon e PGlite                                                                               |
| `src/lib/local/`                  | Cache de snapshots de magias exclusivo do navegador e limpeza de listas legadas                                                    |
| `src/components/`                 | Componentes compartilhados de layout, menu da conta, interface de magias e grimórios, cards e filtros de equipamentos e diálogos   |
| `tests/`                          | Testes com Vitest para catálogos, repositórios, adapter de autenticação, redirecionamentos, importações e limpeza de dados legados |

## Limites de execução (Runtime Boundaries)

- O acesso ao banco de dados é exclusivo do servidor (server-only). Os componentes do navegador utilizam `/api/magias` e `/api/magias/[id]` para acessar o catálogo de magias, `/api/equipamentos` e `/api/equipamentos/[slug]` para o catálogo de equipamentos, e as rotas autenticadas `/api/grimorios`, `/api/magias-salvas` e `/api/arsenal` para acessar dados pessoais.
- A identidade utilizada em todas as operações pessoais é obtida a partir da sessão do servidor (`getSessionUser`). IDs de usuários fornecidos pelo cliente nunca são aceitos.
- As rotas `/magias-salvas` e `/arsenal` são protegidas no Server Component. Visitantes não autenticados são redirecionados para `/login?returnTo=...`. O callback de redirecionamento aceita apenas destinos internos. As ações de salvar itens nas páginas públicas de detalhes utilizam o mesmo redirecionamento para login e retornam ao equipamento original.
- `src/lib/local/` continua responsável pelo cache de snapshots `cache_magias` no IndexedDB. Os stores legados `listas_salvas` e `magias_salvas` são utilizados apenas para detectar dados antigos e são limpos após a confirmação explícita do usuário e um login bem-sucedido.
- Falhas no catálogo, na autenticação e nas coleções remotas permanecem explícitas; elas não são representadas como resultados vazios.

## Modelo de dados

A migration `002_auth_and_grimoires.sql` adiciona:

- `usuarios`, `contas_oauth`, `sessoes` e `tokens_verificacao` para o Auth.js.
- `grimorios`, vinculados por `user_id`, com uma coleção reservada única (`reservada = true`) e nomes únicos por usuário, sem distinção entre maiúsculas e minúsculas.
- `magias_salvas`, que associa um grimório a uma magia do catálogo global.

Todas as queries filtram os dados pelo usuário da sessão. A exclusão de uma conta realiza operações de cascade delete em suas contas OAuth, sessões, grimórios e magias salvas, preservando o catálogo global.

Ao excluir um grimório nomeado, as magias que não estiverem associadas a nenhum outro grimório nomeado são movidas para a coleção reservada `Sem grimório`.

A migration `003_equipment_and_arsenal.sql` adiciona:

- `equipamentos`, um catálogo global identificado pelo `slug` estável, com campos comuns de apresentação (`peso`, `custo`, `fonte_pagina`), colunas tipadas para subtipos, propriedades de armas armazenadas como `text[]` e dimensões derivadas `arma_tipo` e `arma_alcance`. Uma constraint `CHECK`, sensível ao tipo, rejeita campos pertencentes a subtipos incompatíveis.
- `arsenal_itens`, uma associação entre `(user_id, equipamento_id)` com exclusões em cascade e sem colunas de quantidade, personagem ou loadout.

O importador de equipamentos valida um schema discriminado do Zod, rejeita slugs duplicados e executa upsert por `slug`, preservando os IDs existentes no banco de dados.

O arquivo `data/equipamentos.json` é utilizado exclusivamente durante a importação. O servidor em runtime nunca realiza a leitura desse arquivo. Ele é ignorado pelo Git e deve ser fornecido ao ambiente de importação (por exemplo, por meio de um artefato de CI/deploy ou do parâmetro `--source=<path>`).

## Compatibilidade de dados

O payload de magias contém nomes de campos em português, e o schema do PostgreSQL, os nomes dos arquivos de migration, os caminhos da API e os stores do IndexedDB utilizam identificadores existentes em português.

O tipo `Spell` e os nomes dos módulos e funções em TypeScript permanecem em inglês.

A renomeação de identificadores persistentes exige uma migration separada e um plano de compatibilidade.

## Validação

Execute as verificações relevantes a partir da raiz do repositório:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:import:equipamentos:dry
```

Os fluxos do navegador são executados com `npm run test:e2e`, utilizando uma instância do catálogo na porta 3000 e uma instância sem banco de dados na porta 3001.

O fluxo autenticado opcional do Arsenal exige a variável `E2E_AUTH_STORAGE_STATE`.
