const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const inquirySchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    guestName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
    },
    guestEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 1000,
    },
    status: {
        type: String,
        enum: ["new", "replied", "closed"],
        default: "new",
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model("Inquiry", inquirySchema);
