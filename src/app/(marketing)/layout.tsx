import { MarketingNavbar } from "@/components/marketing/layout/marketing-navbar";
import { MarketingFooter } from "@/components/marketing/layout/marketing-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNavbar />
      <main className="pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}
