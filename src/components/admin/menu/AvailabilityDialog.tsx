'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSetDishAvailability } from '@/api/mutations';
import { Button, Chip, Dialog, OptionGroup } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { backAtTimes } from '@/lib/adminMenu';
import type { Dish, DishAvailability } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { Switch } from './Switch';
import styles from './AvailabilityDialog.module.css';

type Choice = 'available' | 'soldOut' | 'soldOutUntil' | 'offToday';

const CHOICES: readonly Choice[] = ['available', 'soldOut', 'soldOutUntil', 'offToday'];

/** A time a dish is back: as guests read it, and (ISO) when it's available again. */
interface BackAt {
  label: string;
  until?: string;
}

function choiceOf(availability: DishAvailability): Choice {
  if (availability.status === 'unavailable-today') return 'offToday';
  if (availability.status === 'sold-out') return availability.backAt ? 'soldOutUntil' : 'soldOut';
  return 'available';
}

/**
 * How guests can order a dish: available, sold out for now, sold out until a time (guests read
 * "Back 8:30 PM"), or off for the day; and, for a dish with sizes, which sizes are on.
 */
export function AvailabilityDialog({
  dish,
  initial,
  onClose,
}: {
  dish: Dish;
  /** Where to start (the switch turned off starts at Sold out). */
  initial?: Choice;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetDishAvailability();
  const now = useNow(60_000);
  const [choice, setChoice] = useState<Choice>(initial ?? choiceOf(dish.availability));
  // A time already set stays on offer (with when it ends, if the server knows it).
  const current: BackAt | undefined =
    dish.availability.status === 'sold-out' && dish.availability.backAt
      ? { label: dish.availability.backAt, until: dish.availability.until }
      : undefined;
  const [picked, setPicked] = useState<BackAt | undefined>(current);
  const [sizes, setSizes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((dish.variants ?? []).map((v) => [v.id, v.available !== false])),
  );
  const times: BackAt[] = now
    ? backAtTimes(now).map((at) => ({ label: clock.time(at), until: at.toISOString() }))
    : [];
  const options = current ? [current, ...times.filter((o) => o.label !== current.label)] : times;
  const backAt = picked ?? times[0];

  let availability: DishAvailability = { status: 'available' };
  if (choice === 'soldOut') availability = { status: 'sold-out' };
  if (choice === 'soldOutUntil' && backAt) {
    availability = {
      status: 'sold-out',
      backAt: backAt.label,
      ...(backAt.until ? { until: backAt.until } : {}),
    };
  }
  if (choice === 'offToday') availability = { status: 'unavailable-today' };

  const submit = () =>
    save.mutate(
      {
        branchId: branch.id,
        slug: dish.slug,
        body: { availability, ...(dish.variants ? { variants: sizes } : {}) },
      },
      {
        onSuccess: () => {
          showToast(
            t(`adminMenu.availability.toast.${choice}`, {
              dish: dish.name,
              time: backAt?.label ?? '',
            }),
            { tone: 'success' },
          );
          onClose();
        },
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminMenu.availability.title', { dish: dish.name })}
      description={t('adminMenu.availability.subtitle')}
      footer={
        <Button block iconStart="check" loading={save.isPending} onClick={submit}>
          {t('adminMenu.availability.save')}
        </Button>
      }
    >
      <div className={styles.body}>
        <OptionGroup
          type="radio"
          id={`availability-${dish.slug}`}
          title={t('adminMenu.availability.question')}
          value={choice}
          onChange={(id) => setChoice(CHOICES.find((c) => c === id) ?? choice)}
          choices={CHOICES.map((c) => ({
            id: c,
            label: t(`adminMenu.availability.options.${c}`),
            sub: t(`adminMenu.availability.options.${c}Sub`),
          }))}
        />

        {choice === 'soldOutUntil' && (
          <div
            className={styles.times}
            role="group"
            aria-label={t('adminMenu.availability.backAt')}
          >
            {options.map((option) => (
              <Chip
                key={option.label}
                pressed={backAt?.label === option.label}
                onClick={() => setPicked(option)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        )}

        {dish.variants && dish.variants.length > 1 && (
          <section className={styles.sizes} aria-labelledby="sizes-title">
            <h3 id="sizes-title" className={styles.sizesTitle}>
              {t('adminMenu.availability.sizes')}
            </h3>
            <p className={styles.hint}>{t('adminMenu.availability.sizesHint')}</p>
            <ul className={styles.sizeList}>
              {dish.variants.map((v) => (
                <li key={v.id} className={styles.size}>
                  <span>{v.name}</span>
                  <Switch
                    checked={sizes[v.id]}
                    onChange={(on) => setSizes({ ...sizes, [v.id]: on })}
                    label={t('adminMenu.availability.sizeToggle', { size: v.name })}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Dialog>
  );
}
