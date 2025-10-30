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

  socket.on("findPartner", () => {
    let partner = null;
    for (let userId of users) {
      if (userId !== socket.id && !io.sockets.sockets.get(userId).partnerId) {
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

  // Kur dikush shtyp "Next"
  socket.on("next", () => {
    const partnerId = socket.partnerId;
    if (partnerId && io.sockets.sockets.get(partnerId)) {
      io.to(partnerId).emit("partnerNexted");
      io.sockets.sockets.get(partnerId).partnerId = null;
    }
    socket.partnerId = null;
    socket.emit("waitingForPartner");
  });

  // Kur dikush largohet
  socket.on("disconnect", () => {
    users.delete(socket.id);
    if (socket.partnerId && io.sockets.sockets.get(socket.partnerId)) {
      io.to(socket.partnerId).emit("partnerDisconnected");
      io.sockets.sockets.get(socket.partnerId).partnerId = null;
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, () => console.log("Server running on port", PORT));
