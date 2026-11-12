// Keep the full lexicon intact; editable lists control two- and three-letter words.
export function prepareDictionary(sowpodsText, twoLetterText, threeLetterText) {
  const words = sowpodsText.trim().split(/\s+/).filter(Boolean);
  const shortWords = new Set(words.filter(word => word.length === 2 || word.length === 3));
  const allowed = new Set();
  for (const [length, text, filename] of [
    [2, twoLetterText, 'two-letter-words.txt'],
    [3, threeLetterText, 'three-letter-words.txt'],
  ]) {
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      const word = line.replace(/#.*$/, '').trim().toUpperCase();
      if (!word) continue;
      if (word.length !== length || !/^[A-Z]+$/.test(word) || !shortWords.has(word)) {
        throw new Error(`Invalid SOWPODS word in ${filename}, line ${i + 1}: ${word}`);
      }
      allowed.add(word);
    }
  }
  return words.filter(word => (word.length !== 2 && word.length !== 3) || allowed.has(word));
}
