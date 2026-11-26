'use client';

import { useState } from 'react';
import type { ClientDetail, FeatureInfo, PackagePlan } from '@/api/contracts';
import {
  useContent,
  usePlatformClient,
  usePlatformFeatures,
  usePlatformPackages,
} from '@/api/hooks';
import { useGoLive, useSuspendPlatformClient, useUpdatePlatformClient } from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Banner, Button, Chip, Dialog, Input, Skeleton, Tag, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  addDays,
  changesOf,
  downgradeOf,
  draftOf,
  byCatalog,
  LIMITS,
  listPriceOf,
  priceOf,
  rupees,
  termEnd,
  usageOf,
  withPackage,
  type ClientDraft,
  type Downgrade,
} from '@/lib/platform';
import { ClientHistory } from './ClientHistory';
import { ClientAddons } from './ClientAddons';
import { ClientPayments } from './ClientPayments';
import { RemindButton } from './RemindButton';
import { FeatureToggles } from './FeatureToggles';
import { LimitField } from './LimitField';
import { PackagePicker } from './PackagePicker';
import { StatusTag } from './StatusTag';
import styles from './Platform.module.css';

/** One client, loaded; the form starts again from what's saved after each change. */
export function ClientEditor({
  platformKey,
  by,
  clientId,
  onBack,
}: {
  platformKey: string;
  by: string;
  clientId: string;
  onBack: () => void;
}) {
  const t = useContent('common');
  const client = usePlatformClient(platformKey, clientId);
  const packages = usePlatformPackages(platformKey);
  const catalog = usePlatformFeatures(platformKey);

  return (
    <div className={styles.stack}>
      <div>
        <Button variant="ghost" size="sm" iconStart="back" onClick={onBack}>
          {t('platform.client.back')}
        </Button>
      </div>
      {client.isError || packages.isError || catalog.isError ? (
        <Banner tone="err" icon="alert" live="assertive">
          {t('platform.client.failed')}
        </Banner>
      ) : !client.data || !packages.data || !catalog.data ? (
        <Skeleton height={480} />
      ) : (
        <ClientForm
          // A saved change (a new history entry) starts the form again from the server's copy.
          key={`${client.data.history[0]?.at ?? ''}:${String(client.data.history.length)}`}
          platformKey={platformKey}
          by={by}
          client={client.data}
          packages={packages.data}
          catalog={catalog.data}
        />
      )}
    </div>
  );
}

