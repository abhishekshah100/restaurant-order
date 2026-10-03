import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { TOAST_MS } from '@/lib/constants';

function Trigger() {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast('Dahi Kebab added', { actionLabel: 'Undo' })}>
      Show
    </button>
  );
}

function setup() {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
  return screen.getByRole('status');
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the toast after its duration', () => {
    setup();
    expect(screen.getByText('Dahi Kebab added')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByText('Dahi Kebab added')).not.toBeInTheDocument();
  });

  it('keeps the toast while hovered and resumes after the pointer leaves', () => {
    const region = setup();
    act(() => vi.advanceTimersByTime(TOAST_MS - 1000));
    fireEvent.pointerEnter(region);
    act(() => vi.advanceTimersByTime(TOAST_MS * 3));
    expect(screen.getByText('Dahi Kebab added')).toBeInTheDocument();

    fireEvent.pointerLeave(region);
    // At least 2s remain once the guest moves away, even if less time was left.
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('Dahi Kebab added')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText('Dahi Kebab added')).not.toBeInTheDocument();
  });

  it('keeps the toast while its Undo button has keyboard focus', () => {
    setup();
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    act(() => vi.advanceTimersByTime(TOAST_MS * 2));
    expect(screen.getByText('Dahi Kebab added')).toBeInTheDocument();
  });
});
