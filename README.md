# StayNest

StayNest is a Node.js and Express stay-booking web app with listings, reviews, bookings, and user authentication.

## Run Locally

```bash
npm install
npm start
```

Open `http://localhost:8080/listings`.

## Database

Set your MongoDB Atlas connection string in a local `.env` file:

```bash
ATLASDB_URL=your_mongodb_atlas_connection_string
```

If `ATLASDB_URL` is not set, the app falls back to local MongoDB at `mongodb://127.0.0.1:27017/mydb`.
