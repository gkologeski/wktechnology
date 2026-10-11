import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, "../../.techerp-isolated.local");
let source = readFileSync(resolve(dir, "stack/sdk-e2e.ts"), "utf8");
function replaceSection(start, end, value) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error("O teste original mudou; adaptação precisa de revisão.");
  source = source.slice(0, a) + value + source.slice(b);
}
replaceSection(
  "const port =",
  "function psql(sql: string)",
  `const status = JSON.parse(readFileSync(root + '/status.private.json', 'utf8'));
const URL_ = status.API_URL;
if (URL_ !== 'http://127.0.0.1:54321' && URL_ !== 'http://localhost:54321') throw new Error('API fora do ambiente local');
const anonKey = status.ANON_KEY;
if (!anonKey) throw new Error('Chave anon local ausente');
\n`,
);
source = source.replace("mkdirSync, writeFileSync", "mkdirSync, writeFileSync, readFileSync");
replaceSection(
  "  const r = spawnSync(",
  "  if (r.status !== 0)",
  `  const r = spawnSync('docker', ['exec', '-i', 'supabase_db_techerp-isolated.local',
    'psql', '-X', '-qtA', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    { env, input: sql, encoding: 'utf8', timeout: 30000 });
`,
);
source = source.replace(
  '() => count(s[7], "chat_messages"), "1"',
  '() => count(s[7], "chat_messages", ["id", "5a000000-0000-4000-8000-0000000000a1"]), "1"',
);
const rt =
  readFileSync(resolve(dir, "mac-permissions.fragment.inc"), "utf8") +
  "\n" +
  readFileSync(resolve(dir, "mac-realtime.fragment.inc"), "utf8");
replaceSection(
  "for (const [id, why] of [",
  "const pass =",
  rt +
    `
for (const [id, why] of [
 ['rt-delete-event', 'Sem validação da reconciliação de DELETE na aplicação'],
 ['ui-event-to-screen', 'Aplicação ainda não conectada ao ambiente local'],
 ['view-as-gotrue-session', 'Servidor do app ainda não conectado ao ambiente local'],
] as const) results.push({id, area:'realtime/ui', status:'not_executed', detail:why, why});
for (const client of [...Object.values(s), s5]) {
 await client.removeAllChannels();
 await client.auth.signOut();
}
\n`,
);
source = source.replace(
  'const root = process.env.ISO_ROOT ?? "/tmp/techerp-stack";',
  `const root = process.env.ISO_ROOT;
if (!root || !root.endsWith('/.techerp-isolated.local')) throw new Error('Diretório isolado obrigatório');
const watchdog = setTimeout(() => { console.error('Tempo limite dos testes atingido; execução incompleta.'); process.exit(2); }, 240000);
process.on('exit', () => clearTimeout(watchdog));`,
);
source = source.replace(
  "root+'/../src/lib/realtime/invalidation-batcher.ts'",
  JSON.stringify(resolve(dir, "../../src/lib/realtime/invalidation-batcher.ts")),
);
writeFileSync(resolve(root, "mac-sdk-e2e.ts"), source);
console.log("Testes preparados para a stack local.");
