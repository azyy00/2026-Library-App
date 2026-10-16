import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import CatalogStandaloneShell from '../components/CatalogStandaloneShell';
import { buildCatalogIndex, getRelatedCatalogBooks, formatSubjectLabel } from '../data/bookCatalog';
import { bookApi } from '../services/api';
import { CITATION_FORMATS, generateBookCitation } from '../utils/bookCitation';

function BookCatalogDetailPage() {
  const { bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isLoadingBook, setIsLoadingBook] = useState(true);
  const [detailMessage, setDetailMessage] = useState('');
  const [citationFormat, setCitationFormat] = useState('apa');
  const [citationFeedback, setCitationFeedback] = useState('');
  const indexedBooks = useMemo(() => buildCatalogIndex(books), [books]);
  const indexedSelectedBook = useMemo(() => (
    selectedBook ? buildCatalogIndex([selectedBook])[0] : null
  ), [selectedBook]);
  const relatedBooks = useMemo(
    () => getRelatedCatalogBooks(indexedBooks, indexedSelectedBook),
    [indexedBooks, indexedSelectedBook]
  );
  const citationText = useMemo(
    () => generateBookCitation(indexedSelectedBook, citationFormat),
    [citationFormat, indexedSelectedBook]
  );

  useEffect(() => {
    let isMounted = true;

    const loadBook = async () => {
      try {
        setIsLoadingBook(true);
        setDetailMessage('');
        const [bookResponse, booksResponse] = await Promise.all([
          bookApi.getOne(bookId),
          bookApi.getAll()
        ]);

        if (isMounted) {
          setSelectedBook(bookResponse.data);
          setBooks(Array.isArray(booksResponse.data) ? booksResponse.data : []);
        }
      } catch (error) {
        console.error('Catalog detail load error:', error);

        if (isMounted) {
          setSelectedBook(null);
          setBooks([]);
          setDetailMessage(error.response?.data?.error || 'Unable to open this catalog record right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingBook(false);
        }
      }
    };

    loadBook();

    return () => {
      isMounted = false;
    };
  }, [bookId]);

  useEffect(() => {
    if (!citationFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCitationFeedback('');
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [citationFeedback]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(location.state?.backTo || '/opac');
  };

  const handleCopyCitation = async () => {
    if (!citationText) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(citationText);
      } else {
        const helperInput = document.createElement('textarea');
        helperInput.value = citationText;
        helperInput.setAttribute('readonly', '');
        helperInput.style.position = 'absolute';
        helperInput.style.left = '-9999px';
        document.body.appendChild(helperInput);
        helperInput.select();
        document.execCommand('copy');
        document.body.removeChild(helperInput);
      }

      setCitationFeedback('Citation copied');
    } catch (error) {
      console.error('Citation copy failed:', error);
      setCitationFeedback('Copy failed. Please copy it manually.');
    }
  };

  return (
    <CatalogStandaloneShell>
      <div className="catalog-shell">
        {isLoadingBook ? (
          <section className="catalog-section">
            <div className="catalog-empty-state">
              <h4>Loading book record</h4>
              <p>Please wait while the selected title is prepared.</p>
            </div>
          </section>
        ) : detailMessage || !indexedSelectedBook ? (
          <section className="catalog-section">
            <div className="catalog-empty-state">
              <h4>Book record unavailable</h4>
              <p>{detailMessage || 'That book could not be found in the current inventory.'}</p>
              <div className="catalog-back-actions">
                <button type="button" className="catalog-back-button" onClick={handleBack}>
                  Back
                </button>
                <Link to="/opac" className="catalog-back-link">OPAC home</Link>
              </div>
            </div>
          </section>
        ) : (
          <>
        <section className="catalog-detail-hero">
          <div className="catalog-detail-headline">
            <div className="catalog-back-actions">
              <button type="button" className="catalog-back-button" onClick={handleBack}>
                Back
              </button>
              <Link to={location.state?.backTo || '/opac'} className="catalog-back-link">
                OPAC home
              </Link>
            </div>
            <p className="section-eyebrow mb-2">Book Record</p>
            <h2>{indexedSelectedBook.title}</h2>
            <p className="catalog-detail-author mb-0">{indexedSelectedBook.author}</p>
          </div>

          <div className="catalog-detail-copy-count">
            <span>No. of Copies</span>
            <strong>{indexedSelectedBook.copies}</strong>
          </div>
        </section>

        <section className="catalog-detail-layout">
          <article className="catalog-detail-panel">
            <div className="catalog-detail-grid">
              <div className="catalog-detail-field">
                <span>Title of the Book</span>
                <strong>{indexedSelectedBook.title}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Author</span>
                <strong>{indexedSelectedBook.author}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Ed.</span>
                <strong>{indexedSelectedBook.edition}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Volume</span>
                <strong>{indexedSelectedBook.volume}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Copyright</span>
                <strong>{indexedSelectedBook.copyright}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Call No.</span>
                <strong>{indexedSelectedBook.callNumbers[0]}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>ISBN</span>
                <strong>{indexedSelectedBook.isbn}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Publisher</span>
                <strong>{indexedSelectedBook.publisher}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Place of Publication</span>
                <strong>{indexedSelectedBook.placeOfPublication}</strong>
              </div>
              <div className="catalog-detail-field">
                <span>Inventory Year</span>
                <strong>{indexedSelectedBook.inventoryYears.join(', ')}</strong>
              </div>
              <div className="catalog-detail-field catalog-detail-field-wide">
                <span>Subjects</span>
                <div className="catalog-result-subjects">
                  {indexedSelectedBook.subjects.map((subject) => (
                    <span key={`${indexedSelectedBook.id}-${subject}`} className="catalog-tag">{formatSubjectLabel(subject)}</span>
                  ))}
                </div>
              </div>
              <div className="catalog-detail-field catalog-detail-field-wide">
                <span>Accession No.</span>
                <strong>{indexedSelectedBook.accessionNumbers.join(', ')}</strong>
              </div>
            </div>
          </article>

          <aside className="catalog-detail-side">
            <article className="catalog-detail-panel catalog-citation-panel">
              <p className="catalog-side-kicker">Study help</p>
              <div className="catalog-citation-header">
                <div>
                  <h3>Cite this book</h3>
                  <p>Choose a format, then copy the citation.</p>
                </div>
                <button type="button" className="catalog-citation-copy" onClick={handleCopyCitation}>
                  Copy citation
                </button>
              </div>

              <div className="catalog-citation-format-list" role="tablist" aria-label="Citation formats">
                {CITATION_FORMATS.map((format) => (
                  <button
                    key={format.value}
                    type="button"
                    className={`catalog-citation-format${citationFormat === format.value ? ' is-active' : ''}`}
                    onClick={() => setCitationFormat(format.value)}
                    aria-pressed={citationFormat === format.value}
                  >
                    {format.label}
                  </button>
                ))}
              </div>

              <div className="catalog-citation-output" role="status" aria-live="polite">
                <p>{citationText}</p>
              </div>

              <div className="catalog-citation-footer">
                <small>Review the author and title details before final submission.</small>
                {citationFeedback ? <span>{citationFeedback}</span> : null}
              </div>
            </article>

            <article className="catalog-detail-panel">
              <p className="catalog-side-kicker">Collection note</p>
              <h3>Catalog reference</h3>
              <ul className="catalog-side-list">
                <li>Author&apos;s No.: {indexedSelectedBook.authorNumbers.join(', ')}</li>
                <li>Source of funds: {indexedSelectedBook.sourceOfFunds}</li>
                <li>Remarks: {indexedSelectedBook.remarks}</li>
              </ul>
            </article>

            <article className="catalog-detail-panel">
              <p className="catalog-side-kicker">Related books</p>
              <h3>Similar titles</h3>
              {relatedBooks.length > 0 ? (
                <div className="catalog-related-list">
                  {relatedBooks.map((book) => (
                    <Link key={book.id} to={`/opac/books/${book.id}`} state={location.state} className="catalog-related-item">
                      <strong>{book.title}</strong>
                      <span>{book.author}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mb-0">No closely related titles were found in the current inventory.</p>
              )}
            </article>
          </aside>
        </section>
          </>
        )}
      </div>
    </CatalogStandaloneShell>
  );
}

export default BookCatalogDetailPage;