function ClientForm({
  platformKey,
  by,
  client,
  packages,
  catalog,
}: {
  platformKey: string;
  by: string;
  client: ClientDetail;
  packages: PackagePlan[];
  catalog: FeatureInfo[];
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const update = useUpdatePlatformClient(platformKey);
  const suspend = useSuspendPlatformClient(platformKey);
  const goLive = useGoLive(platformKey);
  const [goingLive, setGoingLive] = useState(false);
  const [draft, setDraft] = useState<ClientDraft>(() => draftOf(client));
  const [downgrade, setDowngrade] = useState<Downgrade | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const pkg = packages.find((p) => p.code === draft.plan);
  const body = changesOf(client, draft, by);
  const price = priceOf(draft.price);
  const packagePrice = pkg ? listPriceOf(pkg, draft.billingCycle, client.usage.branches) : null;
  // With the add-ons it has, each at its price per term when added.
  const addonsPrice = client.addons.reduce(
    (sum, a) =>
      sum +
      a.quantity * ((draft.billingCycle === 'yearly' ? a.prices.yearly : a.prices.halfYearly) ?? 0),
    0,
  );
  const listPrice = packagePrice === null ? null : packagePrice + addonsPrice;
  const set = (patch: Partial<ClientDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const today = new Date();

  // Awaited, not per-call callbacks: a saved change reloads the client and starts this form
  // again (its key), which would drop them.
  const save = async () => {
    if (!body) return;
    setProblem(null);
    try {
      await update.mutateAsync({ id: client.id, body });
      showToast(t('platform.save.saved', { name: client.name }));
    } catch {
      setProblem(t('platform.save.failed'));
    } finally {
      setDowngrade(null);
    }
  };

  const trySave = () => {
    if (Number.isNaN(price)) return setProblem(t('platform.price.invalid'));
    if (draft.startsAt && draft.endsAt && draft.endsAt <= draft.startsAt) {
      return setProblem(t('platform.save.endsBeforeStart'));
    }
    const lower = downgradeOf(client, draft);
    if (lower) setDowngrade(lower);
    else void save();
  };

  const toggleSuspend = async () => {
    const resuming = client.suspendedAt !== null;
    try {
      await suspend.mutateAsync({ id: client.id, by, reason: resuming ? null : reason.trim() });
      setSuspending(false);
      setReason('');
      showToast(
        t(resuming ? 'platform.suspend.resumed' : 'platform.suspend.done', { name: client.name }),
      );
    } catch {
      showToast(t('platform.suspend.failed'), { tone: 'error' });
    }
  };

  const changed = body ? Object.keys(body).filter((k) => k !== 'by') : [];
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

  return (
    <>
      <header className={styles.spread}>
        <div className={styles.tight}>
          <h2 className={styles.title}>{client.name}</h2>
          <span className={styles.muted}>
            {client.branches.map((b) => b.name).join(' · ')} ·{' '}
            {t('platform.client.since', { date: date(client.createdAt) })}
          </span>
        </div>
        <div className={styles.row}>
          {client.demo && <Tag variant="warn">{t('platform.demo.tag')}</Tag>}
          <StatusTag status={client.status} />
          {client.demo && (
            <Button size="sm" iconStart="check" onClick={() => setGoingLive(true)}>
              {t('platform.demo.goLive')}
            </Button>
          )}
        </div>
      </header>

      {client.demo && (
        <Banner tone="warn" icon="alert">
          {t('platform.demo.warning')}
        </Banner>
      )}

      <SettingsCard title={t('platform.package.title')} hint={t('platform.package.hint')}>
        <div className={styles.row} role="group" aria-label={t('platform.term.cycle')}>
          {(['yearly', 'halfYearly'] as const).map((cycle) => (
            <Chip
              key={cycle}
              pressed={draft.billingCycle === cycle}
              onClick={() => set({ billingCycle: cycle })}
            >
              {t(`platform.term.cycles.${cycle}`)}
            </Chip>
          ))}
        </div>
        <PackagePicker
          packages={packages.filter((p) => !p.hidden || p.code === client.plan.code)}
          value={draft.plan}
          current={client.plan.code}
          cycle={draft.billingCycle}
          onPick={(p) => setDraft((d) => withPackage(d, p))}
        />
      </SettingsCard>

      <SettingsCard title={t('platform.limits.title')} hint={t('platform.limits.hint')}>
        <div className={styles.limits}>
          {LIMITS.map(({ id, step }) => (
            <LimitField
              key={id}
              id={`limit-${id}`}
              name={t(`platform.limits.names.${id}`)}
              value={draft.limits[id]}
              step={step}
              packageValue={pkg?.limits[id] ?? null}
              used={usageOf(client.usage, id)}
              onChange={(value) => set({ limits: { ...draft.limits, [id]: value } })}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title={t('platform.features.title')} hint={t('platform.features.hint')}>
        <FeatureToggles
          idPrefix="client-feature"
          value={draft.features}
          inPackage={pkg?.features ?? []}
          catalog={catalog}
          onChange={(features) => set({ features })}
        />
      </SettingsCard>

      <SettingsCard
        title={t('platform.term.title')}
        hint={t('platform.term.hint')}
        action={
          client.suspendedAt ? (
            <Button
              variant="primary"
              size="sm"
              loading={suspend.isPending}
              onClick={() => void toggleSuspend()}
            >
              {t('platform.term.resume')}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setSuspending(true)}>
              {t('platform.term.suspend')}
            </Button>
          )
        }
      >
        <div className={styles.status}>
          <StatusTag status={client.status} />
          <span>
            {client.suspendedAt
              ? t('platform.term.suspendedOn', {
                  date: date(client.suspendedAt),
                  reason: client.suspendReason ?? '',
                })
              : client.lockAt
                ? t('platform.term.statusLine', { date: date(client.lockAt) })
                : t('platform.term.noEnd')}
          </span>
        </div>
        <div className={styles.row}>
          <RemindButton platformKey={platformKey} by={by} client={client} />
          <span className={styles.muted}>
            {client.contactPhone
              ? client.remindedAt
                ? t('platform.overview.reminded', { date: date(client.remindedAt) })
                : t('platform.remind.never')
              : t('platform.remind.noPhone')}
          </span>
        </div>
        <div className={styles.fields}>
          <div className={styles.tight}>
            <Input
              id="trial-ends"
              type="date"
              label={t('platform.term.trialEnds')}
              value={draft.trialEndsAt}
              onChange={(event) => set({ trialEndsAt: event.target.value })}
            />
            <div className={styles.row}>
              {[7, 15, 30].map((days) => (
                <Chip
                  key={days}
                  onClick={() => set({ trialEndsAt: addDays(draft.trialEndsAt, days, today) })}
                >
                  {t('platform.term.add', { days })}
                </Chip>
              ))}
            </div>
          </div>
          <Input
            id="grace-days"
            type="number"
            inputMode="numeric"
            min={0}
            max={90}
            label={t('platform.term.grace')}
            hint={t('platform.term.graceHint')}
            value={String(draft.graceDays)}
            onChange={(event) => {
              const n = Number.parseInt(event.target.value, 10);
              set({ graceDays: Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), 90) });
            }}
          />
          <Input
            id="paid-from"
            type="date"
            label={t('platform.term.startsAt')}
            value={draft.startsAt}
            onChange={(event) => set({ startsAt: event.target.value })}
          />
          <div className={styles.tight}>
            <Input
              id="paid-until"
              type="date"
              label={t('platform.term.endsAt')}
              value={draft.endsAt}
              onChange={(event) => set({ endsAt: event.target.value })}
            />
            <div className={styles.row}>
              <Chip
                onClick={() =>
                  set({
                    endsAt: termEnd(draft.startsAt || addDays('', 0, today), draft.billingCycle),
                    startsAt: draft.startsAt || addDays('', 0, today),
                  })
                }
              >
                {t('platform.term.fillTerm')}
              </Chip>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={t('platform.price.title')} hint={t('platform.price.hint')}>
        <p className={styles.muted}>
          {packagePrice === null || listPrice === null
            ? t('platform.price.listOnRequest')
            : addonsPrice > 0
              ? t('platform.price.listWithAddons', {
                  package: rupees(packagePrice),
                  addons: rupees(addonsPrice),
                  price: rupees(listPrice),
                })
              : t('platform.price.list', { price: rupees(listPrice) })}
        </p>
        <div className={styles.fields}>
          <Input
            id="client-price"
            inputMode="numeric"
            label={t('platform.price.custom')}
            hint={t('platform.price.customHint')}
            error={Number.isNaN(price) ? t('platform.price.invalid') : undefined}
            value={draft.price}
            onChange={(event) => set({ price: event.target.value })}
          />
          <Input
            id="client-price-note"
            label={t('platform.price.note')}
            hint={t('platform.price.noteHint')}
            maxLength={120}
            value={draft.priceNote}
            onChange={(event) => set({ priceNote: event.target.value })}
          />
        </div>
        {(price ?? listPrice) !== null && !Number.isNaN(price) && (
          <p className={styles.entryHead}>
            {t('platform.price.pays', { price: rupees((price ?? listPrice) as number) })}
          </p>
        )}
      </SettingsCard>

      <SettingsCard title={t('platform.contact.title')}>
        <div className={styles.fields}>
          {(['name', 'phone', 'email', 'taxNumber'] as const).map((field) => (
            <Input
              key={field}
              id={`contact-${field}`}
              label={t(`platform.contact.${field}`)}
              type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
              maxLength={field === 'name' ? 80 : field === 'email' ? 120 : 30}
              value={draft.contact[field]}
              onChange={(event) =>
                set({ contact: { ...draft.contact, [field]: event.target.value } })
              }
            />
          ))}
        </div>
        <Textarea
          id="client-notes"
          label={t('platform.contact.notes')}
          hint={t('platform.contact.notesHint')}
          maxLength={2000}
          rows={4}
          value={draft.notes}
          onChange={(event) => set({ notes: event.target.value })}
        />
      </SettingsCard>

      <ClientAddons platformKey={platformKey} by={by} client={client} />

      <ClientPayments platformKey={platformKey} by={by} client={client} />

      <SettingsCard title={t('platform.history.title')}>
        <ClientHistory history={client.history} packages={packages} catalog={catalog} />
      </SettingsCard>

      {problem && (
        <Banner tone="err" icon="alert" live="assertive">
          {problem}
        </Banner>
      )}

      {body && (
        <div className={styles.saveBar} role="region" aria-label={t('platform.save.pending')}>
          <span className={styles.saveSummary}>
            {t('platform.save.pending')} · {t('platform.save.summary', { count: changed.length })}
          </span>
          <div className={styles.row}>
            <Button
              variant="ghost"
              size="sm"
              disabled={update.isPending}
              onClick={() => {
                setDraft(draftOf(client));
                setProblem(null);
              }}
            >
              {t('platform.save.discard')}
            </Button>
            <Button size="sm" loading={update.isPending} onClick={trySave}>
              {t('platform.save.save')}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={downgrade !== null}
        onClose={() => !update.isPending && setDowngrade(null)}
        presentation="modal"
        title={t('platform.downgrade.title', { name: client.name })}
        footer={
          <div className={styles.dialogActions}>
            <Button
              variant="secondary"
              disabled={update.isPending}
              onClick={() => setDowngrade(null)}
            >
              {t('platform.downgrade.cancel')}
            </Button>
            <Button loading={update.isPending} onClick={() => void save()}>
              {t('platform.downgrade.confirm')}
            </Button>
          </div>
        }
      >
        {downgrade && (
          <div className={styles.dialogBody}>
            {downgrade.over.length > 0 && (
              <>
                <ul>
                  {downgrade.over.map((o) => (
                    <li key={o.limit}>
                      {t('platform.downgrade.over', {
                        limit: t(`platform.limits.names.${o.limit}`),
                        used: o.used,
                        max: o.max,
                      })}
                    </li>
                  ))}
                </ul>
                <p className={styles.muted}>{t('platform.downgrade.overNote')}</p>
              </>
            )}
            {downgrade.featuresOff.length > 0 && (
              <p>
                {t('platform.downgrade.featuresOff', {
                  features: byCatalog(downgrade.featuresOff, catalog)
                    .map((f) => f.name)
                    .join(', '),
                })}
              </p>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={suspending}
        onClose={() => !suspend.isPending && setSuspending(false)}
        presentation="modal"
        title={t('platform.suspend.title', { name: client.name })}
        footer={
          <div className={styles.dialogActions}>
            <Button
              variant="secondary"
              disabled={suspend.isPending}
              onClick={() => setSuspending(false)}
            >
              {t('platform.suspend.cancel')}
            </Button>
            <Button
              variant="dark"
              loading={suspend.isPending}
              disabled={!reason.trim()}
              onClick={() => void toggleSuspend()}
            >
              {t('platform.suspend.confirm')}
            </Button>
          </div>
        }
      >
        <div className={styles.dialogBody}>
          <p>{t('platform.suspend.body')}</p>
          <Textarea
            id="suspend-reason"
            label={t('platform.suspend.reason')}
            maxLength={200}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </Dialog>
      <Dialog
        open={goingLive}
        onClose={() => !goLive.isPending && setGoingLive(false)}
        presentation="modal"
        title={t('platform.demo.title', { name: client.name })}
        footer={
          <div className={styles.dialogActions}>
            <Button
              variant="secondary"
              disabled={goLive.isPending}
              onClick={() => setGoingLive(false)}
            >
              {t('platform.suspend.cancel')}
            </Button>
            <Button
              loading={goLive.isPending}
              onClick={() =>
                // Awaited: going live reloads the client and starts this form again.
                void goLive
                  .mutateAsync({ id: client.id, by })
                  .then(() => showToast(t('platform.demo.done', { name: client.name })))
                  .catch(() => showToast(t('platform.demo.failed'), { tone: 'error' }))
              }
            >
              {t('platform.demo.confirm')}
            </Button>
          </div>
        }
      >
        <p className={styles.dialogBody}>{t('platform.demo.body')}</p>
      </Dialog>
    </>
  );
}
