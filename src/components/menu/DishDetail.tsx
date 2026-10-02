'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Banner,
  Button,
  Icon,
  IconButton,
  QuantityStepper,
  TablePill,
  Tag,
  VegMark,
} from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useCart } from '@/hooks/useCart';
import { useDishConfig } from '@/hooks/useDishConfig';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { getCategory, unavailableLabel } from '@/lib/menu';
import type { CartLine } from '@/types/cart';
import type { Allergen, Dish } from '@/types/menu';
import { Breadcrumbs } from './Breadcrumbs';
import { DishOptionsForm } from './DishOptionsForm';
import styles from './DishDetail.module.css';

const ALLERGEN: Record<Allergen, string> = {
  dairy: 'dairy',
  gluten: 'gluten',
  nuts: 'nuts',
  shellfish: 'shellfish',
  egg: 'egg',
  soy: 'soy',
  sesame: 'sesame',
};

const allergenText = (dish: Dish) => dish.allergens.map((a) => ALLERGEN[a]).join(', ');
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Food detail (06 · w06). `?edit=<line key>` edits an existing cart line.
 * The edit key is read after mount so the page can be prerendered.
 */
export function DishDetail({ dish }: { dish: Dish }) {
  const { lines, hydrated } = useCart();
  const editKey = useQueryParam('edit');

  const editing = editKey && hydrated ? lines.find((l) => l.key === editKey) : undefined;
  return <DishDetailForm key={editing?.key ?? 'new'} dish={dish} editing={editing} />;
}

function DishDetailForm({ dish, editing }: { dish: Dish; editing?: CartLine }) {
  const router = useRouter();
  const table = useTable();
  const { addItem, editLine } = useCart();
  const state = useDishConfig(
    dish,
    editing ? { config: editing, quantity: editing.quantity } : undefined,
  );
  const category = getCategory(dish.categoryId);
  const hero = dish.image;
  const unavailable = unavailableLabel(dish);
  const isChef = dish.tags.includes('chef');
  const allergens = allergenText(dish);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push('/menu/');
  };

  const submit = () => {
    if (!state.valid || unavailable) return;
    if (editing) {
      editLine(editing.key, dish, state.config, state.quantity);
      router.push('/cart/');
    } else {
      addItem(dish, state.config, state.quantity);
      back();
    }
  };

  const vegLabel = (
    <span className={styles.meta}>
      <VegMark veg={dish.veg} showLabel />
    </span>
  );

  return (
    <>
      <SiteHeader showCart />

      {hero ? (
        <div className={cx(styles.hero, 'hide-desktop')}>
          <Image
            className={styles.heroImg}
            src={hero.src}
            alt={hero.alt}
            width={hero.width}
            height={hero.height}
            sizes="100vw"
            priority
          />
          <div className={styles.heroBar}>
            <IconButton icon="back" label="Back to menu" variant="raised" onClick={back} />
            <TablePill table={table} className={styles.heroPill} />
          </div>
        </div>
      ) : (
        <MobileHeader variant="topbar" onBack={back} backLabel="Back to menu" />
      )}

      <Columns even>
        <div className={cx(styles.left, 'hide-mobile')}>
          <Breadcrumbs
            items={[
              { label: 'Menu', href: '/menu/' },
              { label: category?.name ?? '', href: `/menu/${dish.categoryId}/` },
              { label: dish.name },
            ]}
          />
          <div className={styles.media}>
            {hero ? (
              <Image
                className={styles.bigImg}
                src={hero.src}
                alt={hero.alt}
                width={hero.width}
                height={hero.height}
                sizes="50vw"
                priority
              />
            ) : (
              <div className={styles.placeholder}>
                <Icon name="cutlery" size="xl" />
              </div>
            )}
            {isChef && (
              <span className={styles.bigTag}>
                <Tag variant="chef">Chef&apos;s pick</Tag>
              </span>
            )}
          </div>
          <div className={styles.facts}>
            {dish.prepTime && (
              <div className={styles.fact}>
                <span className="t-caption c3">Prep time</span>
                <span className={styles.factValue}>{dish.prepTime}</span>
              </div>
            )}
            {dish.serves && (
              <div className={styles.fact}>
                <span className="t-caption c3">Serves</span>
                <span className={styles.factValue}>
                  {dish.serves} {dish.serves === 1 ? 'person' : 'people'}
                </span>
              </div>
            )}
            <div className={styles.fact}>
              <span className="t-caption c3">Allergens</span>
              <span className={styles.factValue}>
                {allergens ? capitalise(allergens) : 'None listed'}
              </span>
            </div>
          </div>
        </div>

        <main id="main" className={cx(styles.main, hero && styles.overlap)}>
          <section className={styles.intro} aria-labelledby="dish-title">
            <div className={styles.tagRow}>
              {vegLabel}
              {isChef && (
                <span className="hide-desktop">
                  <Tag variant="chef">Chef&apos;s pick</Tag>
                </span>
              )}
            </div>
            <h1 id="dish-title" className={styles.title}>
              {dish.name}
            </h1>
            <p className={cx('t-body c2', styles.desc)}>
              {dish.longDescription ?? dish.description}
            </p>
            <div className={cx(styles.meta, 'hide-desktop')}>
              {dish.prepTime && (
                <span className={styles.metaItem}>
                  <Icon name="clock" size="xs" />
                  {dish.prepTime}
                </span>
              )}
              {dish.serves && (
                <>
                  <span className={styles.dot} aria-hidden="true" />
                  <span>Serves {dish.serves}</span>
                </>
              )}
              {allergens && (
                <>
                  <span className={styles.dot} aria-hidden="true" />
                  <span>Contains {allergens}</span>
                </>
              )}
            </div>
            <span className={styles.price}>
              <span className="hide-mobile">{dish.variants?.length ? 'from ' : ''}</span>
              {formatINR(dish.price)}
            </span>
          </section>

          {unavailable && (
            <Banner tone="warn" icon="clock">
              {dish.availability.status === 'unavailable-today'
                ? 'Unavailable today. Your server can suggest something similar.'
                : `Sold out right now${unavailable.startsWith('Back') ? ` — ${unavailable.toLowerCase()}` : ''}.`}
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
              meta={formatINR(state.total)}
              onClick={submit}
              disabled={!state.valid || Boolean(unavailable)}
            >
              {unavailable ? 'Unavailable' : editing ? 'Update item' : 'Add to cart'}
            </Button>
          </div>
        </main>
      </Columns>
    </>
  );
}
