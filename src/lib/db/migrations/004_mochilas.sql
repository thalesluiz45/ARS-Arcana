-- ARS Arcana — mochilas por usuário
--
-- Mochilas são listas nomeadas de equipamentos salvos, equivalentes aos
-- grimórios de magias. A mochila reservada "Sem mochila" guarda os itens que
-- não pertencem a nenhuma lista nomeada. O antigo `arsenal_itens` é migrado
-- para ela, preservando os equipamentos já salvos pelas contas existentes.

CREATE TABLE IF NOT EXISTS public.mochilas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  nome text NOT NULL,
  reservada boolean NOT NULL DEFAULT false,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mochilas_nome_not_blank_check
    CHECK (btrim(nome) <> ''),
  CONSTRAINT mochilas_nome_length_check
    CHECK (char_length(nome) <= 60),
  CONSTRAINT mochilas_reservada_nome_check
    CHECK (
      (reservada AND nome = 'Sem mochila')
      OR (
        NOT reservada
        AND lower(btrim(nome)) <> lower('Sem mochila')
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS mochilas_user_nome_unique
  ON public.mochilas (user_id, lower(btrim(nome)))
  WHERE NOT reservada;

CREATE UNIQUE INDEX IF NOT EXISTS mochilas_user_reservada_unique
  ON public.mochilas (user_id)
  WHERE reservada;

CREATE INDEX IF NOT EXISTS mochilas_user_id_idx
  ON public.mochilas (user_id);

CREATE TABLE IF NOT EXISTS public.mochila_itens (
  mochila_id uuid NOT NULL REFERENCES public.mochilas (id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos (id) ON DELETE CASCADE,
  salvo_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mochila_id, equipamento_id)
);

CREATE INDEX IF NOT EXISTS mochila_itens_equipamento_id_idx
  ON public.mochila_itens (equipamento_id);

CREATE OR REPLACE FUNCTION public.set_mochilas_atualizada_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizada_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mochilas_atualizada_em ON public.mochilas;
CREATE TRIGGER trg_mochilas_atualizada_em
  BEFORE UPDATE ON public.mochilas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mochilas_atualizada_em();

INSERT INTO public.mochilas (user_id, nome, reservada)
SELECT id, 'Sem mochila', true
FROM public.usuarios
ON CONFLICT DO NOTHING;

INSERT INTO public.mochila_itens (mochila_id, equipamento_id, salvo_em)
SELECT m.id, a.equipamento_id, a.salvo_em
FROM public.arsenal_itens AS a
JOIN public.mochilas AS m ON m.user_id = a.user_id AND m.reservada
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.arsenal_itens;

COMMENT ON TABLE public.mochilas IS 'Listas de equipamentos salvos pertencentes a um usuário.';
COMMENT ON COLUMN public.mochilas.reservada IS 'Verdadeiro somente para a coleção reservada "Sem mochila".';
COMMENT ON TABLE public.mochila_itens IS 'Associação entre mochila e equipamento do catálogo global.';
