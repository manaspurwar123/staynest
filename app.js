const express = require('express');
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Review = require("./models/reviews.js");
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

const MONGO_URL = "mongodb://127.0.0.1:27017/mydb";

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

app.get("/", (req, res) => {
    res.redirect("/listings");
});
//index route
app.get("/listings", async (req, res) => {
    const listings = await Listing.find({});
    res.render("listings/index", { listings: listings });
});
//new route

app.get("/listings/new", (req, res) => {
    res.render("listings/new.ejs");
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
    res.render("listings/edit", { listing: listing });
}));

//delete route
app.delete("/listings/:id", warpAsync(async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    console.log("Listing deleted");
    res.redirect("/listings");
}));

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
app.listen(8080, () => {
    console.log("Server is running on port 8080");


});