import {jest} from "@jest/globals";

export const mockStripeSubscriptions = {
  list: jest.fn(),
  update: jest.fn(),
  cancel: jest.fn(),
  retrieve: jest.fn(),
};

export const mockStripeCustomers = {
  create: jest.fn(),
  retrieve: jest.fn(),
  list: jest.fn(),
};

export const mockStripeBillingPortal = {
  sessions: {
    create: jest.fn(),
  },
};

export const mockStripeCheckoutSessions = {
  create: jest.fn(),
};

export const mockStripeInstance = {
  subscriptions: mockStripeSubscriptions,
  customers: mockStripeCustomers,
  billingPortal: mockStripeBillingPortal,
  checkout: {
    sessions: mockStripeCheckoutSessions,
  },
};

export const mockStripeConstructor = jest.fn((): typeof mockStripeInstance => {
  return mockStripeInstance;
});

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: mockStripeConstructor,
  };
});

export const resetStripeMocks = (): void => {
  mockStripeSubscriptions.list.mockReset();
  mockStripeSubscriptions.update.mockReset();
  mockStripeSubscriptions.cancel.mockReset();
  mockStripeSubscriptions.retrieve.mockReset();
  mockStripeCustomers.create.mockReset();
  mockStripeCustomers.retrieve.mockReset();
  mockStripeCustomers.list.mockReset();
  mockStripeBillingPortal.sessions.create.mockReset();
  mockStripeCheckoutSessions.create.mockReset();
  mockStripeConstructor.mockClear();
};
