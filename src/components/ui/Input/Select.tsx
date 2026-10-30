'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import { Field, describedBy } from './Field';
import styles from './Input.module.css';

/*
 * The field's own dropdown, not the browser's. A native <select> opens a popup the browser
 * draws outside the page, and Chrome shuts it the moment anything near it moves (a dialog's
 * scroll, a refetch re-rendering the form), which read as "opens and closes at once". This
 * list is part of the page: it stays open until a choice, Esc, Tab or a press elsewhere.
 *
 * The API is a select's: <option> / <optgroup> children, `value`, and `onChange(event)` with
 * `event.target.value`, so screens use it as they would a <select>. Keyboard as the ARIA
 * select-only combobox: focus stays on the field, ↑ ↓ Home End move, Enter / Space choose,
 * typing jumps to an option starting with what's typed.
 */

export interface SelectProps {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  className?: string;
  /** Icon shown inside the field on the left. */
  icon?: IconName;
  /** The chosen option's value ('' or none: the placeholder, if there is one). */
  value?: string | number;
  /** The <option> / <optgroup> elements. */
  children: ReactNode;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

interface Choice {
  value: string;
  label: ReactNode;
  /** For typing to jump to it. */
  text: string;
  disabled: boolean;
  /** The <optgroup> it's in. */
  group?: ReactNode;
}

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };
type GroupProps = { label?: ReactNode; children?: ReactNode };

const textOf = (node: ReactNode): string =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join('')
      : isValidElement<{ children?: ReactNode }>(node)
        ? textOf(node.props.children)
        : '';

function choicesOf(children: ReactNode, group?: ReactNode): Choice[] {
  return Children.toArray(children).flatMap((child): Choice[] => {
    if (!isValidElement(child)) return [];
    if (child.type === 'optgroup') {
      const { label, children: options } = (child as ReactElement<GroupProps>).props;
      return choicesOf(options, label);
    }
    if (child.type !== 'option') return [];
    const { value, disabled, children: label } = (child as ReactElement<OptionProps>).props;
    const text = textOf(label);
    return [{ value: String(value ?? text), label, text, disabled: Boolean(disabled), group }];
  });
}

/** The list's room: under the field, or above it when there's more room there. */
const MAX_LIST = 320;
const GAP = 6;
const EDGE = 8;
/** How long typed letters count as one search. */
const TYPE_AHEAD_MS = 700;

function placeList(field: HTMLElement): CSSProperties {
  const r = field.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - GAP - EDGE;
  const above = r.top - GAP - EDGE;
  const up = below < Math.min(MAX_LIST, 200) && above > below;
  return {
    left: r.left,
    width: r.width,
    maxHeight: Math.min(MAX_LIST, up ? above : below),
    ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
  };
}

