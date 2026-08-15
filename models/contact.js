const mongoose = require("mongoose");


const contactSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    });

contactSchema.virtual("id").get(function () {
    return this._id.toHexString();
}
);

contactSchema.set("toJSON", {
    virtuals: true,
});

exports.Contact = mongoose.model("Contact", contactSchema);
exports.contactSchema = contactSchema;