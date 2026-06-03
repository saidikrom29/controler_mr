/**
 * MCS v3 — Monitor Control System — Backend
 * Node.js + Express + WebSocket
 * Saidikrom Admin Panel
 */
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const cors      = require('cors');
const path      = require('path');
const os        = require('os');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const frontendDir = __dirname;

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDir));

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// ── State ──
const agents   = new Map();
const agentData = {};
const configuredMonitors = new Map();
const admins   = new Set();
const auditLog = [];
const wifiDevices = new Map(); // discovered devices on WiFi
const validTokens = new Set(); // for session tokens

function ts() { return new Date().toISOString(); }

function addLog(type, msg) {
  const entry = { id: Date.now(), ts: ts(), type, msg };
  auditLog.push(entry);
  if (auditLog.length > 1000) auditLog.shift();
  broadcastAdmins({ type: 'log', entry });
  console.log(`[${type.toUpperCase()}] ${msg}`);
  return entry;
}

function broadcastAdmins(payload) {
  const data = JSON.stringify(payload);
  admins.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function getAgentSnapshot() {
  const result = {};

  configuredMonitors.forEach((cfg, id) => {
    result[id] = {
      monitorId: id,
      status: 'offline',
      info: { room: cfg.room || '—', hostname: '—', os: '—', ...(cfg.info || {}) },
      lastSeen: cfg.lastSeen || '—',
      uptime: cfg.uptime || 0,
    };
  });

  Object.values(agentData).forEach(agent => {
    result[agent.monitorId] = {
      ...result[agent.monitorId],
      ...agent,
      info: { ...result[agent.monitorId]?.info, ...agent.info },
    };
  });

  return Object.values(result);
}

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const result = [];
  Object.entries(interfaces).forEach(([name, addrs]) => {
    addrs.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({ name, address: addr.address, netmask: addr.netmask });
      }
    });
  });
  return result;
}

function scanWifiDevices() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('arp -a', (error, stdout, stderr) => {
      const devices = [];
      if (!error && stdout) {
        const lines = stdout.split('\n');
        lines.forEach(line => {
          // Parse ARP table output (Windows format: IP address - MAC address)
          const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]+)\s+(\w+)/i);
          if (match) {
            const [_, ip, mac, type] = match;
            if (type !== 'static' && mac !== 'ff-ff-ff-ff-ff-ff') {
              devices.push({
                ip,
                mac: mac.toUpperCase(),
                type: type || 'dynamic',
                hostname: '—', // Could be resolved later
                lastSeen: ts()
              });
            }
          }
        });
      }
      // Update wifiDevices map
      devices.forEach(dev => {
        wifiDevices.set(dev.ip, dev);
      });
      resolve(devices);
    });
  });
}

// ── WebSocket handler ──
wss.on('connection', (ws, req) => {
  ws.mcsConnectedAt = ts();

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── AGENT hello ──
    if (msg.type === 'agent_hello') {
      ws.mcsRole    = 'agent';
      ws.mcsId      = msg.monitorId;
      ws.mcsStatus  = 'on';
      ws.mcsInfo    = { ...msg.info };
      ws.mcsLastSeen = ts();
      ws.mcsUptime  = 0;
      agents.set(msg.monitorId, ws);
      agentData[msg.monitorId] = {
        monitorId: msg.monitorId,
        status: 'on',
        info: ws.mcsInfo,
        lastSeen: ts(),
        uptime: 0,
      };
      if (!configuredMonitors.has(msg.monitorId)) {
        configuredMonitors.set(msg.monitorId, { room: msg.info?.room || '—', info: msg.info });
      } else {
        const cfg = configuredMonitors.get(msg.monitorId);
        cfg.info = { ...cfg.info, ...msg.info };
      }

      broadcastAdmins({
        type: 'agent_connected',
        monitorId: msg.monitorId,
        status: 'on',
        info: ws.mcsInfo,
      });
      addLog('ok', `Monitor ${msg.monitorId} (${msg.info?.room || '?'}) — ulandi`);
    }

    // ── ADMIN hello ──
    else if (msg.type === 'admin_hello') {
      if (!msg.token || !validTokens.has(msg.token)) {
        ws.close();
        return;
      }
      ws.mcsRole = 'admin';
      admins.add(ws);

      ws.send(JSON.stringify({ type: 'init', agents: getAgentSnapshot(), logs: auditLog.slice(-200), network: getNetworkInfo() }));
      addLog('info', 'Admin tizimga kirdi');
    }

    // ── STATUS update from agent ──
    else if (msg.type === 'status_update') {
      const agent = agents.get(msg.monitorId);
      if (agent) {
        agent.mcsStatus   = msg.status;
        agent.mcsLastSeen = ts();
        if (msg.data?.uptime) agent.mcsUptime = msg.data.uptime;
      }
      if (agentData[msg.monitorId]) {
        agentData[msg.monitorId].status = msg.status;
        agentData[msg.monitorId].lastSeen = ts();
        if (msg.data?.uptime) agentData[msg.monitorId].uptime = msg.data.uptime;
      }
      broadcastAdmins({ type: 'status_update', monitorId: msg.monitorId, status: msg.status, data: msg.data || {} });
    }

    // ── SCREENSHOT from agent ──
    else if (msg.type === 'screenshot') {
      broadcastAdmins({ type: 'screenshot', monitorId: msg.monitorId, image: msg.image, ts: ts() });
      addLog('info', `Monitor ${msg.monitorId} — screenshot`);
    }

    // ── COMMAND from admin ──
    else if (msg.type === 'command') {
      const { monitorId, command, params } = msg;
      const sent = dispatchCommand(monitorId, command, params);
      if (monitorId === 'all') {
        addLog('warn', `Ommaviy buyruq [${command}] → ${sent} monitor`);
        broadcastAdmins({ type: 'cmd_ack', monitorId: 'all', command, sent });
      } else if (sent) {
        addLog('ok', `Monitor ${monitorId} ← ${command}`);
        broadcastAdmins({ type: 'cmd_ack', monitorId, command, sent: 1 });
      } else {
        addLog('err', `Monitor ${monitorId} offline — ${command} yuborilmadi`);
      }
    }

    // ── WIFI scan request ──
    else if (msg.type === 'wifi_scan') {
      scanWifiDevices().then(devices => {
        const net = getNetworkInfo();
        broadcastAdmins({ type: 'wifi_info', network: net, devices });
      }).catch(err => {
        console.error('WiFi scan error:', err);
        const net = getNetworkInfo();
        broadcastAdmins({ type: 'wifi_info', network: net, devices: [] });
      });
    }
  });

  ws.on('close', () => {
    if (ws.mcsRole === 'agent') {
      agents.delete(ws.mcsId);
      if (agentData[ws.mcsId]) {
        agentData[ws.mcsId].status = 'offline';
        agentData[ws.mcsId].lastSeen = ts();
      }
      broadcastAdmins({ type: 'agent_disconnected', monitorId: ws.mcsId });
      addLog('err', `Monitor ${ws.mcsId} — uzildi`);
    } else if (ws.mcsRole === 'admin') {
      admins.delete(ws);
      addLog('info', 'Admin tizimdan chiqdi');
    }
  });

  ws.on('error', err => console.error('WS error:', err.message));
});

