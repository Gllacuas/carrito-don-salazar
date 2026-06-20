const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID  = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: devuelve todos los registros ─────────────────────────────
    if (req.method === 'GET') {
      let all = [], cursor;
      do {
        const r = await notion.databases.query({
          database_id: DB_ID,
          sorts: [{ property: 'Fecha', direction: 'ascending' }],
          start_cursor: cursor,
          page_size: 100,
        });
        all = all.concat(r.results);
        cursor = r.has_more ? r.next_cursor : null;
      } while (cursor);

      const entries = all.map(p => ({
        id:          p.id,
        fecha:       p.properties.Fecha?.date?.start        || '',
        responsable: p.properties.Responsable?.select?.name || '',
        turno:       p.properties.Turno_Hora?.select?.name  || '',
        visa:        p.properties.VISA?.number               ?? 0,
        efectivo:    p.properties.Efectivo?.number           ?? 0,
        total:       p.properties.Total?.formula?.number     ?? 0,
        nota:        p.properties.Nota?.rich_text?.[0]?.plain_text || '',
      }));

      return res.json({ entries });
    }

    // ── POST: crea un nuevo registro ──────────────────────────────────
    if (req.method === 'POST') {
      const { fecha, responsable, turno, visa, efectivo, nota } = req.body;

      if (!fecha || !responsable || !turno) {
        return res.status(400).json({ error: 'Fecha, Responsable y Turno son obligatorios.' });
      }

      const page = await notion.pages.create({
        parent: { database_id: DB_ID },
        properties: {
          'Turno': {
            title: [{ text: { content: `${responsable} · ${turno} · ${fecha}` } }]
          },
          'Fecha':      { date:   { start: fecha } },
          'Responsable':{ select: { name: responsable } },
          'Turno_Hora': { select: { name: turno } },
          'VISA':       { number: parseFloat(visa)      || 0 },
          'Efectivo':   { number: parseFloat(efectivo)  || 0 },
          'Nota':       { rich_text: nota ? [{ text: { content: nota } }] : [] },
        },
      });

      return res.json({ success: true, id: page.id });
    }

    res.status(405).json({ error: 'Método no permitido.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
