'use client';

import { useState } from 'react';
import type { ClientDetail } from '@/api/contracts';
import { useContent, usePlatformAddons } from '@/api/hooks';
import { useAddClientAddon, useRemoveClientAddon } from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Button, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { rupees } from '@/lib/platform';
import styles from './Platform.module.css';

/**
 * What the client has on top of its package (+10 tables, Inventory…): each with its price per
 * term, added from the catalog (its limit goes up, its feature comes on) or removed (given back).
 */
export function ClientAddons({
  platformKey,
  by,
  client,
}: {
  platformKey: string;
  by: string;
  client: ClientDetail;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const catalog = usePlatformAddons(platformKey).data ?? [];
  const offered = catalog.filter((a) => !a.hidden);
  const add = useAddClientAddon(platformKey);
  const remove = useRemoveClientAddon(platformKey);
  const [code, setCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const qty = Number.parseInt(quantity, 10);
  const perTerm = (prices: { yearly: number | null; halfYearly: number | null }) =>
    client.billingCycle === 'yearly' ? prices.yearly : prices.halfYearly;

  // Awaited: a change reloads the client and starts the page's form again.
  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      showToast(done);
    } catch {
      showToast(t('platform.addons.failed'), { tone: 'error' });
    }
  };

  return (
    <SettingsCard title={t('platform.addons.title')} hint={t('platform.addons.hint')}>
      {client.addons.length === 0 ? (
        <p className={styles.muted}>{t('platform.addons.none')}</p>
      ) : (
        <ul className={styles.payments}>
          {client.addons.map((a) => {
            const price = perTerm(a.prices);
            return (
              <li key={a.id} className={styles.payment}>
                <div className={styles.tight}>
                  <strong>
                    {a.quantity > 1
                      ? t('platform.addons.times', { name: a.name, count: a.quantity })
                      : a.name}
                  </strong>
                  <span className={styles.muted}>
                    {price === null
                      ? t('platform.list.onRequest')
                      : t('platform.addons.price', { price: rupees(price * a.quantity) })}
                    {' · '}
                    {t('platform.addons.addedBy', {
                      by: a.by,
                      date: new Date(a.at).toLocaleDateString(undefined, { dateStyle: 'medium' }),
                    })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconStart="trash"
                  disabled={remove.isPending}
                  onClick={() =>
                    void run(
                      () => remove.mutateAsync({ id: client.id, addonId: a.id, by }),
                      t('platform.addons.removed', { name: a.name }),
                    )
                  }
                >
                  {t('platform.payments.remove')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className={`${styles.addRow}`}>
        <Select
          id="client-addon"
          label={t('platform.addons.pick')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        >
          <option value="">{t('platform.addons.choose')}</option>
          {offered.map((a) => {
            const price = perTerm(a.prices);
            return (
              <option key={a.code} value={a.code}>
                {price === null ? a.name : `${a.name} · ${rupees(price)}`}
              </option>
            );
          })}
        </Select>
        <Input
          id="client-addon-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          label={t('platform.addons.quantity')}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Button
          iconStart="plus"
          disabled={!code || !(qty >= 1 && qty <= 100)}
          loading={add.isPending}
          onClick={() =>
            void run(
              () => add.mutateAsync({ id: client.id, body: { by, addon: code, quantity: qty } }),
              t('platform.addons.added', {
                name: offered.find((a) => a.code === code)?.name ?? '',
              }),
            )
          }
        >
          {t('platform.addons.add')}
        </Button>
      </div>
    </SettingsCard>
  );
}
