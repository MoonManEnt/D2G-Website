import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter() { return { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn(), forward: jest.fn() }; },
  usePathname() { return "/"; },
  useSearchParams() { return new URLSearchParams(); },
}));

jest.mock("next-auth/react", () => ({
  useSession() { return { data: { user: { id: "test-user-id", name: "Test User", email: "test@example.com", organizationId: "test-org-id", role: "ADMIN" } }, status: "authenticated" }; },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }));
global.IntersectionObserver = jest.fn().mockImplementation(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }));

try {
  if (window) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({ matches: false, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn() })),
    });
  }
} catch (e) {
  // node env
}

const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.("ReactDOM.render") || args[0]?.includes?.("componentWillReceiveProps")) return;
  originalWarn(...args);
};
