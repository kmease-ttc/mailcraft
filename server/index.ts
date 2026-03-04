import express from "express";
import { emailRouter } from "./routes/email.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.use("/api/email", emailRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mailcraft API running on http://localhost:${PORT}`);
});
