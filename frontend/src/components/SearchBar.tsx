import { useState } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export function SearchBar({ onSubmit, loading }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://github.com/owner/repo"
        required
        disabled={loading}
        style={{
          flex: 1,
          padding: '10px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        style={{
          padding: '10px 20px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  );
}
