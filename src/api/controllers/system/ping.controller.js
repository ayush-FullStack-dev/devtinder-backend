import sendResponse from "../../../helpers/sendResponse";

export const getPing = (req, res) => {
 return sendResponse(res, 200, "Pong");
};
