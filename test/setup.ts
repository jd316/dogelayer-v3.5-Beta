import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'text-encoding';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables
process.env.NEXT_PUBLIC_WDOGE_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.NEXT_PUBLIC_BRIDGE_ADDRESS = '0x2345678901234567890123456789012345678901';
process.env.NEXT_PUBLIC_STAKING_ADDRESS = '0x3456789012345678901234567890123456789012';
process.env.NEXT_PUBLIC_LENDING_ADDRESS = '0x4567890123456789012345678901234567890123';

// Mock window.ethereum
const ethereum = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  isMetaMask: true,
};

Object.defineProperty(window, 'ethereum', {
  value: ethereum,
  writable: true,
});

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockImplementation(function(callback: IntersectionObserverCallback) {
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    takeRecords: () => []
  };
});

window.IntersectionObserver = mockIntersectionObserver;

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 