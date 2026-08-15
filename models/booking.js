const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  scheduledSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ScheduledSession",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
    required: true,
  },
  status: {
    type: String,
    enum: ["non payé", "payé", "annulé", "en attente"],
    default: "non payé",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

 bookingSchema.virtual("id").get(function () {
    return this._id.toHexString();
  });
  
  bookingSchema.set("toJSON", {
    virtuals: true,
  });
  
  exports.Booking = mongoose.model("Booking", bookingSchema);
  exports.bookingSchema = bookingSchema;
  