jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      put: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

import App from './App';

describe('App', () => {
  test('exports a React component', () => {
    expect(typeof App).toBe('function');
  });
});
