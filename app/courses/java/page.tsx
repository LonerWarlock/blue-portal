import { createPageMetadata } from "@/lib/seo";
import JavaCoursePage from "./JavaCoursePage";

export const metadata = createPageMetadata("/courses/java", "Java Launchpad — Live Online Java Course | Imergene", "Register for Java Launchpad, an 8-week live online Java course covering core Java, Spring Boot, PostgreSQL, testing, and deployment.");

export default function Page() {
  return <JavaCoursePage />;
}
