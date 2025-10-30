import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "../public")));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  if (waitingUser) {
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner.id;
    partner.partner = socket.id;

    socket.emit("matched", { partner: partner.id });
    partner.emit("matched", { partner: socket.id });
  } else {
    waitingUser = socket;
    socket.emit("waiting", "⏳ Duke kërkuar partner...");
  }

  socket.on("offer", (data) => {
    if (socket.partner) io.to(socket.partner).emit("offer", data);
  });

  socket.on("answer", (data) => {
    if (socket.partner) io.to(socket.partner).emit("answer", data);
  });

  socket.on("candidate", (data) => {
    if (socket.partner) io.to(socket.partner).emit("candidate", data);
  });

  socket.on("message", (msg) => {
    if (socket.partner) io.to(socket.partner).emit("message", msg);
  });

  socket.on("next", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner-left");
      io.sockets.sockets.get(socket.partner).partner = null;
      socket.partner = null;
    }
    if (waitingUser && waitingUser.id !== socket.id) {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("matched", { partner: partner.id });
      partner.emit("matched", { partner: socket.id });
    } else {
      waitingUser = socket;
      socket.emit("waiting", "⏳ Duke kërkuar partner të ri...");
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    if (socket.partner) {
      io.to(socket.partner).emit("partner-left");
      const p = io.sockets.sockets.get(socket.partner);
      if (p) p.partner = null;
    }
    if (waitingUser && waitingUser.id === socket.id) waitingUser = null;
  });
});

const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ EchoDuel Global running on http://localhost:${PORT}`);
});
