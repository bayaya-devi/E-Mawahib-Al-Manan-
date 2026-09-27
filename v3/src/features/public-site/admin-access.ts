import "server-only";

// Compatibility export for the public-site domain.  Authorization belongs to
// the shared server access layer, not to a presentation feature.
export { getAdministrationAccess as getSiteManager } from "@/lib/auth/administration-access";
