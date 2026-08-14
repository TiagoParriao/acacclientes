#!/usr/bin/env node
// Importa os cadastros existentes (planilha "ACAC FORMULÁRIO (OFICIAL).xlsx") para o Supabase.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar-cadastros.mjs --dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar-cadastros.mjs
//
// Por padrão lê "ACAC FORMULÁRIO (OFICIAL).xlsx" duas pastas acima deste script
// (a planilha NÃO fica dentro do repositório, para não versionar dados pessoais dos filiados).
// Use --arquivo=CAMINHO para apontar para outro lugar.

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dryRun = process.argv.includes('--dry-run');
const argArquivo = process.argv.find((a) => a.startsWith('--arquivo='));
const caminhoXlsx = argArquivo
  ? argArquivo.split('=').slice(1).join('=')
  : path.join(__dirname, '..', '..', 'ACAC FORMULÁRIO (OFICIAL).xlsx');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Defina as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar sem --dry-run.');
  console.error('(Encontre as duas em Project Settings > API no painel do Supabase. A service role key NUNCA deve ir para o front-end.)');
  process.exit(1);
}

const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizarSituacao(valor) {
  const v = (valor ?? '').toString().trim().toLowerCase();
  if (v === 'ativo') return 'ativo';
  if (v === 'inativo') return 'inativo';
  return 'pendente';
}

async function baixarFoto(urlFoto, nomeParaLog) {
  if (!urlFoto) return null;
  try {
    const resposta = await fetch(urlFoto);
    if (!resposta.ok) {
      console.warn(`  [aviso] não consegui baixar a foto de ${nomeParaLog} (status ${resposta.status})`);
      return null;
    }
    const tipo = resposta.headers.get('content-type') || 'image/jpeg';
    if (!tipo.startsWith('image/')) {
      console.warn(`  [aviso] link de foto de ${nomeParaLog} não retornou uma imagem (${tipo})`);
      return null;
    }
    const buffer = Buffer.from(await resposta.arrayBuffer());
    return { buffer, tipo };
  } catch (erro) {
    console.warn(`  [aviso] erro ao baixar foto de ${nomeParaLog}: ${erro.message}`);
    return null;
  }
}

async function main() {
  console.log(`Lendo planilha: ${caminhoXlsx}`);
  const workbook = XLSX.readFile(caminhoXlsx);
  const sheet = workbook.Sheets['Formulário 01'];
  if (!sheet) {
    console.error('Aba "Formulário 01" não encontrada na planilha.');
    process.exit(1);
  }
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`Encontrados ${linhas.length} cadastros na planilha.${dryRun ? ' (modo --dry-run, nada será gravado)' : ''}\n`);

  let importados = 0;
  let falhas = 0;

  for (const linha of linhas) {
    const nome = (linha['Nome Completo:'] || '').toString().trim();
    const empresa = (linha['Nome da Empresa:'] || '').toString().trim();
    const cnpj = (linha['CNPJ:'] || '').toString().trim();
    const situacao = normalizarSituacao(linha['Situação:']);
    const urlFotoOriginal = (linha['Foto de Identificação (3x4)'] || '').toString().trim();

    if (!nome || !cnpj) {
      console.warn(`  [pulado] linha sem nome ou CNPJ preenchido.`);
      falhas++;
      continue;
    }

    console.log(`- ${nome} (${empresa}) — situação: ${situacao}`);

    if (dryRun) {
      importados++;
      continue;
    }

    let fotoUrl = null;
    const foto = await baixarFoto(urlFotoOriginal, nome);
    if (foto) {
      const extensao = foto.tipo.includes('png') ? 'png' : 'jpg';
      const caminhoStorage = `importados/${randomUUID()}.${extensao}`;
      const { error: erroUpload } = await supabase
        .storage
        .from('fotos-filiados')
        .upload(caminhoStorage, foto.buffer, { contentType: foto.tipo });

      if (erroUpload) {
        console.warn(`  [aviso] falha ao subir foto de ${nome}: ${erroUpload.message}`);
      } else {
        const { data } = supabase.storage.from('fotos-filiados').getPublicUrl(caminhoStorage);
        fotoUrl = data.publicUrl;
      }
    }

    const { error: erroInsert } = await supabase
      .from('filiados')
      .insert({ nome, empresa, cnpj, situacao, foto_url: fotoUrl });

    if (erroInsert) {
      console.error(`  [erro] falha ao importar ${nome}: ${erroInsert.message}`);
      falhas++;
    } else {
      importados++;
    }
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}Concluído: ${importados} importados, ${falhas} com problema de ${linhas.length} linhas.`);
}

main();
