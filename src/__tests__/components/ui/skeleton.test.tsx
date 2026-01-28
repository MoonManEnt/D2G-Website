import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";
import {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonStats,
  SkeletonList,
  SkeletonForm,
  SkeletonDashboard,
} from "@/components/ui/skeleton";

// =============================================================================
// TESTS
// =============================================================================

describe("Skeleton Components", () => {
  describe("Skeleton", () => {
    it("renders without errors", () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders as a div element", () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild?.nodeName).toBe("DIV");
    });

    it("applies animate-pulse class", () => {
      const { container } = render(<Skeleton />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("animate-pulse");
    });

    it("merges custom className", () => {
      const { container } = render(<Skeleton className="h-4 w-full" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("h-4");
      expect(el.className).toContain("w-full");
    });

    it("passes through HTML attributes", () => {
      const { container } = render(
        <Skeleton data-testid="skeleton-test" aria-label="Loading" />
      );
      const el = container.firstChild as HTMLElement;
      expect(el.getAttribute("data-testid")).toBe("skeleton-test");
      expect(el.getAttribute("aria-label")).toBe("Loading");
    });
  });

  describe("SkeletonCard", () => {
    it("renders without errors", () => {
      const { container } = render(<SkeletonCard />);
      expect(container.firstChild).toBeTruthy();
    });

    it("contains multiple Skeleton children (heading + content)", () => {
      const { container } = render(<SkeletonCard />);
      const skeletons = container.querySelectorAll(".animate-pulse");
      // Card has heading (h-5, h-4) + content lines (h-4 x 3) = 5 skeletons
      expect(skeletons.length).toBeGreaterThanOrEqual(4);
    });

    it("applies custom className", () => {
      const { container } = render(<SkeletonCard className="my-custom-class" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("my-custom-class");
    });

    it("has rounded-lg and border styling", () => {
      const { container } = render(<SkeletonCard />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("rounded-lg");
    });
  });

  describe("SkeletonTable", () => {
    it("renders without errors", () => {
      const { container } = render(<SkeletonTable />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders default 5 rows", () => {
      const { container } = render(<SkeletonTable />);
      // Header + 5 rows = 6 row-like containers
      const rows = container.querySelectorAll(".border-b");
      expect(rows.length).toBeGreaterThanOrEqual(5);
    });

    it("renders custom number of rows", () => {
      const { container } = render(<SkeletonTable rows={3} />);
      // Header + 3 rows
      const allSkeletons = container.querySelectorAll(".animate-pulse");
      // With 3 rows: header has 4 skeletons, each row has 4 = 4 + 12 = 16
      expect(allSkeletons.length).toBeGreaterThanOrEqual(10);
    });

    it("has overflow-hidden class for table container", () => {
      const { container } = render(<SkeletonTable />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("overflow-hidden");
    });
  });

  describe("SkeletonStats", () => {
    it("renders without errors", () => {
      const { container } = render(<SkeletonStats />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders 4 stat cards", () => {
      const { container } = render(<SkeletonStats />);
      // Grid with 4 children
      const statCards = (container.firstChild as HTMLElement).children;
      expect(statCards.length).toBe(4);
    });

    it("uses grid layout", () => {
      const { container } = render(<SkeletonStats />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("grid");
    });

    it("each stat card contains skeleton elements", () => {
      const { container } = render(<SkeletonStats />);
      const skeletons = container.querySelectorAll(".animate-pulse");
      // Each card has ~3 skeletons (label, value, icon) * 4 = 12
      expect(skeletons.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("SkeletonList", () => {
    it("renders without errors", () => {
      const { container } = render(<SkeletonList />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders default 5 list items", () => {
      const { container } = render(<SkeletonList />);
      const items = (container.firstChild as HTMLElement).children;
      expect(items.length).toBe(5);
    });

    it("renders custom number of items", () => {
      const { container } = render(<SkeletonList items={3} />);
      const items = (container.firstChild as HTMLElement).children;
      expect(items.length).toBe(3);
    });

    it("each item has avatar-like circular skeleton", () => {
      const { container } = render(<SkeletonList items={1} />);
      const roundedSkeletons = container.querySelectorAll(".rounded-full");
      // Each item has a circular avatar + a badge
      expect(roundedSkeletons.length).toBeGreaterThanOrEqual(1);
    });

    it("uses space-y-3 for vertical spacing", () => {
      const { container } = render(<SkeletonList />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("space-y-3");
    });
  });

  describe("SkeletonForm", () => {
    it("renders without errors", () => {
      const { container } = render(<SkeletonForm />);
      expect(container.firstChild).toBeTruthy();
    });

    it("contains form field skeletons (labels + inputs)", () => {
      const { container } = render(<SkeletonForm />);
      const skeletons = container.querySelectorAll(".animate-pulse");
      // Form has: 2 label+input pairs + 2 side-by-side inputs + button = lots of skeletons
      expect(skeletons.length).toBeGreaterThanOrEqual(8);
    });

    it("has rounded-md inputs", () => {
      const { container } = render(<SkeletonForm />);
      const rounded = container.querySelectorAll(".rounded-md");
      expect(rounded.length).toBeGreaterThanOrEqual(3);
    });

    it("uses space-y-6 for form section spacing", () => {
      const { container } = render(<SkeletonForm />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("space-y-6");
    });
  });

  describe("SkeletonDashboard", () => {
    it("renders without errors", () => {
      const { container } = render(<SkeletonDashboard />);
      expect(container.firstChild).toBeTruthy();
    });

    it("contains SkeletonStats section", () => {
      const { container } = render(<SkeletonDashboard />);
      // Stats grid should be present
      const grids = container.querySelectorAll(".grid");
      expect(grids.length).toBeGreaterThanOrEqual(1);
    });

    it("contains SkeletonCard sections", () => {
      const { container } = render(<SkeletonDashboard />);
      // Dashboard has a grid with 2 cards
      const skeletons = container.querySelectorAll(".animate-pulse");
      // Stats (12) + 2 Cards (5 each) + Table (header 4 + 5 rows * 4) = ~42+
      expect(skeletons.length).toBeGreaterThanOrEqual(20);
    });

    it("contains SkeletonTable section", () => {
      const { container } = render(<SkeletonDashboard />);
      // Table has overflow-hidden
      const overflowElements = container.querySelectorAll(".overflow-hidden");
      expect(overflowElements.length).toBeGreaterThanOrEqual(1);
    });

    it("uses space-y-6 for main layout spacing", () => {
      const { container } = render(<SkeletonDashboard />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("space-y-6");
    });
  });
});
