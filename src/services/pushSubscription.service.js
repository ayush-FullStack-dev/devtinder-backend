import PushSubscription from "../models/PushSubscription.model.js";
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

// ----- PushSubscription Services -----
export const findPushSubscription = async (
  condition,
  option = { ...options },
) => {
  checkCondition(condition);
  if (option.many) {
    return PushSubscription.find(condition);
  } else if (option.id) {
    return PushSubscription.findById(condition);
  }
  return PushSubscription.findOne(condition);
};

export const createPushSubscription = async (data, option = { ...options }) => {
  checkCondition(data, "Data is required to create PushSubscription!");
  if (option.many) {
    return PushSubscription.insertMany(data, { runValidators: true });
  }
  return PushSubscription.create(data);
};

export const updatePushSubscription = async (
  filter,
  data,
  option = { ...options },
  extra = {},
) => {
  checkCondition(
    data,
    "Data && filter is required to update PushSubscription!",
  );
  if (option?.many) {
    return PushSubscription.updateMany(filter, data, {
      runValidators: true,
      returnDocument: "after",
    });
  } else if (option?.id) {
    return PushSubscription.findByIdAndUpdate(filter, data, {
      returnDocument: "after",
      runValidators: true,
      ...extra,
    });
  }
  return PushSubscription.findOneAndUpdate(filter, data, {
    runValidators: true,
    returnDocument: "after",
    ...extra,
  });
};

export const deletePushSubscription = async (
  filter,
  option = { ...options },
) => {
  checkCondition(filter, "filter is required to delete PushSubscription");
  if (option.many) {
    return PushSubscription.deleteMany(filter);
  } else if (option.id) {
    return PushSubscription.findByIdAndDelete(filter);
  }
  return PushSubscription.deleteOne(filter);
};
