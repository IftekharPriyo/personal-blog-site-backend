const express = require('express');
require('dotenv').config();
const connectDB = require('./config/db').connectDB;
const disconnectDB = require('./config/db').disconnectDB;

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.get('/', (req, res) => {
  res.send('Blog Site Backend !');
}
);

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("unhandledRejection", (reason, promise) => {  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  disconnectDB().then(() => {
    process.exit(1);
  });   

});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  disconnectDB().then(() => {
    server.close(() => {
      console.log("Server closed. Exiting process.");
      process.exit(0);
    });
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);   
  disconnectDB().then(() => {
    process.exit(1);
  })
});

