import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { ACTION_TOAST_MS, ERROR_TOAST_MS, TOAST_EXIT_MS, TOAST_MS } from '@/lib/constants';
import { ApiTestProvider } from '../apiState';

function Trigger() {
  const { showToast } = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => showToast('Dahi Kebab removed', { actionLabel: 'Undo' })}
      >
        Show
      </button>
      <button type="button" onClick={() => showToast('Saved')}>
        Note
      </button>
      <button type="button" onClick={() => showToast("Couldn't save", { tone: 'error' })}>
        Error
      </button>
    </>
  );
}

function setup(button = 'Show') {
  render(
    <ApiTestProvider>
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    </ApiTestProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: button }));
  return screen.getByRole('status');
}

/** Waits out a toast's time and its fade. */
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides a toast after its time, then its fade: longer with Undo, longest for errors', () => {
    setup();
    expect(screen.getByText('Dahi Kebab removed')).toBeInTheDocument();
    wait(ACTION_TOAST_MS + TOAST_EXIT_MS);
    expect(screen.queryByText('Dahi Kebab removed')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    wait(TOAST_MS - 100);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    wait(100 + TOAST_EXIT_MS);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Error' }));
    wait(ERROR_TOAST_MS - 100);
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
  });

  it('closes with ✕ or a swipe', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    wait(TOAST_EXIT_MS);
    expect(screen.queryByText('Dahi Kebab removed')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    const pill = screen.getByText('Dahi Kebab removed').parentElement as HTMLElement;
    pill.setPointerCapture = () => {};
    fireEvent.pointerDown(pill, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pill, { clientX: 180, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(pill, { clientX: 180, clientY: 100, pointerId: 1 });
    wait(TOAST_EXIT_MS);
    expect(screen.queryByText('Dahi Kebab removed')).not.toBeInTheDocument();
  });

  it('keeps the toast while hovered and resumes after the pointer leaves', () => {
    const region = setup();
    wait(ACTION_TOAST_MS - 1000);
    fireEvent.pointerEnter(region);
    wait(ACTION_TOAST_MS * 3);
    expect(screen.getByText('Dahi Kebab removed')).toBeInTheDocument();

    fireEvent.pointerLeave(region);
    // At least 2s remain once the guest moves away, even if less time was left.
    wait(1500);
    expect(screen.getByText('Dahi Kebab removed')).toBeInTheDocument();
    wait(500 + TOAST_EXIT_MS);
    expect(screen.queryByText('Dahi Kebab removed')).not.toBeInTheDocument();
  });

  it('keeps the toast while its Undo button has keyboard focus', () => {
    setup();
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    wait(ACTION_TOAST_MS * 2);
    expect(screen.getByText('Dahi Kebab removed')).toBeInTheDocument();
  });
});
