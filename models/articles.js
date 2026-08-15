const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content1: {
    type: String,
    required: true,
  },
  content2: {
    type: String,
  },
  image: {
    type: String,  
    required: false, 
  },
  video: {
    type: String, 
    required: false,  
  },
  createdAt: {
    type: Date,
    default: Date.now, 
  },
});

articleSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

articleSchema.set("toJSON", {
  virtuals: true,
});

 

exports.Article = mongoose.model("Article", articleSchema);
exports.articleSchema = articleSchema;
