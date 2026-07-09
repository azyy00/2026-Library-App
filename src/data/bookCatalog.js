import * as XLSX from 'xlsx';

export const normalizeCatalogText = (value) => `${value || ''}`
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeSpace = (value) => `${value ?? ''}`.replace(/\s+/g, ' ').trim();
const sanitizeField = (value, fallback = 'N/A') => {
  const cleaned = normalizeSpace(value);
  return cleaned || fallback;
};
const pickFirst = (row, keys, fallback = '') => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = normalizeSpace(row[key]);

      if (value) {
        return value;
      }
    }
  }

  return fallback;
};
const uniqueValues = (values, fallback = 'N/A') => {
  const deduped = Array.from(
    new Set(
      values
        .map((value) => normalizeSpace(value))
        .filter((value) => value && normalizeCatalogText(value) !== 'n/a')
    )
  );

  return deduped.length > 0 ? deduped : [fallback];
};
const getYearFromSheetName = (sheetName) => {
  const match = `${sheetName}`.match(/(20\d{2})/);
  return match ? match[1] : `${sheetName}`;
};

export const CATALOG_SEARCH_FILTERS = [
  { value: 'smart', label: 'Smart search' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'subject', label: 'Subject' },
  { value: 'callno', label: 'Call No.' },
  { value: 'year', label: 'Inventory Year' }
];

const buildBookIndex = (book = {}) => {
  const subjects = Array.isArray(book.subjects)
    ? book.subjects
    : [book.subject1, book.subject2, book.subject3].filter(Boolean);
  const callNumbers = Array.isArray(book.callNumbers)
    ? book.callNumbers
    : [book.callNumber].filter(Boolean);
  const authorNumbers = Array.isArray(book.authorNumbers)
    ? book.authorNumbers
    : [book.authorNumber].filter(Boolean);
  const accessionNumbers = Array.isArray(book.accessionNumbers)
    ? book.accessionNumbers
    : normalizeSpace(book.accessionNumbers)
      ? normalizeSpace(book.accessionNumbers).split(',').map((value) => normalizeSpace(value)).filter(Boolean)
      : [];
  const inventoryYears = Array.isArray(book.inventoryYears)
    ? book.inventoryYears
    : normalizeSpace(book.inventoryYears)
      ? normalizeSpace(book.inventoryYears).split(',').map((value) => normalizeSpace(value)).filter(Boolean)
      : [];
  const normalizedTitle = normalizeCatalogText(book.title);
  const normalizedAuthor = normalizeCatalogText(book.author);
  const normalizedSubjects = subjects.map((subject) => normalizeCatalogText(subject));
  const normalizedCallNumbers = callNumbers.map((callNumber) => normalizeCatalogText(callNumber));
  const normalizedPublisher = normalizeCatalogText(book.publisher);
  const searchIndex = [
    normalizedTitle,
    normalizedAuthor,
    normalizedPublisher,
    ...normalizedSubjects,
    ...normalizedCallNumbers
  ].filter(Boolean).join(' ');

  return {
    ...book,
    copies: Number(book.copies) || 0,
    edition: book.edition || 'N/A',
    volume: book.volume || 'N/A',
    copyright: book.copyright || 'N/A',
    subjects: subjects.length > 0 ? subjects : ['N/A'],
    callNumbers: callNumbers.length > 0 ? callNumbers : [book.callNumber || 'N/A'],
    authorNumbers: authorNumbers.length > 0 ? authorNumbers : [book.authorNumber || 'N/A'],
    accessionNumbers: accessionNumbers.length > 0 ? accessionNumbers : ['N/A'],
    inventoryYears: inventoryYears.length > 0 ? inventoryYears : ['N/A'],
    publisher: book.publisher || 'N/A',
    placeOfPublication: book.placeOfPublication || book.place_of_publication || 'N/A',
    isbn: book.isbn || 'N/A',
    remarks: book.remarks || 'N/A',
    sourceOfFunds: book.sourceOfFunds || book.source_of_funds || 'N/A',
    normalizedTitle,
    normalizedAuthor,
    normalizedSubjects,
    normalizedCallNumbers,
    searchIndex
  };
};

export const buildCatalogIndex = (books = []) => books.map((book) => buildBookIndex(book));

