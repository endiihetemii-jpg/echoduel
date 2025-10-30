// src/server.js
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
  cors: {
    origin: "*", // Render e përdor HTTPS, dhe për test lokal s'na pengon
  }
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_, res) => res.send("ok")); // për Render health check

// ——— Matchmaking super i thjeshtë: çiftëzon nga dy përdorues radhazi
let waiting = null;

io.on("connection", socket => {
  console.log("🟢 connected:", socket.id);

  // sapo hyjmë, futu në radhë
  if (!waiting) {
    waiting = socket.id;
    socket.emit("status", "waiting");
  } else {
    const peerA = waiting;
    const peerB = socket.id;
    waiting = null;

    // njofto të dy që janë lidhur
    io.to(peerA).emit("matched", { peerId: peerB, initiator: true });
    io.to(peerB).emit("matched", { peerId: peerA, initiator: false });
  }

  // sinjalizim WebRTC
  socket.on("signal-offer", ({ to, sdp }) => io.to(to).emit("signal-offer", { from: socket.id, sdp }));
  socket.on("signal-answer", ({ to, sdp }) => io.to(to).emit("signal-answer", { from: socket.id, sdp }));
  socket.on("signal-ice", ({ to, candidate }) => io.to(to).emit("signal-ice", { from: socket.id, candidate }));

  // chat
  socket.on("chat", ({ to, text }) => io.to(to).emit("chat", { from: socket.id, text }));

  // butoni NEXT: kthehu në radhë dhe njofto palën të mbyllë peerin
  socket.on("next", ({ currentPeerId }) => {
    if (currentPeerId) io.to(currentPeerId).emit("peer-left");
    if (!waiting) {
      waiting = socket.id;
      socket.emit("status", "waiting");
    } else if (waiting !== socket.id) {
      const peerA = waiting;
      const peerB = socket.id;
      waiting = null;
      io.to(peerA).emit("matched", { peerId: peerB, initiator: true });
      io.to(peerB).emit("matched", { peerId: peerA, initiator: false });
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 disconnected:", socket.id);
    if (waiting === socket.id) waiting = null;
    socket.broadcast.emit("peer-left", { id: socket.id });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ EchoDuel server running at http://localhost:${PORT}`);
});
