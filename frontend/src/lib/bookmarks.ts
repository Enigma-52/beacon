import { useEffect, useState } from 'react';

export interface Bookmark {
  repoId: number;
  repoName: string;
  number: number;
  title: string;
  github_url: string;
  saved_at: string;
}

const KEY = 'beacon_bookmarks';
const EVENT = 'beacon:bookmarks';

function read(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Bookmark[];
  } catch {
    return [];
  }
}

function write(bookmarks: Bookmark[]): void {
  localStorage.setItem(KEY, JSON.stringify(bookmarks));
  window.dispatchEvent(new Event(EVENT));
}

export function isBookmarked(repoId: number, number: number): boolean {
  return read().some((b) => b.repoId === repoId && b.number === number);
}

export function toggleBookmark(bookmark: Omit<Bookmark, 'saved_at'>): boolean {
  const all = read();
  const idx = all.findIndex((b) => b.repoId === bookmark.repoId && b.number === bookmark.number);
  if (idx >= 0) {
    all.splice(idx, 1);
    write(all);
    return false;
  }
  write([...all, { ...bookmark, saved_at: new Date().toISOString() }]);
  return true;
}

/** Live-updating bookmark list (reacts to changes from any component). */
export function useBookmarks(): Bookmark[] {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(read);
  useEffect(() => {
    const update = () => setBookmarks(read());
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return bookmarks;
}
