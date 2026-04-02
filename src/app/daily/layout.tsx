import type { Metadata } from "next";
import ProtectedLayout from "@/components/ProtectedLayout";

export const metadata: Metadata = {
  title: "오늘의 운세",
  description: "사주 기반 데일리 타로 리딩. 매일 달라지는 오행 맞춤 타로 운세로 하루를 시작하세요.",
};

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
