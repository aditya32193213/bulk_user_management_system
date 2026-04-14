// server.js
import "dotenv/config"; // ← static import, hoisted before all other modules evaluate
import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Fatal startup error:", err.message);
  process.exit(1);
});