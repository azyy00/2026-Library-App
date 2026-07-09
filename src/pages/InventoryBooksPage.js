import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { CATALOG_SEARCH_FILTERS, buildCatalogIndex, parseBookInventoryWorkbook, searchCatalogBooks } from '../data/bookCatalog';
import { bookApi } from '../services/api';

const EMPTY_BOOK_FORM = {
  title: '',
  author: '',
  edition: '',
  volume: '',
  copyright: '',
  copies: '1',
  subject1: '',
  subject2: '',
  subject3: '',
  callNumber: '',
  authorNumber: '',
  accessionNumbers: '',
  inventoryYears: '',
  publisher: '',
  placeOfPublication: '',
  isbn: '',
  remarks: '',
  sourceOfFunds: ''
};

const buildFormStateFromBook = (book) => ({
  title: book.title || '',
  author: book.author || '',
  edition: book.edition === 'N/A' ? '' : book.edition || '',
  volume: book.volume === 'N/A' ? '' : book.volume || '',
  copyright: book.copyright === 'N/A' ? '' : book.copyright || '',
  copies: `${book.copies || 1}`,
  subject1: book.subject1 || '',
  subject2: book.subject2 || '',
  subject3: book.subject3 || '',
  callNumber: book.callNumber === 'N/A' ? '' : book.callNumber || '',
  authorNumber: book.authorNumber === 'N/A' ? '' : book.authorNumber || '',
  accessionNumbers: Array.isArray(book.accessionNumbers) ? book.accessionNumbers.join(', ') : '',
  inventoryYears: Array.isArray(book.inventoryYears) ? book.inventoryYears.join(', ') : '',
  publisher: book.publisher === 'N/A' ? '' : book.publisher || '',
  placeOfPublication: book.placeOfPublication === 'N/A' ? '' : book.placeOfPublication || '',
  isbn: book.isbn === 'N/A' ? '' : book.isbn || '',
  remarks: book.remarks === 'N/A' ? '' : book.remarks || '',
  sourceOfFunds: book.sourceOfFunds === 'N/A' ? '' : book.sourceOfFunds || ''
});

const buildPayloadFromForm = (formData) => ({
  title: formData.title,
  author: formData.author,
  edition: formData.edition,
  volume: formData.volume,
  copyright: formData.copyright,
  copies: Number(formData.copies) || 1,
  subject1: formData.subject1,
  subject2: formData.subject2,
  subject3: formData.subject3,
  callNumber: formData.callNumber,
  authorNumber: formData.authorNumber,
  accessionNumbers: formData.accessionNumbers,
  inventoryYears: formData.inventoryYears,
  publisher: formData.publisher,
  placeOfPublication: formData.placeOfPublication,
  isbn: formData.isbn,
  remarks: formData.remarks,
  sourceOfFunds: formData.sourceOfFunds
});

const BOOK_TEMPLATE_HEADERS = [
  'TITLE',
  'AUTHOR',
  'EDITION',
  'VOLUME',
  'COPYRIGHT',
  'ACCESSION NO.',
  'CALL NO.',
  "AUTHOR'S NO.",
  'SUBJECT 1',
  'SUBJECT 2',
  'SUBJECT 3',
  'PUBLISHER',
  'PLACE OF PUBLICATION',
  'ISBN',
  'REMARKS',
  'SOURCE OF FUNDS'
];

const BOOK_TEMPLATE_SAMPLE_ROW = [
  'Sample Book Title',
  'Sample Author Name',
  '1st ed.',
  'Vol. 1',
  '2026',
  'ACC-0001',
  '001.234 SAM',
  'A1',
  'General references',
  'Library science',
  'Cataloging',
  'GCC Press',
  'Goa, Camarines Sur',
  '978-0000000000',
  'Replace this sample row with your own inventory data.',
  'School Fund'
];
const IMPORT_BATCH_SIZE = 80;

