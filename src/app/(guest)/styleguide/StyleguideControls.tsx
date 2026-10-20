'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AddButton,
  Button,
  Chip,
  Dialog,
  IconButton,
  Input,
  OptionGroup,
  OtpInput,
  PhoneInput,
  QuantityStepper,
  SearchField,
  SearchLink,
  Tabs,
  Textarea,
  type DialogPresentation,
} from '@/components/ui';
import { useRegion } from '@/api/hooks';
import type { Money } from '@/lib/money';
import { Section } from './Section';
import styles from './styleguide.module.css';

/** Sample prices are shown in the default branch's currency. */
const portions = (money: Money) => [
  { id: 'half', label: 'Half · 6 pcs', price: money.format(329) },
  { id: 'full', label: 'Full · 10 pcs', price: money.format(549) },
  {
    id: 'family',
    label: 'Family · 16 pcs',
    sub: 'Unavailable',
    price: money.format(849),
    disabled: true,
  },
];

const addOns = (money: Money) => [
  { id: 'cheese', label: 'Extra cheese', price: money.addOnPrice(50, 'Free') },
  { id: 'paneer', label: 'Extra paneer', price: money.addOnPrice(90, 'Free') },
  { id: 'mint', label: 'Mint chutney', price: money.addOnPrice(0, 'Free') },
];

/** Demo "Place order" button: shows the loading state for a moment. */
function LoadingDemoButton() {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        timer.current = window.setTimeout(() => setLoading(false), 1500);
      }}
    >
      {loading ? 'Placing order' : 'Place order'}
    </Button>
  );
}

export function ButtonsSection() {
  const { money } = useRegion();
  return (
    <Section id="sg-buttons" title="Buttons · Button / IconButton">
      <div className={styles.btnGrid}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="dark">Dark</Button>
        <Button disabled>Disabled</Button>
        <LoadingDemoButton />
        <Button size="sm">Small · 40</Button>
        <Button size="sm" variant="secondary" iconStart="pencil">
          Edit
        </Button>
        <Button size="sm" variant="ghost" iconEnd="chev">
          See all 12
        </Button>
      </div>
      <div className={styles.row}>
        <Button block meta={money.format(409)}>
          Add to cart
        </Button>
        <IconButton icon="back" label="Back" variant="raised" />
        <IconButton icon="x" label="Close" variant="soft" />
        <IconButton icon="bell" label="Service" />
      </div>
      <p className="t-small c3">
        Height 52 (primary actions), 40 (inline). Icon buttons 44 × 44. One primary per screen.
      </p>
    </Section>
  );
}

export function InputsSection() {
  const [name, setName] = useState('Ananya Rao');
  const [phone, setPhone] = useState('98765432');
  const [otp, setOtp] = useState('48');
  const [otpError, setOtpError] = useState('482719');
  const { mobile } = useRegion();

  return (
    <Section id="sg-inputs" title="Inputs · Input / PhoneInput / OtpInput">
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
        rules={mobile}
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
    </Section>
  );
}

export function SearchSection() {
  const [query, setQuery] = useState('paneer');
  const [diet, setDiet] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [tab, setTab] = useState('recommended');
  const { money } = useRegion();

  return (
    <Section id="sg-search" title="Search · Chips · Tabs">
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
        <Chip>Under {money.format(400)}</Chip>
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
    </Section>
  );
}

export function QuantitySection() {
  const [qty, setQty] = useState(2);
  const [qtyOutline, setQtyOutline] = useState(1);

  return (
    <Section id="sg-qty" title="Add & quantity · AddButton / QuantityStepper">
      <div className={styles.row}>
        <AddButton itemName="Dahi Kebab" onClick={() => setQty(1)} />
        <QuantityStepper value={qty} onChange={setQty} min={0} itemName="Dahi Kebab" />
        <QuantityStepper
          value={qtyOutline}
          onChange={setQtyOutline}
          variant="outline"
          itemName="Truffle Mushroom Pasta"
        />
        <QuantityStepper value={qtyOutline} onChange={setQtyOutline} variant="outline" size="lg" />
        <AddButton itemName="Chicken Malai Tikka" unavailableLabel="Sold out" />
        <AddButton itemName="Chicken Malai Tikka" unavailableLabel="Sold Out" />
      </div>
      <p className="t-small c3">
        ADD turns into the stepper in place once an item is in the cart. At 1, “−” removes the item
        and shows an Undo toast. Hit area extends to 48 px.
      </p>
    </Section>
  );
}

export function OptionsSection() {
  const [portion, setPortion] = useState<string | undefined>('half');
  const [picked, setPicked] = useState<string[]>(['cheese']);
  const { money } = useRegion();

  return (
    <Section id="sg-opts" title="Variant (radio) · Add-on (checkbox) · OptionGroup">
      <div className={styles.twoCol}>
        <OptionGroup
          id="sg-portion"
          type="radio"
          title="Portion"
          hint="Required"
          value={portion}
          onChange={setPortion}
          choices={portions(money)}
        />
        <OptionGroup
          id="sg-addons"
          type="checkbox"
          title="Add-ons"
          hint="Optional · up to 2"
          max={2}
          value={picked}
          onChange={setPicked}
          choices={addOns(money)}
        />
      </div>
    </Section>
  );
}

export function DialogsSection() {
  const [dialog, setDialog] = useState<DialogPresentation | null>(null);
  const [assist, setAssist] = useState<string | undefined>('waiter');

  return (
    <Section id="sg-dialogs" title="Dialogs · Sheet / Modal / Adaptive / Slide-over">
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
        Focus is trapped inside, Esc or the scrim closes, page scroll is locked and focus returns to
        the trigger.
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
    </Section>
  );
}
