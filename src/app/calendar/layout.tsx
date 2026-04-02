import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "만세력 캘린더",
  description: "일별 천간지지·오행 에너지를 한눈에 확인하는 만세력 캘린더.",
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
