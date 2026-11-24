/**
 * Word-wrapping for the monospace text face, where a line's width is its character count: used to
 * fit a status line into a narrow strip beside a panel.
 */

/**
 * `text` broken into lines of at most `maxChars` characters, at spaces where it can. A word longer
 * than a line is split across lines, so no line ever runs over. Runs of spaces count as one break, since an empty word splits into no pieces.
 *
 * @throws {Error} When `maxChars` is not a whole number of at least 1.
 */
export function wrapLines(text: string, maxChars: number): string[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new Error(`wrapLines needs a line length of at least 1 whole character; got ${maxChars}`);
  }
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    for (const piece of splitWord(word, maxChars)) {
      if (line.length === 0) line = piece;
      else if (line.length + 1 + piece.length <= maxChars) line = `${line} ${piece}`;
      else {
        lines.push(line);
        line = piece;
      }
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

/** `word` in pieces of at most `maxChars` characters. */
function splitWord(word: string, maxChars: number): string[] {
  const pieces: string[] = [];
  for (let start = 0; start < word.length; start += maxChars) pieces.push(word.slice(start, start + maxChars));
  return pieces;
}
