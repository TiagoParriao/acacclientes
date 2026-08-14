// Cria o client do Supabase a partir das variáveis definidas em config.js.
// Deve ser carregado depois da lib supabase-js (CDN) e depois de config.js.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
