import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CatalogStandaloneShell from '../components/CatalogStandaloneShell';
import Skeleton from '../components/Skeleton';
import { CATALOG_SEARCH_FILTERS, buildCatalogIndex, searchCatalogBooks } from '../data/bookCatalog';
import { bookApi } from '../services/api';

const DEFAULT_POPULAR_BOOK_LIMIT = 8;

function BookCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [catalogMessage, setCatalogMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('query') || '');
  const [searchMode, setSearchMode] = useState(searchParams.get('filter') || 'smart');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredSearchMode = useDeferredValue(searchMode);
  const indexedBooks = useMemo(() => buildCatalogIndex(books), [books]);
  const { exactMatches, similarMatches } = useMemo(
    () => searchCatalogBooks(indexedBooks, deferredSearchTerm, deferredSearchMode),
    [deferredSearchMode, deferredSearchTerm, indexedBooks]
  );
  const showBrowseState = !deferredSearchTerm.trim();
  const displayedSimilarMatches = showBrowseState
    ? similarMatches.slice(0, DEFAULT_POPULAR_BOOK_LIMIT)
    : similarMatches;
  const activeFilterLabel = CATALOG_SEARCH_FILTERS.find((filter) => filter.value === deferredSearchMode)?.label || 'Smart search';
  const linkState = {
    backTo: `/opac?query=${encodeURIComponent(searchTerm)}&filter=${encodeURIComponent(searchMode)}`,
    fromTitle: deferredSearchTerm.trim()
  };

  useEffect(() => {
    let isMounted = true;

    const loadBooks = async () => {
      try {
        setIsLoadingBooks(true);
        setCatalogMessage('');
        const response = await bookApi.getAll();

        if (isMounted) {
          setBooks(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Catalog load error:', error);

        if (isMounted) {
          setBooks([]);
          setCatalogMessage(error.response?.data?.error || 'Unable to load the book inventory right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingBooks(false);
        }
      }
    };

    loadBooks();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const nextParams = {};

    if (searchTerm.trim()) {
      nextParams.query = searchTerm;
    }

    if (searchMode !== 'smart') {
      nextParams.filter = searchMode;
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchMode, searchTerm, setSearchParams]);

  return (
    <CatalogStandaloneShell>
      <div className="catalog-shell">
        <section className="catalog-hero">
        <div className="catalog-hero-copy">
          <p className="section-eyebrow mb-2">Student Search</p>
          <h2>Find a Book</h2>
          <p className="mb-0">Search by title, author, subject, call number, or year.</p>
        </div>

        <div className="catalog-hero-search">
          <div className="catalog-search-controls">
            <div className="catalog-search-field">
              <label htmlFor="catalog-search" className="catalog-search-label">Search</label>
              <input
                id="catalog-search"
                type="search"
                className="catalog-search-input"
                placeholder="Enter title, author, subject, call number, or year"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="catalog-search-field">
              <label htmlFor="catalog-search-mode" className="catalog-search-label">Find By</label>
              <select
                id="catalog-search-mode"
                className="catalog-search-filter"
                value={searchMode}
                onChange={(event) => setSearchMode(event.target.value)}
              >
                {CATALOG_SEARCH_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>
          </div>
          <small>
            {isLoadingBooks
              ? 'Loading live catalog inventory...'
              : showBrowseState
                ? `Showing ${displayedSimilarMatches.length} popular books from ${indexedBooks.length} catalog entries.`
                : `${exactMatches.length + similarMatches.length} results in ${activeFilterLabel.toLowerCase()}.`}
          </small>
        </div>
        </section>

        {catalogMessage && (
          <section className="catalog-section">
            <div className="catalog-empty-state">
              <h4>Catalog unavailable</h4>
              <p>{catalogMessage}</p>
            </div>
          </section>
        )}

        {isLoadingBooks && !catalogMessage && (
          <section className="catalog-section">
            <div className="catalog-section-header">
              <div>
                <span className="catalog-section-kicker">Preparing catalog</span>
                <h3>Loading books</h3>
              </div>
            </div>
            <div className="catalog-skeleton-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`catalog-skeleton-${index}`} className="catalog-skeleton-card" aria-hidden="true">
                  <Skeleton width="40%" height="0.8rem" />
                  <Skeleton width="90%" height="1.25rem" />
                  <Skeleton width="65%" height="1rem" />
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <Skeleton width="4rem" height="1.6rem" radius="999px" />
                    <Skeleton width="5rem" height="1.6rem" radius="999px" />
                  </div>
                  <Skeleton width="55%" height="0.85rem" />
                </div>
              ))}
            </div>
          </section>
        )}

        {!isLoadingBooks && !catalogMessage && exactMatches.length > 0 && (
          <section className="catalog-section">
            <div className="catalog-section-header">
              <div>
                <span className="catalog-section-kicker">Best match</span>
                <h3>Exact or very close results</h3>
              </div>
            </div>

            <div className="catalog-result-grid">
              {exactMatches.map((book) => (
                <Link key={book.id} to={`/opac/books/${book.id}`} state={linkState} className="catalog-result-card">
                  <div className="catalog-result-meta">
                    <span className="catalog-result-badge">Exact match</span>
                    <span>{book.copies} cop{book.copies > 1 ? 'ies' : 'y'}</span>
                  </div>
                  <h4>{book.title}</h4>
                  <p>{book.author}</p>
                  <div className="catalog-result-subjects">
                    {book.subjects.slice(0, 3).map((subject) => (
                      <span key={`${book.id}-${subject}`} className="catalog-tag">{subject}</span>
                    ))}
                  </div>
                  <div className="catalog-result-footer">
                    <span>{book.callNumbers[0]}</span>
                    <strong>View details</strong>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!isLoadingBooks && !catalogMessage && (
        <section className="catalog-section">
          <div className="catalog-section-header">
            <div>
              <span className="catalog-section-kicker">{showBrowseState ? 'Popular picks' : 'Suggested results'}</span>
              <h3>{showBrowseState ? 'Popular Books' : 'Similar books'}</h3>
            </div>
          </div>

          {displayedSimilarMatches.length > 0 ? (
            <div className="catalog-result-grid">
              {displayedSimilarMatches.map((book) => (
                <Link key={book.id} to={`/opac/books/${book.id}`} state={linkState} className="catalog-result-card">
                  <div className="catalog-result-meta">
                    <span>{book.inventoryYears.join(', ')}</span>
                    <span>{book.copies} cop{book.copies > 1 ? 'ies' : 'y'}</span>
                  </div>
                  <h4>{book.title}</h4>
                  <p>{book.author}</p>
                  <div className="catalog-result-subjects">
                    {book.subjects.slice(0, 3).map((subject) => (
                      <span key={`${book.id}-${subject}`} className="catalog-tag">{subject}</span>
                    ))}
                  </div>
                  <div className="catalog-result-footer">
                    <span>{book.publisher}</span>
                    <strong>Open record</strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="catalog-empty-state">
              <h4>No books matched that search.</h4>
              <p>Try a shorter title, an author name, or one of the book subjects instead.</p>
            </div>
          )}
        </section>
        )}
      </div>
    </CatalogStandaloneShell>
  );
}

export default BookCatalogPage;
