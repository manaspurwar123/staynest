const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    guestName: {
        type: String,
        required: true,
        trim: true,
    },
    guestEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    checkIn: {
        type: Date,
        required: true,
    },
    checkOut: {
        type: Date,
        required: true,
    },
    guests: {
        type: Number,
        required: true,
        min: 1,
    },
    nights: {
        type: Number,
        required: true,
        min: 1,
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        default: "confirmed",
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model("Booking", bookingSchema);
