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
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
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
