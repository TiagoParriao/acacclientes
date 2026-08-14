const idFiliado = new URLSearchParams(window.location.search).get('id');
const form = document.getElementById('form-editar');
const btnSalvar = document.getElementById('btn-salvar');
const mensagem = document.getElementById('mensagem');
const listaHistorico = document.getElementById('lista-historico');

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
  mensagem.style.display = 'block';
}

async function carregarFiliado() {
  const { data, error } = await supabaseClient
    .from('filiados')
    .select('*')
    .eq('id', idFiliado)
    .single();

  if (error || !data) {
    mostrarMensagem('Filiado não encontrado.', 'erro');
    form.style.display = 'none';
    return;
  }

  document.getElementById('nome').value = data.nome;
  document.getElementById('empresa').value = data.empresa;
  document.getElementById('cnpj').value = data.cnpj;
  document.getElementById('situacao').value = data.situacao;

  const linkCarteirinha = new URL(`../carteirinha.html?token=${data.token_qr}`, window.location.href).href;
  document.getElementById('link-carteirinha').value = linkCarteirinha;
}

async function carregarHistorico() {
  const { data, error } = await supabaseClient
    .from('historico_alteracoes')
    .select('campo, valor_anterior, valor_novo, alterado_em')
    .eq('filiado_id', idFiliado)
    .order('alterado_em', { ascending: false });

  if (error || !data || data.length === 0) {
    listaHistorico.innerHTML = '<li>Nenhuma alteração registrada ainda.</li>';
    return;
  }

  listaHistorico.innerHTML = data.map((item) => {
    const data_ = new Date(item.alterado_em).toLocaleString('pt-BR');
    return `<li>${data_} — <strong>${item.campo}</strong>: "${item.valor_anterior ?? ''}" → "${item.valor_novo ?? ''}"</li>`;
  }).join('');
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Salvando...';
  mensagem.style.display = 'none';

  try {
    const atualizacao = {
      nome: document.getElementById('nome').value.trim(),
      empresa: document.getElementById('empresa').value.trim(),
      cnpj: document.getElementById('cnpj').value.trim(),
      situacao: document.getElementById('situacao').value,
    };

    const arquivoFoto = document.getElementById('foto').files[0];
    if (arquivoFoto) {
      const extensao = arquivoFoto.name.split('.').pop();
      const nomeArquivo = `filiados/${idFiliado}-${Date.now()}.${extensao}`;

      const { error: erroUpload } = await supabaseClient
        .storage
        .from('fotos-filiados')
        .upload(nomeArquivo, arquivoFoto);

      if (erroUpload) throw erroUpload;

      const { data: urlPublica } = supabaseClient
        .storage
        .from('fotos-filiados')
        .getPublicUrl(nomeArquivo);

      atualizacao.foto_url = urlPublica.publicUrl;
    }

    const { error } = await supabaseClient
      .from('filiados')
      .update(atualizacao)
      .eq('id', idFiliado);

    if (error) throw error;

    mostrarMensagem('Alterações salvas com sucesso.', 'sucesso');
    carregarHistorico();
  } catch (erro) {
    console.error(erro);
    mostrarMensagem('Não foi possível salvar as alterações.', 'erro');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar alterações';
  }
});

document.getElementById('btn-sair').addEventListener('click', sair);

document.getElementById('btn-copiar-link').addEventListener('click', async (evento) => {
  const input = document.getElementById('link-carteirinha');
  if (!input.value) return;
  await navigator.clipboard.writeText(input.value);
  const botao = evento.target;
  const textoOriginal = botao.textContent;
  botao.textContent = 'Copiado!';
  setTimeout(() => { botao.textContent = textoOriginal; }, 1500);
});

(async () => {
  const sessao = await exigirSessao();
  if (!sessao) return;
  if (!idFiliado) {
    mostrarMensagem('Nenhum filiado selecionado.', 'erro');
    form.style.display = 'none';
    return;
  }
  await carregarFiliado();
  await carregarHistorico();
})();
