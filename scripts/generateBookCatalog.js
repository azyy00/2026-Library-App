const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const workbookPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(__dirname, '..', '..', 'BOOK-INVENTORY-2026.xlsx');
const outputPath = path.resolve(__dirname, '..', 'src', 'data', 'bookCatalog.json');

const normalizeSpace = (value) => `${value ?? ''}`.replace(/\s+/g, ' ').trim();
const normalizeKey = (value) => normalizeSpace(value).toLowerCase();
const sanitizeField = (value, fallback = 'N/A') => {
  const cleaned = normalizeSpace(value);
  return cleaned || fallback;
};
const sanitizeAuthorList = (value, fallback = 'N/A') => {
  const authors = `${value ?? ''}`
    .split(/\r?\n|;/)
    .map(normalizeSpace)
    .filter(Boolean);

  return authors.length > 0 ? authors.join('; ') : fallback;
};
const getYearFromSheetName = (sheetName) => {
  const match = `${sheetName}`.match(/(20\d{2})/);
  return match ? match[1] : sheetName;
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
        .filter((value) => value && normalizeKey(value) !== 'n/a')
    )
  );

  return deduped.length > 0 ? deduped : [fallback];
};
const slugify = (value) => normalizeSpace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Book inventory workbook not found at ${workbookPath}`);
}

const workbook = XLSX.readFile(workbookPath);
const groupedBooks = new Map();

for (const sheetName of workbook.SheetNames) {
  const inventoryYear = getYearFromSheetName(sheetName);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  rows.forEach((row) => {
    const title = sanitizeField(pickFirst(row, ['TITLE ', 'TITLE']));

    if (!title || normalizeKey(title) === 'n/a') {
      return;
    }

    // Cells list one author per line; keep the breaks as "; " separators.
    const author = sanitizeAuthorList(row.AUTHOR);
    const edition = sanitizeField(pickFirst(row, ['EDITON', 'EDITION']));
    const volume = sanitizeField(pickFirst(row, ['VOLUME']));
    const copyright = sanitizeField(pickFirst(row, ['COPYRIGHT']));
    const key = [
      normalizeKey(title),
      normalizeKey(author),
      normalizeKey(edition),
      normalizeKey(volume),
      normalizeKey(copyright)
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
}

const catalog = Array.from(groupedBooks.values())
  .map((book) => {
    const inventoryYears = Array.from(new Set(book.inventoryYears)).sort((left, right) => Number(right) - Number(left));
    const idBase = [
      slugify(book.title).slice(0, 50),
      slugify(book.author).slice(0, 30),
      `${book.copyright}`.replace(/[^0-9a-z]+/gi, '').toLowerCase().slice(0, 8) || 'na'
    ].filter(Boolean).join('-');

    return {
      id: idBase,
      title: book.title,
      author: book.author,
      edition: book.edition,
      volume: book.volume,
      copyright: book.copyright,
      copies: book.copies,
      subjects: uniqueValues(book.subjects),
      inventoryYears,
      accessionNumbers: uniqueValues(book.accessionNumbers),
      callNumbers: uniqueValues(book.callNumbers),
      authorNumbers: uniqueValues(book.authorNumbers),
      publisher: uniqueValues(book.publishers)[0],
      placeOfPublication: uniqueValues(book.publicationPlaces)[0],
      isbn: uniqueValues(book.isbns)[0],
      remarks: uniqueValues(book.remarks)[0],
      sourceOfFunds: uniqueValues(book.sourceOfFunds)[0]
    };
  })
  .sort((left, right) => left.title.localeCompare(right.title));

const usedIds = new Map();

catalog.forEach((book) => {
  const baseId = book.id;
  const currentCount = usedIds.get(baseId) || 0;

  if (currentCount > 0) {
    book.id = `${baseId}-${currentCount + 1}`;
  }

  usedIds.set(baseId, currentCount + 1);
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

console.log(`Generated ${catalog.length} catalog records at ${outputPath}`);
