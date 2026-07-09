const normalizeValue = (value) => `${value ?? ''}`.replace(/\s+/g, ' ').trim();

const hasValue = (value) => {
  const normalized = normalizeValue(value).toLowerCase();
  return Boolean(normalized) && normalized !== 'n/a' && normalized !== 'na' && normalized !== 'none';
};

const getYear = (book = {}) => {
  const copyrightMatch = normalizeValue(book.copyright).match(/\b(1[89]\d{2}|20\d{2}|21\d{2})\b/);

  if (copyrightMatch) {
    return copyrightMatch[1];
  }

  const inventoryYear = Array.isArray(book.inventoryYears) ? book.inventoryYears[0] : book.inventoryYears;
  const inventoryMatch = normalizeValue(inventoryYear).match(/\b(1[89]\d{2}|20\d{2}|21\d{2})\b/);

  return inventoryMatch ? inventoryMatch[1] : 'n.d.';
};

const splitAuthor = (author) => {
  const cleaned = normalizeValue(author);

  if (!hasValue(cleaned)) {
    return null;
  }

  if (/et\.?\s*al\.?/i.test(cleaned) || cleaned.includes(';') || cleaned.includes('&') || /\band\b/i.test(cleaned)) {
    return {
      display: cleaned,
      surname: '',
      given: '',
      invertible: false
    };
  }

  if (cleaned.includes(',')) {
    const [surname, ...rest] = cleaned.split(',');

    return {
      display: cleaned,
      surname: normalizeValue(surname),
      given: normalizeValue(rest.join(' ')),
      invertible: true
    };
  }

  const segments = cleaned.split(' ').filter(Boolean);

  if (segments.length === 1) {
    return {
      display: cleaned,
      surname: cleaned,
      given: '',
      invertible: true
    };
  }

  const surname = segments[segments.length - 1];
  const given = segments.slice(0, -1).join(' ');

  return {
    display: cleaned,
    surname,
    given,
    invertible: true
  };
};

const getInitials = (name) => normalizeValue(name)
  .split(' ')
  .filter(Boolean)
  .map((segment) => `${segment.charAt(0).toUpperCase()}.`)
  .join(' ');

const formatApaAuthor = (author) => {
  const parsed = splitAuthor(author);

  if (!parsed) {
    return '';
  }

  if (!parsed.invertible) {
    return parsed.display;
  }

  const initials = getInitials(parsed.given);

  return initials ? `${parsed.surname}, ${initials}` : parsed.surname;
};

const formatMlaAuthor = (author) => {
  const parsed = splitAuthor(author);

  if (!parsed) {
    return '';
  }

  if (!parsed.invertible) {
    return parsed.display;
  }

  return parsed.given ? `${parsed.surname}, ${parsed.given}` : parsed.surname;
};

const formatChicagoAuthor = (author) => formatMlaAuthor(author);

const formatHarvardAuthor = (author) => {
  const parsed = splitAuthor(author);

  if (!parsed) {
    return '';
  }

  if (!parsed.invertible) {
    return parsed.display;
  }

  const initials = getInitials(parsed.given).replace(/\s+/g, ' ');

  return initials ? `${parsed.surname}, ${initials}` : parsed.surname;
};

const buildEditionVolumeParts = (book = {}) => {
  const details = [];

  if (hasValue(book.edition)) {
    details.push(normalizeValue(book.edition));
  }

  if (hasValue(book.volume)) {
    details.push(`Vol. ${normalizeValue(book.volume)}`);
  }

  return details;
};

const joinSegments = (...segments) => segments
  .map((segment) => normalizeValue(segment))
  .filter(Boolean)
  .join(' ');

const withTrailingPeriod = (value) => {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return '';
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const formatApaCitation = (book) => {
  const author = formatApaAuthor(book.author);
  const year = getYear(book);
  const title = normalizeValue(book.title) || 'Untitled book';
  const details = buildEditionVolumeParts(book);
  const publisher = hasValue(book.publisher) ? normalizeValue(book.publisher) : '';
  const titleBlock = details.length > 0 ? `${title} (${details.join(', ')}).` : `${title}.`;

  if (author) {
    return joinSegments(withTrailingPeriod(author), `(${year}).`, titleBlock, withTrailingPeriod(publisher));
  }

  return joinSegments(withTrailingPeriod(title), `(${year}).`, withTrailingPeriod(publisher));
};

const formatMlaCitation = (book) => {
  const author = formatMlaAuthor(book.author);
  const title = normalizeValue(book.title) || 'Untitled book';
  const year = getYear(book);
  const details = buildEditionVolumeParts(book).join(', ');
  const publisher = hasValue(book.publisher) ? normalizeValue(book.publisher) : '';
  const tail = [details, publisher, year].filter(Boolean).join(', ');

  if (author) {
    return joinSegments(withTrailingPeriod(author), withTrailingPeriod(title), withTrailingPeriod(tail));
  }

  return joinSegments(withTrailingPeriod(title), withTrailingPeriod(tail));
};

const formatChicagoCitation = (book) => {
  const author = formatChicagoAuthor(book.author);
  const title = normalizeValue(book.title) || 'Untitled book';
  const year = getYear(book);
  const details = buildEditionVolumeParts(book);
  const publisher = hasValue(book.publisher) ? normalizeValue(book.publisher) : '';
  const place = hasValue(book.placeOfPublication) ? normalizeValue(book.placeOfPublication) : '';
  const publicationBlock = [place, publisher].filter(Boolean).join(': ');
  const tail = [publicationBlock, year].filter(Boolean).join(', ');
  const titleBlock = details.length > 0 ? `${title}. ${details.join(', ')}.` : `${title}.`;

  if (author) {
    return joinSegments(withTrailingPeriod(author), titleBlock, withTrailingPeriod(tail));
  }

  return joinSegments(titleBlock, withTrailingPeriod(tail));
};

const formatHarvardCitation = (book) => {
  const author = formatHarvardAuthor(book.author);
  const year = getYear(book);
  const title = normalizeValue(book.title) || 'Untitled book';
  const details = buildEditionVolumeParts(book).join(', ');
  const publisher = hasValue(book.publisher) ? normalizeValue(book.publisher) : '';
  const citationTail = [details, publisher].filter(Boolean).join(', ');

  if (author) {
    return joinSegments(`${author} ${year},`, title, citationTail ? `${citationTail}.` : '');
  }

  return joinSegments(withTrailingPeriod(title), withTrailingPeriod(publisher), year !== 'n.d.' ? `${year}.` : '');
};

export const CITATION_FORMATS = [
  { value: 'apa', label: 'APA 7th' },
  { value: 'mla', label: 'MLA 9th' },
  { value: 'chicago', label: 'Chicago' },
  { value: 'harvard', label: 'Harvard' }
];

export const generateBookCitation = (book, format = 'apa') => {
  if (!book) {
    return '';
  }

  switch (format) {
    case 'mla':
      return formatMlaCitation(book);
    case 'chicago':
      return formatChicagoCitation(book);
    case 'harvard':
      return formatHarvardCitation(book);
    case 'apa':
    default:
      return formatApaCitation(book);
  }
};
