// Read-only diagnostic. Reports column metadata, never credentials or user rows.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Backend Supabase configuration is missing.');
const response = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Schema request failed: HTTP ${response.status}`);
const schema = await response.json();
for (const table of ['rooms', 'room_members', 'room_groups', 'room_group_members', 'positions', 'transactions', 'chart_drawings']) {
  console.log(table, Object.entries(schema.definitions?.[table]?.properties || {}).map(([name, field]) => `${name}:${field.format || field.type}`).join(', '));
  if (table === 'chart_drawings') {
    console.log('chart_drawings required:', (schema.definitions?.[table]?.required || []).join(', '));
  }
}
console.log('Trading RPCs:', Object.keys(schema.paths || {}).filter((path) => /\/rpc\/.*(trade|portfolio)/.test(path)));
const drawingConflictParameter = schema.paths?.['/chart_drawings']?.post?.parameters
  ?.find((parameter) => parameter.name === 'on_conflict');
console.log('chart_drawings conflict targets:', drawingConflictParameter?.schema?.enum || []);

const drawingCountResponse = await fetch(`${url}/rest/v1/chart_drawings?select=id`, {
  method: 'HEAD',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'count=exact',
  },
  signal: AbortSignal.timeout(15000),
});
if (!drawingCountResponse.ok) {
  throw new Error(`chart_drawings count request failed: HTTP ${drawingCountResponse.status}`);
}
console.log('chart_drawings rows:', drawingCountResponse.headers.get('content-range') || 'unknown');
