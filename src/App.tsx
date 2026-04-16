/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Share2, 
  Download, 
  Upload, 
  Tag as TagIcon, 
  Search,
  X,
  Check,
  ExternalLink,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface TimestampEntry {
  id: string;
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  timestamp: string; // e.g. "1:23:45"
  seconds: number;
  note: string;
  tag: string;
  createdAt: number;
}

interface VideoGroup {
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  entries: TimestampEntry[];
}

// --- Helpers ---

const STORAGE_KEY = 'yt-timestamps';

const parseYoutubeId = (url: string): string | null => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

const timestampToSeconds = (ts: string): number => {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
};

const secondsToTimestamp = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const fetchVideoMetadata = async (videoId: string) => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) throw new Error('Failed to fetch metadata');
    return await response.json();
  } catch (err) {
    console.error(err);
    return { title: 'Unknown Video', thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` };
  }
};

// --- Components ---

export default function App() {
  const [entries, setEntries] = useState<TimestampEntry[]>([]);
  const [url, setUrl] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState<'import' | 'share' | 'confirmDelete' | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Load from localStorage or Hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decoded = JSON.parse(atob(hash));
        if (Array.isArray(decoded)) {
          setEntries(decoded);
          setIsLoaded(true);
          return;
        }
      } catch (e) {
        console.error('Failed to parse hash data', e);
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setEntries(JSON.parse(saved));
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoaded]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = parseYoutubeId(url);
    if (!videoId) return;

    // Validate timestamp format (basic check)
    if (!/^\d+(:\d{2}){0,2}$/.test(timestamp)) return;

    const meta = await fetchVideoMetadata(videoId);
    const newEntry: TimestampEntry = {
      id: crypto.randomUUID(),
      videoId,
      videoTitle: meta.title,
      thumbnailUrl: meta.thumbnail_url,
      timestamp,
      seconds: timestampToSeconds(timestamp),
      note,
      tag: tag.trim().toLowerCase(),
      createdAt: Date.now(),
    };

    setEntries([newEntry, ...entries]);
    setUrl('');
    setTimestamp('');
    setNote('');
    setTag('');
  };

  const handleTimestampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (val.length > 6) val = val.slice(0, 6); // Limit to hhmmss

    let formatted = '';
    if (val.length > 4) {
      // hh:mm:ss
      const s = val.slice(-2);
      const m = val.slice(-4, -2);
      const h = val.slice(0, -4);
      formatted = `${h}:${m}:${s}`;
    } else if (val.length > 2) {
      // mm:ss
      const s = val.slice(-2);
      const m = val.slice(0, -2);
      formatted = `${m}:${s}`;
    } else {
      formatted = val;
    }
    setTimestamp(formatted);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setIsModalOpen('confirmDelete');
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      setEntries(entries.filter(e => e.id !== pendingDeleteId));
      setPendingDeleteId(null);
      setIsModalOpen(null);
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yt-timestamps-backup.json';
    a.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (Array.isArray(imported)) {
          setEntries([...imported, ...entries]);
          setIsModalOpen(null);
        }
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleShare = () => {
    const compressed = btoa(JSON.stringify(entries));
    const fullUrl = `${window.location.origin}${window.location.pathname}#${compressed}`;
    setShareUrl(fullUrl);
    setIsModalOpen('share');
  };

  const handleShareVideo = (videoId: string) => {
    const videoEntries = entries.filter(e => e.videoId === videoId);
    const compressed = btoa(JSON.stringify(videoEntries));
    const fullUrl = `${window.location.origin}${window.location.pathname}#${compressed}`;
    setShareUrl(fullUrl);
    setIsModalOpen('share');
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesTag = !filterTag || e.tag === filterTag;
      const matchesSearch = !searchQuery || 
        e.note.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.videoTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [entries, filterTag, searchQuery]);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, VideoGroup> = {};
    filteredEntries.forEach(entry => {
      if (!groups[entry.videoId]) {
        groups[entry.videoId] = {
          videoId: entry.videoId,
          videoTitle: entry.videoTitle,
          thumbnailUrl: entry.thumbnailUrl,
          entries: []
        };
      }
      groups[entry.videoId].entries.push(entry);
    });
    return Object.values(groups);
  }, [filteredEntries]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(e => {
      if (e.tag) tags.add(e.tag);
    });
    return Array.from(tags).sort();
  }, [entries]);

  return (
    <div className="min-h-screen bg-bg-natural text-text-main-natural font-sans transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card-natural border-b border-border-natural px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-natural rounded-lg flex items-center justify-center text-white font-bold">
              ▶
            </div>
            <h1 className="font-bold text-xl tracking-tight text-text-main-natural">YT Stamp</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportJSON}
              className="px-4 py-2 bg-card-natural border border-border-natural rounded-lg text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
            <button 
              onClick={() => setIsModalOpen('import')}
              className="px-4 py-2 bg-card-natural border border-border-natural rounded-lg text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              Import Backup
            </button>
            <button 
              onClick={handleShare}
              className="px-4 py-2 bg-primary-natural text-white rounded-lg text-[13px] font-medium hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              Share Collection
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-[320px_1fr] max-w-7xl mx-auto w-full overflow-hidden">
        {/* Sidebar */}
        <aside className="bg-sidebar-natural border-r border-border-natural p-10 flex flex-col gap-8 overflow-y-auto no-scrollbar">
          <div className="bg-card-natural p-5 rounded-xl border border-border-natural shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted-natural">YouTube URL</label>
                <input 
                  type="text" 
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://youtu.be/..."
                  className="w-full bg-[#FAFAFA] border border-border-natural rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary-natural transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted-natural">Timestamp</label>
                  <input 
                    type="text" 
                    value={timestamp}
                    onChange={handleTimestampChange}
                    placeholder="12:45"
                    className="w-full bg-[#FAFAFA] border border-border-natural rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary-natural transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted-natural">Tag</label>
                  <input 
                    type="text" 
                    value={tag}
                    onChange={e => setTag(e.target.value)}
                    placeholder="Startup"
                    className="w-full bg-[#FAFAFA] border border-border-natural rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary-natural transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted-natural">Short Note</label>
                <input 
                  type="text" 
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Key insight..."
                  className="w-full bg-[#FAFAFA] border border-border-natural rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary-natural transition-all"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-primary-natural text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Save Timestamp
              </button>
            </form>
          </div>

          <div>
            <label className="block mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted-natural">Filter by Tag</label>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setFilterTag('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${!filterTag ? 'bg-primary-natural text-white border-primary-natural' : 'bg-card-natural border-border-natural hover:border-primary-natural'}`}
              >
                All
              </button>
              {allTags.map(t => (
                <button 
                  key={t}
                  onClick={() => setFilterTag(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filterTag === t ? 'bg-primary-natural text-white border-primary-natural' : 'bg-card-natural border-border-natural hover:border-primary-natural'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-primary-natural p-5 rounded-xl text-white">
            <div className="text-[12px] opacity-80 uppercase tracking-widest font-medium">Total Saved</div>
            <div className="text-2xl font-bold mt-1">{entries.length} Moments</div>
          </div>
        </aside>

        {/* Content Area */}
        <section className="p-10 flex flex-col gap-6 overflow-y-auto no-scrollbar">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-natural" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes or titles..."
                className="w-full bg-card-natural border border-border-natural rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary-natural transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="space-y-6">
            {groupedEntries.length === 0 && (
              <div className="text-center py-20 opacity-50">
                <Clock className="w-12 h-12 mx-auto mb-4" />
                <p>No timestamps found. Start by adding one!</p>
              </div>
            )}
            
            {groupedEntries.map(group => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={group.videoId} 
                className="bg-card-natural rounded-xl border border-border-natural overflow-hidden"
              >
                <div className="p-4 flex gap-4 bg-black/5 border-b border-border-natural items-center">
                  <div className="w-30 h-17 bg-accent-natural rounded flex-shrink-0 overflow-hidden">
                    <img 
                      src={group.thumbnailUrl} 
                      alt={group.videoTitle}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-grow">
                    <h2 className="font-bold text-base leading-snug line-clamp-2">{group.videoTitle}</h2>
                    <div className="text-xs text-text-muted-natural mt-1">YouTube • {group.videoId}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button 
                      onClick={() => handleShareVideo(group.videoId)}
                      className="p-2 hover:bg-black/5 rounded-full transition-colors text-text-muted-natural hover:text-primary-natural"
                      title="Share this video's timestamps"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <AnimatePresence mode="popLayout">
                    {group.entries.map((entry, idx) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={entry.id}
                        className={`grid grid-cols-[80px_1fr_100px_140px] items-center gap-3 p-4 ${idx !== group.entries.length - 1 ? 'border-b border-border-natural' : ''} hover:bg-gray-50 transition-colors group`}
                      >
                        <div className="font-mono bg-accent-natural px-2 py-1 rounded text-xs font-bold text-center">
                          {entry.timestamp}
                        </div>
                        
                        <p className="text-sm text-text-main-natural truncate pr-4" title={entry.note}>
                          {entry.note}
                        </p>

                        <div className="flex justify-center">
                          {entry.tag && (
                            <span className="text-[11px] px-2.5 py-1 bg-tag-bg-natural text-primary-natural rounded-full border border-primary-natural/20 font-medium">
                              {entry.tag}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex justify-end gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={`https://youtube.com/watch?v=${entry.videoId}&t=${entry.seconds}s`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-card-natural border border-border-natural rounded text-[11px] font-medium hover:bg-gray-50 transition-colors"
                          >
                            ▶ Watch
                          </a>
                          <button 
                            onClick={() => handleDelete(entry.id)}
                            className="w-7 h-7 flex items-center justify-center border border-border-natural rounded bg-white text-text-muted-natural hover:text-red-500 hover:border-red-500 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-auto border-t border-border-natural pt-4 flex justify-between items-center text-text-muted-natural text-[12px]">
            <div>Data saved locally in browser (yt-timestamps)</div>
          </div>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-[#151619] w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-gray-200 dark:border-gray-800"
            >
              <button 
                onClick={() => setIsModalOpen(null)}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {isModalOpen === 'confirmDelete' && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                    <Trash2 className="w-8 h-8 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Delete Timestamp?</h3>
                    <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsModalOpen(null)}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-main-natural font-bold py-3 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmDelete}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {isModalOpen === 'import' && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Import Backup</h3>
                    <p className="text-sm text-white mt-1">Select a previously exported .json file to restore your data.</p>
                  </div>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleImportJSON}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl py-12 hover:border-red-500 transition-colors">
                      <p className="text-white text-sm font-medium">Click or drag file here</p>
                    </div>
                  </div>
                </div>
              )}

              {isModalOpen === 'share' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Share2 className="w-6 h-6 text-red-500" />
                    <h3 className="text-xl font-bold text-white">Share Collection</h3>
                  </div>
                  <p className="text-sm text-white">Anyone with this link can view your saved timestamps (read-only).</p>
                  <div className="flex gap-2">
                    <input 
                      readOnly
                      value={shareUrl}
                      className="grow bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2 text-xs font-mono outline-none text-white"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert('Link copied!');
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 italic">Note: Large collections might result in very long URLs.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-12 border-t border-gray-200 dark:border-gray-800 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-[0.2em] font-bold">
          Built for YouTube Power Users
        </p>
      </footer>
    </div>
  );
}
