import { getPaddleClient } from "../configs/paddle.js";
import { loadEnvironment } from "../configs/environment.js";
import { findPlanProviderPrice } from "../repositories/paymentRepository.js";
import { getPlanById } from "./planService.js";

export interface CheckoutIntent {
  priceId: string;
  productId: string;
  environment: "sandbox" | "live";
  /**
   * Passed to Paddle.js unmodified and read back out of the webhook later.
   * `motionmeetUserId` is always the authenticated caller's own id - never
   * accept this shape from a client request body.
   */
  customData: { motionmeetUserId: string; planId: string; interval: "monthly" | "yearly" };
}

/**
 * Resolves what a checkout for (planId, interval) should send to Paddle.js,
 * scoped to whichever environment is active. Returns null for anything that
 * isn't ready to sell - a disabled/unknown plan, or a plan with no Paddle
 * price configured yet (the catalog starts empty - see
 * docs/paddle-integration-plan.md §5, §12).
 */
export const getCheckoutIntent = async (
  userId: string,
  planId: string,
  interval: "monthly" | "yearly",
): Promise<CheckoutIntent | null> => {
  const environment = loadEnvironment();
  if (!environment.paddleEnabled || !environment.paddleEnvironment) return null;
  const plan = await getPlanById(planId);
  if (!plan || !plan.isActive) return null;
  const price = await findPlanProviderPrice(planId, interval, environment.paddleEnvironment);
  if (!price) return null;
  return {
    priceId: price.externalPriceId,
    productId: price.externalProductId,
    environment: environment.paddleEnvironment,
    customData: { motionmeetUserId: userId, planId, interval },
  };
};

/**
 * A URL to Paddle's own hosted billing-management page for this customer.
 * Null when Paddle isn't configured or the user has never had a Paddle
 * customer id assigned (never purchased anything).
 */
export const createPortalSessionUrl = async (paddleCustomerId: string, paddleSubscriptionId: string): Promise<string | null> => {
  const client = getPaddleClient();
  if (!client || !paddleCustomerId) return null;
  const subscriptionIds = paddleSubscriptionId ? [paddleSubscriptionId] : [];
  const session = await client.customerPortalSessions.create(paddleCustomerId, subscriptionIds);
  return session.urls.general.overview;
};
