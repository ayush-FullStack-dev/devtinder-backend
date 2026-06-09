import AuthEvent from "../models/AuthEvent.model.js";
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

// ----- AuthEvent Services -----
export const findAuthEvent = async (
  condition,
  option = { ...options },
  sort = {},
) => {
  checkCondition(condition);
  if (option.many) {
    return AuthEvent.find(condition).sort(sort);
  } else if (option.id) {
    return AuthEvent.findById(condition).sort(sort);
  }
  return AuthEvent.findOne(condition).sort(sort);
};

export const createAuthEvent = async (data, option = { ...options }) => {
  checkCondition(data, "Data is required to create AuthEvent!");
  if (option.many) {
    return AuthEvent.insertMany(data, { runValidators: true });
  }
  return AuthEvent.create(data);
};

export const updateAuthEvent = async (
  filter,
  data,
  option = { ...options },
) => {
  checkCondition(data, "Data && filter is required to update AuthEvent!");
  if (option.many) {
    return AuthEvent.updateMany(filter, data, {
      runValidators: true,
      returnDocument: "after",
    });
  } else if (option.id) {
    return AuthEvent.findByIdAndUpdate(filter, data, {
      returnDocument: "after",
      runValidators: true,
    });
  }
  return AuthEvent.findOneAndUpdate(filter, data, {
    runValidators: true,
    returnDocument: "after",
  });
};
