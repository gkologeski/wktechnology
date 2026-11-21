/** Quote data independently of the fixed PostgREST filter grammar. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/["\\]/g, (character) => `\\${character}`)}"`;
}

export function orIlikeContains(term: string): string {
  return quotePostgrestValue(`%${escapeLikePattern(term)}%`);
}
