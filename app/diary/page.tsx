'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, List, ChevronLeft, ChevronRight, Search, X, MessageCircle } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface SimpleEntry {
  id: number;
  content: string | null;
  mood: string;
  created_at: string;
}

const moodEmojis: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  neutral: '😐',
  excited: '🤗',
  angry: '😠',
  anxious: '😰',
  peaceful: '😌',
  confused: '😵',
};

const moodLabels: Record<string, string> = {
  happy: '嬉しい',
  sad: '悲しい',
  neutral: '普通',
  excited: '興奮',
  angry: '怒り',
  anxious: '不安',
  peaceful: '平和',
  confused: '混乱',
};

type ViewMode = 'list' | 'calendar';

export default function DiaryListPage() {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<SimpleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SimpleEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const entriesPerPage = 10;
  const router = useRouter();

  // Debounce hook for search optimization
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Helper function to check if a date has entries
  const getEntriesForDate = (date: Date) => {
    return entries.filter(entry => {
      const entryDate = new Date(entry.created_at);
      return entryDate.toDateString() === date.toDateString();
    });
  };

  // Helper function to check if a date has any entries
  const hasEntriesOnDate = (date: Date) => {
    return getEntriesForDate(date).length > 0;
  };

  // Pagination helpers
  const displayEntries = searchQuery.trim() ? searchResults : entries;
  const totalPages = Math.ceil(displayEntries.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentEntries = searchQuery.trim() ? searchResults : displayEntries.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const toggleEntryExpansion = (entryId: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  // Helper function to highlight search keywords
  const highlightKeywords = (text: string, keywords: string) => {
    if (!keywords.trim()) return text;
    
    const keywordList = keywords.trim().split(/\s+/);
    let highlightedText = text;
    
    keywordList.forEach(keyword => {
      if (keyword.length > 0) {
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark style="background-color: yellow; padding: 1px 2px; border-radius: 2px;">$1</mark>');
      }
    });
    
    return highlightedText;
  };

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('diaries')
        .select('id, content, mood, created_at')
        .eq('user_id', user.id)
        .ilike('content', `%${query.trim()}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  const handleSearch = () => {
    if (!searchQuery.trim() || !user) return;
    
    setShowHistory(false);
    
    // Save to search history
    saveToSearchHistory(searchQuery.trim());
    
    // Perform immediate search
    performSearch(searchQuery);
  };

  const saveToSearchHistory = (query: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem('diary-search-history') || '[]');
      const filtered = existing.filter((item: string) => item !== query);
      const newHistory = [query, ...filtered].slice(0, 10); // Keep only last 10 searches
      localStorage.setItem('diary-search-history', JSON.stringify(newHistory));
      setSearchHistory(newHistory);
    } catch (err) {
      console.error('Error saving search history:', err);
    }
  };

  const loadSearchHistory = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('diary-search-history') || '[]');
      setSearchHistory(saved);
    } catch (err) {
      console.error('Error loading search history:', err);
    }
  };

  const selectFromHistory = (query: string) => {
    setSearchQuery(query);
    setShowHistory(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setCurrentPage(1);
    setShowHistory(false);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          setError(`認証エラー: ${authError.message}`);
          return;
        }
        
        if (!user) {
          router.push('/auth/login');
          return;
        }

        setUser(user);

        // Load diary entries using direct Supabase query
        const { data: diaryData, error: diaryError } = await supabase
          .from('diaries')
          .select('id, content, mood, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (diaryError) {
          setError(`日記取得エラー: ${diaryError.message}`);
          return;
        }

        setEntries(diaryData || []);
        setCurrentPage(1); // Reset to first page when data loads
      } catch (err) {
        setError(`エラー: ${err}`);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Load search history on component mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Automatic search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim() && user) {
      performSearch(debouncedSearchQuery);
    } else if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearchQuery, user, performSearch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen muute-gradient">
      <div className="container mx-auto max-w-lg p-4">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-2xl font-medium text-foreground mb-2">マイダイアリー</h1>
          <p className="text-muted-foreground text-sm mb-6">
            あなたの気持ちの記録
          </p>
          <div className="flex gap-3">
            <Button asChild className="muute-button bg-primary hover:bg-primary/90 text-white px-6 py-3">
              <Link href="/diary/new">
                <Plus className="w-4 h-4 mr-2" />
                きろくする
              </Link>
            </Button>
            <Button asChild variant="outline" className="muute-button border-primary text-primary hover:bg-primary/10 px-6 py-3">
              <Link href="/feedback">
                <MessageCircle className="w-4 h-4 mr-2" />
                メッセージ
              </Link>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="muute-card p-1">
            <div className="flex rounded-xl bg-muted/30">
              <button
                onClick={() => {
                  setViewMode('list');
                  setCurrentPage(1);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="text-sm font-medium">リスト</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">カレンダー</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar - Only in List View */}
        {viewMode === 'list' && (
          <div className="mb-6">
            <div className="muute-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="日記を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    onFocus={() => setShowHistory(searchHistory.length > 0)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-border/40 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted/50 rounded-full transition-colors"
                      title="検索をクリア"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  
                  {/* Search History Dropdown */}
                  {showHistory && searchHistory.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border/40 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      <div className="p-2">
                        <div className="text-xs text-muted-foreground mb-2 px-2">最近の検索</div>
                        {searchHistory.map((historyItem, index) => (
                          <button
                            key={index}
                            onClick={() => selectFromHistory(historyItem)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Search className="w-3 h-3 text-muted-foreground" />
                            {historyItem}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching}
                  className="px-6 py-3 muute-button bg-primary hover:bg-primary/90 text-white"
                >
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      検索中
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      検索
                    </span>
                  )}
                </Button>
              </div>
              {searchQuery.trim() && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchResults.length > 0 
                      ? `「${searchQuery}」の検索結果: ${searchResults.length}件`
                      : `「${searchQuery}」に一致する日記が見つかりませんでした`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        {viewMode === 'list' ? (
          /* List View */
          !searchQuery.trim() && entries.length === 0 ? (
            <div className="muute-card p-8 text-center">
              <div className="mb-4">
                <span className="text-6xl">📱</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-foreground">はじめての記録</h3>
              <p className="text-muted-foreground text-sm mb-6">
                今日の気持ちを書いてみませんか？
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {!searchQuery.trim() && (
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    {entries.length}件の記録 (ページ {currentPage} / {totalPages})
                  </p>
                </div>
              )}
              
              {/* Entry List */}
              <div className="space-y-3">
                {currentEntries.map((entry) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  const shouldTruncate = entry.content && entry.content.length > 80;
                  const displayContent = isExpanded || !shouldTruncate 
                    ? entry.content 
                    : entry.content?.substring(0, 80) + '...';

                  // Apply highlighting if we're showing search results
                  const finalDisplayContent = searchQuery.trim() 
                    ? highlightKeywords(displayContent || '記録', searchQuery)
                    : displayContent || '記録';

                  return (
                    <div key={entry.id} className="muute-card p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mood-${entry.mood}`}>
                          {moodEmojis[entry.mood] || '😐'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs px-2 py-1 bg-white/60 rounded-full text-muted-foreground">
                              {moodLabels[entry.mood] || entry.mood}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString('ja-JP', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <p 
                            className="text-foreground text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: finalDisplayContent }}
                          />
                          {shouldTruncate && (
                            <button
                              onClick={() => toggleEntryExpansion(entry.id)}
                              className="text-xs text-primary hover:text-primary/80 mt-2 font-medium"
                            >
                              {isExpanded ? '▲ 閉じる' : '▼ もっと見る'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {!searchQuery.trim() && totalPages > 1 && (
                <div className="muute-card p-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      前へ
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                            currentPage === page
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      次へ
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* Calendar View */
          <div className="space-y-4">
            <div className="muute-card p-4">
              <ReactCalendar
                onChange={setSelectedDate}
                value={selectedDate}
                locale="ja-JP"
                className="border-0 w-full"
                formatDay={(locale, date) => date.getDate().toString()}
                tileClassName={({ date }) => {
                  const classes = ['react-calendar__tile-custom'];
                  if (hasEntriesOnDate(date)) {
                    classes.push('has-entries');
                  }
                  return classes.join(' ');
                }}
                tileContent={null}
              />
            </div>

            {/* Selected Date Entries */}
            {selectedDate && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-foreground mb-3">
                  {selectedDate.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}の記録
                </h3>
                {getEntriesForDate(selectedDate).length === 0 ? (
                  <div className="muute-card p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      この日の記録はありません
                    </p>
                  </div>
                ) : (
                  getEntriesForDate(selectedDate).map((entry) => {
                    const isCalendarExpanded = expandedEntries.has(entry.id);
                    const shouldTruncateCalendar = entry.content && entry.content.length > 60;
                    const calendarDisplayContent = isCalendarExpanded || !shouldTruncateCalendar 
                      ? entry.content 
                      : entry.content?.substring(0, 60) + '...';

                    return (
                      <div key={entry.id} className="muute-card p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mood-${entry.mood}`}>
                            {moodEmojis[entry.mood] || '😐'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs px-2 py-1 bg-white/60 rounded-full text-muted-foreground">
                                {moodLabels[entry.mood] || entry.mood}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.created_at).toLocaleTimeString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-foreground text-sm leading-relaxed">
                              {calendarDisplayContent || '記録'}
                            </p>
                            {shouldTruncateCalendar && (
                              <button
                                onClick={() => toggleEntryExpansion(entry.id)}
                                className="text-xs text-primary hover:text-primary/80 mt-2 font-medium"
                              >
                                {isCalendarExpanded ? '▲ 閉じる' : '▼ もっと見る'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}