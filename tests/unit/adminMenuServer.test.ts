import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  AdminSignInResponse,
  ApiErrorBody,
  DishResponse,
  ImageUploadResponse,
} from '@/api/contracts';
import { dishForm, dishInputOf } from '@/lib/adminMenu';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { Dish, MenuData } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer } from '../apiState';

/*
 * The menu on the mock server: GET /branches/:id/menu with staff changes on top; a dish sold
 * out (or a size off) refused in orders until it's back; dishes added and edited, checked.
 */

let now = Date.parse('2026-10-15T13:00:00Z'); // 6:30 PM in Bengaluru
const server = createTestServer(() => now);
const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

let admin: Record<string, string>;

beforeEach(async () => {
  now = Date.parse('2026-10-15T13:00:00Z');
  window.localStorage.clear();
  window.sessionStorage.clear();
  const res = await call('POST', 'admin/sessions', {
    identity: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
  });
  admin = { authorization: `Bearer ${(res.body as AdminSignInResponse).token}` };
});

const menu = async () => (await call('GET', 'branches/blr-indiranagar/menu')).body as MenuData;
const dish = async (slug: string) => (await menu()).dishes.find((d) => d.slug === slug) as Dish;
const setAvailability = (slug: string, body: unknown, headers = admin) =>
  call('PATCH', `admin/branches/blr-indiranagar/menu/dishes/${slug}/availability`, body, headers);

async function guest(): Promise<GuestSession> {
  const session = (
    await call('POST', 'sessions', {
      branchId: 'blr-indiranagar',
      mode: 'dineIn',
      table: 5,
    })
  ).body as GuestSession;
  await call('POST', 'otp', { sessionId: session.id, phone: '9876543210' });
  await call('POST', 'otp/verify', { sessionId: session.id, phone: '9876543210', code: '123456' });
  return session;
}

async function order(session: GuestSession, item: Dish, variantId?: string) {
  const config = { ...defaultConfig(item), ...(variantId ? { variantId } : {}) };
  return call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Ananya Rao',
    method: 'counter',
    kitchenNote: '',
    lines: [
      orderLine({ ...config, key: item.slug, quantity: 1, unitPrice: unitPrice(item, config) }),
    ],
    fulfilment: { mode: 'dineIn' },
  });
}

describe('dish availability (mock)', () => {
  it('sold out shows on the menu everyone reads, and orders for it are refused', async () => {
    const kebab = await dish('dahi-kebab');
    const res = await setAvailability('dahi-kebab', {
      availability: { status: 'sold-out', backAt: '8:30 PM' },
    });
    expect(res.status).toBe(200);
    expect((await dish('dahi-kebab')).availability).toEqual({
      status: 'sold-out',
      backAt: '8:30 PM',
    });

    const session = await guest();
    const refused = await order(session, kebab);
    expect(refused.status).toBe(422);
    expect(refused.body).toEqual({ error: 'item_unavailable', items: ['Dahi Kebab'] });

    await setAvailability('dahi-kebab', { availability: { status: 'available' } });
    expect((await order(session, kebab)).status).toBe(201);
  });

  it('switches a size off and back on', async () => {
    const tikka = await dish('paneer-tikka');
    await setAvailability('paneer-tikka', {
      availability: { status: 'available' },
      variants: { full: false },
    });
    expect((await dish('paneer-tikka')).variants?.find((v) => v.id === 'full')?.available).toBe(
      false,
    );
    const session = await guest();
    expect(error(await order(session, tikka, 'full'))).toBe('item_unavailable');
    expect((await order(session, tikka, 'half')).status).toBe(201);

    await setAvailability('paneer-tikka', {
      availability: { status: 'available' },
      variants: { full: true },
    });
    expect((await dish('paneer-tikka')).variants?.find((v) => v.id === 'full')).not.toHaveProperty(
      'available',
    );
  });

  it('refuses an unknown state, size or dish, and needs a staff session', async () => {
    expect((await setAvailability('dahi-kebab', { availability: { status: 'gone' } })).status).toBe(
      400,
    );
    expect(
      (
        await setAvailability('dahi-kebab', {
          availability: { status: 'available' },
          variants: { full: false },
        })
      ).status,
    ).toBe(400);
    expect((await setAvailability('nope', { availability: { status: 'available' } })).status).toBe(
      404,
    );
    expect(
      (await setAvailability('dahi-kebab', { availability: { status: 'available' } }, {})).status,
    ).toBe(401);
  });
});

