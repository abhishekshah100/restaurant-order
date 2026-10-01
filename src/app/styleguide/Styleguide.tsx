'use client';

import { useState, type CSSProperties } from 'react';
import {
  AddButton,
  Badge,
  Banner,
  Button,
  Chip,
  Dialog,
  EmptyState,
  ICON_NAMES,
  Icon,
  IconButton,
  Input,
  OptionGroup,
  OtpInput,
  PhoneInput,
  QuantityStepper,
  SearchField,
  SearchLink,
  Skeleton,
  StatusPill,
  TablePill,
  Tabs,
  Tag,
  Textarea,
  Toast,
  VegMark,
  type DialogPresentation,
} from '@/components/ui';
import { formatAddOnPrice, formatINR } from '@/lib/format';
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

const PORTIONS = [
  { id: 'half', label: 'Half · 6 pcs', price: formatINR(329) },
  { id: 'full', label: 'Full · 10 pcs', price: formatINR(549) },
  {
    id: 'family',
    label: 'Family · 16 pcs',
    sub: 'Unavailable',
    price: formatINR(849),
    disabled: true,
  },
];

const ADD_ONS = [
  { id: 'cheese', label: 'Extra cheese', price: formatAddOnPrice(50) },
  { id: 'paneer', label: 'Extra paneer', price: formatAddOnPrice(90) },
  { id: 'mint', label: 'Mint chutney', price: formatAddOnPrice(0) },
];

