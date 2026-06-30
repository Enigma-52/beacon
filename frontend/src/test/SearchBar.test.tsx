import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../components/SearchBar';

describe('SearchBar', () => {
  it('renders input and button', () => {
    render(<SearchBar onSubmit={() => {}} loading={false} />);
    expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('calls onSubmit with trimmed url', () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} loading={false} />);
    const input = screen.getByPlaceholderText(/github\.com/i);
    fireEvent.change(input, { target: { value: '  https://github.com/foo/bar  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('https://github.com/foo/bar');
  });

  it('disables button while loading', () => {
    render(<SearchBar onSubmit={() => {}} loading={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows Analyzing text while loading', () => {
    render(<SearchBar onSubmit={() => {}} loading={true} />);
    expect(screen.getByRole('button')).toHaveTextContent('Analyzing');
  });
});
