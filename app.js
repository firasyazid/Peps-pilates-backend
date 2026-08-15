const express = require("express");
const app = express();
const morgan = require("morgan");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv/config");
const errorHandler = require("./middleware/error");
const api = process.env.API_URL;
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));
const port = process.env.PORT || 3001;

//Middleware
app.use(morgan("tiny"));
app.use(express.json());
app.use(cors());
app.options("*", cors());
app.use(cors({
  origin: "*",  
}));

app.use(errorHandler);

const userRouter = require("./routes/user");
const coachRouter = require("./routes/coach");
const coursRouter = require("./routes/cours");
const scheduledSessionRouter = require("./routes/scheduledSession");
const bookingRouter = require("./routes/booking");
const abonnementRouter = require("./routes/abonnements");
const categoryRouter = require("./routes/categoris");
const articleRouter = require("./routes/articles");
const contactRouter = require("./routes/contact");
const analyticsRouter = require("./routes/analytics");
 
  
//Routes
app.use(`${api}/users`, userRouter);
app.use(`${api}/coaches`, coachRouter);
app.use(`${api}/cours`, coursRouter);
app.use(`${api}/scheduledSessions`, scheduledSessionRouter);
app.use(`${api}/bookings`, bookingRouter);
app.use(`${api}/abonnements`, abonnementRouter);
 app.use(`${api}/categories`, categoryRouter);
app.use(`${api}/articles`, articleRouter);
app.use(`${api}/contacts`, contactRouter);
app.use(`${api}/analytics`, analyticsRouter);
 

//Database
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "PepsApp",
  })
  .then(() => {
    console.log("Database Connection is ready...");
  })
  .catch((err) => {
    console.log(err);
  });

app.get("/", (req, res) => {
  res.send("Hello it's Firass , This is a pilate app backend.");
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
