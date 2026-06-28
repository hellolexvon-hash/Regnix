import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import ComplianceCalendar from '../../components/dashboard/comlianceCalender/ComplianceCalendar';
import DocumentGenerator from '../../components/dashboard/documentGenerator/DocumentGenerator';
import ValidationPage from '../../components/dashboard/documentGenerator/ValidationPage';
import DashboardHome from './DashboardHome';
import styles from './DashboardPage.module.css';

function renderView(section: string) {
  switch (section) {
    case 'calendar':   return <ComplianceCalendar />;
    case 'generator':  return <DocumentGenerator />;
    case 'validation': return <ValidationPage />;
    default:           return <DashboardHome />;
  }
}

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ section?: string; sub?: string }>();
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false); // default closed to give DocumentGenerator more space

  // Use params.section for the top-level view — NOT params.sub.
  // This ensures /dashboard/validation/level1 still renders ValidationPage,
  // which internally reads params.sub to show the correct sub-screen.
  const activeView = params.section || 'dashboard';

  const handleNavigate = (id: string) => {
    if (id === 'dashboard') navigate('/dashboard');
    else navigate(`/dashboard/${id}`);
  };

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className={styles.layout}>
      <DashboardSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        activeView={activeView}
        onNavigate={handleNavigate}
      />
      <div className={styles.main}>
        <DashboardHeader onAiToggle={() => setAiOpen(v => !v)} aiOpen={aiOpen} />
        <div className={styles.contentRow}>
          <div className={styles.content}>
            {renderView(activeView)}
          </div>
          {aiOpen && <AiAssistantPanel onClose={() => setAiOpen(false)} activeView={activeView} />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AI ASSISTANT PANEL — context-aware for Document Generator
───────────────────────────────────────────────────────────── */
interface Message { role: 'ai' | 'user'; text: string; }

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  generator: [
    'Which acts apply to a 50-person IT company in Karnataka?',
    'What is mandatory in the Factories Act register?',
    'Explain EPF contribution rates for 2024–25',
    'What registers are needed under POSH Act?',
  ],
  default: [
    'Show me overdue compliance items',
    'What filings are due this month?',
    'Summarise my audit findings',
    'Which registers need updating?',
  ],
};

function AiAssistantPanel({ onClose, activeView }: { onClose: () => void; activeView: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hi! I'm your Regnix AI compliance assistant. Ask me anything about applicable acts, register requirements, or compliance filings." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = CONTEXT_SUGGESTIONS[activeView] ?? CONTEXT_SUGGESTIONS.default;

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a knowledgeable Indian labour law and compliance assistant for Regnix, a compliance management platform. 
You help audit teams understand applicable acts, statutory registers, filing deadlines, and compliance requirements under Indian law.
Keep answers concise and practical. Use bullet points where helpful. Focus on accuracy for Indian jurisdiction.`,
          messages: [...messages, userMsg].map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.find((b: any) => b.type === 'text')?.text ?? 'Sorry, I could not get a response.';
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Network error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <aside className={styles.aiPanel}>
      <div className={styles.aiHeader}>
        <div className={styles.aiHeaderLeft}>
          <div className={styles.aiMsgAvatar}>
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M2 3.5C2 2.95 2.45 2.5 3 2.5H7.5C9.43 2.5 11 4.07 11 6C11 7.93 9.43 9.5 7.5 9.5H6.25V12H4.5V9.5H3C2.45 9.5 2 9.05 2 8.5V3.5Z" fill="white"/>
              <path d="M7.5 9.5H8.75L11 12H9.25L7.5 9.5Z" fill="rgba(255,255,255,0.55)"/>
            </svg>
          </div>
          <div>
            <span className={styles.aiTitle}>AI Assistant</span>
            <span className={styles.aiOnline}>● Online</span>
          </div>
        </div>
        <button className={styles.aiClose} onClick={onClose}>✕</button>
      </div>

      <div className={styles.aiMessages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.aiMsg} ${m.role === 'user' ? styles.aiMsgUser : ''}`}>
            {m.role === 'ai' && (
              <div className={styles.aiMsgAvatar}>
                <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                  <path d="M2 3.5C2 2.95 2.45 2.5 3 2.5H7.5C9.43 2.5 11 4.07 11 6C11 7.93 9.43 9.5 7.5 9.5H6.25V12H4.5V9.5H3C2.45 9.5 2 9.05 2 8.5V3.5Z" fill="white"/>
                  <path d="M7.5 9.5H8.75L11 12H9.25L7.5 9.5Z" fill="rgba(255,255,255,0.55)"/>
                </svg>
              </div>
            )}
            <div className={m.role === 'ai' ? styles.aiMsgBubble : styles.userMsgBubble}>
              {m.text.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)}
            </div>
          </div>
        ))}
        {loading && (
          <div className={styles.aiMsg}>
            <div className={styles.aiMsgAvatar}>
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                <path d="M2 3.5C2 2.95 2.45 2.5 3 2.5H7.5C9.43 2.5 11 4.07 11 6C11 7.93 9.43 9.5 7.5 9.5H6.25V12H4.5V9.5H3C2.45 9.5 2 9.05 2 8.5V3.5Z" fill="white"/>
                <path d="M7.5 9.5H8.75L11 12H9.25L7.5 9.5Z" fill="rgba(255,255,255,0.55)"/>
              </svg>
            </div>
            <div className={styles.aiMsgBubble}>
              <span className={styles.typingDots}><span/><span/><span/></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.aiSuggestions}>
        <div className={styles.aiSuggLabel}>Suggested questions</div>
        {suggestions.map(s => (
          <button key={s} className={styles.aiSugg} onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className={styles.aiInputRow}>
        <input
          className={styles.aiInput}
          placeholder="Ask about compliance, acts, registers…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(input); }}
          disabled={loading}
        />
        <button className={styles.aiSend} onClick={() => send(input)} disabled={loading || !input.trim()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}