import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialFollow } from '@/components/service/SocialFollow';
import { GuestSessionProvider } from '@/context/GuestSessionContext';
import { ApiTestProvider, seedGuestSession } from '../apiState';

/*
 * Help › Follow us (components/service/SocialFollow): each profile the restaurant has links to,
 * TikTok among them, opening in a new tab.
 */

describe('SocialFollow', () => {
  it('links to TikTok, in a new tab, with the other profiles', async () => {
    seedGuestSession({ branchId: 'blr-indiranagar', table: 5 });
    render(
      <ApiTestProvider>
        <GuestSessionProvider>
          <SocialFollow />
        </GuestSessionProvider>
      </ApiTestProvider>,
    );
    const tiktok = await screen.findByRole('link', { name: /TikTok/ });
    expect(tiktok.getAttribute('href')).toBe('https://www.tiktok.com/');
    expect(tiktok.getAttribute('target')).toBe('_blank');
    expect(tiktok.getAttribute('rel')).toContain('noopener');
    // In the networks' order: after YouTube, before X.
    const names = screen.getAllByRole('link').map((a) => a.getAttribute('aria-label'));
    expect(names.findIndex((n) => /TikTok/.test(n ?? ''))).toBe(
      names.findIndex((n) => /YouTube/.test(n ?? '')) + 1,
    );
  });
});
