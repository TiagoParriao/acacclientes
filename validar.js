const rotulosSituacao = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  pendente: 'Pendente de aprovação',
};

const leitorDiv = document.getElementById('leitor-qr');
const resultado = document.getElementById('resultado');
const erroResultado = document.getElementById('erro-resultado');
const btnNovaLeitura = document.getElementById('btn-nova-leitura');

let leitor;
let processando = false;

function extrairToken(textoLido) {
  const texto = textoLido.trim();
  try {
    const url = new URL(texto);
    return url.searchParams.get('token') || texto;
  } catch {
    return texto;
  }
}

async function mostrarResultado(token) {
  resultado.style.display = 'none';
  erroResultado.style.display = 'none';

  const { data, error } = await supabaseClient.rpc('consultar_por_token', { p_token: token });

  if (error || !data || data.length === 0) {
    erroResultado.textContent = 'Filiado não encontrado. Verifique o QR code.';
    erroResultado.style.display = 'block';
    return;
  }

  const filiado = data[0];

  document.getElementById('foto-resultado').src = filiado.foto_url || '';
  document.getElementById('nome-resultado').textContent = filiado.nome;
  document.getElementById('empresa-resultado').textContent = filiado.empresa;

  const badge = document.getElementById('situacao-resultado');
  badge.className = 'situacao-badge';
  badge.classList.add(filiado.situacao);
  badge.textContent = rotulosSituacao[filiado.situacao] || filiado.situacao;

  resultado.style.display = 'block';

  supabaseClient.rpc('registrar_validacao', { p_token: token, p_origem: 'web' }).then(() => {}, () => {});
}

async function aoLerCodigo(textoDecodificado) {
  if (processando) return;
  processando = true;

  await leitor.pause(true);
  leitorDiv.style.display = 'none';
  btnNovaLeitura.style.display = 'block';
  btnNovaLeitura.textContent = 'Ler outro QR code';

  await mostrarResultado(extrairToken(textoDecodificado));
}

function iniciarLeitor() {
  leitorDiv.style.display = 'block';
  leitor = new Html5Qrcode('leitor-qr');
  leitor.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    aoLerCodigo
  ).catch(() => {
    erroResultado.textContent = 'Não foi possível acessar a câmera. Verifique as permissões do navegador.';
    erroResultado.style.display = 'block';
  });
}

btnNovaLeitura.addEventListener('click', () => {
  processando = false;
  resultado.style.display = 'none';
  erroResultado.style.display = 'none';
  btnNovaLeitura.style.display = 'none';

  if (leitor) {
    leitorDiv.style.display = 'block';
    leitor.resume();
  } else {
    iniciarLeitor();
  }
});

// Se o QR foi lido pela câmera nativa do celular (fora do site), o link já vem
// com o token na URL — mostramos o resultado direto, sem precisar abrir a câmera de novo.
const tokenDaUrl = new URLSearchParams(window.location.search).get('token');
if (tokenDaUrl) {
  leitorDiv.style.display = 'none';
  btnNovaLeitura.style.display = 'block';
  btnNovaLeitura.textContent = 'Ler outro QR code pela câmera';
  mostrarResultado(tokenDaUrl);
} else {
  iniciarLeitor();
}
