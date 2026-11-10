import { Icon, type IconName } from '@/components/ui';
import { useBranch, useContent, useRestaurant } from '@/api/hooks';
import { useBrandName } from '@/hooks/useBrandName';
import { SOCIAL_NETWORKS, type HelpSocialNetwork, type SocialLinks } from '@/types/branch';
import styles from './SocialFollow.module.css';

const NETWORK_ICON: Record<HelpSocialNetwork, IconName> = {
  instagram: 'instagram',
  facebook: 'facebook',
  youtube: 'youtube',
  x: 'xbrand',
  whatsapp: 'whatsapp',
  googleReviews: 'google',
};

/**
 * "Follow us": the restaurant's profiles (Settings › Help page), each opening in a new tab. A
 * network without a link isn't shown; with none at all, nor is the card. Without the server's
 * links (the mock), restaurant.json's stand in.
 */
export function SocialFollow() {
  const branch = useBranch();
  const restaurant = useRestaurant();
  const brand = useBrandName();
  const t = useContent('service');
  const social: SocialLinks =
    branch.help?.social ??
    Object.fromEntries(restaurant.social.map((link) => [link.network, link.url]));
  const links = SOCIAL_NETWORKS.flatMap((network) => {
    const url = social[network];
    return url ? [{ network, url }] : [];
  });
  if (links.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="follow-us">
      <div className={styles.head}>
        <h2 id="follow-us" className={styles.title}>
          <span className="hide-desktop">{t('social.titleMobile')}</span>
          <span className="hide-mobile">{t('social.titleDesktop', { restaurant: brand })}</span>
        </h2>
        <p className={styles.sub}>{t('social.sub')}</p>
      </div>
      <ul className={styles.links}>
        {links.map(({ network, url }) => {
          const label = t(`social.networks.${network}`);
          return (
            <li key={network}>
              <a
                className={styles.link}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('social.linkLabel', { network: label })}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={NETWORK_ICON[network]} size="sm" />
                </span>
                <span className={styles.label} aria-hidden="true">
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
