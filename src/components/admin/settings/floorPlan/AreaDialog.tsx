'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, Input } from '@/components/ui';
import { MAX_AREA_NAME, areaNameError } from '@/lib/floorLayout';
import type { FloorPlanLayout } from '@/types/admin';
import styles from './FloorPlanDialogs.module.css';

export type AreaDialogTarget = { mode: 'add' } | { mode: 'rename'; id: string; name: string };

/** Add an area, or rename one: a name of its own (checked as it's typed, once tried). */
export function AreaDialog({
  target,
  layout,
  onClose,
  onDone,
}: {
  target: AreaDialogTarget | null;
  layout: FloorPlanLayout;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  if (!target) return null;
  return (
    <AreaForm
      key={target.mode === 'add' ? 'add' : target.id}
      target={target}
      layout={layout}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function AreaForm({
  target,
  layout,
  onClose,
  onDone,
}: {
  target: AreaDialogTarget;
  layout: FloorPlanLayout;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const t = useContent('common');
  const [name, setName] = useState(target.mode === 'rename' ? target.name : '');
  const [tried, setTried] = useState(false);
  const error = areaNameError(layout, name, target.mode === 'rename' ? target.id : undefined);
  const adding = target.mode === 'add';

  const submit = () => {
    setTried(true);
    if (!error) onDone(name.trim());
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t(
        adding
          ? 'adminSettings.floorPlan.areaDialog.addTitle'
          : 'adminSettings.floorPlan.areaDialog.renameTitle',
      )}
      description={t('adminSettings.floorPlan.areaDialog.description')}
      className={styles.dialog}
      footer={
        <Button block iconStart={adding ? 'plus' : 'check'} onClick={submit}>
          {t(
            adding
              ? 'adminSettings.floorPlan.areaDialog.add'
              : 'adminSettings.floorPlan.areaDialog.rename',
          )}
        </Button>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          id="area-name"
          label={t('adminSettings.floorPlan.areaDialog.name')}
          placeholder={t('adminSettings.floorPlan.areaDialog.placeholder')}
          value={name}
          maxLength={MAX_AREA_NAME + 10}
          autoComplete="off"
          data-autofocus
          error={
            tried && error ? t(`adminSettings.floorPlan.areaDialog.errors.${error}`) : undefined
          }
          onChange={(event) => setName(event.target.value)}
        />
      </form>
    </Dialog>
  );
}

/** Asks before removing an area, saying which tables go with it. */
export function RemoveAreaDialog({
  area,
  onClose,
  onConfirm,
}: {
  area: FloorPlanLayout['floors'][number] | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useContent('common');
  if (!area) return null;
  const count = area.tables.length;
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.floorPlan.removeArea.title', { area: area.name })}
      className={styles.dialog}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminSettings.floorPlan.removeArea.cancel')}
          </Button>
          <Button block iconStart="trash" className={styles.danger} onClick={onConfirm}>
            {t('adminSettings.floorPlan.removeArea.confirm')}
          </Button>
        </div>
      }
    >
      <p className={styles.text}>
        {t('adminSettings.floorPlan.removeArea.body')}
        {count > 0 &&
          ` ${t.plural('adminSettings.floorPlan.removeArea.tables', count, {
            list: area.tables.map((tb) => tb.number).join(', '),
          })}`}
      </p>
    </Dialog>
  );
}