const scoreCatalogBook = (book, normalizedQuery, tokens, filterMode = 'smart') => {
  if (!normalizedQuery) {
    return 0;
  }

  const inventoryYearIndex = (book.inventoryYears || []).map((year) => normalizeCatalogText(year));
  let score = 0;

  const addTitleScore = () => {
    if (book.normalizedTitle === normalizedQuery) {
      score += 240;
    } else if (book.normalizedTitle.startsWith(normalizedQuery)) {
      score += 180;
    } else if (book.normalizedTitle.includes(normalizedQuery)) {
      score += 120;
    }

    tokens.forEach((token) => {
      if (book.normalizedTitle.includes(token)) score += 24;
    });
  };

  const addAuthorScore = () => {
    if (book.normalizedAuthor === normalizedQuery) {
      score += 120;
    } else if (book.normalizedAuthor.includes(normalizedQuery)) {
      score += 70;
    }

    tokens.forEach((token) => {
      if (book.normalizedAuthor.includes(token)) score += 18;
    });
  };

  const addSubjectScore = () => {
    if (book.normalizedSubjects.some((subject) => subject.includes(normalizedQuery))) {
      score += 65;
    }

    tokens.forEach((token) => {
      if (book.normalizedSubjects.some((subject) => subject.includes(token))) score += 14;
    });
  };

  const addCallNumberScore = () => {
    if (book.normalizedCallNumbers.some((callNumber) => callNumber.includes(normalizedQuery))) {
      score += 40;
    }

    tokens.forEach((token) => {
      if (book.normalizedCallNumbers.some((callNumber) => callNumber.includes(token))) score += 10;
    });
  };

  const addYearScore = () => {
    if (inventoryYearIndex.some((year) => year === normalizedQuery)) {
      score += 120;
    } else if (inventoryYearIndex.some((year) => year.includes(normalizedQuery))) {
      score += 80;
    }
  };

  if (filterMode === 'title') addTitleScore();
  else if (filterMode === 'author') addAuthorScore();
  else if (filterMode === 'subject') addSubjectScore();
  else if (filterMode === 'callno') addCallNumberScore();
  else if (filterMode === 'year') addYearScore();
  else {
    addTitleScore();
    addAuthorScore();
    addSubjectScore();
    addCallNumberScore();
    addYearScore();

    if (book.searchIndex.includes(normalizedQuery)) {
      score += 25;
    }
  }

  score += Math.min(Number(book.copies) || 0, 5);

  return score;
};

const isExactCatalogMatch = (book, normalizedQuery, filterMode = 'smart') => {
  const yearIndex = (book.inventoryYears || []).map((year) => normalizeCatalogText(year));

  if (filterMode === 'title') {
    return book.normalizedTitle === normalizedQuery || book.normalizedTitle.startsWith(normalizedQuery);
  }

  if (filterMode === 'author') {
    return book.normalizedAuthor === normalizedQuery || book.normalizedAuthor.startsWith(normalizedQuery);
  }

  if (filterMode === 'subject') {
    return book.normalizedSubjects.some((subject) => subject === normalizedQuery || subject.startsWith(normalizedQuery));
  }

  if (filterMode === 'callno') {
    return book.normalizedCallNumbers.some((callNumber) => callNumber === normalizedQuery || callNumber.startsWith(normalizedQuery));
  }

  if (filterMode === 'year') {
    return yearIndex.some((year) => year === normalizedQuery);
  }

  return (
    book.normalizedTitle === normalizedQuery
    || book.normalizedTitle.startsWith(normalizedQuery)
    || book.normalizedAuthor === normalizedQuery
  );
};

