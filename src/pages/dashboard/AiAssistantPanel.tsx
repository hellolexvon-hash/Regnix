/**
 * src/pages/dashboard/AiAssistantPanel.tsx
 * Regnix AI agent: animated avatar, server-side answers (key never in the browser),
 * context-aware suggestions, copy / retry, a Help tab (e-book docs) and a Support tab.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentMark, Icon, type IconName } from './Icons';
import { portalFetch } from './dashboardApi';
import styles from './DashboardPage.module.css';
import x from './DashboardExtras.module.css';

interface Message { role: 'ai' | 'user'; text: string; }

export const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  generator: [
    'Which acts apply to a 50-person IT company in Karnataka?',
    'What is mandatory in the Factories Act register?',
    'Explain EPF contribution rates for 2024–25',
    'What registers are needed under POSH Act?',
  ],
  validation: ['Why is my audit score low?', 'What does the auditor check at Level 3?', 'How do I fix a PF mismatch?', 'Which documents are mandatory?'],
  planner:    ['What is due this month?', 'Explain the audit stages', 'How long does an audit take?', 'What happens if changes are requested?'],
  documents:  ['Which documents should I upload?', 'Are my files stored securely?', 'Why is a file missing in Zoho?', 'What file types are accepted?'],
  default: [
    'Show me overdue compliance items',
    'What filings are due this month?',
    'Summarise my audit findings',
    'Which registers need updating?',
  ],
};

export const EBOOK = [
  { id: 'start',  icon: 'book' as IconName,   title: 'Getting started with Regnix', text: 'Set up your company, upload registers and run your first validation.', to: '/dashboard/validation' },
  { id: 'reg',    icon: 'file' as IconName,   title: 'Statutory registers guide',   text: 'Which registers each Act requires, formats and retention periods.', to: '/dashboard/library' },
  { id: 'pf',     icon: 'shield' as IconName, title: 'EPF, ESIC & wage rules',      text: 'Contribution rates, wage ceilings and the EPS / EPF split explained.', to: '/dashboard/checker' },
  { id: 'audit',  icon: 'award' as IconName,  title: 'Audit & certificate process', text: 'Level 1 → 3 validation, auditor review and certificate issue.', to: '/dashboard/planner' },
];

function Rich({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  const bullets = lines.filter((l) => /^\s*[•\-*]\s+/.test(l));
  if (bullets.length === lines.length && lines.length > 1) {
    return <ul className={x.richList}>{lines.map((l, i) => <li key={i}>{l.replace(/^\s*[•\-*]\s+/, '')}</li>)}</ul>;
  }
  return <>{lines.map((l, i) => <span key={i}>{l}<br /></span>)}</>;
}

export function AiAssistantPanel({ onClose, activeView }: { onClose: () => void; activeView: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'chat' | 'help' | 'support'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hi! I'm your Regnix AI compliance assistant. Ask me about applicable acts, registers, filing dates or your audit status." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const suggestions = CONTEXT_SUGGESTIONS[activeView] ?? CONTEXT_SUGGESTIONS.default;

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next: Message[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await portalFetch('cli-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: activeView, messages: next.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })) }),
      });
      const data = await res.json().catch(() => null);
      setMessages((p) => [...p, { role: 'ai', text: data?.reply ?? data?.message ?? 'Sorry, I could not get a response.' }]);
    } catch {
      setMessages((p) => [...p, { role: 'ai', text: 'Network error. Please try again.' }]);
    } finally { setLoading(false); }
  };

  const copy = async (i: number) => {
    try { await navigator.clipboard.writeText(messages[i].text); setCopied(i); window.setTimeout(() => setCopied(null), 1200); } catch { /* ignore */ }
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, tab]);

  const Avatar = ({ small }: { small?: boolean }) => (
    <div className={`${x.agentOrb} ${small ? x.agentSm : ''} ${loading && !small ? x.agentThinking : ''}`}>
      <AgentMark size={small ? 12 : 15} />{!small && <span className={x.agentEyes} />}
    </div>
  );

  return (
    <aside className={styles.aiPanel}>
      <div className={styles.aiHeader}>
        <div className={styles.aiHeaderLeft}>
          <Avatar />
          <div>
            <span className={styles.aiTitle}>Regnix AI</span>
            <span className={styles.aiOnline}>● {loading ? 'Thinking…' : 'Online'}</span>
          </div>
        </div>
        <div className={x.agentTools}>
          <button className={x.agentTool} title="New chat" aria-label="New chat" onClick={() => setMessages([messages[0]])}><Icon name="refresh" size={12} /></button>
          <button className={styles.aiClose} onClick={onClose} aria-label="Close"><Icon name="x" size={12} /></button>
        </div>
      </div>

      <div className={x.tabs} role="tablist">
        {([['chat', 'Assistant', 'chat'], ['help', 'Docs', 'book'], ['support', 'Support', 'life']] as [typeof tab, string, IconName][]).map(([id, label, ic]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`${x.tab} ${tab === id ? x.tabOn : ''}`} onClick={() => setTab(id)}>
            <Icon name={ic} size={12} />{label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <>
          <div className={styles.aiMessages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.aiMsg} ${m.role === 'user' ? styles.aiMsgUser : ''}`}>
                {m.role === 'ai' && <Avatar small />}
                <div className={m.role === 'ai' ? styles.aiMsgBubble : styles.userMsgBubble}>
                  <Rich text={m.text} />
                  {m.role === 'ai' && i > 0 && (
                    <div className={x.msgActions}>
                      <button className={x.msgBtn} onClick={() => copy(i)}>{copied === i ? 'Copied' : 'Copy'}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className={styles.aiMsg}>
                <Avatar small />
                <div className={styles.aiMsgBubble}><span className={styles.typingDots}><span /><span /><span /></span></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className={styles.aiSuggestions}>
            <div className={styles.aiSuggLabel}>Suggested questions</div>
            {suggestions.map((s) => <button key={s} className={styles.aiSugg} onClick={() => send(s)}>{s}</button>)}
          </div>
          <div className={styles.aiInputRow}>
            <input className={styles.aiInput} placeholder="Ask about compliance, acts, registers…" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(input); }} disabled={loading} />
            <button className={styles.aiSend} onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Send"><Icon name="send" size={13} /></button>
          </div>
        </>
      )}

      {tab === 'help' && (
        <div className={x.helpBody}>
          <div className={styles.aiSuggLabel}>E-book & documentation</div>
          {EBOOK.map((b) => (
            <button key={b.id} className={x.helpItem} onClick={() => navigate(b.to)}>
              <span className={x.hubIcon} style={{ width: 32, height: 32 }}><Icon name={b.icon} size={15} /></span>
              <span><span className={x.helpItemTitle} style={{ display: 'block' }}>{b.title}</span><span className={x.helpItemText}>{b.text}</span></span>
            </button>
          ))}
        </div>
      )}

      {tab === 'support' && (
        <div className={x.helpBody}>
          <div className={styles.aiSuggLabel}>Chat support</div>
          <button className={x.helpItem} onClick={() => { setTab('chat'); void send('I need help with my account'); }}>
            <span className={x.hubIcon} style={{ width: 32, height: 32 }}><Icon name="chat" size={15} /></span>
            <span><span className={x.helpItemTitle} style={{ display: 'block' }}>Ask the AI agent</span><span className={x.helpItemText}>Instant answers, available 24/7.</span></span>
          </button>
          <div className={x.contactBox}>
            <strong style={{ color: '#0F0A1E' }}>Need a human?</strong>
            Our compliance team replies within one business day.
            <a href="mailto:support@regnix.in"><Icon name="mail" size={13} />support@regnix.in</a>
          </div>
        </div>
      )}
    </aside>
  );
}
