// public/script.js
const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn    = document.getElementById("startBtn");
const nextBtn     = document.getElementById("nextBtn");
const flipBtn     = document.getElementById("flipBtn");
const msgInput    = document.getElementById("msgInput");
const sendBtn     = document.getElementById("sendBtn");
const messages    = document.getElementById("messages");

const socket = io(); // i lidhur me të njëjtin host

// ——— KTU: STUN + TURN (OpenRelay falas)
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

let pc;               // RTCPeerConnection
let currentPeerId;    // socket id i palës
let localStream;      // kamera/mikrofoni
let usingFront = true;

// helper
function logChat(text, mine = false) {
  const p = document.createElement("p");
  p.textContent = text;
  p.style.margin = "4px 0";
  if (mine) p.style.fontWeight = "600";
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

// ndez kamerën
async function ensureMedia() {
  if (localStream) return localStream;
  const constraints = {
    audio: true,
    video: { facingMode: usingFront ? "user" : "environment" }
  };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localStream;
  await localVideo.play();
  return localStream;
}

function createPeer() {
  if (pc) pc.close();
  pc = new RTCPeerConnection(ICE_SERVERS);

  // kur vijnë kandidatë ICE nga browseri ynë
  pc.onicecandidate = (e) => {
    if (e.candidate && currentPeerId) {
      socket.emit("signal-ice", { to: currentPeerId, candidate: e.candidate });
    }
  };

  // kur vijnë track-ët e palës
  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.play().catch(()=>{});
  };

  // shto stream-in tonë
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
}

async function start() {
  try {
    await ensureMedia();
    socket.emit("next", { currentPeerId }); // futu në radhë ose kërko partner të ri
    startBtn.disabled = true;
  } catch (err) {
    alert("Gabim me kamerën: " + err.message);
  }
}

// sinjalizimi nga serveri
socket.on("status", (s) => {
  logChat("Status: " + s);
});

socket.on("matched", async ({ peerId, initiator }) => {
  currentPeerId = peerId;
  logChat("U lidhët me: " + peerId.slice(0,6));
  await ensureMedia();
  createPeer();

  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal-offer", { to: currentPeerId, sdp: offer });
  }
});

socket.on("signal-offer", async ({ from, sdp }) => {
  currentPeerId = from;
  await ensureMedia();
  createPeer();
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("signal-answer", { to: currentPeerId, sdp: answer });
});

socket.on("signal-answer", async ({ sdp }) => {
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("signal-ice", async ({ candidate }) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (_) {}
});

socket.on("peer-left", () => {
  logChat("Pala doli. Shtyp NEXT për partner tjetër.");
  if (pc) pc.close();
  pc = null;
  currentPeerId = null;
});

// chat
sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if (!text || !currentPeerId) return;
  socket.emit("chat", { to: currentPeerId, text });
  logChat("Ti: " + text, true);
  msgInput.value = "";
};
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.onclick();
});
socket.on("chat", ({ from, text }) => {
  logChat("Ai: " + text);
});

// UI
startBtn.onclick = start;
nextBtn.onclick  = () => {
  socket.emit("next", { currentPeerId });
  if (pc) pc.close();
  pc = null;
  currentPeerId = null;
  logChat("Duke kërkuar partner tjetër…");
};

// ndërrimi i kamerës në celular
flipBtn.onclick = async () => {
  usingFront = !usingFront;
  if (!localStream) return;
  // ndalo track-et ekzistuese
  localStream.getTracks().forEach(t => t.stop());
  localStream = null;
  await ensureMedia();
  if (pc) {
    // zëvendëso video track në peerconnection
    const senders = pc.getSenders();
    const newVideoTrack = localStream.getVideoTracks()[0];
    const videoSender = senders.find(s => s.track && s.track.kind === "video");
    if (videoSender && newVideoTrack) {
      await videoSender.replaceTrack(newVideoTrack);
    }
  }
};
