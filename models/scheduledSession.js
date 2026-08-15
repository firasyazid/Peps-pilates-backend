const mongoose = require("mongoose");

const scheduledSessionSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
  },
 cours: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cours",
    required: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coach",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  maxCapacity: {
    type: Number,
    required: true,
  },
  currentCapacity: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

scheduledSessionSchema.virtual("id").get(function () {
    return this._id.toHexString();
  });
  
  scheduledSessionSchema.set("toJSON", {
    virtuals: true,
  });
  
  exports.ScheduledSession = mongoose.model("ScheduledSession", scheduledSessionSchema);
  exports.scheduledSessionSchema = scheduledSessionSchema;
  