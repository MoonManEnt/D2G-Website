import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";

// =============================================================================
// The useToast hook and toast function use module-level state,
// so we need to reset the module between tests.
// =============================================================================

describe("useToast Hook", () => {
  let useToast: typeof import("@/lib/use-toast").useToast;
  let toast: typeof import("@/lib/use-toast").toast;
  let reducer: typeof import("@/lib/use-toast").reducer;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    // Re-import fresh module to reset module-level state
    const module = require("@/lib/use-toast");
    useToast = module.useToast;
    toast = module.toast;
    reducer = module.reducer;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("toast() - Adding Toasts", () => {
    it("adds a toast and returns id", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        const returned = toast({ title: "Hello", description: "World" });
        expect(returned.id).toBeTruthy();
        expect(typeof returned.id).toBe("string");
      });

      expect(result.current.toasts.length).toBe(1);
      expect(result.current.toasts[0].title).toBe("Hello");
      expect(result.current.toasts[0].description).toBe("World");
    });

    it("adds toast with open=true", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: "Test Toast" });
      });

      expect(result.current.toasts[0].open).toBe(true);
    });

    it("adds multiple toasts", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: "Toast 1" });
        toast({ title: "Toast 2" });
        toast({ title: "Toast 3" });
      });

      expect(result.current.toasts.length).toBe(3);
    });

    it("returns dismiss function", () => {
      const { result } = renderHook(() => useToast());

      let toastHandle: ReturnType<typeof toast>;
      act(() => {
        toastHandle = toast({ title: "Test" });
      });

      expect(typeof toastHandle!.dismiss).toBe("function");
    });

    it("returns update function", () => {
      const { result } = renderHook(() => useToast());

      let toastHandle: ReturnType<typeof toast>;
      act(() => {
        toastHandle = toast({ title: "Test" });
      });

      expect(typeof toastHandle!.update).toBe("function");
    });

    it("toast IDs are unique", () => {
      const { result } = renderHook(() => useToast());
      const ids = new Set<string>();

      act(() => {
        for (let i = 0; i < 10; i++) {
          const t = toast({ title: `Toast ${i}` });
          ids.add(t.id);
        }
      });

      expect(ids.size).toBe(10);
    });
  });

  describe("dismiss() - Removing Toasts", () => {
    it("dismiss sets toast open to false", () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const t = toast({ title: "Dismissable" });
        toastId = t.id;
      });

      act(() => {
        result.current.dismiss(toastId!);
      });

      const dismissed = result.current.toasts.find((t) => t.id === toastId!);
      expect(dismissed?.open).toBe(false);
    });

    it("dismiss without ID dismisses all toasts", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: "Toast 1" });
        toast({ title: "Toast 2" });
      });

      act(() => {
        result.current.dismiss();
      });

      // All toasts should have open=false
      result.current.toasts.forEach((t) => {
        expect(t.open).toBe(false);
      });
    });

    it("returned dismiss function sets specific toast to closed", () => {
      const { result } = renderHook(() => useToast());

      let handle: ReturnType<typeof toast>;
      act(() => {
        handle = toast({ title: "Will Dismiss" });
      });

      act(() => {
        handle!.dismiss();
      });

      const found = result.current.toasts.find((t) => t.id === handle!.id);
      expect(found?.open).toBe(false);
    });
  });

  describe("Auto-Remove After Timeout", () => {
    it("dismissed toasts are removed after TOAST_REMOVE_DELAY", () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const t = toast({ title: "Auto-Remove" });
        toastId = t.id;
      });

      // Dismiss the toast
      act(() => {
        result.current.dismiss(toastId!);
      });

      // Toast should still exist but be closed
      expect(result.current.toasts.length).toBe(1);
      expect(result.current.toasts[0].open).toBe(false);

      // Advance past TOAST_REMOVE_DELAY (5000ms)
      act(() => {
        jest.advanceTimersByTime(5100);
      });

      // Toast should be removed after the delay
      expect(result.current.toasts.length).toBe(0);
    });

    it("does not double-queue remove for same toast", () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const t = toast({ title: "No Double Queue" });
        toastId = t.id;
      });

      // Dismiss twice
      act(() => {
        result.current.dismiss(toastId!);
        result.current.dismiss(toastId!);
      });

      // Advance past delay
      act(() => {
        jest.advanceTimersByTime(5100);
      });

      // Should be cleanly removed (no errors)
      expect(result.current.toasts.length).toBe(0);
    });
  });

  describe("Maximum Toast Limit", () => {
    it("limits toasts to TOAST_LIMIT (5)", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        for (let i = 0; i < 10; i++) {
          toast({ title: `Toast ${i}` });
        }
      });

      // Should be capped at 5 (TOAST_LIMIT)
      expect(result.current.toasts.length).toBeLessThanOrEqual(5);
    });

    it("newest toasts appear first (prepended)", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: "First" });
        toast({ title: "Second" });
        toast({ title: "Third" });
      });

      // Newest should be first (prepended to array)
      expect(result.current.toasts[0].title).toBe("Third");
      expect(result.current.toasts[1].title).toBe("Second");
      expect(result.current.toasts[2].title).toBe("First");
    });

    it("when at limit, oldest toast is dropped", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        for (let i = 1; i <= 6; i++) {
          toast({ title: `Toast ${i}` });
        }
      });

      // Should have 5 toasts max
      expect(result.current.toasts.length).toBe(5);
      // First toast should be "Toast 6" (most recent)
      expect(result.current.toasts[0].title).toBe("Toast 6");
      // "Toast 1" should be dropped
      expect(result.current.toasts.find((t) => t.title === "Toast 1")).toBeUndefined();
    });
  });

  describe("reducer()", () => {
    it("ADD_TOAST adds to state", () => {
      const state = { toasts: [] };
      const newToast = { id: "1", title: "Test", open: true } as any;
      const result = reducer(state, { type: "ADD_TOAST", toast: newToast });

      expect(result.toasts.length).toBe(1);
      expect(result.toasts[0].id).toBe("1");
    });

    it("UPDATE_TOAST updates existing toast", () => {
      const state = {
        toasts: [{ id: "1", title: "Original", open: true } as any],
      };
      const result = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Updated" },
      });

      expect(result.toasts[0].title).toBe("Updated");
      expect(result.toasts[0].open).toBe(true);
    });

    it("UPDATE_TOAST does not affect other toasts", () => {
      const state = {
        toasts: [
          { id: "1", title: "First", open: true } as any,
          { id: "2", title: "Second", open: true } as any,
        ],
      };
      const result = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Updated First" },
      });

      expect(result.toasts[0].title).toBe("Updated First");
      expect(result.toasts[1].title).toBe("Second");
    });

    it("DISMISS_TOAST sets open to false for specific toast", () => {
      const state = {
        toasts: [
          { id: "1", title: "First", open: true } as any,
          { id: "2", title: "Second", open: true } as any,
        ],
      };
      const result = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });

      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(true);
    });

    it("DISMISS_TOAST without ID sets all to closed", () => {
      const state = {
        toasts: [
          { id: "1", title: "First", open: true } as any,
          { id: "2", title: "Second", open: true } as any,
        ],
      };
      const result = reducer(state, { type: "DISMISS_TOAST" });

      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(false);
    });

    it("REMOVE_TOAST removes specific toast", () => {
      const state = {
        toasts: [
          { id: "1", title: "First", open: true } as any,
          { id: "2", title: "Second", open: true } as any,
        ],
      };
      const result = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });

      expect(result.toasts.length).toBe(1);
      expect(result.toasts[0].id).toBe("2");
    });

    it("REMOVE_TOAST without ID removes all toasts", () => {
      const state = {
        toasts: [
          { id: "1", title: "First", open: true } as any,
          { id: "2", title: "Second", open: true } as any,
        ],
      };
      const result = reducer(state, { type: "REMOVE_TOAST" });

      expect(result.toasts.length).toBe(0);
    });

    it("ADD_TOAST respects TOAST_LIMIT (5)", () => {
      const existingToasts = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        title: `Toast ${i}`,
        open: true,
      })) as any[];

      const state = { toasts: existingToasts };
      const newToast = { id: "new", title: "New Toast", open: true } as any;
      const result = reducer(state, { type: "ADD_TOAST", toast: newToast });

      expect(result.toasts.length).toBe(5);
      expect(result.toasts[0].id).toBe("new");
    });
  });

  describe("useToast Hook Integration", () => {
    it("hook provides toast function", () => {
      const { result } = renderHook(() => useToast());
      expect(typeof result.current.toast).toBe("function");
    });

    it("hook provides dismiss function", () => {
      const { result } = renderHook(() => useToast());
      expect(typeof result.current.dismiss).toBe("function");
    });

    it("hook provides toasts array", () => {
      const { result } = renderHook(() => useToast());
      expect(Array.isArray(result.current.toasts)).toBe(true);
    });

    it("multiple hooks share state", () => {
      const { result: hook1 } = renderHook(() => useToast());
      const { result: hook2 } = renderHook(() => useToast());

      act(() => {
        toast({ title: "Shared Toast" });
      });

      // Both hooks should see the toast
      expect(hook1.current.toasts.length).toBe(hook2.current.toasts.length);
    });

    it("onOpenChange callback triggers dismiss", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: "OpenChange Test" });
      });

      const firstToast = result.current.toasts[0];
      expect(firstToast.onOpenChange).toBeDefined();

      // Simulate close via onOpenChange
      act(() => {
        firstToast.onOpenChange!(false);
      });

      const updated = result.current.toasts.find((t) => t.id === firstToast.id);
      expect(updated?.open).toBe(false);
    });
  });
});
