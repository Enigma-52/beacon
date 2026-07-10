import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export function Nav({ right }: { right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <button className="nav-brand" onClick={() => navigate('/')} aria-label="Beacon home">
        <span className="nav-brand-mark" aria-hidden="true" />
        <span className="nav-brand-name">Beacon</span>
        <span className="badge-beta">BETA</span>
      </button>
      {right ?? <span className="nav-tagline">navigate open source like you've been there before</span>}
    </nav>
  );
}
