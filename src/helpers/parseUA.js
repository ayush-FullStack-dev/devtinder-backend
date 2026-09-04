import { UAParser } from "ua-parser-js";

export const parseUA = (userAgent) => {
  const parser = new UAParser(userAgent);
  let deviceType = null;
  const result = parser.getResult();
  if (userAgent.includes("Mobile")) {
    deviceType = "mobile";
  } else if (
    userAgent.includes("tablet") ||
    userAgent.includes("ipad") ||
    userAgent.includes("sm-t") ||
    userAgent.includes("xoom") ||
    userAgent.includes("silk") ||
    userAgent.includes("kindle")
  ) {
    deviceType = "tab";
  } else {
    deviceType = "desktop";
  }
  return {
    browser: result.browser.name,
    browserVersion: result.browser.version,
    os: result.os.name,
    deviceType,
    userAgent,
    deviceName: `${result.browser.name} on ${result.os.name}`,
    osVersion: result.os.version,
    deviceModel: result.device.model,
  };
};
