import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Form } from '../lib/types';
import type { Check } from '../lib/types';

type Status = Check | 'block' | 'todo';
import { fmtInput, parseNum } from '../lib/format';
import { haptic, pushBack } from '../lib/native';
import { IconAlert, IconCheck, IconInfo, IconStop, IconX } from './Icons';

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => {
        haptic.tap();
        onChange(!on);
      }}
    />
  );
}

export function ToggleRow({ title, desc, on, onChange }: { title: string; desc?: ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div className="grow">
        <div className="t">{title}</div>
        {desc && <div className="d">{desc}</div>}
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => {
            if (o.value !== value) haptic.tap();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Champ numérique tolérant (virgule française), qui garde la saisie en cours. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  min,
  max,
  step = 'any',
  invalid,
}: {
  label?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState(fmtInput(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      if (parseNum(text) !== value) setText(fmtInput(value));
    }
  }, [value, text]);
  const n = parseNum(text);
  const out = n !== null && ((min !== undefined && n < min) || (max !== undefined && n > max));
  const input = (
    <input
      className={`input ${invalid || out ? 'invalid' : ''}`}
      inputMode="decimal"
      enterKeyHint="done"
      value={text}
      placeholder={placeholder}
      data-step={step}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,-]/g, '');
        setText(t);
        const v = parseNum(t);
        last.current = v;
        onChange(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {suffix ? (
        <div className="input-suffix">
          {input}
          <span>{suffix}</span>
        </div>
      ) : (
        input
      )}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <input className="input" value={value} placeholder={placeholder} enterKeyHint="next" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }) {
  const set = (v: number) => {
    const nv = Math.min(max, Math.max(min, Math.round(v * 100) / 100));
    if (nv !== value) {
      haptic.tap();
      onChange(nv);
    }
  };
  return (
    <div className="stepper">
      <button type="button" onClick={() => set(value - step)} aria-label="Moins">
        −
      </button>
      <div className="val">{format ? format(value) : value}</div>
      <button type="button" onClick={() => set(value + step)} aria-label="Plus">
        +
      </button>
    </div>
  );
}

export function FormPills({ form, size }: { form: Form[]; size?: number }) {
  const cells = [...form.slice(0, 5)];
  while (cells.length < 5) cells.push('' as Form);
  return (
    <span className="form-pills" aria-label={`Forme récente : ${form.join(' ') || 'inconnue'}`}>
      {cells.map((f, i) => (
        <span key={i} className={`fp ${f || 'empty'}`} style={size ? { width: size, height: size } : undefined}>
          {f}
        </span>
      ))}
    </span>
  );
}

/** Saisie de la forme récente : chaque pastille tourne V → N → D → vide. */
export function FormEditor({ form, onChange }: { form: Form[]; onChange: (f: Form[]) => void }) {
  const cells = [...form.slice(0, 5)];
  while (cells.length < 5) cells.push('' as Form);
  const cycle: Record<string, Form | ''> = { '': 'V', V: 'N', N: 'D', D: '' };
  return (
    <div className="row" style={{ gap: 6 }}>
      {cells.map((f, i) => (
        <button
          key={i}
          type="button"
          className={`fp ${f || 'empty'}`}
          style={{ width: 34, height: 34, borderRadius: 10, fontSize: 15 }}
          onClick={() => {
            haptic.tap();
            const next = [...cells];
            next[i] = cycle[f] as Form;
            onChange(next.filter((x) => x) as Form[]);
          }}
        >
          {f || '·'}
        </button>
      ))}
    </div>
  );
}

export function StatusIcon({ status, size = 28 }: { status: Status; size?: number }) {
  return (
    <span className={`status-ico ${status}`} style={{ width: size, height: size }}>
      {status === 'ok' && <IconCheck size={16} />}
      {status === 'warn' && <IconAlert size={16} />}
      {status === 'fail' && <IconX size={16} />}
      {status === 'block' && <IconStop size={16} />}
      {status === 'todo' && <span style={{ fontWeight: 800 }}>…</span>}
      {status === 'unknown' && <span style={{ fontWeight: 800 }}>?</span>}
    </span>
  );
}

