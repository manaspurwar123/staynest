const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (value) => EMAIL_REGEX.test(normalizeEmail(value)),
            message: 'Please provide a valid email address.'
        }
    },
    hash: { type: String, required: true, minlength: 64 },
    salt: { type: String, required: true, minlength: 16 },
    provider: { type: String, default: 'email' },
    name: { type: String },
    createdAt: { type: Date, default: Date.now }
});

userSchema.statics.normalizeEmail = normalizeEmail;

userSchema.statics.hashPassword = function (password, salt) {
    if (!password || typeof password !== 'string' || password.length < 6) {
        const err = new Error('Password must be at least 6 characters long.');
        err.statusCode = 400;
        throw err;
    }
    const safeSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, safeSalt, 64).toString('hex');
    return { salt: safeSalt, hash };
};

userSchema.methods.verifyPassword = function (password) {
    const computed = crypto.scryptSync(password, this.salt, 64).toString('hex');
    return computed === this.hash;
};

module.exports = mongoose.model('User', userSchema);
