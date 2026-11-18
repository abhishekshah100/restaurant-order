import type { Branch, HelpSocialNetwork, SocialLinks } from '@/types/branch';
import { SOCIAL_NETWORKS } from '@/types/branch';
import type { HelpSettings } from '@/types/branchSettings';
import type { SettingsError } from './shared';

/* ---------- Help page ---------- */

export const HELP_LIMITS = {
  wifiName: 40,
  /** WPA allows 63 characters. */
  wifiPassword: 63,
  socialUrl: 300,
  faqs: 20,
  faqQuestion: 120,
  faqAnswer: 1000,
} as const;

/** The sites each network's links may be on (as the server checks). */
const SOCIAL_HOSTS: Record<HelpSocialNetwork, readonly string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  x: ['x.com', 'twitter.com'],
  whatsapp: ['wa.me', 'whatsapp.com', 'api.whatsapp.com', 'chat.whatsapp.com'],
  googleReviews: ['g.page', 'goo.gl', 'maps.app.goo.gl', 'google.com', 'search.google.com'],
};

/** A link as typed, with "https://" when it was left off ("" stays ""). */
export const withHttps = (url: string) => {
  const v = url.trim();
  return !v || /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

/** Whether a link is an https address on the network's own site. */
export function isSocialUrl(network: HelpSocialNetwork, url: string): boolean {
  if (url.length > HELP_LIMITS.socialUrl) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www|m)\./, '');
    return (
      parsed.protocol === 'https:' &&
      SOCIAL_HOSTS[network].some((h) => host === h || host.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

export function helpErrors(h: HelpSettings): SettingsError[] {
  const errors: SettingsError[] = [];
  if (h.wifiName.trim().length > HELP_LIMITS.wifiName) errors.push('wifiLong');
  if (h.wifiPassword.trim().length > HELP_LIMITS.wifiPassword) errors.push('wifiPasswordLong');
  for (const network of SOCIAL_NETWORKS) {
    const url = withHttps(h.social[network] ?? '');
    if (url && !isSocialUrl(network, url)) errors.push(`${network}Url`);
  }
  // A question and answer both left empty is dropped on saving; half-filled ones aren't.
  const faqs = h.faqs.filter((f) => f.question.trim() || f.answer.trim());
  if (faqs.length > HELP_LIMITS.faqs) errors.push('tooManyFaqs');
  if (faqs.some((f) => !f.question.trim() || f.question.trim().length > HELP_LIMITS.faqQuestion)) {
    errors.push('faqQuestion');
  }
  if (faqs.some((f) => !f.answer.trim() || f.answer.trim().length > HELP_LIMITS.faqAnswer)) {
    errors.push('faqAnswer');
  }
  return errors;
}

/** MOCK: the branch with its Help page saved (links, questions, Wi-Fi), tidied as the server does. */
export function withHelp(branch: Branch, h: HelpSettings): Branch {
  const social: SocialLinks = {};
  for (const network of SOCIAL_NETWORKS) {
    const url = withHttps(h.social[network] ?? '');
    if (url) social[network] = url;
  }
  return {
    ...branch,
    wifiName: h.wifiName.trim(),
    wifiPassword: h.wifiPassword.trim(),
    help: {
      social,
      faqs: h.faqs
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
        .filter((f) => f.question || f.answer),
    },
  };
}
