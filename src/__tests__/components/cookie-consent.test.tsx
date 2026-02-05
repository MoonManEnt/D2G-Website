import React from "react";
import { render, screen, fireEvent, act, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement("div", { ...props, ref }, children)
    ),
  },
  AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

import { CookieConsent } from "@/components/cookie-consent";

describe("CookieConsent", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => mockStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
        removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
        clear: jest.fn(() => { mockStorage = {}; }),
      },
      writable: true,
    });
  });

  it("renders banner when no consent stored", () => {
    jest.useFakeTimers();
    render(React.createElement(CookieConsent));
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText(/cookies/i)).toBeTruthy();
    expect(screen.getByText("Accept All")).toBeTruthy();
    expect(screen.getByText("Essential Only")).toBeTruthy();
    jest.useRealTimers();
  });

  it("does not render when consent already given", () => {
    jest.useFakeTimers();
    mockStorage["cookie-consent"] = "all";
    render(React.createElement(CookieConsent));
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.queryByText("Accept All")).toBeNull();
    jest.useRealTimers();
  });

  it("Accept All stores all in localStorage", () => {
    jest.useFakeTimers();
    render(React.createElement(CookieConsent));
    act(() => { jest.advanceTimersByTime(2000); });
    const acceptBtn = screen.getByText("Accept All");
    jest.useRealTimers();
    fireEvent.click(acceptBtn);
    expect(window.localStorage.setItem).toHaveBeenCalledWith("cookie-consent", "all");
  });

  it("Essential Only stores essential in localStorage", () => {
    jest.useFakeTimers();
    render(React.createElement(CookieConsent));
    act(() => { jest.advanceTimersByTime(2000); });
    const essentialBtn = screen.getByText("Essential Only");
    jest.useRealTimers();
    fireEvent.click(essentialBtn);
    expect(window.localStorage.setItem).toHaveBeenCalledWith("cookie-consent", "essential");
  });

  it("Accept All hides banner after click", async () => {
    jest.useFakeTimers();
    render(React.createElement(CookieConsent));
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText("Accept All")).toBeTruthy();
    const acceptBtn = screen.getByText("Accept All");
    jest.useRealTimers();
    fireEvent.click(acceptBtn);
    // Wait for React to process the state update and re-render
    await waitFor(() => {
      expect(screen.queryByText("Accept All")).toBeNull();
    });
  });

  it("does not render banner before delay", () => {
    jest.useFakeTimers();
    render(React.createElement(CookieConsent));
    // Before the 1500ms delay
    expect(screen.queryByText("Accept All")).toBeNull();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText("Accept All")).toBeTruthy();
    jest.useRealTimers();
  });
});
