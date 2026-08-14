#!/usr/bin/env node
// Reprocessa fotos que falharam na importação inicial (foto_url nulo),
// tentando de novo com um User-Agent de navegador (o Drive às vezes bloqueia
// requisições automatizadas sem esse cabeçalho).
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const caminhoXlsx = path.join(__dirname, '..', '..', 'ACAC FORMULÁRIO (OFICIAL).xlsx');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function baixarFotoComUA(urlFoto) {
  const resposta = await fetch(urlFoto, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  if (!resposta.ok) return null;
  const tipo = resposta.headers.get('content-type') || '';
  if (!tipo.startsWith('image/')) return null;
  const buffer = Buffer.from(await resposta.arrayBuffer());
  return { buffer, tipo };
}

async function main() {
  const workbook = XLSX.readFile(caminhoXlsx);
  const linhas = XLSX.utils.sheet_to_json(workbook.Sheets['Formulário 01'], { defval: '' });

  const { data: semFoto, error } = await supabase
    .from('filiados')
    .select('id, nome, cnpj')
    .is('foto_url', null);

  if (error) {
    console.error('Erro ao buscar filiados sem foto:', error.message);
    process.exit(1);
  }

  console.log(`${semFoto.length} filiados sem foto. Tentando de novo com User-Agent de navegador...\n`);

  let sucesso = 0;
  let falha = 0;

  for (const filiado of semFoto) {
    const linha = linhas.find((l) => (l['CNPJ:'] || '').toString().trim() === filiado.cnpj);
    const urlFotoOriginal = linha ? (linha['Foto de Identificação (3x4)'] || '').toString().trim() : '';

    if (!urlFotoOriginal) {
      console.warn(`  [pulado] ${filiado.nome}: não achei o link original na planilha.`);
      falha++;
      continue;
    }

    const foto = await baixarFotoComUA(urlFotoOriginal);
    if (!foto) {
      console.warn(`  [falhou de novo] ${filiado.nome}`);
      falha++;
      continue;
    }

    const extensao = foto.tipo.includes('png') ? 'png' : 'jpg';
    const caminhoStorage = `importados/${randomUUID()}.${extensao}`;
    const { error: erroUpload } = await supabase
      .storage
      .from('fotos-filiados')
      .upload(caminhoStorage, foto.buffer, { contentType: foto.tipo });

    if (erroUpload) {
      console.warn(`  [erro upload] ${filiado.nome}: ${erroUpload.message}`);
      falha++;
      continue;
    }

    const { data: urlPublica } = supabase.storage.from('fotos-filiados').getPublicUrl(caminhoStorage);

    const { error: erroUpdate } = await supabase
      .from('filiados')
      .update({ foto_url: urlPublica.publicUrl })
      .eq('id', filiado.id);

    if (erroUpdate) {
      console.warn(`  [erro update] ${filiado.nome}: ${erroUpdate.message}`);
      falha++;
      continue;
    }

    console.log(`  [ok] ${filiado.nome}`);
    sucesso++;
  }

  console.log(`\nConcluído: ${sucesso} recuperadas, ${falha} continuam sem foto.`);
}

main();
