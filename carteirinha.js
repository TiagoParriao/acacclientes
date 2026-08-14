const rotulosSituacao = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  pendente: 'Pendente de aprovação',
};

async function carregarCarteirinha() {
  const token = new URLSearchParams(window.location.search).get('token');
  const carregando = document.getElementById('card-carregando');
  const cardCarteirinha = document.getElementById('card-carteirinha');
  const cardNaoEncontrado = document.getElementById('card-nao-encontrado');

  if (!token) {
    carregando.style.display = 'none';
    cardNaoEncontrado.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.rpc('consultar_por_token', { p_token: token });

  carregando.style.display = 'none';

  if (error || !data || data.length === 0) {
    cardNaoEncontrado.style.display = 'block';
    return;
  }

  const filiado = data[0];

  document.getElementById('foto-filiado').src = filiado.foto_url || '';
  document.getElementById('nome-filiado').textContent = filiado.nome;
  document.getElementById('empresa-filiado').textContent = filiado.empresa;

  const badge = document.getElementById('situacao-filiado');
  badge.textContent = rotulosSituacao[filiado.situacao] || filiado.situacao;
  badge.classList.add(filiado.situacao);

  new QRCode(document.getElementById('qr-code-container'), {
    text: token,
    width: 180,
    height: 180,
  });

  cardCarteirinha.style.display = 'flex';
}

carregarCarteirinha();
