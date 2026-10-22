'use client';

import { useState } from 'react';
import {
  Play, Check, ChevronDown, ChevronUp, Terminal, Search, Users, Mail, 
  Send, Zap, Calendar, Settings, AlertTriangle, Info, Copy, Github, 
  ExternalLink, RefreshCw, Clock, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

const steps = [
  {
    id: 'setup',
    title: 'One-Time Setup',
    description: 'Configure your environment and connect accounts',
    duration: '10 min',
    commands: [
      { cmd: 'git clone https://github.com/xneshaniy/outreach2.0', desc: 'Clone the repository' },
      { cmd: 'cd marketing-dashboard', desc: 'Enter project directory' },
      { cmd: 'corepack enable && pnpm install --frozen-lockfile', desc: 'Install dependencies' },
    ],
    checks: [
      'Node.js 20+ installed',
      'pnpm 10+ available (corepack)',
      'Neon PostgreSQL project created',
      'Vercel account connected to GitHub',
    ],
    envVars: [
      { key: 'DATABASE_URL', desc: 'Neon PostgreSQL connection string (pooled)', required: true },
      { key: 'AUTH_USER', desc: 'Admin username for dashboard login', required: true },
      { key: 'AUTH_PASS', desc: 'Admin password (min 10 chars)', required: true },
      { key: 'API_KEY', desc: 'Random 48-char secret for API/webhook auth', required: true },
      { key: 'AUTH_COOKIE_SECURE', desc: 'Set to "true" for HTTPS deployments', required: true },
      { key: 'HERMES_HOST_LOCK', desc: 'Your domain(s), e.g. "outreach.click,www.outreach.click"', required: true },
      { key: 'GOOGLE_CLIENT_ID', desc: 'Optional: Google OAuth client ID', required: false },
      { key: 'GOOGLE_CLIENT_SECRET', desc: 'Optional: Google OAuth secret', required: false },
      { key: 'GOOGLE_REDIRECT_URI', desc: 'Optional: OAuth callback URL', required: false },
    ],
  },
  {
    id: 'migrate',
    title: 'Database Migration',
    description: 'Push schema to Neon and verify tables',
    duration: '2 min',
    commands: [
      { cmd: 'pnpm db:push', desc: 'Run Drizzle schema push (requires DATABASE_URL)' },
      { cmd: 'pnpm db:generate', desc: 'Optional: generate migration files' },
    ],
    checks: [
      'All 20+ tables created in Neon',
      'Indexes and constraints applied',
      'Seed data can be inserted',
    ],
  },
  {
    id: 'seed',
    title: 'Seed Demo Data',
    description: 'Populate with sample leads, content, and metrics',
    duration: '30 sec',
    commands: [
      { cmd: 'pnpm seed', desc: 'Insert 60 days of demo data' },
    ],
    checks: [
      '18 leads across tiers A/B/C',
      '20 content posts (published/draft/pending)',
      '35 engagements, 22 signals, 4 experiments',
      '60 days of daily metrics',
      'Activity log with realistic timeline',
    ],
  },
  {
    id: 'dev',
    title: 'Local Development',
    description: 'Run the dashboard locally with hot reload',
    duration: 'Ongoing',
    commands: [
      { cmd: 'pnpm dev', desc: 'Start Next.js on http://localhost:3000' },
      { cmd: 'pnpm lint', desc: 'Check code style' },
      { cmd: 'pnpm typecheck', desc: 'TypeScript validation' },
      { cmd: 'pnpm test', desc: 'Run unit tests (19/21 pass)' },
    ],
    checks: [
      'Dashboard loads at localhost:3000',
      'Login with AUTH_USER / AUTH_PASS',
      'All tabs render: CRM, Outreach, Content, Analytics, Agents, Automations',
    ],
  },
  {
    id: 'deploy',
    title: 'Deploy to Vercel',
    description: 'Push to GitHub → Vercel auto-deploys',
    duration: '3 min',
    commands: [
      { cmd: 'git push origin main', desc: 'Trigger Vercel deployment' },
    ],
    checks: [
      'Vercel builds successfully (Next.js 16)',
      'Environment variables configured in Vercel dashboard',
      'Custom domain outreach.click added in Vercel',
      'DNS pointed to Vercel nameservers',
      'SSL certificate auto-provisioned',
    ],
  },
  {
    id: 'daily',
    title: 'Daily Campaign Loop',
    description: 'The 5-step operator workflow you run each day',
    duration: '15-30 min/day',
    commands: [
      { cmd: '1. Research → /research', desc: 'Scan X for pain/hiring/launch signals' },
      { cmd: '2. Engage → /engagement', desc: 'Reply, quote-tweet, follow high-relevance accounts' },
      { cmd: '3. Discover → /crm', desc: 'Convert signals to leads, enrich, assign tier' },
      { cmd: '4. Create → /content', desc: 'Draft posts/threads, submit for approval' },
      { cmd: '5. Outreach → /outreach', desc: 'Queue sequences, approve, send' },
    ],
    checks: [
      'Signals logged with relevance (high/med/low)',
      'Engagements tracked (replies, quotes, follows)',
      'Leads flow: new → validated → contacted → replied → interested → booked',
      'Content approved → published → metrics tracked',
      'Sequences approved → sent → replies triaged',
    ],
  },
  {
    id: 'monitor',
    title: 'Monitor & Iterate',
    description: 'Weekly review of experiments and KPIs',
    duration: 'Weekly',
    commands: [
      { cmd: 'Experiments → /experiments', desc: 'Propose, run, decide on A/B tests' },
      { cmd: 'KPIs → /analytics', desc: 'Weekly funnel: leads, sends, reply rate, booked calls' },
      { cmd: 'Cycle Time → Dashboard', desc: 'Lead → approved cycle time benchmark' },
      { cmd: 'Memory → /memory', desc: 'Agent drift, duplicates, coverage alerts' },
    ],
    checks: [
      'Experiments have clear hypothesis + win threshold',
      'Decisions logged: SCALE / ITERATE / KILL',
      'Learnings applied to sequences and content',
      'Cycle time trending down (target < 24h median)',
    ],
  },
];

export default function CampaignGuidePage() {
  const [expanded, setExpanded] = useState<string | null>('setup');
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const toggleStep = (id: string) => {
    setExpanded(expanded === id ? null : id);
  };

  const toggleComplete = (id: string) => {
    setCompleted(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allComplete = Object.keys(completed).filter(k => completed[k]).length;
  const totalSteps = steps.length;

  const copyCommands = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    const text = step.commands.map(c => c.cmd).join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Zap size={20} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Campaign Runbook</h1>
                <p className="text-sm text-muted-foreground">outreach2.0 — End-to-end operator guide</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm font-medium text-primary hover:underline">
                ← Back to Dashboard
              </Link>
              <a 
                href="https://github.com/xneshaniy/outreach2.0" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <Github size={16} /> View Repo
              </a>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{allComplete} / {totalSteps} steps completed</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(allComplete / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Step List */}
          <aside className="lg:col-span-1">
            <div className="panel sticky top-24 space-y-2">
              <h3 className="font-semibold px-4 py-2 border-b">Steps</h3>
              <nav className="p-2 space-y-1">
                {steps.map((step, idx) => (
                  <button
                    key={step.id}
                    onClick={() => toggleStep(step.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      expanded === step.id 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-muted">
                      {completed[step.id] ? <Check size={12} className="text-success" /> : idx + 1}
                    </span>
                    <span className="flex-1 truncate">{step.title}</span>
                    {completed[step.id] && <Check size={14} className="text-success" />}
                  </button>
                ))}
              </nav>
              
              {/* Quick Actions */}
              <div className="border-t p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Commands</h4>
                <div className="space-y-1 text-xs font-mono bg-muted/50 p-2 rounded">
                  <div className="flex items-center justify-between">
                    <span>Start dev server</span>
                    <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">pnpm dev</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Push schema</span>
                    <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">pnpm db:push</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Seed data</span>
                    <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">pnpm seed</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Run tests</span>
                    <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">pnpm test</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Typecheck</span>
                    <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">pnpm typecheck</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lint</span>
                    <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">pnpm lint</kbd>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {steps.map(step => (
              <StepCard
                key={step.id}
                step={step}
                isExpanded={expanded === step.id}
                isCompleted={completed[step.id]}
                onToggle={toggleStep}
                onComplete={toggleComplete}
                onCopyCommands={copyCommands}
              />
            ))}

            {/* Footer - Architecture */}
            <div className="panel">
              <h3 className="section-title px-4 pb-2 flex items-center gap-2">
                <Settings size={16} />
                Architecture Overview
              </h3>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal size={16} className="text-primary" />
                    <span className="font-semibold">Local-First</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    SQLite/Neon DB, auth, and state run locally. External services (X, LinkedIn, GA4, Plausible) are optional connectors via server-side env vars.
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-success" />
                    <span className="font-semibold">Operator-Led</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Approvals, pauses, writebacks, and host-access controls remain visible. No autonomous execution without human review.
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-warning" />
                    <span className="font-semibold">Observable</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Full audit trail, experiment tracking, cycle-time benchmarks, and agent session visibility built-in.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepCard({ 
  step, 
  isExpanded, 
  isCompleted, 
  onToggle, 
  onComplete, 
  onCopyCommands 
}: { 
  step: typeof steps[0];
  isExpanded: boolean;
  isCompleted: boolean;
  onToggle: (id: string) => void;
  onComplete: (id: string) => void;
  onCopyCommands: (id: string) => void;
}) {
  return (
    <div className="panel group">
      <button
        onClick={() => onToggle(step.id)}
        className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isCompleted ? 'bg-success/10 text-success' : 
          isExpanded ? 'bg-primary/10 text-primary' : 
          'bg-muted text-muted-foreground'
        }`}>
          {isCompleted ? <Check size={20} /> : <Play size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{step.title}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
              {step.duration}
            </span>
            {isCompleted && <Check size={14} className="text-success" />}
          </div>
          <p className="text-sm text-muted-foreground truncate">{step.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onCopyCommands(step.id); }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Copy commands"
          >
            <Copy size={16} />
          </button>
          <ChevronDown 
            size={20} 
            className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 pb-4 space-y-6 animate-in">
          {/* Description */}
          <div>
            <h4 className="font-medium text-sm mb-2">What this step does</h4>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>

          {/* Commands */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">Commands</h4>
              <button
                onClick={() => onCopyCommands(step.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy size={12} /> Copy all
              </button>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2 overflow-x-auto">
              {step.commands.map((cmd, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-muted-foreground shrink-0">$</span>
                  <code className="flex-1 truncate">{cmd.cmd}</code>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {step.commands.map((cmd, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-muted flex items-center justify-center text-[10px]">{idx + 1}</span>
                  <span>{cmd.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Checks */}
          <div>
            <h4 className="font-medium text-sm mb-2">Verification Checks</h4>
            <div className="space-y-2">
              {step.checks.map((check, idx) => (
                <label key={idx} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">{check}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Environment Variables (for setup step) */}
          {step.envVars && (
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Settings size={14} />
                Required Environment Variables
              </h4>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2 overflow-x-auto">
                {step.envVars.map((env, idx) => (
                  <div key={idx} className="flex items-center gap-3 flex-wrap">
                    <span className="text-primary">{env.key}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-muted-foreground/60 flex-1 min-w-[200px] truncate">
                      {env.required ? '(required)' : '(optional)'} {env.desc}
                    </span>
                    {env.required && <AlertTriangle size={12} className="text-warning" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Button */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              onClick={() => onComplete(step.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isCompleted
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {isCompleted ? <Check size={16} /> : <Play size={16} />}
              {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
            </button>
            <span className="text-xs text-muted-foreground">
              {isCompleted ? '✓ Done' : 'Click when finished'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}