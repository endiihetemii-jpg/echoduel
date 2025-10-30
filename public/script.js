const socket = io();

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

// Fillo kamerën
async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;
}

// Krijo lidhjen
function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_SERVERS);
  pc.ontrack = e => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
  };
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

// Shkëput dhe kërko partner të ri
function reconnect() {
  if (pc) {
    pc.close();
    pc = null;
  }
  document.getElementById("remoteVideo").srcObject = null;
  socket.emit("findPartner");
}

// Kur shtypet butoni NEXT
document.getElementById("nextBtn").addEventListener("click", () => {
  socket.emit("next");
  reconnect();
});

// Kur partneri tjetër shtyp NEXT
socket.on("partnerNexted", () => reconnect());

// Kur serveri gjen partner
socket.on("partnerFound", async partnerId => {
  currentPeerId = partnerId;
  createPeerConnection();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { offer, to: partnerId });
});

// Kur vjen ofertë nga partneri
socket.on("offer", async data => {
  createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { answer, to: data.from });
});

// Kur merr përgjigje
socket.on("answer", async data => {
  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

// ICE Candidate
socket.on("candidate", async data => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (e) {
    console.error("Error adding ICE candidate:", e);
  }
});

// Kur partneri largohet → rifillo vetvetiu
socket.on("partnerLeft", () => reconnect());

// Në pritje për partner → rifillo vet (pa tekst)
socket.on("waitingForPartner", () => {
  socket.emit("findPartner");
});

// Fillo gjithçka
initCamera();
socket.emit("findPartner");
