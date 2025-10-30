import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

io.on("connection", (socket) => {
  console.log("✅ New user connected:", socket.id);

  socket.on("offer", (data) => {
    socket.broadcast.emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.broadcast.emit("answer", data);
  });

  socket.on("ice-candidate", (data) => {
    socket.broadcast.emit("ice-candidate", data);
  });

  socket.on("message", (data) => {
    io.emit("message", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ EchoDuel server running at http://localhost:${PORT}`);
});
