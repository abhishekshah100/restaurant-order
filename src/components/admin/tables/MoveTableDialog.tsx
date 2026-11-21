'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useFloorPlan } from '@/api/hooks';
import { useMoveTable } from '@/api/mutations';
import { MOVE_REASONS, type MoveReason } from '@/api/endpoints/tables';
import { Button, Chip, Dialog, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { tablePath } from '@/lib/adminNav';
import type { AdminTableDetail } from '@/types/admin';
import { RadioTiles } from '../payments/PaymentFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './MoveTableDialog.module.css';

/**
 * "Move Table 5": the guests change tables. Every free table in service, by area, as tiles
 * (with its seats), and why they're moving (one tap, a note if needed: the activity log says
 * it); the guests' orders, calls, note and phones go with them (POST …/tables/:table/move) and
 * the page follows them to the new table. A table taken
 * meanwhile is refused (409 table_occupied): pick another.
 */
export function MoveTableDialog({
  detail,
  onClose,
}: {
  detail: AdminTableDetail;
  onClose: () => void;
}) {
  const t = useContent('common');
  const router = useRouter();
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const plan = useFloorPlan(branch.id);
  const move = useMoveTable();
  const [to, setTo] = useState('');
  const [reason, setReason] = useState<MoveReason | null>(null);
  const [note, setNote] = useState('');

  const floors = (plan.data?.floors ?? [])
    .map((floor) => ({
      ...floor,
      tables: floor.tables.filter(
        (table) => table.table !== detail.table && table.status === 'available' && !table.disabled,
      ),
    }))
    .filter((floor) => floor.tables.length > 0);
  const target = Number(to);

  const submit = () => {
    if (!target || !reason) return;
    move.mutate(
      {
        branchId: branch.id,
        table: detail.table,
        to: target,
        reason,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          showToast(t('adminTables.detail.move.done', { table: target }), { tone: 'success' });
          onClose();
          router.replace(tablePath(target));
        },
        onError: (error) => {
          showToast(
            isApiError(error, 'table_occupied')
              ? t('adminTables.detail.move.occupied', { table: target })
              : isApiError(error, 'table_disabled')
                ? t('adminTables.detail.move.disabled', { table: target })
                : isApiError(error, 'nothing_to_move')
                  ? t('adminTables.detail.move.nothing')
                  : t('adminTables.detail.move.failed'),
            { tone: 'error' },
          );
          if (isApiError(error, 'table_occupied')) setTo('');
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminTables.detail.move.title', { table: detail.table })}
      description={t('adminTables.detail.move.body', { table: detail.table })}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminTables.detail.move.keep')}
          </Button>
          <Button
            iconStart="swap"
            disabled={!target || !reason}
            loading={move.isPending}
            onClick={submit}
          >
            {!target
              ? t('adminTables.detail.move.pick')
              : !reason
                ? t('adminTables.detail.move.pickWhy')
                : t('adminTables.detail.move.confirm', { table: target })}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {plan.isPending ? null : floors.length === 0 ? (
          <p className={styles.none}>{t('adminTables.detail.move.none')}</p>
        ) : (
          floors.map((floor) => (
            <RadioTiles
              key={floor.id}
              name="move-to"
              legend={floor.name}
              columns={4}
              value={to}
              onChange={setTo}
              choices={floor.tables.map((table) => ({
                id: String(table.table),
                label: t('adminTables.detail.move.tile', { table: table.table }),
                sub: t.plural('adminTables.detail.move.seats', table.seats),
              }))}
            />
          ))
        )}
        {floors.length > 0 && (
          <fieldset className={styles.why}>
            <legend className={styles.whyTitle}>{t('adminTables.detail.move.why')}</legend>
            <div className={styles.reasons}>
              {MOVE_REASONS.map((r) => (
                <Chip key={r} pressed={reason === r} onClick={() => setReason(r)}>
                  {t(`adminTables.detail.move.reasons.${r}`)}
                </Chip>
              ))}
            </div>
            <Input
              id="move-note"
              label={t('adminTables.detail.move.note')}
              optional
              maxLength={120}
              placeholder={t('adminTables.detail.move.notePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}
