const express = require('express');
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Review = require("./models/reviews.js");
const Booking = require("./models/booking.js");
const Wishlist = require("./models/wishlist.js");
const Inquiry = require("./models/inquiry.js");
const initData = require("./init/data.js");
const path = require("path");
const methodOverride = require("method-override");
app.use(methodOverride("_method"));
const ejsMate = require("ejs-mate");
const warpAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
const ExpressError = require("./utils/ExpressError.js");
// fallback creator if imported module isn't a constructor (robustness)
const makeExpressError = (message, statusCode) => {
    if (typeof ExpressError === 'function') return new ExpressError(message, statusCode);
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
};
const User = require('./models/user');
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
app.disable("view cache");

const MONGO_URL = process.env.ATLASDB_URL || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/mydb";

async function main() {
    await mongoose.connect(MONGO_URL);
}

main()
    .then(() => {
        console.log("Connected to MongoDB");
        return Listing.countDocuments({});
    })
    .then(async (count) => {
        if (count === 0) {
            await Listing.insertMany(initData.data);
            console.log("Sample listings inserted");
        }
        await ensureListingCategories();
        await ensureListingImages();
        await ensureListingFallbackImages();
    })
    .catch((err) => {
        console.error("Error connecting to MongoDB", err);
    });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "init", "views"));
app.use(express.urlencoded({ extended: true }));

// simple request logger to help debug routing issues
app.use((req, res, next) => {
    console.log(`REQ --> ${req.method} ${req.path}`);
    next();
});

const validateListing = (req, res, next) => {
    const newListing = new Listing(req.body);
    const { error } = newListing.validateSync();
    if (error) {
        return next(makeExpressError(error.message, 400));
    }
    next();
};

const calculateNights = (checkIn, checkOut) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((checkOut - checkIn) / msPerDay);
};

const LISTING_CATEGORIES = ["Rooms", "Villa", "Apartment", "Farmhouse", "Beach", "Mountain", "City", "Camping"];
const LISTINGS_PER_PAGE = 6;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const inferListingCategory = (listing) => {
    const text = `${listing.title || ""} ${listing.description || ""} ${listing.location || ""}`.toLowerCase();
    if (/apartment|studio|loft|penthouse/.test(text)) return "Apartment";
    if (/villa|haveli/.test(text)) return "Villa";
    if (/farm|estate|bungalow/.test(text)) return "Farmhouse";
    if (/beach|sea|island|goa|pondicherry/.test(text)) return "Beach";
    if (/mountain|cabin|chalet|hill|peak|manali|auli|mussoorie|nainital|srinagar/.test(text)) return "Mountain";
    if (/camp|treehouse/.test(text)) return "Camping";
    if (/city|urban|metro|rooftop|temple|fort|palace|heritage|courtyard|mumbai|bangalore|jaipur|varanasi|madurai|gwalior|gurugram/.test(text)) return "City";
    return "Rooms";
};

async function ensureListingCategories() {
    const listings = await Listing.find({
        $or: [
            { category: { $exists: false } },
            { category: "" },
            { category: null },
            { category: "Rooms" },
        ],
    });

    const updates = listings
        .map((listing) => {
            const category = inferListingCategory(listing);
            if (listing.category === category) return null;
            return {
                updateOne: {
                    filter: { _id: listing._id },
                    update: { $set: { category } },
                },
            };
        })
        .filter(Boolean);

    if (updates.length) {
        await Listing.bulkWrite(updates);
        console.log(`Listing categories updated: ${updates.length}`);
    }
}

async function ensureListingImages() {
    if (typeof initData.withStayImage !== "function") return;

    const sampleTitles = new Set(initData.data.map((listing) => listing.title));
    const listings = await Listing.find({}).sort({ _id: 1 });
    const updates = listings
        .filter((listing) => sampleTitles.has(listing.title))
        .map((listing, index) => {
            const normalized = initData.withStayImage(listing.toObject(), index);
            if (listing.image === normalized.image && listing.category === normalized.category) return null;
            return {
                updateOne: {
                    filter: { _id: listing._id },
                    update: {
                        $set: {
                            category: normalized.category,
                            image: normalized.image,
                        },
                    },
                },
            };
        })
        .filter(Boolean);

    if (updates.length) {
        await Listing.bulkWrite(updates);
        console.log(`Listing images updated: ${updates.length}`);
    }
}

