import type { MenuData } from '@/types/menu';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type {
  DishInput,
  DishResponse,
  ImageUploadRequest,
  ImageUploadResponse,
  BranchImageUploadResponse,
  SearchSuggestions,
  AdminSearchSuggestions,
  UpdateSearchSuggestionsRequest,
  CartSuggestionsResponse,
  AdminCartSuggestions,
  UpdateCartSuggestionsRequest,
  ReorderDishesRequest,
  SetAvailabilityRequest,
  UpdateCategoriesRequest,
} from '../contracts';
import { bearer, seg } from './shared';

/** The menu: dishes, categories, pictures, suggestions. */
export const menuApi = {
  setDishAvailability: (
    token: string,
    branchId: string,
    slug: string,
    body: SetAvailabilityRequest,
  ) =>
    apiPatch<DishResponse>(
      `admin/branches/${seg(branchId)}/menu/dishes/${seg(slug)}/availability`,
      body,
      bearer(token),
    ),
  createDish: (token: string, branchId: string, body: DishInput) =>
    apiPost<DishResponse>(`admin/branches/${seg(branchId)}/menu/dishes`, body, bearer(token)),
  updateDish: (token: string, branchId: string, slug: string, body: DishInput) =>
    apiPatch<DishResponse>(
      `admin/branches/${seg(branchId)}/menu/dishes/${seg(slug)}`,
      body,
      bearer(token),
    ),
  removeDish: (token: string, branchId: string, slug: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/menu/dishes/${seg(slug)}`, bearer(token)),
  reorderDishes: (
    token: string,
    branchId: string,
    categoryId: string,
    body: ReorderDishesRequest,
  ) =>
    apiPatch<MenuData>(
      `admin/branches/${seg(branchId)}/menu/categories/${seg(categoryId)}/order`,
      body,
      bearer(token),
    ),
  updateCategories: (token: string, branchId: string, body: UpdateCategoriesRequest) =>
    apiPatch<MenuData>(`admin/branches/${seg(branchId)}/menu/categories`, body, bearer(token)),
  /** A new category, last on the menu (drinks: counted as drinks). */
  addCategory: (
    token: string,
    branchId: string,
    body: { name: string; description?: string; drinks?: boolean },
  ) => apiPost<MenuData>(`admin/branches/${seg(branchId)}/menu/categories`, body, bearer(token)),
  /** A category off the menu, its dishes (if any) moved to `moveTo`. */
  removeCategory: (token: string, branchId: string, id: string, moveTo?: string) =>
    apiDelete(
      `admin/branches/${seg(branchId)}/menu/categories/${seg(id)}${moveTo ? `?moveTo=${seg(moveTo)}` : ''}`,
      bearer(token),
    ),
  uploadDishImage: (token: string, branchId: string, body: ImageUploadRequest) =>
    apiPost<ImageUploadResponse>(
      `admin/branches/${seg(branchId)}/menu/images`,
      body,
      bearer(token),
    ),
  uploadBranchImage: (token: string, branchId: string, body: ImageUploadRequest) =>
    apiPost<BranchImageUploadResponse>(
      `admin/branches/${seg(branchId)}/settings/image`,
      body,
      bearer(token),
    ),
  searchSuggestions: (branchId: string) =>
    apiGet<SearchSuggestions>(`branches/${seg(branchId)}/menu/suggestions`),
  adminSearchSuggestions: (token: string, branchId: string) =>
    apiGet<AdminSearchSuggestions>(
      `admin/branches/${seg(branchId)}/menu/suggestions`,
      bearer(token),
    ),
  updateSearchSuggestions: (
    token: string,
    branchId: string,
    body: UpdateSearchSuggestionsRequest,
  ) =>
    apiPatch<AdminSearchSuggestions>(
      `admin/branches/${seg(branchId)}/menu/suggestions`,
      body,
      bearer(token),
    ),
  cartSuggestions: (branchId: string, dishes: readonly string[]) =>
    apiGet<CartSuggestionsResponse>(
      `branches/${seg(branchId)}/menu/cart-suggestions?dishes=${dishes.map(seg).join(',')}`,
    ),
  adminCartSuggestions: (token: string, branchId: string, preview?: string) =>
    apiGet<AdminCartSuggestions>(
      `admin/branches/${seg(branchId)}/menu/cart-suggestions${preview ? `?preview=${seg(preview)}` : ''}`,
      bearer(token),
    ),
  updateCartSuggestions: (
    token: string,
    branchId: string,
    body: UpdateCartSuggestionsRequest,
    preview?: string,
  ) =>
    apiPatch<AdminCartSuggestions>(
      `admin/branches/${seg(branchId)}/menu/cart-suggestions${preview ? `?preview=${seg(preview)}` : ''}`,
      body,
      bearer(token),
    ),
};
