export const DateUtils = {
  DATE_PATTERN: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  
  extract(text, prefix, isMarkdown = false) {
    if (!text) return null;
    const escPrefix = isMarkdown ? prefix.replace(/\*/g, '\\*') : prefix;
    const pattern = new RegExp(`${escPrefix}\\s*${this.DATE_PATTERN.source}`, 'i');
    return text.match(pattern)?.[1] ?? null;
  },

  parseContent(text) {
    if (!text) return null;
    const start = this.extract(text, 'Start:');
    const end = this.extract(text, 'End:');
    return start && end ? { start, end } : null;
  },

  parseEmbed(embed) {
    const timeValue = embed?.fields?.find(f => f.name === 'Time')?.value;
    if (!timeValue) return null;
    const start = this.extract(timeValue, '**Start:**', true);
    const end = this.extract(timeValue, '**End:**', true);
    return start && end ? { start, end } : null;
  }
};

export function parseLoaText(text) {
  if (!text) return null;
  const parsed = DateUtils.parseContent(text);
  if (parsed) return parsed;
  const start = DateUtils.extract(text, 'Start:');
  const end = DateUtils.extract(text, 'End:');
  return start && end ? { start, end } : null;
}

export function parseLoaEmbed(embed) {
  if (!embed) return null;
  const parsed = DateUtils.parseEmbed(embed);
  if (parsed) return parsed;
  const desc = embed.description ?? '';
  const start = DateUtils.extract(desc, 'Start:');
  const end = DateUtils.extract(desc, 'End:');
  return start && end ? { start, end } : null;
}

export function parseTrainingText(text) {
  if (!text) return null;
  text = text.replace(/\s+/g, ' ').trim(); // spaces :)

  const rankMatch = text.match(/rank:\s*([^Training:Availability:]*?)(?=Training:|Availability:|$)/i);
  const trainingMatch = text.match(/training:\s*([^Availability:]*?)(?=Availability:|$)/i);
  const availabilityMatch = text.match(/availability:\s*(.*)/i);

  const rank = rankMatch ? rankMatch[1].trim() : '';
  const training = trainingMatch ? trainingMatch[1].trim() : '';
  const availability = availabilityMatch ? availabilityMatch[1].trim() : '';

  if (rank && training && availability) {
    return { rank, training, availability };
  }
  return null;
}

export function parseDate(str) {
  let [m, d, y] = str.split('/').map(Number);
  if (y < 100) y += 2000;
  return new Date(y, m-1, d);
}