async function ensureListingFallbackImages() {
    const fallbackImage = Listing.DEFAULT_LISTING_IMAGE || "/images/stay-placeholder.svg";
    const legacyFallback = "https://foundtheworld.com/wp-content/uploads/2015/09/Emirates-Palace-Luxury-hotel.png";
    const result = await Listing.updateMany(
        {
            $or: [
                { image: { $exists: false } },
                { image: "" },
                { image: null },
                { image: legacyFallback },
            ],
        },
        { $set: { image: fallbackImage } },
        { runValidators: true }
    );

    if (result.modifiedCount) {
        console.log(`Listing fallback images updated: ${result.modifiedCount}`);
    }
}

const renderListingsPage = warpAsync(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = {};

    if (search) {
        const searchRegex = new RegExp(escapeRegex(search), "i");
        filter.$or = [
            { location: searchRegex },
            { country: searchRegex },
            { title: searchRegex },
            { description: searchRegex },
            { category: searchRegex },
        ];
    }

    if (category && LISTING_CATEGORIES.includes(category)) {
        if (category === "Rooms") {
            filter.$and = [
                ...(filter.$and || []),
                { $or: [{ category: "Rooms" }, { category: { $exists: false } }, { category: "" }] },
            ];
        } else {
            filter.category = category;
        }
    }

    const totalListings = await Listing.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalListings / LISTINGS_PER_PAGE), 1);
    const currentPage = Math.min(page, totalPages);
    const listings = await Listing.find(filter)
        .sort({ _id: -1 })
        .skip((currentPage - 1) * LISTINGS_PER_PAGE)
        .limit(LISTINGS_PER_PAGE);

    res.render("listings/index", {
        listings,
        search,
        category,
        categories: LISTING_CATEGORIES,
        currentPage,
        totalPages,
        totalListings,
        isHomePage: req.path === "/",
    });
});

app.get("/", renderListingsPage);
//index route
app.get("/listings", renderListingsPage);

app.get("/bookings", warpAsync(async (req, res) => {
    const bookings = await Booking.find({})
        .populate("listing")
        .sort({ createdAt: -1 });
    res.render("bookings/index", { bookings });
}));

app.get("/wishlists", warpAsync(async (req, res) => {
    const wishlists = await Wishlist.find({})
        .populate("listing")
        .sort({ createdAt: -1 });
    res.render("wishlists/index", { wishlists });
}));

app.get("/inquiries", warpAsync(async (req, res) => {
    const inquiries = await Inquiry.find({})
        .populate("listing")
        .sort({ createdAt: -1 });
    res.render("inquiries/index", { inquiries });
}));
//new route

app.get("/listings/new", (req, res) => {
    res.render("listings/new.ejs", { categories: LISTING_CATEGORIES });
});
//show route
app.get("/listings/:id", warpAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    if (!listing) {
        throw makeExpressError("Listing Not Found", 404);
    }
    res.render("listings/show", { listing: listing });
}));

app.post("/listings/:id/reviews", warpAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError("Listing Not Found", 404);
    }
    const reviewData = req.body.review || {};
    const newReview = new Review(reviewData);
    // Let Mongoose run validation; if it fails, warpAsync will forward the error
    await newReview.save();
    listing.reviews.push(newReview._id);
    await listing.save();
    res.redirect(`/listings/${id}`);
}));

app.post("/listings/:id/bookings", warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError("Listing Not Found", 404);
    }

    const bookingData = req.body.booking || {};
    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const guests = Number(bookingData.guests);
    const nights = calculateNights(checkIn, checkOut);

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        throw makeExpressError("Please select valid booking dates.", 400);
    }
    if (nights < 1) {
        throw makeExpressError("Check out date must be after check in date.", 400);
    }
    if (!Number.isInteger(guests) || guests < 1) {
        throw makeExpressError("Guests must be at least 1.", 400);
    }

    const booking = new Booking({
        listing: listing._id,
        guestName: bookingData.guestName,
        guestEmail: bookingData.guestEmail,
        checkIn,
        checkOut,
        guests,
        nights,
        totalPrice: nights * listing.price,
    });

    await booking.save();
    res.redirect(`/bookings/${booking._id}`);
}));

app.get("/bookings/:id", warpAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate("listing");
    if (!booking || !booking.listing) {
        throw makeExpressError("Booking Not Found", 404);
    }
    res.render("bookings/show", { booking, listing: booking.listing });
}));

const deleteBooking = warpAsync(async (req, res) => {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
        throw makeExpressError("Booking Not Found", 404);
    }
    res.redirect("/bookings");
});

app.post("/bookings/:id/delete", deleteBooking);
app.delete("/bookings/:id", deleteBooking);

app.post("/listings/:id/wishlist", warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError("Listing Not Found", 404);
    }

    const wishlistData = req.body.wishlist || {};
    await Wishlist.findOneAndUpdate(
        { listing: listing._id },
        {
            listing: listing._id,
            note: wishlistData.note,
        },
        { new: true, runValidators: true, upsert: true }
    );

    res.redirect("/wishlists");
}));

