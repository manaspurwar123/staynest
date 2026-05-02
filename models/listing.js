const mongoose = require("mongoose");
const reviews = require("./reviews");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: { type: String, required: true, minlength: 3 },
    image: {
        type: String,
        default: "https://foundtheworld.com/wp-content/uploads/2015/09/Emirates-Palace-Luxury-hotel.png",
        set: (v) => v === "" ? "https://foundtheworld.com/wp-content/uploads/2015/09/Emirates-Palace-Luxury-hotel.png" : v,
    },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, minlength: 3 },
    country: { type: String, required: true, minlength: 3 },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        }
    ]
});
const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
