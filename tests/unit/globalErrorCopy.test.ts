import { describe, expect, it } from 'vitest';
import common from '../../public/api/content/common.json';
import copy from '../../src/app/global-error-copy.json';

describe('global-error copy', () => {
  it('is common › error word for word (global-error bundles only this part)', () => {
    expect(copy).toEqual({ error: common.error });
  });
});
