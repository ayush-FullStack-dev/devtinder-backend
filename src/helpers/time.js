import epochify from "epochify";

export const isValidDate = (value) => {
  const date = new Date(value);
  return !isNaN(date.getTime());
};

export const getTime = (req) => {
  const time = epochify.getFullDateTime();
  let clientTime = null;
  if (req?.body) {
    clientTime = new Date(req?.body?.clientTime || Date.now()).getTime();
  } else {
    clientTime = new Date(req);
  }

  return {
    serverTime: time.timestamp,
    clientTime,
    fullTime: time,
  };
};

export const daysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

export const europeanStyleDate = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};