export function Styleguide() {
  const [query, setQuery] = useState('paneer');
  const [diet, setDiet] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [tab, setTab] = useState('recommended');
  const [qty, setQty] = useState(2);
  const [qtyOutline, setQtyOutline] = useState(1);
  const [portion, setPortion] = useState<string | undefined>('half');
  const [addOns, setAddOns] = useState<string[]>(['cheese']);
  const [name, setName] = useState('Ananya Rao');
  const [phone, setPhone] = useState('98765432');
  const [otp, setOtp] = useState('48');
  const [otpError, setOtpError] = useState('482719');
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogPresentation | null>(null);
  const [assist, setAssist] = useState<string | undefined>('waiter');

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
        <section className={`${styles.card} ${styles.wide}`} aria-labelledby="sg-colour">
          <h2 id="sg-colour" className={styles.cardTitle}>
            Colour tokens
          </h2>
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
        </section>

        <section className={styles.card} aria-labelledby="sg-type">
          <h2 id="sg-type" className={styles.cardTitle}>
            Type
          </h2>
          <div className={styles.types}>
            {TYPE_SCALE.map(([cls, label]) => (
              <p key={cls} className={cls}>
                {label}
              </p>
            ))}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="sg-buttons">
          <h2 id="sg-buttons" className={styles.cardTitle}>
            Buttons · Button / IconButton
          </h2>
          <div className={styles.btnGrid}>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="dark">Dark</Button>
            <Button disabled>Disabled</Button>
            <Button
              loading={loading}
              onClick={() => {
                setLoading(true);
                window.setTimeout(() => setLoading(false), 1500);
              }}
            >
              {loading ? 'Placing order' : 'Place order'}
            </Button>
            <Button size="sm">Small · 40</Button>
            <Button size="sm" variant="secondary" iconStart="pencil">
              Edit
            </Button>
            <Button size="sm" variant="ghost" iconEnd="chev">
              See all 12
            </Button>
          </div>
          <div className={styles.row}>
            <Button block meta={formatINR(409)}>
              Add to cart
            </Button>
            <IconButton icon="back" label="Back" variant="raised" />
            <IconButton icon="x" label="Close" variant="soft" />
            <IconButton icon="bell" label="Service" />
          </div>
          <p className="t-small c3">
            Height 52 (primary actions), 40 (inline). Icon buttons 44 × 44. One primary per screen.
          </p>
        </section>

        <section className={styles.card} aria-labelledby="sg-inputs">
          <h2 id="sg-inputs" className={styles.cardTitle}>
            Inputs · Input / PhoneInput / OtpInput
          </h2>
          <div className={styles.twoCol}>
            <Input id="sg-name-empty" label="Default" placeholder="Enter your full name" />
            <Input
              id="sg-name"
              label="Filled"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <Input id="sg-disabled" label="Disabled" value="Table 12" disabled readOnly />
            <Input
              id="sg-error"
              label="Error"
              defaultValue=""
              placeholder="Enter your full name"
              error="Please enter your name"
            />
          </div>
          <PhoneInput
            id="sg-phone"
            label="Mobile number · error"
            value={phone}
            onChange={setPhone}
            error={phone.length === 10 ? undefined : 'Enter a 10-digit mobile number'}
          />
          <div className={styles.twoCol}>
            <OtpInput id="sg-otp" label="OTP · active" value={otp} onChange={setOtp} />
            <OtpInput
              id="sg-otp-err"
              label="OTP · error"
              value={otpError}
              onChange={setOtpError}
              error="That code doesn't match."
            />
          </div>
          <Textarea
            id="sg-note"
            label="Note for the kitchen"
            optional
            placeholder="e.g. Less oil, no onion"
          />
        </section>

        <section className={styles.card} aria-labelledby="sg-search">
          <h2 id="sg-search" className={styles.cardTitle}>
            Search · Chips · Tabs
          </h2>
          <SearchLink href="#sg-search" />
          <SearchField id="sg-search-input" value={query} onChange={setQuery} />
          <div className={styles.row}>
            <Chip pressed={diet === 'all'} onClick={() => setDiet('all')}>
              All
            </Chip>
            <Chip veg pressed={diet === 'veg'} onClick={() => setDiet('veg')}>
              Veg
            </Chip>
            <Chip
              veg={false}
              pressed={diet === 'nonveg'}
              iconEnd={diet === 'nonveg' ? 'x' : undefined}
              onClick={() => setDiet(diet === 'nonveg' ? 'all' : 'nonveg')}
            >
              Non-veg
            </Chip>
            <Chip iconStart="sort" iconEnd="chevd" aria-haspopup="listbox">
              Recommended
            </Chip>
            <Chip>Under ₹400</Chip>
            <Chip count={8}>Starters</Chip>
          </div>
          <Tabs
            label="Example tabs"
            flush
            value={tab}
            onChange={setTab}
            items={[
              { id: 'recommended', label: 'Recommended' },
              { id: 'starters', label: 'Starters' },
              { id: 'mains', label: 'Mains' },
              { id: 'desserts', label: 'Desserts' },
            ]}
          />
        </section>

        <section className={styles.card} aria-labelledby="sg-tags">
          <h2 id="sg-tags" className={styles.cardTitle}>
            Tags · Status · Dietary marks
          </h2>
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
        </section>

        <section className={styles.card} aria-labelledby="sg-qty">
          <h2 id="sg-qty" className={styles.cardTitle}>
            Add &amp; quantity · AddButton / QuantityStepper
          </h2>
          <div className={styles.row}>
            <AddButton itemName="Dahi Kebab" onClick={() => setQty(1)} />
            <QuantityStepper value={qty} onChange={setQty} min={0} itemName="Dahi Kebab" />
            <QuantityStepper
              value={qtyOutline}
              onChange={setQtyOutline}
              variant="outline"
              itemName="Truffle Mushroom Pasta"
            />
            <QuantityStepper
              value={qtyOutline}
              onChange={setQtyOutline}
              variant="outline"
              size="lg"
            />
            <AddButton itemName="Chicken Malai Tikka" unavailableLabel="Sold out" />
            <AddButton itemName="Chicken Malai Tikka" unavailableLabel="Back 8 PM" />
          </div>
          <p className="t-small c3">
            ADD turns into the stepper in place once an item is in the cart. At 1, “−” removes the
            item and shows an Undo toast. Hit area extends to 48 px.
          </p>
        </section>

        <section className={styles.card} aria-labelledby="sg-opts">
          <h2 id="sg-opts" className={styles.cardTitle}>
            Variant (radio) · Add-on (checkbox) · OptionGroup
          </h2>
          <div className={styles.twoCol}>
            <OptionGroup
              id="sg-portion"
              type="radio"
              title="Portion"
              hint="Required"
              value={portion}
              onChange={setPortion}
              choices={PORTIONS}
            />
            <OptionGroup
              id="sg-addons"
              type="checkbox"
              title="Add-ons"
              hint="Optional · up to 2"
              max={2}
              value={addOns}
              onChange={setAddOns}
              choices={ADD_ONS}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="sg-feedback">
          <h2 id="sg-feedback" className={styles.cardTitle}>
            Feedback · Toast / Banner / Skeleton
          </h2>
          <Toast
            toast={{ id: 1, message: 'Paneer Tikka added', actionLabel: 'Undo' }}
            onDismiss={() => {}}
          />
          <Toast
            toast={{ id: 2, message: "Couldn't update cart", tone: 'error', actionLabel: 'Retry' }}
            onDismiss={() => {}}
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
        </section>

        <section className={styles.card} aria-labelledby="sg-dialogs">
          <h2 id="sg-dialogs" className={styles.cardTitle}>
            Dialogs · Sheet / Modal / Adaptive / Slide-over
          </h2>
          <div className={styles.row}>
            <Button size="sm" variant="secondary" onClick={() => setDialog('sheet')}>
              Bottom sheet
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog('modal')}>
              Modal
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog('adaptive')}>
              Adaptive
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog('panel')}>
              Slide-over
            </Button>
          </div>
          <p className="t-small c3">
            Focus is trapped inside, Esc or the scrim closes, page scroll is locked and focus
            returns to the trigger.
          </p>
          <Dialog
            open={dialog !== null}
            onClose={() => setDialog(null)}
            presentation={dialog ?? 'adaptive'}
            title="Need assistance?"
            description="A team member will come to Table 12."
            footer={
              <Button block onClick={() => setDialog(null)}>
                Send request
              </Button>
            }
          >
            <OptionGroup
              id="sg-assist"
              type="radio"
              title="Request type"
              titleClassName="visually-hidden"
              value={assist}
              onChange={setAssist}
              choices={[
                { id: 'waiter', label: 'Call waiter' },
                { id: 'water', label: 'Need water' },
                { id: 'cutlery', label: 'Need cutlery' },
                { id: 'other', label: 'Something else' },
              ]}
            />
          </Dialog>
        </section>

        <section className={styles.card} aria-labelledby="sg-empty">
          <h2 id="sg-empty" className={styles.cardTitle}>
            Empty state · EmptyState
          </h2>
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
        </section>

        <section className={`${styles.card} ${styles.wide}`} aria-labelledby="sg-icons">
          <h2 id="sg-icons" className={styles.cardTitle}>
            Icons · {ICON_NAMES.length} · 24px grid, 1.8 stroke
          </h2>
          <div className={styles.icons}>
            {ICON_NAMES.map((name) => (
              <div key={name} className={styles.iconCell}>
                <Icon name={name} />
                {name}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