const deleteWishlist = warpAsync(async (req, res) => {
    const wishlist = await Wishlist.findByIdAndDelete(req.params.id);
    if (!wishlist) {
        throw makeExpressError("Saved listing not found", 404);
    }
    res.redirect("/wishlists");
});

app.post("/wishlists/:id/delete", deleteWishlist);
app.delete("/wishlists/:id", deleteWishlist);

app.post("/listings/:id/inquiries", warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError("Listing Not Found", 404);
    }

    const inquiryData = req.body.inquiry || {};
    const inquiry = new Inquiry({
        listing: listing._id,
        guestName: inquiryData.guestName,
        guestEmail: inquiryData.guestEmail,
        phone: inquiryData.phone,
        message: inquiryData.message,
    });

    await inquiry.save();
    res.redirect("/inquiries");
}));

app.post("/inquiries/:id/status", warpAsync(async (req, res) => {
    const status = req.body.status;
    const inquiry = await Inquiry.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
    );
    if (!inquiry) {
        throw makeExpressError("Inquiry Not Found", 404);
    }
    res.redirect("/inquiries");
}));

const deleteInquiry = warpAsync(async (req, res) => {
    const inquiry = await Inquiry.findByIdAndDelete(req.params.id);
    if (!inquiry) {
        throw makeExpressError("Inquiry Not Found", 404);
    }
    res.redirect("/inquiries");
});

app.post("/inquiries/:id/delete", deleteInquiry);
app.delete("/inquiries/:id", deleteInquiry);

// Register route - minimal, stores salted scrypt hash
app.post('/register', warpAsync(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = User.normalizeEmail(email);
    if (!email || !password) {
        throw makeExpressError('Email and password required', 400);
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
        throw makeExpressError('Email already registered', 400);
    }
    const { salt, hash } = User.hashPassword(password);
    const user = new User({ email: normalizedEmail, salt, hash });
    await user.save();
    res.redirect('/');
}));

// Login route - minimal verification
app.post('/login', warpAsync(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = User.normalizeEmail(email);
    if (!email || !password) {
        throw makeExpressError('Email and password required', 400);
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        throw makeExpressError('Invalid credentials', 400);
    }
    if (!user.verifyPassword(password)) {
        throw makeExpressError('Invalid credentials', 400);
    }
    // Minimal: successful login redirects home. Session handling can be added later.
    res.redirect('/');
}));

const deleteReview = warpAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError("Listing Not Found", 404);
    }
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
});

app.post("/listings/:id/reviews/:reviewId/delete", deleteReview);
app.delete("/listings/:id/reviews/:reviewId", deleteReview);
//create route
app.post("/listings", validateListing, warpAsync(async (req, res) => {

    const newListing = new Listing(req.body);
    await newListing.save();
    res.redirect("/listings");
}));
//edit route
app.get("/listings/:id/edit", warpAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/edit", { listing: listing, categories: LISTING_CATEGORIES });
}));

app.put("/listings/:id", warpAsync(async (req, res) => {
    let { id } = req.params;
    const listingData = req.body.listing || {};
    const updatedListing = await Listing.findByIdAndUpdate(id, listingData, {
        new: true,
        runValidators: true,
    });
    if (!updatedListing) {
        throw makeExpressError("Listing Not Found", 404);
    }
    res.redirect(`/listings/${id}`);
}));

//delete route
app.delete("/listings/:id", warpAsync(async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    console.log("Listing deleted");
    res.redirect("/listings");
}));

app.get("/privacy", (req, res) => {
    res.render("info", {
        title: "Privacy",
        message: "StayNest keeps this project simple: listing, booking, wishlist and inquiry data are stored only for app features.",
    });
});

app.get("/terms", (req, res) => {
    res.render("info", {
        title: "Terms",
        message: "Use StayNest demo data responsibly. Hosts and guests should verify listing details before making travel plans.",
    });
});

app.get("/company-details", (req, res) => {
    res.render("info", {
        title: "Company details",
        message: "StayNest Private Limited is the demo brand for this stay booking project.",
    });
});

// app.get("/testListing", async (req, res) => {
//     let sampleListing = new Listing({
//         title: "My New Villa",
//         description: "By the Beach",
//         price: 1200,
//         location: "Calangute,Goa",
//         country: "India",

//     });

//     await sampleListing.save();
//     console.log("sample was saved");
//     res.send("successful testing");
// });
app.all(/.*/, (req, res, next) => {
    next(makeExpressError("Page Not Found", 404));
});
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).render("error", { err });
});
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);


});
