import type { J } from "../lib/api";
import { useApp } from "../lib/store";
import { fmt, keepTogether, oc } from "../lib/format";
import { Bars, CountUp, Header, Kpi, Subnav } from "../components/ui";

const EV: Record<string, string> = { e1: "Utilisation", e2: "Verified impact", e3: "Unit economics", e4: "Reliability and governance" };

export default function Exec() {
  const { ST } = useApp(); const M = ST.metrics, s = ST.score, rn = ST.renewal, f = ST.funnel;
  const mau = Number(ST.users.vendor_mau_proxy) || 0;
  const habitual = Number(f.LF6) || 0;
  const paid = Number(f.LF1) || 0;
  const sc = s.value !== null
    ? <span className={s.state === "red" ? "red" : ""} data-testid="score">{s.value}/100{s.state === "red" ? " RED" : ""}</span>
    : <span data-testid="score">Withheld</span>;
  const ids = Object.keys(M).filter((id) => /^M\d\d$/.test(id)).sort();
  return (
    <>
      <Header title="Executive view">{ST.label} Dataset: {ST.dataset_label}.</Header>
      <Subnav items={[{ id: "exec-hero", label: "Decision" }, { id: "exec-funnel", label: "Licence funnel" }, { id: "exec-score", label: "M19" }, { id: "exec-metrics", label: "Headlines" }, { id: "exec-catalogue", label: "Metric catalogue" }]} />
      <section id="exec-hero" className="hero-grid">
        <div className="tile">
          <div className="eyebrow">Habit, not a vendor MAU</div>
          <p className="mt-3 text-[15px] text-muted">Vendor MAU <span className="hero-num text-ink"><CountUp n={mau} /></span> vs <span className="hero-num text-ink"><CountUp n={habitual} /></span> habitual users</p>
          <p className="text-[17px] mt-1">of <b className="tabular-nums">{paid}</b> paid seats</p>
          <div className="mt-5">
            <Bars
              legend={[["Vendor MAU", "accent"], ["Habitual", "navy"], ["Paid seats", "slate"]]}
              max={Math.max(paid, mau, habitual, 1)}
              rows={[["Vendor MAU", mau, mau, "accent"], ["Habitual users (LF6)", habitual, habitual, "navy"], ["Paid seats (LF1)", paid, paid, "slate"]]}
            />
          </div>
        </div>
        <div className="outcard">
          <div className="eyebrow">Renewal recommendation</div>
          <div className={`out mt-1 ${oc(rn.outcome)}`} data-testid="outcome">{rn.outcome}</div>
          <div className="mt-1">{keepTogether(rn.why)}</div>
          <div className="grid-auto mt-4">
            {Object.entries(EV).map(([k, l]) => {
              const v = rn.evidence[k] === "met" && k === "e2";
              return <div key={k} className="text-[13px]"><span className={`tag ${v ? "met" : ""}`}>{v ? "verified" : rn.evidence[k]}</span>{l}</div>;
            })}
          </div>
        </div>
      </section>
      <h2 id="exec-funnel">Licence funnel LF1–LF6</h2>
      <div className="tile" data-testid="funnel">
        <Bars legend={[["Seats", "accent"]]} rows={[["LF1 Purchased", f.LF1], ["LF2 Assigned", f.LF2], ["LF3 Provisioned", f.LF3], ["LF4 Active", f.LF4], ["LF5 Engaged", f.LF5], ["LF6 Habitual", f.LF6]]} max={f.LF1} />
        <p className="muted mt-3 text-[13px]">Vendor-style MAU proxy {ST.users.vendor_mau_proxy} vs truly active {f.LF4}. {ST.paid_unused} paid seats have no qualifying use.</p>
      </div>
      <h2 id="exec-score">AI value score (M19), shown beside its pillars, never a team target</h2>
      <div className="grid-auto">
        <div className="kpi">
          <div className="id">M19 {M.M19.version}</div><div className="v">{sc}</div><div className="l">{s.reason}</div>
          {s.interim_index !== null ? <div className="mt-2 text-[13px]">Interim adoption and health index: <b>{s.interim_index}/100</b> (33/25/25/17)</div> : null}
        </div>
        <div className="tile" style={{ gridColumn: "span 2" }}>
          <Bars legend={[["Pillar", "navy"]]} rows={Object.entries(s.pillars).map(([k, v]: [string, J]) => [`${k} (w ${s.weights[k]})`, v ?? 0, v ?? "no data", "navy"])} max={100} />
        </div>
      </div>
      <h2 id="exec-metrics">Headline governed metrics</h2>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {["M01", "M02", "M04", "M07", "M10", "M17", "M18"].map((id) => <Kpi key={id} id={id} label={M[id].label + (M[id].approximate ? " (approx.)" : "")} val={fmt(M[id].value, M[id].unit)} sub={M[id].note} />)}
      </div>
      <h2 id="exec-catalogue">Metric catalogue</h2>
      <div className="tile !p-0 overflow-auto">
        <table>
          <tbody>
            <tr><th>ID</th><th>Version</th><th>Metric</th><th className="!text-right">Value</th><th>Note</th></tr>
            {ids.map((id) => (
              <tr key={id} data-metric={id} title="Click: explain this number" className="cursor-pointer">
                <td className="whitespace-nowrap"><b className="text-accent">{id}</b></td>
                <td className="whitespace-nowrap">{M[id].version}</td>
                <td>{M[id].label}</td>
                <td className="!text-right tabular-nums">{fmt(M[id].value, M[id].unit)}</td>
                <td className="muted">{M[id].note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
