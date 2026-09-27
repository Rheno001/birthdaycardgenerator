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

export default function App() {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [quoteText, setQuoteText] = useState('Wishing you a beautiful day with good health and happiness forever.');

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const cardRef = useRef(null);

  // Form State for Member Add/Edit
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    birthdayMonth: '01',
    birthdayDay: '01',
    picture: '',
    designation: ''
  });

  // Preview Member State for Card Studio tab
  const [selectedPreviewMember, setSelectedPreviewMember] = useState(null);
  
  // Custom Card Studio Form state
  const [studioQuote, setStudioQuote] = useState('Wishing you a beautiful day with good health and happiness forever.');

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    fetchMembers();
    fetchLogs();
    fetchSettings();
  }, []);

  const showToast = (msg, type = 'info') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(API_BASE + '/api/members');
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
        if (data.data.length > 0 && !selectedPreviewMember) {
          setSelectedPreviewMember(data.data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch members:', e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(API_BASE + '/api/logs');
      const data = await res.json();
      if (data.success) setLogs(data.data);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(API_BASE + '/api/settings');
      const data = await res.json();
      if (data.success && data.data && data.data.quote_text) {
        setQuoteText(data.data.quote_text);
        setStudioQuote(data.data.quote_text);
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
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
    setMemberForm({
      name: '',
      email: '',
      birthdayMonth: '01',
      birthdayDay: '01',
      picture: '',
      designation: ''
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (member) => {
    setEditingMember(member);
    const { month, day } = parseBirthdayParts(member.birthday);
    setMemberForm({
      name: member.name,
      email: member.email,
      birthdayMonth: month,
      birthdayDay: day,
      picture: member.picture || '',
      designation: member.designation || ''
    });
    setShowAddModal(true);
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingMember ? `\${API_BASE}/api/members/${editingMember.id}` : API_BASE + '/api/members';
      const method = editingMember ? 'PUT' : 'POST';

      const birthdayFormatted = `${memberForm.birthdayMonth}-${memberForm.birthdayDay.padStart(2, '0')}`;

      const payload = {
        name: memberForm.name,
        email: memberForm.email,
        birthday: birthdayFormatted,
        picture: memberForm.picture,
        designation: memberForm.designation
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast(editingMember ? 'Member updated successfully!' : 'New team member added!', 'success');
        setShowAddModal(false);
        setEditingMember(null);
        fetchMembers();
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (id) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    try {
      const res = await fetch(`\${API_BASE}/api/members/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Member deleted.', 'info');
        fetchMembers();
      }
    } catch (e) {
      showToast('Failed to delete member.', 'error');
    }
  };

  const handleSendCardNow = async (member) => {
    setLoading(true);
    showToast(`Generating and sending card email to ${member.email}...`, 'info');
    try {
      const res = await fetch(`\${API_BASE}/api/members/${member.id}/send-card`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Birthday Card successfully sent to ${member.name}!`, 'success');
        fetchLogs();
      } else {
        showToast(`Send failed: ${data.error}`, 'error');
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Download Card Function
  const handleDownloadStudioCard = () => {
    if (cardRef.current) {
      const filename = `CPP_Birthday_Card_${(selectedPreviewMember?.name || 'Member').replace(/\s+/g, '_')}.png`;
      cardRef.current.downloadCard(filename);
      showToast('Birthday card downloaded!', 'success');
    }
  };

  const handleDownloadMemberCardDirect = async (member) => {
    showToast(`Generating card PNG for ${member.name}...`, 'info');
    try {
      const query = new URLSearchParams({
        name: member.name,
        designation: member.designation || '',
        picture: member.picture || '',
        quote: quoteText
      }).toString();

      const response = await fetch(`\${API_BASE}/api/card/preview?${query}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CPP_Birthday_Card_${member.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`Downloaded card for ${member.name}!`, 'success');
    } catch (e) {
      showToast('Failed to download card image.', 'error');
    }
  };

  const handleTriggerDailyCron = async () => {
    setLoading(true);
    showToast('Running daily birthday check...', 'info');
    try {
      const res = await fetch(API_BASE + '/api/cron/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const count = data.report.checkedCount;
        showToast(`Cron completed: Checked birthdays for today. Found ${count} recipient(s).`, 'success');
        fetchLogs();
      }
    } catch (e) {
      showToast('Cron trigger failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuote = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(API_BASE + '/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_text: quoteText })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Default birthday quote updated!', 'success');
      }
    } catch (e) {
      showToast('Failed to update quote.', 'error');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('Uploading image...', 'info');
      const res = await fetch(API_BASE + '/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setMemberForm({ ...memberForm, picture: data.url });
        showToast('Photo uploaded!', 'success');
      }
    } catch (err) {
      showToast('Image upload failed.', 'error');
    }
  };

  const isBirthdayToday = (bdayStr) => {
    if (!bdayStr) return false;
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const parts = bdayStr.split('-');
    if (parts.length === 3) return `${parts[1]}-${parts[2]}` === `${month}-${day}`;
    if (parts.length === 2) return `${parts[0]}-${parts[1]}` === `${month}-${day}`;
    return false;
  };

  const formatDisplayBirthday = (bdayStr) => {
    if (!bdayStr) return 'N/A';
    const parts = bdayStr.split('-');
    let m = '01', d = '01';
    if (parts.length === 3) { m = parts[1]; d = parts[2]; }
    else if (parts.length === 2) { m = parts[0]; d = parts[1]; }
    
    const mItem = MONTHS.find(item => item.value === m);
    const mLabel = mItem ? mItem.label.substring(0, 3) : m;
    return `${mLabel} ${parseInt(d, 10)}`;
  };

  const todaysBirthdaysCount = members.filter(m => isBirthdayToday(m.birthday)).length;

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.designation && m.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: toastMsg.type === 'error' ? '#ef4444' : toastMsg.type === 'success' ? '#22c55e' : '#9abf49',
          color: '#ffffff',
          padding: '14px 24px',
          borderRadius: '10px',
          fontWeight: '700',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          zIndex: 2000
        }}>
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <header className="top-header">
        <div className="brand">
          <img src="/cpp-log.png" alt="Compliance Professionals PLC" className="brand-logo-img" />
          <div>
            <div className="brand-title">Birthday Card Generator</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Compliance Professionals PLC</div>
          </div>
        </div>

        <div className="header-badges">
          <div className="status-badge brand">
            <span>🎉 Today's Birthdays:</span>
            <strong>{todaysBirthdaysCount}</strong>
          </div>
          <button className="btn-primary" onClick={handleTriggerDailyCron} disabled={loading} style={{ fontSize: '13px', padding: '8px 16px' }}>
            ⚡ Run Birthday Check Now
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          👥 Team Members ({members.length})
        </button>
        <button className={`tab-btn ${activeTab === 'studio' ? 'active' : ''}`} onClick={() => setActiveTab('studio')}>
          🎨 Card Studio & Preview
        </button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          📜 Email Delivery Logs ({logs.length})
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ App Overview & Quotes
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* TAB 1: TEAM MEMBERS */}
        {activeTab === 'members' && (
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Team Members Directory</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Manage team member profiles. Birthday cards are generated & sent automatically on their birthday.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Search members..."
                  className="form-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: 220 }}
                />
                <button className="btn-primary" onClick={handleOpenAddModal}>
                  + Add Team Member
                </button>
              </div>
            </div>

            {/* Table */}
            <table className="members-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Birthday (Month & Day)</th>
                  <th>Designation</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No team members found. Click "+ Add Team Member" to populate the database.
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
                              src={m.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              alt={m.name}
                              className="member-avatar"
                            />
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '15px' }}>
                                {m.name}
                                {isToday && <span className="today-chip">🎈 TODAY!</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{m.email}</td>
                        <td>
                          <span style={{ fontWeight: '700', color: isToday ? 'var(--accent-brand-dark)' : 'var(--text-main)' }}>
                            📅 {formatDisplayBirthday(m.birthday)}
                          </span>
                        </td>
                        <td>
                          <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', fontWeight: '600', color: '#334155' }}>
                            {m.designation || 'Specialist'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => {
                                setSelectedPreviewMember(m);
                                setActiveTab('studio');
                              }}
                            >
                              👁️ Preview
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => handleDownloadMemberCardDirect(m)}
                              title="Download PNG Card"
                            >
                              📥 Download
                            </button>
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => handleSendCardNow(m)}
                              disabled={loading}
                            >
                              📧 Send Email
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => handleOpenEditModal(m)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-danger"
                              onClick={() => handleDeleteMember(m.id)}
                            >
                              🗑️
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

        {/* TAB 2: CARD STUDIO & PREVIEW */}
        {activeTab === 'studio' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
            {/* Left Controls */}
            <div className="card-panel">
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: 16 }}>Card Controls</h3>

              <div className="form-group">
                <label>Select Team Member</label>
                <select
                  className="form-input"
                  value={selectedPreviewMember?.id || ''}
                  onChange={(e) => {
                    const m = members.find(item => item.id == e.target.value);
                    if (m) setSelectedPreviewMember(m);
                  }}
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.designation})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedPreviewMember?.name || ''}
                  onChange={(e) => setSelectedPreviewMember({ ...selectedPreviewMember, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Designation / Job Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedPreviewMember?.designation || ''}
                  onChange={(e) => setSelectedPreviewMember({ ...selectedPreviewMember, designation: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Picture URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedPreviewMember?.picture || ''}
                  onChange={(e) => setSelectedPreviewMember({ ...selectedPreviewMember, picture: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Birthday Quote</label>
                <textarea
                  className="form-input"
                  rows="3"
                  value={studioQuote}
                  onChange={(e) => setStudioQuote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                <button
                  className="btn-primary"
                  style={{ justifyContent: 'center' }}
                  onClick={handleDownloadStudioCard}
                  disabled={!selectedPreviewMember}
                >
                  ⬇️ Download Card PNG Image
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'center' }}
                  onClick={() => handleSendCardNow(selectedPreviewMember)}
                  disabled={!selectedPreviewMember}
                >
                  ✉️ Send Card Email To {selectedPreviewMember?.name || 'Member'}
                </button>
              </div>
            </div>

            {/* Right Card Canvas Preview */}
            <div className="card-panel" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Compliance Professionals PLC Card Output</h3>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '6px 14px' }}
                  onClick={handleDownloadStudioCard}
                >
                  📥 Download Image
                </button>
              </div>

              <CardPreview
                ref={cardRef}
                member={selectedPreviewMember}
                quote={studioQuote}
                logoUrl="/cpp-log.png"
              />
            </div>
          </div>
        )}

        {/* TAB 3: EMAIL LOGS */}
        {activeTab === 'logs' && (
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Email Delivery Logs</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Track birthday email notifications dispatched via Resend.
                </p>
              </div>
              <button className="btn-secondary" onClick={fetchLogs}>
                🔄 Refresh Logs
              </button>
            </div>

            <table className="members-table">
              <thead>
                <tr>
                  <th>Recipient Name</th>
                  <th>Recipient Email</th>
                  <th>Status</th>
                  <th>Resend Delivery ID</th>
                  <th>Sent Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No email delivery logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '700' }}>{log.member_name}</td>
                      <td>{log.member_email}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: log.status.includes('sent') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: log.status.includes('sent') ? '#15803d' : '#dc2626'
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td><code style={{ fontSize: '12px', color: 'var(--accent-brand-dark)', fontWeight: '600' }}>{log.resend_id || 'N/A'}</code></td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: APP OVERVIEW & QUOTES */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="card-panel">
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: 16 }}>Default Birthday Card Wish</h3>
              <form onSubmit={handleSaveQuote}>
                <div className="form-group">
                  <label>Default Card Wish Quote Text</label>
                  <textarea
                    className="form-input"
                    rows="4"
                    value={quoteText}
                    onChange={(e) => setQuoteText(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: 4 }}>
                    This quote appears automatically on all generated birthday cards.
                  </small>
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  💾 Save Default Quote
                </button>
              </form>
            </div>

            <div className="card-panel">
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: 16 }}>Backend Status & Service Info</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '14px' }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--accent-brand-dark)', fontWeight: '700' }}>✅ Backend Configuration</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
                    Environment variables configured via backend <code>.env</code> file or host environment settings.
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--accent-brand-dark)', fontWeight: '700' }}>⏰ Automated Daily Cron</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
                    Scheduled daily at <strong>06:00 AM</strong> to send birthday cards to team members whose birthday is today.
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--accent-brand-dark)', fontWeight: '700' }}>🎨 Brand Logo & Theme</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: 4 }}>
                    Branded for <strong>Compliance Professionals PLC</strong> using logo at <code>frontend/assets/cpp-log.png</code>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Add / Edit Member */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: 20 }}>
              {editingMember ? 'Edit Team Member' : 'Add New Team Member'}
            </h3>
            <form onSubmit={handleSaveMember}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Alexander Wright"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="alexander@company.com"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                />
              </div>

              {/* Month and Day Selector (No Year) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Birthday Month *</label>
                  <select
                    className="form-input"
                    value={memberForm.birthdayMonth}
                    onChange={(e) => setMemberForm({ ...memberForm, birthdayMonth: e.target.value })}
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Birthday Day *</label>
                  <select
                    className="form-input"
                    value={memberForm.birthdayDay}
                    onChange={(e) => setMemberForm({ ...memberForm, birthdayDay: e.target.value })}
                  >
                    {Array.from({ length: 31 }, (_, i) => {
                      const dayVal = String(i + 1).padStart(2, '0');
                      return <option key={dayVal} value={dayVal}>{i + 1}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Designation / Role</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Compliance Officer"
                  value={memberForm.designation}
                  onChange={(e) => setMemberForm({ ...memberForm, designation: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Picture URL or Upload File</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://..."
                    value={memberForm.picture}
                    onChange={(e) => setMemberForm({ ...memberForm, picture: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <label className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 12px', fontSize: '13px' }}>
                    📁 Upload
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {editingMember ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
