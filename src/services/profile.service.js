import Profile from "../models/Profile.model.js";
import ApiError from "../helpers/ApiError.js";

const options = {
  many: false,
  id: false,
};

function checkCondition(condition, msg = "Condition is required") {
  if (!condition) {
    throw new ApiError("BadRequest", msg, 400);
  }
}

// ----- Profile Services -----
export const findProfile = async (condition, option = { ...options }) => {
  checkCondition(condition);
  if (option.many) {
    return Profile.find(condition);
  } else if (option.id) {
    return Profile.findById(condition);
  }
  return Profile.findOne(condition);
};

export const createProfile = async (data, option = { ...options }) => {
  checkCondition(data, "Data is required to create Profile!");
  if (option.many) {
    return Profile.insertMany(data, { runValidators: true });
  }
  return Profile.create(data);
};

export const updateProfile = async (
  filter,
  data,
  option = { ...options },
  extra,
) => {
  checkCondition(data, "Data && filter is required to update Profile!");
  if (option.many) {
    return Profile.updateMany(filter, data, {
      runValidators: true,
    });
  } else if (option.id) {
    return Profile.findByIdAndUpdate(filter, data, {
      returnDocument: extra?.returnDocument || "after",
    });
  }

  return Profile.findOneAndUpdate(filter, data, {
    runValidators: true,
    returnDocument: extra?.returnDocument || "after",
  });
};
