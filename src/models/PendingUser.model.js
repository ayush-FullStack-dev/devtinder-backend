import mongoose from "mongoose";
import { userSchema } from "./User.model.js";
import { genderValues } from "../constants/gender.constant.js";

const tempUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    min: 6,
    required: true,
  },
  role: {
    type: String,
    default: "user",
    enum: ["user", "admin"],
  },
  gender: {
    type: String,
    enum: genderValues,
    required: true,
  },
  token: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  picture: {
    type: String,
    default:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQRs1fzJizYJbxmeZhwoQdq9ocGyT1dGjAhLq_ZCsJ56g&s=10",
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 1000 * 60 * 15),
    expires: 0,
  },
});

export default new mongoose.model("PendingUser", tempUserSchema);
