-- ARS Arcana — contas Google, sessões e grimórios por usuário
--
-- O adapter de autenticação usa as tabelas `usuarios`, `contas_oauth` e
-- `sessoes`. Os nomes de colunas seguem o contrato do Auth.js e são mapeados
-- pelo adapter em `src/lib/auth/adapter.ts`.

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL,
  email_verified timestamptz,
  image text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_email_not_blank_check
    CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unique
  ON public.usuarios (lower(email));

CREATE TABLE IF NOT EXISTS public.contas_oauth (
  user_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  PRIMARY KEY (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS contas_oauth_user_id_idx
  ON public.contas_oauth (user_id);

CREATE TABLE IF NOT EXISTS public.sessoes (
  session_token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessoes_user_id_idx
  ON public.sessoes (user_id);

CREATE INDEX IF NOT EXISTS sessoes_expires_idx
  ON public.sessoes (expires);

CREATE TABLE IF NOT EXISTS public.tokens_verificacao (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS public.grimorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  nome text NOT NULL,
  reservada boolean NOT NULL DEFAULT false,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grimorios_nome_not_blank_check
    CHECK (btrim(nome) <> ''),
  CONSTRAINT grimorios_nome_length_check
    CHECK (char_length(nome) <= 60),
  CONSTRAINT grimorios_reservada_nome_check
    CHECK (
      (reservada AND nome = 'Sem grimório')
      OR (
        NOT reservada
        AND lower(btrim(nome)) <> lower('Sem grimório')
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS grimorios_user_nome_unique
  ON public.grimorios (user_id, lower(btrim(nome)))
  WHERE NOT reservada;

CREATE UNIQUE INDEX IF NOT EXISTS grimorios_user_reservada_unique
  ON public.grimorios (user_id)
  WHERE reservada;

CREATE INDEX IF NOT EXISTS grimorios_user_id_idx
  ON public.grimorios (user_id);

CREATE TABLE IF NOT EXISTS public.magias_salvas (
  grimorio_id uuid NOT NULL REFERENCES public.grimorios (id) ON DELETE CASCADE,
  magia_id uuid NOT NULL REFERENCES public.magias (id) ON DELETE CASCADE,
  salva_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grimorio_id, magia_id)
);

CREATE INDEX IF NOT EXISTS magias_salvas_magia_id_idx
  ON public.magias_salvas (magia_id);

CREATE OR REPLACE FUNCTION public.set_grimorios_atualizada_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizada_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grimorios_atualizada_em ON public.grimorios;
CREATE TRIGGER trg_grimorios_atualizada_em
  BEFORE UPDATE ON public.grimorios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_grimorios_atualizada_em();

COMMENT ON TABLE public.usuarios IS 'Contas criadas no primeiro login com Google.';
COMMENT ON TABLE public.contas_oauth IS 'Vínculo entre a conta local e o provedor Google.';
COMMENT ON TABLE public.sessoes IS 'Sessões revogáveis mantidas no servidor.';
COMMENT ON TABLE public.grimorios IS 'Coleções de magias pertencentes a um usuário.';
COMMENT ON COLUMN public.grimorios.reservada IS 'Verdadeiro somente para a coleção reservada "Sem grimório".';
COMMENT ON TABLE public.magias_salvas IS 'Associação entre grimório e magia do catálogo global.';
