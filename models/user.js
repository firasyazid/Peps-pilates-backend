const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  passwordHash: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    default: "",
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ["user", "admin", "assistant"],
    default: "user",
  },
  abonnement: {
    type: [
      {
        abonnement: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Abonnement",  
          required: true,
        },
        sessionCount: {
          type: Number,
          required: true, 
        },
        expirationDate: {
          type: Date,
          required: true,  
        },
        statut: {
        type: String,
        enum: ["non payé", "payé"],
        default: "non payé",
      },
        purchasedAt: {
          type: Date,
          default: Date.now,  
        },
      },
    ],
    default: [],  
  },
  sessionCount: {
    type: Number,
    default: 0,  
  },
  languagePreference: {
    type: String,
    enum: ["en", "fr"],   
    default: "fr",     
  },

  expirationDate: {
    type: Date,
    default: null,  
  },
  tokenPassword: {
    type: Number,  
    default: null,
  },
  tokenPasswordExpiration: {
    type: Date,
    default: null,
  },
  image: {
    type: String,
    default: null,
  },
});

userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

userSchema.set("toJSON", {
  virtuals: true,
});

exports.User = mongoose.model("User", userSchema);
exports.userSchema = userSchema;
