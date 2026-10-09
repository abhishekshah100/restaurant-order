'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useBranches, useContent, useRestaurant } from '@/api/hooks';
import { BrandPanel } from '@/components/home/BrandPanel';
import { Button, Icon } from '@/components/ui';
import { useGuestSession, useVisit, useVisitActions } from '@/context/GuestSessionContext';
import { useCart } from '@/hooks/useCart';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { cx } from '@/lib/cx';
import { branchModes } from '@/lib/fulfilment';
import type { OrderMode } from '@/types/branch';
import { DeliveryAreaSelect } from './DeliveryAreaSelect';
import { ModeOptions } from './ModeOptions';
import { OutletList } from './OutletList';
import { SwitchOutletDialog } from './SwitchOutletDialog';
import styles from './StartView.module.css';

/** Where to go once the guest has chosen: `?next=` (a path in the app) or the menu. */
const safeNext = (next: string | null) =>
  next?.startsWith('/') && !next.startsWith('//') ? next : '/menu/';

/**
 * The start screen for guests without a table QR code (and for changing how they order):
 * choose an outlet, then dine-in (only after scanning a table's QR code), takeaway or
 * delivery (with the area). Starting at another outlet opens a new session, so it asks first
 * if that would empty the cart; another mode at the same outlet keeps the cart.
 */
export function StartView() {
  const branches = useBranches();
  const restaurant = useRestaurant();
  const session = useGuestSession();
  const visit = useVisit();
  const { start, update } = useVisitActions();
  const { count, hydrated } = useCart();
  const router = useRouter();
  const next = useQueryParam('next');
  const requestFailed = useRequestFailed();
  const t = useContent('home');
  const common = useContent('common');

  // What the guest picked; until then, what the link or their session already says.
  const [pickedBranch, setPickedBranch] = useState<string | null>(null);
  const [pickedMode, setPickedMode] = useState<OrderMode | null>(null);
  const [pickedArea, setPickedArea] = useState<string | null>(null);
  const [areaError, setAreaError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const branchId =
    pickedBranch ??
    visit.choice.branchId ??
    session?.branchId ??
    (branches.length === 1 ? branches[0].id : null);
  const branch = branches.find((b) => b.id === branchId) ?? null;
  const sameBranch = session !== null && session.branchId === branchId;
  const scannedTable = sameBranch ? (session.table ?? null) : null;
  const mode = pickedMode ?? visit.choice.mode ?? (sameBranch ? session.mode : null);
  const validMode =
    branch &&
    mode &&
    branchModes(branch).includes(mode) &&
    (mode !== 'dineIn' || scannedTable !== null)
      ? mode
      : null;
  const area = pickedArea ?? (sameBranch ? session.deliveryArea : undefined) ?? '';

  const chooseBranch = (id: string) => {
    setPickedBranch(id);
    setPickedArea(null);
    setAreaError(false);
  };

  const go = async () => {
    if (!branch || !validMode) return;
    setBusy(true);
    const deliveryArea = validMode === 'delivery' ? area : undefined;
    let ok = true;
    if (sameBranch) {
      if (session.mode !== validMode || (deliveryArea && deliveryArea !== session.deliveryArea)) {
        ok = await update({ mode: validMode, ...(deliveryArea ? { deliveryArea } : {}) });
      }
    } else if (validMode !== 'dineIn') {
      ok = await start({ branchId: branch.id, mode: validMode, deliveryArea });
    }
    if (ok) {
      router.push(safeNext(next));
    } else {
      setBusy(false);
      requestFailed();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validMode || busy) return;
    if (validMode === 'delivery' && !area) {
      setAreaError(true);
      document.getElementById('start-area')?.focus();
      return;
    }
    // Another outlet is another session: its cart starts empty.
    if (session && !sameBranch && hydrated && count > 0) setConfirming(true);
    else void go();
  };

  const cta = validMode
    ? t('start.continueMode', { mode: common(`modes.${validMode}`) })
    : t('start.continue');

  return (
    <div className={styles.page}>
      <BrandPanel caption={restaurant.name} />
      <div className={cx(styles.hero, 'hide-desktop')}>
        <Image
          className={styles.heroImg}
          src="/images/pasta-hero.jpg"
          alt=""
          width={780}
          height={540}
          sizes="100vw"
          priority
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroBrand}>
          <Icon name="olive" />
          <span className={cx('t-caption', styles.heroCaption)}>{restaurant.name}</span>
        </div>
      </div>

      <main id="main" className={styles.main}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t('start.eyebrow', { restaurant: restaurant.name })}</p>
            <h1 className={cx('t-display', styles.title)}>{t('start.title')}</h1>
            <p className={cx('t-body c2', styles.lede)}>{t('start.lede')}</p>
          </div>

          <section className={styles.section} aria-labelledby="start-outlets">
            <h2 id="start-outlets" className={styles.sectionTitle}>
              {t('start.outletsTitle')}
            </h2>
            <OutletList
              branches={branches}
              value={branchId}
              onChange={chooseBranch}
              label={t('start.outletsLabel')}
            />
          </section>

          {branch && (
            <section className={styles.section} aria-labelledby="start-modes">
              <h2 id="start-modes" className={styles.sectionTitle}>
                {t('start.modesTitle')}
              </h2>
              <ModeOptions
                branch={branch}
                value={validMode}
                onChange={setPickedMode}
                scannedTable={scannedTable}
                label={t('start.modesLabel')}
                current={sameBranch ? session.mode : undefined}
              />
              {validMode === 'delivery' && (
                <DeliveryAreaSelect
                  id="start-area"
                  branch={branch}
                  value={area}
                  onChange={(next) => {
                    setPickedArea(next);
                    setAreaError(false);
                  }}
                  error={areaError ? t('start.areaRequired') : undefined}
                />
              )}
            </section>
          )}

          <div className={cx(styles.cta, 'hide-mobile')}>
            <Button type="submit" block iconEnd="arrow" disabled={!validMode} loading={busy}>
              {cta}
            </Button>
          </div>
          <div className={cx(styles.actionbar, 'hide-desktop')}>
            <Button type="submit" block iconEnd="arrow" disabled={!validMode} loading={busy}>
              {cta}
            </Button>
          </div>
        </form>
      </main>

      {branch && (
        <SwitchOutletDialog
          open={confirming}
          branch={branch}
          items={count}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void go();
          }}
        />
      )}
    </div>
  );
}
