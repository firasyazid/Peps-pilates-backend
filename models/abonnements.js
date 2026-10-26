const mongoose = require("mongoose");

const abonnementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  sessionCount: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // The category shown as the plan's label in the app and the dashboard.
  // Some of these are combo labels such as "PILATES REFORMER+PILATES AU SOL",
  // which no course belongs to — booking eligibility uses `categories` below.
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  // Which course categories the plan actually pays for. Empty means every
  // category (PEPS UNLIMITED). A combo plan lists each one it includes, so a
  // single label like "REFORMER+AU SOL" no longer has to match a course.
  categories: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    default: [],
  },
  image: {
    type: String,
    default: "",
  },
  statut: {
    type: String,
    enum: ["payé", "non payé"],
    default: "non payé",  
    required: true,
  },
});

abonnementSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

abonnementSchema.set("toJSON", {
  virtuals: true,
});

exports.Abonnement = mongoose.model("Abonnement", abonnementSchema);
exports.abonnementSchema = abonnementSchema;
