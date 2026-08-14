// Garante que só usuários autenticados acessem as páginas do admin.
// Deve ser incluído logo após assets/supabase-client.js em toda página de admin,
// exceto login.html.
async function exigirSessao() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return data.session;
}

async function sair() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