const downloadBookTemplate = () => {
  const workbook = XLSX.utils.book_new();
  const inventorySheet = XLSX.utils.aoa_to_sheet([
    BOOK_TEMPLATE_HEADERS,
    BOOK_TEMPLATE_SAMPLE_ROW
  ]);
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['GCC Library Book Inventory Template'],
    [],
    ['How to use'],
    ['1. Keep the header names exactly as provided in the template.'],
    ['2. Enter one physical copy per row if each copy has a different accession number.'],
    ['3. You can duplicate title and author values across rows when a book has multiple copies.'],
    ['4. Use separate sheets such as INVENTORY 2026, INVENTORY 2025, and so on if needed.'],
    ['5. Save the file as .xlsx before importing it into Inventory Books.']
  ]);

  inventorySheet['!cols'] = [
    { wch: 34 },
    { wch: 26 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 34 },
    { wch: 18 }
  ];
  guideSheet['!cols'] = [{ wch: 90 }];
  guideSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }
  ];

  XLSX.utils.book_append_sheet(workbook, inventorySheet, 'INVENTORY 2026');
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide');

  const workbookOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([workbookOutput], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  saveAs(blob, 'gcc-library-book-template.xlsx');
};

const chunkBooks = (books, chunkSize) => {
  const chunks = [];

  for (let index = 0; index < books.length; index += chunkSize) {
    chunks.push(books.slice(index, index + chunkSize));
  }

  return chunks;
};

