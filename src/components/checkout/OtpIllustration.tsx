import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import styles from './OtpIllustration.module.css';

/** Decorative phone receiving a code by SMS, on a warm glow (OTP step). */
export function OtpIllustration({ className }: { className?: string }) {
  const t = useContent('checkout');
  return (
    <svg
      className={cx(styles.art, className)}
      viewBox="0 0 160 140"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.glow} cx="80" cy="72" r="62" />
      <circle className={styles.glowInner} cx="80" cy="72" r="44" />

      <circle className={styles.dot} cx="22" cy="44" r="3.5" />
      <circle className={styles.dotSoft} cx="138" cy="34" r="4.5" />
      <circle className={styles.dot} cx="142" cy="104" r="3" />
      <circle className={styles.dotSoft} cx="20" cy="108" r="5" />
      <path
        className={styles.spark}
        d="M128 60l2.2 4.8 4.8 2.2-4.8 2.2-2.2 4.8-2.2-4.8-4.8-2.2 4.8-2.2z"
      />
      <path
        className={styles.spark}
        d="M34 76l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z"
      />

      <g transform="rotate(-8 80 74)">
        <rect className={styles.shadow} x="56" y="30" width="50" height="88" rx="11" />
        <rect className={styles.phone} x="54" y="26" width="50" height="88" rx="11" />
        <rect className={styles.screen} x="59.5" y="35" width="39" height="66" rx="5" />
        <rect className={styles.speaker} x="72" y="29.5" width="14" height="2.5" rx="1.25" />
        <circle className={styles.speaker} cx="79" cy="107.5" r="2.4" />
        <text className={styles.code} x="79" y="66" textAnchor="middle">
          {t('verify.illustrationCode')}
        </text>
        <g className={styles.digits}>
          <circle cx="68" cy="78" r="2.2" />
          <circle cx="75" cy="78" r="2.2" />
          <circle cx="82" cy="78" r="2.2" />
          <circle cx="89" cy="78" r="2.2" />
        </g>
      </g>

      <g className={styles.bubble}>
        <path d="M100 30h28a9 9 0 0 1 9 9v12a9 9 0 0 1-9 9h-17l-8 7v-7.4a9 9 0 0 1-7-8.6V39a9 9 0 0 1 9-9z" />
        <g className={styles.bubbleDots}>
          <circle cx="107.5" cy="45" r="2.3" />
          <circle cx="114.5" cy="45" r="2.3" />
          <circle cx="121.5" cy="45" r="2.3" />
        </g>
      </g>
    </svg>
  );
}
