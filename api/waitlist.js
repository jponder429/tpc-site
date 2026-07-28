// /api/waitlist.js
// Receives waitlist form submissions and writes them to the
// "Women's Alliance Waitlist" database in Notion.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name,
    email,
    firm,
    role,
    specialty,
    motivations,        // object: { "label text": true/false }
    enterpriseInterest, // boolean
    consent,             // boolean
  } = req.body;

  // Basic required-field validation, mirrors the required fields in the form
  if (!name || !email || !role || !specialty || !consent) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Convert the { label: true/false } motivations map into an array of
  // checked labels, since Notion's multi_select wants a plain array.
  const motivationList = motivations
    ? Object.keys(motivations).filter((label) => motivations[label])
    : [];

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_WAITLIST_DB_ID;

  try {
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          'Name': { title: [{ text: { content: name } }] },
          'Email': { email: email },
          'Company': firm ? { rich_text: [{ text: { content: firm } }] } : undefined,
          'Role': role ? { select: { name: role } } : undefined,
          'Specialty': specialty ? { select: { name: specialty } } : undefined,
          'Motivations': motivationList.length
            ? { multi_select: motivationList.map((m) => ({ name: m })) }
            : undefined,
          'Enterprise Interest': { checkbox: !!enterpriseInterest },
          'Consent': { checkbox: !!consent },
          'Submitted At': { date: { start: new Date().toISOString() } },
        },
      }),
    });

    if (!notionRes.ok) {
      const errBody = await notionRes.text();
      console.error('Notion API error:', errBody);
      return res.status(502).json({ error: 'Failed to save signup' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Waitlist submission error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
