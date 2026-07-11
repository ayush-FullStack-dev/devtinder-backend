import sendResponse from "../../../helpers/sendResponse.js";

import { getSession, setSession } from "../../../services/session.service.js";

import { maskIp } from "../../../helpers/ip.js";

export const sessionApprovealHandler = async (req, res) => {
    const { user } = req.auth;
    const approval = await getSession(`session:approval:${req.params.id}`);

    if (!approval) {
        return sendResponse(
            res,
            410,
            "This login approval request has expired or is no longer valid."
        );
    }

    if (approval.userId !== user.id) {
        return sendResponse(
            res,
            403,
            "You are not authorized to approve this login request."
        );
    }

    if (approval.used) {
        return sendResponse(
            res,
            410,
            "This request has already been processed and can no longer be used."
        );
    }

    if (req.body?.decision === "approve") {
        approval.status = "approved";
        approval.used = true;
        await setSession(
            approval,
            req.params.id,
            "session:approval",
            "KEEPTTL"
        );
    } else if (req.body?.decision === "decline") {
        approval.status = "declined";
        approval.used = true;
        await setSession(
            approval,
            req.params.id,
            "session:approval",
            "KEEPTTL"
        );
    } else {
        return sendResponse(
            res,
            400,
            "Invalid decision.Allowed values are 'approve' or 'decline'."
        );
    }

    return sendResponse(res, 200, {
        decision: req.body?.decision,
        message:
            req.body.decision === "approve"
                ? "Login approved successfully."
                : "Login request declined."
    });
};

export const sessionApprovealInfo = async (req, res) => {
    const { user } = req.auth;
    const approval = await getSession(`session:approval:${req.params.id}`);

    if (!approval) {
        return sendResponse(
            res,
            410,
            "This login approval request has expired or is no longer valid."
        );
    }

    if (approval.userId !== user.id) {
        return sendResponse(
            res,
            403,
            "You are not authorized to see approve login info."
        );
    }

    if (approval.used) {
        return sendResponse(
            res,
            410,
            "This request has already been processed and can no longer be used."
        );
    }

    return sendResponse(res, 200, {
        approval: {
            approvalId: req.params.id,
            status: approval.status,
            device: {
                name: approval.device.deviceName,
                location: approval.device.location,
                model: approval.device.deviceModel
            },
            ip: maskIp(approval.device.ip),
            requestedAt: approval.requestedAt
        }
    });
};
