const express = require('express');
require('dotenv').config();
const app = express();
const mongoose = require('mongoose');
const Listing = require('./models/listing.js');
const Review = require('./models/reviews.js');
const User = require('./models/user.js');
const Booking = require('./models/booking.js');
const initData = require('./init/data.js');
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError.js');
const session = require('express-session');

const warpAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

const makeExpressError = (message, statusCode) => {
    if (typeof ExpressError === 'function') return new ExpressError(message, statusCode);
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
};

app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, 'public')));
app.disable('view cache');

app.use(session({
    secret: process.env.SESSION_SECRET || 'staynest-dev-secret',
    resave: false,
    saveUninitialized: false
}));

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/mydb';
const PORT = process.env.PORT || 8080;

async function seedListingsIfNeeded() {
    const count = await Listing.countDocuments({});
    if (count === 0) {
        await Listing.insertMany(initData.data);
        console.log('Sample listings inserted');
    }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'init', 'views'));
app.use(express.urlencoded({ extended: true }));

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

app.get('/', (req, res) => {
    res.redirect('/listings');
});

app.get('/listings', async (req, res) => {
    const listings = await Listing.find({});
    res.render('listings/index', { listings: listings });
});

app.get('/listings/new', (req, res) => {
    res.render('listings/new.ejs');
});

app.get('/auth/google', (req, res) => {
    res.redirect('/listings');
});

app.get('/auth/google/callback', (req, res) => {
    res.redirect('/listings');
});

app.get('/auth/apple', (req, res) => {
    res.redirect('/listings');
});

app.get('/listings/:id', warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate('reviews');
    if (!listing) {
        throw makeExpressError('Listing Not Found', 404);
    }
    res.render('listings/show', { listing: listing });
}));

app.post('/listings/:id/reviews', warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError('Listing Not Found', 404);
    }
    const reviewData = req.body.review || {};
    const newReview = new Review(reviewData);
    await newReview.save();
    listing.reviews.push(newReview._id);
    await listing.save();
    res.redirect(`/listings/${id}`);
}));

app.post('/listings/:id/bookings', warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError('Listing Not Found', 404);
    }
    const bookingData = req.body.booking || {};
    const guestName = String(bookingData.guestName || '').trim();
    const guestEmail = User.normalizeEmail(bookingData.guestEmail);
    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const guests = Number(bookingData.guests || 1);
    if (!guestName || !guestEmail || !bookingData.checkIn || !bookingData.checkOut) {
        throw makeExpressError('Name, email, check-in and check-out are required', 400);
    }
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
        throw makeExpressError('Please choose valid booking dates', 400);
    }
    if (guests < 1) {
        throw makeExpressError('At least one guest is required', 400);
    }
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * Number(listing.price || 0);
    const booking = new Booking({
        listing: listing._id,
        guestName,
        guestEmail,
        checkIn,
        checkOut,
        guests,
        nights,
        totalPrice
    });
    await booking.save();
    res.render('bookings/show', { booking, listing });
}));

app.post('/register', warpAsync(async (req, res) => {
    const { name, email, password } = req.body;
    const normalizedEmail = User.normalizeEmail(email);
    if (!name || !email || !password) {
        throw makeExpressError('Name, email and password required', 400);
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
        throw makeExpressError('Email already registered', 400);
    }
    const { salt, hash } = User.hashPassword(password);
    const user = new User({ name: name.trim(), email: normalizedEmail, salt, hash });
    await user.save();
    req.session.userId = user._id;
    res.redirect('/');
}));

app.post('/login', warpAsync(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = User.normalizeEmail(email);
    if (!email || !password) {
        throw makeExpressError('Email and password required', 400);
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.verifyPassword(password)) {
        throw makeExpressError('Invalid credentials', 400);
    }
    req.session.userId = user._id;
    res.redirect('/');
}));

app.get('/otp/send', (req, res) => {
    res.redirect('/listings');
});

app.get('/otp/verify', (req, res) => {
    res.redirect('/listings');
});

const deleteReview = warpAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw makeExpressError('Listing Not Found', 404);
    }
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
});

app.post('/listings/:id/reviews/:reviewId/delete', deleteReview);
app.delete('/listings/:id/reviews/:reviewId', deleteReview);

app.post('/listings', validateListing, warpAsync(async (req, res) => {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.redirect('/listings');
}));

app.get('/listings/:id/edit', warpAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    res.render('listings/edit', { listing: listing });
}));

app.delete('/listings/:id', warpAsync(async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    console.log('Listing deleted');
    res.redirect('/listings');
}));

app.all(/.*/, (req, res, next) => {
    next(makeExpressError('Page Not Found', 404));
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).render('error', { err });
});

async function startServer() {
    try {
        await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 10000 });
        console.log('Connected to MongoDB');
        await seedListingsIfNeeded();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Error connecting to MongoDB', err);
        process.exit(1);
    }
}

startServer();
