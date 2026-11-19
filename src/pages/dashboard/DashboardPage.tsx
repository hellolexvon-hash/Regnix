import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import ComplianceCalendar from '../../components/dashboard/comlianceCalender/ComplianceCalendar';
import DocumentGenerator from '../../components/dashboard/documentGenerator/DocumentGenerator';
import ValidationPage from '../../components/dashboard/documentGenerator/ValidationPage';
import DashboardHome from './DashboardHome';
import DocumentsPage from './DocumentsPage';
import AuditPlannerPage from './AuditPlannerPage';
import { AiAssistantPanel } from './AiAssistantPanel';
import { LibraryPage } from '@/pages/library/LibraryPage';
import CalculatorPage from '@/pages/checker/calculator/CalculatorPage';
import styles from './DashboardPage.module.css';

function renderView(section: string) {
  switch (section) {
    case 'calendar':   return <ComplianceCalendar />;
    case 'generator':  return <DocumentGenerator />;
    case 'validation': return <ValidationPage />;
    case 'library':    return <LibraryPage />;
    case 'checker':    return <CalculatorPage />;
    case 'planner':    return <AuditPlannerPage />;
    case 'documents':  return <DocumentsPage />;
    default:           return <DashboardHome />;
  }
}

export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuth();
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
    if (!loading && !isAuthenticated) navigate('/login', { replace: true });
  }, [isAuthenticated, loading, navigate]);

  if (loading) return null;
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
