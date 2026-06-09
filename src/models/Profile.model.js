import mongoose from "mongoose";

import { techStacks, lookingFor, role } from "../constants/profile.constant.js";

import { isValidS3UserPhotoKey } from "../helpers/s3.helper.js";

import { ringtone } from "../constants/call.constant.js";

const profileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            unique: true,
            required: true,
            index: true
        },
        photos: {
            type: [
                {
                    url: {
                        type: String,
                        validate: {
                            validator: url => {
                                try {
                                    new URL(url);
                                    return true;
                                } catch (e) {
                                    return false;
                                }
                            },
                            message: "Provide a valid image url"
                        }
                    },
                    key: {
                        type: String,
                        required: true,
                        validate: {
                            validator: isValidS3UserPhotoKey
                        },
                        message: "Provide a valid s3 key"
                    },
                    createdAt: {
                        type: Date,
                        default: () => new Date()
                    }
                }
            ],
            default: []
        },

        primaryPhoto: {
            url: {
                type: String,
                required: true,
                validate: {
                    validator: url => {
                        try {
                            new URL(url);
                            return true;
                        } catch (e) {
                            return false;
                        }
                    },
                    message: "Provide a valid image url"
                }
            },
            key: {
                type: String,
                required: true,
                validate: {
                    validator: isValidS3UserPhotoKey
                },
                message: "Provide a valid s3 key"
            },
            createdAt: {
                type: Date,
                default: () => new Date()
            }
        },
        username: {
            type: String,
            unique: true,
            required: true,
            index: true
        },
        phone: {
            countryCode: {
                type: Number,
                required: true,
                index: true
            },
            mobile: {
                type: String,
                required: true,
                index: true,
                validate: {
                    validator: v => /^\d{10}$/.test(v),
                    message: 'Mobile number must be exactly 10 digits'
                }
            }
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 500
        },
        gender: {
            type: String,
            enum: ["male", "female", "other"],
            required: true
        },

        role: {
            type: String,
            required: true,
            enum: role
        },
        looking_for: {
            type: [String],
            enum: lookingFor,
            required: true,
            validate: v => v.length > 0
        },
        tech_stack: {
            type: [String],
            enum: techStacks,
            required: true,
            validate: v => v.length > 0
        },
        experience_years: {
            type: Number,
            min: 0,
            max: 50,
            required: true
        },
        location: {
            city: {
                type: String,
                required: true
            },
            country: {
                type: String,
                required: true
            },
            geo: {
                type: {
                    type: String,
                    enum: ["Point"],
                    default: "Point"
                },
                coordinates: {
                    type: [Number],
                    required: true
                }
            }
        },
        visibility: {
            type: String,
            default: "public",
            enum: ["public", "hidden"]
        },
        profileScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
            index: true
        },
        stats: {
            likes: {
                type: Number,
                default: 0
            },
            views: {
                type: Number,
                default: 0
            }
        },
        packs: {
            activePack: {
                type: String,
                enum: ["none", "starter_1", "starter_2", "starter_3"],
                default: "none"
            },
            benefits: {
                boosts: { type: Number, default: 0 }
            },
            features: {
                boost: {
                    active: {
                        type: Boolean,
                        default: false
                    },
                    startedAt: {
                        type: Date,
                        default: null
                    },
                    endsAt: {
                        type: Date,
                        default: null
                    }
                }
            },

            expiresAt: {
                type: Date,
                default: null
            }
        },
        premium: {
            type: {
                type: String,
                enum: ["free", "silver", "gold"],
                default: "free"
            },
            subscriptionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Subscription",
                index: true,
                default: null
            },
            features: {
                incognito: {
                    enabled: {
                        type: Boolean,
                        default: false
                    }
                },
                ringtone: {
                    incoming: {
                        enabled: {
                            type: Boolean,
                            default: false
                        },
                        key: { type: String, default: null },
                        url: { type: String, default: ringtone.incoming }
                    },
                    ringback: {
                        enabled: {
                            type: Boolean,
                            default: false
                        },
                        key: { type: String, default: null },
                        url: { type: String, default: ringtone.ringBack }
                    }
                }
            },
            since: {
                type: Date,
                default: null
            },
            isLifetime: {
                type: Boolean,
                default: false
            },
            expiresAt: {
                type: Date,
                default: null
            }
        },
        lastSeen: {
            type: Date,
            default: null
        },
        deletedAt: {
            type: Date,
            default: null,
            expires: 0
        }
    },
    {
        timestamps: true
    }
);

profileSchema.index({ "location.geo": "2dsphere" });

export default new mongoose.model("Profile", profileSchema);
