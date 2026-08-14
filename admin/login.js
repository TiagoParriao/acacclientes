const form = document.getElementById('form-login');
const btnEntrar = document.getElementById('btn-entrar');
const mensagem = document.getElementById('mensagem');

async function redirecionarSeJaLogado() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.href = 'dashboard.html';
  }
}
redirecionarSeJaLogado();

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando...';
  mensagem.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

  if (error) {
    mensagem.textContent = 'E-mail ou senha inválidos.';
    mensagem.style.display = 'block';
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'Entrar';
    return;
  }

  window.location.href = 'dashboard.html';
});
