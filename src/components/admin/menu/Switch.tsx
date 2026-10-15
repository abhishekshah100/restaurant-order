import styles from './Switch.module.css';

/** An on/off switch (role="switch"), named by `label`; a 44px tap target. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} aria-hidden="true" />
    </button>
  );
}
