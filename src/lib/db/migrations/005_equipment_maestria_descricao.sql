-- ARS Arcana — descrição textual da maestria das armas
--
-- A maestria de uma arma é um nome curto (ex.: "Ágil") acompanhado da regra que
-- explica seu efeito. A descrição fica em coluna própria, restrita às armas, e é
-- preenchida pela importação do catálogo (`npm run db:import:equipamentos`).

ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS maestria_descricao text;

COMMENT ON COLUMN public.equipamentos.maestria_descricao IS 'Regra da maestria da arma, exatamente como na fonte; nula nos demais tipos.';

ALTER TABLE public.equipamentos
  DROP CONSTRAINT IF EXISTS equipamentos_maestria_descricao_check;

ALTER TABLE public.equipamentos
  ADD CONSTRAINT equipamentos_maestria_descricao_check
  CHECK (
    maestria_descricao IS NULL
    OR (tipo = 'arma' AND btrim(maestria_descricao) <> '')
  );
