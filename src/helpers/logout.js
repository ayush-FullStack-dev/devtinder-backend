import crypto from "crypto";

export function getLogoutInfo(reason, action, device, ctxId) {
    if (!device) {
        return {
            reason: reason || "manual",
            id: ctxId || crypto.randomUUID(),
            at: Date.now(),
            action: action ?? "logout"
        };
    }
    return {
        reason: reason || "manual",
        id: crypto.randomUUID(),
        at: Date.now(),
        action: action ?? "logout",
        ...device
    };
}

export const getInvalidateToken = (refreshToken, current) => {
    if (current) {
        return refreshToken.map(t => {
            const version = t.version + 1;
            if (t.ctxId === current.ctxId) {
                return t;
            }
            return {
                ...t,
                version
            };
        });
    }

    return refreshToken.map(t => {
        const version = t.version + 1;

        return {
            ...t,
            version
        };
    });
};
