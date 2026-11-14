-- ARS Arcana — catálogo de equipamentos e Arsenal por usuário
--
-- O catálogo é global e usa `slug` como chave de negócio estável. As colunas
-- específicas de cada subtipo ficam tipadas e são protegidas por constraints,
-- em vez de concatenar propriedades em texto livre.

CREATE TABLE IF NOT EXISTS public.equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL,
  categoria text,
  dano text,
  tipo_dano text,
  propriedades text[] NOT NULL DEFAULT '{}',
  maestria text,
  classe_armadura text,
  forca text,
  furtividade text,
  atributo text,
  descricao text,
  peso text,
  custo text NOT NULL,
  fonte_pagina smallint NOT NULL,
  arma_tipo text,
  arma_alcance text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipamentos_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT equipamentos_nome_not_blank_check
    CHECK (btrim(nome) <> ''),
  CONSTRAINT equipamentos_tipo_check
    CHECK (tipo IN ('arma', 'armadura', 'ferramenta', 'aventura')),
  CONSTRAINT equipamentos_custo_not_blank_check
    CHECK (btrim(custo) <> ''),
  CONSTRAINT equipamentos_peso_check
    CHECK (peso IS NULL OR btrim(peso) <> ''),
  CONSTRAINT equipamentos_fonte_pagina_check
    CHECK (fonte_pagina > 0),
  CONSTRAINT equipamentos_arma_categoria_check
    CHECK (
      categoria IS NULL
      OR categoria IN (
        'Simples Corpo a Corpo',
        'Simples à Distância',
        'Marcial Corpo a Corpo',
        'Marcial à Distância',
        'Leve',
        'Média',
        'Pesada',
        'Escudo',
        'Ferramentas de Artesão',
        'Outras Ferramentas'
      )
    ),
  CONSTRAINT equipamentos_arma_tipo_check
    CHECK (arma_tipo IS NULL OR arma_tipo IN ('simples', 'marcial')),
  CONSTRAINT equipamentos_arma_alcance_check
    CHECK (arma_alcance IS NULL OR arma_alcance IN ('corpo-a-corpo', 'distancia')),
  CONSTRAINT equipamentos_tipo_dano_check
    CHECK (tipo_dano IS NULL OR tipo_dano IN ('Perfurante', 'Contundente', 'Cortante')),
  CONSTRAINT equipamentos_furtividade_check
    CHECK (furtividade IS NULL OR furtividade = 'Desvantagem'),
  CONSTRAINT equipamentos_propriedades_check
    CHECK (array_position(propriedades, '') IS NULL),
  CONSTRAINT equipamentos_campos_por_tipo_check
    CHECK (
      (
        tipo = 'arma'
        AND categoria IS NOT NULL
        AND dano IS NOT NULL
        AND tipo_dano IS NOT NULL
        AND maestria IS NOT NULL
        AND arma_tipo IS NOT NULL
        AND arma_alcance IS NOT NULL
        AND classe_armadura IS NULL
        AND forca IS NULL
        AND furtividade IS NULL
        AND atributo IS NULL
        AND descricao IS NULL
      )
      OR (
        tipo = 'armadura'
        AND categoria IS NOT NULL
        AND classe_armadura IS NOT NULL
        AND arma_tipo IS NULL
        AND arma_alcance IS NULL
        AND dano IS NULL
        AND tipo_dano IS NULL
        AND maestria IS NULL
        AND atributo IS NULL
        AND descricao IS NULL
      )
      OR (
        tipo = 'ferramenta'
        AND categoria IS NOT NULL
        AND atributo IS NOT NULL
        AND descricao IS NOT NULL
        AND arma_tipo IS NULL
        AND arma_alcance IS NULL
        AND dano IS NULL
        AND tipo_dano IS NULL
        AND maestria IS NULL
        AND classe_armadura IS NULL
        AND forca IS NULL
        AND furtividade IS NULL
        AND cardinality(propriedades) = 0
      )
      OR (
        tipo = 'aventura'
        AND descricao IS NOT NULL
        AND categoria IS NULL
        AND arma_tipo IS NULL
        AND arma_alcance IS NULL
        AND dano IS NULL
        AND tipo_dano IS NULL
        AND maestria IS NULL
        AND classe_armadura IS NULL
        AND forca IS NULL
        AND furtividade IS NULL
        AND atributo IS NULL
        AND cardinality(propriedades) = 0
      )
    )
);

COMMENT ON COLUMN public.equipamentos.slug IS 'Identificador de negócio estável usado nas rotas públicas.';
COMMENT ON COLUMN public.equipamentos.peso IS 'Valor de apresentação exatamente como na fonte; não é convertido para número.';
COMMENT ON COLUMN public.equipamentos.custo IS 'Valor de apresentação exatamente como na fonte; não é convertido para número.';
COMMENT ON COLUMN public.equipamentos.fonte_pagina IS 'Página de origem do item no livro de referência.';
COMMENT ON COLUMN public.equipamentos.arma_tipo IS 'Dimensão derivada da categoria: simples ou marcial.';
COMMENT ON COLUMN public.equipamentos.arma_alcance IS 'Dimensão derivada da categoria: corpo a corpo ou à distância.';

CREATE INDEX IF NOT EXISTS idx_equipamentos_tipo_nome
  ON public.equipamentos (tipo, nome);

CREATE INDEX IF NOT EXISTS idx_equipamentos_categoria
  ON public.equipamentos (categoria);

CREATE INDEX IF NOT EXISTS idx_equipamentos_arma_dimensoes
  ON public.equipamentos (arma_tipo, arma_alcance);

CREATE INDEX IF NOT EXISTS idx_equipamentos_nome_lower
  ON public.equipamentos (lower(nome));

CREATE INDEX IF NOT EXISTS idx_equipamentos_propriedades
  ON public.equipamentos USING gin (propriedades);

CREATE TABLE IF NOT EXISTS public.arsenal_itens (
  user_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos (id) ON DELETE CASCADE,
  salvo_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, equipamento_id)
);

CREATE INDEX IF NOT EXISTS arsenal_itens_equipamento_id_idx
  ON public.arsenal_itens (equipamento_id);

CREATE INDEX IF NOT EXISTS arsenal_itens_user_salvo_em_idx
  ON public.arsenal_itens (user_id, salvo_em DESC);

COMMENT ON TABLE public.arsenal_itens IS 'Itens de equipamento salvos por uma conta; não representa quantidade nem inventário de personagem.';

CREATE OR REPLACE FUNCTION public.set_equipamentos_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipamentos_atualizado_em ON public.equipamentos;
CREATE TRIGGER trg_equipamentos_atualizado_em
  BEFORE UPDATE ON public.equipamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_equipamentos_atualizado_em();
