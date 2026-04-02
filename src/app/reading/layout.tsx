import type { Metadata } from "next";
import ProtectedLayout from "@/components/ProtectedLayout";

export const metadata: Metadata = {
  title: "사주 + 타로 분석",
  description: "만세력 기반 정밀 사주팔자 분석과 78장 타로 카드 오행 맞춤 해석을 한번에. 십성, 12운성, 신살, 대운/세운까지.",
};

export default function ReadingLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
