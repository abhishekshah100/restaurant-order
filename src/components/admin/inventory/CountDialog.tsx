'use client';

import { useMemo, useState } from 'react';
import { ApiError, isApiError } from '@/api/client';
import { useContent, useStockCount } from '@/api/hooks';
import { useCountStep, useSaveCountLines } from '@/api/mutations';
import { Button, Chip, Dialog, Input, SearchField, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { parseQuantity, unitsLike } from '@/lib/inventory';
import type { CountLine, InventoryUnit } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CountStatusChip } from './CountsTab';
import { useInventoryExport } from './useInventoryExport';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/** What's typed for a line before it's saved: a quantity, in a unit or a pack. */
interface Draft {
  text: string;
  /** A unit code, or "pack:<id>". */
  measure: string;
}

type Show = 'todo' | 'all' | 'differences';

/** A typed quantity as the count saves it (packs become the ingredient's unit). */
function countedOf(
  draft: Draft,
  line: CountLine,
): { counted: number | null; unit?: string } | null {
  if (!draft.text.trim()) return { counted: null };
  const n = parseQuantity(draft.text);
  if (n === null || n < 0) return null;
  if (draft.measure.startsWith('pack:')) {
    const pack = line.packs.find((p) => `pack:${p.id}` === draft.measure);
    return { counted: Math.round(n * (pack?.quantity ?? 1) * 1000) / 1000 };
  }
  return {
    counted: n,
    ...(draft.measure && draft.measure !== line.unit ? { unit: draft.measure } : {}),
  };
}

/**
 * One count. While counting, staff enter what's on the shelf, item by item (saved as each field
 * is left), then send it for review: blind, without what the system expects. Managers see each
 * item's expected stock (when the count started), the difference and its value; big differences
 * need a note before it is applied. A count can be cancelled until it's applied.
 */