export const searchCatalogBooks = (books, query, filterMode = 'smart', options = {}) => {
  const normalizedQuery = normalizeCatalogText(query);
  const limitExact = Number.isFinite(options.limitExact) ? options.limitExact : 8;
  const limitSimilar = Number.isFinite(options.limitSimilar) ? options.limitSimilar : 24;

  if (!normalizedQuery) {
    return {
      exactMatches: [],
      similarMatches: books
        .slice()
        .sort((left, right) => {
          if ((right.copies || 0) !== (left.copies || 0)) {
            return (right.copies || 0) - (left.copies || 0);
          }

          return left.title.localeCompare(right.title);
        })
    };
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const rankedBooks = books
    .map((book) => ({
      ...book,
      searchScore: scoreCatalogBook(book, normalizedQuery, tokens, filterMode)
    }))
    .filter((book) => book.searchScore > 0)
    .sort((left, right) => {
      if (right.searchScore !== left.searchScore) {
        return right.searchScore - left.searchScore;
      }

      if ((right.copies || 0) !== (left.copies || 0)) {
        return (right.copies || 0) - (left.copies || 0);
      }

      return left.title.localeCompare(right.title);
    });
  const exactMatches = rankedBooks
    .filter((book) => isExactCatalogMatch(book, normalizedQuery, filterMode))
    .slice(0, limitExact);
  const exactMatchIds = new Set(exactMatches.map((book) => book.id));
  const similarMatches = rankedBooks
    .filter((book) => !exactMatchIds.has(book.id))
    .slice(0, limitSimilar);

  return { exactMatches, similarMatches };
};

export const getCatalogBookById = (books, bookId) => books.find((book) => `${book.id}` === `${bookId}`) || null;

export const getRelatedCatalogBooks = (books, selectedBook, limit = 6) => {
  if (!selectedBook) {
    return [];
  }

  const selectedSubjects = new Set(selectedBook.normalizedSubjects);

  return books
    .filter((book) => book.id !== selectedBook.id)
    .map((book) => {
      let score = 0;

      if (book.normalizedAuthor && book.normalizedAuthor === selectedBook.normalizedAuthor) {
        score += 120;
      }

      const sharedSubjects = book.normalizedSubjects.filter((subject) => selectedSubjects.has(subject));

      score += sharedSubjects.length * 35;

      if (book.normalizedTitle.split(' ').some((word) => selectedBook.normalizedTitle.includes(word))) {
        score += 15;
      }

      return {
        ...book,
        relatedScore: score,
        sharedSubjects
      };
    })
    .filter((book) => book.relatedScore > 0)
    .sort((left, right) => {
      if (right.relatedScore !== left.relatedScore) {
        return right.relatedScore - left.relatedScore;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, limit);
};

export const parseBookInventoryWorkbook = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const groupedBooks = new Map();

  workbook.SheetNames.forEach((sheetName) => {
    const inventoryYear = getYearFromSheetName(sheetName);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    rows.forEach((row) => {
      const title = sanitizeField(pickFirst(row, ['TITLE ', 'TITLE']), '');

      if (!title || normalizeCatalogText(title) === 'n/a') {
        return;
      }

      const author = sanitizeField(pickFirst(row, ['AUTHOR']));
      const edition = sanitizeField(pickFirst(row, ['EDITON', 'EDITION']));
      const volume = sanitizeField(pickFirst(row, ['VOLUME']));
      const copyright = sanitizeField(pickFirst(row, ['COPYRIGHT']));
      const key = [
        normalizeCatalogText(title),
        normalizeCatalogText(author),
        normalizeCatalogText(edition),
        normalizeCatalogText(volume),
        normalizeCatalogText(copyright)
      ].join('|');
      const currentRecord = groupedBooks.get(key) || {
        title,
        author,
        edition,
        volume,
        copyright,
        accessionNumbers: [],
        callNumbers: [],
        authorNumbers: [],
        inventoryYears: [],
        subjects: [],
        publishers: [],
        publicationPlaces: [],
        isbns: [],
        remarks: [],
        sourceOfFunds: [],
        copies: 0
      };

      currentRecord.copies += 1;
      currentRecord.accessionNumbers.push(pickFirst(row, ['ACCESSION NO.', 'ACCESSION NO. ', 'ACC. NO.']));
      currentRecord.callNumbers.push(pickFirst(row, ['CALL NO.']));
      currentRecord.authorNumbers.push(pickFirst(row, ["AUTHOR'S NO."]));
      currentRecord.inventoryYears.push(inventoryYear);
      currentRecord.subjects.push(
        pickFirst(row, ['SUBJECT 1']),
        pickFirst(row, ['SUBJECT 2']),
        pickFirst(row, ['SUBJECT 3'])
      );
      currentRecord.publishers.push(pickFirst(row, ['PUBLISHER']));
      currentRecord.publicationPlaces.push(pickFirst(row, ['PLACE OF PUBLICATION']));
      currentRecord.isbns.push(pickFirst(row, ['ISBN']));
      currentRecord.remarks.push(pickFirst(row, ['REMARKS']));
      currentRecord.sourceOfFunds.push(pickFirst(row, ['SOURCE OF FUNDS']));

      groupedBooks.set(key, currentRecord);
    });
  });

  return Array.from(groupedBooks.values())
    .map((book) => ({
      title: book.title,
      author: book.author,
      edition: book.edition,
      volume: book.volume,
      copyright: book.copyright,
      copies: book.copies,
      subject1: uniqueValues(book.subjects, '')[0] || '',
      subject2: uniqueValues(book.subjects, '')[1] || '',
      subject3: uniqueValues(book.subjects, '')[2] || '',
      inventoryYears: uniqueValues(book.inventoryYears),
      accessionNumbers: uniqueValues(book.accessionNumbers),
      callNumber: uniqueValues(book.callNumbers)[0] || 'N/A',
      authorNumber: uniqueValues(book.authorNumbers)[0] || 'N/A',
      publisher: uniqueValues(book.publishers)[0] || 'N/A',
      placeOfPublication: uniqueValues(book.publicationPlaces)[0] || 'N/A',
      isbn: uniqueValues(book.isbns)[0] || 'N/A',
      remarks: uniqueValues(book.remarks)[0] || 'N/A',
      sourceOfFunds: uniqueValues(book.sourceOfFunds)[0] || 'N/A'
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
};
