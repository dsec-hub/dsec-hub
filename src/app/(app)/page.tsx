import { redirect } from "next/navigation";

// The standalone "Overview" landing was merged into the Dashboard — there is now
// a single home. `/` redirects there so old links, the post-sign-in landing, and
// the denied-access bounce all resolve to one place.
export default function HomePage() {
  redirect("/dashboard");
}
