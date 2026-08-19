export const checkTimeManipulation = time => {
    const serverTime = time?.serverTime || Date.now();
    const clientTime = time?.clientTime || Date.now();
    const diff = Math.abs(serverTime - clientTime);
    if (diff > 2 * 60 * 1000) {
        return { success: false, message: "Time Manipulation Attack detcted" };
    }
    return { success: true };
};
