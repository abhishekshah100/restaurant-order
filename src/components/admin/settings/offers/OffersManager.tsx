'use client';

import { useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { isApiError } from '@/api/client';
import { useAdminOffers, useContent } from '@/api/hooks';
import { useRemoveOffer, useSaveOffer } from '@/api/mutations';
import { Button, Dialog, Icon, IconButton, Tag, type TagVariant } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import {
  daysSummary,
  offerRequest,
  offerStanding,
  toggledRequest,
  type OfferDraft,
  type OfferStanding,
} from '@/lib/adminOffers';
import type { AutoOffer } from '@/types/promotion';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../shared/SettingsEditor';
import editor from '../shared/SettingsEditor.module.css';
import { OfferDialog } from './OfferDialog';
import styles from './OffersManager.module.css';

const STANDING_TAG: Record<OfferStanding, TagVariant> = {
  live: 'ok',
  scheduled: 'plain',
  upcoming: 'plain',
  paused: 'warn',
  ended: 'err',
};

/** Which offer the dialog is open on: a new one, or one to change. */
type Editing = { offer?: AutoOffer } | null;

/**
 * Settings › Offers: the branch's automatic offers (happy hour and the like) — each with when it
 * runs, what it takes off and on what, and where it stands now — to add, change, pause or
 * switch on, and remove. Changes reach guests' prices at once.
 */
export function OffersManager() {
  const t = useContent('common');
  const { branch, region, money, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useAdminOffers(branch.id);
  const { menu } = useBranchMenu(region);
  const save = useSaveOffer();
  const remove = useRemoveOffer();
  const now = useNow();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<AutoOffer | null>(null);

  if (query.isError) {
    return (
      <div className={editor.page}>
        <SettingsNote tone="warn">{t('adminSettings.offers.failed')}</SettingsNote>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminSettings.offers.retry')}
        </Button>
      </div>
    );
  }
  const offers = query.data;
  if (!offers) return <SettingsSkeleton label={t('adminSettings.offers.loading')} />;

  const failed = (error: unknown) =>
    showToast(
      isApiError(error, 'offer_scope_unknown')
        ? t('adminSettings.offers.scopeUnknown')
        : t('adminSettings.offers.saveFailed'),
      { tone: 'error' },
    );

  const submit = (draft: OfferDraft) => {
    const id = editing?.offer?.id;
    const body = offerRequest(draft);
    save.mutate(
      { branchId: branch.id, id, body },
      {
        onSuccess: (saved) => {
          setEditing(null);
          showToast(
            t(id ? 'adminSettings.offers.saved' : 'adminSettings.offers.added', {
              name: saved.name,
            }),
            { tone: 'success' },
          );
        },
        onError: failed,
      },
    );
  };

  const toggleActive = (offer: AutoOffer) =>
    save.mutate(
      { branchId: branch.id, id: offer.id, body: toggledRequest(offer) },
      {
        onSuccess: (saved) =>
          showToast(
            t(saved.active ? 'adminSettings.offers.resumed' : 'adminSettings.offers.paused', {
              name: saved.name,
            }),
            { tone: 'success' },
          ),
        onError: failed,
      },
    );

  /** "Every day · 4:00 PM – 7:00 PM". */
  const when = (offer: AutoOffer) => {
    const summary = daysSummary(offer.days);
    const days =
      summary.kind === 'list'
        ? summary.days.map((d) => t(`adminSettings.hours.days.${d}`).slice(0, 3)).join(', ')
        : t(`adminSettings.offers.${summary.kind}`);
    const at = (time: string) => clock.time(clock.localTimestamp(0, time, now ?? new Date()));
    return t('adminSettings.offers.when', { days, from: at(offer.from), to: at(offer.to) });
  };

  /** "1 Nov 2026 – 30 Nov 2026", "From 1 Nov 2026", or nothing without dates. */
  const dates = (offer: AutoOffer) => {
    const day = (key: string) => clock.date(`${key}T12:00:00Z`);
    if (offer.startsOn && offer.endsOn) {
      return t('adminSettings.offers.dates', { from: day(offer.startsOn), to: day(offer.endsOn) });
    }
    if (offer.startsOn) return t('adminSettings.offers.from', { date: day(offer.startsOn) });
    if (offer.endsOn) return t('adminSettings.offers.until', { date: day(offer.endsOn) });
    return null;
  };

  /** "20% off · On Beverages, Mango Lassi". */
  const what = (offer: AutoOffer) => {
    const discount = t(`adminSettings.offers.discount.${offer.type}`, {
      value: offer.value,
      amount: money.format(offer.value),
    });
    const names = [
      ...(offer.scope.categories ?? []).map((id) => menu?.getCategory(id)?.name ?? id),
      ...(offer.scope.dishes ?? []).map((slug) => menu?.getDish(slug)?.name ?? slug),
    ];
    const covers =
      names.length <= 3
        ? names.join(', ')
        : t.plural('adminSettings.offers.selected', names.length);
    return `${discount} · ${t('adminSettings.offers.covers', { what: covers })}`;
  };

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <h1 className={editor.title}>{t('adminSettings.sections.offers.title')}</h1>
            <p className={editor.subtitle}>{t('adminSettings.offers.subtitle')}</p>
          </div>
          <Button iconStart="plus" onClick={() => setEditing({})}>
            {t('adminSettings.offers.add')}
          </Button>
        </div>
      </header>

      {offers.length === 0 ? (
        <SettingsNote>{t('adminSettings.offers.empty')}</SettingsNote>
      ) : (
        <ul className={styles.list}>
          {offers.map((offer) => {
            const standing = now ? offerStanding(offer, now, region.timezone) : null;
            const day = (key?: string) => (key ? clock.date(`${key}T12:00:00Z`) : '');
            const range = dates(offer);
            return (
              <li key={offer.id} className={styles.offer} data-paused={!offer.active || undefined}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon name="tag" size="md" />
                </span>
                <div className={styles.text}>
                  <div className={styles.nameRow}>
                    <h2 className={styles.name}>{offer.name}</h2>
                    {standing && (
                      <Tag variant={STANDING_TAG[standing]} icon={null}>
                        {t(`adminSettings.offers.standing.${standing}`, {
                          date: standing === 'upcoming' ? day(offer.startsOn) : day(offer.endsOn),
                        })}
                      </Tag>
                    )}
                  </div>
                  <p className={styles.meta}>{when(offer)}</p>
                  <p className={styles.detail}>{what(offer)}</p>
                  <p className={styles.detail}>
                    {[...offer.modes.map((m) => t(`modes.${m}`)), ...(range ? [range] : [])].join(
                      ' · ',
                    )}
                  </p>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-pressed={offer.active}
                    aria-label={t(
                      offer.active ? 'adminSettings.offers.pause' : 'adminSettings.offers.resume',
                      { name: offer.name },
                    )}
                    disabled={save.isPending}
                    onClick={() => toggleActive(offer)}
                  >
                    {offer.active
                      ? t('adminSettings.offers.pauseShort')
                      : t('adminSettings.offers.resumeShort')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart="pencil"
                    onClick={() => setEditing({ offer })}
                  >
                    {t('adminSettings.offers.edit')}
                  </Button>
                  <IconButton
                    icon="trash"
                    variant="soft"
                    size="sm"
                    className={styles.remove}
                    label={t('adminSettings.offers.remove', { name: offer.name })}
                    onClick={() => setRemoving(offer)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <OfferDialog
          offer={editing.offer}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={submit}
        />
      )}
      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          presentation="adaptive"
          title={t('adminSettings.offers.removeTitle', { name: removing.name })}
          footer={
            <div className={styles.footer}>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                {t('adminSettings.offers.cancel')}
              </Button>
              <Button
                className={styles.danger}
                iconStart="trash"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { branchId: branch.id, id: removing.id },
                    {
                      onSuccess: () => {
                        showToast(t('adminSettings.offers.removed', { name: removing.name }), {
                          tone: 'success',
                        });
                        setRemoving(null);
                      },
                      onError: failed,
                    },
                  )
                }
              >
                {t('adminSettings.offers.removeConfirm')}
              </Button>
            </div>
          }
        >
          <p>{t('adminSettings.offers.removeBody')}</p>
        </Dialog>
      )}
    </div>
  );
}
