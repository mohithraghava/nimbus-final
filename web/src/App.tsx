/* NimbusPay Adoption Insights UI (v2). Talks to the same FastAPI backend as the legacy UI; all data synthetic.
   Behaviour is a 1:1 port of app/static/app.js: same tabs, controls, requests, numbers and data-testids. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import * as C from "./api/client";
import type { J } from "./lib/api";
import { AppCtx, GROUPS, TABS, type ChatMsg, type Ctx, type Tab } from "./lib/store";
import { LineageModal, WhyModal } from "./components/Explain";
import { CommandBar, CopilotBar, ShortcutSheet, Toasts } from "./components/chrome";
import { cap } from "./lib/format";
import { Skeleton } from "./components/ui";
import Data from "./pages/Data";
import Exec from "./pages/Exec";
import WhatIf from "./pages/WhatIf";
import Seats from "./pages/Seats";
import Region from "./pages/Region";
import Eng from "./pages/Eng";
import Agent from "./pages/Agent";
import Alerts from "./pages/Alerts";
import Compare from "./pages/Compare";
import Pack from "./pages/Pack";
import Audit from "./pages/Audit";
import Cost from "./pages/Cost";
import Models from "./pages/Models";

const SCREENS: Record<Tab, () => JSX.Element | null> = { data: Data, exec: Exec, whatif: WhatIf, seats: Seats, region: Region, eng: Eng, agent: Agent, alerts: Alerts, compare: Compare, pack: Pack, audit: Audit, cost: Cost, models: Models };
const LABEL = Object.fromEntries(TABS) as Record<Tab, string>;
const SEGMENTS = ["executive", "manager", "analyst", "guest"];
const SHORT: Record<string, string> = { baseline: "Baseline", breach: "Breach", healthy: "Healthy", incident: "Incident", newcountry: "New country", noids: "No IDs", overstated: "Overstated", shelfware: "Shelfware" };
const SID = "s-" + ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export default function App() {
  const [personas, setPersonas] = useState<Record<string, string> | null>(null);
  const [persona, setPersonaRaw] = useState("");
  const [SCEN, setSCEN] = useState<J[]>([]);
  const [ST, setST] = useState<J>(null);
  const nav = useNavigate(), loc = useLocation();
  const tab = ((loc.pathname.slice(1) || "data") in SCREENS ? (loc.pathname.slice(1) || "data") : "data") as Tab;
  const [, setV] = useState(0);
  const chatRef = useRef<ChatMsg[]>([]);
  const tabRef = useRef<Tab>("data"), personaRef = useRef(""), stRef = useRef<J>(null);
  const [lin, setLin] = useState<J>(null);
  const [whyM, setWhyM] = useState<{ m: ChatMsg; L: (J | null)[] } | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("np-side") === "1");
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    const t = localStorage.getItem("np-theme");
    return t === "light" || t === "dark" ? t : "system";
  });
  const [cmd, setCmd] = useState(false);
  const [panel, setPanel] = useState(false);
  const [help, setHelp] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const redraw = useCallback(() => setV((v) => v + 1), []);
  const navRef = useRef(nav); navRef.current = nav;
  const show = useCallback((t: Tab) => { tabRef.current = t; navRef.current("/" + t); }, []);
  const setPersona = useCallback((p: string) => { personaRef.current = p; setPersonaRaw(p); }, []);
  const setSTx = useCallback((s: J) => { stRef.current = s; setST(s); }, []);
  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const toggleTheme = useCallback(() => {
    const dark = document.documentElement.classList.contains("dark");
    const next = dark ? "light" : "dark";
    localStorage.setItem("np-theme", next);
    setTheme(next);
  }, []);

  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const loadScenario = useCallback(async (k: string) => {
    try {
      const s = await C.loadScenario(k);
      setSTx(s);
      chatRef.current.length = 0;
      show(tabRef.current === "data" ? "exec" : tabRef.current);
      toast(SHORT[k] || k);
    } catch (e) {
      console.error(e);
      toast("Couldn't load that preset");
    }
  }, [setSTx, show, toast]);

  useEffect(() => {
    (async () => {
      const ps = await C.getPersonas();
      setPersonas(ps); setPersona(Object.keys(ps)[0] || "");
      setSCEN(await C.getScenarios()); setSTx(await C.getState()); show("data");
    })();
  }, [setPersona, setSTx, show]);

  const explain = useCallback(async (mid: string) => {
    let L; try { L = await C.getLineage(mid); } catch { return; }
    setLin(L);
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { const k = (e.target as HTMLElement).closest?.("[data-metric]") as HTMLElement | null; if (k && /^M\d\d$/.test(k.dataset.metric || "")) explain(k.dataset.metric!); };
    document.addEventListener("click", h); return () => document.removeEventListener("click", h);
  }, [explain]);

  const why = useCallback(async (m: ChatMsg) => {
    const b = m.bot, ids = [...new Set<string>((b.citations || []).map((c: J) => c.metric))];
    const L = await Promise.all(ids.map((id) => (/^M\d\d$/.test(id) ? C.getLineage(id).catch(() => null) : Promise.resolve(null))));
    setWhyM({ m, L });
  }, []);

  const ask = useCallback(async (q: string, as?: string, stay?: boolean) => {
    if (!stay && tabRef.current !== "agent") show("agent");
    const persona = as || personaRef.current, CHAT = chatRef.current, ST = stRef.current;
    CHAT.push({ me: q, as: persona !== personaRef.current ? persona : null });
    const m: ChatMsg = { bot: { type: "answer", text: "", citations: [], mode: "...", data_as_of: ST.data_as_of }, streaming: true, q, persona };
    CHAT.push(m); redraw();
    const body = { question: q, persona, session_id: SID };
    try {
      const res = await C.askStream(body);
      if (!res.ok || !res.body) throw new Error("no stream");
      const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "", done: J = null;
      for (;;) {
        const { value, done: end } = await rd.read(); if (end) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const blk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = (blk.match(/^event: (.*)$/m) || [])[1], data = JSON.parse((blk.match(/^data: (.*)$/m) || [, "null"])[1]!);
          if (ev === "meta") { Object.assign(m.bot, data); redraw(); }
          else if (ev === "token") { m.bot.text += data; redraw(); }
          else if (ev === "done") done = data;
        }
      }
      if (!done) throw new Error("stream ended early");
      m.bot = done;
    } catch {
      try { m.bot = await C.ask(body); }
      catch (e2) {
        m.bot = { type: "caveat", intent: "error", error: true, mode: "error", brain: "rules", citations: [], data_as_of: ST.data_as_of,
          text: "The service didn't answer (" + ((e2 as Error).message || "network error") + "), so there is no answer and no number to show. Please ask again; if it repeats, restart the app." };
        toast("The agent didn't answer");
      }
    }
    m.streaming = false; redraw();
  }, [redraw, show, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd(true); return; }
      if (meta && e.key.toLowerCase() === "j") { e.preventDefault(); setPanel((v) => !v); return; }
      if (e.key === "Escape") { setCmd(false); setPanel(false); setHelp(false); return; }
      if (typing) return;
      if (e.key === "?") { e.preventDefault(); setHelp(true); return; }
      if (e.key.toLowerCase() === "t" && !meta) { e.preventDefault(); toggleTheme(); return; }
      if (e.key >= "1" && e.key <= "8") {
        const s = SCEN[Number(e.key) - 1];
        if (s) { e.preventDefault(); loadScenario(s.key); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [SCEN, loadScenario, toggleTheme]);

  const personaLabel = personas ? personas[persona] ?? "" : "";
  const ctx: Ctx = useMemo(() => ({
    ST, setST: setSTx, SCEN, tab, show, persona, personaLabel, personas: personas || {}, setPersona,
    chat: chatRef.current, redraw, clearChat: () => { chatRef.current.length = 0; }, ask, explain, why, loadScenario, toast,
  }), [ST, setSTx, SCEN, tab, show, persona, personaLabel, personas, setPersona, redraw, ask, explain, why, loadScenario, toast]);

  const darkOn = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen flex flex-col">
        <header className="topbar">
          <div className="brand-lock">
            <span className="brand-badge" aria-hidden="true">N</span>
            <div>
              <div className="brand-name">NimbusPay</div>
              <div className="brand-product">Adoption Insights</div>
            </div>
          </div>
          <div className="top-actions">
            <span className="pill">Synthetic</span>
            <button type="button" className="icon-btn" aria-label={darkOn ? "Switch to light theme" : "Switch to dark theme"} title="Theme (T)" onClick={toggleTheme}>
              {darkOn ? (
                <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13.5 10.2A5.5 5.5 0 0 1 5.8 2.5 5.5 5.5 0 1 0 13.5 10.2z" /></svg>
              )}
            </button>
            <button type="button" className="icon-btn" aria-label="Open command bar" title="Command (⌘K)" onClick={() => setCmd(true)}>
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2 13.5 13.5" /></svg>
            </button>
            <button type="button" className="icon-btn" aria-label="Open agent" aria-pressed={panel || tab === "agent"} title="Agent (⌘J)" onClick={() => { if (tab === "agent") return; setPanel((v) => !v); }}>
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3.5h7.5a2 2 0 0 1 2 2V12L10 9.5H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z" /></svg>
            </button>
          </div>
        </header>
        <div className="context-wrap">
          <div className="search-pill">
            <div className="roles flex items-center min-w-0 max-w-full" data-testid="role-switch" title="Role switch: scope is enforced on the server, the UI only sends the role name">
              <div className="inline-flex items-center gap-0.5 max-w-full overflow-x-auto">
                {SEGMENTS.map((r) => (
                  <button key={r} type="button" data-role={r} data-testid={`role-${r}`} onClick={() => { if (persona === r) return; setPersona(r); toast(personas?.[r] || cap(r)); }} aria-pressed={persona === r}
                    className={`role px-3 py-1 min-h-[44px] sm:min-h-0 rounded-full text-[14px] whitespace-nowrap ${persona === r ? "on" : "text-muted"}`}>{cap(r)}</button>
                ))}
                <select id="persona" data-testid="persona" aria-label="More roles" value={SEGMENTS.includes(persona) ? "" : persona} onChange={(e) => { const v = e.target.value; if (!v || v === persona) return; setPersona(v); toast(personas?.[v] || v); }}
                  className={`min-h-[44px] sm:min-h-0 !border-0 !rounded-full !py-1 !pl-3 !pr-7 text-[14px] max-w-[150px] bg-transparent ${SEGMENTS.includes(persona) ? "" : "on"}`}>
                  <option value="" disabled>More roles</option>
                  {personas && Object.entries(personas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <span className="vdiv" aria-hidden="true" />
            <div className="preset-scroll" role="group" aria-label="Scenario presets">
              {SCEN.map((s: J, n: number) => (
                <button key={s.key} type="button" data-preset={s.key} aria-pressed={ST?.dataset === s.key} title={s.label} onClick={() => loadScenario(s.key)}>
                  {n + 1} {SHORT[s.key] || s.label}
                </button>
              ))}
            </div>
            <span className="vdiv max-md:hidden" aria-hidden="true" />
            <span id="ds">{ST ? <>Dataset: {ST.dataset_label} · data as of {ST.data_as_of}</> : ""}</span>
          </div>
        </div>
        <div className="shell-body">
          <div className={`shell-side ${collapsed ? "collapsed" : ""}`}>
            <button type="button" className="icon-btn side-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => { const n = !collapsed; setCollapsed(n); localStorage.setItem("np-side", n ? "1" : "0"); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4h10M3 8h10M3 12h10" /></svg>
            </button>
            <nav id="tabs" aria-label="Screens">
              {GROUPS.map(([g, ts]) => (
                <div key={g} className="flex lg:flex-col gap-0.5">
                  <div className="nav-group px-3">{g}</div>
                  {ts.map((k) => (
                    <button key={k} data-tab={k} id={`tab-${k}`} onClick={() => show(k)} aria-current={tab === k ? "page" : undefined} className={`nav-item ${tab === k ? "on" : ""}`} title={LABEL[k]}>
                      <span className="nav-glyph" aria-hidden="true">{LABEL[k].slice(0, 1)}</span>
                      <span className="nav-label">{LABEL[k]}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </div>
          <main id="view">
            {ST && personas ? (
              <Routes>
                {TABS.map(([k]) => { const Page = SCREENS[k]; return <Route key={k} path={"/" + k} element={<div className="screen" key={loc.key + (k === "agent" ? ":" + persona : "")}><Page /></div>} />; })}
                <Route path="*" element={<Navigate to="/data" replace />} />
              </Routes>
            ) : <Skeleton rows={6} />}
          </main>
        </div>
        <footer className="muted px-6 py-5 text-[12px] text-center border-t border-line">Read-only. Every number is synthetic and labelled; thresholds and weights are placeholders to agree. Metric version <span id="ver">v1.0</span>. Built by Gowtham S.</footer>
      </div>
      <CommandBar open={cmd} tabs={TABS} scen={SCEN} onTab={show} onPreset={loadScenario} onAsk={ask} onClose={() => setCmd(false)} />
      {tab !== "agent" ? <CopilotBar open={panel} chat={chatRef.current} onAsk={(q) => ask(q, undefined, true)} onOpenThread={() => { setPanel(false); show("agent"); }} onOpen={() => setPanel(true)} onToggle={() => setPanel((v) => !v)} /> : null}
      <ShortcutSheet open={help} onClose={() => setHelp(false)} />
      <Toasts items={toasts} />
      {lin ? <LineageModal L={lin} onClose={() => setLin(null)} /> : null}
      {whyM ? <WhyModal m={whyM.m} L={whyM.L} ST={ST} onClose={() => setWhyM(null)} /> : null}
    </AppCtx.Provider>
  );
}
