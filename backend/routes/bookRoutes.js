const express = require('express');
const crypto = require('crypto');
const { requireEmployeeAuth } = require('../config/auth');
const db = require('../config/db');

const router = express.Router();
const dbPromise = db.promise();

const ensureBooksTable = (() => {
  let ensurePromise;

  return async () => {
    if (!ensurePromise) {
      ensurePromise = (async () => {
        await dbPromise.query(`
          CREATE TABLE IF NOT EXISTS books (
            id INT PRIMARY KEY AUTO_INCREMENT,
            catalog_key VARCHAR(255) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            edition VARCHAR(80) DEFAULT 'N/A',
            volume VARCHAR(80) DEFAULT 'N/A',
            copyright VARCHAR(40) DEFAULT 'N/A',
            copies INT NOT NULL DEFAULT 1,
            subject_1 VARCHAR(255),
            subject_2 VARCHAR(255),
            subject_3 VARCHAR(255),
            call_number VARCHAR(120),
            author_number VARCHAR(120),
            accession_numbers TEXT,
            inventory_years VARCHAR(120),
            publisher VARCHAR(255),
            place_of_publication VARCHAR(255),
            isbn VARCHAR(120),
            remarks VARCHAR(255),
            source_of_funds VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        await dbPromise.query('CREATE INDEX IF NOT EXISTS idx_books_title ON books (title)');
        await dbPromise.query('CREATE INDEX IF NOT EXISTS idx_books_author ON books (author)');

        const [legacyRows] = await dbPromise.query(`
          SELECT id, title, author, edition, volume, copyright, catalog_key
          FROM books
          WHERE catalog_key IS NULL
            OR CHAR_LENGTH(catalog_key) <> 64
            OR catalog_key NOT REGEXP '^[0-9a-f]{64}$'
        `);

        for (const row of legacyRows) {
          const nextCatalogKey = buildCatalogKey({
            title: row.title,
            author: row.author,
            edition: row.edition,
            volume: row.volume,
            copyright: row.copyright
          });

          await dbPromise.query('UPDATE books SET catalog_key = ? WHERE id = ?', [nextCatalogKey, row.id]);
        }
      })().catch((error) => {
        ensurePromise = null;
        throw error;
      });
    }

    return ensurePromise;
  };
})();

const normalizeSpace = (value) => `${value ?? ''}`.replace(/\s+/g, ' ').trim();
const normalizeKeyText = (value) => normalizeSpace(value).toLowerCase();
const toCommaSeparated = (value) => {
  const items = Array.isArray(value) ? value : normalizeSpace(value).split(',');
  const seen = new Set();

  return items
    .map((item) => normalizeSpace(item))
    .filter((item) => {
      const key = item.toLowerCase();

      if (!item || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(', ');
};
const parseCommaSeparated = (value) => normalizeSpace(value)
  .split(',')
  .map((item) => normalizeSpace(item))
  .filter(Boolean);
const sanitizeText = (value, fallback = 'N/A') => {
  const cleaned = normalizeSpace(value);
  return cleaned || fallback;
};
const clampCopies = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return 1;
  }

  return Math.max(1, Math.round(numericValue));
};
// Spreadsheet cells list one author per line. Keep those breaks as "; " so
// names stay distinguishable instead of collapsing into one run of words.
const sanitizeAuthorList = (value, fallback = '') => {
  const authors = `${value ?? ''}`
    .split(/\r?\n|;/)
    .map(normalizeSpace)
    .filter(Boolean);

  return authors.length > 0 ? authors.join('; ') : fallback;
};
// The separator is display-only: keying on it would turn a re-import of an
// existing record into a duplicate.
const authorKeyText = (author) => normalizeKeyText(`${author ?? ''}`.replace(/;/g, ' '));
const buildCatalogKey = (book) => crypto.createHash('sha256').update([
  normalizeKeyText(book.title),
  authorKeyText(book.author),
  normalizeKeyText(book.edition),
  normalizeKeyText(book.volume),
  normalizeKeyText(book.copyright)
].join('|')).digest('hex');

const normalizeBookPayload = (payload = {}) => {
  const subject1 = sanitizeText(payload.subject1 ?? payload.subject_1 ?? payload.subjects?.[0], '');
  const subject2 = sanitizeText(payload.subject2 ?? payload.subject_2 ?? payload.subjects?.[1], '');
  const subject3 = sanitizeText(payload.subject3 ?? payload.subject_3 ?? payload.subjects?.[2], '');
  const normalizedBook = {
    title: sanitizeText(payload.title, ''),
    author: sanitizeAuthorList(payload.author, ''),
    edition: sanitizeText(payload.edition, 'N/A'),
    volume: sanitizeText(payload.volume, 'N/A'),
    copyright: sanitizeText(payload.copyright, 'N/A'),
    copies: clampCopies(payload.copies),
    subject_1: subject1,
    subject_2: subject2,
    subject_3: subject3,
    call_number: sanitizeText(payload.callNumber ?? payload.call_number, 'N/A'),
    author_number: sanitizeText(payload.authorNumber ?? payload.author_number, 'N/A'),
    accession_numbers: toCommaSeparated(payload.accessionNumbers ?? payload.accession_numbers),
    inventory_years: toCommaSeparated(payload.inventoryYears ?? payload.inventory_years),
    publisher: sanitizeText(payload.publisher, 'N/A'),
    place_of_publication: sanitizeText(payload.placeOfPublication ?? payload.place_of_publication, 'N/A'),
    isbn: sanitizeText(payload.isbn, 'N/A'),
    remarks: sanitizeText(payload.remarks, 'N/A'),
    source_of_funds: sanitizeText(payload.sourceOfFunds ?? payload.source_of_funds, 'N/A')
  };

  if (!normalizedBook.title || !normalizedBook.author) {
    const error = new Error('Title and author are required.');
    error.status = 400;
    throw error;
  }

  normalizedBook.catalog_key = buildCatalogKey(normalizedBook);

  return normalizedBook;
};

const mapBookRecord = (book) => {
  const subjects = [book.subject_1, book.subject_2, book.subject_3]
    .map((subject) => normalizeSpace(subject))
    .filter((subject) => subject && normalizeKeyText(subject) !== 'n/a');

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    edition: book.edition,
    volume: book.volume,
    copyright: book.copyright,
    copies: Number(book.copies) || 0,
    subject1: book.subject_1 || '',
    subject2: book.subject_2 || '',
    subject3: book.subject_3 || '',
    subjects: subjects.length > 0 ? subjects : ['N/A'],
    callNumber: book.call_number || 'N/A',
    callNumbers: [book.call_number || 'N/A'],
    authorNumber: book.author_number || 'N/A',
    authorNumbers: [book.author_number || 'N/A'],
    accessionNumbers: parseCommaSeparated(book.accession_numbers),
    inventoryYears: parseCommaSeparated(book.inventory_years),
    publisher: book.publisher || 'N/A',
    placeOfPublication: book.place_of_publication || 'N/A',
    isbn: book.isbn || 'N/A',
    remarks: book.remarks || 'N/A',
    sourceOfFunds: book.source_of_funds || 'N/A',
    createdAt: book.created_at,
    updatedAt: book.updated_at
  };
};

const listBooksQuery = `
  SELECT *
  FROM books
  ORDER BY title ASC, author ASC
`;

router.use(async (req, res, next) => {
  try {
    await ensureBooksTable();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await dbPromise.query(listBooksQuery);
    res.json(rows.map(mapBookRecord));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await dbPromise.query('SELECT * FROM books WHERE id = ? LIMIT 1', [req.params.id]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    res.json(mapBookRecord(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireEmployeeAuth, async (req, res, next) => {
  try {
    const book = normalizeBookPayload(req.body);
    const [result] = await dbPromise.query('INSERT INTO books SET ?', [book]);
    const [rows] = await dbPromise.query('SELECT * FROM books WHERE id = ? LIMIT 1', [result.insertId]);

    res.status(201).json({
      message: 'Book added successfully.',
      book: mapBookRecord(rows[0])
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'A matching book already exists in the inventory.' });
      return;
    }

    next(error);
  }
});

router.put('/:id', requireEmployeeAuth, async (req, res, next) => {
  try {
    const book = normalizeBookPayload(req.body);
    const [duplicateRows] = await dbPromise.query(
      'SELECT id FROM books WHERE catalog_key = ? AND id <> ? LIMIT 1',
      [book.catalog_key, req.params.id]
    );

    if (duplicateRows.length > 0) {
      res.status(409).json({ error: 'Another inventory record already matches this book.' });
      return;
    }

    const [result] = await dbPromise.query('UPDATE books SET ? WHERE id = ?', [book, req.params.id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    const [rows] = await dbPromise.query('SELECT * FROM books WHERE id = ? LIMIT 1', [req.params.id]);
    res.json({
      message: 'Book updated successfully.',
      book: mapBookRecord(rows[0])
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireEmployeeAuth, async (req, res, next) => {
  try {
    const [result] = await dbPromise.query('DELETE FROM books WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    res.json({ message: 'Book removed successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/import', requireEmployeeAuth, async (req, res, next) => {
  const incomingBooks = Array.isArray(req.body?.books) ? req.body.books : [];

  if (incomingBooks.length === 0) {
    res.status(400).json({ error: 'No books were provided for import.' });
    return;
  }

  const normalizedBooks = incomingBooks.map(normalizeBookPayload);
  const connection = await dbPromise.getConnection();

  try {
    await connection.beginTransaction();

    for (const book of normalizedBooks) {
      await connection.query(
        `
          INSERT INTO books SET ?
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            author = VALUES(author),
            edition = VALUES(edition),
            volume = VALUES(volume),
            copyright = VALUES(copyright),
            copies = VALUES(copies),
            subject_1 = VALUES(subject_1),
            subject_2 = VALUES(subject_2),
            subject_3 = VALUES(subject_3),
            call_number = VALUES(call_number),
            author_number = VALUES(author_number),
            accession_numbers = VALUES(accession_numbers),
            inventory_years = VALUES(inventory_years),
            publisher = VALUES(publisher),
            place_of_publication = VALUES(place_of_publication),
            isbn = VALUES(isbn),
            remarks = VALUES(remarks),
            source_of_funds = VALUES(source_of_funds)
        `,
        [book]
      );
    }

    await connection.commit();
    const [countRows] = await dbPromise.query('SELECT COUNT(*) AS totalBooks, COALESCE(SUM(copies), 0) AS totalCopies FROM books');
    const inventorySummary = {
      totalBooks: Number(countRows?.[0]?.totalBooks) || 0,
      totalCopies: Number(countRows?.[0]?.totalCopies) || 0
    };

    res.json({
      message: `Imported ${normalizedBooks.length} book record(s) successfully.`,
      importedCount: normalizedBooks.length,
      summary: inventorySummary
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
