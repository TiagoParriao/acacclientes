// Edge Function: cria um novo usuário admin.
// Só pode ser chamada por quem já é admin (verificado abaixo). Usa a service role
// key, disponível apenas no ambiente do servidor (nunca no navegador).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function responderJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return responderJson({ erro: 'Método não permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return responderJson({ erro: 'Não autenticado' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Valida o token direto na API do GoTrue (evita incompatibilidades do SDK
  // com o formato novo de chave/publishable key nesta versão).
  const respUsuario = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!respUsuario.ok) {
    return responderJson({ erro: 'Sessão inválida' }, 401);
  }
  const dadosUsuario = { user: await respUsuario.json() };

  const clienteAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: souAdmin } = await clienteAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', dadosUsuario.user.id)
    .maybeSingle();

  if (!souAdmin) {
    return responderJson({ erro: 'Apenas admins podem criar outros admins' }, 403);
  }

  let corpo: { email?: string; senha?: string; nome?: string };
  try {
    corpo = await req.json();
  } catch {
    return responderJson({ erro: 'Corpo da requisição inválido' }, 400);
  }

  const { email, senha, nome } = corpo;
  if (!email || !senha || !nome) {
    return responderJson({ erro: 'Preencha nome, e-mail e senha' }, 400);
  }
  if (senha.length < 8) {
    return responderJson({ erro: 'A senha precisa ter pelo menos 8 caracteres' }, 400);
  }

  const { data: novoUsuario, error: erroCriacao } = await clienteAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (erroCriacao || !novoUsuario.user) {
    return responderJson({ erro: erroCriacao?.message ?? 'Não foi possível criar o usuário' }, 400);
  }

  const { error: erroInsert } = await clienteAdmin
    .from('admins')
    .insert({ user_id: novoUsuario.user.id, nome });

  if (erroInsert) {
    return responderJson({ erro: erroInsert.message }, 400);
  }

  return responderJson({ sucesso: true });
});
