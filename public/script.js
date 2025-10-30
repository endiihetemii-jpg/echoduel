const socket = io();

// STUN + TURN
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

let pc;
let localStream;
let currentPeerId;

async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;
}

function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_SERVERS);
  pc.ontrack = e => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
  };
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

function disconnectAndFindNewPartner() {
  if (pc) {
    pc.close();
    pc = null;
  }
  document.getElementById("remoteVideo").srcObject = null;
  socket.emit("findPartner");
}

// Kur një përdorues shtyp “Next”
document.getElementById("nextBtn").addEventListener("click", () => {
  socket.emit("next"); // njofton serverin
  disconnectAndFindNewPartner(); // rifillon vet për atë që e shtypi
});

// Kur partneri tjetër shtyp “Next” → edhe kjo pajisje kalon automatikisht
socket.on("partnerNexted", () => {
  disconnectAndFindNewPartner();
});

// Kur serveri gjen partner të ri
socket.on("partnerFound", async partnerId => {
  currentPeerId = partnerId;
  createPeerConnection();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { offer, to: partnerId });
});

socket.on("offer", async data => {
  createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { answer, to: data.from });
});

socket.on("answer", async data => {
  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on("candidate", async data => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (e) {
    console.error("Error adding ice candidate", e);
  }
});

socket.on("waitingForPartner", () => {
  console.log("Duke kërkuar partner...");
});

socket.on("partnerDisconnected", () => {
  disconnectAndFindNewPartner();
});

initCamera();
socket.emit("findPartner");
