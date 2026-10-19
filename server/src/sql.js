const snake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/**
 * Builds INSERT/UPDATE statements from a zod-validated object. Column names come from the
 * schema's own keys (never from request input), values are always bound parameters.
 * Arrays/objects listed in `json` are sent as jsonb; everything else is passed through.
 */
function entries(data, json = []) {
  return Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [snake(k), json.includes(k) ? JSON.stringify(v) : v]);
}

export function insertSql(table, data, json) {
  const e = entries(data, json);
  return {
    text: `INSERT INTO ${table} (${e.map(([c]) => c).join(',')}) VALUES (${e.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    params: e.map(([, v]) => v),
  };
}

export function updateSql(table, id, data, { json, touch = true } = {}) {
  const e = entries(data, json);
  if (!e.length) return null;
  return {
    text: `UPDATE ${table} SET ${e.map(([c], i) => `${c} = $${i + 1}`).join(',')}${touch ? ', updated_at = now()' : ''} WHERE id = $${e.length + 1} RETURNING *`,
    params: [...e.map(([, v]) => v), id],
  };
}
