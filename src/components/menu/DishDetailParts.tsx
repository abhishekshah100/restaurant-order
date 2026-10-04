import Image from 'next/image';
import type { ReactNode } from 'react';
import { Icon, IconButton, Tag, VegMark } from '@/components/ui';
import { VisitPill } from '@/components/layout/VisitPill';
import { cx } from '@/lib/cx';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { startingPrice } from '@/lib/menu';
import type { Allergen, Dish, DishImage } from '@/types/menu';
import { Breadcrumbs } from './Breadcrumbs';
import { tagLabel, type MenuText } from './dishTag';
import styles from './DishDetail.module.css';

/** "Dairy, gluten" — or an empty string when the dish lists no allergens. */
function allergenText(t: MenuText, dish: Dish): string {
  const text = dish.allergens.map((a: Allergen) => t(`allergens.${a}`)).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const isChef = (dish: Dish) => dish.tags.includes('chef');

/** Mobile photo with the back button and table (or order mode) pill on top (06). */
export function DishHero({
  dish,
  hero,
  onBack,
  onZoom,
}: {
  dish: Dish;
  hero: DishImage;
  onBack: () => void;
  onZoom: () => void;
}) {
  const t = useContent('menu');
  return (
    <div className={cx(styles.hero, 'hide-desktop')}>
      <button
        type="button"
        className={styles.zoomBtn}
        onClick={onZoom}
        aria-label={t('detail.viewPhotoOf', { dish: dish.name })}
      >
        <Image
          className={styles.heroImg}
          src={hero.src}
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          sizes="100vw"
          priority
        />
        <span className={cx(styles.zoomHint, styles.zoomHintMobile)} aria-hidden="true">
          <Icon name="search" size="xs" />
          {t('detail.viewPhoto')}
        </span>
      </button>
      <div className={styles.heroBar}>
        <IconButton icon="back" label={t('nav.backToMenu')} variant="raised" onClick={onBack} />
        <VisitPill className={styles.heroPill} />
      </div>
    </div>
  );
}

/** Desktop left column: breadcrumbs, then the photo and fact tiles that stick while options scroll (w06). */
export function DishMediaColumn({ dish, onZoom }: { dish: Dish; onZoom: () => void }) {
  const menu = useMenu();
  const t = useContent('menu');
  const category = menu.getCategory(dish.categoryId);
  const hero = dish.image;
  const allergens = allergenText(t, dish);
  return (
    <div className={cx(styles.left, 'hide-mobile')}>
      <Breadcrumbs
        items={[
          { label: t('nav.menu'), href: '/menu/' },
          { label: category?.name ?? '', href: `/menu/${dish.categoryId}/` },
          { label: dish.name },
        ]}
      />
      {/* Photo + facts stay in view while the options column scrolls */}
      <div className={styles.leftSticky}>
        <div className={styles.media}>
          {hero ? (
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={onZoom}
              aria-label={t('detail.viewPhotoOf', { dish: dish.name })}
            >
              <Image
                className={styles.bigImg}
                src={hero.src}
                alt={hero.alt}
                width={hero.width}
                height={hero.height}
                sizes="50vw"
                priority
              />
              <span className={styles.zoomHint} aria-hidden="true">
                <Icon name="search" size="xs" />
                {t('detail.viewPhoto')}
              </span>
            </button>
          ) : (
            <div className={styles.placeholder}>
              <Icon name="cutlery" size="xl" />
            </div>
          )}
          {isChef(dish) && (
            <span className={styles.bigTag}>
              <Tag variant="chef">{tagLabel(t, 'chef')}</Tag>
            </span>
          )}
        </div>
        <div className={styles.facts}>
          {dish.prepTime && <Fact label={t('detail.prepTime')}>{dish.prepTime}</Fact>}
          {dish.serves && (
            <Fact label={t('detail.serves')}>{t.plural('detail.servesPeople', dish.serves)}</Fact>
          )}
          <Fact label={t('detail.allergens')}>{allergens || t('detail.noAllergens')}</Fact>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <span className="t-caption c3">{label}</span>
      <span className={styles.factValue}>{children}</span>
    </div>
  );
}

/** Veg mark, name, description, mobile detail chips and the starting price. */
export function DishIntro({ dish }: { dish: Dish }) {
  const t = useContent('menu');
  const { money } = useRegion();
  const allergens = allergenText(t, dish);
  return (
    <section className={styles.intro} aria-labelledby="dish-title">
      <div className={styles.tagRow}>
        <span className={styles.meta}>
          <VegMark veg={dish.veg} showLabel />
        </span>
        {isChef(dish) && (
          <span className="hide-desktop">
            <Tag variant="chef">{tagLabel(t, 'chef')}</Tag>
          </span>
        )}
      </div>
      <h1 id="dish-title" className={styles.title}>
        {dish.name}
      </h1>
      <p className={cx('t-body c2', styles.desc)}>{dish.longDescription ?? dish.description}</p>
      <ul className={cx(styles.chips, 'hide-desktop')} aria-label={t('detail.facts')}>
        {dish.prepTime && (
          <li className={styles.chip}>
            <Icon name="clock" size="xs" />
            {dish.prepTime}
          </li>
        )}
        {dish.serves && (
          <li className={styles.chip}>
            <Icon name="user" size="xs" />
            {t('detail.servesChip', { count: dish.serves })}
          </li>
        )}
        {allergens && (
          <li className={styles.chip}>
            <Icon name="info" size="xs" />
            {allergens}
          </li>
        )}
      </ul>
      <p className={styles.price}>
        {(dish.variants?.length ?? 0) > 1 && (
          <span className={styles.from}>{t('detail.from')}</span>
        )}
        {money.format(startingPrice(dish))}
      </p>
    </section>
  );
}
