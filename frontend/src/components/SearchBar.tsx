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
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--sp-2)' }}>
      <input
        className="input"
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://github.com/owner/repo"
        required
        disabled={loading}
        aria-label="GitHub repository URL"
      />
      <button type="submit" className="btn btn-primary" disabled={loading || !value.trim()}>
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  );
}
