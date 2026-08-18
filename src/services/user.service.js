import User from "../models/User.model.js";
import PendingUser from "../models/PendingUser.model.js";
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

// ----- User Services -----
export const findUser = async (condition, option = { ...options }) => {
  checkCondition(condition);
  if (option.many) {
    return User.find(condition);
  } else if (option.id) {
    return User.findById(condition);
  }
  return User.findOne(condition);
};

export const createUser = async (data, option = { ...options }) => {
  checkCondition(data, "Data is required to create User!");
  if (option.many) {
    return User.insertMany(data, { runValidators: true });
  }
  return User.create(data);
};

export const updateUser = async (filter, data, option = { ...options }) => {
  checkCondition(data, "Data && filter is required to update User!");
  if (option.many) {
    return User.updateMany(filter, data, {
      runValidators: true,
    });
  } else if (option.id) {
    return User.findByIdAndUpdate(filter, data, {
      runValidators: true,
      returnDocument: "after",
    });
  }
  return User.findOneAndUpdate(filter, data, {
    runValidators: true,
    returnDocument: "after",
  });
};

// ----- Temp User Services ----

export const findPendingUser = async (condition, option = { ...options }) => {
  checkCondition(condition);
  if (option.many) {
    return PendingUser.find(condition);
  } else if (option.id) {
    return PendingUser.findById(condition);
  }
  return PendingUser.findOne(condition);
};

export const createPendingUser = async (data, option = { ...options }) => {
  checkCondition(data, "Data is required to create Pending User!");
  if (option.many) {
    return PendingUser.insertMany(data, { runValidators: true });
  }
  return PendingUser.create(data);
};

export const deletePendingUser = async (filter, option = { ...options }) => {
  checkCondition(filter, "filter is required to delete Pending User!");
  if (option.many) {
    return PendingUser.deleteMany(filter);
  } else if (option.id) {
    return PendingUser.findByIdAndDelete(filter);
  }
  return PendingUser.deleteOne(filter);
};

export const updatePendingUserToken = async (email, token, expiresAt) => {
  return PendingUser.findOneAndUpdate(
    { email },
    { token, expiresAt },
    { returnDocument: "after" },
  );
};

export const createOrUpdatePendingUser = async (data) => {
  const email = data.email.trim().toLowerCase();
  const username = data.username.trim().toLowerCase();

  const [pendingByEmail, pendingByUsername] = await Promise.all([
    PendingUser.findOne({ email }),
    PendingUser.findOne({ username }),
  ]);

  if (!pendingByEmail && !pendingByUsername) {
    return PendingUser.create({
      ...data,
      email,
      username,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
  }

  if (pendingByEmail && pendingByUsername) {
    if (!pendingByEmail._id.equals(pendingByUsername._id)) {
      throw new ApiError(
        "Conflict",
        "Email and username are already associated with different pending registrations",
        409,
      );
    }

    return PendingUser.findByIdAndUpdate(
      pendingByEmail._id,
      {
        ...data,
        email,
        username,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      { returnDocument: "after" },
    );
  }

  if (pendingByEmail) {
    throw new ApiError(
      "Conflict",
      "Email already has a pending registration",
      409,
    );
  }

  if (pendingByUsername) {
    throw new ApiError(
      "Conflict",
      "Username already has a pending registration",
      409,
    );
  }
};
