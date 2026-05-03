const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const wishlistSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
        unique: true,
    },
    note: {
        type: String,
        trim: true,
        maxlength: 160,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model("Wishlist", wishlistSchema);
