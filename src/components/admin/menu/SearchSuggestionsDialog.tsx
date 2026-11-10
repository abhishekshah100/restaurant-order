'use client';

import { useState, type FormEvent } from 'react';
import type { AdminSearchSuggestions } from '@/api/contracts';
import { useAdminSearchSuggestions, useContent } from '@/api/hooks';
import { useSaveSearchSuggestions } from '@/api/mutations';
import { Button, Dialog, Icon, IconButton, Input, Select, Skeleton, Tabs } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { brandName } from '@/lib/branchParts';
import type { MenuCatalog } from '@/lib/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CartSuggestionsPanel } from './CartSuggestionsPanel';
import { AutoRow, GuestsSee, Source } from './SuggestionParts';
import styles from './SearchSuggestionsDialog.module.css';

/** The most of each that guests see (the server checks the same). */
const MAX_PINS = 4;
const MAX_WORDS = 6;
const MAX_WORD_LENGTH = 40;

interface Draft {
  trendingAuto: boolean;
  pins: string[];
  popularAuto: boolean;
  words: string[];
}

const draftOf = (saved: AdminSearchSuggestions): Draft => ({
  trendingAuto: saved.trending.auto,
  pins: saved.trending.pins.map((p) => p.slug),
  popularAuto: saved.popular.auto,
  words: saved.popular.words,
});

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Admin › Menu › Suggestions, two tabs. Search: what guests see on the search screen before they
 * type, and where each one comes from. Cart: "Goes well with your order" (CartSuggestionsPanel).
 * On Search, Staff pin dishes and add their own words (shown first); with
 * "Fill from orders" on, the rest are what's ordered most. "Guests see now" is the saved state.
 */
export function SearchSuggestionsDialog({
  menu,
  onClose,
}: {
  menu: MenuCatalog;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const [tab, setTab] = useState<'search' | 'cart'>('search');
  const { data, isError, refetch } = useAdminSearchSuggestions(branch.id);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="panel"
      className={styles.dialog}
      title={t('adminMenu.suggestions.title')}
      description={t(`adminMenu.suggestions.subtitles.${tab}`)}
    >
      <Tabs
        className={styles.tabs}
        label={t('adminMenu.suggestions.title')}
        value={tab}
        onChange={(id) => setTab(id === 'cart' ? 'cart' : 'search')}
        items={[
          { id: 'search', label: t('adminMenu.suggestions.tabs.search') },
          { id: 'cart', label: t('adminMenu.suggestions.tabs.cart') },
        ]}
      />
      {tab === 'cart' ? (
        <CartSuggestionsPanel menu={menu} onClose={onClose} />
      ) : data ? (
        <Editor saved={data} menu={menu} restaurant={brandName(branch.name)} onClose={onClose} />
      ) : isError ? (
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
      )}
    </Dialog>
  );
}