export function CountDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const query = useStockCount(branch.id, id);
  const count = query.data;
  const save = useSaveCountLines();
  const step = useCountStep();
  const { download, busy } = useInventoryExport();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Show>('todo');
  const [search, setSearch] = useState('');
  // Lines worked on in this sitting stay in view ("Not counted" would hide them mid-typing).
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [tried, setTried] = useState(false);

  const counting = count?.status === 'counting' && can('inventory.count', 'inventory.manage');
  const manages = can('inventory.manage');
  const open = count?.status === 'counting' || count?.status === 'submitted';
  const lines = useMemo(() => count?.lines ?? [], [count]);
  const missingNotes = lines.filter(
    (l) => l.big && !(notes[l.ingredientId] ?? l.note ?? '').trim(),
  );

  const shown = lines.filter((l) => {
    if (!l.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (show === 'todo') return l.counted === undefined || touched.has(l.ingredientId);
    if (show === 'differences') return (l.difference ?? 0) !== 0;
    return true;
  });

  const failed = (error: unknown) => {
    const names = error instanceof ApiError ? error.body?.ingredients : undefined;
    showToast(
      isApiError(error, 'count_needs_notes')
        ? t('adminInventory.counts.errors.notes', { names: names?.join(', ') ?? '' })
        : isApiError(error, 'count_closed')
          ? t('adminInventory.counts.errors.closed')
          : t('adminInventory.errors.failed'),
      { tone: 'error' },
    );
  };

  /** Saves typed lines (all, or one), and forgets their drafts once saved. */
  const flush = (only?: string, then?: () => void) => {
    if (!count) return;
    const pending = lines
      .filter((l) => (only ? l.ingredientId === only : true) && drafts[l.ingredientId])
      .map((l) => ({ line: l, value: countedOf(drafts[l.ingredientId] as Draft, l) }));
    if (pending.some((p) => p.value === null)) {
      setTried(true);
      return;
    }
    if (pending.length === 0) {
      then?.();
      return;
    }
    save.mutate(
      {
        branchId: branch.id,
        id: count.id,
        lines: pending.map((p) => ({
          ingredientId: p.line.ingredientId,
          ...(p.value as { counted: number | null; unit?: string }),
        })),
      },
      {
        onSuccess: () => {
          setDrafts((all) => {
            const next = { ...all };
            for (const p of pending) delete next[p.line.ingredientId];
            return next;
          });
          then?.();
        },
        onError: failed,
      },
    );
  };

  const go = (name: 'submit' | 'apply' | 'cancel') => {
    if (!count) return;
    const run = () =>
      step.mutate(
        {
          branchId: branch.id,
          id: count.id,
          step: name,
          ...(name === 'apply'
            ? {
                notes: Object.entries(notes)
                  .filter(([, note]) => note.trim())
                  .map(([ingredientId, note]) => ({ ingredientId, note: note.trim() })),
              }
            : {}),
        },
        {
          onSuccess: () => {
            showToast(t(`adminInventory.counts.done.${name}`), { tone: 'success' });
            if (name !== 'apply') onClose();
          },
          onError: failed,
        },
      );
    if (name === 'apply') {
      setTried(true);
      if (missingNotes.length > 0) return;
    }
    if (name === 'cancel') run();
    else flush(undefined, run);
  };

  const footer = count && (
    <div className={styles.actions}>
      {counting && !manages && (
        <Button
          block
          iconStart="check"
          loading={step.isPending || save.isPending}
          onClick={() => go('submit')}
        >
          {t('adminInventory.counts.submit')}
        </Button>
      )}
      {open && manages && !count.blind && (
        <Button
          block
          iconStart="check"
          loading={step.isPending || save.isPending}
          onClick={() => go('apply')}
        >
          {t('adminInventory.counts.apply')}
        </Button>
      )}
      {open && manages && (
        <Button
          variant="ghost"
          iconStart="x"
          disabled={step.isPending}
          onClick={() => go('cancel')}
        >
          {t('adminInventory.counts.cancel')}
        </Button>
      )}
      {count.status === 'applied' && can('inventory.manage', 'reports.view') && (
        <Button
          variant="secondary"
          iconStart="list"
          loading={busy === 'count'}
          onClick={() => void download('count', { id: count.id }, `count-${count.number}`)}
        >
          {t('adminInventory.export.csv')}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={count ? t('adminInventory.counts.number', { number: count.number }) : ''}
      description={
        count
          ? [
              t(`adminInventory.counts.scopes.${count.scope}`),
              t('adminInventory.counts.startedAt', { time: clock.dateTime(count.startedAt) }),
              count.note,
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      footer={footer}
    >
      {!count ? (
        <p className={styles.muted} aria-busy={!query.isError}>
          {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
        </p>
      ) : (
        <div className={styles.form}>
          <div className={styles.lineHead}>
            <CountStatusChip status={count.status} />
            <span className={styles.muted}>
              {t('adminInventory.counts.progress', { counted: count.counted, total: count.total })}
              {count.differenceValue !== undefined
                ? ` · ${t('adminInventory.counts.worth', { amount: text.signedWhole(count.differenceValue) })}`
                : ''}
            </span>
          </div>
          {count.status === 'submitted' && !manages && (
            <p className={styles.muted}>{t('adminInventory.counts.waiting')}</p>
          )}
          {counting && <p className={styles.muted}>{t('adminInventory.counts.countHint')}</p>}
          {!count.blind && open && (
            <p className={styles.muted}>{t('adminInventory.counts.expectedHint')}</p>
          )}
          <SearchField
            value={search}
            onChange={setSearch}
            label={t('adminInventory.stock.search')}
            placeholder={t('adminInventory.stock.searchPlaceholder')}
          />
          <div className={styles.chips} role="group" aria-label={t('adminInventory.stock.filter')}>
            {(['todo', 'all', ...(count.blind ? [] : ['differences'])] as Show[]).map((s) => (
              <Chip key={s} pressed={show === s} onClick={() => setShow(s)}>
                {t(`adminInventory.counts.show.${s}`)}
              </Chip>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className={styles.muted}>{t(`adminInventory.counts.none.${show}`)}</p>
          ) : (
            <ul className={styles.list}>
              {shown.map((line) => (
                <li key={line.ingredientId}>
                  <CountLineRow
                    line={line}
                    editable={counting}
                    draft={drafts[line.ingredientId]}
                    invalid={
                      tried &&
                      drafts[line.ingredientId] !== undefined &&
                      countedOf(drafts[line.ingredientId] as Draft, line) === null
                    }
                    onDraft={(draft) => {
                      setTouched((all) => new Set(all).add(line.ingredientId));
                      setDrafts((all) => ({ ...all, [line.ingredientId]: draft }));
                    }}
                    onLeave={() => flush(line.ingredientId)}
                    note={notes[line.ingredientId] ?? line.note ?? ''}
                    noteEditable={open && manages && !count.blind}
                    noteMissing={tried && missingNotes.includes(line)}
                    onNote={(note) => setNotes((all) => ({ ...all, [line.ingredientId]: note }))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}

function CountLineRow({
  line,
  editable,
  draft,
  invalid,
  onDraft,
  onLeave,
  note,
  noteEditable,
  noteMissing,
  onNote,
}: {
  line: CountLine;
  editable: boolean;
  draft: Draft | undefined;
  invalid: boolean;
  onDraft: (draft: Draft) => void;
  onLeave: () => void;
  note: string;
  noteEditable: boolean;
  noteMissing: boolean;
  onNote: (note: string) => void;
}) {
  const t = useContent('common');
  const text = useInventoryText();
  const id = `count-${line.ingredientId}`;
  const measure = draft?.measure || line.unit;
  const facts = [
    line.expected !== undefined
      ? t('adminInventory.counts.expected', { quantity: text.quantity(line.expected, line.unit) })
      : null,
    !editable && line.counted !== undefined
      ? t('adminInventory.counts.counted', { quantity: text.quantity(line.counted, line.unit) })
      : null,
  ].filter(Boolean);

  return (
    <div className={styles.countLine}>
      <div className={styles.rowMain}>
        <span className={styles.rowName}>{line.name}</span>
        {facts.length > 0 && <span className={styles.muted}>{facts.join(' · ')}</span>}
      </div>
      {line.difference !== undefined && line.counted !== undefined && (
        <span className={styles.rowSide}>
          <span
            className={cx(
              styles.quantity,
              line.difference < 0 ? styles.negative : line.difference > 0 && styles.positive,
            )}
          >
            {text.change(line.difference, line.unit)}
          </span>
          {line.value !== undefined && (
            <span className={styles.muted}>{text.signedValue(line.value)}</span>
          )}
        </span>
      )}
      {editable && (
        <div className={styles.fieldRow}>
          <Input
            id={`${id}-counted`}
            label={t('adminInventory.entry.counted')}
            inputMode="decimal"
            autoComplete="off"
            placeholder={line.counted !== undefined ? String(line.counted) : undefined}
            value={draft?.text ?? (line.counted !== undefined ? String(line.counted) : '')}
            error={invalid ? t('adminInventory.entry.quantityError') : undefined}
            onChange={(event) => onDraft({ text: event.target.value, measure })}
            onBlur={onLeave}
          />
          {(unitsLike(line.unit).length > 1 || line.packs.length > 0) && (
            <Select
              id={`${id}-measure`}
              label={t('adminInventory.entry.in')}
              value={measure}
              onChange={(event) =>
                onDraft({
                  text: draft?.text ?? (line.counted !== undefined ? String(line.counted) : ''),
                  measure: event.target.value,
                })
              }
            >
              {unitsLike(line.unit).map((u: InventoryUnit) => (
                <option key={u} value={u}>
                  {text.unit(u)}
                </option>
              ))}
              {line.packs.map((p) => (
                <option key={p.id} value={`pack:${p.id}`}>
                  {t('adminInventory.packOption', {
                    name: p.name,
                    quantity: text.quantity(p.quantity, line.unit),
                  })}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      {line.big && (noteEditable || line.note) && (
        <Input
          id={`${id}-note`}
          label={t('adminInventory.counts.why')}
          maxLength={200}
          value={note}
          disabled={!noteEditable}
          error={noteMissing ? t('adminInventory.counts.whyError') : undefined}
          onChange={(event) => onNote(event.target.value)}
        />
      )}
    </div>
  );
}
