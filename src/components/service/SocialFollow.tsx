import { Icon, type IconName } from '@/components/ui';
import { useContent, useRestaurant } from '@/api/hooks';
import type { SocialNetwork } from '@/types/restaurant';
import styles from './SocialFollow.module.css';

const NETWORK_ICON: Record<SocialNetwork, IconName> = {
  instagram: 'instagram',
  facebook: 'facebook',
  youtube: 'youtube',
  x: 'xbrand',
};

/** "Follow us": the restaurant's social profiles, each opening in a new tab. */
export function SocialFollow() {
  const restaurant = useRestaurant();
  const t = useContent('service');
  if (restaurant.social.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="follow-us">
      <div className={styles.head}>
        <h2 id="follow-us" className={styles.title}>
          <span className="hide-desktop">{t('social.titleMobile')}</span>
          <span className="hide-mobile">
            {t('social.titleDesktop', { restaurant: restaurant.name })}
          </span>
        </h2>
        <p className={styles.sub}>{t('social.sub')}</p>
      </div>
      <ul className={styles.links}>
        {restaurant.social.map((link) => (
          <li key={link.network}>
            <a
              className={styles.link}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('social.linkLabel', { network: link.label })}
            >
              <span className={styles.icon} aria-hidden="true">
                <Icon name={NETWORK_ICON[link.network]} size="sm" />
              </span>
              <span className={styles.label} aria-hidden="true">
                {link.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
