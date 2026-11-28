'use client';

import { useState } from 'react';
import { useAdminBranches, useAdminStaff, useContent, useFloorPlan } from '@/api/hooks';
import { useBranchMenu } from '@/api/adminDashboard';
import { useChoosePlanKeep } from '@/api/mutations';
import { Button, OptionGroup } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { BranchPlan, PlanKeep as Keep } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SettingsCard, SettingsNote } from './shared/SettingsEditor';
import styles from './PlanSettings.module.css';

type Kind = 'branches' | 'staff' | 'tables' | 'dishes';

interface Item {
  id: string;
  label: string;
  sub?: string;
  locked: boolean;
}

/**
 * Settings › My plan › Choose what to keep (restaurant-backend › ADR-056): while the restaurant
 * has more than its plan allows (now, or on a planned smaller plan's day), the owner picks which
 * branches, staff logins, and this branch's tables and dishes stay in use; the rest is locked,
 * never deleted. Only what's over the limit is asked.
 */
export function PlanKeep({ plan }: { plan: BranchPlan }) {
  const t = useContent('common');
  const { branch, region, clock } = useAdminWorkspace();
  const limits = plan.change?.limits ?? plan.limits;
  const branches = useAdminBranches().data ?? [];
  const staff = useAdminStaff(branch.id).data?.staff ?? [];
  const floors = useFloorPlan(branch.id).data?.floors ?? [];
  const { menu } = useBranchMenu(region);

  const lists: Record<Kind, Item[]> = {
    branches: branches.map((b) => ({
      id: b.id,
      label: b.name,
      sub: b.shortName,
      locked: b.plan?.branchLocked === true,
    })),
    staff: staff
      .filter((s) => s.active || s.planLocked)
      .map((s) => ({ id: s.id, label: s.name, sub: s.role.name, locked: s.planLocked === true })),
    tables: floors.flatMap((f) =>
      f.tables.map((tb) => ({
        id: String(tb.table),
        label: t('adminSettings.plan.keep.table', { number: tb.table }),
        sub: f.name,
        locked: tb.planLocked === true,
      })),
    ),
    dishes: (menu?.dishes ?? []).map((d) => ({
      id: d.slug,
      label: d.name,
      locked: d.planLocked === true,
    })),
  };
  const over = (['branches', 'staff', 'tables', 'dishes'] as const).filter((k) => {
    const max = limits[k];
    return max !== null && lists[k].length > max;
  });
  if (over.length === 0) return null;

  return (
    <SettingsCard
      title={t('adminSettings.plan.keep.title')}
      hint={
        plan.change
          ? t('adminSettings.plan.keep.hintChange', {
              plan: plan.change.name,
              date: clock.date(new Date(plan.change.at)),
            })
          : t('adminSettings.plan.keep.hintNow')
      }
    >
      {over.map((kind) => (
        <KeepList
          key={kind}
          kind={kind}
          items={lists[kind]}
          max={limits[kind] ?? 0}
          chosen={chosenOf(plan.keep, kind, branch.id)}
          toKeep={(ids) => keepOf(kind, ids, branch.id)}
        />
      ))}
    </SettingsCard>
  );
}

/** What was picked before for a kind (tables and dishes: this branch's). */
function chosenOf(keep: Keep | undefined, kind: Kind, branchId: string): string[] {
  if (kind === 'branches') return keep?.branches ?? [];
  if (kind === 'staff') return keep?.staff ?? [];
  if (kind === 'tables') return (keep?.tables?.[branchId] ?? []).map(String);
  return keep?.dishes?.[branchId] ?? [];
}

/** The request for a kind's picks. */
function keepOf(kind: Kind, ids: string[], branchId: string): Keep {
  if (kind === 'branches') return { branches: ids };
  if (kind === 'staff') return { staff: ids };
  if (kind === 'tables') return { tables: { [branchId]: ids.map(Number) } };
  return { dishes: { [branchId]: ids } };
}

function KeepList({
  kind,
  items,
  max,
  chosen,
  toKeep,
}: {
  kind: Kind;
  items: Item[];
  max: number;
  chosen: string[];
  toKeep: (ids: string[]) => Keep;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useChoosePlanKeep();
  // To start: what was picked, else what's in use now (not locked), up to the limit.
  const start = (
    chosen.length > 0
      ? chosen.filter((id) => items.some((i) => i.id === id))
      : items.filter((i) => !i.locked).map((i) => i.id)
  ).slice(0, max);
  const [picked, setPicked] = useState(start);
  const changed = picked.join() !== start.join();

  return (
    <div className={styles.keep}>
      <OptionGroup
        id={`keep-${kind}`}
        type="checkbox"
        title={t(`adminSettings.plan.keep.${kind}`, { max })}
        headingAs="h3"
        value={picked}
        max={max}
        onChange={setPicked}
        choices={items.map((i) => ({
          id: i.id,
          label: i.label,
          ...(i.sub || i.locked
            ? {
                sub: [i.sub, i.locked ? t('adminSettings.plan.keep.lockedNow') : null]
                  .filter(Boolean)
                  .join(' · '),
              }
            : {}),
        }))}
      />
      {kind === 'staff' && <SettingsNote>{t('adminSettings.plan.keep.ownersStay')}</SettingsNote>}
      <div className={styles.keepActions}>
        <span className={styles.keepCount}>
          {t('adminSettings.plan.keep.picked', { count: picked.length, max })}
        </span>
        <Button
          size="sm"
          disabled={!changed}
          loading={save.isPending}
          onClick={() =>
            save.mutate(
              { branchId: branch.id, keep: toKeep(picked) },
              {
                onSuccess: () => showToast(t('adminSettings.plan.keep.saved'), { tone: 'success' }),
                onError: () => showToast(t('adminSettings.plan.keep.failed'), { tone: 'error' }),
              },
            )
          }
        >
          {t('adminSettings.plan.keep.save')}
        </Button>
      </div>
    </div>
  );
}
