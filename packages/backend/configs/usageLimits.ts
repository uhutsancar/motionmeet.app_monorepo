/**
 * Abuse ceilings on what one member can create. They are not product tiers:
 * every member gets the same numbers and ordinary use never comes near them.
 * They exist so a script or a stuck retry loop cannot fill the tables; bursts
 * are the per-route rate limiters' job. Superadmins are exempt.
 */
export const USAGE_LIMITS = Object.freeze({
  workoutsPerMonth: 300,
  routines: 200,
  postsPerDay: 100,
  storiesPerDay: 100,
});

/** The quota a create call should enforce for this member; -1 means none. */
export const usageLimitFor = (user: { role?: string } | undefined, limit: number): number =>
  user?.role === "superadmin" ? -1 : limit;
