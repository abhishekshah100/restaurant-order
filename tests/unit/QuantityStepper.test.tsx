import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuantityStepper } from '@/components/ui';
import { ApiTestProvider } from '../apiState';

/** The UI kit reads its copy (labels) from the content cache. */
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: ApiTestProvider });

function Controlled(props: { initial: number; min?: number; max?: number }) {
  const [value, setValue] = useState(props.initial);
  return (
    <QuantityStepper
      value={value}
      onChange={setValue}
      min={props.min}
      max={props.max}
      itemName="Dahi Kebab"
    />
  );
}

describe('QuantityStepper', () => {
  it('renders the value with labelled buttons', () => {
    render(<Controlled initial={2} />);
    expect(screen.getByRole('group', { name: 'Quantity of Dahi Kebab' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Add one Dahi Kebab' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove one Dahi Kebab' })).toBeEnabled();
  });

  it('increments and decrements', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={1} />);
    await user.click(screen.getByRole('button', { name: /add one/i }));
    await user.click(screen.getByRole('button', { name: /add one/i }));
    expect(screen.getByRole('status')).toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: /remove one/i }));
    expect(screen.getByRole('status')).toHaveTextContent('2');
  });

  it('stops at min (default 1)', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={1} />);
    const minus = screen.getByRole('button', { name: /remove one/i });
    expect(minus).toBeDisabled();
    await user.click(minus);
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });

  it('allows reaching 0 when min is 0 (cart removes the line)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuantityStepper value={1} onChange={onChange} min={0} />);
    await user.click(screen.getByRole('button', { name: 'Remove one' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('stops at max', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={19} max={20} />);
    const plus = screen.getByRole('button', { name: /add one/i });
    await user.click(plus);
    expect(screen.getByRole('status')).toHaveTextContent('20');
    expect(plus).toBeDisabled();
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={1} />);
    await user.tab(); // minus is disabled, so focus lands on plus
    expect(screen.getByRole('button', { name: /add one/i })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('2');
  });
});
