const express = require("express");
const app = express();

const ivasmsRouter = require("./ivasms");

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/ivasms", ivasmsRouter);

app.get("/", (req, res) => {
  res.send("IVSMS API running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});