// Função para buscar os dados da planilha
async function buscarDadosFuncionario(id) {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSoSBfejYlmhKND9UJtMB9viPf3RobudQNZEFZ30ZrveGv02gp9DjDx3gUWujNH3W1XfojjiVOhKQgH/pub?gid=1212030209&single=true&output=csv';
    const response = await fetch(url);
    const data = await response.text();

    // Converte o CSV em um array de objetos
    const linhas = data.split('\n');
    const cabecalho = linhas[0].split(','); // Pega o cabeçalho
    const dados = linhas.slice(1); // Remove o cabeçalho

    // Mapeia os dados para um array de objetos
    const funcionarios = dados.map(linha => {
        const valores = linha.split(',');
        const funcionario = {};
        cabecalho.forEach((coluna, index) => {
            funcionario[coluna.trim()] = valores[index] ? valores[index].trim() : '';
        });
        return funcionario;
    });

    // Encontra o funcionário pelo ID
    const funcionario = funcionarios.find(f => f['ID:'] === id);

    if (funcionario) {
        // Preenche os campos da página
        document.getElementById('fotoFuncionario').src = funcionario['Foto de Identificação (3x4)'];
        document.getElementById('empresa').textContent = funcionario['Nome da Empresa:'];
        document.getElementById('nome').textContent = funcionario['Nome Completo:'];
        document.getElementById('cpf').textContent = funcionario['CPF:'];
        document.getElementById('dataNascimento').textContent = funcionario['Data de Nascimento:'];
        document.getElementById('situacao').textContent = funcionario['Situação:'];
    } else {
        alert('Funcionário não encontrado!');
    }
}

// Pega o ID da URL e busca os dados
const idFuncionario = new URLSearchParams(window.location.search).get('id');
if (idFuncionario) {
    buscarDadosFuncionario(idFuncionario);
} else {
    alert('ID do funcionário não fornecido!');
}