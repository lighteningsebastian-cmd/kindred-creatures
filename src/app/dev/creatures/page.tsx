import type { Metadata } from "next";
import { CreaturesDemo } from "./CreaturesDemo";

export const metadata: Metadata = {
  title: "Creature previews",
  robots: { index: false },
};

export default function CreaturesDevPage() {
  return <CreaturesDemo />;
}
