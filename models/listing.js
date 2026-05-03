const mongoose = require("mongoose");
const reviews = require("./reviews");
const Schema = mongoose.Schema;
const DEFAULT_LISTING_IMAGE = "/images/stay-placeholder.svg";

const isValidImagePath = (value) => {
    if (!value) return true;
    if (value.startsWith("/")) return true;
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch (error) {
        return false;
    }
};

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: { type: String, required: true, minlength: 3 },
    image: {
        type: String,
        default: DEFAULT_LISTING_IMAGE,
        set: (v) => {
            const value = typeof v === "string" ? v.trim() : "";
            return value === "" ? DEFAULT_LISTING_IMAGE : value;
        },
        validate: {
            validator: isValidImagePath,
            message: "Image must be a valid URL or local image path.",
        },
    },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, minlength: 3 },
    country: { type: String, required: true, minlength: 3 },
    category: {
        type: String,
        enum: ["Rooms", "Villa", "Apartment", "Farmhouse", "Beach", "Mountain", "City", "Camping"],
        default: "Rooms",
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        }
    ]
});
const Listing = mongoose.model("Listing", listingSchema);
Listing.DEFAULT_LISTING_IMAGE = DEFAULT_LISTING_IMAGE;
module.exports = Listing;