function InventoryBooksPage() {
  const importInputRef = useRef(null);
  const [books, setBooks] = useState([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isSavingBook, setIsSavingBook] = useState(false);
  const [isImportingBooks, setIsImportingBooks] = useState(false);
  const [editingBookId, setEditingBookId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('smart');
  const [formData, setFormData] = useState(EMPTY_BOOK_FORM);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredSearchMode = useDeferredValue(searchMode);
  const indexedBooks = useMemo(() => buildCatalogIndex(books), [books]);
  const { exactMatches, similarMatches } = useMemo(
    () => searchCatalogBooks(indexedBooks, deferredSearchTerm, deferredSearchMode, {
      limitExact: indexedBooks.length,
      limitSimilar: indexedBooks.length
    }),
    [deferredSearchMode, deferredSearchTerm, indexedBooks]
  );
  const showBrowseState = !deferredSearchTerm.trim();
  const visibleBooks = useMemo(() => {
    if (showBrowseState) {
      return indexedBooks;
    }

    return [...exactMatches, ...similarMatches];
  }, [exactMatches, indexedBooks, showBrowseState, similarMatches]);
  const totalCopies = useMemo(
    () => indexedBooks.reduce((sum, book) => sum + (Number(book.copies) || 0), 0),
    [indexedBooks]
  );
  const coveredSubjects = useMemo(() => {
    const subjects = new Set();

    indexedBooks.forEach((book) => {
      book.subjects.forEach((subject) => {
        if (subject && subject !== 'N/A') {
          subjects.add(subject);
        }
      });
    });

    return subjects.size;
  }, [indexedBooks]);

  const loadBooks = async () => {
    try {
      setIsLoadingBooks(true);
      const response = await bookApi.getAll();
      setBooks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Book inventory load error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to load the book inventory right now.'
      });
    } finally {
      setIsLoadingBooks(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleNewBook = (options = {}) => {
    setEditingBookId('');
    setFormData(EMPTY_BOOK_FORM);

    if (!options.keepFeedback) {
      setFeedback(null);
    }
  };

  const handleEditBook = (book) => {
    setEditingBookId(`${book.id}`);
    setFormData(buildFormStateFromBook(book));
    setFeedback(null);
  };

  const handleDeleteBook = async (book) => {
    const shouldDelete = window.confirm(`Delete "${book.title}" from the inventory?`);

    if (!shouldDelete) {
      return;
    }

    try {
      await bookApi.remove(book.id);
      setFeedback({
        type: 'success',
        text: `"${book.title}" was removed from the inventory.`
      });

      if (`${book.id}` === editingBookId) {
        handleNewBook({ keepFeedback: true });
      }

      await loadBooks();
    } catch (error) {
      console.error('Book delete error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to delete this book right now.'
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSavingBook(true);
    setFeedback(null);

    try {
      const payload = buildPayloadFromForm(formData);

      if (editingBookId) {
        const response = await bookApi.update(editingBookId, payload);
        setFeedback({
          type: 'success',
          text: response.data?.message || 'Book updated successfully.'
        });
      } else {
        const response = await bookApi.create(payload);
        setFeedback({
          type: 'success',
          text: response.data?.message || 'Book added successfully.'
        });
      }

      handleNewBook({ keepFeedback: true });
      await loadBooks();
    } catch (error) {
      console.error('Book save error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to save this book right now.'
      });
    } finally {
      setIsSavingBook(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsImportingBooks(true);
      setFeedback({
        type: 'info',
        text: `Importing "${file.name}"...`
      });
      const workbookBuffer = await file.arrayBuffer();
      const importedBooks = parseBookInventoryWorkbook(workbookBuffer);

      if (importedBooks.length === 0) {
        setFeedback({
          type: 'warning',
          text: 'No valid book records were found in the selected workbook.'
        });
        return;
      }

      const batches = chunkBooks(importedBooks, IMPORT_BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        setFeedback({
          type: 'info',
          text: `Importing batch ${batchIndex + 1} of ${batches.length}...`
        });
        await bookApi.import(batches[batchIndex]);
      }

      await loadBooks();
      setFeedback({
        type: 'success',
        text: `Imported ${importedBooks.length} book record(s) successfully in ${batches.length} batch${batches.length > 1 ? 'es' : ''}.`
      });
    } catch (error) {
      console.error('Book import error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to import the selected workbook.'
      });
    } finally {
      setIsImportingBooks(false);
      event.target.value = '';
    }
  };

  return (
    <div className="inventory-page">
      <section className="inventory-hero">
        <div className="inventory-hero-brand">
          <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="inventory-hero-logo" />
          <div>
            <p className="section-eyebrow mb-2">Goa Community College Library</p>
            <h2>Inventory Books</h2>
            <p className="mb-0">Manage the live book inventory that appears in the Online Public Access Catalog.</p>
          </div>
        </div>

        <div className="inventory-hero-actions">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="d-none"
            onChange={handleImportFile}
          />
          <button
            type="button"
            className="btn btn-outline-maroon"
            onClick={() => importInputRef.current?.click()}
            disabled={isImportingBooks}
          >
            {isImportingBooks ? 'Importing...' : 'Import Workbook'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={downloadBookTemplate}
          >
            Download Template
          </button>
          <button
            type="button"
            className="btn btn-maroon"
            onClick={handleNewBook}
          >
            {editingBookId ? 'Add New Book' : 'Manual Entry'}
          </button>
        </div>
      </section>

      {feedback && (
        <div className={`alert alert-${feedback.type} inventory-alert`} role="alert">
          {feedback.text}
        </div>
      )}

      <section className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <span>Total Titles</span>
          <strong>{indexedBooks.length}</strong>
          <small>Unique catalog records now stored for OPAC.</small>
        </article>
        <article className="inventory-summary-card">
          <span>Total Copies</span>
          <strong>{totalCopies}</strong>
          <small>Combined copy count across the inventory.</small>
        </article>
        <article className="inventory-summary-card">
          <span>Subjects Covered</span>
          <strong>{coveredSubjects}</strong>
          <small>Distinct subject entries available for search.</small>
        </article>
        <article className="inventory-summary-card">
          <span>Search Results</span>
          <strong>{visibleBooks.length}</strong>
          <small>{showBrowseState ? 'Showing the full inventory list.' : 'Matching the active search.'}</small>
        </article>
      </section>

      <section className="inventory-workspace">
        <article className="inventory-panel inventory-list-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="section-eyebrow mb-2">Inventory List</p>
              <h3>Book records</h3>
              <p className="mb-0">Search the collection, review stored records, and open one for editing.</p>
            </div>
            <div className="inventory-list-summary">
              <span>Showing</span>
              <strong>{visibleBooks.length}</strong>
            </div>
          </div>

          <div className="inventory-toolbar">
            <div className="inventory-search-field">
              <label htmlFor="inventory-search-query">Search</label>
              <input
                id="inventory-search-query"
                type="search"
                className="form-control"
                placeholder="Search title, author, subject, call number, or year"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="inventory-search-field inventory-search-filter-field">
              <label htmlFor="inventory-search-filter">Find By</label>
              <select
                id="inventory-search-filter"
                className="form-select"
                value={searchMode}
                onChange={(event) => setSearchMode(event.target.value)}
              >
                {CATALOG_SEARCH_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive inventory-table-wrap">
            <table className="table align-middle inventory-table mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Copies</th>
                  <th>Subjects</th>
                  <th>Year</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingBooks ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">Loading inventory books...</td>
                  </tr>
                ) : visibleBooks.length > 0 ? (
                  visibleBooks.map((book) => (
                    <tr key={book.id}>
                      <td>
                        <div className="inventory-book-title">
                          <strong>{book.title}</strong>
                          <small>{book.callNumbers[0]}</small>
                        </div>
                      </td>
                      <td>{book.author}</td>
                      <td>{book.copies}</td>
                      <td>
                        <div className="inventory-book-subjects">
                          {book.subjects.slice(0, 3).map((subject) => (
                            <span key={`${book.id}-${subject}`} className="catalog-tag">{subject}</span>
                          ))}
                        </div>
                      </td>
                      <td>{book.inventoryYears.join(', ')}</td>
                      <td className="text-end">
                        <div className="inventory-row-actions">
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handleEditBook(book)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteBook(book)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No book records matched the current search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="inventory-panel inventory-form-panel">
          <div className="inventory-panel-header inventory-form-header">
            <div className="inventory-form-brand">
              <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="inventory-form-logo" />
              <div>
                <p className="section-eyebrow mb-2">Manual Book Entry</p>
                <h3>{editingBookId ? 'Edit inventory record' : 'Add inventory record'}</h3>
                <p className="mb-0">Every saved change updates the OPAC catalog record automatically.</p>
              </div>
            </div>
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="inventory-form-grid">
              <div className="inventory-field inventory-field-wide">
                <label htmlFor="inventory-title">Title of the book</label>
                <input
                  id="inventory-title"
                  type="text"
                  className="form-control"
                  value={formData.title}
                  onChange={(event) => handleFieldChange('title', event.target.value)}
                  placeholder="Enter book title"
                  required
                />
              </div>

              <div className="inventory-field inventory-field-wide">
                <label htmlFor="inventory-author">Author</label>
                <input
                  id="inventory-author"
                  type="text"
                  className="form-control"
                  value={formData.author}
                  onChange={(event) => handleFieldChange('author', event.target.value)}
                  placeholder="Enter author"
                  required
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-edition">Edition</label>
                <input
                  id="inventory-edition"
                  type="text"
                  className="form-control"
                  value={formData.edition}
                  onChange={(event) => handleFieldChange('edition', event.target.value)}
                  placeholder="Edition"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-volume">Volume</label>
                <input
                  id="inventory-volume"
                  type="text"
                  className="form-control"
                  value={formData.volume}
                  onChange={(event) => handleFieldChange('volume', event.target.value)}
                  placeholder="Volume"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-copyright">Copyright</label>
                <input
                  id="inventory-copyright"
                  type="text"
                  className="form-control"
                  value={formData.copyright}
                  onChange={(event) => handleFieldChange('copyright', event.target.value)}
                  placeholder="Copyright year"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-copies">No. of Copies</label>
                <input
                  id="inventory-copies"
                  type="number"
                  className="form-control"
                  min="1"
                  value={formData.copies}
                  onChange={(event) => handleFieldChange('copies', event.target.value)}
                  placeholder="Copies"
                  required
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-subject-1">Subject 1</label>
                <input
                  id="inventory-subject-1"
                  type="text"
                  className="form-control"
                  value={formData.subject1}
                  onChange={(event) => handleFieldChange('subject1', event.target.value)}
                  placeholder="Primary subject"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-subject-2">Subject 2</label>
                <input
                  id="inventory-subject-2"
                  type="text"
                  className="form-control"
                  value={formData.subject2}
                  onChange={(event) => handleFieldChange('subject2', event.target.value)}
                  placeholder="Secondary subject"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-subject-3">Subject 3</label>
                <input
                  id="inventory-subject-3"
                  type="text"
                  className="form-control"
                  value={formData.subject3}
                  onChange={(event) => handleFieldChange('subject3', event.target.value)}
                  placeholder="Additional subject"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-call-number">Call Number</label>
                <input
                  id="inventory-call-number"
                  type="text"
                  className="form-control"
                  value={formData.callNumber}
                  onChange={(event) => handleFieldChange('callNumber', event.target.value)}
                  placeholder="Call number"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-author-number">Author Number</label>
                <input
                  id="inventory-author-number"
                  type="text"
                  className="form-control"
                  value={formData.authorNumber}
                  onChange={(event) => handleFieldChange('authorNumber', event.target.value)}
                  placeholder="Author number"
                />
              </div>

              <div className="inventory-field inventory-field-wide">
                <label htmlFor="inventory-years">Inventory Years</label>
                <input
                  id="inventory-years"
                  type="text"
                  className="form-control"
                  value={formData.inventoryYears}
                  onChange={(event) => handleFieldChange('inventoryYears', event.target.value)}
                  placeholder="2025, 2024, 2023"
                />
              </div>

              <div className="inventory-field inventory-field-wide">
                <label htmlFor="inventory-accession-numbers">Accession Numbers</label>
                <textarea
                  id="inventory-accession-numbers"
                  className="form-control"
                  rows="2"
                  value={formData.accessionNumbers}
                  onChange={(event) => handleFieldChange('accessionNumbers', event.target.value)}
                  placeholder="Comma-separated accession numbers"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-publisher">Publisher</label>
                <input
                  id="inventory-publisher"
                  type="text"
                  className="form-control"
                  value={formData.publisher}
                  onChange={(event) => handleFieldChange('publisher', event.target.value)}
                  placeholder="Publisher"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-place">Place of Publication</label>
                <input
                  id="inventory-place"
                  type="text"
                  className="form-control"
                  value={formData.placeOfPublication}
                  onChange={(event) => handleFieldChange('placeOfPublication', event.target.value)}
                  placeholder="Place of publication"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-isbn">ISBN</label>
                <input
                  id="inventory-isbn"
                  type="text"
                  className="form-control"
                  value={formData.isbn}
                  onChange={(event) => handleFieldChange('isbn', event.target.value)}
                  placeholder="ISBN"
                />
              </div>

              <div className="inventory-field">
                <label htmlFor="inventory-source">Source of Funds</label>
                <input
                  id="inventory-source"
                  type="text"
                  className="form-control"
                  value={formData.sourceOfFunds}
                  onChange={(event) => handleFieldChange('sourceOfFunds', event.target.value)}
                  placeholder="Source of funds"
                />
              </div>

              <div className="inventory-field inventory-field-wide">
                <label htmlFor="inventory-remarks">Remarks</label>
                <textarea
                  id="inventory-remarks"
                  className="form-control"
                  rows="2"
                  value={formData.remarks}
                  onChange={(event) => handleFieldChange('remarks', event.target.value)}
                  placeholder="Remarks"
                />
              </div>
            </div>

            <div className="inventory-form-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={handleNewBook} disabled={isSavingBook}>
                {editingBookId ? 'Cancel Edit' : 'Clear'}
              </button>
              <button type="submit" className="btn btn-maroon" disabled={isSavingBook}>
                {isSavingBook ? 'Saving...' : editingBookId ? 'Save Changes' : 'Add Book'}
              </button>
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}

export default InventoryBooksPage;
