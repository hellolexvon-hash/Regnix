/**
 * src/pages/dashboard/AiAssistantPanel.tsx
 * Enhanced AI Compliance Agent — extracted from DashboardPage.
 * Adds: animated orb avatar, status states, quick actions, copy, clear chat,
 * lightweight markdown rendering, and a server-side proxy call (no browser API key).
 *
 * Set VITE_AI_ENDPOINT to a Supabase Edge Function / backend route that forwards to the
 * Anthropic API with your key. Calling api.anthropic.com directly from the browser does not work
 * (no key, CORS) and would expose the key if you added one.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, RegnixMark } from '@/components/ui/Icons';
import styles from './AiAssistantPanel.module.css';

interface Message { role: 'ai' | 'user'; text: string; }

const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT as string | undefined;

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  generator: [
    'Which acts apply to a 50-person IT company in Karnataka?',
    'What is mandatory in the Factories Act register?',
    'Explain EPF contribution rates for 2024–25',
    'What registers are needed under POSH Act?',
  ],
  planner: [
    'How should I structure a statutory compliance audit?',
    'What documents do auditors usually request first?',
    'Create an audit checklist for contract labour (CLRA)',
  ],
  documents: [
    'Which documents must be retained for 8 years?',
    'What is the retention period for wage registers?',
    'Which uploaded documents are likely to be expiring?',
  ],
  default: [
    'Show me overdue compliance items',
    'What filings are due this month?',
    'Summarise my audit findings',
    'Which registers need updating?',
  ],
};

const QUICK_ACTIONS = [
  { icon: 'calendar',   label: 'Due filings',   prompt: 'What statutory filings are due this month under Indian labour law?' },
  { icon: 'shieldCheck', label: 'Audit prep',   prompt: 'Give me a pre-audit readiness checklist for a labour law compliance audit.' },
  { icon: 'fileText',   label: 'Registers',     prompt: 'List the statutory registers a company with contract labour must maintain.' },
];

const SYSTEM_PROMPT = `You are Regnix AI, an Indian labour law and compliance assistant for the Regnix platform.
You help audit teams understand applicable acts, statutory registers, filing deadlines and compliance requirements under Indian law.
Be concise and practical, use short bullet points, cite the act/section where you are confident, and say when something varies by state or should be verified with a professional.`;

/* ── tiny markdown renderer: **bold**, `code`, "- " bullets, paragraphs ── */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`'))  return <code key={i} className={styles.code}>{part.slice(1, -1)}</code>;
    return part;
  });
}
function renderRich(text: string): ReactNode {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(<ul key={`u${out.length}`} className={styles.ul}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
      bullets = [];
    }
  };
  text.split('\n').forEach(line => {
    const m = line.match(/^\s*[-•*]\s+(.*)/);
    if (m) bullets.push(m[1]);
    else { flush(); if (line.trim()) out.push(<p key={`p${out.length}`} className={styles.p}>{inline(line.replace(/^#+\s*/, ''))}</p>); }
  });
  flush();
  return out;
}

/** Animated orb — idle float + ring pulse, "thinking" spin when loading. */
export function AiOrb({ size = 28, thinking = false }: { size?: number; thinking?: boolean }) {
  return (
    <span className={`${styles.orb} ${thinking ? styles.orbThinking : ''}`} style={{ width: size, height: size }}>
      <span className={styles.orbRing} />
      <span className={styles.orbCore}><RegnixMark size={Math.round(size * 0.5)} color="#fff" /></span>
      <span className={styles.orbSpark}><Icon name="sparkles" size={Math.round(size * 0.36)} stroke={2.2} /></span>
    </span>
  );
}

export function AiAssistantPanel({ onClose, activeView }: { onClose: () => void; activeView: string }) {
  const WELCOME: Message = {
    role: 'ai',
    text: "Hi! I'm your **Regnix AI compliance agent**. Ask me about applicable acts, register requirements, filing deadlines or audit preparation.",
  };
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = CONTEXT_SUGGESTIONS[activeView] ?? CONTEXT_SUGGESTIONS.default;
  const showIntro = messages.length === 1;

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);

    try {
      if (!AI_ENDPOINT) throw new Error('VITE_AI_ENDPOINT is not configured');
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: 1000,
          system: `${SYSTEM_PROMPT}\nThe user is currently on the "${activeView}" section of the dashboard.`,
          messages: history
            .filter((m, i) => !(i === 0 && m.role === 'ai')) // drop the local greeting
            .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? 'Sorry, I could not get a response.';
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e) {
      const msg = e instanceof Error && e.message.includes('not configured')
        ? 'The AI endpoint is not configured yet. Set `VITE_AI_ENDPOINT` to your backend proxy.'
        : 'I could not reach the assistant. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, i: number) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1400); } catch { /* ignore */ }
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <aside className={styles.aiPanel} aria-label="AI Compliance Assistant">
      <div className={styles.aiHeader}>
        <div className={styles.aiHeaderLeft}>
          <AiOrb size={32} thinking={loading} />
          <div>
            <span className={styles.aiTitle}>Regnix AI Agent</span>
            <span className={styles.aiOnline}>
              <span className={styles.liveDot} />{loading ? 'Thinking…' : 'Online'}
            </span>
          </div>
        </div>
        <div className={styles.headBtns}>
          <button className={styles.aiIconBtn} title="New chat" onClick={() => setMessages([WELCOME])}><Icon name="refresh" size={12} /></button>
          <button className={styles.aiIconBtn} title="Close" onClick={onClose}><Icon name="x" size={12} /></button>
        </div>
      </div>

      <div className={styles.aiMessages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.aiMsg} ${m.role === 'user' ? styles.aiMsgUser : ''}`}>
            {m.role === 'ai' && <AiOrb size={26} />}
            <div className={m.role === 'ai' ? styles.aiMsgBubble : styles.userMsgBubble}>
              {m.role === 'ai' ? renderRich(m.text) : m.text}
              {m.role === 'ai' && i > 0 && (
                <button className={styles.copyBtn} onClick={() => copy(m.text, i)} title="Copy">
                  <Icon name={copied === i ? 'check' : 'clipboard'} size={11} />
                </button>
              )}
            </div>
          </div>
        ))}

        {showIntro && (
          <div className={styles.quickRow}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} className={styles.quickCard} onClick={() => send(a.prompt)}>
                <Icon name={a.icon} size={14} /><span>{a.label}</span>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className={styles.aiMsg}>
            <AiOrb size={26} thinking />
            <div className={styles.aiMsgBubble}><span className={styles.typingDots}><span /><span /><span /></span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showIntro && (
        <div className={styles.aiSuggestions}>
          <div className={styles.aiSuggLabel}>Suggested questions</div>
          {suggestions.map(s => <button key={s} className={styles.aiSugg} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      <div className={styles.aiInputRow}>
        <input
          className={styles.aiInput}
          placeholder="Ask about compliance, acts, registers…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(input); }}
          disabled={loading}
        />
        <button className={styles.aiSend} onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Send">
          <Icon name="send" size={13} stroke={2.3} />
        </button>
      </div>
      <div className={styles.disclaimer}>AI guidance — verify critical items with a legal professional.</div>
    </aside>
  );
}
