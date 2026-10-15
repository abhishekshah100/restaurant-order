'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useContent } from '@/api/hooks';
import { useUploadDishImage } from '@/api/mutations';
import { Button, Chip, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { DishForm } from '@/lib/adminMenu';
import { resizeImage } from '@/lib/imageResize';
import type { MenuCatalog } from '@/lib/menu';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { EditorSection } from './EditorSection';
import styles from './Editor.module.css';

/** Name, short description, category, veg or not, and the picture. */
export function BasicsSection({
  form,
  set,
  menu,
  nameError,
}: {
  form: DishForm;
  set: (fields: Partial<DishForm>) => void;
  menu: MenuCatalog;
  nameError?: string;
}) {
  const t = useContent('common');
  return (
    <EditorSection title={t('adminMenu.editor.sections.basics')} defaultOpen>
      <Input
        id="dish-name"
        label={t('adminMenu.editor.name')}
        placeholder={t('adminMenu.editor.namePlaceholder')}
        value={form.name}
        maxLength={60}
        error={nameError}
        onChange={(event) => set({ name: event.target.value })}
      />
      <Textarea
        id="dish-description"
        label={t('adminMenu.editor.description')}
        optional
        rows={2}
        maxLength={200}
        placeholder={t('adminMenu.editor.descriptionPlaceholder')}
        value={form.description}
        onChange={(event) => set({ description: event.target.value })}
      />
      <div className={styles.twoUp}>
        <Select
          id="dish-category"
          label={t('adminMenu.editor.category')}
          value={form.categoryId}
          onChange={(event) =>
            set({ categoryId: menu.getCategory(event.target.value)?.id ?? form.categoryId })
          }
        >
          {menu.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('adminMenu.editor.type')}</legend>
          <div className={styles.chips}>
            <Chip veg pressed={form.veg} onClick={() => set({ veg: true })}>
              {t('adminMenu.editor.veg')}
            </Chip>
            <Chip veg={false} pressed={!form.veg} onClick={() => set({ veg: false })}>
              {t('adminMenu.editor.nonVeg')}
            </Chip>
          </div>
        </fieldset>
      </div>
      <PictureField form={form} set={set} />
    </EditorSection>
  );
}

/** The dish's picture: add one (resized in the browser, then uploaded), replace or remove it. */
function PictureField({ form, set }: { form: DishForm; set: (fields: Partial<DishForm>) => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const upload = useUploadDishImage();
  const input = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      const { image } = await upload.mutateAsync({ branchId: branch.id, body: resized });
      set({ image });
    } catch {
      showToast(t('adminMenu.editor.uploadFailed'), { tone: 'error' });
    }
  };

  return (
    <div className={styles.picture}>
      <span className={styles.legend}>{t('adminMenu.editor.picture')}</span>
      <div className={styles.pictureRow}>
        <span className={styles.preview}>
          {form.image && (
            <Image
              src={form.image.src}
              alt={t('adminMenu.editor.pictureAlt', { dish: form.name })}
              width={form.image.width}
              height={form.image.height}
              className={styles.previewImg}
              sizes="96px"
            />
          )}
        </span>
        <div className={styles.pictureActions}>
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {form.image ? t('adminMenu.editor.replace') : t('adminMenu.editor.upload')}
          </Button>
          {form.image && (
            <Button
              size="sm"
              variant="ghost"
              iconStart="trash"
              onClick={() => set({ image: null })}
            >
              {t('adminMenu.editor.removePicture')}
            </Button>
          )}
          <p className={styles.hint}>{t('adminMenu.editor.pictureHint')}</p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
