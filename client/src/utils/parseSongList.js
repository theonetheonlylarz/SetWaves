// Parse a free-form pasted setlist into [{ title, artist }] rows.
// Accepts common separators (hyphen, en/em dash, " by ", tab) and ignores
// leading list numbering / bullets. Convention: "Title - Artist".

export function parseSongList(text) {
  if (!text || typeof text !== 'string') return []
  const rows = []
  const lines = text.split(/\r?\n/)

  const separators = [
    / — /,       // em-dash with spaces
    / – /,       // en-dash with spaces
    / - /,            // hyphen with spaces
    /\s+by\s+/i,      // " by "
    /\t/,             // tab
    / \| /,           // pipe with spaces
  ]

  for (const raw of lines) {
    let line = (raw || '').trim()
    if (!line) continue
    // Strip leading list numbering ("1.", "12)", "3:") or bullet ("-", "*", "•")
    line = line.replace(/^(\d+[\.\)\:]\s+|[-\*•]\s+)/, '').trim()
    if (!line) continue

    let title = line
    let artist = ''
    for (const sep of separators) {
      const match = line.match(sep)
      if (match) {
        const idx = line.indexOf(match[0])
        title = line.slice(0, idx).trim()
        artist = line.slice(idx + match[0].length).trim()
        break
      }
    }

    // Strip surrounding quotes from title and artist
    title = title.replace(/^["']|["']$/g, '').trim()
    artist = artist.replace(/^["']|["']$/g, '').trim()
    if (!title) continue

    rows.push({ title, artist })
  }
  return rows
}