function Editor({
  saved,
  menu,
  restaurant,
  onClose,
}: {
  saved: AdminSearchSuggestions;
  menu: MenuCatalog;
  restaurant: string;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSaveSearchSuggestions();
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved));
  const [pick, setPick] = useState('');
  const [word, setWord] = useState('');
  const [wordError, setWordError] = useState<string>();
  const dirty = !sameDraft(draft, draftOf(saved));
  const set = (fields: Partial<Draft>) => setDraft({ ...draft, ...fields });
  const hiddenPins = new Set(saved.trending.pins.filter((p) => !p.showing).map((p) => p.slug));

  const pinnable = menu.dishes.filter((d) => !draft.pins.includes(d.slug));
  const pin = () => {
    if (!pick || draft.pins.length >= MAX_PINS) return;
    set({ pins: [...draft.pins, pick] });
    setPick('');
  };

  const addWord = (event: FormEvent) => {
    event.preventDefault();
    const next = word.trim().replace(/\s+/g, ' ');
    if (!next) return;
    if (draft.words.some((w) => w.toLowerCase() === next.toLowerCase())) {
      setWordError(t('adminMenu.suggestions.popular.duplicate'));
      return;
    }
    set({ words: [...draft.words, next] });
    setWord('');
    setWordError(undefined);
  };

  const submit = () =>
    save.mutate(
      {
        branchId: branch.id,
        body: {
          trending: { auto: draft.trendingAuto, pins: draft.pins },
          popular: { auto: draft.popularAuto, words: draft.words },
        },
      },
      {
        onSuccess: (next) => {
          setDraft(draftOf(next));
          showToast(t('adminMenu.suggestions.saved'), { tone: 'success' });
        },
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
      },
    );

  return (
    <>
      <div className={styles.body}>
        {/* ---------- Trending tonight ---------- */}
        <section className={styles.section} aria-labelledby="suggestions-trending">
          <h3 id="suggestions-trending" className={styles.heading}>
            <Icon name="sparkle" size="xs" />
            {t('adminMenu.suggestions.trending.title')}
          </h3>
          <p className={styles.hint}>{t('adminMenu.suggestions.trending.hint')}</p>

          <AutoRow
            label={t('adminMenu.suggestions.trending.auto')}
            hint={t('adminMenu.suggestions.trending.autoHint')}
            checked={draft.trendingAuto}
            onChange={(trendingAuto) => set({ trendingAuto })}
          />

          <h4 className={styles.subheading}>{t('adminMenu.suggestions.trending.pins')}</h4>
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
              <Select
                id="suggestions-pin"
                label={t('adminMenu.suggestions.trending.pinLabel')}
                hideLabel
                value={pick}
                onChange={(event) => setPick(event.target.value)}
              >
                <option value="">{t('adminMenu.suggestions.trending.pinPlaceholder')}</option>
                {menu.categories.map((c) => {
                  const dishes = pinnable.filter((d) => d.categoryId === c.id);
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
            {saved.trending.showing.length === 0 ? (
              <p className={styles.empty}>{t('adminMenu.suggestions.trending.nothing')}</p>
            ) : (
              <ol className={styles.list}>
                {saved.trending.showing.map((item) => (
                  <li key={item.slug} className={styles.item}>
                    <span className={styles.itemName}>{item.name}</span>
                    <Source
                      pinned={item.source === 'pinned'}
                      text={
                        item.source === 'pinned'
                          ? t('adminMenu.suggestions.source.pinned')
                          : t.plural(`adminMenu.suggestions.source.${item.source}`, item.count ?? 0)
                      }
                    />
                  </li>
                ))}
              </ol>
            )}
          </GuestsSee>
        </section>

        {/* ---------- Popular at … ---------- */}
        <section className={styles.section} aria-labelledby="suggestions-popular">
          <h3 id="suggestions-popular" className={styles.heading}>
            <Icon name="flame" size="xs" />
            {t('adminMenu.suggestions.popular.title', { restaurant })}
          </h3>
          <p className={styles.hint}>{t('adminMenu.suggestions.popular.hint')}</p>

          <AutoRow
            label={t('adminMenu.suggestions.popular.auto')}
            hint={t('adminMenu.suggestions.popular.autoHint')}
            checked={draft.popularAuto}
            onChange={(popularAuto) => set({ popularAuto })}
          />

          <h4 className={styles.subheading}>{t('adminMenu.suggestions.popular.words')}</h4>
          {draft.words.length === 0 ? (
            <p className={styles.empty}>{t('adminMenu.suggestions.popular.noWords')}</p>
          ) : (
            <ul className={styles.chips}>
              {draft.words.map((w) => (
                <li key={w} className={styles.chip}>
                  {w}
                  <IconButton
                    icon="x"
                    size="sm"
                    label={t('adminMenu.suggestions.popular.remove', { word: w })}
                    onClick={() => set({ words: draft.words.filter((x) => x !== w) })}
                  />
                </li>
              ))}
            </ul>
          )}
          {draft.words.length < MAX_WORDS ? (
            <form className={styles.addRow} onSubmit={addWord} noValidate>
              <Input
                id="suggestions-word"
                label={t('adminMenu.suggestions.popular.wordLabel')}
                hideLabel
                placeholder={t('adminMenu.suggestions.popular.wordPlaceholder')}
                maxLength={MAX_WORD_LENGTH}
                value={word}
                error={wordError}
                onChange={(event) => {
                  setWord(event.target.value);
                  setWordError(undefined);
                }}
              />
              <Button type="submit" variant="secondary" iconStart="plus" disabled={!word.trim()}>
                {t('adminMenu.suggestions.popular.add')}
              </Button>
            </form>
          ) : (
            <p className={styles.empty}>
              {t('adminMenu.suggestions.popular.full', { count: MAX_WORDS })}
            </p>
          )}

          <GuestsSee dirty={dirty}>
            {saved.popular.showing.length === 0 ? (
              <p className={styles.empty}>{t('adminMenu.suggestions.popular.nothing')}</p>
            ) : (
              <ol className={styles.list}>
                {saved.popular.showing.map((item) => (
                  <li key={item.term} className={styles.item}>
                    <span className={styles.itemName}>{item.term}</span>
                    <Source
                      pinned={item.source === 'word'}
                      text={
                        item.source === 'word'
                          ? t('adminMenu.suggestions.source.word')
                          : t.plural('adminMenu.suggestions.source.month', item.count ?? 0)
                      }
                    />
                  </li>
                ))}
              </ol>
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
