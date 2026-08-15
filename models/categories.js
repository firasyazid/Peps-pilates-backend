const mongoose = require("mongoose");

const categoriesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,  
  },
  
});

categoriesSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

categoriesSchema.set("toJSON", {
  virtuals: true,
});

exports.Category = mongoose.model("Category", categoriesSchema);
exports.categoriesSchema = categoriesSchema;
