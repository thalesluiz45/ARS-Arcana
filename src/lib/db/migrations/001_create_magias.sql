-- ARS Arcana — catálogo remoto de magias
-- `tipo` representa a escola de magia (Abjuração, Adivinhação, ...).
-- `classes` representa as classes que têm acesso à magia. A fonte de dados
-- (PDF de referência) fornece as duas dimensões separadamente.

CREATE TABLE IF NOT EXISTS public.magias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL,
  classes text[] NOT NULL DEFAULT '{}',
  circulo smallint NOT NULL,
  descricao text NOT NULL,
  tempo_conjuracao text NOT NULL,
  alcance text NOT NULL,
  duracao text NOT NULL,
  componentes_verbal boolean NOT NULL DEFAULT false,
  componentes_somatico boolean NOT NULL DEFAULT false,
  componentes_material boolean NOT NULL DEFAULT false,
  componentes_material_descricao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT magias_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT magias_nome_not_blank_check
    CHECK (btrim(nome) <> ''),
  CONSTRAINT magias_tipo_not_blank_check
    CHECK (btrim(tipo) <> ''),
  CONSTRAINT magias_circulo_check
    CHECK (circulo BETWEEN 0 AND 9),
  CONSTRAINT magias_descricao_not_blank_check
    CHECK (btrim(descricao) <> ''),
  CONSTRAINT magias_tempo_conjuracao_not_blank_check
    CHECK (btrim(tempo_conjuracao) <> ''),
  CONSTRAINT magias_alcance_not_blank_check
    CHECK (btrim(alcance) <> ''),
  CONSTRAINT magias_duracao_not_blank_check
    CHECK (btrim(duracao) <> ''),
  CONSTRAINT magias_classes_not_empty_check
    CHECK (cardinality(classes) > 0 AND array_position(classes, '') IS NULL),
  CONSTRAINT magias_componentes_check
    CHECK (componentes_verbal OR componentes_somatico OR componentes_material),
  CONSTRAINT magias_material_descricao_check
    CHECK (
      (componentes_material AND (componentes_material_descricao IS NULL OR btrim(componentes_material_descricao) <> ''))
      OR (NOT componentes_material AND componentes_material_descricao IS NULL)
    )
);

COMMENT ON COLUMN public.magias.tipo IS 'Escola de magia conforme o vocabulário do catálogo.';
COMMENT ON COLUMN public.magias.classes IS 'Classes que têm acesso à magia; filtro combinado por sobreposição (OR).';

CREATE INDEX IF NOT EXISTS idx_magias_tipo_circulo
  ON public.magias (tipo, circulo);

CREATE INDEX IF NOT EXISTS idx_magias_circulo
  ON public.magias (circulo);

CREATE INDEX IF NOT EXISTS idx_magias_nome
  ON public.magias (nome);

CREATE INDEX IF NOT EXISTS idx_magias_nome_lower
  ON public.magias (lower(nome));

CREATE INDEX IF NOT EXISTS idx_magias_classes
  ON public.magias USING gin (classes);

CREATE OR REPLACE FUNCTION public.set_magias_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_magias_atualizado_em ON public.magias;
CREATE TRIGGER trg_magias_atualizado_em
  BEFORE UPDATE ON public.magias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_magias_atualizado_em();
