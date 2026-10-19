import type { CountryCodeMaster } from './masters';
import type {
  AtTableMethodKey,
  BillMethodKey,
  CheckoutMethodKey,
  MobileRules,
  PaymentOption,
  TaxConfig,
} from '@/types/branch';

/*
 * What each country brings to a branch there: its mobile-number rules, its taxes (as a bill
 * works them out) and the payment methods offered there, screen by screen. A branch takes these
 * when it's opened in a country, or moved to one (Settings › Branch details › Country); staff
 * then change rates and methods in Settings. Labels are content keys (cart, checkout, service).
 */

export interface RegionPreset {
  mobile: MobileRules;
  tax: TaxConfig;
  payments: {
    checkout: PaymentOption<CheckoutMethodKey>[];
    bill: PaymentOption<BillMethodKey>[];
    atTable: AtTableMethodKey[];
    takeaway: PaymentOption<CheckoutMethodKey>[];
    delivery: PaymentOption<CheckoutMethodKey>[];
  };
}

export const REGION_PRESETS: Record<CountryCodeMaster, RegionPreset> = {
  IN: {
    mobile: {
      dialCode: '+91',
      length: 10,
      pattern: '^[6-9]\\d{9}$',
      groups: [5, 5],
      separator: ' ',
      showDialCode: false,
    },
    tax: {
      pricesIncludeTax: false,
      discountBeforeTax: true,
      lines: [
        {
          id: 'gst',
          labelKey: 'gst',
          rateBp: 500,
          base: 'items',
          splitInto: [
            {
              id: 'cgst',
              labelKey: 'cgst',
              rateBp: 250,
            },
            {
              id: 'sgst',
              labelKey: 'sgst',
              rateBp: 250,
            },
          ],
        },
      ],
      rounding: {
        unit: 100,
        showRoundOff: true,
      },
      compactLabelKey: 'gst',
      invoiceKey: 'gst',
    },
    payments: {
      checkout: [
        {
          id: 'online',
          labelKey: 'online',
          recommended: true,
        },
        {
          id: 'counter',
          labelKey: 'counter',
        },
      ],
      bill: [
        {
          id: 'upi',
          labelKey: 'upi',
        },
        {
          id: 'card',
          labelKey: 'card',
        },
      ],
      atTable: ['card', 'upi', 'cash'],
      takeaway: [
        {
          id: 'online',
          labelKey: 'online',
          recommended: true,
        },
        {
          id: 'pickup',
          labelKey: 'pickup',
        },
      ],
      delivery: [
        {
          id: 'online',
          labelKey: 'online',
          recommended: true,
        },
        {
          id: 'cod',
          labelKey: 'cod',
        },
      ],
    },
  },
  NP: {
    mobile: {
      dialCode: '+977',
      length: 10,
      pattern: '^9[78]\\d{8}$',
      groups: [3, 7],
      separator: '-',
      showDialCode: true,
    },
    tax: {
      pricesIncludeTax: false,
      discountBeforeTax: true,
      serviceCharge: {
        labelKey: 'serviceCharge',
        rateBp: 1000,
      },
      lines: [
        {
          id: 'vat',
          labelKey: 'vat',
          rateBp: 1300,
          base: 'itemsPlusService',
        },
      ],
      rounding: {
        unit: 100,
        showRoundOff: true,
      },
      compactLabelKey: 'serviceAndVat',
      invoiceKey: 'vat',
    },
    payments: {
      checkout: [
        {
          id: 'esewa',
          labelKey: 'esewa',
          recommended: true,
        },
        {
          id: 'khalti',
          labelKey: 'khalti',
        },
        {
          id: 'fonepay',
          labelKey: 'fonepay',
        },
        {
          id: 'card',
          labelKey: 'card',
        },
        {
          id: 'counter',
          labelKey: 'counterNoUpi',
        },
      ],
      bill: [
        {
          id: 'esewa',
          labelKey: 'esewa',
        },
        {
          id: 'khalti',
          labelKey: 'khalti',
        },
        {
          id: 'fonepay',
          labelKey: 'fonepay',
        },
        {
          id: 'card',
          labelKey: 'cardNepal',
        },
      ],
      atTable: ['card', 'esewa', 'khalti', 'fonepay', 'cash'],
      takeaway: [
        {
          id: 'esewa',
          labelKey: 'esewa',
          recommended: true,
        },
        {
          id: 'khalti',
          labelKey: 'khalti',
        },
        {
          id: 'fonepay',
          labelKey: 'fonepay',
        },
        {
          id: 'card',
          labelKey: 'card',
        },
        {
          id: 'pickup',
          labelKey: 'pickupNoUpi',
        },
      ],
      delivery: [
        {
          id: 'esewa',
          labelKey: 'esewa',
          recommended: true,
        },
        {
          id: 'khalti',
          labelKey: 'khalti',
        },
        {
          id: 'fonepay',
          labelKey: 'fonepay',
        },
        {
          id: 'card',
          labelKey: 'card',
        },
        {
          id: 'cod',
          labelKey: 'codNoUpi',
        },
      ],
    },
  },
};