// ── REST API ──
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    agents: getAgentSnapshot(),
    network: getNetworkInfo(),
    uptime: process.uptime(),
    time: ts(),
  });
});

app.post('/api/command', (req, res) => {
  const { monitorId, command, params } = req.body;
  if (!monitorId || !command) return res.status(400).json({ ok: false, error: 'monitorId va command kerak' });

  const sent = dispatchCommand(monitorId, command, params);
  if (monitorId === 'all') {
    addLog('warn', `REST: ommaviy [${command}] → ${sent} monitor`);
    return res.json({ ok: true, sent });
  }
  if (!sent) {
    return res.status(404).json({ ok: false, error: 'Agent topilmadi yoki offline' });
  }
  addLog('ok', `REST: Monitor ${monitorId} ← ${command}`);
  res.json({ ok: true });
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(auditLog.slice(-limit));
});

app.get('/api/network', (req, res) => {
  res.json(getNetworkInfo());
});

app.post('/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const token = 'admin_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    validTokens.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.get('/api/monitors', (req, res) => {
  res.json(getAgentSnapshot());
});

app.post('/api/monitors', (req, res) => {
  const { monitorId, room } = req.body;
  if (!monitorId) return res.status(400).json({ ok: false, error: 'monitorId kerak' });
  if (configuredMonitors.has(monitorId)) return res.status(409).json({ ok: false, error: 'Monitor allaqachon mavjud' });

  configuredMonitors.set(monitorId, { room: room || '—', info: { room: room || '—' }, lastSeen: '—', uptime: 0 });
  const monitor = { monitorId, status: 'offline', info: { room: room || '—', hostname: '—', os: '—' }, lastSeen: '—', uptime: 0 };
  broadcastAdmins({ type: 'monitor_added', monitor });
  addLog('info', `Admin qo'shdi: Monitor ${monitorId} (${room || '—'})`);
  res.json({ ok: true, monitor });
});

app.delete('/api/monitors/:monitorId', (req, res) => {
  const { monitorId } = req.params;
  if (!configuredMonitors.has(monitorId)) return res.status(404).json({ ok: false, error: 'Monitor topilmadi' });

  const wasActive = agents.has(monitorId);
  configuredMonitors.delete(monitorId);
  if (!wasActive) delete agentData[monitorId];
  broadcastAdmins({ type: 'monitor_removed', monitorId, wasActive });
  addLog('info', `Admin o'chirdi: Monitor ${monitorId}`);
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ── Ping agents every 30s ──
setInterval(() => {
  agents.forEach((ws, id) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'command', command: 'ping' }));
    } else {
      agents.delete(id);
      broadcastAdmins({ type: 'agent_disconnected', monitorId: id });
    }
  });
}, 30000);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Shared command dispatcher ──
function dispatchCommand(monitorId, command, params) {
  if (monitorId === 'all') {
    let sent = 0;
    agents.forEach(a => {
      if (a.readyState === WebSocket.OPEN) {
        a.send(JSON.stringify({ type: 'command', command, params: params || {} }));
        sent++;
      }
    });
    return sent;
  }
  const agent = agents.get(monitorId);
  if (agent && agent.readyState === WebSocket.OPEN) {
    agent.send(JSON.stringify({ type: 'command', command, params: params || {} }));
    return 1;
  }
  return 0;
}

function formatNetworkAddresses() {
  const list = getNetworkInfo();
  if (!list.length) return '  (local only)';
  return list.map(net => `http://${net.address}:${PORT}`).join('\n  ');
}

server.listen(PORT, HOST, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   MCS v3 — Server ishga tushdi           ║');
  console.log(`║   Port    : ${PORT}`.padEnd(42) + '║');
  console.log('║   Status  : Faol'.padEnd(42) + '║');
  console.log('╚══════════════════════════════════════════╝\n');
});
