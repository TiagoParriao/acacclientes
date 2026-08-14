const form = document.getElementById('form-novo-admin');
const btnCriar = document.getElementById('btn-criar');
const mensagem = document.getElementById('mensagem');
const listaAdmins = document.getElementById('lista-admins');

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
  mensagem.style.display = 'block';
}

async function carregarAdmins() {
  const { data, error } = await supabaseClient
    .from('admins')
    .select('nome, criado_em')
    .order('criado_em', { ascending: true });

  if (error || !data || data.length === 0) {
    listaAdmins.innerHTML = '<li>Nenhum admin encontrado.</li>';
    return;
  }

  listaAdmins.innerHTML = data.map((admin) => {
    const data_ = new Date(admin.criado_em).toLocaleDateString('pt-BR');
    return `<li>${admin.nome} — admin desde ${data_}</li>`;
  }).join('');
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  btnCriar.disabled = true;
  btnCriar.textContent = 'Criando...';
  mensagem.style.display = 'none';

  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  try {
    const { data, error } = await supabaseClient.functions.invoke('criar-admin', {
      body: { nome, email, senha },
    });

    if (error) throw error;
    if (data?.erro) throw new Error(data.erro);

    mostrarMensagem(`Admin "${nome}" criado com sucesso.`, 'sucesso');
    form.reset();
    carregarAdmins();
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(erro.message || 'Não foi possível criar o admin.', 'erro');
  } finally {
    btnCriar.disabled = false;
    btnCriar.textContent = 'Criar admin';
  }
});

document.getElementById('btn-sair').addEventListener('click', sair);

(async () => {
  const sessao = await exigirSessao();
  if (!sessao) return;
  await carregarAdmins();
})();
