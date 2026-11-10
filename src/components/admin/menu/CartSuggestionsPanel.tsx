'use client';

import { useState } from 'react';
import type { AdminCartSuggestions, CartSuggestion } from '@/api/contracts';
import { useAdminCartSuggestions, useContent } from '@/api/hooks';
import { useSaveCartSuggestions } from '@/api/mutations';
import { Button, Chip, IconButton, Select, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { MenuCatalog } from '@/lib/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AutoRow, GuestsSee, Source } from './SuggestionParts';
import { Icon } from '@/components/ui';
import styles from './SearchSuggestionsDialog.module.css';

/** The most pins (the cart shows three cards). */
const MAX_PINS = 3;

interface Draft {
  enabled: boolean;
  categories: string[];
  pins: string[];
}

const draftOf = (saved: AdminCartSuggestions): Draft => ({
  enabled: saved.enabled,
  categories: saved.categories,
  pins: saved.pins.map((p) => p.slug),
});

/**
 * Admin › Menu › Suggestions › Cart: "Goes well with your order". On or off; the categories its
 * dishes come from; staff's pins (shown first); and a preview — pick a dish, see what a guest with
 * it in the cart is offered, and why.
 */
export function CartSuggestionsPanel({
  menu,
  onClose,
}: {
  menu: MenuCatalog;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const [preview, setPreview] = useState<string>();
  const { data, isError, refetch } = useAdminCartSuggestions(branch.id, preview);

  if (data) {
    return (
      <Editor saved={data} menu={menu} preview={preview} onPreview={setPreview} onClose={onClose} />
    );
  }
  return isError ? (
    <div className={styles.body}>
      <p className={styles.error} role="alert">
        {t('adminMenu.suggestions.loadFailed')}
      </p>
      <Button variant="secondary" onClick={() => void refetch()}>
        {t('adminMenu.suggestions.retry')}
      </Button>
    </div>
  ) : (
    <div className={styles.body}>
      <Skeleton shape="block" height={180} />
      <Skeleton shape="block" height={140} />
    </div>
  );
}

function Editor({
  saved,
  menu,
  preview,
  onPreview,
  onClose,
}: {
  saved: AdminCartSuggestions;
  menu: MenuCatalog;
  preview: string | undefined;
  onPreview: (slug: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSaveCartSuggestions();
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved));
  const [pick, setPick] = useState('');
  const savedDraft = draftOf(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const set = (fields: Partial<Draft>) => setDraft({ ...draft, ...fields });
  const hiddenPins = new Set(saved.pins.filter((p) => !p.showing).map((p) => p.slug));
  const previewDish = saved.preview.dish ? menu.getDish(saved.preview.dish) : undefined;

  const toggleCategory = (id: string) =>
    set({
      categories: draft.categories.includes(id)
        ? draft.categories.filter((c) => c !== id)
        : // Kept in the menu's order.
          menu.categories.map((c) => c.id).filter((c) => c === id || draft.categories.includes(c)),
    });

  const pin = () => {
    if (!pick || draft.pins.length >= MAX_PINS) return;
    set({ pins: [...draft.pins, pick] });
    setPick('');
  };

  const submit = () =>
    save.mutate(
      { branchId: branch.id, body: draft, preview },
      {
        onSuccess: (next) => {
          setDraft(draftOf(next));
          showToast(t('adminMenu.suggestions.saved'), { tone: 'success' });
        },
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
      },
    );

  const sourceText = (item: CartSuggestion) => {
    switch (item.source) {
      case 'pinned':
        return t('adminMenu.suggestions.source.pinned');
      case 'together':
        return t.plural('adminMenu.suggestions.cart.together', item.count ?? 0, {
          dish: item.withName ?? '',
        });
      case 'popular':
        return t.plural('adminMenu.suggestions.source.month', item.count ?? 0);
      default:
        return t('adminMenu.suggestions.cart.fromMenu');
    }
  };

  return (
    <>
      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="cart-suggestions-title">
          <h3 id="cart-suggestions-title" className={styles.heading}>
            <Icon name="bag" size="xs" />
            {t('adminMenu.suggestions.cart.title')}
          </h3>
          <p className={styles.hint}>{t('adminMenu.suggestions.cart.hint')}</p>

          <AutoRow
            label={t('adminMenu.suggestions.cart.enabled')}
            hint={t('adminMenu.suggestions.cart.enabledHint')}
            checked={draft.enabled}
            onChange={(enabled) => set({ enabled })}
          />

          <h4 className={styles.subheading}>{t('adminMenu.suggestions.cart.from')}</h4>
          <p className={styles.hint}>{t('adminMenu.suggestions.cart.fromHint')}</p>
          <div
            className={styles.chips}
            role="group"
            aria-label={t('adminMenu.suggestions.cart.from')}
          >
            {menu.categories.map((c) => (
              <Chip
                key={c.id}
                pressed={draft.categories.includes(c.id)}
                onClick={() => toggleCategory(c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>

          <h4 className={styles.subheading}>{t('adminMenu.suggestions.cart.pins')}</h4>
          {draft.pins.length === 0 ? (
            <p className={styles.empty}>{t('adminMenu.suggestions.trending.noPins')}</p>
          ) : (
            <ul className={styles.list}>
              {draft.pins.map((slug) => {
                const name = menu.getDish(slug)?.name ?? slug;
                return (
                  <li key={slug} className={styles.item}>
                    <Icon name="pin" size="xs" className={styles.pinIcon} />
                    <span className={styles.itemName}>{name}</span>
                    {hiddenPins.has(slug) && (
                      <span className={styles.warn}>
                        {t('adminMenu.suggestions.trending.hiddenPin')}
                      </span>
                    )}
                    <IconButton
                      icon="x"
                      size="sm"
                      label={t('adminMenu.suggestions.trending.unpin', { dish: name })}
                      onClick={() => set({ pins: draft.pins.filter((p) => p !== slug) })}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {draft.pins.length < MAX_PINS ? (
            <div className={styles.addRow}>
              <DishSelect
                id="cart-suggestions-pin"
                label={t('adminMenu.suggestions.trending.pinLabel')}
                placeholder={t('adminMenu.suggestions.trending.pinPlaceholder')}
                menu={menu}
                exclude={draft.pins}
                value={pick}
                onChange={setPick}
              />
              <Button variant="secondary" iconStart="pin" disabled={!pick} onClick={pin}>
                {t('adminMenu.suggestions.trending.pin')}
              </Button>
            </div>
          ) : (
            <p className={styles.empty}>
              {t('adminMenu.suggestions.trending.full', { count: MAX_PINS })}
            </p>
          )}

          <GuestsSee dirty={dirty}>
            <DishSelect
              id="cart-suggestions-preview"
              label={t('adminMenu.suggestions.cart.previewLabel')}
              menu={menu}
              value={saved.preview.dish ?? ''}
              onChange={onPreview}
            />
            {!saved.enabled && (
              <p className={styles.dirty}>{t('adminMenu.suggestions.cart.offNote')}</p>
            )}
            {saved.preview.dishes.length === 0 ? (
              <p className={styles.empty}>{t('adminMenu.suggestions.cart.nothing')}</p>
            ) : (
              <ol className={styles.list}>
                {saved.preview.dishes.map((item) => (
                  <li key={item.slug} className={styles.item}>
                    <span className={styles.itemName}>{item.name}</span>
                    <Source
                      pinned={item.source === 'pinned'}
                      plain={item.source === 'menu'}
                      text={sourceText(item)}
                    />
                  </li>
                ))}
              </ol>
            )}
            {previewDish && (
              <p className={styles.hint}>
                {t('adminMenu.suggestions.cart.previewNote', { dish: previewDish.name })}
              </p>
            )}
          </GuestsSee>
        </section>
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onClose}>
          {t('adminMenu.suggestions.close')}
        </Button>
        <Button iconStart="check" disabled={!dirty} loading={save.isPending} onClick={submit}>
          {t('adminMenu.suggestions.save')}
        </Button>
      </div>
    </>
  );
}

/** A dish from the menu, by category. */
function DishSelect({
  id,
  label,
  placeholder,
  menu,
  exclude = [],
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder?: string;
  menu: MenuCatalog;
  exclude?: readonly string[];
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <Select
      id={id}
      label={label}
      hideLabel={placeholder !== undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {menu.categories.map((c) => {
        const dishes = menu.dishesIn(c.id).filter((d) => !exclude.includes(d.slug));
        return dishes.length === 0 ? null : (
          <optgroup key={c.id} label={c.name}>
            {dishes.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}
