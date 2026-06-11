import { useState, useEffect, useMemo, useRef, useReducer, createContext, useContext, useCallback } from "react";
import * as d3 from "d3";

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────────
const T = {
  bg:        "#000000",
  surface:   "#060606",
  surfaceHi: "#0d0d0d",
  border:    "#1c1c1c",
  borderBri: "#2e2e2e",
  high:      "#c94040",
  mid:       "#c08820",
  low:       "#2e8b4e",
  text:      "#666666",
  textDim:   "#2e2e2e",
  textMid:   "#444444",
  textBri:   "#d8d8d8",
  serif:     "'Playfair Display','Georgia',serif",
  mono:      "'JetBrains Mono','Courier New',monospace",
};

// ── UTILITIES ──────────────────────────────────────────────────────────────────
function fmtMoney(n) {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${(a/1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${s}₹${(a/1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${s}₹${(a/1e3).toFixed(0)}K`;
  return `${s}₹${a}`;
}
function rc(r) { return r >= 80 ? T.high : r >= 60 ? T.mid : T.low; }
function rl(r) { return r >= 80 ? "HIGH" : r >= 60 ? "MED" : "LOW"; }
const riskColor = rc;
const riskLabel = rl;

function riskFill(risk) {
  const stops = [
    [0,   "#0a2e18"],
    [10,  "#1a7040"],
    [30,  "#22cc50"],
    [50,  "#b8e020"],
    [60,  "#f5c800"],
    [70,  "#ff7010"],
    [80,  "#f02828"],
    [90,  "#c01010"],
    [100, "#8c0808"],
  ];
  if (risk <= 0) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (risk <= stops[i][0]) {
      const t = (risk - stops[i-1][0]) / (stops[i][0] - stops[i-1][0]);
      return d3.interpolateRgb(stops[i-1][1], stops[i][1])(t);
    }
  }
  return stops[stops.length - 1][1];
}

function hexRgb(h) {
  return `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
}
function nowTs() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function statusColor(s) {
  return { "New": T.text, "Under Investigation": T.mid, "Resolved": T.low, "False Positive": T.textDim }[s] || T.textDim;
}
function sevColor(s) { return T.textMid; }
function sevLabel(s) { return { HIGH: "High", MED: "Medium", LOW: "Low" }[s] || s; }

// ══════════════════════════════════════════════════════════════════════════════
// ── FLAGGED/CASE DATA ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const INITIAL_ACCOUNTS = [
  { id:"ACC-8842", masked:"**8842", risk:94, netFlow:-285000, moneyIn:450000, moneyOut:735000, connections:47, age:12,  state:"Maharashtra",   status:"Under Investigation", assigned:"Priya K.", caseId:"CASE-112" },
  { id:"ACC-3371", masked:"**3371", risk:87, netFlow:190000,  moneyIn:320000, moneyOut:130000, connections:31, age:8,   state:"Delhi",         status:"New",                 assigned:null,       caseId:null       },
  { id:"ACC-5519", masked:"**5519", risk:82, netFlow:-95000,  moneyIn:180000, moneyOut:275000, connections:28, age:45,  state:"Gujarat",       status:"New",                 assigned:null,       caseId:null       },
  { id:"ACC-7703", masked:"**7703", risk:76, netFlow:50000,   moneyIn:220000, moneyOut:170000, connections:19, age:120, state:"Karnataka",     status:"Under Investigation", assigned:"Rajan S.", caseId:"CASE-109" },
  { id:"ACC-2244", masked:"**2244", risk:71, netFlow:-35000,  moneyIn:95000,  moneyOut:130000, connections:22, age:6,   state:"Tamil Nadu",    status:"New",                 assigned:null,       caseId:null       },
  { id:"ACC-9981", masked:"**9981", risk:68, netFlow:125000,  moneyIn:300000, moneyOut:175000, connections:15, age:200, state:"Rajasthan",     status:"New",                 assigned:null,       caseId:null       },
  { id:"ACC-4456", masked:"**4456", risk:65, netFlow:-12000,  moneyIn:75000,  moneyOut:87000,  connections:11, age:88,  state:"West Bengal",   status:"Resolved",            assigned:"Priya K.", caseId:"CASE-101" },
  { id:"ACC-6620", masked:"**6620", risk:58, netFlow:45000,   moneyIn:110000, moneyOut:65000,  connections:9,  age:340, state:"Uttar Pradesh", status:"False Positive",      assigned:"Amit V.",  caseId:null       },
  { id:"ACC-1133", masked:"**1133", risk:52, netFlow:8000,    moneyIn:42000,  moneyOut:34000,  connections:7,  age:510, state:"Bihar",         status:"New",                 assigned:null,       caseId:null       },
  { id:"ACC-3388", masked:"**3388", risk:48, netFlow:-5000,   moneyIn:30000,  moneyOut:35000,  connections:5,  age:730, state:"Punjab",        status:"New",                 assigned:null,       caseId:null       },
];

const INITIAL_CASES = [
  {
    id:"CASE-112", title:"Mule network — Maharashtra cluster", severity:"HIGH", totalValue:2850000,
    created:"2026-03-03", updated:"2026-03-04", assigned:"Priya K.", status:"Under Investigation",
    notes:"Multiple accounts routing funds through shell entities. Rapid outflow detected. Recommend FIU report.",
    evidence:["txn_export_112.csv","graph_snapshot.png"], involvedAccountIds:["ACC-8842"],
    auditTrail:[
      { ts:"2026-03-04 09:14", user:"Priya K.", action:"Status changed → Under Investigation" },
      { ts:"2026-03-04 08:52", user:"Priya K.", action:"Note added: Round-amount pattern confirmed" },
      { ts:"2026-03-04 08:40", user:"Priya K.", action:"Evidence attached: txn_export_112.csv" },
      { ts:"2026-03-03 16:30", user:"System",   action:"Case auto-created from flag cluster"  },
    ],
  },
  {
    id:"CASE-111", title:"Round-amount layering — Delhi", severity:"HIGH", totalValue:1200000,
    created:"2026-03-02", updated:"2026-03-04", assigned:"Rajan S.", status:"Under Investigation",
    notes:"Repeated ₹50,000 transactions at 3-minute intervals across 4 accounts. Classic layering.",
    evidence:["txn_log_111.csv"], involvedAccountIds:["ACC-3371"],
    auditTrail:[
      { ts:"2026-03-04 07:10", user:"Rajan S.", action:"Note added: Confirmed layering pattern" },
      { ts:"2026-03-02 11:22", user:"System",   action:"Case created from flagged cluster"      },
    ],
  },
  {
    id:"CASE-109", title:"Velocity anomaly — Karnataka", severity:"MED", totalValue:680000,
    created:"2026-03-01", updated:"2026-03-03", assigned:"Rajan S.", status:"Under Investigation",
    notes:"High velocity transfers to newly opened accounts within 48h of account creation.",
    evidence:[], involvedAccountIds:["ACC-7703"],
    auditTrail:[
      { ts:"2026-03-03 14:00", user:"Rajan S.", action:"Assigned to self" },
      { ts:"2026-03-01 09:00", user:"System",   action:"Case created"     },
    ],
  },
  {
    id:"CASE-105", title:"Smurfing pattern — Gujarat cluster", severity:"MED", totalValue:950000,
    created:"2026-02-27", updated:"2026-03-02", assigned:"Amit V.", status:"Resolved",
    notes:"Confirmed smurfing. 11 accounts used. Reported to FIU-IND. Case closed.",
    evidence:["report_105.pdf"], involvedAccountIds:["ACC-5519"],
    auditTrail:[
      { ts:"2026-03-02 15:30", user:"Amit V.", action:"Case closed — Resolved" },
      { ts:"2026-02-27 10:00", user:"System",  action:"Case created"           },
    ],
  },
  {
    id:"CASE-101", title:"False positive — WB normal merchant", severity:"LOW", totalValue:87000,
    created:"2026-02-24", updated:"2026-02-26", assigned:"Priya K.", status:"False Positive",
    notes:"Verified regular merchant account. High volume explained by weekend market sales.",
    evidence:[], involvedAccountIds:["ACC-4456"],
    auditTrail:[
      { ts:"2026-02-26 12:00", user:"Priya K.", action:"Marked False Positive" },
      { ts:"2026-02-24 08:00", user:"System",   action:"Case created"          },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ── HOME PAGE DATA ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const STATE_DATA = {
  "Maharashtra":        { count:38, amount:2850000, risk:94, code:"MH", cases:12, avgTxn:75000  },
  "Delhi":              { count:24, amount:1200000, risk:87, code:"DL", cases:8,  avgTxn:50000  },
  "Gujarat":            { count:21, amount:980000,  risk:82, code:"GJ", cases:5,  avgTxn:46667  },
  "Karnataka":          { count:22, amount:920000,  risk:76, code:"KA", cases:6,  avgTxn:41818  },
  "Tamil Nadu":         { count:17, amount:740000,  risk:73, code:"TN", cases:4,  avgTxn:43529  },
  "Uttar Pradesh":      { count:19, amount:780000,  risk:72, code:"UP", cases:5,  avgTxn:41053  },
  "Telangana":          { count:14, amount:620000,  risk:71, code:"TG", cases:3,  avgTxn:44286  },
  "Madhya Pradesh":     { count:16, amount:640000,  risk:69, code:"MP", cases:4,  avgTxn:40000  },
  "Rajasthan":          { count:15, amount:650000,  risk:68, code:"RJ", cases:3,  avgTxn:43333  },
  "Haryana":            { count:11, amount:420000,  risk:65, code:"HR", cases:2,  avgTxn:38182  },
  "Bihar":              { count:12, amount:510000,  risk:64, code:"BR", cases:3,  avgTxn:42500  },
  "Andhra Pradesh":     { count:10, amount:450000,  risk:63, code:"AP", cases:2,  avgTxn:45000  },
  "West Bengal":        { count:9,  amount:380000,  risk:61, code:"WB", cases:2,  avgTxn:42222  },
  "Punjab":             { count:8,  amount:340000,  risk:58, code:"PB", cases:2,  avgTxn:42500  },
  "Jharkhand":          { count:7,  amount:290000,  risk:57, code:"JH", cases:1,  avgTxn:41429  },
  "Kerala":             { count:8,  amount:330000,  risk:55, code:"KL", cases:1,  avgTxn:41250  },
  "Odisha":             { count:6,  amount:250000,  risk:53, code:"OR", cases:1,  avgTxn:41667  },
  "Uttarakhand":        { count:4,  amount:190000,  risk:52, code:"UK", cases:1,  avgTxn:47500  },
  "Assam":              { count:4,  amount:145000,  risk:46, code:"AS", cases:1,  avgTxn:36250  },
  "Goa":                { count:3,  amount:130000,  risk:44, code:"GA", cases:0,  avgTxn:43333  },
  "Jammu and Kashmir":  { count:3,  amount:120000,  risk:42, code:"JK", cases:0,  avgTxn:40000  },
  "Himachal Pradesh":   { count:2,  amount:85000,   risk:38, code:"HP", cases:0,  avgTxn:42500  },
  "Chhattisgarh":       { count:3,  amount:110000,  risk:40, code:"CG", cases:0,  avgTxn:36667  },
  "Manipur":            { count:1,  amount:25000,   risk:15, code:"MN", cases:0,  avgTxn:25000  },
  "Tripura":            { count:1,  amount:30000,   risk:18, code:"TR", cases:0,  avgTxn:30000  },
  "Meghalaya":          { count:1,  amount:35000,   risk:20, code:"ML", cases:0,  avgTxn:35000  },
  "Mizoram":            { count:0,  amount:0,       risk:5,  code:"MZ", cases:0,  avgTxn:0      },
  "Arunachal Pradesh":  { count:0,  amount:0,       risk:5,  code:"AR", cases:0,  avgTxn:0      },
  "Nagaland":           { count:0,  amount:0,       risk:5,  code:"NL", cases:0,  avgTxn:0      },
  "Sikkim":             { count:0,  amount:0,       risk:5,  code:"SK", cases:0,  avgTxn:0      },
};

const GEO_NORM = {
  "NCT of Delhi":           "Delhi",
  "Jammu & Kashmir":        "Jammu and Kashmir",
  "Orissa":                 "Odisha",
  "Uttaranchal":            "Uttarakhand",
  "Daman and Diu":          null,
  "Dadra and Nagar Haveli": null,
  "Andaman and Nicobar":    null,
  "Lakshadweep":            null,
  "Chandigarh":             null,
  "Puducherry":             null,
  "Pondicherry":            null,
};
function normState(raw) { if (!raw) return null; if (raw in GEO_NORM) return GEO_NORM[raw]; return raw; }
function getGeoName(p)  { return p?.NAME_1 || p?.ST_NM || p?.name || p?.NAME || ""; }

const SVG_W = 680, SVG_H = 820;

// ══════════════════════════════════════════════════════════════════════════════
// ── GRAPH DATA ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const NODES = [
  { id:"ACC-8842",  risk:94, volume:1185000, deg:47, state:"MH", label:"Maharashtra",   status:"Under Investigation" },
  { id:"ACC-3371",  risk:87, volume:450000,  deg:31, state:"DL", label:"Delhi",          status:"New" },
  { id:"ACC-5519",  risk:82, volume:455000,  deg:28, state:"GJ", label:"Gujarat",        status:"New" },
  { id:"ACC-7703",  risk:76, volume:390000,  deg:19, state:"KA", label:"Karnataka",      status:"Under Investigation" },
  { id:"ACC-2244",  risk:71, volume:225000,  deg:22, state:"TN", label:"Tamil Nadu",     status:"New" },
  { id:"KNOWN-BAD", risk:99, volume:2200000, deg:62, state:"MH", label:"Maharashtra",   status:"Blacklisted", known:true },
  { id:"ACC-4456",  risk:65, volume:162000,  deg:11, state:"WB", label:"West Bengal",   status:"Resolved" },
  { id:"ACC-9981",  risk:68, volume:475000,  deg:15, state:"RJ", label:"Rajasthan",     status:"New" },
  { id:"ACC-N1",    risk:42, volume:80000,   deg:4,  state:"MH", label:"Maharashtra",   status:"New" },
  { id:"ACC-N2",    risk:38, volume:65000,   deg:3,  state:"GJ", label:"Gujarat",       status:"New" },
  { id:"ACC-N3",    risk:55, volume:120000,  deg:6,  state:"DL", label:"Delhi",         status:"New" },
  { id:"ACC-N4",    risk:29, volume:45000,   deg:2,  state:"KA", label:"Karnataka",     status:"New" },
  { id:"ACC-6620",  risk:58, volume:175000,  deg:9,  state:"UP", label:"Uttar Pradesh", status:"False Positive" },
  { id:"ACC-1133",  risk:52, volume:76000,   deg:7,  state:"BR", label:"Bihar",         status:"New" },
];

const EDGES = [
  { source:"ACC-8842",  target:"KNOWN-BAD", amount:850000 },
  { source:"ACC-8842",  target:"ACC-3371",  amount:320000 },
  { source:"ACC-8842",  target:"ACC-5519",  amount:280000 },
  { source:"ACC-8842",  target:"ACC-N1",    amount:95000  },
  { source:"ACC-3371",  target:"KNOWN-BAD", amount:190000 },
  { source:"ACC-3371",  target:"ACC-9981",  amount:125000 },
  { source:"ACC-3371",  target:"ACC-N3",    amount:88000  },
  { source:"ACC-5519",  target:"ACC-7703",  amount:170000 },
  { source:"ACC-5519",  target:"ACC-N2",    amount:65000  },
  { source:"ACC-7703",  target:"ACC-2244",  amount:95000  },
  { source:"ACC-7703",  target:"ACC-N3",    amount:80000  },
  { source:"KNOWN-BAD", target:"ACC-N3",    amount:240000 },
  { source:"KNOWN-BAD", target:"ACC-6620",  amount:110000 },
  { source:"ACC-4456",  target:"ACC-N1",    amount:55000  },
  { source:"ACC-2244",  target:"ACC-N4",    amount:45000  },
  { source:"ACC-9981",  target:"KNOWN-BAD", amount:300000 },
  { source:"ACC-1133",  target:"ACC-N4",    amount:30000  },
  { source:"ACC-6620",  target:"ACC-N2",    amount:42000  },
];

const ALL_STATE_ITEMS = Object.entries(STATE_DATA).map(([name, d]) => ({
  key: d.code, label: name.toUpperCase(), color: rc(d.risk), shape: "⬡",
}));

const LAYER_GROUPS = [
  {
    key:"risk", label:"RISK LAYERS",
    items:[
      { key:"high",  label:"HIGH RISK (≥80)",  color:T.high,    shape:"●" },
      { key:"med",   label:"MED RISK (60–79)", color:T.mid,     shape:"●" },
      { key:"low",   label:"LOW RISK (<60)",   color:T.low,     shape:"●" },
      { key:"known", label:"KNOWN MALICIOUS",  color:T.textBri, shape:"◆" },
    ],
  },
  {
    key:"state", label:"STATE FILTER",
    items: ALL_STATE_ITEMS,
  },
  {
    key:"status", label:"CASE STATUS",
    items:[
      { key:"Under Investigation", label:"UNDER INVESTIGATION", color:T.high,    shape:"▸" },
      { key:"New",                 label:"NEW — UNASSIGNED",    color:T.mid,     shape:"▸" },
      { key:"Resolved",            label:"RESOLVED",            color:T.low,     shape:"▸" },
      { key:"False Positive",      label:"FALSE POSITIVE",      color:T.textDim, shape:"▸" },
      { key:"Blacklisted",         label:"BLACKLISTED",         color:T.textBri, shape:"▸" },
    ],
  },
  {
    key:"edge", label:"EDGE FLOWS",
    items:[
      { key:"major", label:"MAJOR FLOW (>₹3L)", color:T.high, shape:"━" },
      { key:"mid",   label:"MID FLOW (₹1-3L)",  color:T.mid,  shape:"━" },
      { key:"minor", label:"MINOR FLOW (<₹1L)", color:T.low,  shape:"━" },
    ],
  },
];

const RECENT_EVENTS = [
  { ts:"14:22", id:"ACC-8842",  msg:"₹8.5L routed → KNOWN-BAD",  color:T.text    },
  { ts:"13:05", id:"ACC-3371",  msg:"Round-amt pattern detected",  color:T.text     },
  { ts:"11:48", id:"ACC-5519",  msg:"Rapid repeat from ACC-5519",  color:T.text     },
  { ts:"10:30", id:"KNOWN-BAD", msg:"New incoming link from RJ",   color:T.textBri },
  { ts:"09:14", id:"ACC-7703",  msg:"Case CASE-109 updated",       color:T.text     },
  { ts:"08:52", id:"ACC-8842",  msg:"Note added by Priya K.",      color:T.textMid },
];

// ══════════════════════════════════════════════════════════════════════════════
// ── GLOBAL STORE ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const initialState = {
  accounts:    INITIAL_ACCOUNTS.map(a => ({ ...a })),
  cases:       INITIAL_CASES.map(c => ({ ...c, auditTrail: [...c.auditTrail] })),
  nextCaseNum: 113,
  drawerAccountId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "UPDATE_ACCOUNT_STATUS": {
      const { accountId, status } = action.payload;
      return { ...state, accounts: state.accounts.map(a => a.id === accountId ? { ...a, status } : a) };
    }
    case "ASSIGN_ACCOUNT": {
      const { accountId, analyst } = action.payload;
      return { ...state, accounts: state.accounts.map(a => a.id === accountId ? { ...a, assigned: analyst } : a) };
    }
    case "MARK_FALSE_POSITIVE": {
      const { accountId } = action.payload;
      return {
        ...state,
        drawerAccountId: null,
        accounts: state.accounts.map(a => a.id === accountId ? { ...a, status: "False Positive" } : a),
      };
    }
    case "OPEN_DRAWER":  return { ...state, drawerAccountId: action.payload };
    case "CLOSE_DRAWER": return { ...state, drawerAccountId: null };
    case "CREATE_CASE": {
      const { accountId } = action.payload;
      const account = state.accounts.find(a => a.id === accountId);
      if (!account || account.caseId) return state;
      const caseId   = `CASE-${state.nextCaseNum}`;
      const severity = account.risk >= 80 ? "HIGH" : account.risk >= 60 ? "MED" : "LOW";
      const ts       = nowTs();
      const newCase  = {
        id: caseId,
        title: `Investigation — ${account.state} (${account.id})`,
        severity, totalValue: account.moneyIn + account.moneyOut,
        created: todayStr(), updated: todayStr(),
        assigned: "Priya K.", status: "Under Investigation",
        notes: `Case opened for ${account.id} (${account.state}). Risk: ${account.risk}/100. Net flow: ${fmtMoney(account.netFlow)}.`,
        evidence: [], involvedAccountIds: [accountId],
        auditTrail: [{ ts, user: "Priya K.", action: `Case created from account ${account.id}` }],
      };
      return {
        ...state,
        cases: [newCase, ...state.cases],
        accounts: state.accounts.map(a => a.id === accountId ? { ...a, status: "Under Investigation", caseId, assigned: "Priya K." } : a),
        nextCaseNum: state.nextCaseNum + 1,
      };
    }
    case "CLOSE_CASE": {
      const { caseId } = action.payload;
      const ts  = nowTs();
      const c   = state.cases.find(c => c.id === caseId);
      const ids = c?.involvedAccountIds || [];
      return {
        ...state,
        cases: state.cases.map(c =>
          c.id === caseId ? { ...c, status: "Resolved", updated: todayStr(),
            auditTrail: [{ ts, user: "Priya K.", action: "Case closed — Resolved" }, ...c.auditTrail] } : c
        ),
        accounts: state.accounts.map(a => ids.includes(a.id) ? { ...a, status: "Resolved" } : a),
      };
    }
    case "ADD_CASE_NOTE": {
      const { caseId, note } = action.payload;
      const ts = nowTs();
      return {
        ...state,
        cases: state.cases.map(c =>
          c.id === caseId
            ? { ...c, updated: todayStr(), auditTrail: [{ ts, user: "Priya K.", action: `Note added: ${note}` }, ...c.auditTrail] }
            : c
        ),
      };
    }
    default: return state;
  }
}

const StoreContext = createContext(null);
function useStore() { return useContext(StoreContext); }

// ══════════════════════════════════════════════════════════════════════════════
// ── ATOM COMPONENTS ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function RiskBadge({ score }) {
  const l = riskLabel(score);
  return (
    <span style={{ display:"inline-flex", alignItems:"baseline", gap:4,
      fontFamily:T.mono, fontSize:10, color:T.textBri }}>
      <b style={{ fontSize:11 }}>{score}</b>
      <span style={{ fontSize:8, opacity:0.5, color:T.textMid }}>{l}</span>
    </span>
  );
}

function StatusDot({ status }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      fontFamily:T.mono, fontSize:9, color:T.text }}>
      <span style={{ width:3, height:3, borderRadius:"50%", background:T.textMid, flexShrink:0 }} />
      {status}
    </span>
  );
}

