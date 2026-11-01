/**
 * KycDocumentPicker.tsx
 *
 * Spacious, grouped document selector used inside the "Request KYC & payment"
 * modal. Value is the list of exact document labels (string[]), unchanged from
 * the previous chip list, so the store, email and upload page need no changes.
 */
import { useMemo, useState } from 'react';
import s from './SuperAdmin.module.css';
import { KYC_DOC_GROUPS, KYC_PRESETS } from './kycDocuments';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export default function KycDocumentPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState('');
  // Common groups start open, industry-specific groups start collapsed.
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(KYC_DOC_GROUPS.map((g) => [g.id, g.common])),
  );

  const q = search.trim().toLowerCase();
  const selected = useMemo(() => new Set(value), [value]);

  const groups = useMemo(
    () =>
      KYC_DOC_GROUPS.map((g) => ({
        ...g,
        docs: q
          ? g.docs.filter((d) => `${d.label} ${d.about} ${g.title}`.toLowerCase().includes(q))
          : g.docs,
      })).filter((g) => g.docs.length > 0),
    [q],
  );

  const toggle = (label: string) =>
    onChange(selected.has(label) ? value.filter((x) => x !== label) : [...value, label]);

  const setMany = (labels: string[], on: boolean) => {
    if (on) onChange([...value, ...labels.filter((l) => !selected.has(l))]);
    else onChange(value.filter((l) => !labels.includes(l)));
  };

  return (
    <div className={s.saPicker}>
      <div className={s.saPickerTop}>
        <input
          className={s.saInput}
          placeholder="Search documents (e.g. GST, PF, licence)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search documents"
        />
        <div className={s.saPresetRow}>
          <span className={s.saMicro}>Quick select</span>
          {KYC_PRESETS.map((p) => (
            <button key={p.id} type="button" className={s.saQuick} onClick={() => setMany(p.labels, true)}>
              + {p.title}
            </button>
          ))}
          {value.length > 0 && (
            <button type="button" className={s.saPickerClear} onClick={() => onChange([])}>Clear all</button>
          )}
        </div>
      </div>

      <div className={s.saPickerList}>
        {groups.length === 0 && <p className={s.saPickerEmpty}>No documents match “{search}”.</p>}
        {groups.map((g) => {
          const labels = g.docs.map((d) => d.label);
          const count = labels.filter((l) => selected.has(l)).length;
          const allOn = count === labels.length;
          const isOpen = q ? true : open[g.id];
          return (
            <section key={g.id} className={s.saGroup}>
              <div className={s.saGroupHead}>
                <button
                  type="button" className={s.saGroupToggle} aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
                >
                  <span className={isOpen ? `${s.saGroupCaret} ${s.saGroupCaretOpen}` : s.saGroupCaret}>›</span>
                  <span className={s.saGroupTitle}>{g.title}</span>
                  <span className={s.saGroupTag}>{g.common ? 'Common' : 'Industry'}</span>
                </button>
                <span className={count > 0 ? `${s.saGroupCount} ${s.saGroupCountOn}` : s.saGroupCount}>
                  {count} / {labels.length}
                </span>
                <button type="button" className={s.saGroupAction} onClick={() => setMany(labels, !allOn)}>
                  {allOn ? 'Clear' : 'Select all'}
                </button>
              </div>

              {isOpen && (
                <ul className={s.saDocList}>
                  {g.docs.map((d) => {
                    const on = selected.has(d.label);
                    return (
                      <li key={d.label}>
                        <label className={on ? `${s.saDocRow} ${s.saDocRowOn}` : s.saDocRow}>
                          <input type="checkbox" checked={on} onChange={() => toggle(d.label)} />
                          <span className={s.saDocText}>
                            <span className={s.saDocName}>{d.label}</span>
                            <span className={s.saDocAbout} title={d.about}>{d.about}</span>
                          </span>
                          <span className={s.saDocApplies}>{d.applies}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
