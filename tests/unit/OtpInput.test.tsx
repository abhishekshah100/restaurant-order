import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpInput } from '@/components/ui';
import { ApiTestProvider } from '../apiState';

/** The UI kit reads its copy (labels) from the content cache. */
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: ApiTestProvider });

function Controlled({
  onComplete,
  error,
  initial = '',
}: {
  onComplete?: (v: string) => void;
  error?: string;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <OtpInput id="otp" value={value} onChange={setValue} onComplete={onComplete} error={error} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const boxes = () => screen.getAllByRole('textbox');

describe('OtpInput', () => {
  it('renders six labelled boxes in a named group', () => {
    render(<Controlled />);
    expect(screen.getByRole('group', { name: 'One-time code' })).toBeInTheDocument();
    expect(boxes()).toHaveLength(6);
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('advances focus as digits are typed and fires onComplete', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onComplete={onComplete} />);
    await user.click(boxes()[0]);
    await user.keyboard('1234');
    expect(boxes()[4]).toHaveFocus();
    await user.keyboard('56');
    expect(screen.getByTestId('value')).toHaveTextContent('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('ignores non-digits', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]);
    await user.keyboard('a1b2');
    expect(screen.getByTestId('value')).toHaveTextContent('12');
  });

  it('fills every box from a pasted code', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onComplete={onComplete} />);
    await user.click(boxes()[0]);
    await user.paste('123 456');
    expect(screen.getByTestId('value')).toHaveTextContent('123456');
    expect(boxes().map((b) => (b as HTMLInputElement).value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('handles SMS autofill of the whole code into the first box', () => {
    render(<Controlled />);
    // Autofill sets the whole value at once on the first box.
    fireEvent.change(boxes()[0], { target: { value: '654321' } });
    expect(screen.getByTestId('value')).toHaveTextContent('654321');
  });

  it('replaces an existing code when a full code is autofilled again', () => {
    render(<Controlled initial="111111" />);
    fireEvent.change(boxes()[0], { target: { value: '123456' } });
    expect(screen.getByTestId('value')).toHaveTextContent('123456');
  });

  it('Backspace clears and steps back', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="123" />);
    await user.click(boxes()[3]);
    expect(boxes()[3]).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(screen.getByTestId('value')).toHaveTextContent('12');
    expect(boxes()[2]).toHaveFocus();
  });

  it('keeps entry contiguous: clicking a later empty box focuses the next empty one', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="1" />);
    await user.click(boxes()[5]);
    expect(boxes()[1]).toHaveFocus();
  });

  it('moves with arrow keys', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="123" />);
    await user.click(boxes()[2]);
    await user.keyboard('{ArrowLeft}');
    expect(boxes()[1]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(boxes()[2]).toHaveFocus();
  });

  it('shows the error state and marks boxes invalid', () => {
    render(<Controlled initial="482719" error="That code doesn't match." />);
    expect(screen.getByRole('alert')).toHaveTextContent("That code doesn't match.");
    boxes().forEach((box) => expect(box).toHaveAttribute('aria-invalid', 'true'));
  });
});
