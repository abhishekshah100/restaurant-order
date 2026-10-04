import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBranch, useContent, useHelpTopics } from '@/api/hooks';
import { fill } from '@/api/translator';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import { TestProviders, seedGuestSession } from '../apiState';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/help/',
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TestProviders>{children}</TestProviders>
);

/** The region words and the global copy that uses them, at the guest's branch. */
function renderCopy() {
  return renderHook(
    () => {
      const region = useRegionCopy();
      const service = useContent('service');
      const common = useContent('common');
      const payment = useHelpTopics().payment.sections.map((s) => fill(s.body, region));
      return {
        branch: useBranch().id,
        region,
        hint: service('billRequest.hint', region),
        cart: common('cart.summaryLabel', { items: '2 items', total: 578, ...region }),
        help: payment.slice(2).join(' '),
      };
    },
    { wrapper },
  );
}

describe('region-neutral copy', () => {
  it('reads exactly as before at the India branch', () => {
    seedGuestSession();
    const { result } = renderCopy();
    expect(result.current.hint).toBe(
      'Your server will bring the printed bill. You can pay by card, UPI or cash.',
    );
    expect(result.current.cart).toBe('Cart, 2 items, 578 rupees');
    expect(result.current.help).toBe(
      'Request the bill and your server will bring it to the table. You can pay by card, UPI or cash. Ask your server for a GST invoice when you request the bill.',
    );
  });

  it('names Nepal’s methods, its VAT invoice and its currency — no UPI or GST', async () => {
    seedGuestSession({ branchId: 'ktm-thamel', table: 5 });
    const { result } = renderCopy();
    await waitFor(() => expect(result.current.branch).toBe('ktm-thamel'));
    expect(result.current.region).toEqual({
      currencyName: 'Nepali rupees',
      taxInvoice: 'VAT invoice',
      paymentMethods: 'card, eSewa, Khalti, Fonepay QR or cash',
    });
    const text = Object.values(result.current).join(' ');
    expect(text).not.toMatch(/UPI|GST/);
  });
});
