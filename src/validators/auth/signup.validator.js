import joi from "joi";
import { genderValues } from "../../constants/gender.constant.js";

const signupValidators = joi.object({
    name: joi.string().required().messages({
        "any.required": "Name is required.",
        "string.empty": "Name cannot be empty."
    }),

    email: joi.string().email().required().messages({
        "string.email": "Please enter a valid email.",
        "any.required": "Email is required."
    }),

    username: joi.string().min(3).required().messages({
        "any.required": "Username is required.",
        "string.min": "Username must be at least 3 characters long."
    }),

    password: joi
        .string()
        .min(6)
        .max(30)
        .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)
        .required()
        .messages({
            "any.required": "Password is required.",
            "string.min": "Password must be at least 6 characters.",
            "string.max": "Password cannot be more than 30 characters.",
            "string.pattern.base":
                "Password must include one uppercase letter, one number, and one special character."
        }),

    confirmPassword: joi
        .string()
        .valid(joi.ref("password"))
        .required()
        .messages({
            "any.only": "Passwords do not match.",
            "any.required": "Confirm password is required."
        }),

    age: joi.number().min(15).messages({
        "number.min": "Minimum age allowed is 15."
    }),

    gender: joi.string().valid(...genderValues).messages({
        "any.only": `Gender must be one of: ${genderValues.join(", ")}.`
    }),

    role: joi.string().valid("user").messages({
        "any.only": "Role must be user."
    })
});

export default signupValidators;
