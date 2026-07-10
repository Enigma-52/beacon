import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatches } from '../api';
import type { MatchedIssue } from '../types';
import { Nav } from '../components/Nav';
import { ScoreRing, DifficultyChip } from '../components/ui';

const SKILL_SUGGESTIONS = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'React', 'Node.js', 'Docker', 'SQL'];
const LEVELS = [
  { value: 'beginner', label: 'New to OSS' },
  { value: 'intermediate', label: 'Comfortable with code' },
  { value: 'advanced', label: 'Experienced contributor' },
] as const;

export function MatchPage() {
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [interests, setInterests] = useState('');
  const [matches, setMatches] = useState<MatchedIssue[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function addSkill(raw: string) {
    const s = raw.trim();
    if (s && !skills.some((k) => k.toLowerCase() === s.toLowerCase())) {
      setSkills([...skills, s]);
    }
    setSkillInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skills.length) return;
    setLoading(true);
    setError(null);
    setMatches(null);
    try {
      const res = await getMatches(
        skills,
        level,
        interests.split(',').map((s) => s.trim()).filter(Boolean)
      );
      setMatches(res.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Matching failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <Nav />
      <main className="page-main" style={{ maxWidth: 760 }}>
        <header style={{ margin: 'var(--sp-6) 0' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--sp-2)' }}>
            Find <span className="accent-word">your</span> issue.
          </h1>
          <p style={{ color: 'var(--muted)', maxWidth: 520 }}>
            Tell Beacon what you know and it ranks every open pick across all tracked
            repos by how well it fits you.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 'var(--sp-5)' }}>
          <label className="eyebrow" htmlFor="skill-input" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
            Your skills
          </label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-2)' }}>
            {skills.map((s) => (
              <button
                key={s}
                type="button"
                className="chip chip-sea"
                style={{ cursor: 'pointer' }}
                onClick={() => setSkills(skills.filter((k) => k !== s))}
                title="Remove"
              >
                {s} ✕
              </button>
            ))}
          </div>
          <input
            id="skill-input"
            className="input"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); }
            }}
            placeholder="Type a skill and press Enter…"
          />
          <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
            {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).map((s) => (
              <button key={s} type="button" className="followup-chip" onClick={() => addSkill(s)}>
                + {s}
              </button>
            ))}
          </div>

          <label className="eyebrow" style={{ display: 'block', margin: 'var(--sp-4) 0 var(--sp-2)' }}>
            Experience level
          </label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                className={`btn ${level === l.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setLevel(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <label className="eyebrow" htmlFor="interests" style={{ display: 'block', margin: 'var(--sp-4) 0 var(--sp-2)' }}>
            Interests <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional, comma-separated)</span>
          </label>
          <input
            id="interests"
            className="input"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="testing, docs, performance…"
          />

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 'var(--sp-4)', width: '100%' }}
            disabled={loading || !skills.length}
          >
            {loading ? 'Matching…' : 'Match me with issues'}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        {matches && (
          <section style={{ marginTop: 'var(--sp-6)' }}>
            <p className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>
              {matches.length ? `Top ${matches.length} matches for you` : 'No matches yet'}
            </p>
            {matches.length === 0 && (
              <div className="empty-state">
                <p>No tracked repos have issues matching that profile yet.</p>
                <button className="btn btn-primary" onClick={() => navigate('/analyze')}>Analyze a repo</button>
              </div>
            )}
            <div className="stagger">
              {matches.map((m) => (
                <div key={`${m.repo_id}-${m.issue.number}`} className="card card-hover">
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                    <ScoreRing score={m.fit_score} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <button
                          className="repo-name"
                          style={{ fontSize: 13, color: 'var(--muted)' }}
                          onClick={() => navigate(`/r/${m.repo_id}`)}
                        >
                          {m.repo_url.replace('https://github.com/', '')}
                        </button>
                        <DifficultyChip difficulty={m.issue.difficulty} />
                      </div>
                      <a href={m.issue.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-strong)', fontWeight: 600 }}>
                        #{m.issue.number} {m.issue.title}
                      </a>
                      <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: '6px 0 0' }}>{m.fit_reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
