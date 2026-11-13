'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { SETUP_STEPS, type SetupState, type SetupStep } from '@/lib/inventorySetup';
import type { Ingredient, IngredientCategory, StockItem } from '@/types/inventory';
import { IngredientsStep } from './IngredientsStep';
import { LevelsStep } from './LevelsStep';
import { OpeningStep } from './OpeningStep';
import styles from './Setup.module.css';

/**
 * Inventory › Get started: what inventory does in a line, how far along the branch is, and the
 * four steps (any can be opened; the first not done is open). ① ingredients and ② what you have
 * now are needed; ③ warnings and ④ recipes can be skipped. Once all four are done or skipped it
 * says so and goes to Today.
 */
export function InventorySetup({
  state,
  items,
  ingredients,
  categories,
  initialStep,
  onSkip,
  onRecipes,
  onFinish,
  onActive,
}: {
  state: SetupState;
  items: readonly StockItem[];
  ingredients: readonly Ingredient[];
  categories: readonly IngredientCategory[];
  initialStep?: SetupStep;
  onSkip: (step: SetupStep) => void;
  /** Opens Recipes (step ④). */
  onRecipes: () => void;
  onFinish: () => void;
  /** Someone moved between steps: stay in the guide even once it's no longer needed. */
  onActive: () => void;
}) {
  const t = useContent('common');
  const [chosen, choose] = useState<SetupStep | null>(initialStep ?? null);
  const setChosen = (step: SetupStep | null) => {
    onActive();
    choose(step);
  };
  const open = chosen ?? state.current;
  const next = (from: SetupStep) => {
    const after = SETUP_STEPS.slice(SETUP_STEPS.indexOf(from) + 1);
    setChosen(after.find((s) => state.steps[s] === 'todo') ?? null);
  };
  const skip = (step: SetupStep) => {
    onSkip(step);
    next(step);
  };

  const body = (step: SetupStep) => {
    switch (step) {
      case 'ingredients':
        return (
          <IngredientsStep
            ingredients={ingredients}
            categories={categories}
            onDone={() => setChosen('opening')}
          />
        );
      case 'opening':
        return (
          <OpeningStep items={items} categories={categories} onDone={() => setChosen('levels')} />
        );
      case 'levels':
        return (
          <LevelsStep
            items={items}
            onDone={() => setChosen('recipes')}
            onSkip={() => skip('levels')}
          />
        );
      case 'recipes':
        return (
          <div className={styles.stepBody}>
            <p className={styles.lead}>{t('adminInventory.setup.recipes.body')}</p>
            <p className={styles.note}>
              <Icon name="info" size="xs" />
              {t('adminInventory.setup.recipes.optional')}
            </p>
            <div className={styles.footer}>
              <span className={styles.footerNote}>
                {t('adminInventory.setup.recipes.linked', {
                  count: state.withRecipe,
                  total: state.dishes,
                })}
              </span>
              <div className={styles.footerActions}>
                <Button variant="ghost" onClick={() => skip('recipes')}>
                  {t('adminInventory.setup.skip')}
                </Button>
                <Button iconEnd="arrow" onClick={onRecipes}>
                  {t('adminInventory.setup.recipes.go')}
                </Button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={styles.setup}>
      <header className={styles.hero}>
        <span className={styles.heroIcon} aria-hidden="true">
          <Icon name="bag" size="md" />
        </span>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>{t('adminInventory.setup.title')}</h2>
          <p>{t('adminInventory.setup.intro')}</p>
        </div>
        <div className={styles.progress}>
          <span className={styles.progressLabel}>
            {t('adminInventory.setup.progress', { done: state.finished })}
          </span>
          <span className={styles.progressBar} aria-hidden="true">
            <span style={{ width: `${(state.finished / SETUP_STEPS.length) * 100}%` }} />
          </span>
        </div>
      </header>

      {open === null ? (
        <section className={cx(styles.step, styles.stepOpen)}>
          <div className={styles.ready}>
            <span className={styles.readyIcon} aria-hidden="true">
              <Icon name="checkc" size="md" />
            </span>
            <h3 className={styles.stepTitle}>{t('adminInventory.setup.doneTitle')}</h3>
            <p className={styles.lead}>{t('adminInventory.setup.doneBody')}</p>
            <Button iconEnd="arrow" onClick={onFinish}>
              {t('adminInventory.setup.goToday')}
            </Button>
          </div>
        </section>
      ) : null}

      <ol className={styles.steps}>
        {SETUP_STEPS.map((step, index) => {
          const status = state.steps[step];
          const isOpen = open === step;
          return (
            <li key={step} className={cx(styles.step, isOpen && styles.stepOpen)}>
              <button
                type="button"
                className={styles.stepHead}
                aria-expanded={isOpen}
                onClick={() => setChosen(isOpen ? null : step)}
              >
                <span
                  className={cx(
                    styles.stepNumber,
                    status === 'done' && styles.stepNumberDone,
                    isOpen && styles.stepNumberOpen,
                  )}
                  aria-hidden="true"
                >
                  {status === 'done' ? <Icon name="check" size="xs" /> : index + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>
                    {t(`adminInventory.setup.steps.${step}.title`)}
                  </span>
                  <span className={styles.stepShort}>
                    {t(`adminInventory.setup.steps.${step}.short`)}
                  </span>
                </span>
                {status !== 'todo' && (
                  <span
                    className={cx(
                      styles.stepChip,
                      status === 'done' ? styles.chipDone : styles.chipSkipped,
                    )}
                  >
                    {status === 'done'
                      ? t('adminInventory.setup.done')
                      : t('adminInventory.setup.skipped')}
                  </span>
                )}
                <Icon name={isOpen ? 'chevd' : 'chev'} size="xs" />
              </button>
              {isOpen && body(step)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
