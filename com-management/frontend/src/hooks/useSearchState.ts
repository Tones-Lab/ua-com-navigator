import { useEffect, useRef, useState, type FormEvent } from 'react';
import api from '../services/api';

const COM_SEARCH_QUERY_KEY = 'com.search.query';
const COM_SEARCH_SCOPE_KEY = 'com.search.scope';

type SearchScope = 'all' | 'name' | 'content';

type UseSearchStateParams = {
  isAuthenticated: boolean;
  onStatusUpdate?: (status: any) => void;
};

export default function useSearchState({ isAuthenticated, onStatusUpdate }: UseSearchStateParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const latestSearchSeqRef = useRef(0);

  const runSearch = async (query: string) => {
    const seq = ++latestSearchSeqRef.current;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const resp = await api.searchComs(query, searchScope, 200);
      if (seq !== latestSearchSeqRef.current) {
        return;
      }
      setSearchResults(resp.data?.results || []);
      if (resp.data?.status) {
        onStatusUpdate?.(resp.data.status);
      }
    } catch (err: any) {
      if (seq !== latestSearchSeqRef.current) {
        return;
      }
      const message = err?.response?.data?.error || 'Search failed';
      setSearchError(message);
    } finally {
      if (seq === latestSearchSeqRef.current) {
        setSearchLoading(false);
      }
    }
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    void runSearch(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    sessionStorage.removeItem(COM_SEARCH_QUERY_KEY);
    sessionStorage.removeItem('fcom.search.query');
  };

  const resetSearchState = () => {
    clearSearch();
    setSearchScope('all');
    setSearchLoading(false);
    latestSearchSeqRef.current += 1;
    sessionStorage.removeItem(COM_SEARCH_SCOPE_KEY);
    sessionStorage.removeItem('fcom.search.scope');
  };

  useEffect(() => {
    const savedQuery =
      sessionStorage.getItem(COM_SEARCH_QUERY_KEY) ||
      sessionStorage.getItem('fcom.search.query');
    const savedScope =
      sessionStorage.getItem(COM_SEARCH_SCOPE_KEY) ||
      sessionStorage.getItem('fcom.search.scope');
    if (savedQuery) {
      setSearchQuery(savedQuery);
    }
    if (savedScope === 'all' || savedScope === 'name' || savedScope === 'content') {
      setSearchScope(savedScope);
    }
    if (savedQuery && !sessionStorage.getItem(COM_SEARCH_QUERY_KEY)) {
      sessionStorage.setItem(COM_SEARCH_QUERY_KEY, savedQuery);
    }
    if (savedScope && !sessionStorage.getItem(COM_SEARCH_SCOPE_KEY)) {
      sessionStorage.setItem(COM_SEARCH_SCOPE_KEY, savedScope);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(COM_SEARCH_QUERY_KEY, searchQuery);
    sessionStorage.setItem(COM_SEARCH_SCOPE_KEY, searchScope);
  }, [searchQuery, searchScope]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      latestSearchSeqRef.current += 1;
      return;
    }
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchQuery, searchScope, isAuthenticated]);

  return {
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    searchResults,
    setSearchResults,
    searchLoading,
    setSearchLoading,
    searchError,
    setSearchError,
    runSearch,
    handleSearchSubmit,
    clearSearch,
    resetSearchState,
  };
}