function MoneyVal({ value }) {
  return (
    <span style={{ fontFamily:T.mono, fontSize:11, color:T.textBri }}>
      {value > 0 ? "+" : ""}{fmtMoney(value)}
    </span>
  );
}

function Pill({ label, active, color = T.textBri, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"3px 10px",
      background: "transparent",
      border:`1px solid ${active ? T.borderBri : T.border}`,
      color: active ? T.textBri : T.textMid,
      fontFamily:T.mono, fontSize:8.5, letterSpacing:"0.09em",
      cursor:"pointer", transition:"all 0.1s",
    }}>
      {label.toUpperCase()}
    </button>
  );
}

function ActionBtn({ label, color, onClick, desc, disabled }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width:"100%", padding:"10px 13px",
        background: "transparent",
        border:`1px solid ${hov && !disabled ? T.borderBri : T.border}`,
        textAlign:"left", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1, transition:"all 0.1s",
      }}>
      <div style={{ fontFamily:T.mono, fontSize:10, fontWeight:600, color: disabled ? T.textDim : T.textBri, marginBottom:3, letterSpacing:"0.04em" }}>{label}</div>
      <div style={{ fontFamily:T.mono, fontSize:8.5, color:T.text }}>{desc}</div>
    </button>
  );
}

// ── ACCOUNT DRAWER ────────────────────────────────────────────────────────────
function AccountDrawer() {
  const { state, dispatch } = useStore();
  const [tab, setTab]       = useState("summary");
  const [confirmFP, setConfirmFP] = useState(false);
  const account = state.accounts.find(a => a.id === state.drawerAccountId);
  if (!account) return null;
  const close = () => dispatch({ type:"CLOSE_DRAWER" });

  const SAMPLE_TXNS = [
    { id:"TXN-7721", ts:"Mar 4, 14:22", from:account.id, to:"KNOWN-BAD",  amt:250000, type:"IMPS", flags:["round amount","known entity"] },
    { id:"TXN-7688", ts:"Mar 4, 13:05", from:account.id, to:"ACC-3371",   amt:100000, type:"NEFT", flags:[] },
    { id:"TXN-7601", ts:"Mar 4, 11:48", from:"ACC-5519",  to:account.id,  amt:180000, type:"UPI",  flags:["rapid repeat"] },
    { id:"TXN-7322", ts:"Mar 3, 22:14", from:account.id, to:"KNOWN-BAD",  amt:200000, type:"IMPS", flags:["round amount","off-hours"] },
  ];

  return (
    <div style={{
      position:"fixed", right:0, top:0, width:380, height:"100vh",
      background:T.bg, borderLeft:`1px solid ${T.border}`,
      zIndex:300, display:"flex", flexDirection:"column",
    }}>
      {/* Header */}
      <div style={{
        padding:"14px 18px", borderBottom:`1px solid ${T.border}`,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12 }}>
          <span style={{ fontFamily:T.serif, fontSize:16, fontWeight:700, color:T.textBri, fontStyle:"italic" }}>{account.id}</span>
          <RiskBadge score={account.risk} />
        </div>
        <button onClick={close} style={{
          background:"none", border:"none", color:T.textMid,
          fontSize:14, cursor:"pointer", fontFamily:T.mono,
        }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        {["summary","transactions","actions"].map(t => (
          <button key={t} onClick={() => { setTab(t); setConfirmFP(false); }} style={{
            flex:1, padding:"9px 0", background:"none", border:"none",
            borderBottom: tab===t ? `1px solid ${T.textBri}` : "1px solid transparent",
            color: tab===t ? T.textBri : T.textMid, fontFamily:T.mono, fontSize:8.5,
            letterSpacing:"0.1em", cursor:"pointer", textTransform:"uppercase",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 18px" }}>
        {tab === "summary" && (
          <div style={{ display:"flex", flexDirection:"column" }}>
            {[
              ["Account ID",     account.id],
              ["Risk Score",     <RiskBadge score={account.risk} />],
              ["Net Flow (24h)", <MoneyVal value={account.netFlow} />],
              ["Money In",       <span style={{fontFamily:T.mono,fontSize:11,color:T.low}}>+{fmtMoney(account.moneyIn)}</span>],
              ["Money Out",      <span style={{fontFamily:T.mono,fontSize:11,color:T.high}}>-{fmtMoney(account.moneyOut)}</span>],
              ["Connections",    <span style={{fontFamily:T.mono,fontSize:11,color:T.text}}>{account.connections}</span>],
              ["Account Age",    <span style={{fontFamily:T.mono,fontSize:11,color:account.age<30?T.high:T.text}}>{account.age}d{account.age<30?" ⚠":""}</span>],
              ["State",          <span style={{fontFamily:T.mono,fontSize:11,color:T.text}}>{account.state}</span>],
              ["Status",         <StatusDot status={account.status} />],
              ["Assigned",       account.assigned ? <span style={{fontFamily:T.mono,fontSize:10,color:T.text}}>{account.assigned}</span> : <span style={{color:T.textDim,fontSize:10,fontFamily:T.mono}}>—</span>],
              ["Case",           account.caseId  ? <span style={{fontFamily:T.mono,fontSize:10,color:T.text}}>{account.caseId}</span>    : <span style={{color:T.textDim,fontSize:10,fontFamily:T.mono}}>none</span>],
            ].map(([k, v]) => (
              <div key={k} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"9px 0", borderBottom:`1px solid ${T.border}`,
              }}>
                <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}

            <div style={{ marginTop:16 }}>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>Risk Signals</div>
              {[
                account.age < 30          ? ["New account",  `opened ${account.age}d ago`,              T.high] : null,
                account.connections > 20  ? ["High degree",  `${account.connections} counterparties`,   T.mid ] : null,
                account.netFlow < -100000 ? ["Net outflow",  fmtMoney(Math.abs(account.netFlow))+" out",T.mid ] : null,
                account.risk > 80         ? ["High risk",    `${account.risk}/100`,                     T.high] : null,
              ].filter(Boolean).map(([t, d, c]) => (
                <div key={t} style={{ display:"flex", gap:12, alignItems:"baseline", padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontFamily:T.mono, fontSize:9, color:c, flexShrink:0 }}>— {t}</span>
                  <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <div>
            <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.1em", marginBottom:14 }}>RECENT — {account.id}</div>
            {SAMPLE_TXNS.map(tx => (
              <div key={tx.id} style={{ padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim }}>{tx.id}</span>
                  <span style={{ fontFamily:T.mono, fontSize:11, color:T.textBri }}>{fmtMoney(tx.amt)}</span>
                </div>
                <div style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, marginTop:3 }}>
                  {tx.ts} · {tx.type} · <span style={{ color:T.text }}>{tx.from}</span> → <span style={{ color:T.text }}>{tx.to}</span>
                </div>
                {tx.flags.length > 0 && (
                  <div style={{ display:"flex", gap:6, marginTop:5 }}>
                    {tx.flags.map(f => (
                      <span key={f} style={{
                        fontSize:8, padding:"1px 6px",
                        border:`1px solid ${T.border}`, color:T.textDim,
                        fontFamily:T.mono, letterSpacing:"0.05em",
                      }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "actions" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <ActionBtn
              label={account.caseId ? `Case exists — ${account.caseId}` : "Create Case"}
              color={T.low}
              onClick={() => { if (!account.caseId) dispatch({ type:"CREATE_CASE", payload:{ accountId: account.id } }); }}
              disabled={!!account.caseId}
              desc={account.caseId ? "Already linked to a case" : "Opens investigation, sets status to Under Investigation"}
            />
            <ActionBtn
              label={account.assigned === "Priya K." ? "Assigned to you" : "Assign to Me"}
              color={T.textBri}
              onClick={() => dispatch({ type:"ASSIGN_ACCOUNT", payload:{ accountId: account.id, analyst:"Priya K." } })}
              disabled={account.assigned === "Priya K."}
              desc="Take ownership as Priya K."
            />
            <div style={{ marginTop:4 }}>
              {!confirmFP ? (
                <ActionBtn
                  label="Mark False Positive"
                  color={T.mid}
                  onClick={() => setConfirmFP(true)}
                  disabled={account.status === "False Positive"}
                  desc="Remove from active queue — requires confirmation"
                />
              ) : (
                <div style={{ padding:"14px", border:`1px solid ${T.border}` }}>
                  <div style={{ fontFamily:T.serif, fontSize:13, color:T.textBri, fontStyle:"italic", marginBottom:8 }}>
                    Confirm Mark False Positive?
                  </div>
                  <div style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, marginBottom:14, letterSpacing:"0.04em" }}>
                    This will remove {account.id} from the active queue.
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => dispatch({ type:"MARK_FALSE_POSITIVE", payload:{ accountId: account.id } })}
                      style={{ flex:1, padding:"8px", background:"transparent",
                        border:`1px solid ${T.borderBri}`, color:T.textBri,
                        fontFamily:T.mono, fontSize:9, cursor:"pointer", letterSpacing:"0.06em" }}>
                      Confirm
                    </button>
                    <button onClick={() => setConfirmFP(false)}
                      style={{ flex:1, padding:"8px", background:"transparent",
                        border:`1px solid ${T.border}`, color:T.textDim,
                        fontFamily:T.mono, fontSize:9, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FLAGGED ACCOUNTS TABLE ────────────────────────────────────────────────────
function FlaggedTable({ accounts, onRowClick }) {
  const [sortKey, setSortKey] = useState("risk");
  const { dispatch } = useStore();
  const display = [...accounts].sort((a, b) => {
    if (!["risk","netFlow","moneyIn","connections","age"].includes(sortKey)) return 0;
    return b[sortKey] - a[sortKey];
  });

  if (!display.length) {
    return (
      <div style={{ padding:"64px", textAlign:"center" }}>
        <div style={{ fontFamily:T.serif, fontSize:17, color:T.textDim, marginBottom:6, fontStyle:"italic" }}>No accounts match</div>
        <div style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, letterSpacing:"0.12em" }}>TRY WIDENING FILTERS</div>
      </div>
    );
  }

  const cols = [
    { key:"id",          label:"Account ID",  w:120 },
    { key:"risk",        label:"Risk",        w:88  },
    { key:"netFlow",     label:"Net Flow",    w:96  },
    { key:"moneyIn",     label:"In",          w:80  },
    { key:"connections", label:"Conn.",       w:56  },
    { key:"age",         label:"Age d",       w:54  },
    { key:"state",       label:"State",       w:120 },
    { key:"status",      label:"Status",      w:170 },
    { key:"_act",        label:"",            w:80  },
  ];

  const sortable = new Set(["risk","netFlow","moneyIn","connections","age"]);

  return (
    <div style={{ width:"100%", overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:T.mono, fontSize:10.5 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${T.border}` }}>
            {cols.map(c => (
              <th key={c.key} style={{
                width:c.w, padding:"9px 10px", textAlign:"left",
                color: sortKey === c.key ? T.textBri : T.textDim,
                fontFamily:T.mono, fontSize:8, letterSpacing:"0.12em",
                textTransform:"uppercase", fontWeight: sortKey === c.key ? 600 : 400,
                cursor: sortable.has(c.key) ? "pointer" : "default",
                userSelect:"none", whiteSpace:"nowrap",
              }} onClick={() => sortable.has(c.key) && setSortKey(c.key)}>
                {c.label}{sortKey === c.key ? " ↓" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map(acc => (
            <tr key={acc.id}
              style={{ borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surfaceHi}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => onRowClick && onRowClick(acc)}>
              <td style={{ padding:"9px 10px", color:T.textBri, fontFamily:T.mono, fontSize:10.5 }}>{acc.id}</td>
              <td style={{ padding:"9px 10px" }}><RiskBadge score={acc.risk} /></td>
              <td style={{ padding:"9px 10px" }}><MoneyVal value={acc.netFlow} /></td>
              <td style={{ padding:"9px 10px", color:T.textBri, fontFamily:T.mono, fontSize:10.5 }}>{fmtMoney(acc.moneyIn)}</td>
              <td style={{ padding:"9px 10px", color:T.text, fontFamily:T.mono, fontSize:10.5 }}>{acc.connections}</td>
              <td style={{ padding:"9px 10px", color:T.textDim, fontFamily:T.mono }}>{acc.age}</td>
              <td style={{ padding:"9px 10px", color:T.textDim, fontFamily:T.mono, fontSize:10 }}>{acc.state}</td>
              <td style={{ padding:"9px 10px" }}><StatusDot status={acc.status} /></td>
              <td style={{ padding:"9px 10px" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => dispatch({ type:"OPEN_DRAWER", payload: acc.id })} style={{
                  padding:"3px 9px", background:"transparent",
                  border:`1px solid ${T.border}`,
                  color:T.textDim, fontFamily:T.mono, fontSize:8,
                  letterSpacing:"0.1em", cursor:"pointer",
                }}>DETAIL →</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── FLAGGED ACCOUNTS PAGE ─────────────────────────────────────────────────────
function FlaggedPage() {
  const { state, dispatch } = useStore();
  const { accounts }        = state;
  const [search,  setSearch]  = useState("");
  const [statFil, setStatFil] = useState("All");
  const [minRisk, setMinRisk] = useState(0);

  const filtered = accounts.filter(a => {
    const ms  = !search || a.id.toLowerCase().includes(search.toLowerCase()) || a.state.toLowerCase().includes(search.toLowerCase());
    const mst = statFil === "All" || a.status === statFil;
    return ms && mst && a.risk >= minRisk;
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Filter bar */}
      <div style={{
        padding:"9px 20px", borderBottom:`1px solid ${T.border}`,
        display:"flex", gap:8, alignItems:"center", flexShrink:0, flexWrap:"wrap",
      }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search account or state..."
          style={{
            padding:"5px 10px", background:"transparent",
            border:`1px solid ${T.border}`, color:T.text,
            fontFamily:T.mono, fontSize:9.5, width:200, outline:"none",
            letterSpacing:"0.04em",
          }} />
        {["All","New","Under Investigation","Resolved","False Positive"].map(s => (
          <Pill key={s} label={s} active={statFil === s} onClick={() => setStatFil(s)} />
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.1em" }}>MIN RISK</span>
          <input type="range" min={0} max={90} step={10} value={minRisk}
            onChange={e => setMinRisk(+e.target.value)}
            style={{ width:72, accentColor:T.textBri, cursor:"pointer" }} />
          <span style={{ fontFamily:T.mono, fontSize:9.5, color:T.textBri, width:18 }}>{minRisk}</span>
        </div>
        {(search || statFil !== "All" || minRisk > 0) && (
          <button onClick={() => { setSearch(""); setStatFil("All"); setMinRisk(0); }} style={{
            padding:"3px 9px", background:"transparent",
            border:`1px solid ${T.border}`,
            color:T.textDim, fontFamily:T.mono, fontSize:8,
            letterSpacing:"0.08em", cursor:"pointer",
          }}>✕ CLEAR</button>
        )}
      </div>

      {/* Count row */}
      <div style={{
        padding:"5px 20px", borderBottom:`1px solid ${T.border}`,
        flexShrink:0,
      }}>
        <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.08em" }}>
          {filtered.length} ACCOUNT{filtered.length !== 1 ? "S" : ""} SHOWN
        </span>
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        <FlaggedTable accounts={filtered} onRowClick={acc => dispatch({ type:"OPEN_DRAWER", payload: acc.id })} />
      </div>
    </div>
  );
}

// ── CASE MANAGEMENT PAGE ──────────────────────────────────────────────────────
function CasePage() {
  const { state, dispatch, navigate } = useStore();
  const { cases }                     = state;
  const [selCaseId,    setSelCaseId]    = useState(cases[0]?.id || null);
  const [note,         setNote]         = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const selCase = cases.find(c => c.id === selCaseId) || null;

  useEffect(() => {
    if (!selCaseId && cases.length > 0) setSelCaseId(cases[0].id);
  }, [cases]);

  const handleAddNote = () => {
    if (!note.trim() || !selCaseId) return;
    dispatch({ type:"ADD_CASE_NOTE", payload:{ caseId: selCaseId, note: note.trim() } });
    setNote("");
  };

  const handleCloseCase = () => {
    dispatch({ type:"CLOSE_CASE", payload:{ caseId: selCaseId } });
    setConfirmClose(false);
  };

  const activeCases = cases.filter(c => c.status === "Under Investigation");
  const resolvedCt  = cases.filter(c => c.status === "Resolved").length;

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>

      {/* Left — Case list */}
      <div style={{ width:286, borderRight:`1px solid ${T.border}`,
        display:"flex", flexDirection:"column", flexShrink:0 }}>

        {/* Header */}
        <div style={{
          padding:"12px 14px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0,
        }}>
          <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.12em" }}>
            ALL CASES ({cases.length})
          </span>
          <button onClick={() => navigate("flagged")} style={{
            padding:"3px 9px", background:"transparent",
            border:`1px solid ${T.border}`,
            color:T.textDim, fontFamily:T.mono, fontSize:8,
            letterSpacing:"0.08em", cursor:"pointer",
          }}>+ FROM FLAGGED</button>
        </div>

        {/* Case list */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {cases.map(c => (
            <div key={c.id} onClick={() => { setSelCaseId(c.id); setConfirmClose(false); }}
              style={{
                padding:"12px 14px", borderBottom:`1px solid ${T.border}`, cursor:"pointer",
                background: selCaseId===c.id ? T.surfaceHi : "transparent",
                borderLeft: selCaseId===c.id ? `2px solid ${T.textBri}` : `2px solid transparent`,
              }}>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim }}>{c.id}</span>
                <span style={{ fontFamily:T.serif, fontSize:11, fontStyle:"italic", color:T.textMid }}>
                  {sevLabel(c.severity)}
                </span>
              </div>
              <div style={{ fontFamily:T.serif, fontSize:12, fontWeight:700,
                color:T.textBri, marginBottom:5, lineHeight:1.35 }}>{c.title}</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:3 }}>
                <StatusDot status={c.status} />
                <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim }}>{c.assigned}</span>
              </div>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim }}>
                {fmtMoney(c.totalValue)} · {c.updated}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Case detail */}
      {selCase ? (
        <div style={{ flex:1, overflowY:"auto" }}>
          {/* Sticky header */}
          <div style={{
            padding:"18px 26px", borderBottom:`1px solid ${T.border}`,
            position:"sticky", top:0, zIndex:10, background:T.bg,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                  letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:7 }}>{selCase.id}</div>
                <div style={{ fontFamily:T.serif, fontSize:21, fontWeight:700,
                  color:T.textBri, lineHeight:1.25, maxWidth:520 }}>{selCase.title}</div>
                <div style={{ display:"flex", gap:16, alignItems:"baseline", marginTop:10 }}>
                  <span style={{ fontFamily:T.serif, fontSize:13, fontStyle:"italic", color:T.textMid }}>
                    {sevLabel(selCase.severity)}
                  </span>
                  <StatusDot status={selCase.status} />
                  <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim }}>→ {selCase.assigned}</span>
                </div>
              </div>
              {selCase.status === "Under Investigation" && (
                <div>
                  {confirmClose ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <span style={{ fontFamily:T.serif, fontSize:12, fontStyle:"italic", color:T.textDim }}>Resolve this case?</span>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={handleCloseCase} style={{
                          padding:"5px 12px", background:"transparent",
                          border:`1px solid ${T.borderBri}`, color:T.textBri,
                          fontFamily:T.mono, fontSize:8.5, letterSpacing:"0.08em", cursor:"pointer",
                        }}>CONFIRM CLOSE</button>
                        <button onClick={() => setConfirmClose(false)} style={{
                          padding:"5px 12px", background:"transparent",
                          border:`1px solid ${T.border}`, color:T.textDim,
                          fontFamily:T.mono, fontSize:8.5, cursor:"pointer",
                        }}>CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmClose(true)} style={{
                      padding:"6px 13px", background:"transparent",
                      border:`1px solid ${T.border}`, color:T.textDim,
                      fontFamily:T.mono, fontSize:8.5, letterSpacing:"0.08em", cursor:"pointer",
                    }}>CLOSE CASE →</button>
                  )}
                </div>
              )}
              {selCase.status !== "Under Investigation" && (
                <span style={{ fontFamily:T.serif, fontSize:12, fontStyle:"italic", color:T.textDim, padding:"6px 0" }}>
                  {selCase.status}
                </span>
              )}
            </div>
          </div>

          <div style={{ padding:"22px 26px", display:"flex", flexDirection:"column", gap:20 }}>
            {/* Stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, borderBottom:`1px solid ${T.border}`, paddingBottom:18 }}>
              {[
                ["Total Value",        fmtMoney(selCase.totalValue), T.textBri],
                ["Accounts Involved",  selCase.involvedAccountIds?.length || 1, T.textBri],
                ["Opened",             selCase.created,              T.text],
                ["Last Updated",       selCase.updated,              T.text],
              ].map(([k, v, c]) => (
                <div key={k} style={{ paddingRight:20 }}>
                  <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim,
                    letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:7 }}>{k}</div>
                  <div style={{ fontFamily:T.serif, fontSize:19, fontWeight:700, color:c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* SLA */}
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                letterSpacing:"0.14em", textTransform:"uppercase", flexShrink:0 }}>SLA</span>
              <div style={{ flex:1, background:T.border, height:1 }}>
                <div style={{
                  width: selCase.status === "Under Investigation" ? "72%" : "100%",
                  background: T.textMid,
                  height:"100%", transition:"width 0.4s",
                }} />
              </div>
              <span style={{ fontFamily:T.mono, fontSize:8.5, letterSpacing:"0.05em",
                color: T.textDim, flexShrink:0 }}>
                {selCase.status === "Under Investigation" ? "6h remaining" : "Completed"}
              </span>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>Investigation Notes</div>
              <div style={{ fontFamily:T.serif, fontSize:13, color:T.text,
                lineHeight:1.9, marginBottom:12, fontStyle:"italic" }}>{selCase.notes}</div>
              {selCase.status === "Under Investigation" && (
                <div style={{ display:"flex", gap:8, borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
                  <input value={note} onChange={e => setNote(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddNote()}
                    placeholder="Add analyst note..."
                    style={{ flex:1, padding:"7px 10px", background:"transparent",
                      border:`1px solid ${T.border}`, color:T.text,
                      fontFamily:T.mono, fontSize:10, outline:"none" }} />
                  <button onClick={handleAddNote} disabled={!note.trim()} style={{
                    padding:"7px 12px", background:"transparent",
                    border:`1px solid ${note.trim() ? T.borderBri : T.border}`,
                    color: note.trim() ? T.textBri : T.textDim,
                    fontFamily:T.mono, fontSize:8.5, letterSpacing:"0.08em",
                    cursor: note.trim() ? "pointer" : "not-allowed",
                  }}>ADD NOTE</button>
                </div>
              )}
            </div>

            {/* Evidence */}
            <div>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:9 }}>
                Evidence ({selCase.evidence.length})
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {selCase.evidence.length === 0 && (
                  <span style={{ fontFamily:T.mono, fontSize:9.5, color:T.textDim }}>— no evidence attached</span>
                )}
                {selCase.evidence.map(f => (
                  <div key={f} style={{
                    fontFamily:T.mono, fontSize:9, color:T.textDim, padding:"2px 0"
                  }}>
                    — {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Audit trail */}
            <div>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>
                Audit Trail ({selCase.auditTrail?.length || 0} entries)
              </div>
              {(selCase.auditTrail || []).map((e, i) => (
                <div key={i} style={{ display:"flex", gap:12, padding:"7px 0",
                  borderBottom:`1px solid ${T.border}`, alignItems:"flex-start" }}>
                  <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                    whiteSpace:"nowrap", width:126, flexShrink:0 }}>{e.ts}</span>
                  <span style={{ fontFamily:T.mono, fontSize:8, color:T.textMid,
                    width:62, flexShrink:0 }}>{e.user}</span>
                  <span style={{ fontFamily:T.mono, fontSize:9, color:T.text }}>{e.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
          flexDirection:"column", gap:8 }}>
          <div style={{ fontFamily:T.mono, fontSize:9, color:T.textDim, letterSpacing:"0.12em" }}>
            SELECT A CASE TO VIEW DETAILS
          </div>
        </div>
      )}
    </div>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [user,     setUser]     = useState("");
  const [pass,     setPass]     = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const DEMO_USERS = {
    "priya.k": { pass:"forensic2026", role:"Senior Analyst", initials:"PK" },
    "rajan.s": { pass:"forensic2026", role:"Analyst",        initials:"RS" },
    "admin":   { pass:"admin",        role:"Administrator",  initials:"AD" },
  };

  const handleSubmit = () => {
    const u = DEMO_USERS[user.toLowerCase().trim()];
    if (!u || u.pass !== pass) { setError("Invalid credentials."); return; }
    setError("");
    setLoading(true);
    setTimeout(() => onLogin({ username: user, ...u }), 900);
  };

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const hhmm    = time.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
  const dateStr = time.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:T.bg, overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", top:28, left:34, zIndex:2 }}>
        <div style={{ fontFamily:T.mono, fontSize:18, color:T.textDim, letterSpacing:"-0.02em" }}>{hhmm}</div>
        <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.14em", marginTop:3, textTransform:"uppercase" }}>{dateStr}</div>
      </div>

      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:1 }}>
        <div style={{ width:360 }}>
          <div style={{ textAlign:"center", marginBottom:44 }}>
            <div style={{ fontFamily:T.serif, fontSize:44, fontWeight:700, color:T.textBri, letterSpacing:"0.01em", lineHeight:1 }}>
              MuleNet<span style={{ fontStyle:"italic" }}>X</span>
            </div>
            <div style={{ width:28, height:1, background:T.border, margin:"18px auto 0" }} />
          </div>

          <div style={{ padding:"28px 0" }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:7 }}>Analyst ID</div>
              <input value={user} onChange={e => { setUser(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="priya.k"
                style={{ width:"100%", padding:"10px 12px",
                  background:"transparent", border:`1px solid ${error ? T.high : T.border}`,
                  color:T.textBri, fontFamily:T.mono, fontSize:12,
                  outline:"none", letterSpacing:"0.04em", boxSizing:"border-box" }} />
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim,
                letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:7 }}>Passphrase</div>
              <div style={{ position:"relative" }}>
                <input value={pass} onChange={e => { setPass(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  type={showPass ? "text" : "password"}
                  placeholder="············"
                  style={{ width:"100%", padding:"10px 36px 10px 12px",
                    background:"transparent", border:`1px solid ${error ? T.high : T.border}`,
                    color:T.textBri, fontFamily:T.mono, fontSize:12,
                    outline:"none", letterSpacing:"0.06em", boxSizing:"border-box" }} />
                <button onClick={() => setShowPass(s => !s)} style={{
                  position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer",
                  color:T.textDim, fontFamily:T.mono, fontSize:10,
                }}>
                  {showPass ? "○" : "●"}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding:"8px 10px", border:`1px solid rgba(${hexRgb(T.high)},0.22)`,
                marginBottom:16, fontFamily:T.mono, fontSize:9, color:T.high, letterSpacing:"0.05em" }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading || !user || !pass}
              style={{
                width:"100%", padding:"12px",
                background: loading || !user || !pass ? "transparent" : T.textBri,
                border:`1px solid ${!user || !pass || loading ? T.border : T.textBri}`,
                color: loading || !user || !pass ? T.textDim : T.bg,
                fontFamily:T.mono, fontSize:9.5, letterSpacing:"0.2em",
                textTransform:"uppercase", cursor: !user || !pass || loading ? "not-allowed" : "pointer",
                transition:"all 0.15s", fontWeight:600,
              }}>
              {loading ? (
                <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                  <span style={{ display:"inline-block", width:10, height:10,
                    border:`1.5px solid ${T.border}`,
                    borderTop:`1.5px solid ${T.textDim}`,
                    borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                  Authenticating
                </span>
              ) : "Authenticate →"}
            </button>

            <div style={{ marginTop:16, textAlign:"center" }}>
              <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.06em" }}>
                priya.k / forensic2026
              </div>
            </div>
          </div>

          <div style={{ textAlign:"center", marginTop:20 }}>
            <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.12em" }}>
              UNAUTHORISED ACCESS IS AN OFFENCE · SESSION IS LOGGED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── HOME PAGE COMPONENTS ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function IndiaMapChoropleth({ paths, selected, hovered, onSelect, onHover }) {
  const svgRef = useRef(null);
  const [zs, setZs] = useState({ k:1, tx:0, ty:0 });
  const drag = useRef({ on:false, lx:0, ly:0 });
  const [dragging, setDragging] = useState(false);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.28 : 1/1.28;
    const mx = (e.clientX - rect.left) * SVG_W / rect.width;
    const my = (e.clientY - rect.top)  * SVG_H / rect.height;
    setZs(s => {
      const nk = Math.min(Math.max(s.k * factor, 0.65), 10);
      return { k:nk, tx: mx - (mx - s.tx) * nk / s.k, ty: my - (my - s.ty) * nk / s.k };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onMouseDown = useCallback((e) => { drag.current = { on:true, lx:e.clientX, ly:e.clientY }; setDragging(true); }, []);
  const onMouseMove = useCallback((e) => {
    if (!drag.current.on) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = (e.clientX - drag.current.lx) * SVG_W / rect.width;
    const dy = (e.clientY - drag.current.ly) * SVG_H / rect.height;
    drag.current.lx = e.clientX; drag.current.ly = e.clientY;
    setZs(s => ({ ...s, tx: s.tx + dx, ty: s.ty + dy }));
  }, []);
  const onMouseUp = useCallback(() => { drag.current.on = false; setDragging(false); }, []);

  const btnZoom = (f) => setZs(s => {
    const cx = SVG_W/2, cy = SVG_H/2;
    const nk = Math.min(Math.max(s.k * f, 0.65), 10);
    return { k:nk, tx: cx - (cx - s.tx) * nk / s.k, ty: cy - (cy - s.ty) * nk / s.k };
  });

  const { k, tx, ty } = zs;
  const hovPath = paths.find(p => p.stateName === hovered);

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", userSelect:"none" }}>
      <svg ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width:"100%", height:"100%", display:"block", cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <rect width={SVG_W} height={SVG_H} fill="#000000"/>

        <g transform={`translate(${tx},${ty}) scale(${k})`}>
          {paths.map(p => {
            const { id, stateName, data, d } = p;
            const risk  = data?.risk ?? 0;
            const isHov = hovered  === stateName;
            const isSel = selected === stateName;
            let fill = riskFill(risk);
            if (isHov || isSel) { const col = d3.color(fill); if (col) fill = col.brighter(isHov ? 0.7 : 1.1).toString(); }
            return (
              <path key={id} d={d} fill={fill}
                stroke={isSel ? "#888888" : isHov ? "#333" : "#111111"}
                strokeWidth={(isSel ? 1.2 : isHov ? 0.6 : 0.25) / k}
                style={{ cursor: data ? "pointer" : "default", transition:"fill 0.12s" }}
                onMouseEnter={() => onHover(stateName)}
                onMouseLeave={() => onHover(null)}
                onClick={() => { if (data) onSelect(stateName === selected ? null : stateName); }}
              />
            );
          })}
          {paths
            .filter(p => p.data && p.data.risk >= 60 && !isNaN(p.centroid[0]))
            .map(p => (
              <text key={`l-${p.id}`}
                x={p.centroid[0]} y={p.centroid[1]}
                textAnchor="middle" dominantBaseline="central"
                fontSize={(p.data.risk >= 75 ? 9.5 : 7.5) / k}
                fill={p.data.risk >= 70 ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.45)"}
                fontFamily="JetBrains Mono,monospace"
                style={{ pointerEvents:"none", userSelect:"none" }}>
                {p.data.code}
              </text>
            ))}

          {hovered && hovPath?.data && (() => {
            const { data, centroid:[cx, cy] } = hovPath;
            if (isNaN(cx) || isNaN(cy)) return null;
            const W = 170/k, H = 96/k;
            const visR = (SVG_W - tx) / k, visB = (SVG_H - ty) / k;
            const ttx = (cx + W + 14/k < visR) ? cx + 14/k : cx - W - 14/k;
            const tty = (cy + H < visB) ? cy : cy - H;
            const col = rc(data.risk);
            const f = n => n/k;
            return (
              <g style={{ pointerEvents:"none" }}>
                <rect x={ttx} y={tty} width={W} height={H} rx={f(1)}
                  fill="#030303" fillOpacity={0.97} stroke="#222" strokeWidth={f(0.4)}/>
                <rect x={ttx} y={tty} width={f(2)} height={H} fill={col}/>
                <text x={ttx+f(11)} y={tty+f(18)} fontSize={f(11)} fontWeight="700"
                  fill={T.textBri} fontFamily="Playfair Display,serif">{hovered}</text>
                <text x={ttx+f(11)} y={tty+f(33)} fontSize={f(7.5)} fill={T.textDim} fontFamily="JetBrains Mono,monospace">RISK SCORE</text>
                <text x={ttx+f(11)} y={tty+f(44)} fontSize={f(8.5)} fill={col} fontFamily="JetBrains Mono,monospace">{rl(data.risk)} · {data.risk}/100</text>
                <text x={ttx+f(11)} y={tty+f(58)} fontSize={f(8)} fill={T.text} fontFamily="JetBrains Mono,monospace">{data.count} accounts · {fmtMoney(data.amount)}</text>
                <text x={ttx+f(11)} y={tty+f(72)} fontSize={f(7.5)} fill={T.textDim} fontFamily="JetBrains Mono,monospace">{data.cases} active case{data.cases!==1?"s":""}</text>
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Zoom controls */}
      <div style={{ position:"absolute", bottom:16, right:16, display:"flex", flexDirection:"column", gap:2 }}>
        {[{l:"+",f:()=>btnZoom(1.5)},{l:"⊡",f:()=>setZs({k:1,tx:0,ty:0})},{l:"−",f:()=>btnZoom(1/1.5)}].map(({l,f})=>(
          <button key={l} onClick={f} style={{
            width:24, height:24, background:"transparent", border:`1px solid ${T.border}`,
            color:T.textDim, fontFamily:T.mono, fontSize:12,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          }}
          onMouseEnter={e=>{e.currentTarget.style.color=T.textBri;e.currentTarget.style.borderColor=T.borderBri;}}
          onMouseLeave={e=>{e.currentTarget.style.color=T.textDim;e.currentTarget.style.borderColor=T.border;}}
          >{l}</button>
        ))}
      </div>

      <div style={{ position:"absolute", bottom:16, left:14 }}>
        <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim }}>{Math.round(k*100)}%</div>
        <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, marginTop:2 }}>scroll · drag</div>
      </div>

    </div>
  );
}

function LeftSidebar({ selected }) {
  const total      = Object.values(STATE_DATA).reduce((s,d)=>s+d.count,0);
  const totalAmt   = Object.values(STATE_DATA).reduce((s,d)=>s+d.amount,0);
  const totalCases = Object.values(STATE_DATA).reduce((s,d)=>s+d.cases,0);
  const highRisk   = Object.values(STATE_DATA).filter(d=>d.risk>=80).length;
  const [slide, setSlide] = useState(0);

  const slides = [
    { label:"SUSPICIOUS VOLUME",  value:fmtMoney(totalAmt),    sub:"+34% vs yesterday"   },
    { label:"FLAGGED ACCOUNTS",   value:`${total}`,             sub:"across all states"   },
    { label:"ACTIVE CASES",       value:`${totalCases}`,        sub:"under investigation" },
    { label:"HIGH-RISK STATES",   value:`${highRisk}`,          sub:`of ${Object.keys(STATE_DATA).length} monitored` },
    { label:"AVG RISK SCORE",     value:"71",                   sub:"national average"    },
  ];

  const selData = selected ? STATE_DATA[selected] : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Title */}
      <div style={{ padding:"20px 20px 14px", flexShrink:0 }}>
        <div style={{ fontFamily:T.serif, fontSize:22, fontWeight:700, color:T.textBri, lineHeight:1.1 }}>
          INDIA <span style={{ fontStyle:"italic" }}>Heatmap</span>
        </div>
      </div>

      {/* Carousel */}
      <div style={{ padding:"0 20px 18px", flexShrink:0 }}>
        <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.18em", marginBottom:10 }}>
          {slides[slide].label}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={() => setSlide(s => (s - 1 + slides.length) % slides.length)}
            style={{ background:"none", border:"none", color:T.textDim, fontFamily:T.mono, fontSize:12, cursor:"pointer", padding:0, lineHeight:1 }}>←</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:T.serif, fontSize:32, fontWeight:700, color:T.textBri, letterSpacing:"-0.02em", lineHeight:1 }}>
              {slides[slide].value}
            </div>
            <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, marginTop:6 }}>{slides[slide].sub}</div>
          </div>
          <button onClick={() => setSlide(s => (s + 1) % slides.length)}
            style={{ background:"none", border:"none", color:T.textDim, fontFamily:T.mono, fontSize:12, cursor:"pointer", padding:0, lineHeight:1 }}>→</button>
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:12 }}>
          {slides.map((_, i) => (
            <div key={i} onClick={() => setSlide(i)} style={{
              width: i === slide ? 16 : 4, height:4,
              background: i === slide ? T.textBri : T.textDim,
              borderRadius:2, cursor:"pointer", transition:"all 0.2s",
            }} />
          ))}
        </div>
      </div>

      <div style={{ height:1, background:T.border, flexShrink:0 }} />

      {/* Selected state detail */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {selData ? (
          <div style={{ padding:"16px 20px", animation:"fadeIn 0.18s ease" }}>
            <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.16em", marginBottom:8 }}>SELECTED STATE</div>
            <div style={{ fontFamily:T.serif, fontSize:18, fontWeight:700, color:T.textBri, marginBottom:14, lineHeight:1.1 }}>{selected}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
              {[
                ["Risk",     `${selData.risk}/100`],
                ["Level",    rl(selData.risk)],
                ["Accounts", `${selData.count}`],
                ["Volume",   fmtMoney(selData.amount)],
                ["Cases",    `${selData.cases}`],
                ["Avg Txn",  fmtMoney(selData.avgTxn)],
              ].map(([lbl,val]) => (
                <div key={lbl} style={{ padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.08em", marginBottom:3 }}>{lbl}</div>
                  <div style={{ fontFamily:T.mono, fontSize:11, color:T.textBri }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20, gap:5 }}>
            <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, letterSpacing:"0.1em" }}>NO STATE SELECTED</div>
            <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, textAlign:"center", lineHeight:2 }}>Click any state<br/>to inspect</div>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanel() {
  const alerts = [
    { msg:"3 new high-risk accounts — Maharashtra",  time:"2m"  },
    { msg:"CASE-111 SLA breach in 45 minutes",        time:"5m"  },
    { msg:"Model v2.1 deployed, +12% recall",         time:"1h"  },
  ];
  const stateList = Object.entries(STATE_DATA).map(([name,d])=>({name,...d})).sort((a,b)=>b.amount-a.amount).slice(0,10);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ flexShrink:0 }}>
        <div style={{ padding:"14px 20px 11px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.2em" }}>ACTIVE ALERTS</span>
        </div>
        {alerts.map((a,i) => (
          <div key={i} style={{ padding:"11px 20px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:T.serif, fontSize:12, color:T.textBri, lineHeight:1.45, marginBottom:3 }}>{a.msg}</div>
            <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim }}>{a.time} ago</div>
          </div>
        ))}
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        <div style={{ padding:"13px 20px 9px", borderBottom:`1px solid ${T.border}`, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.14em" }}>TOP 10 STATES</span>
          <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim }}>RANKED BY VOLUME</span>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {stateList.map((item, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", padding:"9px 20px",
              borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHi}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, width:18, flexShrink:0 }}>{i+1}</span>
              <span style={{ fontFamily:T.serif, fontSize:12, color:T.textBri, fontWeight:600, flex:1 }}>{item.name}</span>
              <span style={{ fontFamily:T.mono, fontSize:10.5, color:T.textBri }}>{fmtMoney(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const [geoData,  setGeoData]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [geoError, setGeoError] = useState(null);
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const urls = [
      "https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson",
      "https://raw.githubusercontent.com/datameet/maps/master/States/India_States.geojson",
    ];
    let cancelled = false;
    (async () => {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (!cancelled) { setGeoData(data); setLoading(false); return; }
        } catch { /* try next */ }
      }
      if (!cancelled) { setGeoError("Could not load map."); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const paths = useMemo(() => {
    if (!geoData) return [];
    try {
      const proj = d3.geoMercator().fitSize([SVG_W, SVG_H * 0.96], geoData);
      const gen  = d3.geoPath().projection(proj);
      return geoData.features.map(f => {
        const rawName   = getGeoName(f.properties);
        const stateName = normState(rawName);
        const data      = stateName ? STATE_DATA[stateName] : null;
        const d         = gen(f);
        const centroid  = gen.centroid(f);
        return { id: rawName, stateName, data, d, centroid };
      }).filter(p => p.d && p.d.length > 10);
    } catch { return []; }
  }, [geoData]);

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
      <div style={{ width:224, flexShrink:0, overflow:"hidden", borderRight:`1px solid ${T.border}` }}>
        <LeftSidebar selected={selected} />
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>
        <div style={{
          height:40, display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"0 20px", borderBottom:`1px solid ${T.border}`, flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
            <span style={{ fontFamily:T.serif, fontSize:14, fontWeight:700, color:T.textBri, fontStyle:"italic" }}>India Fraud Heatmap</span>
            <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim }}>{Object.keys(STATE_DATA).length} states monitored</span>
          </div>
          <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.06em" }}>SCROLL TO ZOOM · DRAG TO PAN · CLICK TO SELECT</span>
        </div>
        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
          {loading && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
              <div style={{ width:18, height:18, border:`1px solid ${T.border}`, borderTop:`1px solid ${T.textDim}`, borderRadius:"50%", animation:"spin 0.9s linear infinite" }}/>
              <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, letterSpacing:"0.12em" }}>LOADING MAP</span>
            </div>
          )}
          {geoError && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:T.mono, fontSize:10, color:T.textDim }}>{geoError}</span>
            </div>
          )}
          {!loading && !geoError && paths.length > 0 && (
            <IndiaMapChoropleth paths={paths} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
          )}
        </div>
      </div>
      <div style={{ width:240, flexShrink:0, overflow:"hidden", borderLeft:`1px solid ${T.border}` }}>
        <RightPanel />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── GRAPH EXPLORER COMPONENTS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function LayerToggle({ item, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:7, padding:"4px 8px",
        cursor:"pointer",
        background: hov ? T.surfaceHi : "transparent",
        transition:"background 0.1s",
      }}>
      <span style={{ fontFamily:T.mono, fontSize:9.5, color: active ? T.textMid : T.textDim, opacity: active ? 1 : 0.3, lineHeight:1 }}>{item.shape}</span>
      <span style={{ fontFamily:T.mono, fontSize:7.5, letterSpacing:"0.07em", color: active ? T.text : T.textDim, opacity: active ? 1 : 0.3, textTransform:"uppercase" }}>{item.label}</span>
    </div>
  );
}

function ForceGraph({ nodes, edges, onNodeClick, selectedId, visibleLayers, stateFilters, statusFilters }) {
  const [positions, setPositions] = useState({});
  const [tooltip, setTooltip] = useState(null);
  const edgesRef = useRef([]);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const W = 900, H = 620;

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .clickDistance(4)
      .on("zoom", (event) => {
        if (gRef.current) gRef.current.setAttribute("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);
    return () => { svg.on(".zoom", null); };
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1/1.5);
  }, []);

  const visibleNodes = nodes.filter(n => {
    if (n.known) { if (!visibleLayers.has("known")) return false; }
    else if (n.risk >= 80) { if (!visibleLayers.has("high")) return false; }
    else if (n.risk >= 60) { if (!visibleLayers.has("med")) return false; }
    else { if (!visibleLayers.has("low")) return false; }
    if (stateFilters.size > 0 && !stateFilters.has(n.state)) return false;
    if (statusFilters.size > 0 && !statusFilters.has(n.status)) return false;
    return true;
  });

  const visibleIds = new Set(visibleNodes.map(n => n.id));

  const visibleEdges = edges.filter(e => {
    const sid = typeof e.source === "object" ? e.source.id : e.source;
    const tid = typeof e.target === "object" ? e.target.id : e.target;
    if (!visibleIds.has(sid) || !visibleIds.has(tid)) return false;
    if (e.amount > 300000) return visibleLayers.has("major");
    if (e.amount > 100000) return visibleLayers.has("mid");
    return visibleLayers.has("minor");
  });

  const graphKey = [...visibleLayers].sort().join("-") + [...stateFilters].sort().join("-") + [...statusFilters].sort().join("-");

  useEffect(() => {
    if (!visibleNodes.length) return;
    const nc = visibleNodes.map(n => ({ ...n }));
    const idSet = new Set(nc.map(n => n.id));
    const ec = visibleEdges.map(e => ({ ...e })).filter(e => {
      const s = typeof e.source === "object" ? e.source.id : e.source;
      const t = typeof e.target === "object" ? e.target.id : e.target;
      return idSet.has(s) && idSet.has(t);
    });
    edgesRef.current = ec;
    const maxAmt = Math.max(...ec.map(e => e.amount), 1);
    const sim = d3.forceSimulation(nc)
      .force("link", d3.forceLink(ec).id(d => d.id).distance(d => 80 + 45 * (1 - d.amount / maxAmt)).strength(0.55))
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(d => nodeR(d) + 12));
    sim.on("tick", () => {
      const pos = {};
      nc.forEach(n => { pos[n.id] = { x: n.x, y: n.y }; });
      setPositions(p => ({ ...p, ...pos }));
    });
    return () => sim.stop();
  // eslint-disable-next-line
  }, [graphKey]);

  function nodeR(n) { return n.known ? 20 : 7 + Math.min(n.deg / 3.5, 14); }
  const maxAmt = Math.max(...visibleEdges.map(e => e.amount), 1);
  function nodeColor(n) { if (n.known) return T.textBri; return rc(n.risk); }

  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display:"block", background:"#000000" }}>
        <rect width={W} height={H} fill="#000000"/>

        <g ref={gRef}>
          {edgesRef.current.map((e, i) => {
            const sid = e.source?.id || e.source;
            const tid = e.target?.id || e.target;
            const sp = positions[sid], tp = positions[tid];
            if (!sp || !tp) return null;
            const sn = visibleNodes.find(n => n.id === sid);
            const ew = 0.7 + (e.amount / maxAmt) * 4;
            const ec = nodeColor(sn || { risk: 0 });
            const opacity = e.amount > 300000 ? 0.22 : e.amount > 100000 ? 0.13 : 0.07;
            return (
              <line key={i} x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                stroke={ec} strokeWidth={ew} strokeOpacity={opacity} strokeLinecap="round" />
            );
          })}

          {visibleNodes.map(n => {
            const pos = positions[n.id];
            if (!pos) return null;
            const r = nodeR(n);
            const c = nodeColor(n);
            const isSel = selectedId === n.id;
            return (
              <g key={n.id} style={{ cursor:"pointer" }}
                onClick={() => onNodeClick(n)}
                onMouseEnter={() => setTooltip({ n, x: pos.x, y: pos.y })}
                onMouseLeave={() => setTooltip(null)}>
                {isSel && (
                  <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={c} strokeWidth={0.8} strokeOpacity={0.2} strokeDasharray="4,3" />
                )}
                <circle cx={pos.x} cy={pos.y} r={r}
                  fill={c} fillOpacity={isSel ? 0.22 : 0.06}
                  stroke={c} strokeWidth={isSel ? 1.5 : 0.8}
                  strokeOpacity={isSel ? 1 : 0.45} />
                {n.known && (
                  <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize="10" fill={T.textBri} fontFamily={T.mono} fontWeight="700">!</text>
                )}
                {(r > 12 || isSel) && (
                  <text x={pos.x} y={pos.y + r + 11} textAnchor="middle"
                    fontSize="7.5" fill={isSel ? T.textBri : T.textDim}
                    fontFamily={T.mono} letterSpacing="0.03em">
                    {n.id.slice(-4)}
                  </text>
                )}
              </g>
            );
          })}

          {tooltip && positions[tooltip.n.id] && (() => {
            const { x, y } = positions[tooltip.n.id];
            const ttx = x > 750 ? x - 148 : x + 14;
            const tty = y > 500 ? y - 70 : y - 14;
            const c  = nodeColor(tooltip.n);
            const h  = tooltip.n.known ? 76 : 62;
            return (
              <g style={{ pointerEvents:"none" }}>
                <rect x={ttx} y={tty} width={150} height={h} rx={1} fill="#000000" stroke={c} strokeWidth={0.3} strokeOpacity={0.3} />
                <rect x={ttx} y={tty} width={1.5} height={h} fill={c} />
                <text x={ttx+10} y={tty+16} fontSize="10" fill={T.textBri} fontFamily={T.mono} fontWeight="600">{tooltip.n.id}</text>
                <text x={ttx+10} y={tty+29} fontSize="8.5" fill={c} fontFamily={T.mono}>{tooltip.n.risk} {rl(tooltip.n.risk)} · {tooltip.n.label}</text>
                <text x={ttx+10} y={tty+43} fontSize="8" fill={T.textDim} fontFamily={T.mono}>{tooltip.n.deg} connections · {fmtMoney(tooltip.n.volume)}</text>
                {tooltip.n.known && (
                  <text x={ttx+10} y={tty+60} fontSize="7.5" fill={T.textBri} fontFamily={T.mono}>Known malicious entity</text>
                )}
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Zoom controls */}
      <div style={{ position:"absolute", bottom:14, right:14, display:"flex", flexDirection:"column", gap:2 }}>
        {[
          { l:"+", f: handleZoomIn  },
          { l:"⊡", f: handleReset  },
          { l:"−", f: handleZoomOut },
        ].map(({l,f}) => (
          <button key={l} onClick={f} style={{
            width:26, height:26, background:"transparent", border:`1px solid ${T.border}`,
            color:T.textDim, fontFamily:T.mono, fontSize:12,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          }}
          onMouseEnter={e=>{e.currentTarget.style.color=T.textBri;e.currentTarget.style.borderColor=T.borderBri;}}
          onMouseLeave={e=>{e.currentTarget.style.color=T.textDim;e.currentTarget.style.borderColor=T.border;}}
          >{l}</button>
        ))}
      </div>

      <div style={{ position:"absolute", bottom:26, left:12, fontFamily:T.mono, fontSize:8, color:T.textDim, pointerEvents:"none" }}>
        {visibleNodes.length} NODES · {visibleEdges.length} EDGES
      </div>
      <div style={{ position:"absolute", bottom:10, left:12, fontFamily:T.mono, fontSize:7.5, color:T.textDim, pointerEvents:"none" }}>
        scroll · drag · pinch
      </div>
    </div>
  );
}

function NodeDetailPanel({ node, onClose }) {
  const [tab, setTab] = useState("stats");
  if (!node) return null;
  const c = node.known ? T.textBri : rc(node.risk);

  const connEdges = EDGES.filter(e => {
    const s = typeof e.source === "object" ? e.source.id : e.source;
    const t = typeof e.target === "object" ? e.target.id : e.target;
    return s === node.id || t === node.id;
  });
  const connNodes = connEdges.map(e => {
    const s = typeof e.source === "object" ? e.source.id : e.source;
    const t = typeof e.target === "object" ? e.target.id : e.target;
    return { id: s === node.id ? t : s, amount: e.amount, direction: s === node.id ? "out" : "in" };
  });

  const TIMELINE = [
    { date:"Apr 11", txns:8,  amt:580000  },
    { date:"Apr 10", txns:12, amt:890000  },
    { date:"Apr 9",  txns:6,  amt:340000  },
    { date:"Apr 8",  txns:15, amt:1200000 },
    { date:"Apr 7",  txns:4,  amt:220000  },
    { date:"Apr 6",  txns:9,  amt:670000  },
    { date:"Apr 5",  txns:3,  amt:140000  },
  ];

  return (
    <div style={{ width:280, flexShrink:0, background:T.bg, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"12px 15px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontFamily:T.serif, fontSize:14, fontWeight:700, color:T.textBri, fontStyle:"italic" }}>{node.id}</div>
            <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, marginTop:3, letterSpacing:"0.08em" }}>
              {node.label.toUpperCase()} · {node.state}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textDim, fontSize:13, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ marginTop:9, display:"flex", gap:8, alignItems:"baseline" }}>
          <span style={{ fontFamily:T.mono, fontSize:11, color:T.textBri }}>
            <b>{node.risk}</b>
            <span style={{ fontSize:8.5, opacity:0.6, marginLeft:4 }}>{rl(node.risk)}</span>
          </span>
          {node.known && (
            <span style={{ fontFamily:T.mono, fontSize:8, color:T.textBri, border:`1px solid ${T.border}`, padding:"2px 7px", letterSpacing:"0.06em" }}>BLACKLISTED</span>
          )}
        </div>
      </div>

      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        {[["stats","STATS"],["links","LINKS"],["timeline","TIMELINE"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex:1, padding:"8px 0", background:"none", border:"none",
            borderBottom: tab===k ? `1px solid ${T.textBri}` : "1px solid transparent",
            color: tab===k ? T.textBri : T.textDim,
            fontFamily:T.mono, fontSize:8, letterSpacing:"0.08em",
            cursor:"pointer",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"12px 15px" }}>
        {tab === "stats" && (
          <div style={{ display:"flex", flexDirection:"column" }}>
            {[
              ["Risk Score",   <span style={{ fontFamily:T.mono, fontSize:11, color:c }}>{node.risk} / 100</span>],
              ["State",        <span style={{ fontFamily:T.mono, fontSize:10, color:T.text }}>{node.label}</span>],
              ["Connections",  <span style={{ fontFamily:T.mono, fontSize:11, color:T.text }}>{node.deg}</span>],
              ["Total Volume", <span style={{ fontFamily:T.mono, fontSize:11, color:T.text }}>{fmtMoney(node.volume)}</span>],
              ["Status",       <span style={{ fontFamily:T.mono, fontSize:9, color: node.known ? T.textBri : rc(node.risk) }}>{node.status}</span>],
            ].map(([k, v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontFamily:T.mono, fontSize:8.5, color:T.textDim, letterSpacing:"0.06em" }}>{k}</span>
                {v}
              </div>
            ))}
            <div style={{ marginTop:14 }}>
              <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.12em", marginBottom:7 }}>RISK GAUGE</div>
              <div style={{ background:T.border, height:1, position:"relative" }}>
                <div style={{ width:`${node.risk}%`, background:c, height:"100%", transition:"width 0.4s" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                <span style={{ fontFamily:T.mono, fontSize:7, color:T.textDim }}>0</span>
                <span style={{ fontFamily:T.mono, fontSize:7, color:T.high }}>100</span>
              </div>
            </div>
            {node.known && (
              <div style={{ marginTop:12, borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
                <div style={{ fontFamily:T.serif, fontSize:11, fontStyle:"italic", color:T.textBri, marginBottom:4 }}>Known malicious entity</div>
                <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, lineHeight:1.7 }}>Flag all inbound connections for immediate review.</div>
              </div>
            )}
          </div>
        )}

        {tab === "links" && (
          <div>
            <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.12em", marginBottom:10 }}>CONNECTED ({connNodes.length})</div>
            {connNodes.length === 0 && <div style={{ fontFamily:T.mono, fontSize:9.5, color:T.textDim }}>No visible connections.</div>}
            {connNodes.map((cn, i) => {
              const dn = NODES.find(n => n.id === cn.id);
              return (
                <div key={i} style={{ padding:"7px 0", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontFamily:T.mono, fontSize:10, color:T.textBri }}>{cn.id}</div>
                    <div style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, marginTop:1 }}>{dn?.label || "Unknown"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:T.mono, fontSize:9.5, color: cn.direction === "out" ? T.high : T.low }}>
                      {cn.direction === "out" ? "→" : "←"} {fmtMoney(cn.amount)}
                    </div>
                    {dn && <div style={{ fontFamily:T.mono, fontSize:7.5, color:rc(dn.risk), marginTop:1 }}>{rl(dn.risk)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "timeline" && (
          <div>
            <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.12em", marginBottom:10 }}>ACTIVITY — LAST 7 DAYS</div>
            {TIMELINE.map(d => (
              <div key={d.date} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, width:38, flexShrink:0 }}>{d.date}</span>
                <div style={{ flex:1, background:T.border, height:1 }}>
                  <div style={{ width:`${(d.amt / 1200000) * 100}%`, background:c, height:"100%", transition:"width 0.3s" }} />
                </div>
                <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, width:32, textAlign:"right", flexShrink:0 }}>{d.txns}txn</span>
                <span style={{ fontFamily:T.mono, fontSize:8, color:T.text, width:42, textAlign:"right", flexShrink:0 }}>{fmtMoney(d.amt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!node.known && (
        <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, display:"flex", gap:6, flexShrink:0 }}>
          <button style={{ flex:1, padding:"7px 0", background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, fontFamily:T.mono, fontSize:8.5, cursor:"pointer", letterSpacing:"0.08em" }}>+ CASE</button>
          <button style={{ flex:1, padding:"7px 0", background:"transparent", border:`1px solid rgba(${hexRgb(T.high)},0.3)`, color:T.high, fontFamily:T.mono, fontSize:8.5, cursor:"pointer", letterSpacing:"0.08em" }}>FLAG</button>
        </div>
      )}
    </div>
  );
}

function GraphExplorerPage() {
  const [selectedNode,    setSelectedNode]    = useState(null);
  const [search,          setSearch]          = useState("");
  const [activeLayerKeys, setActiveLayerKeys] = useState(new Set(["high","med","low","known","major","mid","minor"]));
  const [stateFilters,    setStateFilters]    = useState(new Set());
  const [statusFilters,   setStatusFilters]   = useState(new Set());
  const [expandedGroup,   setExpandedGroup]   = useState(new Set(["risk","edge"]));

  const displayNodes = NODES.filter(n =>
    !search || n.id.toLowerCase().includes(search.toLowerCase()) || n.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggleLayer = (groupKey, itemKey) => {
    const g = LAYER_GROUPS.find(gg => gg.key === groupKey);
    if (g?.key === "state") {
      setStateFilters(prev => { const next = new Set(prev); next.has(itemKey) ? next.delete(itemKey) : next.add(itemKey); return next; });
    } else if (g?.key === "status") {
      setStatusFilters(prev => { const next = new Set(prev); next.has(itemKey) ? next.delete(itemKey) : next.add(itemKey); return next; });
    } else {
      setActiveLayerKeys(prev => { const next = new Set(prev); next.has(itemKey) ? next.delete(itemKey) : next.add(itemKey); return next; });
    }
  };

  const isItemActive = (groupKey, itemKey) => {
    const g = LAYER_GROUPS.find(gg => gg.key === groupKey);
    if (!g) return false;
    if (g.key === "state")  return stateFilters.has(itemKey)  || stateFilters.size  === 0;
    if (g.key === "status") return statusFilters.has(itemKey) || statusFilters.size === 0;
    return activeLayerKeys.has(itemKey);
  };

  const toggleGroup = (k) => setExpandedGroup(prev => {
    const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next;
  });

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

      {/* LEFT SIDEBAR */}
      <div style={{ width:186, flexShrink:0, background:T.bg, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"14px 15px 10px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ fontFamily:T.serif, fontSize:15, fontWeight:700, color:T.textBri, fontStyle:"italic" }}>Graph Explorer</div>
          <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, marginTop:4, letterSpacing:"0.1em" }}>
            {NODES.length} NODES · {EDGES.length} EDGES
          </div>
        </div>

        <div style={{ padding:"7px 9px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:`1px solid ${T.border}`, padding:"4px 8px" }}>
            <span style={{ fontFamily:T.mono, fontSize:10, color:T.textDim }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a node..."
              style={{ flex:1, background:"none", border:"none", color:T.text, fontFamily:T.mono, fontSize:8.5, outline:"none", minWidth:0 }} />
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", paddingBottom:8 }}>
          {LAYER_GROUPS.map(group => (
            <div key={group.key}>
              <div onClick={() => toggleGroup(group.key)}
                style={{ padding:"6px 10px 5px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.14em", textTransform:"uppercase" }}>{group.label}</span>
                <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim }}>{expandedGroup.has(group.key) ? "▾" : "▸"}</span>
              </div>
              {expandedGroup.has(group.key) && (
                <div style={{ padding:"3px 4px 4px" }}>
                  {group.items.map(item => (
                    <LayerToggle key={item.key} item={item} active={isItemActive(group.key, item.key)} onClick={() => toggleLayer(group.key, item.key)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {(stateFilters.size > 0 || statusFilters.size > 0) && (
          <div style={{ padding:"8px 10px", borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
            <button onClick={() => { setStateFilters(new Set()); setStatusFilters(new Set()); }}
              style={{ width:"100%", padding:"5px 0", background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, fontFamily:T.mono, fontSize:8, cursor:"pointer", letterSpacing:"0.08em" }}>
              ✕ CLEAR FILTERS
            </button>
          </div>
        )}
      </div>

      {/* CENTER GRAPH CANVAS */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
        <div style={{ flex:1, position:"relative", overflow:"hidden", background:"#000000" }}>
          <ForceGraph nodes={displayNodes} edges={EDGES} onNodeClick={setSelectedNode}
            selectedId={selectedNode?.id} visibleLayers={activeLayerKeys}
            stateFilters={stateFilters} statusFilters={statusFilters} />
        </div>

        {/* Status bar */}
        <div style={{ height:24, background:T.bg, borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 14px", gap:16, flexShrink:0 }}>
          <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.06em" }}>
            {selectedNode ? `SELECTED · ${selectedNode.id} · RISK ${selectedNode.risk} · ${rl(selectedNode.risk)}` : "CLICK A NODE TO INSPECT · TOGGLE LAYERS IN SIDEBAR"}
          </span>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width: selectedNode ? 280 : 210, flexShrink:0, background:T.bg, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden", transition:"width 0.2s ease" }}>
        {selectedNode ? (
          <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        ) : (
          <>
            <div style={{ padding:"11px 14px 8px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.16em" }}>ACTIVE ALERTS</div>
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              {RECENT_EVENTS.map((ev, i) => (
                <div key={i} style={{ padding:"8px 14px", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <span style={{ fontFamily:T.mono, fontSize:9.5, color:T.textBri }}>{ev.id}</span>
                    <span style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim }}>{ev.ts}</span>
                  </div>
                  <div style={{ fontFamily:T.mono, fontSize:8.5, color:ev.color, marginTop:2 }}>{ev.msg}</div>
                </div>
              ))}
              <div style={{ padding:"10px 14px 4px", borderTop:`1px solid ${T.border}`, marginTop:4 }}>
                <div style={{ fontFamily:T.mono, fontSize:7.5, color:T.textDim, letterSpacing:"0.12em", marginBottom:8 }}>TOP NODES · BY VOLUME</div>
                {[...NODES].sort((a,b) => b.volume - a.volume).slice(0,8).map((n, i) => (
                  <div key={n.id} onClick={() => setSelectedNode(n)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 2px", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surfaceHi}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontFamily:T.mono, fontSize:8, color:T.textDim, width:14 }}>{i+1}</span>
                    <span style={{ fontFamily:T.mono, fontSize:9.5, color:T.textBri, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.id}</span>
                    <span style={{ fontFamily:T.mono, fontSize:9, color:T.textBri, whiteSpace:"nowrap" }}>{fmtMoney(n.volume)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ROOT ──────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function MULENETXFINALBOSS() {
  const [authed,      setAuthed]      = useState(false);
  const [user,        setUser]        = useState(null);
  const [activePage,  setActivePage]  = useState("home");
  const [storeState,  dispatch]       = useReducer(reducer, initialState);

  const drawerAccount  = storeState.accounts.find(a => a.id === storeState.drawerAccountId);
  const activeFlagged  = storeState.accounts.filter(a => a.status !== "False Positive" && a.status !== "Resolved").length;
  const openCasesCount = storeState.cases.filter(c => c.status === "Under Investigation").length;

  const handleLogin  = (u) => { setUser(u); setAuthed(true); setActivePage("home"); };
  const handleLogout = ()  => { setAuthed(false); setUser(null); setActivePage("home"); };

  const navLink = (key, label) => (
    <button key={key} onClick={() => setActivePage(key)} style={{
      padding:"0 22px", background:"none", border:"none",
      borderBottom: activePage===key ? `1px solid ${T.textBri}` : "1px solid transparent",
      color: activePage===key ? T.textBri : T.textDim,
      fontFamily:T.mono, fontSize:9, cursor:"pointer",
      letterSpacing:"0.14em", height:"100%",
      display:"flex", alignItems:"center",
    }}>
      {label}
    </button>
  );

  return (
    <StoreContext.Provider value={{ state: storeState, dispatch, navigate: setActivePage }}>
      <div style={{
        fontFamily:T.mono, background:T.bg, color:T.text,
        height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
          *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
          ::-webkit-scrollbar { width:2px; height:2px; background:transparent; }
          ::-webkit-scrollbar-thumb { background:${T.border}; }
          input { transition: border-color 0.12s; }
          input:focus { border-color:${T.borderBri} !important; }
          @keyframes spin   { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* ── NAV ── */}
        <nav style={{
          height:44, background:T.bg, borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"stretch", flexShrink:0,
        }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", padding:"0 24px", flexShrink:0 }}>
            <span style={{ fontFamily:T.serif, fontSize:20, fontWeight:700,
              color:T.textBri, letterSpacing:"0.02em" }}>
              MuleNet<span style={{ fontStyle:"italic" }}>X</span>
            </span>
          </div>

          {/* Center nav */}
          <div style={{ flex:1, display:"flex", alignItems:"stretch", justifyContent:"center" }}>
            {navLink("home",  "HOME")}
            {navLink("graph", "GRAPH")}
            {!authed && navLink("login",   "LOGIN")}
            {authed  && navLink("flagged", "ACCOUNTS")}
            {authed  && navLink("cases",   "CASES")}
          </div>

          {/* Right: logout */}
          <div style={{ display:"flex", alignItems:"center", padding:"0 22px" }}>
            {authed ? (
              <button onClick={handleLogout} style={{
                background:"none", border:"none",
                color:T.textBri, fontFamily:T.serif, fontSize:13,
                fontStyle:"italic", cursor:"pointer",
                padding:0, letterSpacing:"0.02em",
              }}>
                Logout
              </button>
            ) : null}
          </div>
        </nav>

        {/* ── PAGE CONTENT ── */}
        <main style={{ flex:1, overflow:"hidden", position:"relative", display:"flex", flexDirection:"column" }}>
          {activePage === "home"    && <HomePage />}
          {activePage === "graph"   && <GraphExplorerPage />}
          {activePage === "login"   && !authed && <LoginPage onLogin={handleLogin} />}
          {activePage === "flagged" && authed  && <FlaggedPage />}
          {activePage === "cases"   && authed  && <CasePage />}
        </main>

        {/* ── ACCOUNT DRAWER OVERLAY ── */}
        {drawerAccount && authed && (
          <>
            <div onClick={() => dispatch({ type:"CLOSE_DRAWER" })}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:299 }} />
            <AccountDrawer />
          </>
        )}
      </div>
    </StoreContext.Provider>
  );
}
