import sendResponse from "../../../helpers/sendResponse.js";

export const getPing = (req, res) => {
 return sendResponse(res, 200, "Pong");
};
