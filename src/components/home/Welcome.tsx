'use client';

import Image from 'next/image';
import { Button, Icon, StatusPill } from '@/components/ui';
import { restaurant } from '@/data/restaurant';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import styles from './Welcome.module.css';

/** Welcome / table confirmation (01 · w01). */
export function Welcome() {
  const table = useTable();
  const open = restaurant.status === 'open';

  const kitchen = (
    <StatusPill status={open ? 'served' : 'cancelled'}>
      {open ? `Kitchen open · until ${restaurant.closesAt}` : 'Kitchen closed'}
    </StatusPill>
  );

  return (
    <div className={styles.page}>
      <div className={cx(styles.hero, 'hide-desktop')}>
        <Image
          className={styles.heroImg}
          src="/images/pasta-hero.jpg"
          alt="Truffle mushroom pasta at The Olive Table"
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

      <div className={cx(styles.panel, 'hide-mobile')}>
        <div className={styles.panelBrand}>
          <Icon name="olive" />
          <span className={cx('t-caption', styles.panelCaption)}>{restaurant.name}</span>
        </div>
        <div className={styles.gallery}>
          <Image
            className={styles.galleryTall}
            src="/images/pasta-hero.jpg"
            alt="Truffle Mushroom Pasta"
            width={780}
            height={540}
            sizes="30vw"
            priority
          />
          <Image
            src="/images/prawns.jpg"
            alt="Chilli Garlic Prawns"
            width={240}
            height={228}
            sizes="25vw"
          />
          <Image
            src="/images/pizza-wide.jpg"
            alt="Wood-fired Margherita"
            width={462}
            height={300}
            sizes="25vw"
          />
        </div>
        <p className={styles.tagline}>{restaurant.tagline}</p>
      </div>

      <main id="main" className={styles.main}>
        <div className={styles.intro}>
          <p className="t-caption c3">Welcome to</p>
          <h1 className={cx('t-display', styles.title)}>{restaurant.name}</h1>
          <p className={cx('t-body c2', styles.lede)}>
            Browse our menu and order directly from your table.
            <span className="hide-mobile"> No app to download.</span>
          </p>
        </div>

        <section className={styles.card} aria-label="Your table">
          <div className={styles.cardIcon}>
            <Icon name="table" />
          </div>
          <div className={styles.cardText}>
            <span className="t-caption c3">You&apos;re seated at</span>
            <span className={styles.tableNo}>Table {table}</span>
            <span className="t-small c2">{restaurant.tableLocation}</span>
          </div>
        </section>

        <div className={cx(styles.statusRow, 'hide-desktop')}>{kitchen}</div>

        <div className={cx(styles.actions, 'hide-mobile')}>
          <Button href="/menu/" block iconEnd="arrow">
            View menu
          </Button>
          <p className={cx('t-small c2', styles.note)}>
            <Icon name="user" size="xs" />
            Others at Table {table} can scan the same code and order from their own phones.
          </p>
        </div>

        <div className={cx(styles.footRow, 'hide-mobile')}>
          {kitchen}
          <span className={cx('t-small c2', styles.footNote)}>
            <Icon name="bell" size="xs" />
            Staff on call at your table
          </span>
        </div>
      </main>

      <div className={cx(styles.actions, 'hide-desktop')}>
        <Button href="/menu/" block iconEnd="arrow">
          View menu
        </Button>
        <p className={cx('t-small c2', styles.note)}>
          <Icon name="user" size="xs" />
          Others at Table {table} can scan the same code to order.
        </p>
      </div>
    </div>
  );
}
