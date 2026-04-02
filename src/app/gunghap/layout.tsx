import type { Metadata } from "next";
import ProtectedLayout from "@/components/ProtectedLayout";

export const metadata: Metadata = {
  title: "궁합 분석",
  description: "두 사람의 사주팔자를 비교하여 일간 궁합, 오행 밸런스, 천간합, 지지합/충, 띠 궁합, 용신 보완 6가지 관점으로 분석합니다.",
};

export default function GunghapLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
