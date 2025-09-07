'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
import { 
  BookOpenText, 
  Search, 
  Clock, 
  MessageCircle, 
  Trash2,
  Plus,
  Grid3X3,
  List,
  ChevronDown,
  X,
  MoreHorizontal,
  Calendar,
  Star,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeDifference } from '@/lib/time';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  lastResponse?: string;
}

interface ChatCardProps {
  chat: Chat;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const ChatCard: React.FC<ChatCardProps> = ({ chat, isSelected, onSelect, onDelete }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <motion.div
      className={cn(
        "group relative p-4 cursor-pointer transition-all duration-200 border-b border-light-200/30 dark:border-dark-200/30 last:border-b-0",
        isSelected 
          ? "bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-200/50 dark:ring-blue-800/30" 
          : "hover:bg-light-100/50 dark:hover:bg-dark-100/50"
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.001 }}
      transition={{ duration: 0.2 }}
    >
      {/* Selection indicator and checkbox */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start space-x-3">
          {/* Selection checkbox */}
          <motion.div
            className={cn(
              "flex-shrink-0 mt-1 w-5 h-5 rounded border-2 transition-all duration-200 cursor-pointer",
              isSelected 
                ? "bg-blue-500 border-blue-500 text-white" 
                : "border-light-300 dark:border-dark-300 hover:border-blue-400 dark:hover:border-blue-500"
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence>
              {isSelected && (
                <motion.svg
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full h-full"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="flex-1 min-w-0">
            <Link
              href={`/c/${chat.id}`}
              className="block"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-medium text-black dark:text-white mb-2 line-clamp-2">
                {chat.title}
              </h3>
            </Link>
            
            <p className="text-sm text-black/60 dark:text-white/60 line-clamp-2 mb-3">
              {chat.lastResponse 
                ? (chat.lastResponse.length > 120 
                    ? chat.lastResponse.substring(0, 120) + "..." 
                    : chat.lastResponse)
                : "No response yet"}
            </p>
            
            <div className="flex items-center text-xs text-black/50 dark:text-white/50">
              <Clock className="w-3 h-3 mr-1" />
              <span>{formatTimeDifference(new Date(), chat.createdAt)} ago</span>
            </div>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className={cn(
              "opacity-0 group-hover:opacity-100 p-1 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-all duration-200",
              isMenuOpen && "opacity-100"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </motion.button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 bg-white dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg shadow-lg z-20 min-w-[120px]"
              >
                <div className="py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      // TODO: Implement favorite functionality
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-black/70 dark:text-white/70 hover:bg-light-100 dark:hover:bg-dark-100 flex items-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    Add to favorites
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      // TODO: Implement archive functionality
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-black/70 dark:text-white/70 hover:bg-light-100 dark:hover:bg-dark-100 flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

interface ChatAnimatedListProps {
  chats: Chat[];
  selectedChatIds: string[];
  onChatSelect: (chatId: string) => void;
  onChatDelete: (chatId: string) => void;
}



// Custom AnimatedList component for chat items
const AnimatedChatList: React.FC<ChatAnimatedListProps> = ({
  chats,
  selectedChatIds,
  onChatSelect,
  onChatDelete
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [keyboardNav, setKeyboardNav] = useState<boolean>(false);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, chats.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < chats.length) {
          e.preventDefault();
          onChatSelect(chats[selectedIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chats, selectedIndex, onChatSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const container = listRef.current;
    const selectedItem = container.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;
      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: "smooth" });
      } else if (
        itemBottom >
        containerScrollTop + containerHeight - extraMargin
      ) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: "smooth",
        });
      }
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  return (
    <div className="w-full" ref={listRef}>
      <div className="space-y-0">
        {chats.map((chat, index) => (
          <AnimatedChatItem
            key={chat.id}
            chat={chat}
            index={index}
            isSelected={selectedChatIds.includes(chat.id)}
            isKeyboardSelected={selectedIndex === index}
            onSelect={() => {
              setSelectedIndex(index);
              onChatSelect(chat.id);
            }}
            onDelete={() => onChatDelete(chat.id)}
            onMouseEnter={() => setSelectedIndex(index)}
          />
        ))}
      </div>
    </div>
  );
};

// Animated wrapper for individual chat items
interface AnimatedChatItemProps {
  chat: Chat;
  index: number;
  isSelected: boolean;
  isKeyboardSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMouseEnter: () => void;
}

const AnimatedChatItem: React.FC<AnimatedChatItemProps> = ({
  chat,
  index,
  isSelected,
  isKeyboardSelected,
  onSelect,
  onDelete,
  onMouseEnter
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  
  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      initial={{ scale: 0.98, opacity: 0, y: 20 }}
      animate={inView ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.98, opacity: 0.3, y: 10 }}
      transition={{ 
        duration: 0.3, 
        delay: Math.min(index * 0.03, 0.3), 
        ease: "easeOut" 
      }}
      className={cn(
        "transition-all duration-200",
        isKeyboardSelected && "ring-2 ring-blue-500/50 ring-offset-2 ring-offset-white dark:ring-offset-dark-secondary rounded-lg"
      )}
    >
      <ChatCard
        chat={chat}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    </motion.div>
  );
};

const Page = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<'threads' | 'favorites' | 'archived'>('threads');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'alphabetical'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSelected = useCallback(() => {
    if (selectedChatIds.length === 0) return;
    setIsDeleteDialogOpen(true);
  }, [selectedChatIds.length]);

  useEffect(() => {
    const fetchChats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/chats`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();
        setChats(data.chats || []);
        setFilteredChats(data.chats || []);
      } catch (error) {
        console.error('Error fetching chats:', error);
        toast.error('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, []);

  // Keyboard shortcuts for better UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (filteredChats.length > 0) {
          if (selectedChatIds.length === filteredChats.length) {
            setSelectedChatIds([]);
          } else {
            setSelectedChatIds(filteredChats.map(chat => chat.id));
          }
        }
      }

      // Delete key to delete selected
      if (e.key === 'Delete' && selectedChatIds.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        if (selectedChatIds.length > 0) {
          setSelectedChatIds([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChatIds, filteredChats, handleDeleteSelected]);

  useEffect(() => {
    let filtered = chats;

    // Apply search filter
    if (searchQuery.trim() !== '') {
      filtered = chats.filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply tab filter
    switch (activeTab) {
      case 'threads':
        // Show all chats for threads tab
        break;
      case 'favorites':
        // TODO: Implement favorites functionality
        filtered = [];
        break;
      case 'archived':
        // TODO: Implement archived functionality
        filtered = [];
        break;
    }

    // Apply category filter (only for threads tab)
    if (activeTab === 'threads') {
      switch (selectedCategory) {
        case 'recent':
          filtered = filtered.filter((chat) => {
            const daysDiff = Math.floor(
              (new Date().getTime() - new Date(chat.createdAt).getTime()) / (1000 * 3600 * 24)
            );
            return daysDiff <= 7;
          });
          break;
        case 'favorites':
          // TODO: Implement favorites functionality
          filtered = [];
          break;
        case 'archived':
          // TODO: Implement archived functionality
          filtered = [];
          break;
      }
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredChats(sorted);
  }, [searchQuery, chats, sortBy, selectedCategory, activeTab]);

  const handleTabChange = (tab: 'threads' | 'favorites' | 'archived') => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedChatIds([]);
  };

  const handleChatSelect = (chatId: string) => {
    if (selectedChatIds.includes(chatId)) {
      setSelectedChatIds(selectedChatIds.filter(id => id !== chatId));
    } else {
      setSelectedChatIds([...selectedChatIds, chatId]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedChatIds.length === 0) return;
    
    setIsDeleting(true);
    
    // Store the chats for potential undo functionality
    const chatsToDelete = chats.filter(chat => selectedChatIds.includes(chat.id));
    const remainingChats = chats.filter(chat => !selectedChatIds.includes(chat.id));
    const deletedCount = selectedChatIds.length;
    
    try {
      // Optimistically update UI first
      setChats(remainingChats);
      setSelectedChatIds([]);
      setIsDeleteDialogOpen(false);
      
      // Show success toast with undo option
      toast.success(
        `Successfully deleted ${deletedCount} conversation${deletedCount > 1 ? 's' : ''}`,
        {
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: () => {
              setChats(chats); // Restore original chats
              toast.info('Deletion cancelled');
            },
          },
          style: {
            background: '#10b981',
            color: 'white',
            border: 'none',
          },
        }
      );
      
      // Delete conversations in batches for better performance
      const deletePromises = selectedChatIds.map(chatId => 
        fetch(`/api/chats/${chatId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(result => result.status === 'rejected').length;
      
      if (failed > 0) {
        // If some deletions failed, restore the failed chats
        const failedChats = chatsToDelete.slice(-failed);
        setChats(prev => [...prev, ...failedChats]);
        throw new Error(`Failed to delete ${failed} conversation${failed > 1 ? 's' : ''}`);
      }
      
    } catch (err: any) {
      // Restore all chats on complete failure
      setChats(chats);
      toast.error(err.message || 'Failed to delete conversations', {
        duration: 4000,
        style: {
          background: '#ef4444',
          color: 'white',
          border: 'none',
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const updateChatsAfterDelete = (newChats: Chat[]) => {
    setChats(newChats);
    setSelectedChatIds([]);
  };

  const getEmptyStateContent = () => {
    if (searchQuery.trim() !== '') {
      return {
        icon: <Search className="w-8 h-8 text-black/40 dark:text-white/40" />,
        title: 'No threads found',
        description: `No threads match "${searchQuery}". Try adjusting your search terms.`,
        showClearSearch: true,
      };
    }

    switch (activeTab) {
      case 'favorites':
        return {
          icon: <Star className="w-8 h-8 text-black/40 dark:text-white/40" />,
          title: 'No favorite threads yet',
          description: 'Mark your important threads as favorites to find them easily later.',
          showClearSearch: false,
        };
      case 'archived':
        return {
          icon: <Archive className="w-8 h-8 text-black/40 dark:text-white/40" />,
          title: 'No archived threads',
          description: 'Archive threads you want to keep but don\'t need to see in your main feed.',
          showClearSearch: false,
        };
      default: // threads
        return {
          icon: <MessageCircle className="w-8 h-8 text-black/40 dark:text-white/40" />,
          title: 'No threads yet',
          description: 'Start chatting to see your threads here',
          showClearSearch: false,
        };
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-light-secondary dark:bg-dark-secondary rounded-2xl p-8 shadow-sm border border-light-200 dark:border-dark-200">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <BookOpenText className="w-8 h-8 text-black/70 dark:text-white/70" />
              </div>
              <p className="text-black/70 dark:text-white/70 text-sm">Loading your library...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-light-primary dark:bg-dark-primary border-b border-light-200 dark:border-dark-200">
          {/* Top Section with Library title and New Thread button */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between p-6"
          >
            <div className="flex items-center space-x-3">
              <BookOpenText className="w-6 h-6 text-black dark:text-white" />
              <h1 className="text-xl font-semibold text-black dark:text-white">Library</h1>
            </div>
            
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 bg-light-secondary dark:bg-dark-secondary text-black dark:text-white rounded-lg text-sm font-medium hover:bg-light-100 dark:hover:bg-dark-100 transition-colors border border-light-200 dark:border-dark-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Thread
              </Link>
            </motion.div>
          </motion.div>

          {/* Navigation Tabs */}
          <div className="px-6">
            <div className="flex justify-between items-center border-b border-light-200 dark:border-dark-200">
              <div className="flex space-x-6">
                <button 
                  onClick={() => handleTabChange('threads')}
                  className={cn(
                    "pb-3 px-1 text-sm font-medium transition-colors duration-200",
                    activeTab === 'threads' 
                      ? "border-b-2 border-black dark:border-white text-black dark:text-white" 
                      : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                  )}
                >
                  Threads
                </button>
                <button 
                  onClick={() => handleTabChange('favorites')}
                  className={cn(
                    "pb-3 px-1 text-sm font-medium transition-colors duration-200",
                    activeTab === 'favorites' 
                      ? "border-b-2 border-black dark:border-white text-black dark:text-white" 
                      : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                  )}
                >
                  Favorites
                </button>
                <button 
                  onClick={() => handleTabChange('archived')}
                  className={cn(
                    "pb-3 px-1 text-sm font-medium transition-colors duration-200",
                    activeTab === 'archived' 
                      ? "border-b-2 border-black dark:border-white text-black dark:text-white" 
                      : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                  )}
                >
                  Archived
                </button>
              </div>
            </div>
          </div>

          {/* Search and Controls */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="p-6 space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black/50 dark:text-white/50" />
              <input
                type="text"
                placeholder="Search your Threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg text-black dark:text-white placeholder-black/50 dark:placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              <AnimatePresence>
                {searchQuery && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedChatIds.length === filteredChats.length) {
                        setSelectedChatIds([]);
                      } else {
                        setSelectedChatIds(filteredChats.map(chat => chat.id));
                      }
                    }}
                    className="h-8 px-3 text-black dark:text-white hover:bg-light-100 dark:hover:bg-dark-100"
                  >
                    {selectedChatIds.length === filteredChats.length && filteredChats.length > 0 
                      ? 'Deselect all' 
                      : 'Select all'}
                  </Button>
                  {selectedChatIds.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {selectedChatIds.length} of {filteredChats.length}
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="appearance-none bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg px-3 py-2 pr-8 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-light-100 dark:hover:bg-dark-100 transition-all duration-200 cursor-pointer"
                  >
                    <option value="all">Type</option>
                    <option value="recent">Recent</option>
                    <option value="favorites">Favorites</option>
                    <option value="archived">Archived</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black/50 dark:text-white/50 pointer-events-none" />
                </div>
              </div>
              
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="appearance-none bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg px-3 py-2 pr-8 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-light-100 dark:hover:bg-dark-100 transition-all duration-200 cursor-pointer"
                >
                  <option value="recent">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                  <option value="alphabetical">Sort: A-Z</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black/50 dark:text-white/50 pointer-events-none" />
              </div>
            </div>

            {/* Selection Actions */}
            <AnimatePresence>
              {selectedChatIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 rounded-xl shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                        {selectedChatIds.length} selected
                      </Badge>
                      <span className="text-blue-900 dark:text-blue-100 text-sm font-medium">
                        {selectedChatIds.length === 1 ? 'conversation' : 'conversations'}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedChatIds([])}
                        className="h-8 px-3 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      >
                        Clear selection
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                        className="h-8 px-3 bg-red-500 hover:bg-red-600 text-white"
                      >
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        Delete selected
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

      {/* Content Area with Enhanced Styling */}
      <div className="px-6 py-6">
        {/* Helpful shortcuts hint */}
        {filteredChats.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 text-xs text-black/50 dark:text-white/50 flex items-center gap-4"
          >
            <span>💡 <kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-200 rounded text-xs">Ctrl+A</kbd> Select all</span>
            <span><kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-200 rounded text-xs">Del</kbd> Delete selected</span>
            <span><kbd className="px-1.5 py-0.5 bg-light-200 dark:bg-dark-200 rounded text-xs">Esc</kbd> Clear selection</span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {filteredChats.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[400px]"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="p-4 bg-light-secondary dark:bg-dark-secondary rounded-xl inline-block mb-4"
                >
                  {getEmptyStateContent().icon}
                </motion.div>
                
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="text-lg font-medium text-black dark:text-white mb-2"
                >
                  {getEmptyStateContent().title}
                </motion.h3>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="text-black/60 dark:text-white/60 text-sm mb-6"
                >
                  {getEmptyStateContent().description}
                </motion.p>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  {getEmptyStateContent().showClearSearch ? (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Clear search
                    </button>
                  ) : (
                    <Link
                      href="/"
                      className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start new thread
                    </Link>
                  )}
                </motion.div>
              </div>
            </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-light-secondary dark:bg-dark-secondary rounded-2xl border border-light-200 dark:border-dark-200 shadow-sm overflow-hidden"
          >
            {/* Results count */}
            <div className="px-4 py-3 border-b border-light-200/50 dark:border-dark-200/50 bg-light-100/30 dark:bg-dark-100/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-black/70 dark:text-white/70">
                    {filteredChats.length} {filteredChats.length === 1 ? 'conversation' : 'conversations'}
                  </span>
                  {selectedChatIds.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedChatIds.length} selected
                    </Badge>
                  )}
                </div>
                {filteredChats.length > 5 && (
                  <span className="text-xs text-black/50 dark:text-white/50">
                    Use keyboard shortcuts for faster selection
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-1 max-h-[calc(100vh-400px)] overflow-y-auto">
              <AnimatedChatList
                chats={filteredChats}
                selectedChatIds={selectedChatIds}
                onChatSelect={handleChatSelect}
                onChatDelete={(chatId) => {
                  setSelectedChatIds([chatId]);
                  setIsDeleteDialogOpen(true);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>      {/* Batch Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-red-100 dark:bg-red-950/30 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <AlertDialogTitle className="text-lg font-semibold text-black dark:text-white">
                Delete Multiple Conversations
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-black/70 dark:text-white/70 leading-relaxed">
              Are you sure you want to delete{' '}
              <Badge variant="destructive" className="mx-1">
                {selectedChatIds.length} conversation{selectedChatIds.length !== 1 ? 's' : ''}
              </Badge>
              ? This action cannot be undone and all messages in these conversations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* Statistics */}
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg p-3 my-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-800 dark:text-red-300">
                {selectedChatIds.length} conversation{selectedChatIds.length !== 1 ? 's' : ''} selected for deletion
              </span>
            </div>
          </div>

          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel 
              className="bg-transparent hover:bg-light-100 dark:hover:bg-dark-100 text-black dark:text-white border-light-200 dark:border-dark-200"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white border-0 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Deleting {selectedChatIds.length}...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {selectedChatIds.length} conversation{selectedChatIds.length > 1 ? 's' : ''}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Page;