export function Select({
  id,
  label,
  optional,
  hint,
  error,
  hideLabel,
  className,
  icon,
  value,
  children,
  onChange,
  disabled,
  required,
  name,
}: SelectProps) {
  const listId = useId();
  const fieldRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<CSSProperties>({});

  const choices = choicesOf(children);
  const current = String(value ?? '');
  const chosen = choices.findIndex((c) => c.value === current);
  const shown = chosen >= 0 ? choices[chosen] : undefined;
  // A disabled option with no value stands for "nothing chosen yet".
  const placeholder = choices.find((c) => c.value === '' && c.disabled);
  const isPlaceholder = !shown || shown === placeholder;
  const pickable = (i: number) => i >= 0 && i < choices.length && !choices[i].disabled;

  const close = useCallback(() => setOpen(false), []);

  const show = () => {
    if (disabled || !fieldRef.current) return;
    setPlace(placeList(fieldRef.current));
    setActive(pickable(chosen) ? chosen : choices.findIndex((c) => !c.disabled));
    setOpen(true);
  };

  const choose = (i: number) => {
    if (!pickable(i)) return;
    setOpen(false);
    fieldRef.current?.focus();
    const next = choices[i].value;
    if (next === current) return;
    const target = { value: next, name } as HTMLSelectElement;
    onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
  };

  // While open: follow the field when the page or a dialog scrolls or resizes, and close on a
  // press anywhere but the field and the list.
  useEffect(() => {
    if (!open) return;
    const follow = () => fieldRef.current && setPlace(placeList(fieldRef.current));
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  // Keep the active option in view, scrolling only the list (never the dialog or page).
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!open || !list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }, [open, active]);

  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < choices.length; i += by) if (pickable(i)) return i;
    return from;
  };
  const first = () => step(-1, 1);
  const last = () => step(choices.length, -1);

  const typeAhead = (key: string) => {
    const now = Date.now();
    const text = (now - typed.current.at < TYPE_AHEAD_MS ? typed.current.text : '') + key;
    typed.current = { text, at: now };
    const from = open ? active : chosen;
    const order = choices.map((_, i) => (from + 1 + i) % choices.length);
    // Typing one letter again moves to the next option starting with it.
    const search = /^(.)\1*$/.test(text) ? text[0] : text;
    const match = order.find(
      (i) => pickable(i) && choices[i].text.trim().toLowerCase().startsWith(search.toLowerCase()),
    );
    if (match === undefined) return;
    if (open) setActive(match);
    else choose(match);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        show();
      } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        typeAhead(key);
      }
      return;
    }
    const move: Record<string, () => number> = {
      ArrowDown: () => step(active, 1),
      ArrowUp: () => step(active, -1),
      Home: first,
      End: last,
      PageDown: () => Array.from({ length: 8 }).reduce<number>((i) => step(i, 1), active),
      PageUp: () => Array.from({ length: 8 }).reduce<number>((i) => step(i, -1), active),
    };
    if (move[key]) {
      event.preventDefault();
      setActive(move[key]());
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (key === 'Escape') {
      // Only the list closes, not the dialog it's in (useOverlay skips handled keys).
      event.preventDefault();
      close();
    } else if (key === 'Tab') {
      close();
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      typeAhead(key);
    }
  };

  return (
    <Field
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <span className={cx(styles.selectWrap, icon && styles.withIcon)}>
        {icon && <Icon name={icon} size="sm" />}
        <button
          ref={fieldRef}
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          disabled={disabled}
          className={cx(
            styles.input,
            styles.select,
            isPlaceholder && styles.selectEmpty,
            Boolean(error) && styles.error,
          )}
          onClick={() => (open ? close() : show())}
          onKeyDown={onKeyDown}
          onBlur={close}
        >
          <span className={styles.selectValue}>{(shown ?? placeholder)?.label}</span>
        </button>
        <Icon
          name="chevd"
          size="sm"
          className={cx(styles.selectChev, open && styles.selectChevOpen)}
        />
        {name && <input type="hidden" name={name} value={current} />}
      </span>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={id}
            className={styles.selectList}
            style={place}
            // Pressing an option keeps focus on the field (so it doesn't blur and close first).
            onMouseDown={(event) => event.preventDefault()}
          >
            {choices.map((c, i) => {
              if (c === placeholder) return null;
              // Each <optgroup>'s name above its first option.
              const heading = c.group && choices[i - 1]?.group !== c.group ? c.group : null;
              return [
                heading && (
                  <li key={`group-${i}`} role="presentation" className={styles.selectGroup}>
                    {heading}
                  </li>
                ),
                <li
                  key={`${i}-${c.value}`}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === chosen}
                  aria-disabled={c.disabled || undefined}
                  className={cx(
                    styles.selectOption,
                    i === active && styles.selectActive,
                    c.group !== undefined && styles.selectInGroup,
                  )}
                  onPointerMove={() => pickable(i) && i !== active && setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span>{c.label}</span>
                  {i === chosen && <Icon name="check" size="sm" />}
                </li>,
              ];
            })}
          </ul>,
          document.body,
        )}
    </Field>
  );
}
