'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSetTableNote } from '@/api/mutations';
import { Button, Chip, Dialog, Icon, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { NOTE_TAGS, type AdminTableDetail, type NoteTag } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { NoteTags } from './NoteTags';
import styles from './TableNoteCard.module.css';

const MAX_NOTE = 200;

/**
 * The guests' note for this visit on the table's page: tags (VIP, allergy, birthday, regular,
 * high chair) and a line, who wrote it and when; Add / Edit / Clear for floor staff. It's
 * cleared when the table is freed; an allergy also shows on the kitchen's tickets.
 */
export function TableNoteCard({ detail }: { detail: AdminTableDetail }) {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetTableNote();
  const [editing, setEditing] = useState(false);
  const { note } = detail;
  const canWrite =
    !detail.disabled &&
    (can('orders.take') || can('service.respond') || can('reservations.manage'));
  if (!note && !canWrite) return null;

  const send = (text: string, tags: NoteTag[], onDone?: () => void) =>
    save.mutate(
      { branchId: branch.id, table: detail.table, text, tags },
      {
        onSuccess: () => {
          showToast(
            t(text || tags.length ? 'adminTables.notes.saved' : 'adminTables.notes.cleared', {
              table: detail.table,
            }),
            { tone: 'success' },
          );
          onDone?.();
        },
        onError: () => showToast(t('adminTables.notes.failed'), { tone: 'error' }),
      },
    );

  return (
    <section className={styles.card} aria-labelledby="table-note-title">
      <div className={styles.head}>
        <h2 id="table-note-title" className={styles.title}>
          <Icon name="flag" size="sm" />
          {t('adminTables.notes.title')}
        </h2>
        {canWrite && (
          <div className={styles.actions}>
            {note && (
              <Button
                size="sm"
                variant="ghost"
                loading={save.isPending && !editing}
                onClick={() => send('', [])}
              >
                {t('adminTables.notes.clear')}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              iconStart={note ? 'pencil' : 'plus'}
              onClick={() => setEditing(true)}
            >
              {note ? t('adminTables.notes.edit') : t('adminTables.notes.add')}
            </Button>
          </div>
        )}
      </div>
      {note ? (
        <div className={styles.body}>
          <NoteTags tags={note.tags} />
          {note.text && <p className={styles.text}>{note.text}</p>}
          {note.by && note.at && (
            <p className={styles.by}>
              {t('adminTables.notes.by', { name: note.by, time: clock.time(note.at) })}
            </p>
          )}
        </div>
      ) : (
        <p className={styles.empty}>{t('adminTables.notes.empty')}</p>
      )}
      {editing && (
        <NoteDialog
          table={detail.table}
          initial={note ? { text: note.text ?? '', tags: note.tags } : { text: '', tags: [] }}
          saving={save.isPending}
          onClose={() => setEditing(false)}
          onSave={(text, tags) => send(text, tags, () => setEditing(false))}
        />
      )}
    </section>
  );
}

function NoteDialog({
  table,
  initial,
  saving,
  onClose,
  onSave,
}: {
  table: number;
  initial: { text: string; tags: NoteTag[] };
  saving: boolean;
  onClose: () => void;
  onSave: (text: string, tags: NoteTag[]) => void;
}) {
  const t = useContent('common');
  const [text, setText] = useState(initial.text);
  const [tags, setTags] = useState<NoteTag[]>(initial.tags);
  const toggle = (tag: NoteTag) =>
    setTags((now) => (now.includes(tag) ? now.filter((x) => x !== tag) : [...now, tag]));

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminTables.notes.dialogTitle', { table })}
      footer={
        <Button block loading={saving} onClick={() => onSave(text.trim(), tags)}>
          {t('adminTables.notes.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <div role="group" aria-label={t('adminTables.notes.tagsLabel')} className={styles.chips}>
          {NOTE_TAGS.map((tag) => (
            <Chip key={tag} pressed={tags.includes(tag)} onClick={() => toggle(tag)}>
              {t(`adminTables.notes.tags.${tag}`)}
            </Chip>
          ))}
        </div>
        <Textarea
          id="table-note"
          label={t('adminTables.notes.textLabel')}
          optional
          rows={2}
          maxLength={MAX_NOTE}
          placeholder={t('adminTables.notes.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className={styles.hint}>
          <Icon name="info" size="xs" />
          {t('adminTables.notes.kitchenHint')}
        </p>
      </div>
    </Dialog>
  );
}