export function Banner({ tone = 'blue', children, icon }: { tone?: 'blue' | 'orange' | 'red' | 'green'; children: ReactNode; icon?: ReactNode }) {
  const color = { blue: 'var(--blue)', orange: 'var(--orange)', red: 'var(--red)', green: 'var(--green)' }[tone];
  return (
    <div className={`banner ${tone}`}>
      <span style={{ color }}>{icon ?? (tone === 'red' ? <IconStop /> : tone === 'orange' ? <IconAlert /> : tone === 'green' ? <IconCheck /> : <IconInfo />)}</span>
      <div className="grow">{children}</div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, top }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; top?: boolean }) {
  useEffect(() => {
    if (!open) return;
    return pushBack(() => {
      onClose();
      return true;
    });
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`sheet-backdrop ${top ? 'top' : ''}`} onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Crest({ name, logo }: { name: string; logo?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return <span className="crest">{logo && !broken ? <img src={logo} alt="" loading="lazy" onError={() => setBroken(true)} /> : initials || '?'}</span>;
}

/** Nombre qui s'anime jusqu'à sa valeur. */
export function CountUp({ value, duration = 900, format = (v: number) => String(Math.round(v)) }: { value: number; duration?: number; format?: (v: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(value * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(v)}</>;
}

// Toasts ---------------------------------------------------------------
type ToastMsg = { id: number; text: string; tone: 'ok' | 'warn' | 'err' };
let toastListener: ((t: ToastMsg) => void) | null = null;
let toastId = 0;

export function toast(text: string, tone: ToastMsg['tone'] = 'ok') {
  toastListener?.({ id: ++toastId, text, tone });
}

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    toastListener = (t) => setMsg(t);
    return () => {
      toastListener = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="toast" key={msg.id} role="status">
      <span style={{ color: msg.tone === 'ok' ? 'var(--green)' : msg.tone === 'warn' ? 'var(--orange)' : 'var(--red)' }}>
        {msg.tone === 'ok' ? <IconCheck /> : <IconAlert />}
      </span>
      {msg.text}
    </div>
  );
}

// Boîte de confirmation (thème de l'app) -----------------------------------
interface AskOpts {
  title: string;
  message?: ReactNode;
  confirm?: string;
  cancel?: string;
  tone?: 'primary' | 'danger';
}
let askListener: ((o: AskOpts, resolve: (v: boolean) => void) => void) | null = null;

export function ask(o: AskOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!askListener) resolve(window.confirm(o.title));
    else askListener(o, resolve);
  });
}

export function AskHost() {
  const [cur, setCur] = useState<{ o: AskOpts; resolve: (v: boolean) => void } | null>(null);
  useEffect(() => {
    askListener = (o, resolve) => setCur({ o, resolve });
    return () => {
      askListener = null;
    };
  }, []);
  const close = (v: boolean) => {
    cur?.resolve(v);
    setCur(null);
  };
  return (
    <Sheet open={!!cur} onClose={() => close(false)} title={cur?.o.title} top>
      {cur?.o.message && <div className="muted" style={{ margin: '4px 0 16px' }}>{cur.o.message}</div>}
      <div className="stack" style={{ gap: 10 }}>
        <button className={`btn block ${cur?.o.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => { haptic.medium(); close(true); }}>
          {cur?.o.confirm ?? 'Confirmer'}
        </button>
        <button className="btn block ghost" onClick={() => close(false)}>
          {cur?.o.cancel ?? 'Annuler'}
        </button>
      </div>
    </Sheet>
  );
}

// Guide pas à pas -------------------------------------------------------------

/** Encadré « Ce que tu fais maintenant » : étapes numérotées, très simples. */
export function Guide({ title = 'Ce que tu fais maintenant', steps, tone = 'green' }: { title?: string; steps: ReactNode[]; tone?: 'green' | 'orange' | 'red' | 'blue' }) {
  return (
    <div className={`guide ${tone}`}>
      <div className="guide-title">👉 {title}</div>
      <ol className="guide-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="guide-num">{i + 1}</span>
            <div className="grow">{s}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Petite question dépliable : « C'est quoi … ? ». */
export function Explain({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="explain">
      <summary>
        <span className="explain-q">?</span>
        {q}
      </summary>
      <div className="explain-a">{children}</div>
    </details>
  );
}

/** Gros bouton d'action avec sous-titre. */
export function BigButton({ icon, title, sub, onClick, tone = 'primary', disabled }: { icon?: ReactNode; title: string; sub?: string; onClick: () => void; tone?: 'primary' | 'plain' | 'danger'; disabled?: boolean }) {
  return (
    <button className={`big-btn ${tone}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="big-btn-ico">{icon}</span>}
      <span className="grow" style={{ textAlign: 'left' }}>
        <span className="big-btn-title">{title}</span>
        {sub && <span className="big-btn-sub">{sub}</span>}
      </span>
    </button>
  );
}
