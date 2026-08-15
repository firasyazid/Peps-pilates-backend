const mongoose = require("mongoose");

const coachSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  bio: {
    type: String,
    trim: true,
  },
  expertise: {
    type: String,
    trim: true,
  },
  image : {
    type: String,
    default: "",
  },
});

coachSchema.virtual("id").get(function () {
    return this._id.toHexString();
  });
  
  coachSchema.set("toJSON", {
    virtuals: true,
  });
  
  exports.Coach = mongoose.model("Coach", coachSchema);
  exports.coachSchema = coachSchema;
  