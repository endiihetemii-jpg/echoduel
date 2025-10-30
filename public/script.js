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

// aktivizo kamerën
async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;
}

// krijo lidhjen
function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_SERVERS);
  pc.ontrack = e => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
  };
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

// shkëput dhe rifillo automatikisht
function reconnect() {
  if (pc) {
    pc.close();
    pc = null;
  }
  document.getElementById("remoteVideo").srcObject = null;
  socket.emit("findPartner");
}

// manual NEXT (për raste testimi)
document.getElementById("nextBtn").addEventListener("click", () => {
  socket.emit("next");
  reconnect();
});

// kur partneri shtyp next ose del — rifillo vetvetiu
socket.on("forceNext", () => reconnect());
socket.on("autoFind", () => reconnect());

// gjetje partneri
socket.on("partnerFound", async partnerId => {
  currentPeerId = partnerId;
  createPeerConnection();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { offer, to: partnerId });
});

// kur vjen ofertë
socket.on("offer", async data => {
  createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { answer, to: data.from });
});

// përgjigjja
socket.on("answer", async data => {
  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

// ICE candidate
socket.on("candidate", async data => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (e) {
    console.error("Error adding ICE candidate:", e);
  }
});

// kur nuk ka partner → rifillo vet
socket.on("waitingForPartner", () => {
  setTimeout(() => socket.emit("findPartner"), 1000);
});

// nis gjithçka
initCamera();
socket.emit("findPartner");
