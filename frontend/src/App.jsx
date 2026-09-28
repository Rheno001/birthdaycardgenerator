import React, { useState, useEffect, useRef } from 'react';
import CardPreview from './components/CardPreview';

const API_BASE = import.meta.env.VITE_API_URL || '';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const TABS = [
  { id: 'members', label: 'Team Members', icon: '👥' },
  { id: 'studio',  label: 'Card Studio',  icon: '🎨' },
  { id: 'logs',    label: 'Email Logs',   icon: '📋' },
  { id: 'settings',label: 'Settings',     icon: '⚙️' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers]     = useState([]);
  const [logs, setLogs]           = useState([]);
  const [quoteText, setQuoteText] = useState('Wishing you a beautiful day with good health and happiness forever.');
  const [searchQuery, setSearchQuery]   = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const cardRef = useRef(null);

  const [memberForm, setMemberForm] = useState({
    name: '', email: '', birthdayMonth: '01', birthdayDay: '01', picture: '', designation: ''
  });

  const [selectedPreviewMember, setSelectedPreviewMember] = useState(null);
  const [studioQuote, setStudioQuote] = useState('Wishing you a beautiful day with good health and happiness forever.');
  const [loadingKey, setLoadingKey] = useState(null);
  const [toastMsg, setToastMsg]     = useState(null);

  const isLoading = (key) => loadingKey === key;
  const startLoad = (key) => setLoadingKey(key);
  const stopLoad  = ()    => setLoadingKey(null);

  useEffect(() => { fetchMembers(); fetchLogs(); fetchSettings(); }, []);

  const showToast = (msg, type = 'info') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4200);
  };

  const fetchMembers = async () => {
    try {
      const res  = await fetch(API_BASE + '/api/members');
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
        if (data.data.length > 0 && !selectedPreviewMember) setSelectedPreviewMember(data.data[0]);
      }
    } catch (e) { console.error('Failed to fetch members:', e); }
  };

  const fetchLogs = async () => {
    startLoad('fetch-logs');
    try {
      const res  = await fetch(API_BASE + '/api/logs');
      const data = await res.json();
      if (data.success) setLogs(data.data);
    } catch (e) { console.error('Failed to fetch logs:', e); }
    finally { stopLoad(); }
  };

  const fetchSettings = async () => {
    try {
      const res  = await fetch(API_BASE + '/api/settings');
      const data = await res.json();
      if (data.success && data.data?.quote_text) {
        setQuoteText(data.data.quote_text);
        setStudioQuote(data.data.quote_text);
      }
    } catch (e) { console.error('Failed to fetch settings:', e); }
  };

  const parseBirthdayParts = (bdayStr) => {
    if (!bdayStr) return { month: '01', day: '01' };
    const parts = bdayStr.split('-');
    if (parts.length === 3) return { month: parts[1], day: parts[2] };
    if (parts.length === 2) return { month: parts[0], day: parts[1] };
    return { month: '01', day: '01' };
  };

  const handleOpenAddModal = () => {
    setEditingMember(null);
    setMemberForm({ name: '', email: '', birthdayMonth: '01', birthdayDay: '01', picture: '', designation: '' });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (member) => {
    setEditingMember(member);
    const { month, day } = parseBirthdayParts(member.birthday);
    setMemberForm({ name: member.name, email: member.email, birthdayMonth: month, birthdayDay: day, picture: member.picture || '', designation: member.designation || '' });
    setShowAddModal(true);
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    startLoad('save-member');
    try {
      const url    = editingMember ? `${API_BASE}/api/members/${editingMember.id}` : API_BASE + '/api/members';
      const method = editingMember ? 'PUT' : 'POST';
      const birthdayFormatted = `${memberForm.birthdayMonth}-${memberForm.birthdayDay.padStart(2, '0')}`;
      const payload = { name: memberForm.name, email: memberForm.email, birthday: birthdayFormatted, picture: memberForm.picture, designation: memberForm.designation };
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        showToast(editingMember ? 'Member updated!' : 'New member added!', 'success');
        setShowAddModal(false);
        setEditingMember(null);
        fetchMembers();
      } else { showToast(`Error: ${data.error}`, 'error'); }
    } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
    finally { stopLoad(); }
  };

  const handleDeleteMember = async (id) => {
    if (!confirm('Delete this team member?')) return;
    startLoad(`delete-${id}`);
    try {
      const res  = await fetch(`${API_BASE}/api/members/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showToast('Member removed.', 'info'); fetchMembers(); }
    } catch (e) { showToast('Failed to delete.', 'error'); }
    finally { stopLoad(); }
  };

  const handleSendCardNow = async (member) => {
    const key = `send-${member.id}`;
    startLoad(key);
    showToast(`Sending card to ${member.name}...`, 'info');
    try {
      const res  = await fetch(`${API_BASE}/api/members/${member.id}/send-card`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { showToast(`Card sent to ${member.name}!`, 'success'); fetchLogs(); }
      else               { showToast(`Send failed: ${data.error}`, 'error'); }
    } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
    finally { stopLoad(); }
  };

  const handleDownloadStudioCard = () => {
    if (cardRef.current) {
      cardRef.current.downloadCard(`CPP_Birthday_Card_${(selectedPreviewMember?.name || 'Member').replace(/\s+/g, '_')}.png`);
      showToast('Card downloaded!', 'success');
    }
  };

  const handleDownloadMemberCardDirect = async (member) => {
    startLoad(`download-${member.id}`);
    showToast(`Generating card for ${member.name}...`, 'info');
    try {
      const query = new URLSearchParams({ name: member.name, designation: member.designation || '', picture: member.picture || '', quote: quoteText }).toString();
      const response = await fetch(`${API_BASE}/api/card/preview?${query}`);
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CPP_Birthday_Card_${member.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`Downloaded card for ${member.name}!`, 'success');
    } catch (e) { showToast('Failed to download.', 'error'); }
    finally { stopLoad(); }
  };

  const handleTriggerDailyCron = async () => {
    startLoad('cron');
    showToast('Running birthday check...', 'info');
    try {
      const res  = await fetch(API_BASE + '/api/cron/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success) { showToast(`Check complete — ${data.report.checkedCount} birthday(s) found today.`, 'success'); fetchLogs(); }
    } catch (e) { showToast('Trigger failed.', 'error'); }
    finally { stopLoad(); }
  };

  const handleSaveQuote = async (e) => {
    e.preventDefault();
    startLoad('save-quote');
    try {
      const res  = await fetch(API_BASE + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_text: quoteText }) });
      const data = await res.json();
      if (data.success) showToast('Quote saved!', 'success');
    } catch (e) { showToast('Failed to save quote.', 'error'); }
    finally { stopLoad(); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    startLoad('upload');
    const formData = new FormData();
    formData.append('file', file);
    try {
      showToast('Uploading photo to Cloudinary...', 'info');
      const res  = await fetch(API_BASE + '/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setMemberForm((prev) => ({ ...prev, picture: data.url }));
        showToast('Photo uploaded!', 'success');
      } else {
        showToast(`Upload failed: ${data.error}`, 'error');
      }
    } catch (err) { showToast(`Upload failed: ${err.message}`, 'error'); }
    finally { stopLoad(); }
  };

  const isBirthdayToday = (bdayStr) => {
    if (!bdayStr) return false;
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day   = String(today.getDate()).padStart(2, '0');
    const parts = bdayStr.split('-');
    if (parts.length === 3) return `${parts[1]}-${parts[2]}` === `${month}-${day}`;
    if (parts.length === 2) return `${parts[0]}-${parts[1]}` === `${month}-${day}`;
    return false;
  };

  const formatDisplayBirthday = (bdayStr) => {
    if (!bdayStr) return '—';
    const parts = bdayStr.split('-');
    let m = '01', d = '01';
    if (parts.length === 3) { m = parts[1]; d = parts[2]; }
    else if (parts.length === 2) { m = parts[0]; d = parts[1]; }
    const mItem  = MONTHS.find(item => item.value === m);
    const mLabel = mItem ? mItem.label.substring(0, 3) : m;
    return `${mLabel} ${parseInt(d, 10)}`;
  };

  const resolveAvatar = (picture) =>
    (picture && picture.replace(/^http:\/\/localhost:\d+/, API_BASE)) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

  const todaysBirthdaysCount = members.filter(m => isBirthdayToday(m.birthday)).length;
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.designation && m.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusChipClass = (status) => {
    if (status.includes('sent')) return 'sent';
    if (status.includes('simulated')) return 'simulated';
    return 'failed';
  };

  return (
    <div className="app-container">

      {/* ── Toast ── */}
      {toastMsg && (
        <div className={`toast ${toastMsg.type}`}>
          <span>{toastMsg.type === 'success' ? '✓' : toastMsg.type === 'error' ? '✕' : 'ℹ'}</span>
          {toastMsg.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="top-header">
        <div className="brand">
          <img src="/cpp-log.png" alt="Compliance Professionals PLC" className="brand-logo-img" />
          <div className="brand-divider" />
          <div>
            <div className="brand-title">Birthday Card Generator</div>
            <div className="brand-sub">Compliance Professionals PLC</div>
          </div>
        </div>

        <div className="header-actions">
          {todaysBirthdaysCount > 0 && (
            <div className="birthday-counter">
              🎉 Today's Birthdays
              <span className="birthday-counter-num">{todaysBirthdaysCount}</span>
            </div>
          )}
          <button className="btn-secondary" onClick={handleTriggerDailyCron} disabled={!!loadingKey}>
            {isLoading('cron') ? <><span className="btn-spinner-dark" /> Checking...</> : '⚡ Run Check'}
          </button>
        </div>
      </header>

      {/* ── Navigation ── */}
      <nav className="nav-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
            {tab.id === 'members' && members.length > 0 && (
              <span style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>
                {members.length}
              </span>
            )}
            {tab.id === 'logs' && logs.length > 0 && (
              <span style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>
                {logs.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="main-content">

        {/* TAB 1: TEAM MEMBERS */}
        {activeTab === 'members' && (
          <div className="card-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Team Members</div>
                <div className="panel-subtitle">Manage profiles — birthday cards are generated and sent automatically.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="search-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search members..."
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={handleOpenAddModal}>
                  + Add Member
                </button>
              </div>
            </div>

            <table className="members-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Birthday</th>
                  <th>Designation</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <div className="empty-state-icon">👤</div>
                        <div className="empty-state-title">No members found</div>
                        <div className="empty-state-desc">Add your first team member to get started with birthday cards.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const isToday = isBirthdayToday(m.birthday);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <img
                              src={resolveAvatar(m.picture)}
                              alt={m.name}
                              className="member-avatar"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
                              }}
                            />
                            <div>
                              <div className="member-name">
                                {m.name}
                                {isToday && <span className="today-chip">🎈 Today!</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{m.email}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: isToday ? 'var(--cpp-green)' : 'var(--text-secondary)', fontSize: '13.5px' }}>
                            📅 {formatDisplayBirthday(m.birthday)}
                          </span>
                        </td>
                        <td>
                          <span className="designation-chip">{m.designation || 'Team Member'}</span>
                        </td>
                        <td>
                          <div className="action-bar">
                            <button className="btn-secondary" onClick={() => { setSelectedPreviewMember(m); setActiveTab('studio'); }}>
                              👁 Preview
                            </button>
                            <button className="btn-secondary" onClick={() => handleDownloadMemberCardDirect(m)} disabled={!!loadingKey} title="Download card">
                              {isLoading(`download-${m.id}`) ? <><span className="btn-spinner-dark" /> ...</> : '↓ Card'}
                            </button>
                            <button className="btn-primary" onClick={() => handleSendCardNow(m)} disabled={!!loadingKey}>
                              {isLoading(`send-${m.id}`) ? <><span className="btn-spinner" /> Sending...</> : '✉ Send'}
                            </button>
                            <button className="btn-secondary" onClick={() => handleOpenEditModal(m)}>
                              ✏ Edit
                            </button>
                            <button className="btn-danger" onClick={() => handleDeleteMember(m.id)} disabled={!!loadingKey}>
                              {isLoading(`delete-${m.id}`) ? <span className="btn-spinner-dark" /> : '🗑'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: CARD STUDIO */}
        {activeTab === 'studio' && (
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
            <div className="card-panel" style={{ alignSelf: 'start' }}>
              <div className="panel-title" style={{ marginBottom: 20 }}>Card Controls</div>

              <div className="form-group">
                <label>Team Member</label>
                <select className="form-input" value={selectedPreviewMember?.id || ''} onChange={(e) => { const m = members.find(item => item.id == e.target.value); if (m) setSelectedPreviewMember(m); }}>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Display Name</label>
                <input type="text" className="form-input" value={selectedPreviewMember?.name || ''} onChange={(e) => setSelectedPreviewMember({ ...selectedPreviewMember, name: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Designation</label>
                <input type="text" className="form-input" value={selectedPreviewMember?.designation || ''} onChange={(e) => setSelectedPreviewMember({ ...selectedPreviewMember, designation: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Birthday Quote</label>
                <textarea className="form-input" rows="3" value={studioQuote} onChange={(e) => setStudioQuote(e.target.value)} />
              </div>

              <div className="divider" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={handleDownloadStudioCard} disabled={!selectedPreviewMember}>
                  ↓ Download Card PNG
                </button>
                <button className="btn-secondary" style={{ justifyContent: 'center' }} onClick={() => handleSendCardNow(selectedPreviewMember)} disabled={!selectedPreviewMember || !!loadingKey}>
                  {isLoading(`send-${selectedPreviewMember?.id}`) ? <><span className="btn-spinner-dark" /> Sending...</> : `✉ Send to ${selectedPreviewMember?.name || '—'}`}
                </button>
              </div>
            </div>

            <div className="card-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Card Preview</div>
                  <div className="panel-subtitle">Compliance Professionals PLC — Birthday Card</div>
                </div>
                <button className="btn-secondary" onClick={handleDownloadStudioCard}>↓ Download</button>
              </div>
              <CardPreview ref={cardRef} member={selectedPreviewMember} quote={studioQuote} logoUrl="/cpp-log.png" />
            </div>
          </div>
        )}

        {/* TAB 3: EMAIL LOGS */}
        {activeTab === 'logs' && (
          <div className="card-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Email Delivery Logs</div>
                <div className="panel-subtitle">Track all birthday email notifications dispatched via Resend.</div>
              </div>
              <button className="btn-secondary" onClick={fetchLogs} disabled={!!loadingKey}>
                {isLoading('fetch-logs') ? <><span className="btn-spinner-dark" /> Refreshing...</> : '↺ Refresh'}
              </button>
            </div>

            <table className="members-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <div className="empty-state-title">No logs yet</div>
                        <div className="empty-state-desc">Email delivery records will appear here once cards are sent.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="member-name">{log.member_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{log.member_email}</td>
                      <td>
                        <span className={`status-chip ${getStatusChipClass(log.status)}`}>
                          {log.status.includes('sent') ? '✓' : log.status.includes('simulated') ? '◎' : '✕'} {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            <div className="card-panel">
              <div className="panel-title" style={{ marginBottom: 6 }}>Default Birthday Quote</div>
              <div className="panel-subtitle" style={{ marginBottom: 20 }}>This quote will appear on all generated birthday cards.</div>
              <form onSubmit={handleSaveQuote}>
                <div className="form-group">
                  <label>Quote Text</label>
                  <textarea className="form-input" rows="5" value={quoteText} onChange={(e) => setQuoteText(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading('save-quote')}>
                  {isLoading('save-quote') ? <><span className="btn-spinner" /> Saving...</> : 'Save Quote'}
                </button>
              </form>
            </div>

            <div className="card-panel">
              <div className="panel-title" style={{ marginBottom: 20 }}>System Information</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="info-card">
                  <span className="info-card-icon">⏰</span>
                  <div>
                    <div className="info-card-title">Automated Daily Cron</div>
                    <div className="info-card-desc">Runs every day at <strong>6:00 AM</strong> server time. Automatically sends birthday cards to any members whose birthday falls on today's date.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Add / Edit Member Modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {editingMember ? '✏️ Edit Member' : '+ Add Team Member'}
            </div>

            <form onSubmit={handleSaveMember}>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" required className="form-input" placeholder="e.g. John Doe" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" required className="form-input" placeholder="john@company.com" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Birthday Month *</label>
                  <select className="form-input" value={memberForm.birthdayMonth} onChange={(e) => setMemberForm({ ...memberForm, birthdayMonth: e.target.value })}>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Birthday Day *</label>
                  <select className="form-input" value={memberForm.birthdayDay} onChange={(e) => setMemberForm({ ...memberForm, birthdayDay: e.target.value })}>
                    {Array.from({ length: 31 }, (_, i) => {
                      const v = String(i + 1).padStart(2, '0');
                      return <option key={v} value={v}>{i + 1}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Designation / Role</label>
                <input type="text" className="form-input" placeholder="e.g. Compliance Officer" value={memberForm.designation} onChange={(e) => setMemberForm({ ...memberForm, designation: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Profile Photo</label>
                {memberForm.picture && (
                  <img src={memberForm.picture} alt="Preview" className="photo-preview-thumb" />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" className="form-input" placeholder="https://... or upload →" value={memberForm.picture} onChange={(e) => setMemberForm({ ...memberForm, picture: e.target.value })} style={{ flex: 1 }} />
                  <label className="btn-secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {isLoading('upload') ? <><span className="btn-spinner-dark" /> Uploading...</> : '📁 Upload'}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={isLoading('upload')} />
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isLoading('save-member')}>
                  {isLoading('save-member') ? <><span className="btn-spinner" /> Saving...</> : editingMember ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
