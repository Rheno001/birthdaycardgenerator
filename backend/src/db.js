require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Local fallback database file path when process.env.DATABASE_URL is not set
const LOCAL_DB_PATH = path.join(__dirname, '../data/db.json');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
}

let pool = null;
let isPg = false;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    isPg = true;
    console.log('[DB] Connected to Neon PostgreSQL Database.');
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL, falling back to local database store:', err.message);
  }
}

// Local memory/JSON helper
const getLocalData = () => {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initial = {
      members: [
        {
          id: 1,
          name: "John Doe",
          email: "john.doe@example.com",
          birthday: "06-15",
          picture: "",
          designation: "Software Engineer",
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: "Jane Smith",
          email: "jane.smith@example.com",
          birthday: "03-22",
          picture: "",
          designation: "Product Manager",
          created_at: new Date().toISOString()
        }
      ],
      logs: [],
      settings: {
        resend_api_key: "",
        sender_email: "onboarding@resend.dev",
        quote_text: "Wishing you a beautiful day with good health and happiness forever.",
        logo_url: ""
      }
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
};

const saveLocalData = (data) => {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
};

// Database Initialization
async function initDB() {
  if (isPg && pool) {
    let client;
    try {
      client = await pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          birthday VARCHAR(20) NOT NULL,
          picture TEXT,
          designation VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS email_logs (
          id SERIAL PRIMARY KEY,
          member_id INT,
          member_name VARCHAR(255),
          member_email VARCHAR(255),
          status VARCHAR(50),
          resend_id VARCHAR(255),
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT
        );
      `);
      console.log('[DB] Neon PostgreSQL tables verified.');
    } catch (err) {
      console.error('[DB] Schema init error, using local fallback:', err.message);
      isPg = false;
    } finally {
      if (client) client.release();
    }
  } else {
    getLocalData(); // Ensures local JSON file exists
    console.log('[DB] Using local JSON storage mode (Set DATABASE_URL env var for Neon PostgreSQL).');
  }
}

// Data methods
const db = {
  initDB,
  
  // Members
  async getMembers() {
    if (isPg && pool) {
      try {
        const res = await pool.query('SELECT * FROM members ORDER BY id DESC');
        return res.rows;
      } catch (e) {
        console.error('[DB] PostgreSQL query failed, using local store:', e.message);
        return getLocalData().members || [];
      }
    } else {
      const data = getLocalData();
      return data.members || [];
    }
  },

  async addMember({ name, email, birthday, picture, designation }) {
    if (isPg && pool) {
      try {
        const res = await pool.query(
          'INSERT INTO members (name, email, birthday, picture, designation) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [name, email, birthday, picture || '', designation || '']
        );
        return res.rows[0];
      } catch (e) {
        console.error('[DB] PostgreSQL insert failed, fallback to local:', e.message);
      }
    }
    
    const data = getLocalData();
    const newMember = {
      id: Date.now(),
      name,
      email,
      birthday,
      picture: picture || '',
      designation: designation || '',
      created_at: new Date().toISOString()
    };
    data.members.unshift(newMember);
    saveLocalData(data);
    return newMember;
  },

  async updateMember(id, { name, email, birthday, picture, designation }) {
    if (isPg && pool) {
      try {
        const res = await pool.query(
          'UPDATE members SET name=$1, email=$2, birthday=$3, picture=$4, designation=$5 WHERE id=$6 RETURNING *',
          [name, email, birthday, picture, designation, id]
        );
        return res.rows[0];
      } catch (e) {
        console.error('[DB] PostgreSQL update failed, fallback to local:', e.message);
      }
    }
    
    const data = getLocalData();
    const idx = data.members.findIndex(m => m.id == id);
    if (idx !== -1) {
      data.members[idx] = { ...data.members[idx], name, email, birthday, picture, designation };
      saveLocalData(data);
      return data.members[idx];
    }
    return null;
  },

  async deleteMember(id) {
    if (isPg && pool) {
      try {
        await pool.query('DELETE FROM members WHERE id=$1', [id]);
        return { success: true };
      } catch (e) {
        console.error('[DB] PostgreSQL delete failed, fallback to local:', e.message);
      }
    }
    
    const data = getLocalData();
    data.members = data.members.filter(m => m.id != id);
    saveLocalData(data);
    return { success: true };
  },

  async getMembersWithBirthdayToday() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const targetMMDD = `${month}-${day}`;

    const members = await this.getMembers();
    return members.filter(m => {
      if (!m.birthday) return false;
      const parts = m.birthday.split('-');
      if (parts.length === 3) {
        return `${parts[1]}-${parts[2]}` === targetMMDD;
      } else if (parts.length === 2) {
        return `${parts[0]}-${parts[1]}` === targetMMDD;
      }
      return false;
    });
  },

  // Email Logs
  async logEmailSent({ member_id, member_name, member_email, status, resend_id }) {
    if (isPg && pool) {
      try {
        const res = await pool.query(
          'INSERT INTO email_logs (member_id, member_name, member_email, status, resend_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [member_id, member_name, member_email, status, resend_id || '']
        );
        return res.rows[0];
      } catch (e) {
        console.error('[DB] PostgreSQL log insert failed:', e.message);
      }
    }
    
    const data = getLocalData();
    const log = {
      id: Date.now(),
      member_id,
      member_name,
      member_email,
      status,
      resend_id: resend_id || '',
      sent_at: new Date().toISOString()
    };
    if (!data.logs) data.logs = [];
    data.logs.unshift(log);
    saveLocalData(data);
    return log;
  },

  async getEmailLogs() {
    if (isPg && pool) {
      try {
        const res = await pool.query('SELECT * FROM email_logs ORDER BY id DESC LIMIT 50');
        return res.rows;
      } catch (e) {
        console.error('[DB] PostgreSQL get logs failed:', e.message);
      }
    }
    
    const data = getLocalData();
    return data.logs || [];
  },

  // Settings
  async getSettings() {
    if (isPg && pool) {
      try {
        const res = await pool.query('SELECT * FROM settings');
        const map = {};
        res.rows.forEach(r => map[r.key] = r.value);
        return map;
      } catch (e) {
        console.error('[DB] PostgreSQL get settings failed:', e.message);
      }
    }
    
    const data = getLocalData();
    return data.settings || {};
  },

  async saveSettings(settingsObj) {
    if (isPg && pool) {
      try {
        for (const [key, value] of Object.entries(settingsObj)) {
          await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            [key, String(value)]
          );
        }
        return true;
      } catch (e) {
        console.error('[DB] PostgreSQL save settings failed:', e.message);
      }
    }
    
    const data = getLocalData();
    data.settings = { ...data.settings, ...settingsObj };
    saveLocalData(data);
    return true;
  }
};

module.exports = db;
