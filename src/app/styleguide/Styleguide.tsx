'use client';

import type { CSSProperties } from 'react';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ICON_NAMES,
  Icon,
  Skeleton,
  StatusPill,
  TablePill,
  Tag,
  Toast,
  VegMark,
} from '@/components/ui';
import { Section } from './Section';
import {
  ButtonsSection,
  DialogsSection,
  InputsSection,
  OptionsSection,
  QuantitySection,
  SearchSection,
} from './StyleguideControls';
import styles from './styleguide.module.css';

const COLOR_TOKENS = [
  'bg',
  'surface',
  'sand',
  'line',
  'line-strong',
  'ink',
  'ink-2',
  'ink-3',
  'brand',
  'brand-600',
  'brand-700',
  'brand-tint',
  'brand-tint-2',
  'veg',
  'nonveg',
  'success',
  'success-tint',
  'error',
  'error-tint',
  'warn',
  'warn-tint',
] as const;

const TYPE_SCALE = [
  ['t-display', 'Display · Newsreader 36/42'],
  ['t-h1', 'Heading 1 · Newsreader 28/34'],
  ['t-h2', 'Heading 2 · Newsreader 22/28'],
  ['t-h3', 'Heading 3 · Manrope 700 17/24'],
  ['t-body', 'Body · Manrope 500 15/22'],
  ['t-small', 'Small · Manrope 500 13/18'],
  ['t-caption', 'Caption · Manrope 700 11/16'],
  ['t-price-lg', '₹1,424'],
] as const;

const noop = () => {};

/** Design-system board (ds01 / ds02). Interactive sections live in StyleguideControls. */
export function Styleguide() {
  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <p className="t-caption c3">The Olive Table · Design system</p>
        <h1 className={styles.title}>Styleguide</h1>
        <p className="t-body c2">
          Tokens and components ported from olive-core.css and olive-web.css. Every control here is
          interactive and keyboard operable.
        </p>
      </header>

      <div className={styles.grid}>
        <Section id="sg-colour" title="Colour tokens" wide>
          <div className={styles.swatches}>
            {COLOR_TOKENS.map((token) => (
              <div key={token} className={styles.swatch}>
                <span
                  className={styles.chipSample}
                  style={{ '--sw': `var(--${token})` } as CSSProperties}
                />
                --{token}
              </div>
            ))}
          </div>
        </Section>

        <Section id="sg-type" title="Type">
          <div className={styles.types}>
            {TYPE_SCALE.map(([cls, label]) => (
              <p key={cls} className={cls}>
                {label}
              </p>
            ))}
          </div>
        </Section>

        <ButtonsSection />
        <InputsSection />
        <SearchSection />

        <Section id="sg-tags" title="Tags · Status · Dietary marks">
          <div className={styles.row}>
            <Tag variant="chef">Chef&apos;s pick</Tag>
            <Tag variant="new">New</Tag>
            <Tag variant="pop">Bestseller</Tag>
            <Tag variant="out">Sold out</Tag>
            <Tag variant="ok">Paid</Tag>
            <Tag variant="warn">Unpaid</Tag>
            <Tag variant="err">Failed</Tag>
            <Tag variant="plain" icon="flame">
              Medium spicy
            </Tag>
          </div>
          <div className={styles.row}>
            <StatusPill status="received" />
            <StatusPill status="preparing" />
            <StatusPill status="ready" />
            <StatusPill status="served" />
            <StatusPill status="cancelled" />
          </div>
          <div className={styles.row}>
            <VegMark veg showLabel />
            <VegMark veg={false} showLabel />
            <VegMark veg />
            <VegMark veg={false} />
            <TablePill table={12} />
            <Badge count={3} label="3 items in cart" />
          </div>
        </Section>

        <QuantitySection />
        <OptionsSection />

        <Section id="sg-feedback" title="Feedback · Toast / Banner / Skeleton">
          <Toast
            toast={{ id: 1, message: 'Paneer Tikka added', actionLabel: 'Undo' }}
            onDismiss={noop}
          />
          <Toast
            toast={{ id: 2, message: "Couldn't update cart", tone: 'error', actionLabel: 'Retry' }}
            onDismiss={noop}
          />
          <Banner tone="info">Info — shared table, combined bills</Banner>
          <Banner tone="warn">Warning — ordering paused for 15 min</Banner>
          <Banner tone="err">Error — you&apos;re offline. Reconnecting…</Banner>
          <Banner tone="ok">Payment received</Banner>
          <div className={styles.skRow} aria-busy="true" aria-label="Loading example">
            <Skeleton shape="block" width={64} height={64} />
            <div className={styles.skLines}>
              <Skeleton shape="title" width="60%" />
              <Skeleton width="90%" />
            </div>
          </div>
        </Section>

        <DialogsSection />

        <Section id="sg-empty" title="Empty state · EmptyState">
          <EmptyState
            icon="bag"
            title="Your cart is empty"
            actions={
              <Button variant="secondary" size="sm" href="#sg-empty">
                Browse menu
              </Button>
            }
          >
            Dishes you add will appear here. Nothing is sent to the kitchen until you check out.
          </EmptyState>
        </Section>

        <Section id="sg-icons" title={`Icons · ${ICON_NAMES.length} · 24px grid, 1.8 stroke`} wide>
          <div className={styles.icons}>
            {ICON_NAMES.map((name) => (
              <div key={name} className={styles.iconCell}>
                <Icon name={name} />
                {name}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
