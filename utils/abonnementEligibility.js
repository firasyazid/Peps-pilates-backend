/**
 * Does the user hold a paid, unexpired subscription that pays for this course?
 *
 * Lives here because both booking routes (POST / and POST /reserver-sessions)
 * need the exact same answer — when the rule was duplicated, one copy could
 * drift from the other.
 *
 * A plan covers a course when:
 *   1. `categories` is set    -> the course's category is in that list, or
 *   2. only `category` is set -> it matches the course's category exactly
 *      (older plans created before `categories` existed), or
 *   3. neither is set         -> every category (PEPS UNLIMITED).
 *
 * `category` alone used to decide this, which broke combo plans: their
 * category is a single label like "PILATES REFORMER+PILATES AU SOL" that no
 * course belongs to, so the comparison always failed and the booking was
 * saved as "non payé" while the member's credits sat unused.
 *
 * The `user.abonnement` entries must be populated (`abonnement.abonnement`)
 * for the plan's categories to be readable.
 */

const covers = (entry, courseCategoryId) => {
  const plan = entry.abonnement;
  const planCategories = plan?.categories;

  if (Array.isArray(planCategories) && planCategories.length) {
    // No category on the course: a plan that lists specific ones can't confirm
    // it covers it, so fall back to the permissive answer used before.
    if (!courseCategoryId) return true;
    return planCategories.some(
      (category) => category && category.toString() === courseCategoryId.toString()
    );
  }

  const planCategory = plan?.category;
  if (!planCategory) return true;
  if (!courseCategoryId) return true;
  return planCategory.toString() === courseCategoryId.toString();
};

/**
 * @param {object} user     a User document with `abonnement.abonnement` populated
 * @param {object} session  a ScheduledSession with `cours.category` populated
 * @param {Date}   [now]    the moment to judge expiry against (defaults to now)
 */
function hasValidAbonnement(user, session, now = new Date()) {
  const courseCategoryId = session?.cours?.category?._id ?? session?.cours?.category;

  return (user?.abonnement || []).some((entry) => {
    if (entry.statut !== "payé") return false;
    if (entry.expirationDate && new Date(entry.expirationDate) < now) return false;
    return covers(entry, courseCategoryId);
  });
}

module.exports = { hasValidAbonnement };
