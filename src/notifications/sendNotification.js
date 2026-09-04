import webpush from "web-push";
import crypto from "crypto";
import admin from "../config/firebase.js";

import { deletePushSubscription } from "../services/pushSubscription.service.js";

export const sendNotification = async (subscription, data) => {
    const notificationId = crypto.randomBytes(10).toString("hex");

    const payload = JSON.stringify({
        ...data,
        notificationId
    });

    try {
         await webpush.sendNotification(subscription, payload);

        return {
            success: true,
            notificationId
        };
    } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
            await deletePushSubscription({
                _id: subscription._id
            });
        }

        return {
            success: false,
            error: err?.statusCode || "PUSH_FAILED"
        };
    }
};

export const sendPush = async (token, payload) => {
    return admin.messaging().send({
        token,
        notification: payload.notification,
        data: payload.data,
        webpush: {
            headers: {
                Urgency: "high"
            },
            notification: {
                requireInteraction: true,
                tag: `call-${payload.data.callId}`
            }
        }
    });
};
