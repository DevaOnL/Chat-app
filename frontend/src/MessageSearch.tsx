import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, CloseIcon, CalendarIcon, UserIcon, FilterIcon } from './Icons';

interface SearchResult {
  _id: string;
  text: string;
  sender: string;
  createdAt: string;
  file?: {
    fileName: string;
    fileType: string;
    fileUrl: string;
  };
  reactions?: { [emoji: string]: string[] };
}

interface SearchResponse {
  messages: SearchResult[];
  total: number;
  hasMore: boolean;
}

interface MessageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageSelect: (messageId: string) => void;
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  isOpen,
  onClose,
  onMessageSelect
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [sender, setSender] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fileType, setFileType] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const performSearch = async (searchQuery: string, reset: boolean = true) => {
    if (!searchQuery.trim() && !sender && !startDate && !endDate && !fileType) {
      setResults([]);
      setTotal(0);
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('query', searchQuery.trim());
      if (sender) params.append('sender', sender);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (fileType) params.append('fileType', fileType);
      params.append('limit', '20');
      if (!reset) params.append('skip', results.length.toString());

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/messages/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: { success: boolean; data: SearchResponse } = await response.json();
      
      if (reset) {
        setResults(data.data.messages);
      } else {
        setResults(prev => [...prev, ...data.data.messages]);
      }
      
      setTotal(data.data.total);
      setHasMore(data.data.hasMore);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, true);
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      performSearch(query, false);
    }
  };

  const clearFilters = () => {
    setSender('');
    setStartDate('');
    setEndDate('');
    setFileType('');
    setQuery('');
    setResults([]);
    setTotal(0);
    setHasMore(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.trim()})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Search Messages</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 hover:bg-panelAlt rounded-lg transition-colors"
              title="Filters"
            >
              <FilterIcon className="w-5 h-5 text-fg" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-panelAlt rounded-lg transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-fg" />
            </button>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="p-4 border-b border-border">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-10 pr-4 py-2 bg-panelAlt border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-accent text-accentFore rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 bg-panelAlt border-b border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Sender</label>
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 bg-panel border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-panel border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-panel border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">File Type</label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full px-3 py-2 bg-panel border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg"
                >
                  <option value="">All</option>
                  <option value="text">Text only</option>
                  <option value="image">Images</option>
                  <option value="pdf">PDFs</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 text-fg hover:bg-panel rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-4"
        >
          {total > 0 && (
            <div className="text-sm text-gray-500 mb-4">
              Found {total} result{total !== 1 ? 's' : ''}
            </div>
          )}
          
          <div className="space-y-3">
            {results.map((message) => (
              <div
                key={message._id}
                onClick={() => onMessageSelect(message._id)}
                className="p-3 bg-panelAlt hover:bg-header rounded-lg cursor-pointer transition-colors border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-fg">{message.sender}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDate(message.createdAt)}
                  </div>
                </div>
                
                <div className="text-fg">
                  {highlightSearchTerm(message.text, query)}
                </div>
                
                {message.file && (
                  <div className="mt-2 text-sm text-gray-500">
                    📎 {message.file.fileName}
                  </div>
                )}
                
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {Object.entries(message.reactions).map(([emoji, users]) => (
                      <span key={emoji} className="text-sm">
                        {emoji} {users.length}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="px-4 py-2 bg-accent text-accentFore rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
          
          {results.length === 0 && !isLoading && (query || sender || startDate || endDate || fileType) && (
            <div className="text-center text-gray-500 py-8">
              No messages found matching your search criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;
