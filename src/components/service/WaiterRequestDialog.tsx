'use client';

import { useState, type FormEvent } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, IconButton, Input } from '@/components/ui';
import { cx } from '@/lib/cx';
import { SERVICE_NOTE_MAX } from '@/lib/service';
import type { WaiterReason } from '@/types/service';
import { ReasonTiles } from './ReasonTiles';
import styles from './WaiterRequestDialog.module.css';

interface WaiterRequestDialogProps {
  table: number;
  onSend: (reason: WaiterReason, note: string) => void;
  onClose: () => void;
}

const TITLE_ID = 'waiter-request-title';
const FORM_ID = 'waiter-request-form';

/** Request waiter: bottom sheet below 1024px, modal from 1024px (18 · w18). */
export function WaiterRequestDialog({ table, onSend, onClose }: WaiterRequestDialogProps) {
  const t = useContent('service');
  const [reason, setReason] = useState<WaiterReason>('waiter');
  const [note, setNote] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend(reason, note);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('waiterDialog.title')}
      labelledBy={TITLE_ID}
      presentation="adaptive"
      header={
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2 id={TITLE_ID} className={styles.title}>
              {t('waiterDialog.title')}
            </h2>
            <p className={cx('c2', styles.lede)}>
              {t.rich(
                'waiterDialog.lede',
                { b: (c) => <b className={styles.strong}>{c}</b> },
                { table },
              )}
            </p>
          </div>
          <IconButton
            icon="x"
            label={t('waiterDialog.close')}
            variant="soft"
            iconSize="sm"
            onClick={onClose}
          />
        </div>
      }
      footer={
        <>
          <Button
            variant="secondary"
            className={cx('hide-mobile', styles.cancel)}
            onClick={onClose}
          >
            {t('shared.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} block className={styles.send}>
            {t('waiterDialog.send')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={submit}>
        <ReasonTiles value={reason} onChange={setReason} idPrefix="waiter-reason" />
        <Input
          id="waiter-note"
          label={t('waiterDialog.noteLabel')}
          optional
          placeholder={t('waiterDialog.notePlaceholder')}
          maxLength={SERVICE_NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
        />
      </form>
    </Dialog>
  );
}
