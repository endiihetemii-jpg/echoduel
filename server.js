const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

const users = new Set();

io.on("connection", socket => {
  users.add(socket.id);
  console.log("User connected:", socket.id);

  // kërko partner
  socket.on("findPartner", () => {
    let partner = null;
    for (let userId of users) {
      const userSocket = io.sockets.sockets.get(userId);
      if (userId !== socket.id && userSocket && !userSocket.partnerId) {
        partner = userId;
        break;
      }
    }

    if (partner) {
      socket.partnerId = partner;
      io.sockets.sockets.get(partner).partnerId = socket.id;

      socket.emit("partnerFound", partner);
      io.to(partner).emit("partnerFound", socket.id);
    } else {
      socket.emit("waitingForPartner");
    }
  });

  // kur dikush shtyp next
  socket.on("next", () => {
    const partnerId = socket.partnerId;
    if (partnerId && io.sockets.sockets.get(partnerId)) {
      io.to(partnerId).emit("forceNext");
      io.sockets.sockets.get(partnerId).partnerId = null;
    }
    socket.partnerId = null;
    socket.emit("autoFind");
  });

  // kur del nga lidhja
  socket.on("disconnect", () => {
    users.delete(socket.id);
    if (socket.partnerId && io.sockets.sockets.get(socket.partnerId)) {
      const partnerId = socket.partnerId;
      io.to(partnerId).emit("forceNext");
      io.sockets.sockets.get(partnerId).partnerId = null;
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, () => console.log("Server running on port", PORT));
