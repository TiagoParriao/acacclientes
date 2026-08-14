const form = document.getElementById('form-cadastro');
const btnEnviar = document.getElementById('btn-enviar');
const mensagem = document.getElementById('mensagem');

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
  mensagem.style.display = 'block';
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';
  mensagem.style.display = 'none';

  const nome = document.getElementById('nome').value.trim();
  const empresa = document.getElementById('empresa').value.trim();
  const cnpj = document.getElementById('cnpj').value.trim();
  const arquivoFoto = document.getElementById('foto').files[0];

  try {
    const extensao = arquivoFoto.name.split('.').pop();
    const nomeArquivo = `pendentes/${crypto.randomUUID()}.${extensao}`;

    const { error: erroUpload } = await supabaseClient
      .storage
      .from('fotos-filiados')
      .upload(nomeArquivo, arquivoFoto);

    if (erroUpload) throw erroUpload;

    const { data: urlPublica } = supabaseClient
      .storage
      .from('fotos-filiados')
      .getPublicUrl(nomeArquivo);

    const { error: erroInsert } = await supabaseClient
      .from('filiados')
      .insert({
        nome,
        empresa,
        cnpj,
        foto_url: urlPublica.publicUrl,
        situacao: 'pendente',
      });

    if (erroInsert) throw erroInsert;

    form.reset();
    mostrarMensagem('Cadastro enviado com sucesso! Aguarde a aprovação da associação.', 'sucesso');
  } catch (erro) {
    console.error(erro);
    mostrarMensagem('Não foi possível enviar seu cadastro. Tente novamente em instantes.', 'erro');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar cadastro';
  }
});
