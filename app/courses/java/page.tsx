import type { Metadata } from "next";
import JavaCoursePage from "./JavaCoursePage";

export const metadata: Metadata = {
  title: "Java Launchpad — Live Online Java Course | Imergene",
  description:
    "Register for Java Launchpad, an 8-week live online Java course covering core Java, Spring Boot, PostgreSQL, testing, and deployment.",
  openGraph: {
    title: "Java Launchpad — From first program to production-ready backend",
    description:
      "An 8-week live online Java course with practical projects, mentor feedback, and a portfolio-ready capstone.",
    type: "website",
  },
};

export default function Page() {
  return <JavaCoursePage />;
}
