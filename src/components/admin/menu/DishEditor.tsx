'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useRemoveDish, useSaveDish } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  dishForm,
  dishFormErrors,
  dishInputOf,
  type DishForm,
  type DishFormError,
} from '@/lib/adminMenu';
import type { MenuCatalog } from '@/lib/menu';
import type { CategoryId, Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AddOnsSection } from './editor/AddOnsSection';
import { BasicsSection } from './editor/BasicsSection';
import { ChoicesSection } from './editor/ChoicesSection';
import { DetailsSection } from './editor/DetailsSection';
import { LeaveOutSection } from './editor/LeaveOutSection';
import { PriceSection } from './editor/PriceSection';
import styles from './editor/Editor.module.css';

/**
 * Adding a dish, or editing one: the basics (name, description, category, veg, picture) and the
 * price or sizes always open; choices, extras, what guests can leave out and details are "+ Add"
 * buttons until a dish uses them. Whether it's available is set from the Menu list (the dish's
 * switch), so it's not here. Problems show when saving, in the section they're in. An existing
 * dish can be removed from the menu.
 */
export function DishEditor({
  menu,
  dish,
  category,
  onClose,
}: {
  menu: MenuCatalog;
  /** The dish to edit; a new dish without it. */
  dish?: Dish;
  /** A new dish's category to start with. */
  category: CategoryId;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const saveDish = useSaveDish();
  const [form, setForm] = useState<DishForm>(() => dishForm(dish, category));
  const [tried, setTried] = useState(false);
  const [removing, setRemoving] = useState(false);
  const errors = tried ? dishFormErrors(form) : [];
  const set = (fields: Partial<DishForm>) => setForm((current) => ({ ...current, ...fields }));
  const message = (error: DishFormError) =>
    errors.includes(error) ? t(`adminMenu.editor.errors.${error}`) : undefined;

  const submit = () => {
    setTried(true);
    if (dishFormErrors(form).length > 0) {
      showToast(t('adminMenu.editor.errors.fix'), { tone: 'error' });
      return;
    }
    saveDish.mutate(
      { branchId: branch.id, slug: dish?.slug, body: dishInputOf(form, dish?.availability) },
      {
        onSuccess: (saved) => {
          showToast(
            dish
              ? t('adminMenu.editor.saved', { dish: saved.name })
              : t('adminMenu.editor.added', { dish: saved.name }),
            { tone: 'success' },
          );
          onClose();
        },
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        presentation="panel"
        className={styles.editor}
        title={
          dish
            ? t('adminMenu.editor.titleEdit', { dish: dish.name })
            : t('adminMenu.editor.titleNew')
        }
        footer={
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onClose}>
              {t('adminMenu.editor.cancel')}
            </Button>
            <Button iconStart="check" loading={saveDish.isPending} onClick={submit}>
              {dish ? t('adminMenu.editor.save') : t('adminMenu.editor.add')}
            </Button>
          </div>
        }
      >
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <BasicsSection form={form} set={set} menu={menu} nameError={message('name')} />
          <PriceSection
            form={form}
            set={set}
            error={message('price') ?? message('sizes') ?? message('sizeNames')}
          />
          <ChoicesSection form={form} set={set} error={message('groups')} />
          <AddOnsSection form={form} set={set} error={message('addOns') ?? message('maxAddOns')} />
          <LeaveOutSection form={form} set={set} error={message('removables')} />
          <DetailsSection
            form={form}
            set={set}
            errors={{
              meal: message('meal'),
              serves: message('serves'),
              prepTime: message('prepTime'),
            }}
          />
          {dish && (
            <Button
              variant="ghost"
              iconStart="trash"
              className={styles.remove}
              onClick={() => setRemoving(true)}
            >
              {t('adminMenu.editor.remove')}
            </Button>
          )}
        </form>
      </Dialog>
      {dish && removing && (
        <RemoveDishDialog dish={dish} onCancel={() => setRemoving(false)} onRemoved={onClose} />
      )}
    </>
  );
}

/** "Remove Paneer Tikka?": off the menu for every guest; orders that have it aren't changed. */
function RemoveDishDialog({
  dish,
  onCancel,
  onRemoved,
}: {
  dish: Dish;
  onCancel: () => void;
  onRemoved: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const remove = useRemoveDish();
  return (
    <Dialog
      open
      onClose={onCancel}
      presentation="adaptive"
      title={t('adminMenu.editor.removeTitle', { dish: dish.name })}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            {t('adminMenu.editor.removeKeep')}
          </Button>
          <Button
            iconStart="trash"
            className={styles.danger}
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(
                { branchId: branch.id, slug: dish.slug },
                {
                  onSuccess: () => {
                    showToast(t('adminMenu.editor.removed', { dish: dish.name }));
                    onRemoved();
                  },
                  onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
                },
              )
            }
          >
            {t('adminMenu.editor.removeConfirm')}
          </Button>
        </div>
      }
    >
      <p className={styles.confirm}>{t('adminMenu.editor.removeBody')}</p>
    </Dialog>
  );
}
