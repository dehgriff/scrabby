const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

export function createDefinitionLookup(fetcher = fetch) {
  const cache = new Map();
  return async (word, { signal } = {}) => {
    const key = word.toLowerCase();
    if (!/^[a-z]{2,12}$/.test(key)) throw new Error('Choose a complete word first.');
    if (cache.has(key)) return cache.get(key);
    const response = await fetcher(API + encodeURIComponent(key), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    const data = await response.json();
    if (response.status === 404 || data?.title === 'No Definitions Found') {
      const result = { found: false, entries: [] };
      cache.set(key, result);
      return result;
    }
    if (!response.ok) throw new Error('The dictionary service could not complete this request.');
    if (!Array.isArray(data)) throw new Error('The dictionary service returned an unexpected response.');
    const entries = data.map(entry => ({
      phonetic: entry.phonetic || entry.phonetics?.find(item => item.text)?.text || '',
      meanings: (Array.isArray(entry.meanings) ? entry.meanings : []).map(meaning => ({
        partOfSpeech: meaning.partOfSpeech || 'Meaning',
        definitions: (Array.isArray(meaning.definitions) ? meaning.definitions : []).filter(item => typeof item.definition === 'string' && item.definition.trim()),
      })).filter(meaning => meaning.definitions.length),
      sourceUrls: Array.isArray(entry.sourceUrls) ? entry.sourceUrls : [],
      license: entry.license,
    })).filter(entry => entry.meanings.length);
    const result = { found: entries.length > 0, entries };
    cache.set(key, result);
    return result;
  };
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function safeLink(url, text) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const link = element('a', text);
    link.href = parsed.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  } catch { return null; }
}

export class DefinitionDialog {
  constructor() {
    this.lookup = createDefinitionLookup();
    this.dialog = document.getElementById('definition-dialog');
    this.content = document.getElementById('definition-content');
    this.version = 0;
    document.getElementById('definition-close').onclick = () => this.dialog.close();
    this.dialog.addEventListener('close', () => { this.version++; this.controller?.abort(); });
    this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.dialog.close(); });
  }

  async open(word, validate) {
    this.controller?.abort();
    const version = ++this.version;
    const controller = this.controller = new AbortController();
    document.getElementById('definition-word').textContent = word.toUpperCase();
    this.content.replaceChildren(element('p', 'Loading definition…', 'definition-message'));
    this.content.setAttribute('aria-busy', 'true');
    if (!this.dialog.open) this.dialog.showModal();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      if (validate && !await validate(controller.signal)) {
        if (version === this.version) this.content.replaceChildren(element('p', 'This word is not in Scrabby’s allowed word lists.', 'definition-message'));
        return;
      }
      if (version !== this.version || !this.dialog.open) return;
      const result = await this.lookup(word, { signal: controller.signal });
      if (version !== this.version || !this.dialog.open) return;
      if (!result.found) {
        this.content.replaceChildren(element('p', `No definition found for ${word.toUpperCase()}.`, 'definition-message'), element('p', 'The definition service has a different dictionary. This does not change whether Scrabby allows the word.', 'definition-note'));
        return;
      }
      this.content.replaceChildren();
      for (const entry of result.entries) {
        const section = element('section', undefined, 'definition-entry');
        if (entry.phonetic) section.append(element('p', entry.phonetic, 'definition-phonetic'));
        for (const meaning of entry.meanings) {
          section.append(element('h3', meaning.partOfSpeech));
          const list = element('ol');
          for (const definition of meaning.definitions) {
            const item = element('li');
            item.append(element('p', definition.definition));
            if (typeof definition.example === 'string' && definition.example) item.append(element('p', definition.example, 'definition-example'));
            if (Array.isArray(definition.synonyms) && definition.synonyms.length) item.append(element('p', `Synonyms: ${definition.synonyms.join(', ')}`, 'definition-note'));
            list.append(item);
          }
          section.append(list);
        }
        const credits = element('p', undefined, 'definition-note definition-sources');
        for (const url of [...new Set(entry.sourceUrls)]) {
          const link = safeLink(url, 'Source');
          if (link) credits.append(link);
        }
        if (entry.license?.url && entry.license?.name) {
          const link = safeLink(entry.license.url, entry.license.name);
          if (link) credits.append(link);
        }
        if (credits.children.length) section.append(credits);
        this.content.append(section);
      }
    } catch {
      if (version !== this.version || !this.dialog.open) return;
      const retry = element('button', 'Try again', 'reject-button');
      retry.onclick = () => this.open(word, validate);
      this.content.replaceChildren(element('p', 'Could not load the definition. Check your connection or try again shortly.', 'definition-message'), retry);
    } finally {
      clearTimeout(timeout);
      if (version === this.version) this.content.setAttribute('aria-busy', 'false');
    }
  }
}
