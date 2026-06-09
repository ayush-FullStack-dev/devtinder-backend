import sendResponse from "../../../../helpers/sendResponse.js";
import Autopay from "../../../../models/subscription/AutoPay.model.js";
import { BASE_CASHFREE_URL } from "../../../../constants/cashfree.constant.js";
import axios from "axios";
import { cashfreeHeaders } from "../../../../config/cashfree.js";

export const cancelAutopay = async (req, res) => {
  const { currentProfile } = req.auth;

  const autopay = await Autopay.findOne({
    userId: currentProfile._id,
    status: "active",
  });

  if (!autopay) {
    return sendResponse(res, 404, { message: "No active autopay found" });
  }

  try {
    await axios.post(
      `${BASE_CASHFREE_URL}/subscriptions/${autopay.gatewaySubscriptionId}/manage`,
      {
        action: "CANCEL",
      },
      {
        headers: cashfreeHeaders,
      },
    );
  } catch (error) {
    return sendResponse(res, 500, { message: "Failed to cancel autopay" });
  }

  autopay.status = "cancelled";
  await autopay.save();

  return sendResponse(res, 200, { message: "Autopay cancelled successfully" });
};
