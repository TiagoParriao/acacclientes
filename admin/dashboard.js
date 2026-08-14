const rotulosSituacao = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  pendente: 'Pendente',
};

const corpoTabela = document.getElementById('corpo-tabela');
const tabela = document.getElementById('tabela-filiados');
const carregando = document.getElementById('carregando');
const listaVazia = document.getElementById('lista-vazia');
const inputBusca = document.getElementById('busca');
const selectSituacao = document.getElementById('filtro-situacao');

let todosFiliados = [];

function renderizarTabela() {
  const termo = inputBusca.value.trim().toLowerCase();
  const situacao = selectSituacao.value;

  const filtrados = todosFiliados.filter((f) => {
    const bateBusca = !termo
      || f.nome.toLowerCase().includes(termo)
      || f.empresa.toLowerCase().includes(termo)
      || f.cnpj.toLowerCase().includes(termo);
    const bateSituacao = !situacao || f.situacao === situacao;
    return bateBusca && bateSituacao;
  });

  corpoTabela.innerHTML = '';

  if (filtrados.length === 0) {
    tabela.style.display = 'none';
    listaVazia.style.display = 'block';
    return;
  }

  listaVazia.style.display = 'none';
  tabela.style.display = 'table';

  for (const filiado of filtrados) {
    const linha = document.createElement('tr');

    const proximaSituacao = {
      pendente: 'ativo',
      ativo: 'inativo',
      inativo: 'ativo',
    }[filiado.situacao];

    const rotuloAcaoRapida = {
      pendente: 'Aprovar',
      ativo: 'Desativar',
      inativo: 'Ativar',
    }[filiado.situacao];

    linha.innerHTML = `
      <td>${escaparHtml(filiado.nome)}</td>
      <td>${escaparHtml(filiado.empresa)}</td>
      <td>${escaparHtml(filiado.cnpj)}</td>
      <td><span class="situacao-badge ${filiado.situacao}">${rotulosSituacao[filiado.situacao]}</span></td>
      <td>
        <div class="acoes-linha">
          <button class="btn btn-secundario btn-pequeno" data-acao="toggle" data-id="${filiado.id}" data-nova="${proximaSituacao}">${rotuloAcaoRapida}</button>
          <a class="btn btn-secundario btn-pequeno" href="editar.html?id=${filiado.id}">Editar</a>
        </div>
      </td>
    `;
    corpoTabela.appendChild(linha);
  }
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function carregarFiliados() {
  const { data, error } = await supabaseClient
    .from('filiados')
    .select('id, nome, empresa, cnpj, situacao')
    .order('criado_em', { ascending: false });

  carregando.style.display = 'none';

  if (error) {
    listaVazia.textContent = 'Erro ao carregar filiados. Verifique se seu usuário está cadastrado como admin.';
    listaVazia.style.display = 'block';
    return;
  }

  todosFiliados = data;
  renderizarTabela();
}

corpoTabela.addEventListener('click', async (evento) => {
  const botao = evento.target.closest('button[data-acao="toggle"]');
  if (!botao) return;

  botao.disabled = true;
  const id = botao.dataset.id;
  const novaSituacao = botao.dataset.nova;

  const { error } = await supabaseClient
    .from('filiados')
    .update({ situacao: novaSituacao })
    .eq('id', id);

  if (!error) {
    const filiado = todosFiliados.find((f) => f.id === id);
    filiado.situacao = novaSituacao;
    renderizarTabela();
  } else {
    botao.disabled = false;
  }
});

inputBusca.addEventListener('input', renderizarTabela);
selectSituacao.addEventListener('change', renderizarTabela);
document.getElementById('btn-sair').addEventListener('click', sair);

(async () => {
  const sessao = await exigirSessao();
  if (sessao) carregarFiliados();
})();
