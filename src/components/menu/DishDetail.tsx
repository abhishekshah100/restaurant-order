'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Banner, Button, Lightbox, QuantityStepper } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OrderingBanner } from '@/components/status/OrderingBanner';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { useCartActions, useDishLines } from '@/hooks/useCart';
import { useDishConfig } from '@/hooks/useDishConfig';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import { unavailableReason } from '@/lib/menu';
import type { CartLine } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { DishHero, DishIntro, DishMediaColumn } from './DishDetailParts';
import { DishOptionsForm } from './DishOptionsForm';
import { NotOnMenu } from './NotOnMenu';
import { unavailableLabel, type MenuText } from './dishTag';
import styles from './DishDetail.module.css';

/**
 * Food detail (06 · w06) for a dish on the guest's branch menu. `?edit=<line key>` edits an
 * existing cart line.
 * The edit key is read after mount so the page can be prerendered.
 */
export function DishDetail({ slug }: { slug: string }) {
  const dish = useMenu().getDish(slug);
  const lines = useDishLines(slug);
  const editKey = useQueryParam('edit');

  if (!dish) return <NotOnMenu />;
  const editing = editKey ? lines.find((l) => l.key === editKey) : undefined;
  return <DishDetailForm key={editing?.key ?? 'new'} dish={dish} editing={editing} />;
}

function DishDetailForm({ dish, editing }: { dish: Dish; editing?: CartLine }) {
  const router = useRouter();
  const t = useContent('menu');
  const { money } = useRegion();
  const { addItem, editLine } = useCartActions();
  const [photoOpen, setPhotoOpen] = useState(false);
  const state = useDishConfig(
    dish,
    editing ? { config: editing, quantity: editing.quantity } : undefined,
  );
  const hero = dish.image;
  const unavailable = unavailableLabel(t, dish);
  // Closed: the menu is read-only, but existing cart lines can still be edited.
  const closed = !useOrderingAvailability().canAdd && !editing;
  const openPhoto = () => setPhotoOpen(true);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push('/menu/');
  };

  const submit = () => {
    if (!state.valid || unavailable || closed) return;
    if (editing) {
      editLine(editing.key, dish, state.config, state.quantity);
      router.push('/cart/');
    } else {
      addItem(dish, state.config, state.quantity);
      back();
    }
  };

  return (
    <>
      <SiteHeader showCart />

      {hero ? (
        <DishHero dish={dish} hero={hero} onBack={back} onZoom={openPhoto} />
      ) : (
        <MobileHeader variant="topbar" onBack={back} backLabel={t('nav.backToMenu')} />
      )}

      <Columns even className={styles.layout}>
        <DishMediaColumn dish={dish} onZoom={openPhoto} />

        <main id="main" className={cx(styles.main, hero && styles.overlap)}>
          <DishIntro dish={dish} />

          <OrderingBanner inline />

          {unavailable && (
            <Banner tone="warn" icon="clock">
              {unavailableNote(t, dish)}
            </Banner>
          )}

          <hr className={styles.hr} />

          <DishOptionsForm
            dish={dish}
            state={state}
            variant="detail"
            idPrefix={`dish-${dish.slug}`}
          />

          <div className={styles.actionbar}>
            <QuantityStepper
              variant="outline"
              size="lg"
              value={state.quantity}
              onChange={state.setQuantity}
              itemName={dish.name}
            />
            <Button
              block
              meta={money.format(state.total)}
              onClick={submit}
              disabled={!state.valid || Boolean(unavailable) || closed}
            >
              {unavailable
                ? t('detail.unavailable')
                : closed
                  ? t('detail.closedNow')
                  : editing
                    ? t('detail.updateItem')
                    : t('detail.addToCart')}
            </Button>
          </div>
        </main>
      </Columns>
      {hero && (
        <Lightbox
          open={photoOpen}
          onClose={() => setPhotoOpen(false)}
          src={hero.src}
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          caption={dish.name}
        />
      )}
    </>
  );
}

/** The banner under an unavailable dish: "Sold out right now — back 8 pm." */
function unavailableNote(t: MenuText, dish: Dish): string {
  const reason = unavailableReason(dish);
  if (reason?.kind === 'unavailable-today') return t('availability.unavailableTodayNote');
  if (reason?.kind === 'back-at')
    return t('availability.soldOutBackAt', { time: reason.time.toLowerCase() });
  return t('availability.soldOutNow');
}
