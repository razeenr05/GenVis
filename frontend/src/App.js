import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, FileText, BarChart3, Loader2, Github } from 'lucide-react';
import './App.css';
import GenVisLogo from './assets/genvis.png';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('ideation');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Form states
  const [industry, setIndustry] = useState('');
  const [problemArea, setProblemArea] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [targetPersona, setTargetPersona] = useState('');
  const [sprintName, setSprintName] = useState('');
  const [completedItems, setCompletedItems] = useState('');
  const [integrationStatus, setIntegrationStatus] = useState(null);

  // Handlers
  const handleIdeation = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/ideate`, {
        industry,
        problem_area: problemArea,
      });
      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleRequirements = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/requirements`, {
        feature_name: featureName,
        target_persona: targetPersona,
      });
      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const items = completedItems.split('\n').filter((i) => i.trim());
      const response = await axios.post(`${API_URL}/api/report`, {
        sprint_name: sprintName,
        completed_items: items,
      });
      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const pushToJira = async () => {
    if (!result || !result.user_stories) return;

    try {
      const response = await axios.post(`${API_URL}/api/jira/push`, result.user_stories);
      alert(`Successfully created ${response.data.data.length} stories in Jira.`);
    } catch {
      alert('Failed to push to Jira');
    }
  };

  const sendToSlack = async () => {
    if (!result) return;

    try {
      await axios.post(`${API_URL}/api/slack/send`, result);
      alert('Sprint summary posted to #product-updates.');
    } catch {
      alert('Failed to send to Slack');
    }
  };

  const normalizeArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === '') return [];
    return [value];
  };

  const normalizeObjectArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === 'object') return [value];
    return [];
  };

  const formatPainPoint = (text) => {
    if (!text) return '';
    if (typeof text !== 'string') return text;
    return text.replace(/^\s*\d+[\.\)]\s*/, '').trim() || text;
  };

  const PillList = ({ items, icon = '' }) => {
    const list = normalizeArray(items);
    if (!list.length) return null;
    return (
      <div className="pill-list">
        {list.map((item, idx) => (
          <span key={`${item}-${idx}`} className="pill">
            {icon && <span className="pill-icon">{icon}</span>}
            {item}
          </span>
        ))}
      </div>
    );
  };

  const MarketMetrics = ({ data }) => {
    if (!data) return null;
    const entries = [
      { label: 'Total Addressable Market (TAM)', value: data.tam },
      { label: 'Serviceable Available Market (SAM)', value: data.sam },
      { label: 'Serviceable Obtainable Market (SOM)', value: data.som },
    ].filter((m) => m.value);

    if (!entries.length) return null;

    return (
      <div className="metrics-grid compact">
        {entries.map((metric) => (
          <div key={metric.label} className="metric-card market-card">
            <h4>{metric.label}</h4>
            <p className="metric-value">{metric.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { key: 'ideation', icon: <Brain size={18} />, label: 'Ideation' },
    { key: 'requirements', icon: <FileText size={18} />, label: 'Requirements' },
    { key: 'reporting', icon: <BarChart3 size={18} />, label: 'Reporting' },
  ];

  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label || 'Ideation';

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/activity`);
        if (mounted) {
          setIntegrationStatus(response.data.data || response.data);
        }
      } catch {
        if (mounted) {
          setIntegrationStatus(null);
        }
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Not yet';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60 * 1000) return 'Just now';
    if (diffMs < 10 * 60 * 1000) {
      const mins = Math.floor(diffMs / (60 * 1000));
      return `${mins}m ago`;
    }
    if (diffMs < 30 * 60 * 1000) return '10m ago';
    if (diffMs < 60 * 60 * 1000) return '30m ago';
    if (diffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      return `${hours}h ago`;
    }
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  };

  const statusData = integrationStatus || {};
  const jiraStatus = statusData.jira || {};
  const slackStatus = statusData.slack || {};
  const insightStatus = statusData.insights || {};

  return (
    <div className="App">
      <header className="header">
        <div className="brand">
          <div className="brand-top">
            <img src={GenVisLogo} alt="GenVis logo" className="logo-image" />
            <h1>GenVis</h1>
          </div>
          <p className="brand-tagline">Generative Vision Product Manager Studio</p>
        </div>
        <span className="badge">PNC × NVIDIA HackUTD 2025</span>
      </header>
      <div className="integration-status-strip">
        <div className="status-item">
          <p className="status-title">Last Jira Sync</p>
          <p className="status-value">{formatRelativeTime(jiraStatus.last_sync) || 'Not yet'}</p>
          <p className="status-subtitle">
            {`${jiraStatus.new_stories || 0} new • ${jiraStatus.total_synced || 0} total • ${
              jiraStatus.completed_items || 0
            } done`}
          </p>
        </div>
        <div className="status-item">
          <p className="status-title">Last Slack Broadcast</p>
          <p className="status-value">{formatRelativeTime(slackStatus.last_post) || 'Not yet'}</p>
          <p className="status-subtitle">
            {slackStatus.last_summary
              ? `"${slackStatus.last_summary}"`
              : `Channel ${slackStatus.channel || '#product-updates'}`}
          </p>
        </div>
        <div className="status-item">
          <p className="status-title">Last AI Run</p>
          <p className="status-value">{formatRelativeTime(insightStatus.updated_at) || 'Not yet'}</p>
          <p className="status-subtitle">
            {`${insightStatus.pain_points || 0} pain points • ${insightStatus.product_ideas || 0} ideas • ${
              insightStatus.user_stories || 0
            } stories`}
          </p>
        </div>
      </div>

      <nav className="top-nav">
        <div className="top-nav-inner">
          {tabs.map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'active' : ''}
              onClick={() => {
                setActiveTab(key);
                setResult(null);
                setError(null);
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="container">
        <main className="content">
          {error && <div className="alert error"> {String(error)}</div>}

          {/* IDEATION */}
          {activeTab === 'ideation' && (
            <div className="workflow-content">
              <h2>Product Ideation Assistant</h2>
              <p>
                Generate product ideas, pain points, and customer personas with AI, then turn them into
                actionable insights for requirements and Jira planning.
              </p>

              <form onSubmit={handleIdeation} className="form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Industry</label>
                    <input
                      type="text"
                      placeholder="e.g., Banking, FinTech, Retail"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Problem Area</label>
                    <input
                      type="text"
                      placeholder="e.g., Customer Onboarding, Fraud Detection"
                      value={problemArea}
                      onChange={(e) => setProblemArea(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
                    <>
                      <Loader2 className="spin" size={16} /> Analyzing...
                    </>
                  ) : (
                    'Generate Ideas'
                  )}
                </button>
              </form>

              {result && (
                <div className="results">
                  <details className="reasoning-trace">
                    <summary>Reasoning Trace</summary>
                    {normalizeArray(result.reasoning_trace).map((step, idx) => (
                      <p key={idx}>
                        <strong>Step {idx + 1}:</strong> {step}
                      </p>
                    ))}
                  </details>

                  <div className="result-section">
                    <h3>Identified Pain Points</h3>
                    <ol className="pain-list">
                      {normalizeArray(result.pain_points).map((pain, idx) => (
                        <li key={idx}>
                          <span className="pain-index">{idx + 1}.</span>
                          <span>{formatPainPoint(pain)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="result-section">
                    <h3>Product Ideas</h3>
                    {normalizeObjectArray(result.product_ideas).map((idea, idx) => (
                      <div key={idx} className="card">
                        <h4>{idea.name}</h4>
                        <p>{idea.description}</p>
                        {idea.pain_points_addressed && (
                          <small>
                            Addresses pain points: {normalizeArray(idea.pain_points_addressed).join(', ')}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="result-section">
                    <h3>Customer Personas</h3>
                    <div className="persona-grid">
                      {normalizeObjectArray(result.personas).map((persona, idx) => (
                        <div key={idx} className="card">
                          <h4>{persona.name}</h4>
                          <p>
                            <em>{persona.role}</em>
                          </p>
                          <p>
                            <strong>Goals:</strong> {persona.goals}
                          </p>
                          <p>
                            <strong>Frustrations:</strong> {persona.frustrations}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="result-section">
                    <h3>Market Opportunity</h3>
                    <MarketMetrics data={result.market_opportunity} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="workflow-content">
              <h2>Requirements Generator</h2>
              <p>
                Automate product planning by generating user stories and acceptance criteria with AI.
                Instantly sync them to Jira as backlog tasks for your development workflow.
              </p>

              <form onSubmit={handleRequirements} className="form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Feature Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Budget Analytics Dashboard"
                      value={featureName}
                      onChange={(e) => setFeatureName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Persona</label>
                    <select
                      value={targetPersona}
                      onChange={(e) => setTargetPersona(e.target.value)}
                      required
                    >
                      <option value="">Select persona...</option>
                      <option value="Product Manager">Product Manager</option>
                      <option value="Engineering Lead">Engineering Lead</option>
                      <option value="Consumer">Consumer</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="spin" size={16} /> Generating...
                    </>
                  ) : (
                    'Generate Requirements'
                  )}
                </button>
              </form>

              {result && (
                <div className="results">
                  <details className="reasoning-trace">
                    <summary>Reasoning Trace</summary>
                    {normalizeArray(result.reasoning_trace).map((step, idx) => (
                      <p key={idx}>
                        <strong>Step {idx + 1}:</strong> {step}
                      </p>
                    ))}
                  </details>

                  <div className="result-section">
                    <h3>User Stories</h3>
                    {normalizeObjectArray(result.user_stories).map((story, idx) => (
                      <div key={idx} className="card">
                        <h4>
                          Story #{idx + 1}: {story.title}
                        </h4>
                        <p>
                          <strong>Description:</strong> {story.description}
                        </p>
                        <p>
                          <strong>Acceptance Criteria:</strong>
                        </p>
                        <ul>
                          {normalizeArray(story.acceptance_criteria).map((ac, i) => (
                            <li key={i}>{ac}</li>
                          ))}
                        </ul>
                        <div className="story-meta">
                          <span className="badge">Story Points: {story.story_points}</span>
                          {story.dependencies && (
                            <span className="badge">
                              Dependencies: {normalizeArray(story.dependencies).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn-secondary" onClick={pushToJira}>
                    Push to Jira
                  </button>
                </div>
              )}
            </div>
          )}
          {/* REPORTING */}
          {activeTab === 'reporting' && (
            <div className="workflow-content">
              <h2>Sprint Reporting</h2>
              <p>
                Generate executive summaries and stakeholder updates automatically. Instantly push reports
                directly to Slack for team visibility and streamlined sprint communication.
              </p>

              <form onSubmit={handleReport} className="form">
                <div className="form-group">
                  <label>Sprint Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Sprint 12 – AI Assistant Integration"
                    value={sprintName}
                    onChange={(e) => setSprintName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Completed Items (one per line)</label>
                  <textarea
                    rows="5"
                    placeholder={`Implemented dark mode\nOptimized mobile performance\nAdded export feature`}
                    value={completedItems}
                    onChange={(e) => setCompletedItems(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="spin" size={16} /> Generating...
                    </>
                  ) : (
                    'Generate Report'
                  )}
                </button>
              </form>

              {result && (
                <div className="results">
                  <details className="reasoning-trace">
                    <summary>Reasoning Trace</summary>
                    {normalizeArray(result.reasoning_trace).map((step, idx) => (
                      <p key={idx}>
                        <strong>Step {idx + 1}:</strong> {step}
                      </p>
                    ))}
                  </details>

                  <div className="result-section">
                    <h3>Executive Summary</h3>
                    <p className="summary">{result.executive_summary}</p>
                  </div>

                  <div className="result-section">
                    <h3>Sprint Metrics</h3>
                    <div className="metrics-grid">
                      {Object.entries(result.metrics || {}).map(([key, value]) => (
                        <div key={key} className="metric-card">
                          <h4>{key}</h4>
                          <p className="metric-value">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="result-section">
                    <h3>Achievements</h3>
                    <ul>
                      {normalizeArray(result.achievements).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="result-section">
                    <h3>Blockers & Risks</h3>
                    {normalizeArray(result.blockers).map((b, idx) => (
                      <div key={idx} className="alert warning">
                        {b}
                      </div>
                    ))}
                  </div>

                  <div className="result-section">
                    <h3>Next Sprint Recommendations</h3>
                    {normalizeArray(result.next_sprint_recommendations).map((rec, idx) => (
                      <div key={idx} className="alert info">
                        {rec}
                      </div>
                    ))}
                  </div>

                  <button className="btn-secondary" onClick={sendToSlack}>
                    Send to Slack
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <footer className="footer-bar">
        <div className="footer-info">
          <span>Contact: <a href="mailto:genvis2025@gmail.com">genvis2025@gmail.com</a></span>
        </div>
        <div className="footer-actions">
          <a
            href="https://github.com/razeenr05/GenVis"
            className="utility-icon"
            aria-label="GenVis GitHub repository"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={18} />
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
