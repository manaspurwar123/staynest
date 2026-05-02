const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    author: {
        type: String,
        default: "Guest",
        trim: true,
    },
    comment: String,
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model("Review", reviewSchema);
