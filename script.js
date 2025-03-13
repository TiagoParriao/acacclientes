// Função para buscar os dados da planilha
async function buscarDadosFuncionario(id) {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSoSBfejYlmhKND9UJtMB9viPf3RobudQNZEFZ30ZrveGv02gp9DjDx3gUWujNH3W1XfojjiVOhKQgH/pub?gid=1212030209&single=true&output=csv';  // Substitua pela URL correta do arquivo CSV
    const response = await fetch(url);
    const data = await response.text();

    // Converte o CSV em um array de objetos
    const linhas = data.split('\n');
    const cabecalho = linhas[0].split(','); // Pega o cabeçalho da planilha
    const dados = linhas.slice(1); // Remove o cabeçalho para pegar os dados

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
    const funcionario = funcionarios.find(f => f['ID:'] === id);  // Aqui você busca pelo ID específico

    if (funcionario) {
        // Preenche os campos da página com os dados encontrados
        document.getElementById('Foto de Identificação (3x4)').src = funcionario['Foto de Identificação (3x4)'];
        document.getElementById('Nome da Empresa:').textContent = funcionario['Nome da Empresa:'];
        document.getElementById('Nome Completo:').textContent = funcionario['Nome Completo:'];
        document.getElementById('CNPJ:').textContent = funcionario['CNPJ:'];
        document.getElementById('Situação:').textContent = funcionario['Situação:'];
    } else {
        alert('Funcionário não encontrado!');
    }
}

// Pega o ID da URL e chama a função para buscar os dados
const idFuncionario = new URLSearchParams(window.location.search).get('id'); // Obtém o 'id' da URL
if (idFuncionario) {
    buscarDadosFuncionario(idFuncionario); // Chama a função passando o ID encontrado
} else {
    alert('ID do funcionário não fornecido!');
}