describe('adding and editing dishes (mock)', () => {
  const create = (body: unknown) =>
    call('POST', 'admin/branches/blr-indiranagar/menu/dishes', body, admin);
  const update = (slug: string, body: unknown) =>
    call('PATCH', `admin/branches/blr-indiranagar/menu/dishes/${slug}`, body, admin);
  const masala = {
    name: 'Masala Dosa',
    description: 'Crisp rice crêpe, potato masala, chutneys.',
    categoryId: 'mains',
    veg: true,
    variants: [
      { name: 'Regular', price: 180 },
      { name: 'Ghee roast', price: 220, available: false },
    ],
    variantLabel: 'Style',
    availability: { status: 'available' },
  };

  it('adds a dish with sizes, last in its category, and guests can order it', async () => {
    const res = await create(masala);
    expect(res.status).toBe(201);
    const added = res.body as DishResponse;
    expect(added).toMatchObject({
      slug: 'masala-dosa',
      price: 180,
      variantLabel: 'Style',
      variants: [
        { id: 'regular', name: 'Regular', price: 180 },
        { id: 'ghee-roast', name: 'Ghee roast', price: 220, available: false },
      ],
    });
    const mains = (await menu()).dishes.filter((d) => d.categoryId === 'mains');
    expect(Math.max(...mains.map((d) => d.rank))).toBe(added.rank);

    const placed = await order(await guest(), added, 'regular');
    expect(placed.status).toBe(201);
    expect((placed.body as Order).items[0]).toMatchObject({ name: 'Masala Dosa', unitPrice: 180 });
    // The same name again gets its own slug.
    expect(((await create(masala)).body as DishResponse).slug).toBe('masala-dosa-2');
  });

  it('saves every dish unchanged when the editor sends it back as it opened', async () => {
    const before = await menu();
    for (const original of before.dishes) {
      const body = dishInputOf(dishForm(original, original.categoryId), original.availability);
      const res = await update(original.slug, body);
      expect(res.status, original.slug).toBe(200);
      const saved = res.body as DishResponse;
      // Choices written as plain names come back as { name }; otherwise nothing changes.
      const choices = (d: Dish) =>
        d.optionGroups?.map((g) => ({
          ...g,
          choices: g.choices.map((c) => (typeof c === 'string' ? { name: c } : c)),
        }));
      expect({ ...saved, optionGroups: choices(saved) }, original.slug).toEqual({
        ...original,
        optionGroups: choices(original),
      });
    }
  });

  it('edits the parts of a dish: a size, a choice price, an add-on, a leave-out', async () => {
    const thali = await dish('veg-thali');
    const form = dishForm(thali, thali.categoryId);
    form.groups[0].choices[0].price = '25';
    form.addOns = [{ key: 'a', name: 'Extra papad', price: '20', onlySizes: [], sizePrices: null }];
    form.removables = [{ key: 'r', name: 'Onion' }];
    form.quickInstructions = ['Jain'];
    const res = await update('veg-thali', dishInputOf(form));
    const saved = res.body as DishResponse;
    expect(saved.optionGroups?.[0].choices[0]).toEqual({ name: 'Dal Makhani', price: 25 });
    expect(saved.optionGroups).toHaveLength(5);
    expect(saved.addOns).toEqual([{ id: 'extra-papad', name: 'Extra papad', price: 20 }]);
    expect(saved.removables).toEqual([{ id: 'onion', name: 'Onion' }]);
    expect(saved.quickInstructions).toEqual(['Jain']);
    expect(saved.combo).toEqual(thali.combo);

    // Taking a part away clears it.
    const cleared = await update('veg-thali', dishInputOf({ ...form, addOns: [], removables: [] }));
    expect(cleared.body as DishResponse).not.toHaveProperty('addOns');
    expect(cleared.body as DishResponse).not.toHaveProperty('removables');
  });

  it('refuses a missing name or price, an unknown category, no size or a size twice', async () => {
    const base = { ...masala, variants: undefined, price: 150 };
    expect((await create({ ...base, name: '  ' })).status).toBe(400);
    expect((await create({ ...base, price: 0 })).status).toBe(400);
    expect((await create({ ...base, categoryId: 'tapas' })).status).toBe(400);
    expect((await create({ ...masala, variants: [] })).status).toBe(400);
    expect(
      (
        await create({
          ...masala,
          variants: [
            { name: 'Bowl', price: 100 },
            { name: 'bowl', price: 120 },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await update('nope', base)).status).toBe(404);
  });
});

describe('removing, reordering, categories, pictures (mock)', () => {
  it('removes a dish from the menu and the curated lists; it can no longer be ordered', async () => {
    const prawns = await dish('chilli-garlic-prawns');
    expect((await menu()).chefsPicks).toContain('chilli-garlic-prawns');
    const res = await call(
      'DELETE',
      'admin/branches/blr-indiranagar/menu/dishes/chilli-garlic-prawns',
      undefined,
      admin,
    );
    expect(res.status).toBe(204);
    const after = await menu();
    expect(after.dishes.some((d) => d.slug === 'chilli-garlic-prawns')).toBe(false);
    expect(after.chefsPicks).not.toContain('chilli-garlic-prawns');
    expect(after.trendingTonight).not.toContain('chilli-garlic-prawns');
    expect(error(await order(await guest(), prawns))).toBe('empty_order');
  });

  it("reorders a category's dishes, exactly those dishes", async () => {
    const starters = (await menu()).dishes.filter((d) => d.categoryId === 'starters');
    const reversed = starters.map((d) => d.slug).reverse();
    const path = 'admin/branches/blr-indiranagar/menu/categories/starters/order';
    expect((await call('PATCH', path, { slugs: reversed }, admin)).status).toBe(200);
    expect(
      (await menu()).dishes.filter((d) => d.categoryId === 'starters').map((d) => d.slug),
    ).toEqual(reversed);
    expect((await call('PATCH', path, { slugs: reversed.slice(1) }, admin)).status).toBe(400);
    expect(
      (
        await call(
          'PATCH',
          'admin/branches/blr-indiranagar/menu/categories/tapas/order',
          { slugs: [] },
          admin,
        )
      ).status,
    ).toBe(404);
  });

  it('renames and reorders the categories, all of them, each once', async () => {
    const { categories } = await menu();
    const next = [...categories].reverse().map((c) => ({
      id: c.id,
      name: c.id === 'starters' ? 'Small plates' : c.name,
      description: c.description,
    }));
    const path = 'admin/branches/blr-indiranagar/menu/categories';
    expect((await call('PATCH', path, { categories: next }, admin)).status).toBe(200);
    const after = await menu();
    expect(after.categories.map((c) => c.id)).toEqual(next.map((c) => c.id));
    expect(after.categories.find((c) => c.id === 'starters')?.name).toBe('Small plates');
    // Dishes follow their category's order.
    expect(after.dishes[0].categoryId).toBe(next[0].id);
    expect((await call('PATCH', path, { categories: next.slice(1) }, admin)).status).toBe(400);
    expect(
      (await call('PATCH', path, { categories: next.map((c) => ({ ...c, name: 'Same' })) }, admin))
        .status,
    ).toBe(400);
  });

  it('takes a picture as a data URL, and puts it on a dish', async () => {
    const path = 'admin/branches/blr-indiranagar/menu/images';
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const res = await call('POST', path, { dataUrl, width: 640, height: 480 }, admin);
    expect(res.status).toBe(201);
    const { image } = res.body as ImageUploadResponse;
    expect(image).toMatchObject({ src: dataUrl, width: 640, height: 480 });
    expect(
      (await call('POST', path, { dataUrl: 'data:text/html,hi', width: 1, height: 1 }, admin))
        .status,
    ).toBe(400);

    const kebab = await dish('dahi-kebab');
    const saved = (
      await call(
        'PATCH',
        'admin/branches/blr-indiranagar/menu/dishes/dahi-kebab',
        { ...dishInputOf(dishForm(kebab, kebab.categoryId)), image },
        admin,
      )
    ).body as DishResponse;
    expect(saved.image).toEqual({ ...image, alt: 'Dahi Kebab' });
    expect(saved.thumb).toEqual(saved.image);
  });
});

describe('coming back on by itself (mock)', () => {
  it('a dish sold out until a time is available again from then', async () => {
    const until = new Date(now + 30 * 60_000).toISOString();
    await setAvailability('dahi-kebab', {
      availability: { status: 'sold-out', backAt: '7:00 PM', until },
    });
    expect((await dish('dahi-kebab')).availability.status).toBe('sold-out');
    now += 31 * 60_000;
    expect((await dish('dahi-kebab')).availability).toEqual({ status: 'available' });
    // A time already passed isn't accepted.
    expect(
      (
        await setAvailability('dahi-kebab', {
          availability: {
            status: 'sold-out',
            backAt: '6:00 PM',
            until: new Date(now - 1).toISOString(),
          },
        })
      ).status,
    ).toBe(400);
  });

  it('a dish off today is back the next day (branch time)', async () => {
    await setAvailability('dahi-kebab', { availability: { status: 'unavailable-today' } });
    expect((await dish('dahi-kebab')).availability).toMatchObject({
      status: 'unavailable-today',
      day: '2026-10-15',
    });
    now = Date.parse('2026-10-15T18:00:00Z'); // 11:30 PM in Bengaluru: still today
    expect((await dish('dahi-kebab')).availability.status).toBe('unavailable-today');
    now = Date.parse('2026-10-15T19:00:00Z'); // 12:30 AM the next day
    expect((await dish('dahi-kebab')).availability).toEqual({ status: 'available' });
  });
});
